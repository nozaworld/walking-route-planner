/**
 * lib/geo.ts のユニットテスト．
 */
import { describe, expect, it } from "vitest";
import { cumulativeDistances, downsample, haversine } from "./geo";

describe("haversine", () => {
	it("同じ点なら 0", () => {
		expect(haversine({ lat: 35, lng: 136 }, { lat: 35, lng: 136 })).toBe(0);
	});

	it("緯度 1 度はおよそ 111km", () => {
		const d = haversine({ lat: 35, lng: 136 }, { lat: 36, lng: 136 });
		expect(d).toBeGreaterThan(110_000);
		expect(d).toBeLessThan(112_000);
	});
});

describe("downsample", () => {
	it("点数が上限以下ならそのまま返す", () => {
		const pts = [1, 2, 3];
		expect(downsample(pts, 5)).toBe(pts);
	});

	it("始点と終点を残して上限の点数に間引く", () => {
		const pts = Array.from({ length: 101 }, (_, i) => i);
		const out = downsample(pts, 11);
		expect(out).toHaveLength(11);
		expect(out[0]).toBe(0);
		expect(out.at(-1)).toBe(100);
	});
});

describe("cumulativeDistances", () => {
	it("先頭は 0 で，等間隔の点なら距離も等間隔に増える", () => {
		const cum = cumulativeDistances([
			{ lat: 35, lng: 136 },
			{ lat: 35.01, lng: 136 },
			{ lat: 35.02, lng: 136 },
		]);
		expect(cum[0]).toBe(0);
		expect(cum[1]).toBeGreaterThan(0);
		expect(cum[2]).toBeCloseTo(cum[1] * 2, 0);
	});
});
