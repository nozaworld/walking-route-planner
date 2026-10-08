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
	const map = page.locator(".leaflet-container");
	await map.click({ position: { x: 700, y: 300 } });
	await map.click({ position: { x: 800, y: 250 } });
	await page.getByRole("button", { name: "経路を確定する" }).click();
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await expect(page.locator(".leaflet-container")).toBeVisible();
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
