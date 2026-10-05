import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql", // 必須: 使用するDBの種類
	schema: "./db/schema.ts", // スキーマファイルのパス
	out: "./drizzle", // マイグレーションSQLの出力先
	dbCredentials: {
		url: process.env.DATABASE_URL!, // 接続文字列
	},
});
