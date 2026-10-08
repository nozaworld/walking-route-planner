"use client";

/**
 * 画面いっぱいに広げる Leaflet（react-leaflet）の地図．
 * 国土地理院の淡色地図の上に，経由点・確定前の仮の線・確定したルート・検索した場所を描き，
 * 地図のクリックと中心の位置を親に伝える．
 * Leaflet は window に依存するため，next/dynamic の ssr: false で読み込むこと．
 */

import "leaflet/dist/leaflet.css";
import { latLngBounds, type PointTuple } from "leaflet";
import { useEffect } from "react";
import {
	CircleMarker,
	MapContainer,
	Polyline,
	TileLayer,
	Tooltip,
	useMap,
	useMapEvents,
	ZoomControl,
} from "react-leaflet";
import type { LatLng } from "@/lib/geo";
import type { Place } from "@/lib/geocode";
import type { PanelSize } from "@/lib/storage";

/** 初期表示の中心（名古屋付近） */
const INITIAL_CENTER: PointTuple = [35.18, 136.91];

/*
 * 線と点の色は globals.css の .route-* クラスで CSS 変数から指定する
 * （暗いモードで色を変えるため．Leaflet の color 指定は CSS で上書きされる）．
 */

/** 国土地理院・ORS（OSM のデータを使う）の利用条件に従ったクレジット表記 */
const ATTRIBUTION = [
	'地図・標高: <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
	'経路: <a href="https://openrouteservice.org/">openrouteservice</a> / &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
].join(" | ");

/** md（768px）以上ならパネルは左，未満なら下にある */
const DESKTOP_QUERY = "(min-width: 768px)";

/** パネルの外側の余白 [px]（パネルの左の 16px と，ルートとの間の 24px） */
const PANEL_GAP = 16 + 24;

type Props = {
	/** クリックで打った経由点 */
	waypoints: LatLng[];
	/** 確定したルート（未確定なら null） */
	route: LatLng[] | null;
	/** この値が変わるたびに，ルート全体が収まるよう表示範囲を合わせる */
	fitKey: string | null;
	/** 操作パネルの大きさ（ルートをパネルに隠さないための余白の計算に使う） */
	panelSize: PanelSize;
	/** 検索で選んだ場所．key が変わるたびにその場所へ移動する */
	place: (Place & { key: number }) | null;
	onMapClick: (p: LatLng) => void;
	/** 地図を動かし終えるたびに中心の位置を伝える */
	onCenterChange: (center: LatLng) => void;
};

/** 地図本体．経由点・仮の線・確定ルートを重ねて描く */
export default function RouteMap({
	waypoints,
	route,
	fitKey,
	panelSize,
	place,
	onMapClick,
	onCenterChange,
}: Props) {
	return (
		<MapContainer
			center={INITIAL_CENTER}
			zoom={13}
			zoomControl={false}
			className="absolute inset-0 z-0 bg-background"
		>
			<TileLayer
				url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
				attribution={ATTRIBUTION}
				maxZoom={18}
				// 暗いモードでは globals.css でタイルの色を反転させる
				className="map-tiles"
			/>
			{/* 左上はパネルと重なるので，ズームボタンは右上に置く */}
			<ZoomControl position="topright" />
			<ClickHandler onMapClick={onMapClick} />
			<CenterReporter onCenterChange={onCenterChange} />
			<FlyToPlace place={place} panelSize={panelSize} />
			{place && (
				<CircleMarker
					center={place}
					radius={9}
					pathOptions={{ className: "place-marker", weight: 3, fillOpacity: 1 }}
				>
					<Tooltip permanent direction="top" offset={[0, -10]}>
						{place.name}
					</Tooltip>
				</CircleMarker>
			)}
			<FitToRoute route={route} fitKey={fitKey} panelSize={panelSize} />
			{/* 確定前は打った点を破線で結ぶ */}
			{!route && waypoints.length > 1 && (
				<Polyline
					positions={waypoints}
					pathOptions={{
						className: "route-line",
						weight: 3,
						opacity: 0.7,
						dashArray: "4 8",
					}}
				/>
			)}
			{route && (
				<>
					{/* 白い縁取りを下に敷いて，どの地色の上でも線を読みやすくする */}
					<Polyline
						positions={route}
						pathOptions={{ className: "route-casing", weight: 9, opacity: 0.9 }}
					/>
					<Polyline
						positions={route}
						pathOptions={{ className: "route-line", weight: 5 }}
					/>
				</>
			)}
			{waypoints.map((p, i) => (
				<CircleMarker
					// 経由点は追加か末尾の削除しかしないので，添字で一意になる
					// biome-ignore lint/suspicious/noArrayIndexKey: 上記の理由
					key={i}
					center={p}
					radius={i === 0 ? 8 : 4}
					pathOptions={{
						className: i === 0 ? "route-start" : "route-point",
						weight: 2,
						fillOpacity: 1,
					}}
				/>
			))}
		</MapContainer>
	);
}

