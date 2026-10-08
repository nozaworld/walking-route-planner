/**
 * POST /api/plan：経由点から徒歩ルートと標高を求める API．
 * 1. 経由点を ORS で徒歩ルートにする
 * 2. ルートを断面図用に間引き，国土地理院から標高を取る
 * 消費カロリーなどの計算は，体重を変えたときにすぐ反映できるよう画面側で行う．
 * ORS の無料枠を守るため，呼ぶ前に利用回数を数える（lib/server/rate-limit.ts）．
 */

import { downsample } from "@/lib/geo";
import {
	type PlanErrorResponse,
	type PlanResponse,
	planRequestSchema,
} from "@/lib/plan";
import { getElevations } from "@/lib/server/elevation";
import { ORS_MAX_WAYPOINTS, RoutingError, routeOnFoot } from "@/lib/server/ors";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

/** 断面図と統計に使う点の数 */
const PROFILE_SAMPLES = 50;

/** エラーを { error } の形で返す */
function errorResponse(message: string, status: number) {
	return Response.json({ error: message } satisfies PlanErrorResponse, {
		status,
	});
}

/** 経由点を受け取り，経路の座標と断面図用の標高を返す */
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = planRequestSchema.safeParse(body);
	if (!parsed.success) {
		return errorResponse("経由点は2点以上指定してください．", 400);
	}

	// 入力が正しいものだけを数える
	const limit = await checkRateLimit("plan", request);
	if (!limit.ok) return tooManyRequests(limit);

	try {
		const waypoints = downsample(parsed.data.waypoints, ORS_MAX_WAYPOINTS);
		const { coords } = await routeOnFoot(waypoints);
		const points = downsample(coords, PROFILE_SAMPLES);
		const elevs = await getElevations(points);
		return Response.json({
			coords,
			profile: { points, elevs },
		} satisfies PlanResponse);
	} catch (e) {
		if (e instanceof RoutingError) return errorResponse(e.message, e.status);
		// 想定外のエラーは内容を画面に出さずログにだけ残す
		console.error(e);
		return errorResponse("ルートの計算に失敗しました．", 500);
	}
}
