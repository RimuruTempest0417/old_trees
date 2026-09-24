/**
 * 列印模組：古樹檔案卡、空白考察單、路綫資料冊（A4 列印／存成 PDF）。
 *
 * 設計原則
 *  1. 只印我們確定有的資料：官方缺值一律顯示「官方未提供」，不補造數字。
 *  2. 純函式（cardModel／checkItems／cardHtml／schematicMapSvg／routeBookHtml）
 *     不碰 DOM，方便在 Node 中測試；只有 render() 才操作畫面。
 *  3. 二維碼沿用 QR 碼分頁的編碼器（qrcode-generator），不重複造輪子。
 *  4. 版面用 A4（210×297mm）：@page margin 0、由頁面自己留 12mm 邊界，
 *     避免瀏覽器邊界與頁面留白重疊。
 */
import { api } from './api.js';
import { esc, loading, toast, num } from './ui.js';
import { qrSvg, treeUrl } from './qr.js';

export const A4 = { width_mm: 210, height_mm: 297, margin_mm: 12 };

/* ── 資料整理 ───────────────────────────────────────────── */

const dash = (v) => (v === null || v === undefined || v === '' ? '官方未提供' : v);

/** 依官方逐株資料產生「現場查核清單」；每一項都說明為什麼要查。 */
export function checkItems(tree = {}) {
  const items = [];
  const health = tree.health;
  if (health === '瀕危' || health === '需關注') {
    items.push({ label: `健康狀況標示為「${health}」：檢查枯枝、樹幹腐朽與病蟲害跡象`, why: '官方現況' });
  }
  if (tree.grade && tree.grade !== '不分級') {
    items.push({ label: `已列入${tree.grade}古樹：確認保護圍欄、解說牌與樹穴是否完整`, why: '官方分級' });
  }
  if (!tree.diameter_cm) {
    items.push({ label: '實測胸徑（離地 1.3m 處，cm）', why: '官方未提供胸徑' });
  }
  if (!tree.crown_m) {
    items.push({ label: '實測冠幅（東西向、南北向，m）', why: '官方未提供冠幅' });
  }
  if (Number(tree.age_years) >= 100) {
    items.push({ label: '檢查樹穴土壤壓實與排水、根系裸露情形', why: `樹齡 ${tree.age_years} 年` });
  }
  if (tree.geo_precision && tree.geo_precision !== 'official') {
    items.push({ label: '以手機 GPS 校正座標', why: `目前座標為${tree.geo_precision}` });
  }
  if (!tree.photo_count) {
    items.push({ label: '補拍全景與樹幹特寫', why: '官方未提供照片' });
  }
  items.push({ label: '記錄當時天氣、人為活動（施工／遊人）與其他觀察', why: '現場環境' });
  return items;
}

/** 把 /api/tree 的回傳整理成一張檔案卡需要的欄位（純函式）。 */
export function cardModel(tree = {}, opts = {}) {
  const base = opts.base || '';
  const iso = opts.date || '';
  const metrics = [
    ['古樹編號', dash(tree.tree_no)],
    ['市政署名錄編號', dash(tree.iam_tree_no || tree.official_no)],
    ['樹種', dash(tree.species)],
    ['學名', dash(tree.name_sci)],
    ['堂區', dash(tree.parish)],
    ['地點', dash(tree.site)],
    ['座標', tree.lat != null && tree.lon != null
      ? `${Number(tree.lat).toFixed(6)}, ${Number(tree.lon).toFixed(6)}（${tree.geo_precision || '未標示'}）`
      : '官方未提供'],
    ['樹齡', tree.age_years != null ? `${num(tree.age_years)} 年` : '官方未提供'],
    ['樹高', tree.height_m != null ? `${num(tree.height_m, 2)} m` : '官方未提供'],
    ['胸徑', tree.diameter_cm != null ? `${num(tree.diameter_cm, 1)} cm` : '官方未提供'],
    ['冠幅', tree.crown_m != null ? `${num(tree.crown_m, 2)} m` : '官方未提供'],
    ['健康狀況', dash(tree.health)],
    ['樹齡分級', dash(tree.grade)],
  ];
  return {
    no: String(tree.tree_no ?? ''),
    title: `古樹檔案卡 ${tree.tree_no ?? ''}・${tree.species || '未知樹種'}`,
    species: tree.species || '',
    sci: tree.name_sci || '',
    parish: tree.parish || '',
    site: tree.site || '',
    metrics,
    photo: tree.tree_photo || tree.species_photo || '',
    photoNote: tree.tree_photo
      ? `照片來源：市政署澳門自然網（${tree.tree_photo_source || '官方逐株照片'}）`
      : (tree.species_photo ? `官方逐株照片已下架，改用樹種相片（${tree.species_photo_credit || 'Wikimedia Commons'}）` : '官方未提供照片'),
    description: String(tree.official_description || '').trim(),
    checks: checkItems(tree),
    qrUrl: treeUrl(tree.tree_no, { base, mode: 'map' }),
    fieldUrl: treeUrl(tree.tree_no, { base, mode: 'field' }),
    sources: [
      '資料來源：澳門市政署《古樹名木保護名錄》與市政署澳門自然網古樹名木公開資料',
      '座標、樹齡、樹高、健康、分級、描述與照片均依官方公告，未列入者標示「官方未提供」',
    ],
    generatedAt: iso,
  };
}

