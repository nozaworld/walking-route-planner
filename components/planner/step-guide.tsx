/**
 * ルートを作る手順の案内と，その段階で押すボタン．
 * 「一 出発地点 → 二 経由点 → 三 確定」のどこにいるかを示し，
 * 今できる操作だけを出す（旧版は4つのボタンが常に並んでいた）．
 * ルートを確定した後は，統計が目に入るよう手順の一覧を畳んでボタンだけにする．
 */

import {
	CheckIcon,
	Loader2Icon,
	PencilLineIcon,
	RotateCcwIcon,
	SaveIcon,
	Undo2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 画面の段階．
 * idle：何もしていない / drawing：経由点を打っている /
 * loading：API で計算中 / result：ルートを表示中
 */
export type Phase = "idle" | "drawing" | "loading" | "result";

type StepState = "done" | "current" | "todo";

const STEPS = [
	{
		mark: "一",
		title: "出発地点を置く",
		body: "地図をクリックして出発地点を決めます．",
	},
	{
		mark: "二",
		title: "道をたどる",
		body: "曲がり角や通りたい場所を順にクリックします．",
	},
	{
		mark: "三",
		title: "ルートを確定",
		body: "道に沿ったルートと，疲れ具合を計算します．",
	},
] as const;

type Props = {
	phase: Phase;
	waypointCount: number;
	/** 表示中のルートが保存済みか */
	saved: boolean;
	onStart: () => void;
	onUndo: () => void;
	onFinish: () => void;
	onCancel: () => void;
	onSave: () => void;
};

/** 段階と打った点の数から，今いる手順の番号（0〜3）を求める．3 はすべて完了 */
function currentStep(phase: Phase, waypointCount: number): number {
	if (phase === "result") return 3;
	if (phase === "loading") return 2;
	if (phase === "drawing") return waypointCount === 0 ? 0 : 1;
	return -1; // idle：まだ始めていない
}

/** 手順の一覧と，段階に応じたボタンを並べる */
export function StepGuide({
	phase,
	waypointCount,
	saved,
	onStart,
	onUndo,
	onFinish,
	onCancel,
	onSave,
}: Props) {
	const step = currentStep(phase, waypointCount);
	// 確定できるのは2点以上打ったとき
	const canFinish = waypointCount >= 2;

	return (
		<section aria-label="ルートを作る手順" className="space-y-4">
			<ol className={cn("space-y-3", phase === "result" && "hidden")}>
				{STEPS.map((s, i) => {
					const state: StepState =
						i < step ? "done" : i === step ? "current" : "todo";
					return (
						<li key={s.mark} className="flex gap-3">
							<StepMark mark={s.mark} state={state} />
							<div className={cn(state === "todo" && "opacity-50")}>
								<div className="font-bold text-sm">{s.title}</div>
								{state === "current" && (
									<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
										{s.body}
										{i === 1 && `（いま ${waypointCount} 点）`}
									</p>
								)}
							</div>
						</li>
					);
				})}
			</ol>

			<div className="flex flex-wrap gap-2">
				{phase === "idle" && (
					<Button size="lg" className="w-full" onClick={onStart}>
						<PencilLineIcon />
						ルートを描きはじめる
					</Button>
				)}

				{phase === "drawing" && (
					<>
						<Button
							size="lg"
							className="w-full"
							onClick={onFinish}
							disabled={!canFinish}
						>
							<CheckIcon />
							経路を確定する
						</Button>
						<Button
							variant="outline"
							className="flex-1"
							onClick={onUndo}
							disabled={waypointCount === 0}
						>
							<Undo2Icon />
							ひとつ戻す
						</Button>
						<Button variant="ghost" className="flex-1" onClick={onCancel}>
							やめる
						</Button>
					</>
				)}

				{phase === "loading" && (
					<Button size="lg" className="w-full" disabled>
						<Loader2Icon className="animate-spin" />
						計算中…
					</Button>
				)}

				{phase === "result" && (
					<>
						<Button
							size="lg"
							className="w-full"
							onClick={onSave}
							disabled={saved}
						>
							<SaveIcon />
							{saved ? "保存済み" : "このルートを保存する"}
						</Button>
						<Button variant="outline" className="w-full" onClick={onStart}>
							<RotateCcwIcon />
							新しく描く
						</Button>
					</>
				)}
			</div>
		</section>
	);
}

/** 手順の番号を，状態に応じた丸印（完了は抹茶・現在は藍・未着手は線だけ）で描く */
function StepMark({ mark, state }: { mark: string; state: StepState }) {
	return (
		<span
			aria-hidden
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-full border font-serif text-sm",
				state === "done" && "border-matcha bg-matcha text-white",
				state === "current" &&
					"border-primary bg-primary text-primary-foreground",
				state === "todo" && "border-border text-muted-foreground",
			)}
		>
			{state === "done" ? <CheckIcon className="size-3.5" /> : mark}
		</span>
	);
}
