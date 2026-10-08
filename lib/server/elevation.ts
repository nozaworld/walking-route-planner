/**
 * 国土地理院の標高 API から，点列の標高を取得する．
 * 同時に CONCURRENCY 本ずつ並列に取り，取れなかった点は近くの値で補う．
 * データがあるのは日本国内の陸地のみ．
 */

import type { LatLng } from "@/lib/geo";
import { RoutingError } from "./ors";

const GSI_ELEV_API =
	"https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php";

/** 同時に投げるリクエスト数（国土地理院に負荷をかけすぎない程度） */
const CONCURRENCY = 10;

/**
 * 1点の標高 [m] を取得する．データがない地点（海上・国外）や失敗時は null．
 * 標高は変わらないので，結果は Next.js のデータキャッシュに残す．
 */
async function fetchElevation({ lat, lng }: LatLng): Promise<number | null> {
	// 小数5桁（約1m）に丸めて，同じ地点がキャッシュに当たりやすくする
	const url = `${GSI_ELEV_API}?lon=${lng.toFixed(5)}&lat=${lat.toFixed(5)}&outtype=JSON`;
	try {
		const res = await fetch(url, { cache: "force-cache" });
		if (!res.ok) return null;
		// データがない地点では elevation が "-----" という文字列で返る
		const data = (await res.json()) as { elevation: number | string };
		return typeof data.elevation === "number" ? data.elevation : null;
	} catch {
		return null;
	}
}

/**
 * 点列の標高 [m] を，points と同じ順・同じ長さで返す．
 * 1点も取れなかったときは RoutingError を投げる．
 */
export async function getElevations(points: LatLng[]): Promise<number[]> {
	const raw: (number | null)[] = new Array(points.length).fill(null);
	let next = 0;

	// 各ワーカーが未処理の点を1つずつ取り出して処理する
	const worker = async () => {
		while (next < points.length) {
			const i = next++;
			raw[i] = await fetchElevation(points[i]);
		}
	};
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));

	if (raw.every((e) => e === null)) {
		throw new RoutingError(
			"標高データを取得できませんでした（国土地理院のデータは日本国内のみです）．",
			422,
		);
	}
	return fillGaps(raw);
}

/**
 * 欠けた値（null）を最も近い有効値で埋める．等距離なら前の値を優先する．
 * 旧版は 0m で埋めていたため，断面図に崖のような段差ができていた．
 */
export function fillGaps(values: (number | null)[]): number[] {
	return values.map((v, i) => {
		if (v !== null) return v;
		for (let d = 1; d < values.length; d++) {
			const before = values[i - d];
			if (before != null) return before;
			const after = values[i + d];
			if (after != null) return after;
		}
		return 0;
	});
}
