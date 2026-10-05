// 【徒歩】Minetti et al. の歩行エネルギーコスト近似式
// C_walk(i): 勾配 i における [J/kg/m]
export function walkEnergyCost(grade) {
	const i = Math.max(-0.45, Math.min(0.45, grade));
	const C =
		280.5 * i ** 5 -
		58.7 * i ** 4 -
		76.8 * i ** 3 +
		51.9 * i ** 2 +
		19.6 * i +
		2.5;
	return Math.max(C, 1.5); // J/kg/m
}

// 歩行速度モデル：平地 5 km/h，上り坂で低下，下り坂でも低下
export function walkSpeedKmh(grade) {
	const i = Math.max(-0.45, Math.min(0.45, grade));
	return Math.max(1.0, 5.0 * Math.exp(-3.5 * Math.abs(i + 0.05)));
}

// 【自転車】平地 15 km/h，体重+自転車(kg)=体重+10 を仮定した簡易モデル
export function bikeEnergyCost(grade) {
	const i = Math.max(-0.2, Math.min(0.2, grade)); // 自転車の走行可能勾配でクリップ
	const base = 1.05; // J/kg/m（平地・15 km/h 想定）
	const gradeCoeff = i >= 0 ? 1 + 8.0 * i : 1 + 2.0 * i; // 上りは急増，下りは微減
	return Math.max(base * gradeCoeff, 0.5);
}

// 自転車速度モデル：平地 15 km/h，上り坂で低下，下り坂で上昇（上限30）
export function bikeSpeedKmh(grade) {
	const i = Math.max(-0.2, Math.min(0.2, grade));
	if (i >= 0) return Math.max(3.0, 15.0 * Math.exp(-7.0 * i));
	return Math.min(30.0, 15.0 * (1 - 3.0 * i)); // 下りは加速
}

export function computeStats(segments, weightKg) {
	let walkGain = 0,
		walkLoss = 0,
		dist = 0;
	let walkEnergyJ = 0,
		walkTimeSec = 0;
	let bikeEnergyJ = 0,
		bikeTimeSec = 0;

	for (const s of segments) {
		const grade = s.distM > 0 ? (s.elevEnd - s.elevStart) / s.distM : 0;
		walkEnergyJ += s.distM * walkEnergyCost(grade) * weightKg;
		walkTimeSec += s.distM / (walkSpeedKmh(grade) / 3.6);
		bikeEnergyJ += s.distM * bikeEnergyCost(grade) * (weightKg + 10); // 自転車重量10kg込み
		bikeTimeSec += s.distM / (bikeSpeedKmh(grade) / 3.6);
		if (s.elevEnd > s.elevStart) walkGain += s.elevEnd - s.elevStart;
		else walkLoss += s.elevStart - s.elevEnd;
		dist += s.distM;
	}

	return {
		dist,
		gain: walkGain,
		loss: walkLoss,
		walkKcal: walkEnergyJ / 4184,
		walkMin: walkTimeSec / 60,
		bikeKcal: bikeEnergyJ / 4184,
		bikeMin: bikeTimeSec / 60,
	};
}

export function fmtMin(min) {
	const h = Math.floor(min / 60);
	const m = Math.round(min % 60);
	return h > 0 ? `${h}時間${m}分` : `${m}分`;
}
