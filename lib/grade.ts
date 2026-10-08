/**
 * 勾配の段階分け．
 * 断面図の点と標高から区間ごとの勾配を求め，「緩やか・やや急・急」の3段階に分ける．
 * 地図のルートの色分けと断面図の色分けで同じ基準を使う．
 */

import { cumulativeDistances, type LatLng } from "./geo";

/** 勾配の段階 */
export type GradeLevel = "gentle" | "moderate" | "steep";

/** 段階の境目（上りも下りも，勾配の絶対値で判断する） */
const MODERATE = 0.04;
const STEEP = 0.08;

/** 凡例に出す段階の名前 */
export const GRADE_LABELS: Record<GradeLevel, string> = {
	gentle: "4%未満",
	moderate: "4〜8%",
	steep: "8%以上",
};

/** 勾配（例：0.05 = 5%）から段階を決める */
export function gradeLevel(grade: number): GradeLevel {
	const g = Math.abs(grade);
	if (g >= STEEP) return "steep";
	if (g >= MODERATE) return "moderate";
	return "gentle";
}

/** 段階が変わる位置．at はルート全体に対する始点からの距離の割合（0〜1） */
export type GradeStop = { at: number; level: GradeLevel };

/**
 * 点と標高から，ルートに沿った段階の切り替わりの一覧を作る．
 * 先頭は必ず at = 0 で，同じ段階が続く区間は1つにまとめる．
 */
export function gradeStops(points: LatLng[], elevs: number[]): GradeStop[] {
	if (points.length < 2) return [];
	const cum = cumulativeDistances(points);
	const total = cum[cum.length - 1];
	if (total <= 0) return [{ at: 0, level: "gentle" }];

	const stops: GradeStop[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const dist = cum[i + 1] - cum[i];
		const level = gradeLevel(dist > 0 ? (elevs[i + 1] - elevs[i]) / dist : 0);
		if (stops.at(-1)?.level !== level) {
			stops.push({ at: cum[i] / total, level });
		}
	}
	return stops;
}
