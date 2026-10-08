/**
 * 「みんなのルート」の DB 操作．
 * 公開ルートの範囲検索・いいね・コメント・通報・自分用への複製・利用者の公開ページを扱う．
 * どの操作も「公開中（shared）で非表示（hidden）になっていないルート」だけを対象にする．
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { reports, routeComments, routeLikes, routes, user } from "@/db/schema";
import {
	EXPLORE_LIMIT,
	type ExploreQuery,
	type PublicRouteSummary,
	REPORT_THRESHOLD,
	type RouteComment,
	STEEPNESS,
} from "@/lib/community";
import { downsample } from "@/lib/geo";
import type { CloudRoute } from "@/lib/routes";
import { db } from "./db";
import { createRoute } from "./routes-repo";

/** 一覧で地図に描くときの座標の点数（通信量を抑えるため間引く） */
const SUMMARY_POINTS = 80;

/** 公開中で非表示でないルート，という条件 */
const isPublic = and(eq(routes.shared, true), eq(routes.hidden, false));

/** 地図の表示範囲と重なる公開ルートを，条件で絞り込んで返す */
export async function listPublicRoutes(
	q: ExploreQuery,
): Promise<PublicRouteSummary[]> {
	const conditions = [
		isPublic,
		// 範囲が重なる＝ルートの南端が表示範囲の北端より南，かつ北端が南端より北（東西も同じ）
		lte(routes.minLat, q.n),
		gte(routes.maxLat, q.s),
		lte(routes.minLng, q.e),
		gte(routes.maxLng, q.w),
	];
	if (q.minKm !== undefined) conditions.push(gte(routes.distM, q.minKm * 1000));
	if (q.maxKm !== undefined) conditions.push(lte(routes.distM, q.maxKm * 1000));
	if (q.steep !== "all") {
		// 1km あたりの獲得標高で坂のきつさを絞る
		const { min, max } = STEEPNESS[q.steep];
		const perKm = sql`${routes.gainM} / greatest(${routes.distM} / 1000, 0.001)`;
		conditions.push(sql`${perKm} >= ${min}`);
		if (Number.isFinite(max)) conditions.push(sql`${perKm} < ${max}`);
	}

	const rows = await db
		.select({ route: routes, authorName: user.name })
		.from(routes)
		.innerJoin(user, eq(routes.userId, user.id))
		.where(and(...conditions))
		.orderBy(
			q.sort === "likes" ? desc(routes.likeCount) : desc(routes.createdAt),
			desc(routes.createdAt),
		)
		.limit(EXPLORE_LIMIT);

	return rows.map(({ route: r, authorName }) => ({
		id: r.id,
		name: r.name,
		authorId: r.userId,
		authorName,
		stats: r.stats,
		coords: downsample(r.coords, SUMMARY_POINTS),
		likeCount: r.likeCount,
		commentCount: r.commentCount,
		savedAt: r.createdAt.getTime(),
	}));
}

/** 公開ルートか（いいね・コメント・複製の前に確かめる） */
async function isPublicRoute(routeId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: routes.id })
		.from(routes)
		.where(and(eq(routes.id, routeId), isPublic));
	return Boolean(row);
}

/** 見ている人がいいねしているか */
export async function hasLiked(routeId: string, userId: string) {
	const [row] = await db
		.select({ routeId: routeLikes.routeId })
		.from(routeLikes)
		.where(and(eq(routeLikes.routeId, routeId), eq(routeLikes.userId, userId)));
	return Boolean(row);
}

/**
 * いいねを付ける（like = true）か外す．公開ルートでなければ null．
 * 付け外しが実際に起きたときだけ，ルートのいいね数を増減する．
 */
export async function setLike(
	routeId: string,
	userId: string,
	like: boolean,
): Promise<{ liked: boolean; likeCount: number } | null> {
	if (!(await isPublicRoute(routeId))) return null;
	return db.transaction(async (tx) => {
		const changed = like
			? await tx
					.insert(routeLikes)
					.values({ routeId, userId })
					.onConflictDoNothing()
					.returning()
			: await tx
					.delete(routeLikes)
					.where(
						and(eq(routeLikes.routeId, routeId), eq(routeLikes.userId, userId)),
					)
					.returning();
		const delta = changed.length === 0 ? 0 : like ? 1 : -1;
		const [row] = await tx
			.update(routes)
			.set({ likeCount: sql`${routes.likeCount} + ${delta}` })
			.where(eq(routes.id, routeId))
			.returning({ likeCount: routes.likeCount });
		return { liked: like, likeCount: row.likeCount };
	});
}

