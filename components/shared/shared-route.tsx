"use client";

/**
 * 共有ページ（/r/[id]）の画面．
 * トップページと同じ地図の上に，ルート名・作成者・統計・断面図を載せたパネルを浮かせる（読み取り専用）．
 * 統計は見ている人の体重（ブラウザに保存してあれば）で計算し直す．
 */

import { LockIcon, PencilLineIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthDialog } from "@/components/planner/auth-dialog";
import { ElevationProfile } from "@/components/planner/elevation-profile";
import { StatsSummary } from "@/components/planner/stats-summary";
import { ThemeToggle } from "@/components/planner/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { buildSegments, computeStats } from "@/lib/energy-model";
import type { LatLng } from "@/lib/geo";
import { gradeStops } from "@/lib/grade";
import type { CloudRoute } from "@/lib/routes";
import { loadWeight, type PanelSize } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CommentSection } from "./comment-section";
import { RouteActions } from "./route-actions";

// 地図（MapLibre）は window と WebGL に依存するので，ブラウザでのみ読み込む
const RouteMap = dynamic(() => import("@/components/planner/route-map"), {
	ssr: false,
	loading: () => <div className="absolute inset-0 bg-muted" />,
});

/** 体重が分からないときに使う値 [kg]（トップページと同じ） */
const DEFAULT_WEIGHT = 60;
/** パネルの大きさ（共有ページでは変えられない） */
const PANEL: PanelSize = { width: 380, height: 50 };

type Props = {
	route: CloudRoute & {
		authorId: string;
		authorName: string;
		isOwner: boolean;
		likeCount: number;
		liked: boolean;
	};
};

/** 何もしない（地図のクリックや移動は共有ページでは使わない） */
function noop() {}

/** 共有されたルートを表示する */
export function SharedRoute({ route }: Props) {
	const [weight, setWeight] = useState(DEFAULT_WEIGHT);
	const [authOpen, setAuthOpen] = useState(false);
	// 断面図でカーソルを合わせている地点（地図にも点で示す）
	const [highlight, setHighlight] = useState<LatLng | null>(null);
	// ルートの線を勾配で色分けするための，段階の切り替わり
	const stops = useMemo(
		() => gradeStops(route.profile.points, route.profile.elevs),
		[route],
	);

	// 体重はブラウザにしかないので，表示後に読み込む
	useEffect(() => {
		const saved = loadWeight();
		if (saved !== null) setWeight(saved);
	}, []);

	// 標高は保存済みなので，見ている人の体重で計算し直すだけ
	const stats = useMemo(
		() =>
			computeStats(
				buildSegments(route.profile.points, route.profile.elevs),
				weight,
			),
		[route, weight],
	);

	return (
		<main
			className="relative h-dvh overflow-hidden"
			style={
				{
					"--panel-w": `${PANEL.width}px`,
					"--panel-h": `${PANEL.height}dvh`,
				} as React.CSSProperties
			}
		>
			<RouteMap
				waypoints={[]}
				route={route.coords}
				fitKey={null}
				panelSize={PANEL}
				place={null}
				drawing={false}
				onMapClick={noop}
				onCenterChange={noop}
				initialRoute={route.coords}
				gradeStops={stops}
				highlight={highlight}
			/>

			<aside className="absolute inset-x-0 bottom-0 z-20 flex h-(--panel-h) flex-col overflow-hidden rounded-t-2xl border bg-card/95 shadow-xl backdrop-blur md:inset-y-4 md:right-auto md:left-4 md:h-auto md:w-(--panel-w) md:rounded-2xl">
				<header className="relative shrink-0 overflow-hidden border-b">
					<div
						aria-hidden
						className="absolute inset-0 bg-seigaiha [mask-image:linear-gradient(to_left,black,transparent_75%)]"
					/>
					<div className="relative flex items-center gap-3 px-5 py-3">
						<Link
							href="/"
							className="flex min-w-0 flex-1 items-center gap-3"
							aria-label="ルート疲労度プランナーのトップへ"
						>
							<span
								aria-hidden
								className="flex size-9 shrink-0 -rotate-6 items-center justify-center rounded-md bg-shu font-bold font-serif text-white text-lg shadow-sm"
							>
								歩
							</span>
							<span className="truncate font-bold font-serif tracking-wider">
								ルート疲労度プランナー
							</span>
						</Link>
						<ThemeToggle />
					</div>
				</header>

				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-5 pb-5">
					<div>
						<h1 className="font-bold font-serif text-2xl leading-snug">
							{route.name}
						</h1>
						<p className="mt-1 text-muted-foreground text-xs">
							<Link href={`/u/${route.authorId}`} className="hover:underline">
								{route.authorName} さん
							</Link>
							のルート ・ {new Date(route.savedAt).toLocaleDateString("ja-JP")}
						</p>
					</div>

					{route.isOwner && !route.shared && (
						<p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground text-xs">
							<LockIcon className="size-4 shrink-0" />
							このルートは非公開です．あなただけが見られます．
						</p>
					)}

					<RouteActions
						routeId={route.id}
						initialLiked={route.liked}
						initialLikeCount={route.likeCount}
						isOwner={route.isOwner}
						onLoginRequired={() => setAuthOpen(true)}
					/>

					<StatsSummary stats={stats} />
					<ElevationProfile
						points={route.profile.points}
						elevs={route.profile.elevs}
						onHoverChange={setHighlight}
					/>
					<p className="text-[11px] text-muted-foreground">
						消費カロリーは体重 {weight} kg として計算しています．
					</p>

					<Link
						href="/"
						className={cn(buttonVariants({ size: "lg" }), "w-full")}
					>
						<PencilLineIcon />
						自分でもルートを作る
					</Link>

					<CommentSection
						routeId={route.id}
						onLoginRequired={() => setAuthOpen(true)}
					/>
				</div>
			</aside>
			<AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
		</main>
	);
}
