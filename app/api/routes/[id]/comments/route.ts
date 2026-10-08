/**
 * /api/routes/[id]/comments：公開ルートのコメント．
 * GET で一覧（誰でも），POST で書き込み（ログイン必須）．
 */

import { commentInputSchema, MAX_COMMENT_LENGTH } from "@/lib/community";
import {
	errorResponse,
	getUser,
	isRouteId,
	notFound,
	unauthorized,
} from "@/lib/server/api";
import { addComment, listComments } from "@/lib/server/community-repo";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

/** コメントの一覧を古い順に返す */
export async function GET(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]/comments">,
) {
	const { id } = await ctx.params;
	if (!isRouteId(id)) return notFound();
	const user = await getUser(request);
	return Response.json({ comments: await listComments(id, user?.id ?? null) });
}

/** コメントを書き込む */
export async function POST(
	request: Request,
	ctx: RouteContext<"/api/routes/[id]/comments">,
) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const { id } = await ctx.params;
	if (!isRouteId(id)) return notFound();

	const parsed = commentInputSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return errorResponse(
			`コメントは1〜${MAX_COMMENT_LENGTH}文字で書いてください．`,
			400,
		);
	}
	const limit = await checkRateLimit("write", request);
	if (!limit.ok) return tooManyRequests(limit);

	const comment = await addComment(id, user.id, parsed.data.body);
	return comment ? Response.json({ comment }, { status: 201 }) : notFound();
}
