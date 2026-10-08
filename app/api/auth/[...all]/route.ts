/**
 * /api/auth/*：ログインまわりの API（登録・ログイン・ログアウト・セッションの取得）．
 * 中身はすべて better-auth（lib/server/auth.ts）に任せる．
 */
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth";

export const { GET, POST } = toNextJsHandler(auth);
