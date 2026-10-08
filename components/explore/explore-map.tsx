"use client";

/**
 * 「みんなのルート」の地図．
 * 一覧の公開ルートをまとめて線で描き，選んでいるルートを朱で太く強調する．
 * 線を押すとそのルートを選び，地図を動かし終えるたびに表示範囲を親に伝える（その範囲で検索し直す）．
 */

import {
	Layer,
	Map as MapLibreMap,
	type MapRef,
	Source,
} from "@vis.gl/react-maplibre";
import type { FeatureCollection, LineString } from "geojson";
import { useEffect, useRef } from "react";
import {
	BaseLayers,
	COMMON_MAP_PROPS,
	INITIAL_VIEW,
	useMapColors,
} from "@/components/map/map-base";
import type { PublicRouteSummary } from "@/lib/community";
import { boundsOf } from "@/lib/geo";

/** 地図の表示範囲（西・南・東・北） */
export type ViewBounds = { w: number; s: number; e: number; n: number };

type Props = {
	routes: PublicRouteSummary[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onBoundsChange: (bounds: ViewBounds) => void;
	/** 左に浮かせたパネルの幅 [px]（選んだルートへ移動するとき，パネルに隠れないようにする） */
	panelWidth: number;
};

/** 公開ルートの一覧を GeoJSON の線の集まりにする（id は選択の判定に使う） */
function toLines(routes: PublicRouteSummary[]): FeatureCollection<LineString> {
	return {
		type: "FeatureCollection",
		features: routes.map((r) => ({
			type: "Feature",
			properties: { id: r.id },
			geometry: {
				type: "LineString",
				coordinates: r.coords.map((p) => [p.lng, p.lat]),
			},
		})),
	};
}

/** 一覧のルートを描く地図 */
export default function ExploreMap({
	routes,
	selectedId,
	onSelect,
	onBoundsChange,
	panelWidth,
}: Props) {
	const mapRef = useRef<MapRef>(null);
	// 最初の表示範囲をもう伝えたか（ref のコールバックは描画のたびに呼ばれるので，一度だけにする）
	const reported = useRef(false);
	const { dark, colors } = useMapColors();

	/** 今の表示範囲を親に伝える */
	const reportBounds = () => {
		const b = mapRef.current?.getBounds();
		if (b) {
			onBoundsChange({
				w: b.getWest(),
				s: b.getSouth(),
				e: b.getEast(),
				n: b.getNorth(),
			});
		}
	};

	// 一覧から選んだルートが画面の外にあれば，そこへなめらかに移動する
	// biome-ignore lint/correctness/useExhaustiveDependencies: 選んだルートが変わったときだけ動かす
	useEffect(() => {
		const map = mapRef.current;
		const route = routes.find((r) => r.id === selectedId);
		if (!map || !route) return;
		const b = boundsOf(route.coords);
		const view = map.getBounds();
		const inView =
			view.contains([b.minLng, b.minLat]) &&
			view.contains([b.maxLng, b.maxLat]);
		if (inView) return;
		map.fitBounds(
			[
				[b.minLng, b.minLat],
				[b.maxLng, b.maxLat],
			],
			{
				padding: { top: 80, bottom: 40, left: panelWidth + 40, right: 60 },
				duration: 1000,
			},
		);
	}, [selectedId]);

	const lines = toLines(routes);
	return (
		<MapLibreMap
			{...COMMON_MAP_PROPS}
			// 地図ができたらすぐ表示範囲を伝える（load を待つと，タイルが読めないときに検索が始まらない）
			ref={(map) => {
				mapRef.current = map;
				if (map && !reported.current) {
					reported.current = true;
					reportBounds();
				}
			}}
			initialViewState={{ ...INITIAL_VIEW, zoom: 12 }}
			interactiveLayerIds={["public-routes"]}
			cursor="pointer"
			onMoveEnd={reportBounds}
			onClick={(e) => {
				const id = e.features?.[0]?.properties?.id;
				if (typeof id === "string") onSelect(id);
			}}
		>
			<BaseLayers dark={dark} background={colors.background} />
			<Source id="public-routes" type="geojson" data={lines}>
				<Layer
					id="public-routes-casing"
					type="line"
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": colors.casing,
						"line-width": 7,
						"line-opacity": 0.8,
					}}
				/>
				{/* 押しやすいよう，見た目より太い透明の線で当たり判定をとる */}
				<Layer
					id="public-routes"
					type="line"
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": colors.route,
						"line-width": 14,
						"line-opacity": 0,
					}}
				/>
				<Layer
					id="public-routes-line"
					type="line"
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": colors.route,
						"line-width": 4,
						"line-opacity": 0.75,
					}}
				/>
				{/* 選んでいるルートだけを朱で太く重ねる */}
				<Layer
					id="public-routes-selected"
					type="line"
					filter={["==", ["get", "id"], selectedId ?? ""]}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{ "line-color": colors.start, "line-width": 6 }}
				/>
			</Source>
		</MapLibreMap>
	);
}
