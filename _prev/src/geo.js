export function haversine(a, b) {
	const R = 6371000;
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const la1 = toRad(a.lat);
	const la2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function downsample(points, maxN) {
	if (points.length <= maxN) return points;
	const step = points.length / maxN;
	const out = [];
	for (let i = 0; i < maxN; i++) out.push(points[Math.floor(i * step)]);
	return out;
}
