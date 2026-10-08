/**
 * 勾配を考慮したエネルギー・速度モデルと，ルート全体の統計の計算．
 * 徒歩は Minetti et al. の歩行エネルギーコスト近似式，自転車は簡易モデルを使う．
 * 式と係数は旧版（_prev/src/energyModel.js）から変えていない．
 */

import { haversine, type LatLng } from "./geo";

/** 標高付きの1区間 */
export type Segment = { distM: number; elevStart: number; elevEnd: number };

/** ルート全体の統計 */
export type RouteStats = {
	/** 距離 [m] */
	dist: number;
	/** 獲得標高（上りの合計）[m] */
	gain: number;
	/** 下りの合計 [m] */
	loss: number;
	walkKcal: number;
	walkMin: number;
	bikeKcal: number;
	bikeMin: number;
};

/** 自転車の重量 [kg]．消費エネルギーは体重にこれを足して計算する */
const BIKE_WEIGHT_KG = 10;

/** 1 kcal あたりのジュール */
const J_PER_KCAL = 4184;

/**
 * 【徒歩】勾配 grade における歩行のエネルギーコスト [J/kg/m]．
 * Minetti et al. (2002) の5次多項式．±45% で打ち切る．
 */
export function walkEnergyCost(grade: number): number {
	const i = Math.max(-0.45, Math.min(0.45, grade));
	const C =
		280.5 * i ** 5 -
		58.7 * i ** 4 -
		76.8 * i ** 3 +
		51.9 * i ** 2 +
		19.6 * i +
		2.5;
	// 下り坂で式が小さくなりすぎないよう下限を設ける
	return Math.max(C, 1.5);
}

/**
 * 【徒歩】勾配 grade における歩行速度 [km/h]．
 * 平地で 5 km/h，上り坂でも下り坂でも遅くなる（緩い下りが最も速い）．
 */
export function walkSpeedKmh(grade: number): number {
	const i = Math.max(-0.45, Math.min(0.45, grade));
	return Math.max(1.0, 5.0 * Math.exp(-3.5 * Math.abs(i + 0.05)));
}

/**
 * 【自転車】勾配 grade におけるエネルギーコスト [J/kg/m]．
 * 平地 15 km/h を想定し，上りで急増，下りで微減する簡易モデル．
 */
export function bikeEnergyCost(grade: number): number {
	const i = Math.max(-0.2, Math.min(0.2, grade)); // 自転車で走れる勾配で打ち切る
	const base = 1.05; // J/kg/m（平地・15 km/h 想定）
	const gradeCoeff = i >= 0 ? 1 + 8.0 * i : 1 + 2.0 * i;
	return Math.max(base * gradeCoeff, 0.5);
}

/**
 * 【自転車】勾配 grade における速度 [km/h]．
 * 平地 15 km/h，上りで低下，下りで加速する（上限 30 km/h）．
 */
export function bikeSpeedKmh(grade: number): number {
	const i = Math.max(-0.2, Math.min(0.2, grade));
	if (i >= 0) return Math.max(3.0, 15.0 * Math.exp(-7.0 * i));
	return Math.min(30.0, 15.0 * (1 - 3.0 * i));
}

/**
 * 点列と各点の標高から，隣り合う2点ずつの区間を作る．
 * points と elevs は同じ長さであること．
 */
export function buildSegments(points: LatLng[], elevs: number[]): Segment[] {
	const segs: Segment[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		segs.push({
			distM: haversine(points[i], points[i + 1]),
			elevStart: elevs[i],
			elevEnd: elevs[i + 1],
		});
	}
	return segs;
}

/**
 * 区間の列と体重 [kg] から，距離・獲得標高・所要時間・消費カロリーを求める．
 * 区間ごとに勾配を出し，徒歩と自転車のモデルを積算する．
 */
export function computeStats(
	segments: Segment[],
	weightKg: number,
): RouteStats {
	let gain = 0;
	let loss = 0;
	let dist = 0;
	let walkEnergyJ = 0;
	let walkTimeSec = 0;
	let bikeEnergyJ = 0;
	let bikeTimeSec = 0;

	for (const s of segments) {
		const grade = s.distM > 0 ? (s.elevEnd - s.elevStart) / s.distM : 0;
		walkEnergyJ += s.distM * walkEnergyCost(grade) * weightKg;
		walkTimeSec += s.distM / (walkSpeedKmh(grade) / 3.6);
		bikeEnergyJ +=
			s.distM * bikeEnergyCost(grade) * (weightKg + BIKE_WEIGHT_KG);
		bikeTimeSec += s.distM / (bikeSpeedKmh(grade) / 3.6);
		if (s.elevEnd > s.elevStart) gain += s.elevEnd - s.elevStart;
		else loss += s.elevStart - s.elevEnd;
		dist += s.distM;
	}

	return {
		dist,
		gain,
		loss,
		walkKcal: walkEnergyJ / J_PER_KCAL,
		walkMin: walkTimeSec / 60,
		bikeKcal: bikeEnergyJ / J_PER_KCAL,
		bikeMin: bikeTimeSec / 60,
	};
}

/**
 * 分を「1時間5分」「42分」の形にする．
 * 先に分へ丸めてから時と分に分ける（旧版は 59.6分 が「60分」になっていた）．
 */
export function formatMinutes(min: number): string {
	const total = Math.round(min);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return h > 0 ? `${h}時間${m}分` : `${m}分`;
}
