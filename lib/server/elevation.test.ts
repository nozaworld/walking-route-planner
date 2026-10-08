/**
 * lib/server/elevation.ts のユニットテスト．
 * 国土地理院への通信は fetch を差し替えて再現する．
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fillGaps, getElevations } from "./elevation";
import { RoutingError } from "./ors";

afterEach(() => {
	vi.unstubAllGlobals();
});

/** 国土地理院の API と同じ形のレスポンスを返す fetch を作る */
function stubElevationFetch(elevation: (lat: number) => number | string) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => {
			const lat = Number(new URL(url).searchParams.get("lat"));
			return Response.json({ elevation: elevation(lat) });
		}),
	);
}

describe("fillGaps", () => {
	it("欠けた値を最も近い有効値で埋める", () => {
		expect(fillGaps([null, 10, null, null, 30, null])).toEqual([
			10, 10, 10, 30, 30, 30,
		]);
	});
});

describe("getElevations", () => {
	const points = [1, 2, 3, 4].map((lat) => ({ lat, lng: 136 }));

	it("点と同じ順で標高を返す", async () => {
		stubElevationFetch((lat) => lat * 100);
		await expect(getElevations(points)).resolves.toEqual([100, 200, 300, 400]);
	});

	it("データのない点は近くの値で補う", async () => {
		stubElevationFetch((lat) => (lat === 2 ? "-----" : lat * 100));
		await expect(getElevations(points)).resolves.toEqual([100, 100, 300, 400]);
	});

	it("1点も取れなければ RoutingError", async () => {
		stubElevationFetch(() => "-----");
		await expect(getElevations(points)).rejects.toBeInstanceOf(RoutingError);
	});
});
