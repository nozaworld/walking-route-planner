/**
 * API（Route Handler）で共通して使う小道具．
 * ログイン中のユーザーの取得，エラーの返し方，ID の形式の確認をまとめる．
 */

import { z } from "zod";
import { auth } from "./auth";

/** リクエストの Cookie からログイン中のユーザーを取り出す．いなければ null */
export async function getUser(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user ?? null;
}

/** { error } の形で失敗を返す */
export function errorResponse(message: string, status: number) {
	return Response.json({ error: message }, { status });
}

/** ログインしていないときの応答 */
export function unauthorized() {
	return errorResponse("ログインしてください．", 401);
}

/**
 * 見つからないときの応答．
 * 他人のルートも「存在しない」と同じに扱い，存在するかどうかを知らせない．
 */
export function notFound() {
	return errorResponse("ルートが見つかりません．", 404);
}

/** ルートの ID（UUID）として正しい形か */
export function isRouteId(id: string): boolean {
	return z.uuid().safeParse(id).success;
}
