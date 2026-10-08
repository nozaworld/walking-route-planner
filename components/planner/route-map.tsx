"use client";

/**
 * 画面いっぱいに広げる地図（MapLibre GL）．
 * 国土地理院の淡色地図の上に，経由点・確定前の仮の線・確定したルート（勾配で色分け）・検索した場所・
 * 断面図でカーソルを合わせた地点を描き，
 * 地図のクリックと中心の位置を親に伝える．
 * MapLibre は GPU で描くので，拡大縮小は連続的に動き，読み込み中も粗いタイルで画面を埋め続ける
 * （Leaflet ではタイルの段階が切り替わるたびに画面が白っぽく抜けていた）．
 * window と WebGL に依存するため，next/dynamic の ssr: false で読み込むこと．
 */

import {
	Layer,
	Map as MapLibreMap,
	type MapRef,
	Marker,
	Source,
} from "@vis.gl/react-maplibre";
import type { FeatureCollection, LineString, Point } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
	BaseLayers,
	COMMON_MAP_PROPS,
	INITIAL_VIEW,
	useMapColors,
} from "@/components/map/map-base";
import type { LatLng } from "@/lib/geo";
import type { Place } from "@/lib/geocode";
import type { GradeLevel, GradeStop } from "@/lib/grade";
import type { PanelSize } from "@/lib/storage";

/** md（768px）以上ならパネルは左，未満なら下にある */
const DESKTOP_QUERY = "(min-width: 768px)";
/** パネルの外側の余白 [px]（パネルの左の 16px と，ルートとの間の 24px） */
const PANEL_GAP = 16 + 24;

/** 空の GeoJSON（データがないときもレイヤーの重なり順を保つために使う） */
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

type Props = {
	/** クリックで打った経由点 */
	waypoints: LatLng[];
	/** 確定したルート（未確定なら null） */
	route: LatLng[] | null;
	/** この値が変わるたびに，ルート全体が収まるよう表示範囲を合わせる */
	fitKey: string | null;
	/** 操作パネルの大きさ（ルートや検索した場所をパネルに隠さないための余白の計算に使う） */
	panelSize: PanelSize;
	/** 検索で選んだ場所．key が変わるたびにその場所へ移動する */
	place: (Place & { key: number }) | null;
	/** 経由点を打っている最中か（カーソルを十字にする） */
	drawing: boolean;
	onMapClick: (p: LatLng) => void;
	/** 地図を動かし終えるたびに中心の位置を伝える */
	onCenterChange: (center: LatLng) => void;
	/** 最初に表示する範囲をこのルートに合わせる（共有ページ用．省略すると名古屋付近） */
	initialRoute?: LatLng[];
	/** ルートの勾配の段階の切り替わり（ルートの線の色分けに使う） */
	gradeStops?: GradeStop[];
	/** 断面図でカーソルを合わせている地点（地図上に点で示す） */
	highlight?: LatLng | null;
};

/** 緯度経度の配列を GeoJSON の線にする */
function toLine(points: LatLng[]): FeatureCollection<LineString> {
	if (points.length < 2) return EMPTY as FeatureCollection<LineString>;
	return {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: {},
				geometry: {
					type: "LineString",
					coordinates: points.map((p) => [p.lng, p.lat]),
				},
			},
		],
	};
}

/** 経由点を GeoJSON の点の集まりにする．先頭（出発地点）には start: true を付ける */
function toPoints(points: LatLng[]): FeatureCollection<Point> {
	return {
		type: "FeatureCollection",
		features: points.map((p, i) => ({
			type: "Feature",
			properties: { start: i === 0 },
			geometry: { type: "Point", coordinates: [p.lng, p.lat] },
		})),
	};
}

/**
 * パネルに隠れる側（PC は左，スマホは下）に余白をとった padding を返す．
 * fitBounds や flyTo に渡すと，見えている範囲の中央に合わせてくれる．
 */
function visiblePadding(panelSize: PanelSize) {
	if (window.matchMedia(DESKTOP_QUERY).matches) {
		return {
			top: 80,
			bottom: 40,
			left: panelSize.width + PANEL_GAP,
			right: 60,
		};
	}
	const sheet = (window.innerHeight * panelSize.height) / 100;
	return { top: 80, bottom: sheet + 16, left: 24, right: 24 };
}

/** 点列を囲む範囲を [[西, 南], [東, 北]] の形で返す */
function boundsOf(points: LatLng[]): [[number, number], [number, number]] {
	const lngs = points.map((p) => p.lng);
	const lats = points.map((p) => p.lat);
	return [
		[Math.min(...lngs), Math.min(...lats)],
		[Math.max(...lngs), Math.max(...lats)],
	];
}

