/**
 * 緯度経度まわりの計算ユーティリティ．
 * 2点間の距離（ハバーサイン公式），点列の間引き，累積距離を提供する．
 * サーバー（API）とブラウザ（断面図・統計）の両方から使う．
 */

/** 緯度経度の組 */
export type LatLng = { lat: number; lng: number };

/** 地球の平均半径 [m] */
const EARTH_RADIUS_M = 6371000;

/**
 * 2点間の大円距離 [m] をハバーサイン公式で求める．
 * 徒歩ルート程度の距離なら誤差は無視できる．
 */
export function haversine(a: LatLng, b: LatLng): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const la1 = toRad(a.lat);
	const la2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * 点列を等間隔に maxN 点まで間引く．
 * 始点と終点は必ず残す（旧版は終点が落ちてルートの最後が欠けていた）．
 */
export function downsample<T>(points: T[], maxN: number): T[] {
	if (points.length <= maxN) return points;
	if (maxN < 2) return points.slice(0, maxN);
	const step = (points.length - 1) / (maxN - 1);
	const out: T[] = [];
	for (let i = 0; i < maxN; i++) out.push(points[Math.round(i * step)]);
	return out;
}

/**
 * 始点からの累積距離 [m] を点ごとに返す（先頭は 0）．
 * 断面図の横軸に使う．
 */
export function cumulativeDistances(points: LatLng[]): number[] {
	const cum = [0];
	for (let i = 1; i < points.length; i++) {
		cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
	}
	return cum;
}
