/**
 * drizzle-kit（マイグレーションの生成・適用）の設定．
 * テーブルの作成・変更はプーリングを通さない直接の接続（DATABASE_URL_UNPOOLED）で行う．
 */
// drizzle-kit は .env を自動では読まないので，dotenv で読み込む（Vercel では環境変数が直接入る）
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql", // 必須: 使用するDBの種類
	schema: "./db/schema.ts", // スキーマファイルのパス
	out: "./drizzle", // マイグレーションSQLの出力先
	dbCredentials: {
		// プーリング経由では一部の DDL がうまく動かないので，直接の接続を優先する
		url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
	},
});
