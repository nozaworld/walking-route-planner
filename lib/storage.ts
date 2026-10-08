/**
 * ブラウザの localStorage への保存と読み込み．
 * 体重・操作パネルの大きさ・保存済みルートを扱う（ログインと DB 保存は次フェーズで対応）．
 * プライベートモードなどで localStorage が使えない場合は，黙って保存しない．
 */

import type { RouteStats } from "./energy-model";
import type { LatLng } from "./geo";

const STORAGE_KEY_WEIGHT = "fatigueplanner_weight";
const STORAGE_KEY_ROUTES = "fatigueplanner_routes";
const STORAGE_KEY_PANEL = "fatigueplanner_panel";

/** 操作パネルの大きさ．width は PC での幅 [px]，height はスマホでの高さ [画面の高さに対する%] */
export type PanelSize = { width: number; height: number };

/** 保存したルート */
export type SavedRoute = {
	id: string;
	name: string;
	/** 保存した時点の体重で計算した統計（一覧に表示する） */
	stats: RouteStats;
	coords: LatLng[];
	profile: { points: LatLng[]; elevs: number[] };
	/** 保存した日時（UNIX ミリ秒） */
	savedAt: number;
};

/** 保存した体重 [kg] を読む．なければ null */
export function loadWeight(): number | null {
	try {
		const v = Number.parseFloat(localStorage.getItem(STORAGE_KEY_WEIGHT) ?? "");
		return Number.isFinite(v) && v > 0 ? v : null;
	} catch {
		return null;
	}
}

/** 体重 [kg] を保存する */
export function saveWeight(weight: number): void {
	try {
		localStorage.setItem(STORAGE_KEY_WEIGHT, String(weight));
	} catch {
		// 保存できなくても画面の動作には影響しない
	}
}

/** 保存した操作パネルの大きさを読む．なければ null */
export function loadPanelSize(): PanelSize | null {
	try {
		const v = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL) ?? "null");
		return typeof v?.width === "number" && typeof v?.height === "number"
			? { width: v.width, height: v.height }
			: null;
	} catch {
		return null;
	}
}

/** 操作パネルの大きさを保存する */
export function savePanelSize(size: PanelSize): void {
	try {
		localStorage.setItem(STORAGE_KEY_PANEL, JSON.stringify(size));
	} catch {
		// 保存できなくても画面の動作には影響しない
	}
}

/** 保存済みルートを新しい順で読む．壊れたデータは無視する */
export function loadRoutes(): SavedRoute[] {
	try {
		const parsed: unknown = JSON.parse(
			localStorage.getItem(STORAGE_KEY_ROUTES) ?? "[]",
		);
		return Array.isArray(parsed) ? parsed.filter(isSavedRoute) : [];
	} catch {
		return [];
	}
}

/** 保存済みルートの一覧をまるごと書き込む */
export function saveRoutes(routes: SavedRoute[]): void {
	try {
		localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
	} catch {
		// 容量超過などで保存できなくても画面の動作には影響しない
	}
}

/** 画面の表示に必要な項目がそろっているかを確かめる */
function isSavedRoute(v: unknown): v is SavedRoute {
	if (typeof v !== "object" || v === null) return false;
	const r = v as Partial<SavedRoute>;
	return (
		typeof r.id === "string" &&
		typeof r.name === "string" &&
		typeof r.stats?.dist === "number" &&
		Array.isArray(r.coords) &&
		Array.isArray(r.profile?.points) &&
		Array.isArray(r.profile?.elevs)
	);
}
