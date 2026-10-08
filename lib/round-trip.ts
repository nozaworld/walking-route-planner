/**
 * 逆算モードの計算．
 * 目標（消費カロリー・歩く時間・距離）から周回ルートの長さを見積もり，
 * できたルートが目標からずれていれば，長さを補正する．
 * 坂の影響はルートができるまで分からないので，平地を前提に見積もってから補正する．
 */

import { type RouteStats, walkEnergyCost, walkSpeedKmh } from "./energy-model";
import { ROUND_TRIP_LENGTH } from "./plan";

/** 目標の種類 */
export type TargetKind = "kcal" | "minutes" | "km";

/** 目標の種類ごとの表示 */
export const TARGET_UNITS: Record<TargetKind, { label: string; unit: string }> =
	{
		kcal: { label: "消費カロリー", unit: "kcal" },
		minutes: { label: "歩く時間", unit: "分" },
		km: { label: "距離", unit: "km" },
	};

/** できたルートが目標からこの割合以上ずれていたら，長さを補正して作り直す */
export const TOLERANCE = 0.15;

/** 1 kcal あたりのジュール */
const J_PER_KCAL = 4184;

/** 長さを周回ルートの API が受け付ける範囲に収める */
function clampLength(m: number): number {
	return Math.min(Math.max(m, ROUND_TRIP_LENGTH.min), ROUND_TRIP_LENGTH.max);
}

/** 平地を歩くと仮定して，目標から周回ルートの長さ [m] を見積もる */
export function estimateLength(
	kind: TargetKind,
	value: number,
	weightKg: number,
): number {
	switch (kind) {
		case "kcal":
			// 消費カロリー = 距離 × 平地のエネルギーコスト × 体重 を，距離について解く
			return clampLength((value * J_PER_KCAL) / (walkEnergyCost(0) * weightKg));
		case "minutes":
			return clampLength((value / 60) * walkSpeedKmh(0) * 1000);
		case "km":
			return clampLength(value * 1000);
	}
}

/** ルートの統計から，目標と比べる値を取り出す */
export function actualValue(kind: TargetKind, stats: RouteStats): number {
	switch (kind) {
		case "kcal":
			return stats.walkKcal;
		case "minutes":
			return stats.walkMin;
		case "km":
			return stats.dist / 1000;
	}
}

/** できたルートの値が，目標から TOLERANCE 以上ずれているか */
export function needsCorrection(target: number, actual: number): boolean {
	return actual <= 0 || Math.abs(actual / target - 1) > TOLERANCE;
}

/** ずれの割合だけ長さを伸び縮みさせる（坂の多さや道の形による差を打ち消す） */
export function correctLength(
	length: number,
	target: number,
	actual: number,
): number {
	return clampLength(actual > 0 ? (length * target) / actual : length);
}
