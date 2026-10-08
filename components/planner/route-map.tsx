"use client";

/**
 * 画面いっぱいに広げる地図（MapLibre GL）．
 * 国土地理院の淡色地図の上に，経由点・確定前の仮の線・確定したルート・検索した場所を描き，
 * 地図のクリックと中心の位置を親に伝える．
 * MapLibre は GPU で描くので，拡大縮小は連続的に動き，読み込み中も粗いタイルで画面を埋め続ける
 * （Leaflet ではタイルの段階が切り替わるたびに画面が白っぽく抜けていた）．
 * window と WebGL に依存するため，next/dynamic の ssr: false で読み込むこと．
 */

import "maplibre-gl/dist/maplibre-gl.css";
import {
	AttributionControl,
	Layer,
	Map as MapLibreMap,
	type MapRef,
	Marker,
	NavigationControl,
	Source,
} from "@vis.gl/react-maplibre";
import type { FeatureCollection, LineString, Point } from "geojson";
import { type RasterLayerSpecification, setWorkerUrl } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo";
import type { Place } from "@/lib/geocode";
import type { PanelSize } from "@/lib/storage";

// MapLibre は地図データの処理を Web Worker で行う．Worker のファイルは本体と同じ場所にある前提で
// 探されるが，Next.js がまとめ直すと場所が変わって読み込めないため，置き場所を明示する
setWorkerUrl(
	new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

/** 初期表示（名古屋付近） */
const INITIAL_VIEW = { longitude: 136.91, latitude: 35.18, zoom: 13 };

/** 国土地理院の淡色地図（画像タイル） */
const PALE_TILES = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";

/** 国土地理院・ORS（OSM のデータを使う）の利用条件に従ったクレジット表記 */
const ATTRIBUTION = [
	'地図・標高: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
	'経路: <a href="https://openrouteservice.org/" target="_blank">openrouteservice</a> / &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
];

/**
 * 明るい／暗いモードの色．MapLibre は CSS 変数を読めないので，globals.css と同じ値を持つ．
 * route は藍，start は朱，casing は線の縁取り，background はタイルの読み込み前に見える地の色．
 */
const PALETTE = {
	light: {
		route: "#1f3a5f",
		casing: "#ffffff",
		start: "#c2462d",
		background: "#f3eee3",
	},
	dark: {
		route: "#9dbcf0",
		casing: "#0d0f11",
		start: "#e0674d",
		background: "#151719",
	},
} as const;

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
}: Props) {
	const mapRef = useRef<MapRef>(null);
	const { resolvedTheme } = useTheme();
	const dark = resolvedTheme === "dark";
	const colors = dark ? PALETTE.dark : PALETTE.light;

	// fitKey が変わったら，ルート全体が見えるよう表示範囲をなめらかに合わせる
	// biome-ignore lint/correctness/useExhaustiveDependencies: fitKey が変わったときだけ合わせ直す（route の参照の変化では動かさない）
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !route || route.length < 2) return;
		const lngs = route.map((p) => p.lng);
		const lats = route.map((p) => p.lat);
		map.fitBounds(
			[
				[Math.min(...lngs), Math.min(...lats)],
				[Math.max(...lngs), Math.max(...lats)],
			],
			{ padding: visiblePadding(panelSize), duration: 1000 },
		);
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

	// 暗いモードでは淡色地図の明暗を反転し，色相を戻して彩度を落とす
	const tilePaint: RasterLayerSpecification["paint"] = dark
		? {
				"raster-brightness-min": 0.92,
				"raster-brightness-max": 0.06,
				"raster-hue-rotate": 180,
				"raster-saturation": -0.5,
				"raster-contrast": -0.1,
			}
		: {};

	return (
		<MapLibreMap
			ref={mapRef}
			initialViewState={INITIAL_VIEW}
			mapStyle={{ version: 8, sources: {}, layers: [] }}
			style={{ position: "absolute", inset: 0 }}
			maxZoom={19}
			// ルート作りに回転や傾きは要らないので止める
			dragRotate={false}
			pitchWithRotate={false}
			touchPitch={false}
			attributionControl={false}
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
			{/* 下から順に重なる：地の色 → 地図タイル → ルートの縁取り → ルート → 仮の線 → 経由点 */}
			<Layer
				id="background"
				type="background"
				paint={{ "background-color": colors.background }}
			/>
			<Source
				id="pale"
				type="raster"
				tiles={[PALE_TILES]}
				tileSize={256}
				maxzoom={18}
			>
				<Layer id="pale" type="raster" paint={tilePaint} />
			</Source>

			<Source id="route" type="geojson" data={toLine(route ?? [])}>
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
					paint={{ "line-color": colors.route, "line-width": 5 }}
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

			{/* 左上はパネルと重なるので，ズームボタンは右上に置く */}
			<NavigationControl position="top-right" showCompass={false} />
			<AttributionControl
				position="bottom-right"
				compact={false}
				customAttribution={ATTRIBUTION}
			/>
		</MapLibreMap>
	);
}
