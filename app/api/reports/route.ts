/**
 * POST /api/reports：不適切なルートやコメントを通報する．
 * 1人1回まで数え，一定数に達したら自動で非表示にする（管理画面の代わり）．
 */

import { reportInputSchema } from "@/lib/community";
import { errorResponse, getUser, unauthorized } from "@/lib/server/api";
import { report } from "@/lib/server/community-repo";
import { checkRateLimit, tooManyRequests } from "@/lib/server/rate-limit";

/** 通報を受け付ける */
export async function POST(request: Request) {
	const user = await getUser(request);
	if (!user) return unauthorized();
	const parsed = reportInputSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success)
		return errorResponse("通報の内容が正しくありません．", 400);
	const limit = await checkRateLimit("write", request);
	if (!limit.ok) return tooManyRequests(limit);

	await report(parsed.data.targetType, parsed.data.targetId, user.id);
	return new Response(null, { status: 204 });
}
