/**
 * OpenRouteService（ORS）の地名検索（Geocoding）API を呼び出す．
 * 日本国内に絞り，日本語の名称で最大 MAX_RESULTS 件を返す．
 * 地図の中心が分かるときは「近く（半径 NEARBY_RADIUS_KM）」と「全国」を同時に検索し，
 * 近くの候補を先に並べる（ORS の focus.point だけでは近さがほとんど効かないため）．
 * API キーを使うのでサーバー側からのみ呼ぶこと．
 */

import { haversine, type LatLng } from "@/lib/geo";
import type { Place } from "@/lib/geocode";
import { RoutingError } from "./ors";

const ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";

/** 返す候補の数 */
const MAX_RESULTS = 6;
/** 「近く」とみなす半径 [km] */
const NEARBY_RADIUS_KM = 50;
/** これより近い候補は同じ場所とみなして1つにまとめる [m] */
const SAME_PLACE_M = 300;

/** ORS の検索結果1件のうち使う部分 */
type OrsFeature = {
	geometry: { coordinates: [number, number] };
	properties: {
		name?: string;
		label?: string;
		locality?: string;
		county?: string;
		region?: string;
	};
};

/**
 * 地名・駅名・施設名などから場所を探す．
 * near を渡すと，その地点の近くの候補を先に並べる．
 */
export async function searchPlaces(
	text: string,
	near?: LatLng,
): Promise<Place[]> {
	const apiKey = process.env.ORS_API_KEY;
	if (!apiKey) {
		console.error("ORS_API_KEY が設定されていません");
		throw new RoutingError("地名を検索できませんでした．", 500);
	}

	const [nearby, nationwide] = await Promise.all([
		near ? requestOrs(apiKey, text, near) : Promise.resolve([]),
		requestOrs(apiKey, text),
	]);
	return mergePlaces([...nearby, ...nationwide].map(toPlace), MAX_RESULTS);
}

/** ORS に1回問い合わせる．circle を渡すとその周辺に絞る */
async function requestOrs(
	apiKey: string,
	text: string,
	circle?: LatLng,
): Promise<OrsFeature[]> {
	const params = new URLSearchParams({
		text,
		"boundary.country": "JP",
		lang: "ja",
		size: String(MAX_RESULTS),
	});
	if (circle) {
		params.set("boundary.circle.lat", String(circle.lat));
		params.set("boundary.circle.lon", String(circle.lng));
		params.set("boundary.circle.radius", String(NEARBY_RADIUS_KM));
	}

	const res = await fetch(`${ORS_GEOCODE_URL}?${params}`, {
		headers: { Authorization: apiKey, Accept: "application/json" },
	});
	if (res.status === 429) {
		throw new RoutingError(
			"地名検索の利用回数の上限に達しました．しばらく待ってからお試しください．",
			429,
		);
	}
	if (!res.ok) {
		console.error("ORS geocode error", res.status, await res.text());
		throw new RoutingError("地名を検索できませんでした．", 502);
	}
	const data = (await res.json()) as { features?: OrsFeature[] };
	return data.features ?? [];
}

/**
 * ORS の検索結果1件を Place に変換する．
 * 所在地は「市区町村，都道府県」の形にし，名称と同じものは省く．
 */
export function toPlace(feature: OrsFeature): Place {
	const [lng, lat] = feature.geometry.coordinates;
	const p = feature.properties;
	const name = p.name ?? p.label?.split(",")[0] ?? "名称不明";
	const area = [p.county ?? p.locality, p.region]
		.filter((s): s is string => Boolean(s) && s !== name)
		.join("，");
	return { name, area, lat, lng };
}

/**
 * 並び順を保ったまま，同じ名前で近すぎる候補を除き，max 件までにする．
 * 近くの検索と全国の検索で同じ場所が返ってくるのをまとめるために使う．
 */
export function mergePlaces(places: Place[], max: number): Place[] {
	const out: Place[] = [];
	for (const p of places) {
		const dup = out.some(
			(q) => q.name === p.name && haversine(q, p) < SAME_PLACE_M,
		);
		if (!dup) out.push(p);
		if (out.length >= max) break;
	}
	return out;
}
