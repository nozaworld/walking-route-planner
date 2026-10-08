/**
 * lib/energy-model.ts のユニットテスト．
 */
import { describe, expect, it } from "vitest";
import {
	buildSegments,
	computeStats,
	formatMinutes,
	walkEnergyCost,
	walkSpeedKmh,
} from "./energy-model";

describe("walkEnergyCost", () => {
	it("平地では Minetti の式の定数項 2.5 J/kg/m", () => {
		expect(walkEnergyCost(0)).toBeCloseTo(2.5);
	});

	it("上り坂は平地よりコストが高い", () => {
		expect(walkEnergyCost(0.1)).toBeGreaterThan(walkEnergyCost(0));
	});
});

describe("walkSpeedKmh", () => {
	it("急坂でも 1km/h を下回らない", () => {
		expect(walkSpeedKmh(0.45)).toBeGreaterThanOrEqual(1);
	});
});

describe("buildSegments", () => {
	it("n 点から n-1 区間を作る", () => {
		const segs = buildSegments(
			[
				{ lat: 35, lng: 136 },
				{ lat: 35.001, lng: 136 },
				{ lat: 35.002, lng: 136 },
			],
			[10, 20, 15],
		);
		expect(segs).toHaveLength(2);
		expect(segs[1]).toMatchObject({ elevStart: 20, elevEnd: 15 });
	});
});

describe("computeStats", () => {
	it("平地 1km・60kg なら約 36kcal", () => {
		const stats = computeStats([{ distM: 1000, elevStart: 0, elevEnd: 0 }], 60);
		expect(stats.dist).toBe(1000);
		expect(stats.gain).toBe(0);
		// 1000m × 2.5 J/kg/m × 60kg / 4184
		expect(stats.walkKcal).toBeCloseTo(35.85, 1);
	});

	it("上りと下りを別々に積算する", () => {
		const stats = computeStats(
			[
				{ distM: 100, elevStart: 0, elevEnd: 10 },
				{ distM: 100, elevStart: 10, elevEnd: 4 },
			],
			60,
		);
		expect(stats.gain).toBe(10);
		expect(stats.loss).toBe(6);
	});
});

describe("formatMinutes", () => {
	it("1 時間未満は分だけ", () => {
		expect(formatMinutes(42.3)).toBe("42分");
	});

	it("59.6 分は 1時間0分に繰り上がる", () => {
		expect(formatMinutes(59.6)).toBe("1時間0分");
	});
});
