/**
 * 経路計算 API（POST /api/plan）と周回ルート API（POST /api/round-trip）の入出力の定義．
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

/** 周回ルートの長さの範囲 [m]（短すぎると道が見つからず，長すぎると ORS が断る） */
export const ROUND_TRIP_LENGTH = { min: 500, max: 30_000 };

/** 周回ルートのリクエスト本文．seed を変えると別のルートになる */
export const roundTripRequestSchema = z.object({
	start: latLngSchema,
	length: z.number().min(ROUND_TRIP_LENGTH.min).max(ROUND_TRIP_LENGTH.max),
	seed: z.number().int().min(0).max(1_000_000),
});

/** 成功時のレスポンス */
export type PlanResponse = {
	/** 地図に描く経路の座標列 */
	coords: LatLng[];
	/** 断面図と統計の計算に使う，間引いた点とその標高 [m] */
	profile: { points: LatLng[]; elevs: number[] };
};

/** 失敗時のレスポンス */
export type PlanErrorResponse = { error: string };
