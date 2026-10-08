/**
 * DB（Neon の Postgres）への接続．
 * Drizzle ORM と postgres.js を使い，コネクションプーリング経由の DATABASE_URL につなぐ．
 * サーバー側からのみ使うこと．
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/** 接続を作る．DATABASE_URL がない環境（CI のビルドなど）では，問い合わせた時点でエラーになる */
function createClient() {
	const options = {
		// プーリング（PgBouncer のトランザクションモード）では準備済み文が使えない
		prepare: false,
		// サーバーレスでは1つの関数が同時にたくさん接続しないよう少なめにする
		max: 5,
	};
	const url = process.env.DATABASE_URL;
	return url ? postgres(url, options) : postgres(options);
}

// 開発中はファイルを保存するたびにモジュールが読み直されるので，接続を使い回して増えすぎないようにする
const globalForDb = globalThis as unknown as {
	pgClient?: ReturnType<typeof postgres>;
};
const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

/** アプリ全体で使う DB */
export const db = drizzle({ client, schema });
