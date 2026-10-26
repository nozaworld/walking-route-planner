/**
 * OpenRouteService（ORS）の経路探索 API を呼び出す．
 * 経由点を徒歩ルート（foot-walking）でつなぎ，ORS のエラーを画面向けのメッセージに変換する．
 * 徒歩ルートには勾配を制限するオプションがないので，勾配の上限を守るときは代わりの経路を複数もらって選ぶ．
 * API キーを使うのでサーバー側からのみ呼ぶこと．
 */

import type { LatLng } from "@/lib/geo";

const ORS_DIRECTIONS_URL =
	"https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

/** ORS の公開 API が1リクエストで受け付ける経由点の上限 */
export const ORS_MAX_WAYPOINTS = 50;

/** 代わりの経路を頼むときの本数（ORS の上限は3本） */
const ALTERNATIVE_COUNT = 3;

/** 経路探索の失敗．status はそのまま API のレスポンスに使う */
export class RoutingError extends Error {
	/** message は画面にそのまま表示できる日本語にする */
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "RoutingError";
	}
}

/** ORS のレスポンスのうち使う部分 */
type OrsResponse = {
	features?: {
		geometry: { coordinates: [number, number][] };
		properties: { summary: { distance?: number } };
	}[];
	error?: { code?: number; message?: string } | string;
};

/** ORS が返す経路1本 */
type FootRoute = { coords: LatLng[]; distance: number };

/** ORS の徒歩ルートの API を呼び，最初の経路の座標と距離を返す */
async function requestFootRoute(
	body: Record<string, unknown>,
): Promise<FootRoute> {
	const [first] = await requestFootRoutes(body);
	return first;
}

/**
 * ORS の徒歩ルートの API を呼び，返ってきた経路をすべて返す（代わりの経路を頼んだときは複数）．
 * body は ORS にそのまま送る本文（座標は [経度, 緯度] の順）．
 */
async function requestFootRoutes(
	body: Record<string, unknown>,
): Promise<FootRoute[]> {
	const apiKey = process.env.ORS_API_KEY;
	if (!apiKey) {
		console.error("ORS_API_KEY が設定されていません");
		throw new RoutingError("経路を計算できませんでした．", 500);
	}

	const res = await fetch(ORS_DIRECTIONS_URL, {
		method: "POST",
		headers: {
			Authorization: apiKey,
			"Content-Type": "application/json",
			Accept: "application/geo+json",
		},
		body: JSON.stringify(body),
	});
	const data = (await res.json().catch(() => ({}))) as OrsResponse;

	const features = data.features ?? [];
	if (!res.ok || features.length === 0) {
		throw toRoutingError(res.status, data.error);
	}

	return features.map((feature) => ({
		coords: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
		distance: feature.properties.summary.distance ?? 0,
	}));
}

/**
 * 経由点を順に徒歩ルートでつなぐ．
 * 全区間を1リクエストで取得する（旧版は区間ごとに順番に呼んでいた）．
 * waypoints は ORS_MAX_WAYPOINTS 点以下にしてから渡すこと．
 */
export function routeOnFoot(waypoints: LatLng[]) {
	return requestFootRoute({
		coordinates: waypoints.map((p) => [p.lng, p.lat]),
	});
}

/**
 * 2点の間の徒歩ルートを，最大 ALTERNATIVE_COUNT 本の候補として返す（勾配の上限を守る経路を選ぶため）．
 * ORS の代わりの経路は経由点が2点のときしか使えない．1回のリクエストで済む．
 */
export function routeAlternativesOnFoot(from: LatLng, to: LatLng) {
	return requestFootRoutes({
		coordinates: [
			[from.lng, from.lat],
			[to.lng, to.lat],
		],
		// share_factor：候補どうしが重なってよい割合，weight_factor：最短に比べて遠回りしてよい倍率
		alternative_routes: {
			target_count: ALTERNATIVE_COUNT,
			share_factor: 0.6,
			weight_factor: 1.6,
		},
	});
}

/**
 * start から出て start に戻る，およそ length [m] の周回ルートを作る（逆算モード用）．
 * seed を変えると別のルートになる．
 */
export function roundTripOnFoot(start: LatLng, length: number, seed: number) {
	return requestFootRoute({
		coordinates: [[start.lng, start.lat]],
		// points は周回の途中で通る点の数（多いほど丸い形に近づく）
		options: { round_trip: { length, points: 5, seed } },
	});
}

/**
 * ORS の HTTP ステータスとエラーコードを RoutingError に変換する．
 * エラーコードは https://giscience.github.io/openrouteservice/api-reference/error-codes を参照．
 */
function toRoutingError(
	status: number,
	error: OrsResponse["error"],
): RoutingError {
	const code = typeof error === "object" ? error.code : undefined;
	if (status === 429) {
		return new RoutingError(
			"経路探索の利用回数の上限に達しました．しばらく待ってからお試しください．",
			429,
		);
	}
	// 2010: 指定した点の近くに通れる道が見つからない
	if (code === 2010) {
		return new RoutingError(
			"道から離れすぎた点があります．道の近くをクリックしてください．",
			422,
		);
	}
	// 2004: ルートの距離が上限を超えた
	if (code === 2004) {
		return new RoutingError("ルートが長すぎます．", 422);
	}
	console.error("ORS error", status, error);
	return new RoutingError("経路を計算できませんでした．", 502);
}
