/**
 * POST /api/round-trip：出発地点に戻ってくる周回ルートを作る API（逆算モード用）．
 * 指定された長さの周回ルートを ORS で作り，断面図用の標高を付けて返す．
 * 目標（消費カロリー・時間・距離）から長さへの換算と補正は，体重を使うので画面側で行う．
 * 経路計算と同じ利用回数の枠で数える．
 */

import {
	type PlanErrorResponse,
	type PlanResponse,
	roundTripRequestSchema,
} from "@/lib/plan";
import { RoutingError, roundTripOnFoot } from "@/lib/server/ors";
import { withProfile } from "@/lib/server/profile";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

/** エラーを { error } の形で返す */
function errorResponse(message: string, status: number) {
	return Response.json({ error: message } satisfies PlanErrorResponse, {
		status,
	});
}

/** 出発地点・長さ・乱数の種を受け取り，周回ルートと断面図用の標高を返す */
export async function POST(request: Request) {
	const parsed = roundTripRequestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return errorResponse(
			"出発地点と長さ（0.5〜30km）を指定してください．",
			400,
		);
	}

	// 入力が正しいものだけを数える（ORS を1回呼ぶので経路計算と同じ枠）
	const limit = await checkRateLimit("plan", request);
	if (!limit.ok) return tooManyRequests(limit);

	try {
		const { start, length, seed } = parsed.data;
		const { coords } = await roundTripOnFoot(start, length, seed);
		return Response.json((await withProfile(coords)) satisfies PlanResponse);
	} catch (e) {
		if (e instanceof RoutingError) return errorResponse(e.message, e.status);
		// 想定外のエラーは内容を画面に出さずログにだけ残す
		console.error(e);
		return errorResponse("周回ルートを作れませんでした．", 500);
	}
}
