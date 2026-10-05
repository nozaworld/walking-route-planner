import { routeThroughPoints, getElevationsAlong, buildSegments } from './api.js';
import { computeStats } from './energyModel.js';
import { renderProfile } from './profile.js';
import { showError, clearError, setLoading, renderStats, renderRouteList } from './ui.js';
import { loadWeight, saveWeight, loadRoutes, saveRoutes } from './storage.js';

/* ============================================================
   ルート疲労度プランナー
   - 出発地点はユーザーが地図クリックで自由に選ぶ
   - 経由点を順にクリックして道路上のルートを作る
   - 距離・獲得標高・消費カロリーを表示
   - 体重とルートはブラウザのlocalStorageに保存（このファイルを
     ローカル/自分のサーバーで使う前提のため，端末内保存で完結する）
   ============================================================ */

window.addEventListener('error', (e) => showError(e.message));

try {
  if (typeof L === 'undefined') {
    throw new Error('地図ライブラリ(Leaflet)が読み込めていません．インターネット接続を確認し，再読み込みしてください．');
  }

  const map = L.map('map', { zoomControl: true }).setView([35.18, 136.91], 12); // 名古屋付近を初期表示
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '地図データ: OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  let drawing = false;
  let drawPoints = [];
  let drawnLine = null;
  let pointGroup = null;
  let resultLayer = null;
  let lastStats = null;
  let lastCoords = null;
  let lastProfile = null;

  const startBtn = document.getElementById('startBtn');
  const finishDrawBtn = document.getElementById('finishDrawBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');
  const hint = document.getElementById('hint');
  const weightInput = document.getElementById('weightInput');
  const statbox = document.getElementById('statbox');
  const profileWrap = document.getElementById('profileWrap');

  function getWeight() {
    const v = parseFloat(weightInput.value);
    return isFinite(v) && v > 0 ? v : 60;
  }

  (function initWeight() {
    const saved = loadWeight();
    if (saved !== null) weightInput.value = String(saved);
  })();

  weightInput.addEventListener('change', () => {
    saveWeight(getWeight());
    if (lastStats && lastCoords) {
      getElevationsAlong(lastCoords, 50)
        .then(({ points, elevs }) => {
          const segs = buildSegments(points, elevs);
          lastStats = computeStats(segs, getWeight());
          lastProfile = { points, elevs };
          renderStats(lastStats);
          renderProfile(points, elevs);
        })
        .catch(() => {});
    }
  });

  startBtn.addEventListener('click', () => {
    clearError();
    resetDrawing();
    drawing = true;
    startBtn.disabled = true;
    hint.textContent = '地図をクリックして経路上の点を順に打ってください．パン・ズームは自由に行えます．';
  });

  map.on('click', (e) => {
    if (!drawing) return;
    drawPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    if (!drawnLine) drawnLine = L.polyline([], { color: 'var(--player)', weight: 4, opacity: 0.85 }).addTo(map);
    drawnLine.addLatLng(e.latlng);
    if (!pointGroup) pointGroup = L.layerGroup().addTo(map);
    const isStart = drawPoints.length === 1;
    L.circleMarker(e.latlng, {
      radius: isStart ? 7 : 3,
      color: isStart ? '#27392f' : '#2766c9',
      fillColor: isStart ? '#3f5d4c' : '#2766c9',
      fillOpacity: 1,
      weight: isStart ? 2 : 1,
    }).addTo(pointGroup);
    if (drawPoints.length >= 2) finishDrawBtn.disabled = false;
    clearBtn.disabled = false;
  });

  finishDrawBtn.addEventListener('click', async () => {
    if (drawPoints.length < 2) return;
    drawing = false;
    finishDrawBtn.disabled = true;
    hint.textContent = '';
    setLoading(true);
    try {
      const { coords } = await routeThroughPoints(drawPoints);
      const { points, elevs } = await getElevationsAlong(coords, 50);
      const segs = buildSegments(points, elevs);
      const weight = getWeight();
      const stats = computeStats(segs, weight);

      if (resultLayer) map.removeLayer(resultLayer);
      resultLayer = L.polyline(coords, { color: '#2766c9', weight: 5 }).addTo(map);
      if (drawnLine) {
        map.removeLayer(drawnLine);
        drawnLine = null;
      }

      lastStats = stats;
      lastCoords = coords;
      lastProfile = { points, elevs };
      renderStats(stats);
      renderProfile(points, elevs);
      saveBtn.disabled = false;
    } catch (e) {
      showError(e.message || 'ルートの計算に失敗しました．');
      drawing = true;
      finishDrawBtn.disabled = false;
    } finally {
      setLoading(false);
    }
  });

  clearBtn.addEventListener('click', () => {
    resetDrawing();
    startBtn.disabled = false;
  });

  function resetDrawing() {
    drawing = false;
    drawPoints = [];
    if (drawnLine) {
      map.removeLayer(drawnLine);
      drawnLine = null;
    }
    if (pointGroup) {
      map.removeLayer(pointGroup);
      pointGroup = null;
    }
    if (resultLayer) {
      map.removeLayer(resultLayer);
      resultLayer = null;
    }
    lastStats = null;
    lastCoords = null;
    lastProfile = null;
    finishDrawBtn.disabled = true;
    clearBtn.disabled = true;
    saveBtn.disabled = true;
    statbox.innerHTML = '';
    profileWrap.style.display = 'none';
    hint.textContent = '「出発地点を選ぶ」を押してから地図をクリックしてください．';
  }

  function refreshRouteList() {
    renderRouteList(loadRoutes(), showSavedRoute, (idx) => {
      const routes = loadRoutes();
      routes.splice(idx, 1);
      saveRoutes(routes);
      refreshRouteList();
    });
  }

  function showSavedRoute(r) {
    if (resultLayer) map.removeLayer(resultLayer);
    if (drawnLine) {
      map.removeLayer(drawnLine);
      drawnLine = null;
    }
    if (pointGroup) {
      map.removeLayer(pointGroup);
      pointGroup = null;
    }
    resultLayer = L.polyline(r.coords, { color: '#2766c9', weight: 5 }).addTo(map);
    map.fitBounds(resultLayer.getBounds().pad(0.2));
    lastStats = r.stats;
    lastCoords = r.coords;
    lastProfile = r.profile || null;
    renderStats(r.stats);
    if (lastProfile) renderProfile(lastProfile.points, lastProfile.elevs);
    else profileWrap.style.display = 'none';
    saveBtn.disabled = true; // 既に保存済みなので再保存は不要
    startBtn.disabled = false;
  }

  saveBtn.addEventListener('click', () => {
    if (!lastStats || !lastCoords) return;
    const name = prompt('このルートの名前を入力してください．', `ルート ${loadRoutes().length + 1}`);
    if (!name) return;
    const routes = loadRoutes();
    routes.unshift({ name, stats: lastStats, coords: lastCoords, profile: lastProfile, savedAt: Date.now() });
    saveRoutes(routes);
    refreshRouteList();
    saveBtn.disabled = true;
  });

  refreshRouteList();
} catch (e) {
  showError(e.message + '\n(地図ライブラリの読み込みに失敗した可能性があります．通信環境をご確認の上，再読み込みしてください．)');
}
