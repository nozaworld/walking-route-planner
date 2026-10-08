"use client";

/**
 * 地図（MapLibre GL）の共通部分．
 * 国土地理院の淡色地図・暗いモードの配色・ズームボタン・クレジット表記と，
 * どの地図でも同じにしたい設定（回転を止めるなど）をまとめ，トップページと「みんなのルート」で使い回す．
 * window と WebGL に依存するため，使う側は next/dynamic の ssr: false で読み込むこと．
 */

import "maplibre-gl/dist/maplibre-gl.css";
import {
	AttributionControl,
	Layer,
	NavigationControl,
	Source,
} from "@vis.gl/react-maplibre";
import { type RasterLayerSpecification, setWorkerUrl } from "maplibre-gl";
import { useTheme } from "next-themes";

// MapLibre は地図データの処理を Web Worker で行う．Worker のファイルは本体と同じ場所にある前提で
// 探されるが，Next.js がまとめ直すと場所が変わって読み込めないため，置き場所を明示する
setWorkerUrl(
	new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

/** 初期表示（名古屋付近） */
export const INITIAL_VIEW = { longitude: 136.91, latitude: 35.18, zoom: 13 };

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
 * moderate・steep は勾配の色分け（やや急は金茶，急は朱）．
 */
export const PALETTE = {
	light: {
		route: "#1f3a5f",
		moderate: "#b8862f",
		steep: "#c2462d",
		casing: "#ffffff",
		start: "#c2462d",
		background: "#f3eee3",
	},
	dark: {
		route: "#9dbcf0",
		moderate: "#d8aa55",
		steep: "#e0674d",
		casing: "#0d0f11",
		start: "#e0674d",
		background: "#151719",
	},
} as const;

/** どの地図でも同じにする MapLibre の設定（ルート作りに回転や傾きは要らないので止める） */
export const COMMON_MAP_PROPS = {
	mapStyle: { version: 8 as const, sources: {}, layers: [] },
	style: { position: "absolute", inset: 0 } as const,
	maxZoom: 19,
	dragRotate: false,
	pitchWithRotate: false,
	touchPitch: false,
	attributionControl: false as const,
};

/** 今の表示モードと，それに合った地図の色を返す */
export function useMapColors() {
	const { resolvedTheme } = useTheme();
	const dark = resolvedTheme === "dark";
	return { dark, colors: dark ? PALETTE.dark : PALETTE.light };
}

/** 地の色・淡色地図・ズームボタン・クレジット表記（地図の一番下に重ねる） */
export function BaseLayers({
	dark,
	background,
}: {
	dark: boolean;
	background: string;
}) {
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
		<>
			<Layer
				id="background"
				type="background"
				paint={{ "background-color": background }}
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
			{/* 左上はパネルと重なるので，ズームボタンは右上に置く */}
			<NavigationControl position="top-right" showCompass={false} />
			<AttributionControl
				position="bottom-right"
				compact={false}
				customAttribution={ATTRIBUTION}
			/>
		</>
	);
}
