import { downsample, haversine } from "./geo.js";

const OSRM_PROFILE = "foot";
const OSRM_BASE = "https://router.project-osrm.org";
const GSI_ELEV_API =
	"https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php";

// ---- 経由点ルーティング（クリックした点を順に道路でつなぐ） ----------------
export async function routeThroughPoints(points) {
	const sampled = downsample(points, 60);
	if (sampled.length < 2) throw new Error("点が足りません．");
	let coords = [];
	let totalDistance = 0;
	for (let i = 0; i < sampled.length - 1; i++) {
		const a = sampled[i];
		const b = sampled[i + 1];
		const url = `${OSRM_BASE}/route/v1/${OSRM_PROFILE}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
		const res = await fetch(url);
		const data = await res.json();
		if (data.code !== "Ok" || !data.routes || !data.routes.length) {
			coords.push(a, b);
			totalDistance += haversine(a, b);
			continue;
		}
		const route = data.routes[0];
		const segCoords = route.geometry.coordinates.map(([lng, lat]) => ({
			lat,
			lng,
		}));
		coords = coords.concat(i === 0 ? segCoords : segCoords.slice(1));
		totalDistance += route.distance;
	}
	if (coords.length < 2)
		throw new Error("道路上の経路を作成できませんでした．");
	return { coords, distance: totalDistance };
}

export async function getElevation(lat, lng) {
	const url = `${GSI_ELEV_API}?lon=${lng}&lat=${lat}&outtype=JSON`;
	const res = await fetch(url);
	const data = await res.json();
	return typeof data.elevation === "number" ? data.elevation : 0;
}

export async function getElevationsAlong(coords, maxSamples) {
	const sampled = downsample(coords, maxSamples);
	const elevs = [];
	for (const p of sampled) elevs.push(await getElevation(p.lat, p.lng));
	return { points: sampled, elevs };
}

export function buildSegments(points, elevs) {
	const segs = [];
	for (let i = 0; i < points.length - 1; i++) {
		segs.push({
			distM: haversine(points[i], points[i + 1]),
			elevStart: elevs[i],
			elevEnd: elevs[i + 1],
		});
	}
	return segs;
}
