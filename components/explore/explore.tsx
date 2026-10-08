"use client";

/**
 * 「みんなのルート」（/explore）の画面．
 * 地図を画面いっぱいに広げ，左のパネルで距離・坂のきつさ・並び順を選ぶ．
 * 地図を動かしたり条件を変えたりするたびに，表示範囲と重なる公開ルートを検索し直す．
 */

import { CompassIcon, Loader2Icon, PencilLineIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/planner/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	type PublicRouteSummary,
	STEEPNESS,
	type Steepness,
} from "@/lib/community";
import { cn } from "@/lib/utils";
import type { ViewBounds } from "./explore-map";
import { RouteCard } from "./route-card";

// 地図（MapLibre）は window と WebGL に依存するので，ブラウザでのみ読み込む
const ExploreMap = dynamic(() => import("./explore-map"), {
	ssr: false,
	loading: () => <div className="absolute inset-0 bg-muted" />,
});

/** パネルの幅 [px] */
const PANEL_WIDTH = 380;
/** 地図を動かしてから検索するまでの待ち時間 [ms]（動かしている間に何度も検索しない） */
const DEBOUNCE_MS = 300;

/** 距離の絞り込みの選択肢 */
const DISTANCES = {
	all: { label: "すべて" },
	short: { label: "〜3km", max: 3 },
	middle: { label: "3〜8km", min: 3, max: 8 },
	long: { label: "8km〜", min: 8 },
} as const;
type DistanceKey = keyof typeof DISTANCES;

/** 公開ルートの地図と一覧 */
export function Explore() {
	const [bounds, setBounds] = useState<ViewBounds | null>(null);
	const [distance, setDistance] = useState<DistanceKey>("all");
	const [steep, setSteep] = useState<Steepness | "all">("all");
	const [sort, setSort] = useState<"new" | "likes">("new");
	const [routes, setRoutes] = useState<PublicRouteSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// 表示範囲か条件が変わったら，少し待ってから検索し直す（古い検索の結果は捨てる）
	useEffect(() => {
		if (!bounds) return;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			setLoading(true);
			const range = DISTANCES[distance];
			const params = new URLSearchParams({
				w: String(bounds.w),
				s: String(bounds.s),
				e: String(bounds.e),
				n: String(bounds.n),
				steep,
				sort,
			});
			if ("min" in range) params.set("minKm", String(range.min));
			if ("max" in range) params.set("maxKm", String(range.max));
			try {
				const res = await fetch(`/api/explore?${params}`, {
					signal: controller.signal,
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? "読み込めませんでした．");
				setRoutes(data.routes);
				setError(null);
			} catch (e) {
				if (controller.signal.aborted) return;
				setError(e instanceof Error ? e.message : "読み込めませんでした．");
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		}, DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [bounds, distance, steep, sort]);

	return (
		<main className="relative h-dvh overflow-hidden">
			<ExploreMap
				routes={routes}
				selectedId={selectedId}
				onSelect={setSelectedId}
				onBoundsChange={setBounds}
				panelWidth={PANEL_WIDTH}
			/>

			<aside className="absolute inset-x-0 bottom-0 z-20 flex h-[55dvh] flex-col overflow-hidden rounded-t-2xl border bg-card/95 shadow-xl backdrop-blur md:inset-y-4 md:right-auto md:left-4 md:h-auto md:w-[380px] md:rounded-2xl">
				<header className="relative shrink-0 overflow-hidden border-b">
					<div
						aria-hidden
						className="absolute inset-0 bg-seigaiha [mask-image:linear-gradient(to_left,black,transparent_75%)]"
					/>
					<div className="relative flex items-center gap-3 px-5 py-3">
						<CompassIcon className="size-7 shrink-0 text-shu" />
						<div className="min-w-0 flex-1">
							<h1 className="font-bold font-serif text-lg tracking-wider">
								みんなのルート
							</h1>
							<p className="text-muted-foreground text-xs">
								地図に見えている範囲の公開ルート
							</p>
						</div>
						<ThemeToggle />
					</div>
				</header>

				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-5">
					<Filter label="距離">
						<ToggleGroup
							aria-label="距離"
							variant="outline"
							size="sm"
							spacing={0}
							className="w-full"
							value={[distance]}
							onValueChange={(v) => v[0] && setDistance(v[0] as DistanceKey)}
						>
							{(Object.keys(DISTANCES) as DistanceKey[]).map((k) => (
								<ToggleGroupItem key={k} value={k} className="flex-1">
									{DISTANCES[k].label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</Filter>
					<Filter label="坂">
						<ToggleGroup
							aria-label="坂のきつさ"
							variant="outline"
							size="sm"
							spacing={0}
							className="w-full"
							value={[steep]}
							onValueChange={(v) => v[0] && setSteep(v[0] as Steepness | "all")}
						>
							<ToggleGroupItem value="all" className="flex-1">
								すべて
							</ToggleGroupItem>
							{(Object.keys(STEEPNESS) as Steepness[]).map((k) => (
								<ToggleGroupItem key={k} value={k} className="flex-1">
									{STEEPNESS[k].label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</Filter>
					<Filter label="並び順">
						<ToggleGroup
							aria-label="並び順"
							variant="outline"
							size="sm"
							spacing={0}
							className="w-full"
							value={[sort]}
							onValueChange={(v) => v[0] && setSort(v[0] as "new" | "likes")}
						>
							<ToggleGroupItem value="new" className="flex-1">
								新しい順
							</ToggleGroupItem>
							<ToggleGroupItem value="likes" className="flex-1">
								いいね順
							</ToggleGroupItem>
						</ToggleGroup>
					</Filter>

					<div className="flex items-center justify-between text-muted-foreground text-xs">
						<span>{loading ? "探しています…" : `${routes.length} 件`}</span>
						{loading && <Loader2Icon className="size-4 animate-spin" />}
					</div>
					{error && <p className="text-destructive text-sm">{error}</p>}

					{!loading && routes.length === 0 ? (
						<p className="py-6 text-center text-muted-foreground text-xs leading-relaxed">
							この範囲には公開ルートがありません．
							<br />
							地図を動かすか，縮小して探してみてください．
						</p>
					) : (
						<ul className="flex flex-col gap-2">
							{routes.map((r) => (
								<RouteCard
									key={r.id}
									route={r}
									selected={r.id === selectedId}
									onSelect={() => setSelectedId(r.id)}
								/>
							))}
						</ul>
					)}

					<Link
						href="/"
						className={cn(buttonVariants({ variant: "outline" }), "w-full")}
					>
						<PencilLineIcon />
						自分でルートを作る
					</Link>
				</div>
			</aside>
		</main>
	);
}

/** 絞り込みの1行（見出しと選択肢） */
function Filter({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<div className="text-muted-foreground text-xs">{label}</div>
			{children}
		</div>
	);
}
