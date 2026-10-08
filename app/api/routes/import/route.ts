/**
 * POST /api/routes/import：ブラウザ（localStorage）に保存していたルートを，まとめてアカウントに取り込む．
 */

import { importInputSchema, MAX_IMPORT } from "@/lib/routes";
import { errorResponse, getUser, unauthorized } from "@/lib/server/api";
import { importRoutes, RouteLimitError } from "@/lib/server/routes-repo";

/** ルートの一覧を受け取って保存し，保存したものを返す */
export async function POST(request: Request) {
	const user = await getUser(request);
	if (!user) return unauthorized();

	const parsed = importInputSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return errorResponse(
			`取り込む内容が正しくありません（一度に${MAX_IMPORT}件まで）．`,
			400,
		);
	}

	try {
		const routes = await importRoutes(user.id, parsed.data.routes);
		return Response.json({ routes }, { status: 201 });
	} catch (e) {
		if (e instanceof RouteLimitError) return errorResponse(e.message, 409);
		throw e;
	}
}
