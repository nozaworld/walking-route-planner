"use client";

/**
 * ルート疲労度プランナーの画面全体．
 * 「出発地点を選ぶ → 地図をクリック → 経路を確定」の流れを状態（Phase）で管理し，
 * 地図・エラー・読み込み中の表示を組み立てる．
 */

import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { LatLng } from "@/lib/geo";
import type { PlanErrorResponse, PlanResponse } from "@/lib/plan";

// Leaflet は window に依存するので，ブラウザでのみ読み込む
const RouteMap = dynamic(() => import("./route-map"), {
	ssr: false,
	loading: () => <div className="absolute inset-0 bg-muted" />,
});

/**
 * 画面の段階．
 * idle：何もしていない / drawing：経由点を打っている /
 * loading：API で計算中 / result：ルートを表示中
 */
type Phase = "idle" | "drawing" | "loading" | "result";

/** 段階ごとに操作バーに出す案内 */
const HINTS: Record<Phase, string> = {
	idle: "「出発地点を選ぶ」を押してから地図をクリックしてください．",
	drawing:
		"地図をクリックして経路上の点を順に打ってください．パン・ズームは自由に行えます．",
	loading: "",
	result: "",
};

/** 画面全体のコンポーネント */
export function Planner() {
	const [phase, setPhase] = useState<Phase>("idle");
	const [waypoints, setWaypoints] = useState<LatLng[]>([]);
	const [plan, setPlan] = useState<PlanResponse | null>(null);
	const [fitKey, setFitKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	/** すべてを最初の状態に戻す */
	function reset() {
		setPhase("idle");
		setWaypoints([]);
		setPlan(null);
		setError(null);
	}

	/** 描き直しを始める */
	function startDrawing() {
		reset();
		setPhase("drawing");
	}

	/** 描いている間だけ，クリックした点を経由点に加える */
	function handleMapClick(p: LatLng) {
		if (phase !== "drawing") return;
		setWaypoints((prev) => [...prev, p]);
	}

	/** 経由点を API に送り，徒歩ルートと標高を受け取る */
	async function finishDrawing() {
		if (waypoints.length < 2) return;
		setPhase("loading");
		setError(null);
		try {
			const res = await fetch("/api/plan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ waypoints }),
			});
			const data = (await res.json()) as PlanResponse | PlanErrorResponse;
			if ("error" in data) throw new Error(data.error);
			setPlan(data);
			setFitKey(`plan-${Date.now()}`);
			setPhase("result");
		} catch (e) {
			// 失敗しても打った点は残し，そのまま描き足して再挑戦できるようにする
			setError(
				e instanceof Error && !(e instanceof TypeError)
					? e.message
					: "通信に失敗しました．接続を確認してください．",
			);
			setPhase("drawing");
		}
	}

	return (
		<div className="flex h-dvh flex-col">
			<header className="flex flex-wrap items-center gap-4 border-b px-5 py-3">
				<h1 className="font-bold text-lg tracking-wide">
					ルート疲労度プランナー
				</h1>
			</header>

			<div className="flex min-h-0 flex-1 flex-col md:flex-row">
				<div className="relative min-h-[50vh] flex-1">
					<RouteMap
						waypoints={waypoints}
						route={plan?.coords ?? null}
						fitKey={fitKey}
						onMapClick={handleMapClick}
					/>
					{error && (
						<Alert
							variant="destructive"
							className="absolute top-2.5 right-2.5 left-2.5 z-[1000] w-auto"
						>
							<TriangleAlertIcon />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					{phase === "loading" && (
						<div className="absolute inset-0 z-[1000] flex items-center justify-center gap-2 bg-background/80 text-sm">
							<Loader2Icon className="size-4 animate-spin" />
							計算中です．しばらくお待ちください．
						</div>
					)}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2.5 border-t px-5 py-2.5">
				<Button
					onClick={startDrawing}
					disabled={phase === "drawing" || phase === "loading"}
				>
					出発地点を選ぶ
				</Button>
				<Button
					onClick={finishDrawing}
					disabled={phase !== "drawing" || waypoints.length < 2}
				>
					経路を確定する
				</Button>
				<Button
					variant="outline"
					onClick={reset}
					disabled={phase === "loading" || (phase === "idle" && !plan)}
				>
					やり直す
				</Button>
				<span className="text-muted-foreground text-xs">{HINTS[phase]}</span>
			</div>
		</div>
	);
}
