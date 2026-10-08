/**
 * 標高断面図．
 * 横軸に始点からの距離，縦軸に標高をとった SVG を地図の下端に重ねて表示する．
 */

import { cumulativeDistances, type LatLng } from "@/lib/geo";

/** SVG の座標系の大きさ（表示時は横幅いっぱいに伸ばす） */
const W = 600;
const H = 90;
/** 線が上下の端に張り付かないための余白 */
const PAD_T = 6;
const PAD_B = 14;
const COLOR = "#2766c9";

type Props = {
	points: LatLng[];
	/** points と同じ長さの標高 [m] */
	elevs: number[];
};

/**
 * 点列と標高から断面図を描く．2点未満なら何も描かない．
 * 地図右下のクレジット表記を隠さないよう，下端から少し浮かせて置く（bottom-6）．
 */
export function ElevationProfile({ points, elevs }: Props) {
	if (points.length < 2) return null;

	const cum = cumulativeDistances(points);
	const total = cum[cum.length - 1];
	const minE = Math.min(...elevs);
	const maxE = Math.max(...elevs);
	// 平坦なルートでも 0 で割らないよう，縦の幅は最低 1m とする
	const span = Math.max(maxE - minE, 1);
	const x = (d: number) => (total > 0 ? (d / total) * W : 0);
	const y = (e: number) =>
		PAD_T + (H - PAD_T - PAD_B) * (1 - (e - minE) / span);

	const line = cum
		.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d)} ${y(elevs[i])}`)
		.join(" ");
	const area = `${line} L ${x(total)} ${H - PAD_B} L 0 ${H - PAD_B} Z`;

	return (
		<div className="absolute right-2.5 bottom-6 left-2.5 z-[500] rounded-md border bg-card/95 px-2.5 pt-1.5 pb-1 shadow-sm">
			<div className="flex justify-between text-[11px] text-muted-foreground">
				<span>標高断面図</span>
				<span>{(total / 1000).toFixed(2)} km</span>
			</div>
			<svg
				width="100%"
				height={H}
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={`標高断面図：最低 ${Math.round(minE)}m，最高 ${Math.round(maxE)}m`}
			>
				<path d={area} fill={COLOR} opacity={0.15} />
				<path
					d={line}
					fill="none"
					stroke={COLOR}
					strokeWidth={2}
					// 横に引き伸ばしても線の太さを保つ
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			<div className="flex justify-between text-[10px] text-muted-foreground">
				<span>最低 {Math.round(minE)} m</span>
				<span>最高 {Math.round(maxE)} m</span>
			</div>
		</div>
	);
}
