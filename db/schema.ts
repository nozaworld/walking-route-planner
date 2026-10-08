/**
 * DB のテーブル定義（Drizzle）．
 * ログイン用のテーブル（auth-schema.ts，自動生成）と，アプリ独自のテーブルをまとめて公開する．
 * 変えたら `npm run db:generate` でマイグレーションの SQL を作ること．
 */

import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { RouteStats } from "@/lib/energy-model";
import type { LatLng } from "@/lib/geo";
import { user } from "./auth-schema";

export * from "./auth-schema";

/** ログインしたユーザーが保存したルート */
export const routes = pgTable(
	"routes",
	{
		// 共有 URL（/r/[id]）にも使うので，推測されにくい UUID にする
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** 地図に描く経路の座標列 */
		coords: jsonb("coords").$type<LatLng[]>().notNull(),
		/** 断面図・統計用の点と標高 */
		profile: jsonb("profile")
			.$type<{ points: LatLng[]; elevs: number[] }>()
			.notNull(),
		/** 保存した時点の体重での統計（一覧の表示用） */
		stats: jsonb("stats").$type<RouteStats>().notNull(),
		/** true なら共有 URL で誰でも見られる */
		shared: boolean("shared").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("routes_user_created_idx").on(table.userId, table.createdAt),
	],
);

/**
 * API（経路計算・地名検索）の利用回数．key と時間の窓ごとに数える．
 * better-auth のログイン用の rate_limit とは別のもの．
 */
export const apiUsage = pgTable(
	"api_usage",
	{
		/** 例：plan:ip:203.0.113.1:minute，plan:global:day */
		key: text("key").notNull(),
		/** 数え始めの時刻（1分単位・1日単位に切り捨てたもの） */
		windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
		count: integer("count").default(0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);