/* ── A4 頁面（純字串，可測試） ─────────────────────────── */

const pageShell = (inner, extraClass = '') =>
  `<article class="card-page ${extraClass}">${inner}</article>`;

function photoBlock(model) {
  if (!model.photo) {
    return `<div class="card-photo card-photo-empty"><span>官方未提供照片<br>請於現場補拍</span></div>`;
  }
  return `<figure class="card-photo"><img src="${esc(model.photo)}" alt="${esc(model.species)} 照片" loading="lazy">
    <figcaption>${esc(model.photoNote)}</figcaption></figure>`;
}

/** 單株 A4 檔案卡。 */
export function cardHtml(model, opts = {}) {
  const qr = opts.qr !== false ? qrSvg(model.qrUrl, { size: 34 }) : '';
  const checks = model.checks.map((c) => `<li><span class="box"></span>${esc(c.label)}<em>（${esc(c.why)}）</em></li>`).join('');
  const metrics = model.metrics.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const desc = model.description
    ? `<p class="card-desc">${esc(model.description.length > 420 ? `${model.description.slice(0, 420)}…` : model.description)}</p>`
    : `<p class="card-desc card-muted">官方未提供形態描述。</p>`;
  const inner = `
    <header class="card-head">
      <div>
        <p class="card-kicker">澳門古樹保育研究平台</p>
        <h2>古樹檔案卡</h2>
      </div>
      <div class="card-tags">
        <span class="tag">編號 ${esc(model.no)}</span>
        <span class="tag">${esc(model.parish || '堂區未提供')}</span>
      </div>
    </header>
    <div class="card-body">
      <div class="card-col-left">
        ${photoBlock(model)}
        <div class="card-qr">${qr}<p>掃描開啟線上詳情</p><p class="card-url">${esc(model.qrUrl)}</p></div>
      </div>
      <div class="card-col-right">
        <table class="card-table">${metrics}</table>
        <h3>形態描述（官方）</h3>
        ${desc}
        <h3>現場查核清單</h3>
        <ul class="card-checklist">${checks}</ul>
      </div>
    </div>
    <footer class="card-foot">
      <p>${model.sources.map(esc).join('　｜　')}</p>
      <p>產生時間：${esc(model.generatedAt || '－')}　｜　本卡由平台依公開資料自動產生，非官方文件</p>
    </footer>`;
  return pageShell(inner, 'card-tree');
}

