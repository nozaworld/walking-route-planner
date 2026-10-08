/**
 * lib/round-trip.ts のユニットテスト．
 */
import { describe, expect, it } from "vitest";
import { correctLength, estimateLength, needsCorrection } from "./round-trip";

describe("estimateLength", () => {
	it("60kg で約36kcal は平地 1km（2.5 J/kg/m で逆算）", () => {
		expect(estimateLength("kcal", 35.85, 60)).toBeCloseTo(1000, -1);
	});

	it("距離はそのまま m にする", () => {
		expect(estimateLength("km", 3, 60)).toBe(3000);
	});

	it("API が受け付ける範囲に収める", () => {
		expect(estimateLength("km", 0.1, 60)).toBe(500);
		expect(estimateLength("km", 100, 60)).toBe(30_000);
	});
});

describe("needsCorrection / correctLength", () => {
	it("15% 以内のずれなら作り直さない", () => {
		expect(needsCorrection(300, 330)).toBe(false);
		expect(needsCorrection(300, 400)).toBe(true);
	});

	it("実際が目標の 1.4 倍なら，長さを 1/1.4 にする", () => {
		expect(correctLength(4200, 3, 4.2)).toBeCloseTo(3000);
	});
});
