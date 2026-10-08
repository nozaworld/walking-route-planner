/**
 * GET /api/geocode?q=名古屋城&lat=35.18&lng=136.91：地名検索 API．
 * ORS の API キーを画面に渡さないよう，サーバー側で中継する．
 * lat・lng（地図の中心）を渡すと，その近くの候補を先に並べる．
 * ORS の無料枠を守るため，呼ぶ前に利用回数を数える（lib/server/rate-limit.ts）．
 */

import { type GeocodeResponse, geocodeQuerySchema } from "@/lib/geocode";
import { searchPlaces } from "@/lib/server/geocode";
import { RoutingError } from "@/lib/server/ors";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

/** 検索語を受け取り，候補の一覧を返す */
export async function GET(request: Request) {
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const parsed = geocodeQuerySchema.safeParse(params);
	if (!parsed.success) {
		return Response.json(
			{ error: "検索する地名を入力してください．" },
			{ status: 400 },
		);
	}

	// 入力が正しいものだけを数える
	const limit = await checkRateLimit("geocode", request);
	if (!limit.ok) return tooManyRequests(limit);

	const { q, lat, lng } = parsed.data;
	const near =
		lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
	try {
		const places = await searchPlaces(q, near);
		return Response.json({ places } satisfies GeocodeResponse);
	} catch (e) {
		if (e instanceof RoutingError) {
			return Response.json({ error: e.message }, { status: e.status });
		}
		// 想定外のエラーは内容を画面に出さずログにだけ残す
		console.error(e);
		return Response.json(
			{ error: "地名を検索できませんでした．" },
			{ status: 500 },
		);
	}
}
