"use client";

/**
 * ルート疲労度プランナーの画面全体．
 * 地図を画面いっぱいに広げ，操作パネルを PC では左に浮かせ，スマホでは下に置く．
 * 「描きはじめる → 地図をクリック → 確定」の流れを状態（Phase）で管理し，
 * 手順の案内・統計・断面図・保存済みルートをパネルの中に組み立てる．
 */

import { TriangleAlertIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildSegments, computeStats } from "@/lib/energy-model";
import type { LatLng } from "@/lib/geo";
import type { Place } from "@/lib/geocode";
import type { PlanErrorResponse, PlanResponse } from "@/lib/plan";
import {
	loadPanelSize,
	loadRoutes,
	loadWeight,
	type PanelSize,
	type SavedRoute,
	savePanelSize,
	saveRoutes,
	saveWeight,
} from "@/lib/storage";
import { ElevationProfile } from "./elevation-profile";
import { PanelHeader } from "./panel-header";
import { PlaceSearch } from "./place-search";
import { ResizeHandle } from "./resize-handle";
import { SaveRouteDialog } from "./save-route-dialog";
import { SavedRouteList } from "./saved-route-list";
import { StatsSummary } from "./stats-summary";
import { type Phase, StepGuide } from "./step-guide";

// Leaflet は window に依存するので，ブラウザでのみ読み込む
const RouteMap = dynamic(() => import("./route-map"), {
	ssr: false,
	loading: () => <div className="absolute inset-0 bg-muted" />,
});

/** 体重が未入力・不正なときに使う値 [kg] */
const DEFAULT_WEIGHT = 60;

/** 操作パネルの大きさの既定値と範囲（幅は px，高さは画面の高さに対する%） */
const DEFAULT_PANEL: PanelSize = { width: 380, height: 50 };
const PANEL_WIDTH = { min: 320, max: 640 };
const PANEL_HEIGHT = { min: 25, max: 85 };

