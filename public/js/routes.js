/** 路綫推薦：精選路綫 ＋ 自訂條件即時生成（最近鄰法 ＋ 2-opt）。 */
import { api, cached } from './api.js';
import {
  esc, num, loading, toast, copyText, downloadCsv, healthBadge,
  errDetail,
} from './ui.js';

const MACAU_CENTER = [22.1630, 113.5540];

function stopIcon(n) {
  return window.L.divIcon({ className: '', html: `<div class="marker-stop">${n}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function routeSummaryText(r) {
  const lines = [`【${r.route.name}】`, r.route.summary || '', '', `總距離：${num(r.estimate.total_km, 2)} 公里`,
    `步行約 ${r.estimate.walk_min} 分鐘 ＋ 停留約 ${r.estimate.dwell_min} 分鐘＝約 ${r.estimate.total_min} 分鐘`,
    `停靠 ${r.statistics.stops} 個地點、涵蓋 ${r.statistics.trees_covered} 株古樹、${r.statistics.species_count} 個樹種`,
    `沿綫最老：${r.statistics.oldest_age} 年｜瀕危 ${r.statistics.endangered} 株`, '', '停靠次序：'];
  r.stops.forEach((s) => lines.push(`${s.order}. ${s.site}（${s.tree_count} 株，最老 ${s.oldest} 年）`));
  if (r.route.tips) lines.push('', `提醒：${r.route.tips}`);
  return lines.join('\n');
}

export async function render(section, params) {
  section.innerHTML = `
    <div class="page-head">
      <h1>路綫推薦</h1>
      <p>選擇精選路綫，或以堂區／品種／主題即時生成一條古樹參觀路綫。系統會把 150 公尺內的古樹合併為同一停靠點，
      再用「最近鄰法 ＋ 2-opt 改良」求近似最短步行路徑，並估算時間與沿綫樹種組成。</p>
    </div>
    <div class="map-layout">
      <div class="stack">
        <div class="card">
          <h2 style="font-size:1.05rem">精選路綫</h2>
          <div class="stack" id="route-list">${loading('載入路綫…')}</div>
        </div>
        <div class="card">
          <h2 style="font-size:1.05rem">自訂路綫</h2>
          <div id="custom-form">${loading()}</div>
        </div>
      </div>
      <div>
        <div id="route-map"></div>
        <div class="card" style="margin-top:.8rem" id="route-detail">
          <p class="muted">請在左側選擇一條路綫，或設定條件後按「生成路綫」。</p>
        </div>
      </div>
    </div>`;

  const meta = await cached('meta', () => api.meta());

  const map = window.L.map('route-map', { center: MACAU_CENTER, zoom: 12 });
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const lineLayer = window.L.layerGroup().addTo(map);
  const markerLayer = window.L.layerGroup().addTo(map);

  let routes = [];
  let currentRoute = null;

  // ── 精選路綫清單 ──────────────────────────────────────
  try {
    const data = await api.routes();
    routes = data.routes;
  } catch (err) {
    section.querySelector('#route-list').innerHTML = `<p class="muted small">讀取路綫失敗：${esc(errDetail(err))}</p>`;
  }

  section.querySelector('#route-list').innerHTML = routes.map((r) => `
    <button class="card card-tight route-card" data-code="${esc(r.code)}" style="text-align:left;cursor:pointer;border-radius:var(--radius-sm)">
      <div class="row"><strong>${esc(r.name)}</strong></div>
      <div class="tiny muted">${esc(r.summary || '')}</div>
      <div class="tiny" style="margin-top:.3rem">
        <span class="badge badge-info">最多 ${num(r.max_stops)} 站</span>
        ${r.species_focus ? `<span class="badge badge-muted">${esc(r.species_focus)}</span>` : ''}
      </div>
    </button>`).join('') || '<p class="muted small">目前沒有精選路綫。</p>';

  section.querySelectorAll('.route-card').forEach((card) => card.addEventListener('click', () => {
    section.querySelectorAll('.route-card').forEach((c) => c.classList.toggle('active', c === card));
    generate({ code: card.dataset.code });
  }));

  // ── 自訂表單 ──────────────────────────────────────────
  section.querySelector('#custom-form').innerHTML = `
    <div class="grid grid-2" style="gap:.5rem">
      <label class="field"><span>堂區</span>
        <select id="c-parish"><option value="">全澳</option>
          ${meta.parishes.map((p) => `<option value="${esc(p.code)}">${esc(p.code)}</option>`).join('')}
        </select></label>
      <label class="field"><span>品種</span>
        <select id="c-species"><option value="">不限</option>
          ${meta.species.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}
        </select></label>
    </div>
    <label class="field"><span>推薦主題</span>
      <select id="c-theme">${meta.themes.map((t) => `<option value="${esc(t.code)}">${esc(t.label)}</option>`).join('')}</select></label>
    <label class="field"><span>停靠站數上限：<span id="c-stops-label">10</span> 站</span>
      <input type="range" id="c-stops" min="3" max="20" value="10"></label>
    <div class="grid grid-2" style="gap:.5rem">
      <label class="field"><span>步行速度 km/h</span><input type="number" id="c-speed" value="4.2" step="0.1" min="2" max="7"></label>
      <label class="field"><span>每站停留（分鐘）</span><input type="number" id="c-dwell" value="3" step="1" min="0" max="60"></label>
    </div>
    <button class="btn btn-primary" id="btn-generate" style="width:100%">生成路綫</button>`;

  section.querySelector('#c-stops').addEventListener('input', (e) => {
    section.querySelector('#c-stops-label').textContent = e.target.value;
  });
  section.querySelector('#btn-generate').addEventListener('click', () => {
    section.querySelectorAll('.route-card').forEach((c) => c.classList.remove('active'));
    generate({});
  });

  // ── 產生路綫 ──────────────────────────────────────────
  async function generate({ code }) {
    const detail = section.querySelector('#route-detail');
    detail.innerHTML = loading('正在計算路綫…');
    const q = code ? { code } : {
      parish: section.querySelector('#c-parish').value,
      species: section.querySelector('#c-species').value,
      theme: section.querySelector('#c-theme').value,
      max_stops: section.querySelector('#c-stops').value,
      speed_kmh: section.querySelector('#c-speed').value,
      dwell_sec: Number(section.querySelector('#c-dwell').value) * 60,
    };
    try {
      const r = await api.route(q);
      currentRoute = r;
      drawRoute(r);
      renderDetail(r);
    } catch (err) {
      detail.innerHTML = `<p class="muted">${esc(errDetail(err))}</p>`;
      lineLayer.clearLayers(); markerLayer.clearLayers();
    }
  }

  function drawRoute(r) {
    lineLayer.clearLayers();
    markerLayer.clearLayers();
    const coords = r.stops.map((s) => [s.lat, s.lon]);
    if (!coords.length) return;
    window.L.polyline(coords, { color: '#166534', weight: 4, opacity: .78, dashArray: '1 0' }).addTo(lineLayer);
    coords.forEach((c, i) => {
      const s = r.stops[i];
      const marker = window.L.marker(c, { icon: stopIcon(i + 1) });
      marker.bindPopup(`
        <div style="min-width:200px">
          <h4>第 ${i + 1} 站：${esc(s.site)}</h4>
          <div class="tiny muted">${esc(s.parish)}・${num(s.tree_count)} 株古樹・最老 ${num(s.oldest)} 年</div>
          ${s.leg_from_previous_m != null ? `<div class="tiny">距上一站 ${num(s.leg_from_previous_m)} 公尺（${esc(s.bearing_label || '')}）</div>` : ''}
          <div class="tiny" style="margin-top:.3rem">${s.trees.slice(0, 5).map((t) => `${esc(t.species)} #${esc(t.tree_no)}（${num(t.age_years)}年）`).join('<br>')}</div>
        </div>`);
      markerLayer.addLayer(marker);
    });
    map.fitBounds(coords, { padding: [40, 40], maxZoom: 16 });
  }

  function renderDetail(r) {
    const gmaps = coords => `https://www.google.com/maps/dir/?api=1&origin=${coords[0][0]},${coords[0][1]}&destination=${coords[coords.length - 1][0]},${coords[coords.length - 1][1]}`;
    const pts = r.stops.map((s) => [s.lat.toFixed(6), s.lon.toFixed(6)]);
    // Google Maps URL 的 waypoints 上限約 9 個，取樣呈現
    const mids = pts.slice(1, -1);
    const step = Math.max(1, Math.ceil(mids.length / 9));
    const waypoints = mids.filter((_, i) => i % step === 0).slice(0, 9).map((p) => p.join(',')).join('|');

    section.querySelector('#route-detail').innerHTML = `
      <h2>${esc(r.route.name)}</h2>
      <p class="small muted" style="margin-top:-.3rem">${esc(r.route.summary || '')}</p>
      <div class="grid grid-4">
        <div class="kpi"><span class="kpi-value">${num(r.estimate.total_km, 2)}<span class="small"> km</span></span><span class="kpi-label">總步行距離</span></div>
        <div class="kpi"><span class="kpi-value">${num(r.estimate.total_min)}<span class="small"> 分鐘</span></span><span class="kpi-label">預估總時間</span></div>
        <div class="kpi"><span class="kpi-value">${num(r.statistics.stops)}</span><span class="kpi-label">停靠站數</span></div>
        <div class="kpi"><span class="kpi-value">${num(r.statistics.trees_covered)}</span><span class="kpi-label">涵蓋古樹</span></div>
      </div>
      <p class="small" style="margin-top:.6rem">
        ${esc(r.route.species_focus ? `主題樹種：${r.route.species_focus}・` : '')}
        涵蓋 ${num(r.statistics.species_count)} 個樹種，沿綫最老 ${num(r.statistics.oldest_age)} 年，
        平均樹齡 ${num(r.statistics.avg_age, 1)} 年，瀕危 ${num(r.statistics.endangered)} 株。
        東西跨度約 ${num(r.statistics.span_m)} 公尺。
      </p>
      <div class="row">
        <button class="btn btn-sm" id="btn-copy">複製路綫摘要</button>
        <button class="btn btn-sm" id="btn-csv-route">匯出路綫 CSV</button>
        <a class="btn btn-sm" id="btn-book" href="#/card?mode=book&route=${encodeURIComponent(r.route.code || '')}">列印路綫資料冊</a>
        <a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(gmaps(pts))}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}">在 Google Maps 導航</a>
      </div>
      ${r.route.tips ? `<div class="notice small" style="margin-top:.6rem">${esc(r.route.tips)}</div>` : ''}
      <div class="notice notice-info tiny" style="margin-top:.6rem">
        演算法：${esc(r.algorithm.method)}；候選 ${num(r.algorithm.candidates_considered)} 株 →
        合併為 ${num(r.algorithm.clusters)} 個停靠點 → 選出 ${num(r.algorithm.stops_selected)} 站；
        目標函數：${esc(r.algorithm.objective)}（2-opt 迭代 ${num(r.algorithm.matrix_iterations)} 次）。
      </div>
      <h3 style="margin-top:1rem">停靠次序</h3>
      <div id="stop-list">
        ${r.stops.map((s) => `
          <div class="stop-item">
            <div class="stop-no">${s.order}</div>
            <div style="flex:1;min-width:0">
              <div><strong>${esc(s.site)}</strong> <span class="tiny muted">${esc(s.parish)}</span></div>
              <div class="tiny muted">${num(s.tree_count)} 株・最老 ${num(s.oldest)} 年・樹種：${esc(s.species_here.join('、'))}</div>
              <div class="tiny">${s.trees.slice(0, 3).map((t) => `${esc(t.species)} #${esc(t.tree_no)}（${num(t.age_years)}年 ${esc(t.health)}）`).join('｜')}</div>
            </div>
          </div>
          ${s.leg_from_previous_m != null
    ? `<div class="leg-label">↓ 步行 ${num(s.leg_from_previous_m)} 公尺（往${esc(s.bearing_label || '')}，方位 ${num(s.bearing_from_previous)}°）</div>` : ''}`).join('')}
      </div>`;

    section.querySelector('#btn-copy').addEventListener('click', () => copyText(routeSummaryText(r)));
    section.querySelector('#btn-csv-route').addEventListener('click', () => {
      downloadCsv(`路綫_${r.route.name}.csv`, r.stops.flatMap((s) => s.trees.map((t) => ({
        站序: s.order, 地點: s.site, 堂區: s.parish, 古樹編號: t.tree_no, 品種: t.species,
        樹齡: t.age_years, 樹高公尺: t.height_m, 分級: t.grade, 健康狀況: t.health,
        緯度: t.lat, 經度: t.lon, 距上一站公尺: s.leg_from_previous_m,
      }))));
    });
  }

  // 由網址指定路綫
  const code = params.get('code');
  if (code) {
    const card = section.querySelector(`.route-card[data-code="${CSS.escape(code)}"]`);
    if (card) { card.classList.add('active'); generate({ code }); }
  } else if (routes.length) {
    section.querySelector('.route-card')?.classList.add('active');
    generate({ code: routes[0].code });
  }

  return {
    destroy: () => { try { map.remove(); } catch { /* 忽略 */ } },
  };
}
