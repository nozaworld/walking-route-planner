/**
 * /api/routes：ログインしたユーザーの保存ルート．
 * GET で自分のルートの一覧を返し，POST で1件保存する．
 */

import { routeInputSchema } from "@/lib/routes";
import { errorResponse, getUser, unauthorized } from "@/lib/server/api";
import {
	createRoute,
	listRoutes,
	RouteLimitError,
} from "@/lib/server/routes-repo";

/** 自分のルートを新しい順に返す */
export async function GET(request: Request) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	return Response.json({ routes: await listRoutes(user.id) });
}

/** ルートを1件保存し，保存したものを返す */
export async function POST(request: Request) {
	const user = await getUser(request);
	if (!user) return unauthorized();

	const parsed = routeInputSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return errorResponse("保存する内容が正しくありません．", 400);
	}

	try {
		const route = await createRoute(user.id, parsed.data);
		return Response.json({ route }, { status: 201 });
	} catch (e) {
		if (e instanceof RouteLimitError) return errorResponse(e.message, 409);
		throw e;
	}
}
