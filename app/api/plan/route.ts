/**
 * POST /api/plan：経由点から徒歩ルートと標高を求める API．
 * 1. 経由点を ORS で徒歩ルートにする
 * 2. ルートを断面図用に間引き，国土地理院から標高を取る
 * 勾配の上限（maxGrade）があり経由点が2点なら，ORS の代わりの経路から上限を守るものを選ぶ．
 * 消費カロリーなどの計算は，体重を変えたときにすぐ反映できるよう画面側で行う．
 * ORS の無料枠を守るため，呼ぶ前に利用回数を数える（lib/server/rate-limit.ts）．
 */

import { downsample } from "@/lib/geo";
import {
	type PlanErrorResponse,
	type PlanResponse,
	planRequestSchema,
} from "@/lib/plan";
import {
	ORS_MAX_WAYPOINTS,
	RoutingError,
	routeAlternativesOnFoot,
	routeOnFoot,
} from "@/lib/server/ors";
import { pickByGrade, withProfile } from "@/lib/server/profile";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

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
		const { maxGrade } = parsed.data;
		const waypoints = downsample(parsed.data.waypoints, ORS_MAX_WAYPOINTS);
		// 勾配の上限があり，出発と到着の2点だけなら，代わりの経路から上限を守るものを選ぶ．
		// 経由点があると ORS は代わりの経路を出せないので，その道のまま返す（画面で警告する）
		if (maxGrade !== undefined && waypoints.length === 2) {
			const routes = await routeAlternativesOnFoot(waypoints[0], waypoints[1]);
			const plan = await pickByGrade(
				routes.map((r) => async () => r.coords),
				maxGrade,
			);
			return Response.json(plan satisfies PlanResponse);
		}
		const { coords } = await routeOnFoot(waypoints);
		return Response.json((await withProfile(coords)) satisfies PlanResponse);
	} catch (e) {
		if (e instanceof RoutingError) return errorResponse(e.message, e.status);
		// 想定外のエラーは内容を画面に出さずログにだけ残す
		console.error(e);
		return errorResponse("ルートの計算に失敗しました．", 500);
	}
}
