/**
 * 経路に，断面図と統計の計算に使う標高を付ける．
 * 経路を PROFILE_SAMPLES 点に間引き，国土地理院から標高を取る．
 * 経路計算（/api/plan）と周回ルート（/api/round-trip）で共通に使う．
 */

import { downsample, type LatLng } from "@/lib/geo";
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
