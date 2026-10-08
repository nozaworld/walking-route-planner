"use client";

/**
 * ルート疲労度プランナーの画面全体．
 * 「出発地点を選ぶ → 地図をクリック → 経路を確定」の流れを状態（Phase）で管理し，
 * 地図・断面図・統計・保存済みルート・エラー・読み込み中の表示を組み立てる．
 */

import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSegments, computeStats } from "@/lib/energy-model";
import type { LatLng } from "@/lib/geo";
import type { PlanErrorResponse, PlanResponse } from "@/lib/plan";
import {
	loadRoutes,
	loadWeight,
	type SavedRoute,
	saveRoutes,
	saveWeight,
} from "@/lib/storage";
import { ElevationProfile } from "./elevation-profile";
import { SaveRouteDialog } from "./save-route-dialog";
import { SavedRouteList } from "./saved-route-list";
import { StatsSummary } from "./stats-summary";

// Leaflet は window に依存するので，ブラウザでのみ読み込む
const RouteMap = dynamic(() => import("./route-map"), {
	ssr: false,
	loading: () => <div className="absolute inset-0 bg-muted" />,
});

/** 体重が未入力・不正なときに使う値 [kg] */
const DEFAULT_WEIGHT = 60;

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
	// 表示中のルートが保存済みなら，その id（保存ボタンを押せなくするのに使う）
	const [viewingId, setViewingId] = useState<string | null>(null);
	const [fitKey, setFitKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	// 入力途中（空欄など）も表示できるよう，体重は文字列のまま持つ
	const [weightInput, setWeightInput] = useState(String(DEFAULT_WEIGHT));
	const [routes, setRoutes] = useState<SavedRoute[]>([]);
	const [saveOpen, setSaveOpen] = useState(false);

	// localStorage はサーバーでは読めないので，表示後に読み込む
	useEffect(() => {
		const saved = loadWeight();
		if (saved !== null) setWeightInput(String(saved));
		setRoutes(loadRoutes());
	}, []);

	/** 計算に使う体重 [kg]．不正な入力なら既定値 */
	const weight = useMemo(() => {
		const v = Number.parseFloat(weightInput);
		return Number.isFinite(v) && v > 0 ? v : DEFAULT_WEIGHT;
	}, [weightInput]);

	// 標高は取得済みなので，体重を変えても再取得せず計算し直すだけ（旧版は毎回取り直していた）
	const stats = useMemo(() => {
		if (!plan) return null;
		const { points, elevs } = plan.profile;
		return computeStats(buildSegments(points, elevs), weight);
	}, [plan, weight]);

	/** すべてを最初の状態に戻す */
	function reset() {
		setPhase("idle");
		setWaypoints([]);
		setPlan(null);
		setViewingId(null);
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

	/** 入力欄から離れたら，実際に使う値に揃えて保存する */
	function handleWeightBlur() {
		setWeightInput(String(weight));
		saveWeight(weight);
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

	/** 保存済みルートを地図に表示する（統計は今の体重で計算し直す） */
	function showSavedRoute(route: SavedRoute) {
		setWaypoints([]);
		setPlan({ coords: route.coords, profile: route.profile });
		setViewingId(route.id);
		setFitKey(route.id);
		setError(null);
		setPhase("result");
	}

	/** 一覧を画面と localStorage の両方で更新する */
	function updateRoutes(next: SavedRoute[]) {
		setRoutes(next);
		saveRoutes(next);
	}

	/** 表示中のルートを，入力された名前で一覧の先頭に保存する */
	function handleSave(name: string) {
		if (!plan || !stats) return;
		const route: SavedRoute = {
			id: crypto.randomUUID(),
			name,
			stats,
			coords: plan.coords,
			profile: plan.profile,
			savedAt: Date.now(),
		};
		updateRoutes([route, ...routes]);
		setViewingId(route.id);
		setSaveOpen(false);
		toast.success(`「${name}」を保存しました`);
	}

	/** 保存済みルートを削除する．表示中なら保存前の扱いに戻す */
	function handleDelete(id: string) {
		updateRoutes(routes.filter((r) => r.id !== id));
		if (viewingId === id) setViewingId(null);
	}

	return (
		<div className="flex h-dvh flex-col">
			<header className="flex flex-wrap items-center gap-4 border-b px-5 py-3">
				<h1 className="font-bold text-lg tracking-wide">
					ルート疲労度プランナー
				</h1>
				<label
					htmlFor="weight"
					className="ml-auto flex items-center gap-2 text-sm"
				>
					体重
					<Input
						id="weight"
						type="number"
						inputMode="decimal"
						min={20}
						max={200}
						step={0.1}
						value={weightInput}
						onChange={(e) => setWeightInput(e.target.value)}
						onBlur={handleWeightBlur}
						className="w-20"
					/>
					kg
				</label>
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
					{plan && (
						<ElevationProfile
							points={plan.profile.points}
							elevs={plan.profile.elevs}
						/>
					)}
				</div>
				<SavedRouteList
					routes={routes}
					activeId={viewingId}
					onSelect={showSavedRoute}
					onDelete={handleDelete}
				/>
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
				<Button
					variant="outline"
					onClick={() => setSaveOpen(true)}
					disabled={phase !== "result" || viewingId !== null}
				>
					このルートを保存する
				</Button>
				<span className="text-muted-foreground text-xs">{HINTS[phase]}</span>
				{stats && <StatsSummary stats={stats} className="ml-auto" />}
			</div>

			<SaveRouteDialog
				open={saveOpen}
				onOpenChange={setSaveOpen}
				defaultName={`ルート ${routes.length + 1}`}
				onSave={handleSave}
			/>
		</div>
	);
}
