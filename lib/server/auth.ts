/**
 * ログインの仕組み（better-auth）の設定．
 * メールアドレスとパスワードで登録・ログインし，ユーザーとセッションは DB に保存する．
 * サーバー側からのみ使うこと（画面側は lib/auth-client.ts を使う）．
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/db/schema";
import { db } from "./db";

/**
 * アプリの URL．本番と手元は BETTER_AUTH_URL，プレビュー環境は Vercel が付ける VERCEL_URL から作る．
 */
function baseURL(): string | undefined {
	if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return undefined;
}

/** プレビュー環境はブランチごとの URL でも開けるので，そこからのログインも受け付ける */
function trustedOrigins(): string[] {
	const origins: string[] = [];
	if (process.env.VERCEL_BRANCH_URL) {
		origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
	}
	return origins;
}

export const auth = betterAuth({
	baseURL: baseURL(),
	trustedOrigins: trustedOrigins(),
	database: drizzleAdapter(db, { provider: "pg", schema }),
	// アカウントの削除を許す（ログインしたばかりのセッションなら，パスワードの再入力なしで消せる）
	user: { deleteUser: { enabled: true } },
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		// 登録したらそのままログインした状態にする
		autoSignIn: true,
	},
	// ログインの試行回数の制限．サーバーレスではメモリが共有されないので DB に記録する
	rateLimit: {
		enabled: true,
		storage: "database",
		window: 60,
		max: 30,
	},
	// サーバー側の処理からログインしたときも Cookie を設定できるようにする（配列の最後に置く）
	plugins: [nextCookies()],
});

/** ログイン中のユーザー（いなければ null）．API や Server Component で使う */
export type SessionUser = typeof auth.$Infer.Session.user;
