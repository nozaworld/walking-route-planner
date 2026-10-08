/**
 * DELETE /api/comments/[id]：自分のコメントを消す．
 * 他人のコメントや存在しない ID は 404 にする．
 */

import { getUser, isRouteId, notFound, unauthorized } from "@/lib/server/api";
import { deleteComment } from "@/lib/server/community-repo";

/** コメントを削除する */
export async function DELETE(
	request: Request,
	ctx: RouteContext<"/api/comments/[id]">,
) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const { id } = await ctx.params;
	// コメントの ID もルートと同じ UUID
	if (!isRouteId(id)) return notFound();
	return (await deleteComment(id, user.id))
		? new Response(null, { status: 204 })
		: notFound();
}
