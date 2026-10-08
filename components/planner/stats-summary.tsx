"use client";

/**
 * ルートの統計の表示．
 * 距離を大きく見せ，所要時間・消費カロリー・獲得標高・下りをカードで並べる．
 * 所要時間と消費カロリーは，徒歩と自転車を切り替えて表示する．
 */

import {
	BikeIcon,
	ClockIcon,
	FlameIcon,
	FootprintsIcon,
	MountainIcon,
	TrendingDownIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMinutes, type RouteStats } from "@/lib/energy-model";
import { cn } from "@/lib/utils";

/** 移動手段 */
type Mode = "walk" | "bike";

type Props = {
	stats: RouteStats;
	className?: string;
};

/** 距離・時間・カロリー・高低差をまとめて表示する */
export function StatsSummary({ stats, className }: Props) {
	const [mode, setMode] = useState<Mode>("walk");
	const minutes = mode === "walk" ? stats.walkMin : stats.bikeMin;
	const kcal = mode === "walk" ? stats.walkKcal : stats.bikeKcal;

	return (
		<section
			aria-label="ルートの統計"
			className={cn("space-y-3", className)}
			data-testid="stats"
		>
			<div className="flex items-end justify-between gap-3">
				<div>
					<div className="text-muted-foreground text-xs">道のり</div>
					<div className="font-bold font-serif text-4xl tabular-nums leading-none">
						{(stats.dist / 1000).toFixed(2)}
						<span className="ml-1 font-sans text-base text-muted-foreground">
							km
						</span>
					</div>
				</div>
				<ToggleGroup
					aria-label="移動手段"
					variant="outline"
					size="sm"
					spacing={0}
					value={[mode]}
					// 選択中の項目をもう一度押しても空にならないようにする
					onValueChange={(v) => v[0] && setMode(v[0] as Mode)}
				>
					<ToggleGroupItem value="walk" aria-label="徒歩">
						<FootprintsIcon />
					</ToggleGroupItem>
					<ToggleGroupItem value="bike" aria-label="自転車">
						<BikeIcon />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<StatCard
					icon={<ClockIcon />}
					label={mode === "walk" ? "歩いて" : "自転車で"}
					value={formatMinutes(minutes)}
				/>
				<StatCard
					icon={<FlameIcon />}
					label="消費カロリー"
					value={`${Math.round(kcal)}`}
					unit="kcal"
					accent
				/>
				<StatCard
					icon={<MountainIcon />}
					label="獲得標高"
					value={`${Math.round(stats.gain)}`}
					unit="m"
				/>
				<StatCard
					icon={<TrendingDownIcon />}
					label="下り"
					value={`${Math.round(stats.loss)}`}
					unit="m"
				/>
			</div>

			{mode === "bike" && (
				<p className="text-[11px] text-muted-foreground">
					自転車の値は，徒歩ルートを自転車で走った場合の概算です．
				</p>
			)}
		</section>
	);
}

/** 統計1項目のカード．accent なら値を朱色で強調する */
function StatCard({
	icon,
	label,
	value,
	unit,
	accent = false,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	unit?: string;
	accent?: boolean;
}) {
	return (
		<div className="rounded-lg border bg-background/60 px-3 py-2.5">
			<div className="flex items-center gap-1.5 text-muted-foreground text-xs [&_svg]:size-3.5">
				{icon}
				{label}
			</div>
			<div
				className={cn(
					"mt-1 font-bold font-serif text-xl tabular-nums",
					accent && "text-shu",
				)}
			>
				{value}
				{unit && (
					<span className="ml-1 font-normal font-sans text-muted-foreground text-xs">
						{unit}
					</span>
				)}
			</div>
		</div>
	);
}
