"use client";

/**
 * 逆算モードの入力欄とボタン．
 * 目標の種類（消費カロリー・歩く時間・距離）と値を選び，地図で選んだ出発地点から周回ルートを作る．
 * できたら，目標と実際の値を並べて見せ，「別の候補」と「保存」を出す．
 */

import {
	Loader2Icon,
	MapPinIcon,
	RefreshCwIcon,
	RouteIcon,
	SaveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TARGET_UNITS, type TargetKind } from "@/lib/round-trip";

type Props = {
	kind: TargetKind;
	/** 目標の値（入力途中も表示できるよう文字列のまま持つ） */
	value: string;
	onKindChange: (kind: TargetKind) => void;
	onValueChange: (value: string) => void;
	/** 出発地点を選んだか */
	hasStart: boolean;
	loading: boolean;
	/** 作ったルートの実際の値（まだ作っていなければ null） */
	actual: number | null;
	/** 表示中のルートが保存済みか */
	saved: boolean;
	onGenerate: () => void;
	onAnother: () => void;
	onSave: () => void;
};

/** 目標の値を表示用に丸める（距離だけ小数1桁） */
function formatValue(kind: TargetKind, v: number): string {
	return kind === "km" ? v.toFixed(1) : String(Math.round(v));
}

/** 目標の入力と，周回ルートを作るボタン */
export function TargetForm({
	kind,
	value,
	onKindChange,
	onValueChange,
	hasStart,
	loading,
	actual,
	saved,
	onGenerate,
	onAnother,
	onSave,
}: Props) {
	const target = Number.parseFloat(value);
	const valid = Number.isFinite(target) && target > 0;
	const { label, unit } = TARGET_UNITS[kind];

	return (
		<section aria-label="目標から周回ルートを作る" className="space-y-4">
			<ToggleGroup
				aria-label="目標の種類"
				variant="outline"
				size="sm"
				spacing={0}
				className="w-full"
				value={[kind]}
				// 選択中の項目をもう一度押しても空にならないようにする
				onValueChange={(v) => v[0] && onKindChange(v[0] as TargetKind)}
			>
				{(Object.keys(TARGET_UNITS) as TargetKind[]).map((k) => (
					<ToggleGroupItem key={k} value={k} className="flex-1">
						{TARGET_UNITS[k].label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			<div className="flex items-center justify-between gap-3">
				<label htmlFor="target-value" className="text-muted-foreground text-sm">
					目標の{label}
				</label>
				<div className="flex items-center gap-1.5 text-sm">
					<Input
						id="target-value"
						type="number"
						inputMode="decimal"
						min={0}
						step={kind === "km" ? 0.5 : 10}
						value={value}
						onChange={(e) => onValueChange(e.target.value)}
						className="w-24 text-right tabular-nums"
					/>
					<span className="w-8">{unit}</span>
				</div>
			</div>

			<p className="flex items-center gap-2 text-muted-foreground text-xs">
				<MapPinIcon className="size-4 shrink-0 text-shu" />
				{hasStart
					? "出発地点を選びました．地図をクリックすると選び直せます．"
					: "地図をクリックして，出発地点（戻ってくる場所）を選んでください．"}
			</p>

			{actual !== null && valid && (
				<p className="rounded-lg border bg-background/60 px-3 py-2 text-sm tabular-nums">
					目標 {formatValue(kind, target)} {unit} → このルート{" "}
					<span className="font-bold font-serif">
						{formatValue(kind, actual)} {unit}
					</span>
				</p>
			)}

			<div className="flex flex-wrap gap-2">
				<Button
					size="lg"
					className="w-full"
					onClick={actual === null ? onGenerate : onSave}
					disabled={
						!hasStart || !valid || loading || (actual !== null && saved)
					}
				>
					{loading ? (
						<Loader2Icon className="animate-spin" />
					) : actual === null ? (
						<RouteIcon />
					) : (
						<SaveIcon />
					)}
					{loading
						? "周回ルートを作っています…"
						: actual === null
							? "周回ルートを作る"
							: saved
								? "保存済み"
								: "このルートを保存する"}
				</Button>
				{actual !== null && (
					<Button
						variant="outline"
						className="w-full"
						onClick={onAnother}
						disabled={loading}
					>
						<RefreshCwIcon />
						別の候補を作る
					</Button>
				)}
			</div>
		</section>
	);
}
