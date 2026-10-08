/**
 * lib/server/geocode.ts のユニットテスト．
 */
import { describe, expect, it } from "vitest";
import { mergePlaces, toPlace } from "./geocode";

describe("toPlace", () => {
	it("ORS の結果を名称・所在地・座標に変換する", () => {
		const place = toPlace({
			geometry: { coordinates: [136.9055, 35.1816] },
			properties: {
				name: "名古屋城",
				locality: "名古屋",
				county: "名古屋市",
				region: "愛知県",
			},
		});
		expect(place).toEqual({
			name: "名古屋城",
			area: "名古屋市，愛知県",
			lat: 35.1816,
			lng: 136.9055,
		});
	});

	it("名称と同じ所在地は省く", () => {
		const place = toPlace({
			geometry: { coordinates: [136.9, 35.17] },
			properties: { name: "栄", locality: "栄", region: "愛知県" },
		});
		expect(place.area).toBe("愛知県");
	});
});

describe("mergePlaces", () => {
	const nagoya = { name: "栄", area: "名古屋市", lat: 35.17, lng: 136.908 };

	it("同じ名前で近い候補は1つにまとめ，順番を保つ", () => {
		const nearDup = { ...nagoya, lat: 35.1701 };
		const saitama = { name: "栄", area: "新座市", lat: 35.79, lng: 139.56 };
		expect(mergePlaces([nagoya, nearDup, saitama], 6)).toEqual([
			nagoya,
			saitama,
		]);
	});

	it("最大件数で打ち切る", () => {
		const many = Array.from({ length: 10 }, (_, i) => ({
			...nagoya,
			name: `栄${i}`,
		}));
		expect(mergePlaces(many, 6)).toHaveLength(6);
	});
});
