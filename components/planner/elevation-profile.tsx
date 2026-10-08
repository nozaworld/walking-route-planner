"use client";

/**
 * 標高断面図．
 * 横軸に始点からの距離，縦軸に標高をとった SVG を，操作パネルの中に表示する．
 * カーソル（スマホでは指）を合わせた地点の距離と標高を見出しに出す．
 */

import { useId, useState } from "react";
import { cumulativeDistances, type LatLng } from "@/lib/geo";

/** SVG の座標系の大きさ（表示時は横幅いっぱいに伸ばす） */
const W = 600;
const H = 90;
/** 線が上下の端に張り付かないための余白 */
const PAD_T = 6;
const PAD_B = 14;
/** 線の色は地図のルートと同じ（globals.css の --route） */
const COLOR = "var(--route)";

type Props = {
	points: LatLng[];
	/** points と同じ長さの標高 [m] */
	elevs: number[];
};

/** 点列と標高から断面図を描く．2点未満なら何も描かない */
export function ElevationProfile({ points, elevs }: Props) {
	// カーソルに最も近い点の添字（合わせていなければ null）
	const [hover, setHover] = useState<number | null>(null);
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
					<path
						d={line}
						fill="none"
						style={{ stroke: COLOR }}
						strokeWidth={2}
						// 横に引き伸ばしても線の太さを保つ
						vectorEffect="non-scaling-stroke"
					/>
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
		</div>
	);
}