/** 地図本体．タイル・ルート・経由点・検索した場所を重ねて描く */
export default function RouteMap({
	waypoints,
	route,
	fitKey,
	panelSize,
	place,
	drawing,
	onMapClick,
	onCenterChange,
	initialRoute,
	gradeStops = [],
	highlight = null,
}: Props) {
	const mapRef = useRef<MapRef>(null);
	const { dark, colors } = useMapColors();

	// 勾配の段階を色にして，線の始点からの位置（line-progress）で切り替える
	const levelColor: Record<GradeLevel, string> = {
		gentle: colors.route,
		moderate: colors.moderate,
		steep: colors.steep,
	};
	const [first, ...rest] = gradeStops;
	const lineGradient = [
		"step",
		["line-progress"],
		levelColor[first?.level ?? "gentle"],
		...rest.flatMap((s) => [s.at, levelColor[s.level]]),
		// step は区切りが1つ以上必要なので，最後の色のまま終わる区切りを末尾に必ず足す
		1,
		levelColor[gradeStops.at(-1)?.level ?? "gentle"],
		// 段階の数で長さが変わる配列なので，式の型として扱うよう明示する
	] as ExpressionSpecification;

	// fitKey が変わったら，ルート全体が見えるよう表示範囲をなめらかに合わせる
	// biome-ignore lint/correctness/useExhaustiveDependencies: fitKey が変わったときだけ合わせ直す（route の参照の変化では動かさない）
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !route || route.length < 2) return;
		map.fitBounds(boundsOf(route), {
			padding: visiblePadding(panelSize),
			duration: 1000,
		});
	}, [fitKey]);

	// 検索で場所を選んだら，その場所へなめらかに移動する
	// biome-ignore lint/correctness/useExhaustiveDependencies: 場所を選び直したとき（key が変わったとき）だけ動かす
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !place) return;
		map.flyTo({
			center: [place.lng, place.lat],
			zoom: Math.max(map.getZoom(), 16),
			padding: visiblePadding(panelSize),
			duration: 1200,
		});
	}, [place?.key]);

	return (
		<MapLibreMap
			{...COMMON_MAP_PROPS}
			ref={mapRef}
			initialViewState={
				initialRoute && initialRoute.length >= 2
					? {
							bounds: boundsOf(initialRoute),
							fitBoundsOptions: { padding: visiblePadding(panelSize) },
						}
					: INITIAL_VIEW
			}
			cursor={drawing ? "crosshair" : "grab"}
			onLoad={(e) => {
				e.target.touchZoomRotate.disableRotation();
				const c = e.target.getCenter();
				onCenterChange({ lat: c.lat, lng: c.lng });
			}}
			onClick={(e) => onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
			onMoveEnd={(e) =>
				onCenterChange({
					lat: e.viewState.latitude,
					lng: e.viewState.longitude,
				})
			}
		>
			<BaseLayers dark={dark} background={colors.background} />

			<Source id="route" type="geojson" data={toLine(route ?? [])} lineMetrics>
				<Layer
					id="route-casing"
					type="line"
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": colors.casing,
						"line-width": 9,
						"line-opacity": 0.9,
					}}
				/>
				<Layer
					id="route-line"
					type="line"
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-gradient": lineGradient,
						"line-width": 5,
					}}
				/>
			</Source>

			{/* 確定前は打った点を破線で結ぶ */}
			<Source id="draft" type="geojson" data={toLine(route ? [] : waypoints)}>
				<Layer
					id="draft-line"
					type="line"
					layout={{ "line-cap": "round" }}
					paint={{
						"line-color": colors.route,
						"line-width": 3,
						"line-opacity": 0.7,
						"line-dasharray": [1, 2.5],
					}}
				/>
			</Source>

			<Source id="waypoints" type="geojson" data={toPoints(waypoints)}>
				<Layer
					id="waypoints"
					type="circle"
					paint={{
						"circle-radius": ["case", ["get", "start"], 8, 4],
						"circle-color": [
							"case",
							["get", "start"],
							colors.start,
							colors.route,
						],
						"circle-stroke-color": colors.casing,
						"circle-stroke-width": 2,
					}}
				/>
			</Source>

			{/* 断面図でカーソルを合わせている地点 */}
			<Source
				id="highlight"
				type="geojson"
				data={toPoints(highlight ? [highlight] : [])}
			>
				<Layer
					id="highlight"
					type="circle"
					paint={{
						"circle-radius": 7,
						"circle-color": colors.start,
						"circle-stroke-color": colors.casing,
						"circle-stroke-width": 3,
					}}
				/>
			</Source>

			{/* 検索した場所は，名前の付いた目印を HTML で重ねる（文字を和文フォントで描ける） */}
			{place && (
				<Marker longitude={place.lng} latitude={place.lat} anchor="bottom">
					<div
						className="flex flex-col items-center"
						data-testid="place-marker"
					>
						<span className="mb-1 whitespace-nowrap rounded-md border bg-card px-2 py-0.5 font-bold text-foreground text-xs shadow-sm">
							{place.name}
						</span>
						<span className="size-4 rounded-full border-[3px] border-shu bg-card shadow" />
					</div>
				</Marker>
			)}
		</MapLibreMap>
	);
}
