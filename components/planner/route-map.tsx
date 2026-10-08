"use client";

/**
 * Leaflet（react-leaflet）の地図．
 * 経由点，確定前の仮の線，確定したルートを描き，地図のクリックを親に伝える．
 * Leaflet は window に依存するため，next/dynamic の ssr: false で読み込むこと．
 */

import "leaflet/dist/leaflet.css";
import { latLngBounds } from "leaflet";
import { useEffect } from "react";
import {
	CircleMarker,
	MapContainer,
	Polyline,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import type { LatLng } from "@/lib/geo";

/** 初期表示の中心（名古屋付近） */
const INITIAL_CENTER: [number, number] = [35.18, 136.91];
const ROUTE_COLOR = "#2766c9";
const START_COLOR = "#3f5d4c";

/** OSM・ORS・国土地理院の利用条件に従ったクレジット表記 */
const ATTRIBUTION = [
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	'経路: <a href="https://openrouteservice.org/">openrouteservice</a>',
	'標高: <a href="https://maps.gsi.go.jp/development/elevation_s.html">国土地理院</a>',
].join(" | ");

type Props = {
	/** クリックで打った経由点 */
	waypoints: LatLng[];
	/** 確定したルート（未確定なら null） */
	route: LatLng[] | null;
	/** この値が変わるたびに，ルート全体が収まるよう表示範囲を合わせる */
	fitKey: string | null;
	onMapClick: (p: LatLng) => void;
};

/** 地図本体．経由点・仮の線・確定ルートを重ねて描く */
export default function RouteMap({
	waypoints,
	route,
	fitKey,
	onMapClick,
}: Props) {
	return (
		<MapContainer
			center={INITIAL_CENTER}
			zoom={12}
			className="absolute inset-0 z-0"
		>
			<TileLayer
				url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
				attribution={ATTRIBUTION}
				maxZoom={19}
			/>
			<ClickHandler onMapClick={onMapClick} />
			<FitToRoute route={route} fitKey={fitKey} />
			{/* 確定前は打った点を破線で結ぶ */}
			{!route && waypoints.length > 1 && (
				<Polyline
					positions={waypoints}
					pathOptions={{
						color: ROUTE_COLOR,
						weight: 4,
						opacity: 0.6,
						dashArray: "6 6",
					}}
				/>
			)}
			{route && (
				<Polyline
					positions={route}
					pathOptions={{ color: ROUTE_COLOR, weight: 5 }}
				/>
			)}
			{waypoints.map((p, i) => (
				<CircleMarker
					// 経由点は追加か全消去しかしないので，添字で一意になる
					// biome-ignore lint/suspicious/noArrayIndexKey: 上記の理由
					key={i}
					center={p}
					radius={i === 0 ? 7 : 4}
					pathOptions={{
						color: i === 0 ? "#27392f" : ROUTE_COLOR,
						fillColor: i === 0 ? START_COLOR : ROUTE_COLOR,
						fillOpacity: 1,
						weight: i === 0 ? 2 : 1,
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

/** fitKey が変わったときに，ルート全体が見えるよう表示範囲を合わせる */
function FitToRoute({
	route,
	fitKey,
}: {
	route: LatLng[] | null;
	fitKey: string | null;
}) {
	const map = useMap();
	// biome-ignore lint/correctness/useExhaustiveDependencies: fitKey が変わったときだけ合わせ直す（route の参照の変化では動かさない）
	useEffect(() => {
		if (!route || route.length < 2) return;
		// 下端は地図に重ねた標高断面図（約150px）の分だけ余白を多くとる
		map.fitBounds(latLngBounds(route), {
			paddingTopLeft: [30, 30],
			paddingBottomRight: [30, 170],
		});
	}, [fitKey, map]);
	return null;
}
