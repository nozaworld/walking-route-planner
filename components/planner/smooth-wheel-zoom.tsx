"use client";

/**
 * マウスホイールやトラックパッドでの拡大縮小を滑らかにする．
 * Leaflet 標準のホイールズームは1段ずつ跳ぶので，代わりに
 * 「目標の倍率」へ毎フレーム少しずつ近づける（イージング）方式で動かす．
 * 使うときは MapContainer の scrollWheelZoom を false，zoomSnap を 0 にすること．
 */

import type { Point } from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** ホイールを何 px 回すと1段拡大縮小するか（大きいほどゆっくり） */
const PX_PER_LEVEL = 140;
/** トラックパッドのピンチ（ctrlKey 付きの wheel）は値が小さいので感度を上げる */
const PX_PER_LEVEL_PINCH = 40;
/** 1フレームで目標との差をどれだけ詰めるか（0〜1．大きいほど速く追いつく） */
const EASE = 0.22;

/** 値を min〜max に収める */
function clamp(v: number, min: number, max: number): number {
	return Math.min(Math.max(v, min), max);
}

/** 地図の中に置くと，ホイールズームを滑らかなものに置き換える（描画はしない） */
export function SmoothWheelZoom() {
	const map = useMap();

	useEffect(() => {
		const container = map.getContainer();
		// 目標の倍率と，その基準点（カーソルの位置）．アニメーション中は frame が 0 以外
		let target = map.getZoom();
		let anchor: Point | null = null;
		let frame = 0;

		/** 1フレーム分，目標の倍率へ近づける */
		const step = () => {
			const current = map.getZoom();
			const diff = target - current;
			if (Math.abs(diff) < 0.002 || !anchor) {
				frame = 0;
				return;
			}
			const next = Math.abs(diff) < 0.01 ? target : current + diff * EASE;
			map.setZoomAround(anchor, next, { animate: false });
			frame = requestAnimationFrame(step);
		};

		/** ホイールの回転量を目標の倍率に足し込み，アニメーションを始める */
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			// 止まっているときは，今の倍率（ボタンやピンチで変わっているかも）から始める
			if (!frame) target = map.getZoom();
			// deltaMode が行単位・ページ単位のブラウザ（Firefox など）は px に直す
			const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
			const perLevel = e.ctrlKey ? PX_PER_LEVEL_PINCH : PX_PER_LEVEL;
			target = clamp(
				target - (e.deltaY * unit) / perLevel,
				map.getMinZoom(),
				map.getMaxZoom(),
			);
			anchor = map.mouseEventToContainerPoint(e);
			if (!frame) frame = requestAnimationFrame(step);
		};

		container.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			container.removeEventListener("wheel", onWheel);
			cancelAnimationFrame(frame);
		};
	}, [map]);

	return null;
}
