/** 地圖查詢：多條件篩選、叢集標記、半徑搜尋、單株詳情與相片。 */
import { api, cached } from './api.js';
import {
  esc, num, healthBadge, gradeBadge, safeUrl, loading, openModal, toast, downloadCsv, healthColor,
} from './ui.js';

const MACAU_CENTER = [22.1630, 113.5540];
let state = null;

function markerIcon(tree) {
  const cls = { 健康: 'good', 一般: 'fair', 瀕危: 'bad' }[tree.health] || 'fair';
  const big = tree.age_years >= 300;
  return window.L.divIcon({
    className: '',
    html: `<div class="marker-dot ${cls}" style="${big ? 'width:20px;height:20px;border-width:3px' : ''}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function popupHtml(t) {
  const photo = safeUrl(t.species_photo);
  return `
    <div style="min-width:210px">
      ${photo ? `<img class="popup-photo" src="${esc(photo)}" alt="${esc(t.species)}">` : ''}
      <h4>${esc(t.species)} <span class="tiny muted">#${esc(t.tree_no)}</span></h4>
      <div class="tiny muted" style="margin-bottom:.3rem">${esc(t.name_sci || '')}</div>
      <div class="tiny"><strong>${num(t.age_years)}</strong> 年 ・ <strong>${num(t.height_m, t.height_m % 1 ? 2 : 0)}</strong> 公尺</div>
      <div class="tiny">${gradeBadge(t.grade)} ${healthBadge(t.health)}</div>
      <div class="tiny" style="margin-top:.35rem">${esc(t.site || '')}<br>${esc(t.parish || '')}</div>
      <button class="btn btn-sm btn-primary" style="margin-top:.5rem" data-detail="${esc(t.tree_no)}">查看詳情</button>
    </div>`;
}

export async function render(section, params) {
  section.innerHTML = `
    <div class="page-head">
      <h1>地圖查詢</h1>
      <p>以堂區、品種、分級、健康狀況、樹齡區間與關鍵字篩選 658 株古樹；可在地圖上任意點擊設定中心並做半徑搜尋，
      標記顏色代表健康狀況（綠＝健康、黃＝一般、紅＝瀕危）。</p>
    </div>
    <div class="map-layout">
      <div class="card">
        <div id="filters">${loading('載入篩選選項…')}</div>
        <hr>
        <div class="row">
          <strong id="result-count" class="small">—</strong>
          <span class="spacer"></span>
          <button class="btn btn-sm" id="btn-fit" title="縮放至所有結果">全覽</button>
        </div>
        <div class="tree-list card-scroll" id="tree-list" style="max-height:44vh;margin-top:.5rem"></div>
      </div>
      <div>
        <div id="map"></div>
        <div class="row" style="margin-top:.5rem">
          <span class="tiny muted">底圖 © OpenStreetMap 貢獻者。座標為地理編碼近似值，實地請以現場標牌為準。</span>
          <span class="spacer"></span>
          <button class="btn btn-sm" id="btn-csv">匯出目前結果 CSV</button>
        </div>
      </div>
    </div>`;

  const meta = await cached('meta', () => api.meta());

  state = {
    map: null,
    layer: null,
    markers: new Map(),
    trees: [],
    total: 0,
    radius: null,
    focus: null,
    filters: {
      parish: params.get('parish') || '',
      species: params.get('species') || '',
      grade: params.get('grade') || '',
      health: params.get('health') || '',
      min_age: params.get('min_age') || '',
      max_age: params.get('max_age') || '',
      keyword: params.get('keyword') || '',
    },
  };

  const f = state.filters;
  section.querySelector('#filters').innerHTML = `
    <label class="field"><span>堂區</span>
      <select id="f-parish"><option value="">全部堂區</option>
        ${meta.parishes.map((p) => `<option value="${esc(p.code)}"${f.parish === p.code ? ' selected' : ''}>${esc(p.code)}（${num(p.area_km2, 1)} km²）</option>`).join('')}
      </select></label>
    <label class="field"><span>品種</span>
      <select id="f-species"><option value="">全部品種</option>
        ${meta.species.map((s) => `<option value="${esc(s.name)}"${f.species === s.name ? ' selected' : ''}>${esc(s.name)}${s.name_sci ? `（${esc(s.name_sci)}）` : ''}</option>`).join('')}
      </select></label>
    <div class="grid grid-2" style="gap:.5rem">
      <label class="field"><span>分級</span>
        <select id="f-grade"><option value="">全部分級</option>
          ${meta.grades.map((g) => `<option value="${esc(g.code)}"${f.grade === g.code ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}
        </select></label>
      <label class="field"><span>健康狀況</span>
        <select id="f-health"><option value="">全部</option>
          ${meta.health.map((h) => `<option value="${esc(h.code)}"${f.health === h.code ? ' selected' : ''}>${esc(h.label)}</option>`).join('')}
        </select></label>
    </div>
    <div class="grid grid-2" style="gap:.5rem">
      <label class="field"><span>最少年齡</span><input type="number" id="f-min-age" min="0" max="600" value="${esc(f.min_age)}" placeholder="例如 100"></label>
      <label class="field"><span>最多年齡</span><input type="number" id="f-max-age" min="0" max="600" value="${esc(f.max_age)}" placeholder="例如 300"></label>
    </div>
    <label class="field"><span>關鍵字（品種／地點／古樹編號）</span>
      <input type="search" id="f-keyword" value="${esc(f.keyword)}" placeholder="例如 白鴿巢、榕樹、544"></label>
    <div class="field">
      <span>半徑搜尋（在地圖上點擊設定中心）</span>
      <div class="row-tight">
        <input type="range" id="f-radius" min="0" max="3000" step="100" value="0">
        <span class="small nowrap" id="radius-label">關閉</span>
      </div>
      <p class="tiny muted" id="center-label">尚未設定中心點</p>
    </div>
    <div class="row">
      <button class="btn btn-primary btn-sm" id="btn-apply">套用篩選</button>
      <button class="btn btn-sm" id="btn-reset">重設</button>
      <button class="btn btn-sm" id="btn-my-loc" title="使用瀏覽器定位">我的位置</button>
    </div>`;

  // ── 地圖初始化 ────────────────────────────────────────
  const map = window.L.map('map', { center: MACAU_CENTER, zoom: 12, zoomControl: true, preferCanvas: false });
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  state.map = map;

  state.layer = window.L.markerClusterGroup
    ? window.L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 46, disableClusteringAtZoom: 17 })
    : window.L.layerGroup();
  map.addLayer(state.layer);

  const legend = window.L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = window.L.DomUtil.create('div', 'legend-box');
    div.innerHTML = `<strong class="tiny">健康狀況</strong>
      <div class="legend-row"><span class="marker-dot good"></span> 健康</div>
      <div class="legend-row"><span class="marker-dot fair"></span> 一般</div>
      <div class="legend-row"><span class="marker-dot bad"></span> 瀕危</div>
      <div class="tiny muted" style="margin-top:.25rem">標記較大者＝樹齡 ≥300 年</div>`;
    return div;
  };
  legend.addTo(map);

  const centerMarker = window.L.circleMarker(MACAU_CENTER, {
    radius: 7, color: '#1d4ed8', fillColor: '#dbeafe', fillOpacity: 1, weight: 3,
  });
  const radiusCircle = window.L.circle(MACAU_CENTER, { radius: 0, color: '#1d4ed8', weight: 1.5, fillOpacity: 0.08 });

  // ── 查詢與繪製 ────────────────────────────────────────
  async function load({ fit = true } = {}) {
    const list = section.querySelector('#tree-list');
    list.innerHTML = loading('查詢中…');
    const q = { ...state.filters, limit: 2000 };
    for (const k of Object.keys(q)) if (q[k] === '') delete q[k];
    if (state.radius && state.radius.center) {
      q.lat = state.radius.center[0];
      q.lon = state.radius.center[1];
      q.radius_m = state.radius.m;
    }
    const data = await api.trees(q);
    state.trees = data.trees;
    state.total = data.total;

    section.querySelector('#result-count').textContent = `符合 ${num(data.count)} 株（共 ${num(data.total)} 筆）`;
    section.querySelector('#btn-csv').disabled = !data.trees.length;

    state.layer.clearLayers();
    state.markers.clear();
    const bounds = [];
    for (const t of data.trees) {
      if (t.lat == null || t.lon == null) continue;
      const marker = window.L.marker([t.lat, t.lon], { icon: markerIcon(t), title: `${t.species} #${t.tree_no}` });
      marker.bindPopup(popupHtml(t), { maxWidth: 260 });
      marker.bindTooltip(`${t.species}・${t.age_years} 年`, { direction: 'top', offset: [0, -6] });
      state.layer.addLayer(marker);
      state.markers.set(String(t.tree_no), marker);
      bounds.push([t.lat, t.lon]);
    }
    if (fit && bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

    list.innerHTML = data.trees.length ? data.trees.map((t) => `
      <div class="tree-item" data-tree="${esc(t.tree_no)}" data-lat="${t.lat}" data-lon="${t.lon}">
        ${safeUrl(t.species_photo)
    ? `<img src="${esc(safeUrl(t.species_photo))}" alt="${esc(t.species)}" loading="lazy">`
    : '<div class="tree-thumb"></div>'}
        <div class="tree-meta">
          <div class="tree-name">${esc(t.species)} <span class="tiny muted">#${esc(t.tree_no)}</span></div>
          <div class="tree-sub">${num(t.age_years)} 年・${num(t.height_m, t.height_m % 1 ? 2 : 0)} m ${healthBadge(t.health)}</div>
          <div class="tree-sub">${esc(t.site || '')}</div>
        </div>
      </div>`).join('') : '<p class="muted small">沒有符合條件的古樹，請放寬篩選。</p>';

    list.querySelectorAll('.tree-item').forEach((item) => item.addEventListener('click', () => {
      const no = item.dataset.tree;
      const lat = Number(item.dataset.lat), lon = Number(item.dataset.lon);
      list.querySelectorAll('.tree-item').forEach((x) => x.classList.toggle('active', x === item));
      if (state.markers.has(no)) {
        map.setView([lat, lon], Math.max(map.getZoom(), 16), { animate: true });
        state.layer.zoomToShowLayer(state.markers.get(no), () => state.markers.get(no).openPopup());
      }
    }));

    return data;
  }

  function bindDetailButtons(scope) {
    scope.querySelectorAll('button[data-detail]').forEach((btn) => btn.addEventListener('click', () => {
      showDetail(btn.dataset.detail);
    }));
  }

  async function showDetail(treeNo) {
    openModal(loading('讀取古樹資料…'));
    try {
      const data = await api.tree(treeNo);
      const t = data.tree;
      const sp = t.species_photo;
      const sitePhoto = t.site_photo;
      openModal(`
        <h2>${esc(t.species)} <span class="muted small">古樹編號 ${esc(t.tree_no)}</span></h2>
        <p class="small muted" style="margin-top:-.4rem">${esc(t.name_sci || '')}${t.geo_precision ? `・座標精度：${esc({ exact: '精確匹配', approx: '近似', parish: '堂區中心' }[t.geo_precision] || t.geo_precision)}` : ''}</p>
        <div class="grid grid-4" style="margin:.6rem 0">
          <div><div class="kpi-label">樹齡</div><div class="kpi-value">${num(t.age_years)}<span class="small"> 年</span></div></div>
          <div><div class="kpi-label">樹高</div><div class="kpi-value">${num(t.height_m, t.height_m % 1 ? 2 : 0)}<span class="small"> m</span></div></div>
          <div><div class="kpi-label">分級</div><div style="margin-top:.4rem">${gradeBadge(t.grade)}</div></div>
          <div><div class="kpi-label">健康狀況</div><div style="margin-top:.4rem">${healthBadge(t.health)}</div></div>
        </div>
        <table class="data">
          <tbody>
            <tr><th style="width:6.5rem">地點</th><td>${esc(t.site || '')}</td></tr>
            <tr><th>堂區</th><td>${esc(t.parish || '')}</td></tr>
            <tr><th>座標</th><td class="mono tiny">${num(t.lat, 5)}, ${num(t.lon, 5)}
              <a class="btn btn-sm" style="margin-left:.4rem" target="_blank" rel="noopener"
                 href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(t.lat)}&mlon=${encodeURIComponent(t.lon)}#map=19/${encodeURIComponent(t.lat)}/${encodeURIComponent(t.lon)}">在 OSM 開啟</a></td></tr>
            <tr><th>樹種學名</th><td>${esc(t.name_sci || '—')}</td></tr>
          </tbody>
        </table>
        <div class="grid grid-2" style="margin-top:.8rem">
          ${sp ? `<figure style="margin:0"><img src="${esc(safeUrl(sp))}" alt="${esc(t.species)}" style="width:100%;border-radius:8px;height:170px;object-fit:cover">
            <figcaption class="tiny muted">樹種相片 © ${esc(t.species_photo_credit || 'Wikimedia Commons')}</figcaption></figure>` : ''}
          ${sitePhoto ? `<figure style="margin:0"><img src="${esc(safeUrl(sitePhoto))}" alt="${esc(t.site)}" style="width:100%;border-radius:8px;height:170px;object-fit:cover">
            <figcaption class="tiny muted">地點實景：${esc(t.site || '')}（Wikimedia Commons 自由授權）</figcaption></figure>` : ''}
        </div>
        ${data.neighbours && data.neighbours.length ? `
          <h3 style="margin-top:1rem">同地點的其他古樹（${data.neighbours.length} 株）</h3>
          <div class="stack">
            ${data.neighbours.map((n) => `<button class="btn btn-sm" data-detail="${esc(n.tree_no)}" style="justify-content:space-between">
              <span>${esc(n.species)} #${esc(n.tree_no)}</span><span class="muted tiny">${num(n.age_years)} 年・${esc(n.health)}</span></button>`).join('')}
          </div>` : ''}
        <div class="notice notice-info small" style="margin-top:1rem">
          保育提醒：觀賞時請勿攀爬、刻字、採果或踩踏樹根區；如發現枯枝、樹皮剝落或周邊施工，可向市政署反映。
        </div>`);
      bindDetailButtons(document.getElementById('modal-body'));
    } catch (err) {
      openModal(`<h3>讀取失敗</h3><p class="muted">${esc(err.message || err)}</p>`);
    }
  }

  // ── 互動 ──────────────────────────────────────────────
  const readFilters = () => {
    state.filters = {
      parish: section.querySelector('#f-parish').value,
      species: section.querySelector('#f-species').value,
      grade: section.querySelector('#f-grade').value,
      health: section.querySelector('#f-health').value,
      min_age: section.querySelector('#f-min-age').value,
      max_age: section.querySelector('#f-max-age').value,
      keyword: section.querySelector('#f-keyword').value.trim(),
    };
  };

  section.querySelector('#btn-apply').addEventListener('click', async () => {
    readFilters();
    await load();
    syncUrl();
  });

  section.querySelector('#btn-reset').addEventListener('click', async () => {
    section.querySelector('#f-parish').value = '';
    section.querySelector('#f-species').value = '';
    section.querySelector('#f-grade').value = '';
    section.querySelector('#f-health').value = '';
    section.querySelector('#f-min-age').value = '';
    section.querySelector('#f-max-age').value = '';
    section.querySelector('#f-keyword').value = '';
    section.querySelector('#f-radius').value = 0;
    state.radius = null;
    updateRadiusLabel();
    map.removeLayer(centerMarker); map.removeLayer(radiusCircle);
    readFilters();
    await load();
    syncUrl();
  });

  section.querySelector('#f-keyword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') section.querySelector('#btn-apply').click();
  });

  function syncUrl() {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(state.filters)) if (v) q.set(k, v);
    if (state.radius && state.radius.center) {
      q.set('lat', state.radius.center[0]); q.set('lon', state.radius.center[1]); q.set('radius_m', state.radius.m);
    }
    history.replaceState(null, '', `#/map${q.toString() ? `?${q}` : ''}`);
  }

  function updateRadiusLabel() {
    const el = section.querySelector('#radius-label');
    const cl = section.querySelector('#center-label');
    const m = Number(section.querySelector('#f-radius').value);
    el.textContent = m > 0 ? `${m} 公尺` : '關閉';
    if (state.radius && state.radius.center) {
      cl.textContent = `中心：${state.radius.center[0].toFixed(5)}, ${state.radius.center[1].toFixed(5)}`;
      radiusCircle.setLatLng(state.radius.center);
      radiusCircle.setRadius(m);
      if (m > 0 && !map.hasLayer(radiusCircle)) radiusCircle.addTo(map);
      if (m === 0) map.removeLayer(radiusCircle);
    } else {
      cl.textContent = '尚未設定中心點（點擊地圖即可設定）';
    }
  }

  section.querySelector('#f-radius').addEventListener('input', () => {
    const m = Number(section.querySelector('#f-radius').value);
    if (state.radius && state.radius.center) state.radius.m = m;
    updateRadiusLabel();
  });
  section.querySelector('#f-radius').addEventListener('change', async () => {
    if (!state.radius || !state.radius.center) { toast('請先在地圖上點擊設定中心點'); return; }
    if (state.radius.m === 0) { state.radius = null; await load({ fit: false }); syncUrl(); return; }
    await load({ fit: false });
    syncUrl();
  });

  map.on('click', async (e) => {
    const m = Number(section.querySelector('#f-radius').value) || 800;
    state.radius = { center: [e.latlng.lat, e.latlng.lng], m };
    centerMarker.setLatLng(e.latlng);
    if (!map.hasLayer(centerMarker)) centerMarker.addTo(map);
    section.querySelector('#f-radius').value = m;
    map.removeLayer(radiusCircle);
    radiusCircle.setLatLng(e.latlng); radiusCircle.setRadius(m); radiusCircle.addTo(map);
    updateRadiusLabel();
    await load({ fit: false });
    syncUrl();
  });

  section.querySelector('#btn-fit').addEventListener('click', () => {
    const pts = state.trees.filter((t) => t.lat != null).map((t) => [t.lat, t.lon]);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  });

  section.querySelector('#btn-my-loc').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('瀏覽器不支援定位'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const center = [pos.coords.latitude, pos.coords.longitude];
        state.radius = { center, m: 1500 };
        centerMarker.setLatLng(center); centerMarker.addTo(map);
        radiusCircle.setLatLng(center); radiusCircle.setRadius(1500); radiusCircle.addTo(map);
        section.querySelector('#f-radius').value = 1500;
        updateRadiusLabel();
        map.setView(center, 14);
        await load({ fit: false });
        toast('已以你的位置搜尋 1.5 公里內的古樹');
      },
      () => toast('無法取得定位（可能未授權或非 HTTPS）'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

  section.querySelector('#btn-csv').addEventListener('click', () => {
    downloadCsv('澳門古樹_查詢結果.csv', state.trees.map((t) => ({
      古樹編號: t.tree_no, 品種: t.species, 學名: t.name_sci || '', 樹齡: t.age_years,
      樹高公尺: t.height_m, 分級: t.grade, 健康狀況: t.health, 地點: t.site, 堂區: t.parish,
      緯度: t.lat, 經度: t.lon,
    })));
  });

  const data = await load();

  // 從 API 回來的 popup 內含按鈕，需以事件委派處理
  map.on('popupopen', (e) => bindDetailButtons(e.popup.getElement()));

  // 由網址指定單株
  const focus = params.get('tree');
  if (focus) {
    await showDetail(focus);
    const m = state.markers.get(String(focus));
    if (m) state.layer.zoomToShowLayer(m, () => m.openPopup());
  }

  // 由網址指定半徑
  if (params.get('lat') && params.get('lon')) {
    const center = [Number(params.get('lat')), Number(params.get('lon'))];
    const m = Number(params.get('radius_m')) || 800;
    state.radius = { center, m };
    centerMarker.setLatLng(center); centerMarker.addTo(map);
    radiusCircle.setLatLng(center); radiusCircle.setRadius(m); radiusCircle.addTo(map);
    section.querySelector('#f-radius').value = m;
    updateRadiusLabel();
    await load({ fit: false });
  }

  return {
    destroy: () => { if (state && state.map) { state.map.remove(); state.map = null; state = null; } },
  };
}
