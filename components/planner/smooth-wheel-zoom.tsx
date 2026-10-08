"use client";

/**
 * マウスホイールやトラックパッドでの拡大縮小を滑らかにする．
 * Leaflet 標準のホイールズームは1段ずつ跳ぶので，代わりに
 * 「目標の倍率」へ毎フレーム少しずつ近づける（イージング）方式で動かす．
 *
 * 動かしている間は Leaflet の flyTo と同じく「移動中」として扱い，
 * 地図タイルは古い段階のものを拡大・縮小して見せ続ける．止まってから新しいタイルを読み込む．
 * （毎フレーム setView すると，タイルの段階が変わるたびに古いタイルが消えて白く抜けるため）
 *
 * 使うときは MapContainer の scrollWheelZoom を false，zoomSnap を 0 にすること．
 */

import type { LatLng, Map as LeafletMap, Point } from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** ホイールを何 px 回すと1段拡大縮小するか（大きいほどゆっくり） */
const PX_PER_LEVEL = 140;
/** トラックパッドのピンチ（ctrlKey 付きの wheel）は値が小さいので感度を上げる */
const PX_PER_LEVEL_PINCH = 40;
/** 1フレームで目標との差をどれだけ詰めるか（0〜1．大きいほど速く追いつく） */
const EASE = 0.22;

/**
 * Leaflet が flyTo の中で使っている内部メソッド．
 * 公開 API では「移動中のまま倍率を変える」ことができないため，同じものを使う．
 */
type MapInternals = {
	_moveStart(zoomChanged: boolean, noMoveStart: boolean): void;
	_move(center: LatLng, zoom: number, data?: { flyTo?: boolean }): void;
	_moveEnd(zoomChanged: boolean): void;
};

/** 値を min〜max に収める */
function clamp(v: number, min: number, max: number): number {
	return Math.min(Math.max(v, min), max);
}

/**
 * anchor（画面上の点）の位置を動かさずに倍率を zoom にしたときの，地図の中心を求める．
 * Leaflet の setZoomAround と同じ計算．
 */
function centerForZoomAround(
	map: LeafletMap,
	anchor: Point,
	zoom: number,
): LatLng {
	const scale = map.getZoomScale(zoom);
	const viewHalf = map.getSize().divideBy(2);
	const offset = anchor.subtract(viewHalf).multiplyBy(1 - 1 / scale);
	return map.containerPointToLatLng(viewHalf.add(offset));
}

/** 地図の中に置くと，ホイールズームを滑らかなものに置き換える（描画はしない） */
export function SmoothWheelZoom() {
	const map = useMap();

	useEffect(() => {
		const internals = map as unknown as MapInternals;
		const container = map.getContainer();
		// 目標の倍率と，その基準点（カーソルの位置）．アニメーション中は frame が 0 以外
		let target = map.getZoom();
		let anchor: Point | null = null;
		let frame = 0;

		/** 1フレーム分，目標の倍率へ近づける．追いついたら移動を終える */
		const step = () => {
			if (!anchor) return;
			const current = map.getZoom();
			const diff = target - current;
			const done = Math.abs(diff) < 0.01;
			const next = done ? target : current + diff * EASE;
			// flyTo: true を付けると，地図タイルは古い段階のまま拡大・縮小される
			internals._move(centerForZoomAround(map, anchor, next), next, {
				flyTo: true,
			});
			if (done) {
				frame = 0;
				// ここで初めて新しい段階のタイルを読み込む
				internals._moveEnd(true);
				return;
			}
			frame = requestAnimationFrame(step);
		};

		/** ホイールの回転量を目標の倍率に足し込み，アニメーションを始める */
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			if (!frame) {
				// 止まっているときは，今の倍率（ボタンやピンチで変わっているかも）から始める
				map.stop();
				target = map.getZoom();
			}
			// deltaMode が行単位・ページ単位のブラウザ（Firefox など）は px に直す
			const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
			const perLevel = e.ctrlKey ? PX_PER_LEVEL_PINCH : PX_PER_LEVEL;
			target = clamp(
				target - (e.deltaY * unit) / perLevel,
				map.getMinZoom(),
				map.getMaxZoom(),
			);
			anchor = map.mouseEventToContainerPoint(e);
			if (!frame) {
				internals._moveStart(true, false);
				frame = requestAnimationFrame(step);
			}
		};

		container.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			container.removeEventListener("wheel", onWheel);
			cancelAnimationFrame(frame);
		};
	}, [map]);

	return null;
}