/** 地図のクリックを緯度経度にして親に渡す（描画はしない） */
function ClickHandler({ onMapClick }: { onMapClick: (p: LatLng) => void }) {
	useMapEvents({
		click: (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
	});
	return null;
}

/**
 * fitKey が変わったときに，ルート全体が見えるよう表示範囲を合わせる．
 * パネルに隠れる側（PC は左，スマホは下）には余白を多くとる．
 */
function FitToRoute({
	route,
	fitKey,
	panelSize,
}: {
	route: LatLng[] | null;
	fitKey: string | null;
	panelSize: PanelSize;
}) {
	const map = useMap();
	// biome-ignore lint/correctness/useExhaustiveDependencies: fitKey が変わったときだけ合わせ直す（route の参照の変化では動かさない）
	useEffect(() => {
		if (!route || route.length < 2) return;
		const desktop = window.matchMedia(DESKTOP_QUERY).matches;
		const sheetHeight = (window.innerHeight * panelSize.height) / 100;
		map.fitBounds(latLngBounds(route), {
			paddingTopLeft: desktop ? [panelSize.width + PANEL_GAP, 40] : [24, 24],
			paddingBottomRight: desktop ? [60, 40] : [24, sheetHeight + 16],
		});
	}, [fitKey, map]);
	return null;
}

/** 表示範囲が変わるたびに（と最初に一度）地図の中心を親に伝える */
function CenterReporter({
	onCenterChange,
}: {
	onCenterChange: (center: LatLng) => void;
}) {
	const map = useMap();
	useMapEvents({
		moveend: () => {
			const c = map.getCenter();
			onCenterChange({ lat: c.lat, lng: c.lng });
		},
	});
	// biome-ignore lint/correctness/useExhaustiveDependencies: 表示した直後に一度だけ伝える
	useEffect(() => {
		const c = map.getCenter();
		onCenterChange({ lat: c.lat, lng: c.lng });
	}, [map]);
	return null;
}

/**
 * 検索で場所を選んだら，その場所へなめらかに移動する．
 * PC ではパネルに隠れないよう，見えている範囲の中央に来るようずらす．
 */
function FlyToPlace({
	place,
	panelSize,
}: {
	place: (Place & { key: number }) | null;
	panelSize: PanelSize;
}) {
	const map = useMap();
	// biome-ignore lint/correctness/useExhaustiveDependencies: 場所を選び直したとき（key が変わったとき）だけ動かす
	useEffect(() => {
		if (!place) return;
		const zoom = Math.max(map.getZoom(), 16);
		const desktop = window.matchMedia(DESKTOP_QUERY).matches;
		// パネルの分だけ中心をずらす（PC は左，スマホは下にパネルがある）
		const offset = desktop
			? [-(panelSize.width + PANEL_GAP) / 2, 0]
			: [0, (window.innerHeight * panelSize.height) / 100 / 2];
		const target = map.unproject(
			map.project(place, zoom).add(offset as PointTuple),
			zoom,
		);
		map.flyTo(target, zoom, { duration: 1.2 });
	}, [place?.key, map]);
	return null;
}
