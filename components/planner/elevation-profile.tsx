"use client";

/**
 * 標高断面図．
 * 横軸に始点からの距離，縦軸に標高をとった SVG を，操作パネルの中に表示する．
 * 線は勾配の段階（lib/grade.ts）で色分けし，凡例を付ける．
 * カーソル（スマホでは指）を合わせた地点の距離と標高を見出しに出し，その地点を親に伝える（地図にも示す）．
 */

import { useId, useState } from "react";
import { cumulativeDistances, type LatLng } from "@/lib/geo";
import { GRADE_LABELS, type GradeLevel, gradeLevel } from "@/lib/grade";

/** SVG の座標系の大きさ（表示時は横幅いっぱいに伸ばす） */
const W = 600;
const H = 90;
/** 線が上下の端に張り付かないための余白 */
const PAD_T = 6;
const PAD_B = 14;
/** 塗りの色は地図のルートと同じ（globals.css の --route） */
const COLOR = "var(--route)";
/** 勾配の段階ごとの線の色（地図の PALETTE と同じ色を CSS 変数で指す） */
const LEVEL_COLOR: Record<GradeLevel, string> = {
	gentle: "var(--route)",
	moderate: "var(--grade-moderate)",
	steep: "var(--shu)",
};

type Props = {
	points: LatLng[];
	/** points と同じ長さの標高 [m] */
	elevs: number[];
	/** カーソルを合わせた地点が変わったとき（離れたら null）に呼ばれる */
	onHoverChange?: (point: LatLng | null) => void;
};

/** 点列と標高から断面図を描く．2点未満なら何も描かない */
export function ElevationProfile({ points, elevs, onHoverChange }: Props) {
	// カーソルに最も近い点の添字（合わせていなければ null）
	const [hover, setHoverIndex] = useState<number | null>(null);
	/** 合わせている点を変え，親にもその地点を伝える */
	const setHover = (i: number | null) => {
		setHoverIndex(i);
		onHoverChange?.(i === null ? null : points[i]);
	};
	// 同じ画面に複数置いても塗りのグラデーションの id がぶつからないようにする
	const gradientId = useId();

	if (points.length < 2) return null;

	const cum = cumulativeDistances(points);
	const total = cum[cum.length - 1];
	const minE = Math.min(...elevs);
	const maxE = Math.max(...elevs);
	// 平坦なルートでも 0 で割らないよう，縦の幅は最低 1m とする
	const span = Math.max(maxE - minE, 1);
	// 累積距離 [m] → SVG の横座標
	const x = (d: number) => (total > 0 ? (d / total) * W : 0);
	// 標高 [m] → SVG の縦座標（上が高い）
	const y = (e: number) =>
		PAD_T + (H - PAD_T - PAD_B) * (1 - (e - minE) / span);

	const line = cum
		.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d)} ${y(elevs[i])}`)
		.join(" ");
	const area = `${line} L ${x(total)} ${H - PAD_B} L 0 ${H - PAD_B} Z`;
	// 区間ごとに勾配の段階を決め，線を色分けして描く
	const segments = cum.slice(0, -1).map((d, i) => {
		const dist = cum[i + 1] - d;
		const grade = dist > 0 ? (elevs[i + 1] - elevs[i]) / dist : 0;
		return {
			d: `M ${x(d)} ${y(elevs[i])} L ${x(cum[i + 1])} ${y(elevs[i + 1])}`,
			level: gradeLevel(grade),
		};
	});

	/** カーソルの横位置から，最も近い点を探して hover にする */
	function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		const ratio = Math.min(
			Math.max((e.clientX - rect.left) / rect.width, 0),
			1,
		);
		const target = ratio * total;
		let nearest = 0;
		for (let i = 1; i < cum.length; i++) {
			if (Math.abs(cum[i] - target) < Math.abs(cum[nearest] - target)) {
				nearest = i;
			}
		}
		setHover(nearest);
	}

	// 目印は SVG ではなく HTML で重ねる（SVG は横に引き伸ばすので円が歪むため）
	const marker =
		hover === null
			? null
			: {
					left: `${(x(cum[hover]) / W) * 100}%`,
					top: `${(y(elevs[hover]) / H) * 100}%`,
				};

	return (
		<div className="rounded-lg border bg-card px-3 pt-2 pb-1.5">
			<div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
				{hover === null ? (
					<>
						<span>標高断面図</span>
						<span>{(total / 1000).toFixed(2)} km</span>
					</>
				) : (
					<>
						<span>始点から {(cum[hover] / 1000).toFixed(2)} km</span>
						<span className="font-bold text-foreground">
							標高 {Math.round(elevs[hover])} m
						</span>
					</>
				)}
			</div>
			<div
				className="relative touch-pan-y"
				onPointerMove={handlePointerMove}
				onPointerDown={handlePointerMove}
				onPointerLeave={() => setHover(null)}
			>
				<svg
					width="100%"
					height={H}
					viewBox={`0 0 ${W} ${H}`}
					preserveAspectRatio="none"
					role="img"
					aria-label={`標高断面図：最低 ${Math.round(minE)}m，最高 ${Math.round(maxE)}m`}
					className="block"
				>
					{/* 塗りは上ほど濃くする．CSS 変数は SVG の属性では効かないので style で指定する */}
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="0%"
								style={{ stopColor: COLOR, stopOpacity: 0.4 }}
							/>
							<stop
								offset="100%"
								style={{ stopColor: COLOR, stopOpacity: 0.05 }}
							/>
						</linearGradient>
					</defs>
					<path d={area} fill={`url(#${gradientId})`} />
					{segments.map((seg, i) => (
						<path
							// 区間は並び順で決まり入れ替わらないので，添字で一意になる
							// biome-ignore lint/suspicious/noArrayIndexKey: 上記の理由
							key={i}
							d={seg.d}
							fill="none"
							style={{ stroke: LEVEL_COLOR[seg.level] }}
							strokeWidth={2.5}
							strokeLinecap="round"
							// 横に引き伸ばしても線の太さを保つ
							vectorEffect="non-scaling-stroke"
						/>
					))}
				</svg>
				{marker && (
					<>
						<div
							aria-hidden
							className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/30"
							style={{ left: marker.left }}
						/>
						<div
							aria-hidden
							className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-shu"
							style={marker}
						/>
					</>
				)}
			</div>
			<div className="flex justify-between text-[10px] text-muted-foreground">
				<span>最低 {Math.round(minE)} m</span>
				<span>最高 {Math.round(maxE)} m</span>
			</div>
			{/* 勾配の凡例 */}
			<div className="mt-1 flex justify-end gap-3 text-[10px] text-muted-foreground">
				{(Object.keys(GRADE_LABELS) as GradeLevel[]).map((level) => (
					<span key={level} className="flex items-center gap-1">
						<span
							aria-hidden
							className="h-1 w-3 rounded-full"
							style={{ backgroundColor: LEVEL_COLOR[level] }}
						/>
						{GRADE_LABELS[level]}
					</span>
				))}
			</div>
		</div>
	);
}
