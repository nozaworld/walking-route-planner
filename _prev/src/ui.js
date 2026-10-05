import { fmtMin } from './energyModel.js';

export function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = '⚠ エラー: ' + msg;
  box.style.display = 'block';
  setLoading(false);
}

export function clearError() {
  document.getElementById('errorBox').style.display = 'none';
}

export function setLoading(on) {
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
}

export function renderStats(stats) {
  const statbox = document.getElementById('statbox');
  statbox.innerHTML =
    `<div class="score-num">${(stats.dist / 1000).toFixed(2)} km</div>` +
    `<div>獲得標高 ${Math.round(stats.gain)} m ／ 下り ${Math.round(stats.loss)} m</div>` +
    `<div>🚶 徒歩 ${fmtMin(stats.walkMin)} ／ ${Math.round(stats.walkKcal)} kcal</div>` +
    `<div>🚲 自転車 ${fmtMin(stats.bikeMin)} ／ ${Math.round(stats.bikeKcal)} kcal</div>`;
}

export function escapeHtml(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

export function renderRouteList(routes, onSelect, onDelete) {
  const listEl = document.getElementById('routeList');
  if (!routes.length) {
    listEl.innerHTML = '<div class="empty">まだ保存されたルートはありません．</div>';
    return;
  }
  listEl.innerHTML = '';
  routes.forEach((r, idx) => {
    const div = document.createElement('div');
    div.className = 'routeItem';
    div.innerHTML =
      `<span class="rdel" data-idx="${idx}">削除</span>` +
      `<div class="rname">${escapeHtml(r.name)}</div>` +
      `<div>${(r.stats.dist / 1000).toFixed(2)} km ／ 獲得標高 ${Math.round(r.stats.gain)} m</div>` +
      `<div>徒歩 ${Math.round(r.stats.walkKcal)} kcal ／ 自転車 ${Math.round(r.stats.bikeKcal)} kcal</div>`;
    div.addEventListener('click', (ev) => {
      if (ev.target.classList.contains('rdel')) return;
      onSelect(r);
    });
    div.querySelector('.rdel').addEventListener('click', (ev) => {
      ev.stopPropagation();
      onDelete(idx);
    });
    listEl.appendChild(div);
  });
}
