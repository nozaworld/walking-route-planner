/**
 * DB のテーブル定義（Drizzle）．
 * ログイン用のテーブル（auth-schema.ts，自動生成）と，アプリ独自のテーブルをまとめて公開する．
 * 変えたら `npm run db:generate` でマイグレーションの SQL を作ること．
 */

import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
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
		/** true なら共有 URL で誰でも見られ，「みんなのルート」にも載る */
		shared: boolean("shared").default(false).notNull(),
		/** 通報が一定数を超えて非表示になったか（持ち主には見える） */
		hidden: boolean("hidden").default(false).notNull(),
		/** ルートを囲む範囲（「みんなのルート」で地図の表示範囲と重なるものを探すのに使う） */
		minLat: doublePrecision("min_lat").notNull().default(0),
		minLng: doublePrecision("min_lng").notNull().default(0),
		maxLat: doublePrecision("max_lat").notNull().default(0),
		maxLng: doublePrecision("max_lng").notNull().default(0),
		/** 距離 [m] と獲得標高 [m]（絞り込みと並べ替えに使う．stats と同じ値を列にも持つ） */
		distM: doublePrecision("dist_m").notNull().default(0),
		gainM: doublePrecision("gain_m").notNull().default(0),
		/** いいねとコメントの数（一覧で毎回数えないよう，増減のたびに更新する） */
		likeCount: integer("like_count").default(0).notNull(),
		commentCount: integer("comment_count").default(0).notNull(),
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
		// 「みんなのルート」で，公開中のものを範囲で探すための索引
		index("routes_public_bbox_idx").on(
			table.shared,
			table.hidden,
			table.minLat,
			table.maxLat,
		),
	],
);

/** いいね（1人1ルートにつき1つ） */
export const routeLikes = pgTable(
	"route_likes",
	{
		routeId: uuid("route_id")
			.notNull()
			.references(() => routes.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.routeId, table.userId] })],
);

/** 公開ルートへのコメント */
export const routeComments = pgTable(
	"route_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		routeId: uuid("route_id")
			.notNull()
			.references(() => routes.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		/** 通報が一定数を超えて非表示になったか */
		hidden: boolean("hidden").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("route_comments_route_idx").on(table.routeId, table.createdAt),
	],
);

/**
 * 通報．ルートかコメントを，1人1回まで通報できる．
 * 同じ対象への通報が一定数を超えたら，その対象を非表示にする．
 */
export const reports = pgTable(
	"reports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** route か comment */
		targetType: text("target_type").$type<"route" | "comment">().notNull(),
		targetId: uuid("target_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		unique("reports_target_user_unique").on(
			table.targetType,
			table.targetId,
			table.userId,
		),
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
