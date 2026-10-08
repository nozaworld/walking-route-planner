/**
 * lib/grade.ts のユニットテスト．
 */
import { describe, expect, it } from "vitest";
import { gradeLevel, gradeStops } from "./grade";

describe("gradeLevel", () => {
	it("上りも下りも絶対値で3段階に分ける", () => {
		expect(gradeLevel(0.02)).toBe("gentle");
		expect(gradeLevel(-0.05)).toBe("moderate");
		expect(gradeLevel(0.1)).toBe("steep");
		expect(gradeLevel(-0.08)).toBe("steep");
	});
});

describe("gradeStops", () => {
	// 北へ約111m ずつ進む4点
	const points = [0, 1, 2, 3].map((i) => ({ lat: 35 + i * 0.001, lng: 136 }));

	it("同じ段階が続く区間はまとめ，切り替わる位置を割合で返す", () => {
		// 平ら → 平ら → 急な上り（約111m で 11m 上る = 約10%）
		const stops = gradeStops(points, [10, 10, 10, 21]);
		expect(stops).toHaveLength(2);
		expect(stops[0]).toEqual({ at: 0, level: "gentle" });
		expect(stops[1].level).toBe("steep");
		expect(stops[1].at).toBeCloseTo(2 / 3, 2);
	});

	it("点が2つ未満なら空", () => {
		expect(gradeStops(points.slice(0, 1), [0])).toEqual([]);
	});
});
