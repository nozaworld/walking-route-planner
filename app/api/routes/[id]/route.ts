/**
 * /api/routes/[id]：自分の保存ルート1件の操作．
 * PATCH で名前の変更・共有の切り替え，DELETE で削除する．
 * 他人のルートや存在しない ID は，どちらも 404 にする．
 */

import { routePatchSchema } from "@/lib/routes";
import {
	errorResponse,
	getUser,
	isRouteId,
	notFound,
	unauthorized,
} from "@/lib/server/api";
import { deleteRoute, updateRoute } from "@/lib/server/routes-repo";

/** 名前・共有を変え，変えたあとのルートを返す */
export async function PATCH(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]">,
) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const { id } = await ctx.params;
	if (!isRouteId(id)) return notFound();

	const parsed = routePatchSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return errorResponse("変更する内容が正しくありません．", 400);
	}

	const route = await updateRoute(user.id, id, parsed.data);
	return route ? Response.json({ route }) : notFound();
}

/** ルートを削除する */
export async function DELETE(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]">,
) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const { id } = await ctx.params;
	if (!isRouteId(id)) return notFound();

	return (await deleteRoute(user.id, id))
		? new Response(null, { status: 204 })
		: notFound();
}
