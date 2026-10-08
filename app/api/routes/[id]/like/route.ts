/**
 * /api/routes/[id]/like：公開ルートへのいいね．
 * POST で付け，DELETE で外す．どちらも，そのあとのいいね数を返す．
 */

import { getUser, isRouteId, notFound, unauthorized } from "@/lib/server/api";
import { setLike } from "@/lib/server/community-repo";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

/** いいねを付け外しする（POST と DELETE で共通） */
async function handle(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]/like">,
	like: boolean,
) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const { id } = await ctx.params;
	if (!isRouteId(id)) return notFound();
	const limit = await checkRateLimit("write", request);
	if (!limit.ok) return tooManyRequests(limit);

	const result = await setLike(id, user.id, like);
	return result ? Response.json(result) : notFound();
}

/** いいねを付ける */
export function POST(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]/like">,
) {
	return handle(request, ctx, true);
}

/** いいねを外す */
export function DELETE(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]/like">,
) {
	return handle(request, ctx, false);
}
