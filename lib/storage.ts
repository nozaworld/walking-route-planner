/**
 * ブラウザの localStorage への保存と読み込み．
 * 体重を保存する．保存済みルートは別のコミットで追加する．
 * プライベートモードなどで localStorage が使えない場合は，黙って保存しない．
 */

const STORAGE_KEY_WEIGHT = "fatigueplanner_weight";

/** 保存した体重 [kg] を読む．なければ null */
export function loadWeight(): number | null {
	try {
		const v = Number.parseFloat(localStorage.getItem(STORAGE_KEY_WEIGHT) ?? "");
		return Number.isFinite(v) && v > 0 ? v : null;
	} catch {
		return null;
	}
}

/** 体重 [kg] を保存する */
export function saveWeight(weight: number): void {
	try {
		localStorage.setItem(STORAGE_KEY_WEIGHT, String(weight));
	} catch {
		// 保存できなくても画面の動作には影響しない
	}
}
