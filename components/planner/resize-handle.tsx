"use client";

/**
 * 操作パネルの端に置く，ドラッグで大きさを変えるつまみ．
 * axis="x" は右端に置いて幅を，axis="y" は上端に置いて高さを変える．
 * キーボードでも矢印キーで変えられるよう，role="separator" として振る舞う．
 */

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
	/** x：左右にドラッグして幅を変える / y：上下にドラッグして高さを変える */
	axis: "x" | "y";
	/** 今の大きさ（x は px，y は画面の高さに対する%） */
	value: number;
	min: number;
	max: number;
	/** 矢印キー1回で変える量 */
	step: number;
	/** ドラッグ中に呼ばれる */
	onChange: (value: number) => void;
	/** ドラッグやキー操作を終えたときに呼ばれる（保存に使う） */
	onCommit: (value: number) => void;
	label: string;
	className?: string;
};

/** 値を min〜max に収める */
function clamp(v: number, min: number, max: number): number {
	return Math.min(Math.max(v, min), max);
}

/** ドラッグとキー操作で大きさを変えるつまみ */
export function ResizeHandle({
	axis,
	value,
	min,
	max,
	step,
	onChange,
	onCommit,
	label,
	className,
}: Props) {
	// ドラッグを始めたときのポインタの位置と大きさ（ドラッグしていなければ null）
	const drag = useRef<{ x: number; y: number; value: number } | null>(null);
	// 最後に onChange へ渡した値（離したときに onCommit へ渡す）
	const latest = useRef(value);

	/** ドラッグを始める．ポインタを捕まえて，パネルの外へ出ても追いかける */
	function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = { x: e.clientX, y: e.clientY, value };
		latest.current = value;
	}

	/** ポインタの移動量から新しい大きさを求める */
	function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
		const start = drag.current;
		if (!start) return;
		const next =
			axis === "x"
				? start.value + (e.clientX - start.x)
				: // 上へドラッグするほど高くする（画面の高さに対する%に直す）
					start.value - ((e.clientY - start.y) / window.innerHeight) * 100;
		latest.current = clamp(next, min, max);
		onChange(latest.current);
	}

	/** ドラッグを終えて，最後の大きさを確定する */
	function handlePointerUp() {
		if (!drag.current) return;
		drag.current = null;
		onCommit(latest.current);
	}

	/** 矢印キーで大きさを変える（x は →で広げる，y は ↑で高くする） */
	function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
		const grow = axis === "x" ? "ArrowRight" : "ArrowUp";
		const shrink = axis === "x" ? "ArrowLeft" : "ArrowDown";
		if (e.key !== grow && e.key !== shrink) return;
		e.preventDefault();
		const next = clamp(value + (e.key === grow ? step : -step), min, max);
		onChange(next);
		onCommit(next);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: <hr> はフォーカスもドラッグもできないため，div に role を付ける
		<div
			role="separator"
			aria-orientation={axis === "x" ? "vertical" : "horizontal"}
			aria-label={label}
			aria-valuenow={Math.round(value)}
			aria-valuemin={min}
			aria-valuemax={max}
			tabIndex={0}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onKeyDown={handleKeyDown}
			className={cn(
				"group absolute z-10 flex touch-none select-none items-center justify-center outline-none",
				axis === "x"
					? "inset-y-0 -right-1.5 w-3 cursor-col-resize"
					: "inset-x-0 top-0 h-5 cursor-row-resize",
				className,
			)}
		>
			{/* 見た目のつまみ．触れたときやフォーカス時に濃くする */}
			<span
				aria-hidden
				className={cn(
					"rounded-full bg-border transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary group-active:bg-primary",
					axis === "x" ? "h-12 w-1" : "h-1 w-12",
				)}
			/>
		</div>
	);
}
