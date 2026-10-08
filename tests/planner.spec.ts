/**
 * プランナー画面の E2E テスト．
 * 経路計算 API（/api/plan）と地図タイルは差し替えるので，ORS の API キーやネットワークは要らない．
 */
import { expect, type Page, test } from "@playwright/test";
import type { PlanResponse } from "@/lib/plan";

/** 名古屋付近を北東へ進む，標高が 10m → 30m に上るだけの架空のルート */
const FAKE_PLAN: PlanResponse = (() => {
	const points = Array.from({ length: 11 }, (_, i) => ({
		lat: 35.17 + i * 0.001,
		lng: 136.9 + i * 0.001,
	}));
	return {
		coords: points,
		profile: { points, elevs: points.map((_, i) => 10 + i * 2) },
	};
})();

/** 地図タイルの取得を止め，/api/plan の応答を差し替える */
async function stubNetwork(page: Page, body: unknown, status = 200) {
	await page.route("https://cyberjapandata.gsi.go.jp/xyz/**", (route) =>
		route.abort(),
	);
	await page.route("**/api/plan", (route) =>
		route.fulfill({ status, json: body }),
	);
}

/**
 * 「ルートを描きはじめる」から地図を2回クリックして，経路を確定する．
 * 画面の左側は操作パネルが覆っているので，右寄りをクリックする．
 */
async function drawAndConfirm(page: Page) {
	await page.getByRole("button", { name: "ルートを描きはじめる" }).click();
	const map = page.locator(".maplibregl-canvas");
	await map.click({ position: { x: 700, y: 300 } });
	await map.click({ position: { x: 800, y: 250 } });
	await page.getByRole("button", { name: "経路を確定する" }).click();
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await expect(page.locator(".maplibregl-canvas")).toBeVisible();
});

test("経路を確定すると統計と断面図が出る", async ({ page }) => {
	await stubNetwork(page, FAKE_PLAN);
	await drawAndConfirm(page);

	const stats = page.getByTestId("stats");
	await expect(stats).toContainText("km");
	await expect(stats).toContainText("獲得標高");
	await expect(stats).toContainText("20m");
	await expect(page.getByRole("img", { name: /標高断面図/ })).toBeVisible();
});

test("体重を変えると消費カロリーが計算し直される", async ({ page }) => {
	await stubNetwork(page, FAKE_PLAN);
	await drawAndConfirm(page);
	const stats = page.getByTestId("stats");
	await expect(stats).toBeVisible();
	const before = await stats.innerText();

	await page.getByRole("spinbutton").fill("90");
	await expect(stats).not.toHaveText(before);
});

test("API がエラーを返すとメッセージを出し，描画を続けられる", async ({
	page,
}) => {
	await stubNetwork(
		page,
		{ error: "道から離れすぎた点があります．道の近くをクリックしてください．" },
		422,
	);
	await drawAndConfirm(page);

	// Next.js も画面遷移の読み上げ用に role="alert" を置くので，文言で絞り込む
	await expect(
		page.getByRole("alert").filter({ hasText: "道から離れすぎた点" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "経路を確定する" }),
	).toBeEnabled();
});

test("保存したルートは再読み込み後も一覧に残り，削除できる", async ({
	page,
}) => {
	await stubNetwork(page, FAKE_PLAN);
	await drawAndConfirm(page);

	await page.getByRole("button", { name: "このルートを保存する" }).click();
	await page.getByLabel("ルート名").fill("朝の散歩");
	await page.getByRole("button", { name: "保存する" }).click();
	await expect(page.getByRole("button", { name: "保存済み" })).toBeDisabled();

	await page.reload();
	await page.getByRole("tab", { name: /保存済み/ }).click();
	const item = page.getByRole("button", { name: /^朝の散歩/ }).first();
	await expect(item).toBeVisible();

	await page.getByRole("button", { name: "朝の散歩を削除" }).click();
	await expect(item).toBeHidden();
	await expect(
		page.getByText("まだ保存されたルートはありません"),
	).toBeVisible();
});

test("パネルの幅を変えられ，再読み込み後も保たれる", async ({ page }) => {
	const handle = page.getByRole("separator", { name: "パネルの幅を変える" });
	await expect(handle).toHaveAttribute("aria-valuenow", "380");

	// つまみを右へ 100px ドラッグする
	const box = await handle.boundingBox();
	if (!box) throw new Error("つまみが見つからない");
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + box.width / 2, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 100, y, { steps: 5 });
	await page.mouse.up();
	await expect(handle).toHaveAttribute("aria-valuenow", "480");

	// キーボードでも変えられる
	await handle.focus();
	await page.keyboard.press("ArrowLeft");
	await expect(handle).toHaveAttribute("aria-valuenow", "460");

	await page.reload();
	await expect(
		page.getByRole("separator", { name: "パネルの幅を変える" }),
	).toHaveAttribute("aria-valuenow", "460");
});

