/**
 * 「みんなのルート」（公開ルートのコミュニティ）の入出力の定義．
 * 一覧の検索条件・コメント・通報のスキーマと，画面と API で共有する型をまとめる．
 */

import { z } from "zod";
import type { RouteStats } from "./energy-model";
import type { LatLng } from "./geo";

/** 一覧に一度に出す件数 */
export const EXPLORE_LIMIT = 50;
/** コメントの最大文字数 */
export const MAX_COMMENT_LENGTH = 500;
/** この数の通報が集まったら非表示にする */
export const REPORT_THRESHOLD = 3;

/** 坂のきつさ．1km あたりの獲得標高 [m/km] で分ける */
export type Steepness = "gentle" | "moderate" | "steep";
export const STEEPNESS: Record<
	Steepness,
	{ label: string; min: number; max: number }
> = {
	gentle: { label: "ゆるやか", min: 0, max: 10 },
	moderate: { label: "ほどほど", min: 10, max: 25 },
	steep: { label: "坂が多い", min: 25, max: Number.POSITIVE_INFINITY },
};

/** 1km あたりの獲得標高から，坂のきつさを決める */
export function steepnessOf(stats: { dist: number; gain: number }): Steepness {
	const perKm = stats.dist > 0 ? stats.gain / (stats.dist / 1000) : 0;
	if (perKm >= STEEPNESS.steep.min) return "steep";
	if (perKm >= STEEPNESS.moderate.min) return "moderate";
	return "gentle";
}

/** 一覧の検索条件（クエリ文字列）．w・s・e・n は地図の表示範囲 */
export const exploreQuerySchema = z.object({
	w: z.coerce.number().min(-180).max(180),
	s: z.coerce.number().min(-90).max(90),
	e: z.coerce.number().min(-180).max(180),
	n: z.coerce.number().min(-90).max(90),
	minKm: z.coerce.number().min(0).optional(),
	maxKm: z.coerce.number().min(0).optional(),
	steep: z.enum(["all", "gentle", "moderate", "steep"]).default("all"),
	sort: z.enum(["new", "likes"]).default("new"),
});
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

/** 一覧の1件（地図に描くための間引いた座標を含む） */
export type PublicRouteSummary = {
	id: string;
	name: string;
	authorId: string;
	authorName: string;
	stats: RouteStats;
	/** 地図に描く用に間引いた座標 */
	coords: LatLng[];
	likeCount: number;
	commentCount: number;
	savedAt: number;
};

export const commentInputSchema = z.object({
	body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});

export const reportInputSchema = z.object({
	targetType: z.enum(["route", "comment"]),
	targetId: z.uuid(),
});

/** コメント1件 */
export type RouteComment = {
	id: string;
	body: string;
	authorId: string;
	authorName: string;
	createdAt: number;
	/** 見ている人が書いたものか（削除ボタンを出す） */
	isMine: boolean;
};
