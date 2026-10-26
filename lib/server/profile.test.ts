/**
 * lib/server/profile.ts のユニットテスト（勾配の上限で候補を選ぶ処理）．
 * 標高の取得は差し替え，経路の座標の1点目の lng を「最大勾配」として扱う．
 */
import { describe, expect, it, vi } from "vitest";
import type { LatLng } from "@/lib/geo";
import type { PlanResponse } from "@/lib/plan";
import { pickByGrade } from "./profile";

/** 北へ約111m 進む2点で，最大勾配が grade になる経路の結果を作る */
function fakePlan(coords: LatLng[]): Promise<PlanResponse> {
	const grade = coords[0].lng;
	const points = [
		{ lat: 35, lng: 136 },
		{ lat: 35.001, lng: 136 },
	];
	return Promise.resolve({
		coords,
		profile: { points, elevs: [0, grade * 111.2] },
	});
}

/** 最大勾配が grade の候補（呼ばれたかを確かめられるよう vi.fn にする） */
function candidate(grade: number) {
	return vi.fn(async () => [{ lat: 0, lng: grade }]);
}

describe("pickByGrade", () => {
	it("上限を守る最初の候補を返し，残りは調べない", async () => {
		const later = candidate(0.01);
		const plan = await pickByGrade(
			[candidate(0.12), candidate(0.05), later],
			0.06,
			fakePlan,
		);
		expect(plan.coords[0].lng).toBe(0.05);
		expect(later).not.toHaveBeenCalled();
	});

	it("どれも上限を超えたら，最も緩い候補を返す", async () => {
		const plan = await pickByGrade(
			[candidate(0.12), candidate(0.09), candidate(0.15)],
			0.06,
			fakePlan,
		);
		expect(plan.coords[0].lng).toBe(0.09);
	});

	it("null を返した候補と，2本目以降の失敗は飛ばす", async () => {
		const failing = vi.fn(async () => {
			throw new Error("ORS の失敗");
		});
		const skipped = vi.fn(async () => null);
		vi.spyOn(console, "error").mockImplementation(() => {});
		const plan = await pickByGrade(
			[candidate(0.12), failing, skipped],
			0.06,
			fakePlan,
		);
		expect(plan.coords[0].lng).toBe(0.12);
	});

	it("1本目の失敗はそのまま投げる", async () => {
		await expect(
			pickByGrade(
				[
					async () => {
						throw new Error("ORS の失敗");
					},
				],
				0.06,
				fakePlan,
			),
		).rejects.toThrow("ORS の失敗");
	});
});
