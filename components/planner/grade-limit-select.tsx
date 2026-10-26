"use client";

/**
 * 提案するルートの勾配の上限を選ぶ欄．
 * 「なし」か GRADE_LIMITS の値を選ぶ．地図に描くときも目標から作るときも使う．
 */

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GRADE_LIMITS } from "@/lib/grade";

type Props = {
	/** 勾配の上限（例：0.06 = 6%）．制限しないなら null */
	value: number | null;
	onChange: (value: number | null) => void;
	disabled?: boolean;
};

/** 勾配の上限を選ぶトグル */
export function GradeLimitSelect({ value, onChange, disabled }: Props) {
	return (
		<div className="space-y-2">
			<p id="grade-limit-label" className="text-muted-foreground text-sm">
				坂の上限（勾配）
			</p>
			<ToggleGroup
				aria-labelledby="grade-limit-label"
				variant="outline"
				size="sm"
				spacing={0}
				className="w-full"
				value={[value === null ? "none" : String(value)]}
				disabled={disabled}
				// 選択中の項目をもう一度押しても空にならないようにする
				onValueChange={(v) =>
					v[0] && onChange(v[0] === "none" ? null : Number(v[0]))
				}
			>
				<ToggleGroupItem value="none" className="flex-1">
					なし
				</ToggleGroupItem>
				{GRADE_LIMITS.map((g) => (
					<ToggleGroupItem
						key={g}
						value={String(g)}
						className="flex-1 tabular-nums"
					>
						{Math.round(g * 100)}%
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}
