/**
 * 保存ルートの DB 操作（routes テーブル）．
 * 一覧・保存・まとめて取り込み・名前の変更と共有の切り替え・削除・共有ページ用の取得を行う．
 * どの操作も持ち主（userId）で絞り込み，他人のルートには触れないようにする．
 */

import { and, count, desc, eq } from "drizzle-orm";
import { routes, user } from "@/db/schema";
import { boundsOf } from "@/lib/geo";
import {
	type CloudRoute,
	MAX_ROUTES_PER_USER,
	type RouteInput,
} from "@/lib/routes";
import { db } from "./db";

/** 保存の上限を超えたときのエラー */
export class RouteLimitError extends Error {}

/** DB の1行を API が返す形にする */
function toCloudRoute(row: typeof routes.$inferSelect): CloudRoute {
	return {
		id: row.id,
		name: row.name,
		stats: row.stats,
		coords: row.coords,
		profile: row.profile,
		shared: row.shared,
		savedAt: row.createdAt.getTime(),
	};
}

/** 保存する内容から，検索用の列（範囲・距離・獲得標高）を作る */
function searchColumns(input: RouteInput) {
	return {
		...boundsOf(input.coords),
		distM: input.stats.dist,
		gainM: input.stats.gain,
	};
}

/** 自分のルートを新しい順に返す */
export async function listRoutes(userId: string): Promise<CloudRoute[]> {
	const rows = await db
		.select()
		.from(routes)
		.where(eq(routes.userId, userId))
		.orderBy(desc(routes.createdAt));
	return rows.map(toCloudRoute);
}

/** 今の保存件数に adding 件を足すと上限を超えるなら RouteLimitError を投げる */
async function assertWithinLimit(userId: string, adding: number) {
	const [{ value }] = await db
		.select({ value: count() })
		.from(routes)
		.where(eq(routes.userId, userId));
	if (value + adding > MAX_ROUTES_PER_USER) {
		throw new RouteLimitError(
			`保存できるルートは${MAX_ROUTES_PER_USER}件までです．`,
		);
	}
}

/** ルートを1件保存して返す */
export async function createRoute(
	userId: string,
	input: RouteInput,
): Promise<CloudRoute> {
	await assertWithinLimit(userId, 1);
	const [row] = await db
		.insert(routes)
		.values({ ...input, ...searchColumns(input), userId })
		.returning();
	return toCloudRoute(row);
}

/**
 * ブラウザに保存していたルートをまとめて保存する．
 * inputs は新しい順に並んでいるので，古いものから入れて保存日時の順を保つ．
 */
export async function importRoutes(
	userId: string,
	inputs: RouteInput[],
): Promise<CloudRoute[]> {
	await assertWithinLimit(userId, inputs.length);
	const base = Date.now() - inputs.length;
	const rows = await db
		.insert(routes)
		.values(
			inputs.map((input, i) => ({
				...input,
				...searchColumns(input),
				userId,
				// 1件ずつ1ミリ秒ずらして，取り込んだ後も元の並び順になるようにする
				createdAt: new Date(base + (inputs.length - i)),
			})),
		)
		.returning();
	return rows.map(toCloudRoute);
}

/** 自分のルートの名前・共有を変える．見つからなければ null */
export async function updateRoute(
	userId: string,
	id: string,
	patch: { name?: string; shared?: boolean },
): Promise<CloudRoute | null> {
	const [row] = await db
		.update(routes)
		.set(patch)
		.where(and(eq(routes.id, id), eq(routes.userId, userId)))
		.returning();
	return row ? toCloudRoute(row) : null;
}

/** 自分のルートを削除する．消したら true */
export async function deleteRoute(
	userId: string,
	id: string,
): Promise<boolean> {
	const rows = await db
		.delete(routes)
		.where(and(eq(routes.id, id), eq(routes.userId, userId)))
		.returning({ id: routes.id });
	return rows.length > 0;
}

/**
 * 共有ページ用にルートと作成者の名前を返す．
 * 共有中のルートか，見ている人が持ち主のときだけ返し，それ以外は null．
 */
export async function getRouteForView(
	id: string,
	viewerId: string | null,
): Promise<
	| (CloudRoute & {
			authorId: string;
			authorName: string;
			isOwner: boolean;
			likeCount: number;
			commentCount: number;
	  })
	| null
> {
	const [row] = await db
		.select({ route: routes, authorName: user.name })
		.from(routes)
		.innerJoin(user, eq(routes.userId, user.id))
		.where(eq(routes.id, id));
	if (!row) return null;
	const isOwner = viewerId === row.route.userId;
	// 非公開か，通報で非表示になったルートは，持ち主にだけ見せる
	if ((!row.route.shared || row.route.hidden) && !isOwner) return null;
	return {
		...toCloudRoute(row.route),
		authorId: row.route.userId,
		authorName: row.authorName,
		isOwner,
		likeCount: row.route.likeCount,
		commentCount: row.route.commentCount,
	};
}