/** パネルのタブ */
type Tab = "plan" | "saved";

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
	const [tab, setTab] = useState<Tab>("plan");
	const [panelSize, setPanelSize] = useState<PanelSize>(DEFAULT_PANEL);
	// 検索で選んだ場所．同じ場所を選び直しても移動するよう key を持たせる
	const [place, setPlace] = useState<(Place & { key: number }) | null>(null);
	// 地図の中心（検索で近い候補を優先するのに使う．描画には使わないので ref）
	const mapCenter = useRef<LatLng | null>(null);

	// localStorage はサーバーでは読めないので，表示後に読み込む
	useEffect(() => {
		const saved = loadWeight();
		if (saved !== null) setWeightInput(String(saved));
		setRoutes(loadRoutes());
		const panel = loadPanelSize();
		if (panel) setPanelSize(panel);
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
		setTab("plan");
		setPhase("drawing");
	}

	/** 描いている間だけ，クリックした点を経由点に加える */
	function handleMapClick(p: LatLng) {
		if (phase !== "drawing") return;
		setWaypoints((prev) => [...prev, p]);
	}

	/** 最後に打った点を取り消す */
	function undoWaypoint() {
		setWaypoints((prev) => prev.slice(0, -1));
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
		setTab("plan");
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

	/** パネルの大きさを変えたら保存する */
	function commitPanelSize(next: Partial<PanelSize>) {
		const size = { ...panelSize, ...next };
		setPanelSize(size);
		savePanelSize(size);
	}

	return (
		<main
			className="relative h-dvh overflow-hidden"
			// パネルと，パネルの横に置く要素の位置を CSS 変数で揃える
			style={
				{
					"--panel-w": `${panelSize.width}px`,
					"--panel-h": `${panelSize.height}dvh`,
				} as React.CSSProperties
			}
		>
			<RouteMap
				waypoints={waypoints}
				route={plan?.coords ?? null}
				fitKey={fitKey}
				panelSize={panelSize}
				place={place}
				onMapClick={handleMapClick}
				onCenterChange={(c) => {
					mapCenter.current = c;
				}}
			/>

			{/* PC はパネルの右，スマホは画面の上端（右上のズームボタンは避ける） */}
			<PlaceSearch
				getCenter={() => mapCenter.current}
				onSelect={(p) => setPlace({ ...p, key: Date.now() })}
				className="absolute top-4 right-16 left-4 z-[650] md:right-auto md:left-[calc(var(--panel-w)+2rem)] md:w-[min(420px,calc(100%-var(--panel-w)-7rem))]"
			/>

			{/* 描いている間は，地図の上に操作のヒントを出す */}
			{phase === "drawing" && (
				<div className="pointer-events-none absolute top-[4.5rem] left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full border bg-card/90 px-4 py-1.5 text-xs shadow-sm backdrop-blur md:left-[calc(50%+var(--panel-w)/2+0.5rem)]">
					地図をクリックして道をたどる
				</div>
			)}

			<aside className="absolute inset-x-0 bottom-0 z-[600] flex h-(--panel-h) flex-col rounded-t-2xl border bg-card/95 shadow-xl backdrop-blur md:inset-y-4 md:right-auto md:left-4 md:h-auto md:w-(--panel-w) md:rounded-2xl">
				{/* スマホは上端，PC は右端のつまみで大きさを変える */}
				<ResizeHandle
					axis="y"
					value={panelSize.height}
					min={PANEL_HEIGHT.min}
					max={PANEL_HEIGHT.max}
					step={5}
					onChange={(height) => setPanelSize((s) => ({ ...s, height }))}
					onCommit={(height) => commitPanelSize({ height })}
					label="パネルの高さを変える"
					className="md:hidden"
				/>
				<ResizeHandle
					axis="x"
					value={panelSize.width}
					min={PANEL_WIDTH.min}
					max={PANEL_WIDTH.max}
					step={20}
					onChange={(width) => setPanelSize((s) => ({ ...s, width }))}
					onCommit={(width) => commitPanelSize({ width })}
					label="パネルの幅を変える"
					className="hidden md:flex"
				/>
				{/* 角丸からはみ出さないよう，中身はこの内側で切り取る */}
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
					<PanelHeader />

					<Tabs
						value={tab}
						onValueChange={(v) => setTab(v as Tab)}
						className="min-h-0 flex-1 gap-0"
					>
						<div className="shrink-0 px-5 pt-3">
							<TabsList className="w-full">
								<TabsTrigger value="plan">ルートを作る</TabsTrigger>
								<TabsTrigger value="saved">
									保存済み
									<span className="text-muted-foreground text-xs tabular-nums">
										{routes.length}
									</span>
								</TabsTrigger>
							</TabsList>
						</div>

						<TabsContent
							value="plan"
							className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-4 pb-5"
						>
							<div className="flex items-center justify-between gap-3">
								<label
									htmlFor="weight"
									className="text-muted-foreground text-sm"
								>
									体重
								</label>
								<div className="flex items-center gap-1.5 text-sm">
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
										className="w-20 text-right tabular-nums"
									/>
									kg
								</div>
							</div>

							{error && (
								<Alert variant="destructive">
									<TriangleAlertIcon />
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							{/* 確定後は結果を先に見せる（スマホでは下のシートに収まる範囲が狭いため） */}
							{stats && <StatsSummary stats={stats} />}
							{plan && (
								<ElevationProfile
									points={plan.profile.points}
									elevs={plan.profile.elevs}
								/>
							)}
							<StepGuide
								phase={phase}
								waypointCount={waypoints.length}
								saved={viewingId !== null}
								onStart={startDrawing}
								onUndo={undoWaypoint}
								onFinish={finishDrawing}
								onCancel={reset}
								onSave={() => setSaveOpen(true)}
							/>
						</TabsContent>

						<TabsContent
							value="saved"
							className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5"
						>
							<SavedRouteList
								routes={routes}
								activeId={viewingId}
								onSelect={showSavedRoute}
								onDelete={handleDelete}
							/>
						</TabsContent>
					</Tabs>
				</div>
			</aside>

			{/* 計算中は地図を薄く覆って，クリックを受け付けない */}
			{phase === "loading" && (
				<div className="absolute inset-0 z-[500] bg-background/40 backdrop-blur-[1px]" />
			)}

			<SaveRouteDialog
				open={saveOpen}
				onOpenChange={setSaveOpen}
				defaultName={`ルート ${routes.length + 1}`}
				onSave={handleSave}
			/>
		</main>
	);
}
