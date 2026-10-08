/**
 * POST /api/routes/[id]/copy：他人の公開ルートを，自分の保存済みに複製する．
 */

import {
	errorResponse,
	getUser,
	isRouteId,
	notFound,
	unauthorized,
} from "@/lib/server/api";
import { copyRoute } from "@/lib/server/community-repo";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";
import { RouteLimitError } from "@/lib/server/routes-repo";

/** 公開ルートを複製し，複製したルートを返す */
export async function POST(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]/copy">,
) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const { id } = await ctx.params;
	if (!isRouteId(id)) return notFound();
	const limit = await checkRateLimit("write", request);
	if (!limit.ok) return tooManyRequests(limit);

	try {
		const route = await copyRoute(id, user.id);
		return route ? Response.json({ route }, { status: 201 }) : notFound();
	} catch (e) {
		if (e instanceof RouteLimitError) return errorResponse(e.message, 409);
		throw e;
	}
}