/** 空白實地考察單（可選擇是否帶入某株的基本資料）。 */
export function fieldFormHtml(tree, opts = {}) {
  const base = opts.base || '';
  const model = tree ? cardModel(tree, opts) : null;
  const qr = tree ? qrSvg(model.fieldUrl, { size: 30 }) : '';
  const idRows = model
    ? model.metrics.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')
    : ['古樹編號', '樹種', '堂區／地點', '座標']
      .map((k) => `<tr><th>${esc(k)}</th><td class="blank"></td></tr>`).join('');
  const rows = [
    ['日期／時間', '', '天氣', ''],
    ['調查人員', '', '同行人數', ''],
    ['胸徑（離地 1.3m，cm）', '', '樹高（m）', ''],
    ['冠幅 東西向（m）', '', '冠幅 南北向（m）', ''],
    ['健康狀況（健康／一般／需關注／瀕危）', '', '樹齡分級（一級／二級／三級／不分級）', ''],
  ].map(([a, b, c, d]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td><th>${esc(c)}</th><td>${esc(d)}</td></tr>`).join('');
  const checks = (model ? model.checks : checkItems({})).map((c) => `<li><span class="box"></span>${esc(c.label)}</li>`).join('');
  const inner = `
    <header class="card-head">
      <div>
        <p class="card-kicker">澳門古樹保育研究平台</p>
        <h2>實地考察紀錄單</h2>
      </div>
      <div class="card-tags">${model ? `<span class="tag">編號 ${esc(model.no)}</span><span class="tag">${esc(model.species)}</span>` : '<span class="tag">空白表</span>'}</div>
    </header>
    <div class="card-body">
      <div class="card-col-left">
        <table class="card-table">${idRows}</table>
        <h3>現場量測與觀察</h3>
        <table class="card-table card-form">${rows}</table>
        <h3>樹體與環境檢查（現場勾選）</h3>
        <ul class="card-checklist">${checks}</ul>
      </div>
      <div class="card-col-right">
        <div class="card-note">
          <h3>記錄說明</h3>
          <ol>
            <li>本單記錄學生的現場觀察，不會覆寫市政署官方名錄。</li>
            <li>缺值欄位請以工具實測（捲尺／測高計／手機 GPS），不確定者填「未確認」。</li>
            <li>回到有網路處可於平台「實地考察」分頁輸入，或將本單拍照上傳。</li>
            <li>如發現立即危險（樹幹傾斜、斷枝懸掛），請通報市政署並記錄時間。</li>
          </ol>
        </div>
        <div class="card-sketch">
          <h3>素描／附註</h3>
          <div class="sketch-area"></div>
        </div>
        ${qr ? `<div class="card-qr">${qr}<p>掃描開啟本株的線上紀錄表</p></div>` : ''}
      </div>
    </div>
    <footer class="card-foot">
      <p>澳門古樹保育研究平台　｜　資料來源：澳門市政署《古樹名木保護名錄》與市政署澳門自然網</p>
      <p>產生時間：${esc((opts.date) || '－')}　｜　本單為研究用途，非官方文件</p>
    </footer>`;
  return pageShell(inner, 'card-form-page');
}

/* ── 路綫示意圖（不用地圖磚，避免列印缺圖） ───────────────── */

/** 經緯度 → 粗略平面座標（以平均緯度修正經度方向的比例）。 */
export function projectXY(points) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / (points.length || 1);
  const kx = Math.cos((lat0 * Math.PI) / 180);
  return points.map((p) => ({ x: p.lon * kx, y: -p.lat, lat: p.lat, lon: p.lon, label: p.label || '' }));
}

/** 路綫站點示意圖（SVG，含比例尺與指北針）。 */
export function schematicMapSvg(points, opts = {}) {
  const width = opts.width || 460;
  const height = opts.height || 300;
  const pad = 34;
  if (!points || !points.length) {
    return `<svg class="card-map" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="無站點資料"><rect width="${width}" height="${height}" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#666" font-size="12">無站點資料</text></svg>`;
  }
  const pts = projectXY(points);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const toXY = (p) => ({ x: offsetX + (p.x - minX) * scale, y: offsetY + (p.y - minY) * scale });

  const coords = pts.map(toXY);
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const marks = coords.map((c, i) => {
    // 右半邊的站名若往右寫會超出圖外（列印會被裁掉）→ 改為向左、靠右對齊
    const flip = c.x > width * 0.62;
    const labelX = flip ? c.x - 12 : c.x + 12;
    return `
    <g class="map-stop">
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="9" fill="#0f766e" stroke="#fff" stroke-width="2"/>
      <text x="${c.x.toFixed(1)}" y="${(c.y + 3.4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#fff">${i + 1}</text>
      ${pts[i].label ? `<text x="${labelX.toFixed(1)}" y="${(c.y + 4).toFixed(1)}" text-anchor="${flip ? 'end' : 'start'}" font-size="9.5" fill="#0f172a">${esc(String(pts[i].label).slice(0, 14))}</text>` : ''}
    </g>`;
  }).join('');

  // 比例尺：投影後 1 度緯度 ≈ 111.32 km；x 方向已乘 cos(緯度)，
  // 因此換算回實際距離時，兩個方向的「每像素公尺數」都約為 111320 / scale。
  const metersPerPx = 111320 / scale;
  const barPx = Math.min(140, (width - pad * 2) * 0.45);
  const barMeters = barPx * metersPerPx;
  const niceMeters = barMeters >= 1000
    ? Math.max(500, Math.round(barMeters / 500) * 500)
    : Math.max(50, Math.round(barMeters / 50) * 50);
  const nicePx = niceMeters / metersPerPx;

  return `<svg class="card-map" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="路綫站點示意圖">
    <rect width="${width}" height="${height}" fill="#fff"/>
    <path d="${path}" fill="none" stroke="#0f766e" stroke-width="1.6" stroke-dasharray="5 4"/>
    ${marks}
    <g class="map-scale">
      <line x1="${pad}" y1="${height - 16}" x2="${(pad + nicePx).toFixed(1)}" y2="${height - 16}" stroke="#0f172a" stroke-width="1.6"/>
      <line x1="${pad}" y1="${height - 20}" x2="${pad}" y2="${height - 12}" stroke="#0f172a" stroke-width="1.6"/>
      <line x1="${(pad + nicePx).toFixed(1)}" y1="${height - 20}" x2="${(pad + nicePx).toFixed(1)}" y2="${height - 12}" stroke="#0f172a" stroke-width="1.6"/>
      <text x="${pad}" y="${height - 22}" font-size="9.5" fill="#0f172a">約 ${niceMeters >= 1000 ? `${(niceMeters / 1000).toFixed(1)} km` : `${niceMeters} m`}</text>
    </g>
    <g class="map-north">
      <text x="${width - 18}" y="20" font-size="11" fill="#0f172a">N↑</text>
    </g>
    <text x="${width - 12}" y="${height - 8}" text-anchor="end" font-size="9" fill="#64748b">示意圖，非等比地圖</text>
  </svg>`;
}

/** 路綫資料冊：封面 ＋ 每個停靠站一頁。 */
/** /api/route 的回傳是 {route, statistics, stops, estimate, algorithm}；
 *  這裡同時接受「整包回傳」與「單獨的 route 物件」，避免呼叫端踩雷。 */
export function routeBookHtml(data = {}, opts = {}) {
  const meta = data.route || data;
  const stops = data.stops || meta.stops || [];
  const stats = data.statistics || meta.statistics || {};
  const base = opts.base || '';
  const coverUrl = `${base}/#/routes?route=${encodeURIComponent(meta.code || '')}`;
  const cover = pageShell(`
    <header class="card-head">
      <div><p class="card-kicker">澳門古樹保育研究平台</p><h2>路綫資料冊</h2></div>
      <div class="card-tags"><span class="tag">${esc(meta.code || '')}</span><span class="tag">${stops.length} 站</span></div>
    </header>
    <div class="book-cover">
      <h3>${esc(meta.name || '未命名路綫')}</h3>
      <p class="card-desc">${esc(meta.summary || '')}</p>
      <ul class="book-stats">
        <li>停靠站數：<strong>${stops.length}</strong></li>
        <li>涵蓋古樹：<strong>${num(stats.trees_covered || 0)}</strong> 株</li>
        <li>涵蓋樹種：<strong>${num(stats.species_count || 0)}</strong> 個</li>
        <li>焦點樹種：<strong>${esc(meta.species_focus || '－')}</strong></li>
      </ul>
      ${schematicMapSvg(stops.map((s, i) => ({ lat: s.lat, lon: s.lon, label: s.site })), { width: 460, height: 300 })}
      <div class="book-cover-foot">
        <div class="card-qr">${qrSvg(coverUrl, { size: 30 })}<p>掃描開啟線上路綫</p></div>
        <div>${esc(meta.tips || '')}</div>
      </div>
    </div>
    <footer class="card-foot">
      <p>站點資料來源：澳門市政署《古樹名木保護名錄》與市政署澳門自然網　｜　示意圖僅表示相對位置</p>
      <p>產生時間：${esc(opts.date || '－')}</p>
    </footer>`, 'card-cover');

  const pages = stops.map((s, i) => {
    const trees = (s.trees || []).slice(0, 6);
    const rows = trees.map((t) => `<tr><td>${esc(t.tree_no)}</td><td>${esc(t.species)}</td><td>${num(t.age_years)} 年</td><td>${esc(t.health || '')}</td><td>${esc(t.grade || '')}</td></tr>`).join('');
    const qr = qrSvg(treeUrl(trees[0] ? trees[0].tree_no : '', { base, mode: 'map' }), { size: 26 });
    return pageShell(`
      <header class="card-head">
        <div><p class="card-kicker">路綫資料冊　${esc(meta.name || '')}</p><h2>第 ${i + 1} 站　${esc(s.site || '')}</h2></div>
        <div class="card-tags"><span class="tag">${num(s.tree_count)} 株</span><span class="tag">最老 ${num(s.oldest)} 年</span></div>
      </header>
      <div class="book-stop">
        <table class="card-table">
          <tr><th>站序</th><td>${i + 1} / ${stops.length}</td><th>堂區</th><td>${esc(s.parish || '－')}</td></tr>
          <tr><th>座標</th><td>${s.lat != null ? `${Number(s.lat).toFixed(6)}, ${Number(s.lon).toFixed(6)}` : '官方未提供'}</td><th>樹種數</th><td>${num((s.species_list || []).length)}</td></tr>
        </table>
        <h3>本站古樹（依樹齡）</h3>
        <table class="card-table card-list"><thead><tr><th>編號</th><th>樹種</th><th>樹齡</th><th>健康</th><th>分級</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="book-stop-foot">
          <div class="card-qr">${qr}<p>掃描開啟首株詳情</p></div>
          <div class="card-note"><h3>觀察重點</h3><ul>${(s.notes || []).map((n) => `<li>${esc(n)}</li>`).join('') || '<li>記錄樹穴、枝葉與周邊設施狀況</li>'}</ul></div>
        </div>
      </div>
      <footer class="card-foot"><p>${esc(meta.name || '')}　｜　座標依市政署公開資料</p><p>產生時間：${esc(opts.date || '－')}</p></footer>`, 'card-stop');
  });

  return { pages: [cover, ...pages], html: [cover, ...pages].join('\n') };
}

/* ── 畫面（列印分頁） ─────────────────────────────────── */

const stamp = () => new Date().toLocaleString('zh-TW', { hour12: false });

export async function render(section, params = new URLSearchParams()) {
  const mode = params.get('mode') || (params.get('route') ? 'book' : (params.get('field') ? 'form' : 'card'));
  const base = location.origin;
  section.innerHTML = `
    <h1 class="view-title">列印</h1>
    <p class="view-sub">把古樹資料變成可帶去現場的紙本：單株檔案卡、空白考察單、整條路綫的資料冊。按「列印／存成 PDF」後在列印對話框選擇「另存為 PDF」即可。</p>
    <div class="card-controls">
      <div class="seg" role="tablist">
        <button type="button" class="seg-btn${mode === 'card' ? ' active' : ''}" data-mode="card">古樹檔案卡</button>
        <button type="button" class="seg-btn${mode === 'form' ? ' active' : ''}" data-mode="form">實地考察單</button>
        <button type="button" class="seg-btn${mode === 'book' ? ' active' : ''}" data-mode="book">路綫資料冊</button>
      </div>
      <label class="field" data-only="card"><span>古樹編號</span><input type="number" min="1" id="c-no" value="${esc(params.get('tree') || '66')}"></label>
      <label class="field" data-only="form"><span>帶入古樹編號（可留空＝空白表）</span><input type="number" min="1" id="f-no" value="${esc(params.get('tree') || '')}"></label>
      <label class="field" data-only="book"><span>路綫</span><select id="b-route"></select></label>
      <button type="button" class="btn" id="c-build">產生預覽</button>
      <button type="button" class="btn btn-primary" id="c-print" hidden>列印／存成 PDF</button>
    </div>
    <p class="card-hint" id="c-hint">提示：列印對話框請選 A4、邊界「預設」、並勾選「背景圖形」以保留色塊與框線。</p>
    <div class="card-sheet-wrap"><div id="c-sheet" class="card-sheet"></div></div>`;

  const sheet = section.querySelector('#c-sheet');
  const hint = section.querySelector('#c-hint');
  const printBtn = section.querySelector('#c-print');
  let mode2 = mode;

  // 路綫下拉
  const routeSel = section.querySelector('#b-route');
  try {
    const data = await api.routes();
    const wanted = params.get('route') || '';
    routeSel.innerHTML = (data.routes || [])
      .map((r) => `<option value="${esc(r.code)}"${r.code === wanted ? ' selected' : ''}>${esc(r.name)}（${r.site_count} 站）</option>`)
      .join('') || '<option value="">（尚無路綫）</option>';
  } catch (err) {
    routeSel.innerHTML = '<option value="">（路綫載入失敗）</option>';
  }

  const applyMode = (m) => {
    mode2 = m;
    section.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    section.querySelectorAll('[data-only]').forEach((el2) => { el2.hidden = el2.dataset.only !== m; });
  };
  applyMode(mode2);
  section.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => { applyMode(b.dataset.mode); sheet.innerHTML = ''; printBtn.hidden = true; }));

  const build = async () => {
    loading(sheet, '產生中…');
    printBtn.hidden = true;
    try {
      if (mode2 === 'card') {
        const no = section.querySelector('#c-no').value.trim();
        if (!no) { sheet.innerHTML = '<p class="empty">請輸入古樹編號。</p>'; return; }
        const data = await api.tree(no);
        sheet.innerHTML = cardHtml(cardModel(data.tree, { base, date: stamp() }));
        hint.textContent = `已產生 1 頁（編號 ${no}・${data.tree.species}）。列印對話框請選 A4、勾選「背景圖形」。`;
      } else if (mode2 === 'form') {
        const no = section.querySelector('#f-no').value.trim();
        const tree = no ? (await api.tree(no)).tree : null;
        sheet.innerHTML = fieldFormHtml(tree, { base, date: stamp() });
        hint.textContent = tree ? `已產生 1 頁考察單（已帶入編號 ${no} 的基本資料）。` : '已產生 1 頁空白考察單（未帶入任何古樹）。';
      } else {
        const code = routeSel.value;
        if (!code) { sheet.innerHTML = '<p class="empty">沒有可印的路綫。</p>'; return; }
        const data = await api.route({ code });
        // 注意：/api/route 回傳 {route, statistics, stops, ...}，
        // 必須整包交給 routeBookHtml，只傳 data.route 會掉掉所有停靠站（各站頁就全沒了）。
        const book = routeBookHtml(data, { base, date: stamp() });
        sheet.innerHTML = book.html;
        hint.textContent = `已產生 ${book.pages.length} 頁（封面 ＋ ${book.pages.length - 1} 站）；每一頁自成一張 A4。`;
      }
      printBtn.hidden = false;
    } catch (err) {
      sheet.innerHTML = `<p class="empty">產生失敗：${esc(err && err.message ? err.message : String(err))}</p>`;
      toast('產生失敗');
    }
  };

  section.querySelector('#c-build').addEventListener('click', build);
  printBtn.addEventListener('click', () => window.print());
  await build();
}

export default { render, cardModel, cardHtml, fieldFormHtml, routeBookHtml, schematicMapSvg, checkItems, projectXY };