/** 公開ルートのコメントを古い順に返す（非表示のものは除く） */
export async function listComments(
	routeId: string,
	viewerId: string | null,
): Promise<RouteComment[]> {
	const rows = await db
		.select({ c: routeComments, authorName: user.name })
		.from(routeComments)
		.innerJoin(user, eq(routeComments.userId, user.id))
		.where(
			and(eq(routeComments.routeId, routeId), eq(routeComments.hidden, false)),
		)
		.orderBy(routeComments.createdAt);
	return rows.map(({ c, authorName }) => ({
		id: c.id,
		body: c.body,
		authorId: c.userId,
		authorName,
		createdAt: c.createdAt.getTime(),
		isMine: c.userId === viewerId,
	}));
}

/** 公開ルートにコメントを書く．公開ルートでなければ null */
export async function addComment(
	routeId: string,
	userId: string,
	body: string,
): Promise<{ id: string } | null> {
	if (!(await isPublicRoute(routeId))) return null;
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(routeComments)
			.values({ routeId, userId, body })
			.returning({ id: routeComments.id });
		await tx
			.update(routes)
			.set({ commentCount: sql`${routes.commentCount} + 1` })
			.where(eq(routes.id, routeId));
		return row;
	});
}

/** 自分のコメントを消す．消したら true */
export async function deleteComment(
	commentId: string,
	userId: string,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.delete(routeComments)
			.where(
				and(eq(routeComments.id, commentId), eq(routeComments.userId, userId)),
			)
			.returning({
				routeId: routeComments.routeId,
				hidden: routeComments.hidden,
			});
		if (!row) return false;
		// 非表示のコメントはすでに数から引いてある
		if (!row.hidden) {
			await tx
				.update(routes)
				.set({ commentCount: sql`${routes.commentCount} - 1` })
				.where(eq(routes.id, row.routeId));
		}
		return true;
	});
}

/**
 * ルートかコメントを通報する（1人1回まで）．
 * 通報が REPORT_THRESHOLD 件に達したら，その対象を非表示にする．
 */
export async function report(
	targetType: "route" | "comment",
	targetId: string,
	userId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(reports)
			.values({ targetType, targetId, userId })
			.onConflictDoNothing();
		const [{ count }] = await tx
			.select({ count: sql<number>`count(*)::int` })
			.from(reports)
			.where(
				and(eq(reports.targetType, targetType), eq(reports.targetId, targetId)),
			);
		if (count < REPORT_THRESHOLD) return;

		if (targetType === "route") {
			await tx
				.update(routes)
				.set({ hidden: true })
				.where(eq(routes.id, targetId));
			return;
		}
		const [hidden] = await tx
			.update(routeComments)
			.set({ hidden: true })
			.where(
				and(eq(routeComments.id, targetId), eq(routeComments.hidden, false)),
			)
			.returning({ routeId: routeComments.routeId });
		if (hidden) {
			await tx
				.update(routes)
				.set({ commentCount: sql`${routes.commentCount} - 1` })
				.where(eq(routes.id, hidden.routeId));
		}
	});
}

/** 他人の公開ルートを，自分の保存済みに複製する．公開ルートでなければ null */
export async function copyRoute(
	routeId: string,
	userId: string,
): Promise<CloudRoute | null> {
	const [src] = await db
		.select()
		.from(routes)
		.where(and(eq(routes.id, routeId), isPublic));
	if (!src) return null;
	return createRoute(userId, {
		name: src.name,
		coords: src.coords,
		profile: src.profile,
		stats: src.stats,
	});
}

/** 利用者の公開ページ用に，名前と公開ルートの一覧を返す．いなければ null */
export async function getPublicProfile(userId: string) {
	const [u] = await db
		.select({ id: user.id, name: user.name, createdAt: user.createdAt })
		.from(user)
		.where(eq(user.id, userId));
	if (!u) return null;
	const rows = await db
		.select()
		.from(routes)
		.where(and(eq(routes.userId, userId), isPublic))
		.orderBy(desc(routes.createdAt));
	return {
		name: u.name,
		joinedAt: u.createdAt.getTime(),
		routes: rows.map((r) => ({
			id: r.id,
			name: r.name,
			authorId: r.userId,
			authorName: u.name,
			stats: r.stats,
			coords: downsample(r.coords, SUMMARY_POINTS),
			likeCount: r.likeCount,
			commentCount: r.commentCount,
			savedAt: r.createdAt.getTime(),
		})) satisfies PublicRouteSummary[],
	};
}
