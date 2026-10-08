/**
 * 保存ルートの API（/api/routes）の入出力の定義．
 * 保存・取り込み・更新の本文を検査する zod スキーマと，クラウドに保存したルートの型を画面と API で共有する．
 */

import { z } from "zod";
import type { RouteStats } from "./energy-model";
import type { LatLng } from "./geo";

/** ルート名の最大文字数 */
export const MAX_NAME_LENGTH = 50;
/** 1人が保存できるルートの数 */
export const MAX_ROUTES_PER_USER = 200;
/** 一度に取り込めるルートの数 */
export const MAX_IMPORT = 50;

const latLng = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
});

const stats = z.object({
	dist: z.number().nonnegative(),
	gain: z.number().nonnegative(),
	loss: z.number().nonnegative(),
	walkKcal: z.number().nonnegative(),
	walkMin: z.number().nonnegative(),
	bikeKcal: z.number().nonnegative(),
	bikeMin: z.number().nonnegative(),
});

const name = z.string().trim().min(1).max(MAX_NAME_LENGTH);

/** 保存するルートの本文 */
export const routeInputSchema = z
	.object({
		name,
		// ORS の徒歩ルートは長くても数千点なので，それを大きく超えるものは受け付けない
		coords: z.array(latLng).min(2).max(10_000),
		profile: z.object({
			points: z.array(latLng).min(2).max(500),
			elevs: z.array(z.number()).min(2).max(500),
		}),
		stats,
	})
	// 断面図の点と標高は同じ数でないと計算できない
	.refine((r) => r.profile.points.length === r.profile.elevs.length, {
		message: "profile の points と elevs の数が違います",
	});

/** ブラウザから取り込むルートの一覧 */
export const importInputSchema = z.object({
	routes: z.array(routeInputSchema).min(1).max(MAX_IMPORT),
});

/** 名前の変更・共有の切り替え */
export const routePatchSchema = z
	.object({ name: name.optional(), shared: z.boolean().optional() })
	.refine((p) => p.name !== undefined || p.shared !== undefined, {
		message: "変更する項目がありません",
	});

export type RouteInput = z.infer<typeof routeInputSchema>;

/** クラウドに保存したルート（API が返す形） */
export type CloudRoute = {
	id: string;
	name: string;
	stats: RouteStats;
	coords: LatLng[];
	profile: { points: LatLng[]; elevs: number[] };
	shared: boolean;
	/** 保存した日時（UNIX ミリ秒） */
	savedAt: number;
};
