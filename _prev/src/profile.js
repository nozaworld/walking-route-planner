import { haversine } from './geo.js';

export function renderProfile(points, elevs) {
  const wrap = document.getElementById('profileWrap');
  const svg = document.getElementById('profileSvg');
  svg.innerHTML = '';
  if (points.length < 2) {
    wrap.style.display = 'none';
    return;
  }

  // 累積距離を算出
  const cumDist = [0];
  for (let i = 1; i < points.length; i++) {
    cumDist.push(cumDist[i - 1] + haversine(points[i - 1], points[i]));
  }
  const totalDist = cumDist[cumDist.length - 1];
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  const span = Math.max(maxE - minE, 1);

  const W = 600,
    H = 90,
    padB = 14,
    padT = 6;
  const xOf = (d) => (totalDist > 0 ? (d / totalDist) * W : 0);
  const yOf = (e) => padT + (H - padT - padB) * (1 - (e - minE) / span);

  let path = `M ${xOf(cumDist[0])} ${yOf(elevs[0])}`;
  for (let i = 1; i < points.length; i++) path += ` L ${xOf(cumDist[i])} ${yOf(elevs[i])}`;
  const areaPath = path + ` L ${xOf(cumDist[cumDist.length - 1])} ${H - padB} L ${xOf(cumDist[0])} ${H - padB} Z`;

  const ns = 'http://www.w3.org/2000/svg';
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', '#2766c9');
  area.setAttribute('opacity', '0.15');
  svg.appendChild(area);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', path);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#2766c9');
  line.setAttribute('stroke-width', '2');
  svg.appendChild(line);

  [minE, maxE].forEach((e) => {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', '4');
    t.setAttribute('y', String(yOf(e) + (e === maxE ? 9 : -3)));
    t.setAttribute('font-size', '9');
    t.setAttribute('fill', '#7a7160');
    t.textContent = Math.round(e) + 'm';
    svg.appendChild(t);
  });

  wrap.style.display = 'block';
}
