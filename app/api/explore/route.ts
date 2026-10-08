/**
 * GET /api/explore：「みんなのルート」の一覧．
 * 地図の表示範囲（w・s・e・n）と重なる公開ルートを，距離・坂のきつさで絞り込み，新しい順かいいね順で返す．
 * 保存済みの座標を返すだけで外部 API は呼ばないので，利用回数の制限はかけない．
 */

import { exploreQuerySchema } from "@/lib/community";
import { errorResponse } from "@/lib/server/api";
import { listPublicRoutes } from "@/lib/server/community-repo";

/** 検索条件を受け取り，公開ルートの一覧を返す */
export async function GET(request: Request) {
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const parsed = exploreQuerySchema.safeParse(params);
	if (!parsed.success) {
		return errorResponse("検索の条件が正しくありません．", 400);
	}
	return Response.json({ routes: await listPublicRoutes(parsed.data) });
}