test("地名を検索して選ぶと，その場所に目印が立つ", async ({ page }) => {
	await page.route("https://cyberjapandata.gsi.go.jp/xyz/**", (route) =>
		route.abort(),
	);
	await page.route("**/api/geocode?**", (route) =>
		route.fulfill({
			json: {
				places: [
					{
						name: "名古屋城",
						area: "名古屋市，愛知",
						lat: 35.1856,
						lng: 136.8992,
					},
					{
						name: "名古屋駅",
						area: "名古屋市，愛知",
						lat: 35.1709,
						lng: 136.8815,
					},
				],
			},
		}),
	);

	const box = page.getByRole("combobox", { name: "地名や駅名で探す" });
	await box.fill("名古屋");
	await box.press("Enter");
	const results = page.getByRole("list", { name: "検索結果" });
	await expect(results.getByRole("button")).toHaveCount(2);

	await results.getByRole("button", { name: /名古屋城/ }).click();
	await expect(results).toBeHidden();
	await expect(page.getByTestId("place-marker")).toHaveText("名古屋城");
});

test("ログイン中は保存済みルートをクラウドから読み，共有を切り替えられる", async ({
	page,
}) => {
	// ログイン状態と保存ルートの API を差し替えて，DB なしでログイン中の画面を再現する
	const now = new Date().toISOString();
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				session: {
					id: "s1",
					userId: "u1",
					token: "t",
					expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
					createdAt: now,
					updatedAt: now,
				},
				user: {
					id: "u1",
					name: "野沢",
					email: "test@example.com",
					emailVerified: false,
					createdAt: now,
					updatedAt: now,
				},
			},
		}),
	);
	const cloudRoute = {
		id: "11111111-1111-4111-8111-111111111111",
		name: "雲の上の散歩",
		shared: false,
		savedAt: Date.now(),
		coords: FAKE_PLAN.coords,
		profile: FAKE_PLAN.profile,
		stats: {
			dist: 1400,
			gain: 20,
			loss: 0,
			walkKcal: 60,
			walkMin: 17,
			bikeKcal: 30,
			bikeMin: 5,
		},
	};
	await page.route("**/api/routes", (route) =>
		route.fulfill({ json: { routes: [cloudRoute] } }),
	);
	await page.route(`**/api/routes/${cloudRoute.id}`, (route) =>
		route.fulfill({ json: { route: { ...cloudRoute, shared: true } } }),
	);
	await page.reload();

	await expect(
		page.getByRole("button", { name: "野沢のアカウント" }),
	).toBeVisible();
	await page.getByRole("tab", { name: /保存済み/ }).click();
	await expect(page.getByText("雲の上の散歩")).toBeVisible();
	// ゲスト向けの案内は出ない
	await expect(
		page.getByText("いまはこのブラウザに保存しています"),
	).toBeHidden();

	await page.getByRole("button", { name: "非公開" }).click();
	await expect(page.getByRole("button", { name: "共有中" })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "リンクをコピー" }),
	).toBeVisible();
});

test("目標から周回ルートを作ると，目標と実際の値を並べて出す", async ({
	page,
}) => {
	await stubNetwork(page, FAKE_PLAN);
	let calls = 0;
	await page.route("**/api/round-trip", (route) => {
		calls++;
		return route.fulfill({ json: FAKE_PLAN });
	});

	await page.getByRole("button", { name: "目標から作る" }).click();
	await page
		// トグルの項目は，部品の作りによって radio か button として見えるので，どちらでも押せるようにする
		.getByRole("radio", { name: "距離" })
		.or(page.getByRole("button", { name: "距離" }))
		.click();
	await page.getByLabel("目標の距離").fill("1.5");
	// 出発地点を選ぶまでは作れない
	await expect(
		page.getByRole("button", { name: "周回ルートを作る" }),
	).toBeDisabled();
	await page
		.locator(".maplibregl-canvas")
		.click({ position: { x: 700, y: 300 } });
	await page.getByRole("button", { name: "周回ルートを作る" }).click();

	await expect(page.getByText(/目標 1\.5 km → このルート/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "別の候補を作る" }),
	).toBeVisible();
	// 架空のルートは約1.4km で目標から15%以内なので，作り直さない
	expect(calls).toBe(1);
});
