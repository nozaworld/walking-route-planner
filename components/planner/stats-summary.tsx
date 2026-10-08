/**
 * ルートの統計の表示．
 * 距離，獲得標高と下り，徒歩・自転車それぞれの所要時間と消費カロリーを並べる．
 */

import { formatMinutes, type RouteStats } from "@/lib/energy-model";
import { cn } from "@/lib/utils";

type Props = {
	stats: RouteStats;
	className?: string;
};

/**
 * 統計を操作バーの右端に出す形で表示する．
 * 自転車の数値も徒歩ルートでの概算（自転車用ルートは次フェーズで対応）．
 */
export function StatsSummary({ stats, className }: Props) {
	return (
		<div
			className={cn("text-right text-sm leading-relaxed", className)}
			data-testid="stats"
		>
			<div className="font-bold text-[#b5562d] text-xl">
				{(stats.dist / 1000).toFixed(2)} km
			</div>
			<div>
				獲得標高 {Math.round(stats.gain)} m ／ 下り {Math.round(stats.loss)} m
			</div>
			<div>
				🚶 徒歩 {formatMinutes(stats.walkMin)} ／ {Math.round(stats.walkKcal)}{" "}
				kcal
			</div>
			<div>
				🚲 自転車 {formatMinutes(stats.bikeMin)} ／ {Math.round(stats.bikeKcal)}{" "}
				kcal
			</div>
		</div>
	);
}
