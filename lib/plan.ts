/**
 * 経路計算 API（POST /api/plan）の入出力の定義．
 * リクエストの検査に使う zod スキーマと，レスポンスの型を画面と API で共有する．
 */

import { z } from "zod";
import type { LatLng } from "./geo";

/** 1リクエストで受け付ける経由点の上限（クリックで描いた点をそのまま送れる程度） */
export const MAX_REQUEST_WAYPOINTS = 500;

const latLngSchema = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
});

/** リクエスト本文のスキーマ */
export const planRequestSchema = z.object({
	waypoints: z.array(latLngSchema).min(2).max(MAX_REQUEST_WAYPOINTS),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;

/** 成功時のレスポンス */
export type PlanResponse = {
	/** 地図に描く経路の座標列 */
	coords: LatLng[];
	/** 断面図と統計の計算に使う，間引いた点とその標高 [m] */
	profile: { points: LatLng[]; elevs: number[] };
};

/** 失敗時のレスポンス */
export type PlanErrorResponse = { error: string };
