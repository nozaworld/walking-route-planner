/**
 * 経路に，断面図と統計の計算に使う標高を付ける．
 * 経路を PROFILE_SAMPLES 点に間引き，国土地理院から標高を取る．
 * 経路計算（/api/plan）と周回ルート（/api/round-trip）で共通に使う．
 * 勾配の上限があるときは，候補の経路の標高を順に調べ，上限を守る経路を選ぶ（pickByGrade）．
 */

import { downsample, type LatLng } from "@/lib/geo";
import { maxGrade } from "@/lib/grade";
import type { PlanResponse } from "@/lib/plan";
import { getElevations } from "./elevation";

/** 断面図と統計に使う点の数 */
const PROFILE_SAMPLES = 50;

/** 経路の座標から，API が返す形（経路と断面図用の点・標高）を作る */
export async function withProfile(coords: LatLng[]): Promise<PlanResponse> {
	const points = downsample(coords, PROFILE_SAMPLES);
	const elevs = await getElevations(points);
	return { coords, profile: { points, elevs } };
}

/**
 * 候補の経路を1本ずつ取り出して標高を付け，最大勾配が limit 以下のものを見つけたらそれを返す．
 * どれも上限を超えたら，最大勾配が最も小さいものを返す（画面側で警告を出す）．
 * 候補は先頭ほど優先する（ORS の代わりの経路は短い順）．
 * 標高の取得を減らすため，上限を守る候補が見つかった時点で残りは調べない．
 *
 * candidates の要素は経路を返す関数．null を返したら（利用回数の上限など）その候補は飛ばす．
 * 2本目以降の候補の失敗は無視し，それまでに調べた中から選ぶ．1本目の失敗はそのまま投げる．
 */
export async function pickByGrade(
	candidates: (() => Promise<LatLng[] | null>)[],
	limit: number,
	toPlan: (coords: LatLng[]) => Promise<PlanResponse> = withProfile,
): Promise<PlanResponse> {
	let best: { plan: PlanResponse; grade: number } | null = null;
	for (const [i, candidate] of candidates.entries()) {
		let plan: PlanResponse;
		try {
			const coords = await candidate();
			if (!coords) continue;
			plan = await toPlan(coords);
		} catch (e) {
			if (i === 0) throw e;
			console.error("勾配を比べる候補の取得に失敗しました", e);
			continue;
		}
		const grade = maxGrade(plan.profile.points, plan.profile.elevs);
		if (grade <= limit) return plan;
		if (!best || grade < best.grade) best = { plan, grade };
	}
	if (!best) throw new Error("候補の経路がありません");
	return best.plan;
}
