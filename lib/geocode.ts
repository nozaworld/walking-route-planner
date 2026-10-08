/**
 * 地名検索 API（GET /api/geocode）の入出力の定義．
 * クエリの検査に使う zod スキーマと，レスポンスの型を画面と API で共有する．
 */

import { z } from "zod";

/** 検索語の最大文字数 */
export const MAX_QUERY_LENGTH = 100;

/** クエリ文字列のスキーマ．lat・lng は近いものを優先するための基準点（任意） */
export const geocodeQuerySchema = z.object({
	q: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
	lat: z.coerce.number().min(-90).max(90).optional(),
	lng: z.coerce.number().min(-180).max(180).optional(),
});

/** 検索結果の1件 */
export type Place = {
	/** 名称（例：名古屋城） */
	name: string;
	/** 所在地の補足（例：名古屋市，愛知県）．わからなければ空文字 */
	area: string;
	lat: number;
	lng: number;
};

/** 成功時のレスポンス */
export type GeocodeResponse = { places: Place[] };
