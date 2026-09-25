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
/**
 * 座標精度代碼 → 中文說法。資料庫存的是英文代碼（official／exact／approx／parish），
 * 直接印在紙上會出現「（official）」這種外人看不懂的字，因此統一轉中文。
 */
export function geoLabel(code) {
  return { official: '市政署逐株實測座標', exact: '精確匹配', approx: '近似值', parish: '堂區中心' }[code]
    || (code ? String(code) : '未標示');
}

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
    items.push({ label: '以手機 GPS 校正座標', why: `目前座標為${geoLabel(tree.geo_precision)}` });
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
      ? `${Number(tree.lat).toFixed(6)}, ${Number(tree.lon).toFixed(6)}（${geoLabel(tree.geo_precision)}）`
      : '官方未提供'],
    ['樹齡', tree.age_years != null ? `${num(tree.age_years)} 年` : '官方未提供'],
    ['樹高', tree.height_m != null ? `${num(tree.height_m, 2)} m` : '官方未提供'],
    ['胸徑（市政署）', tree.diameter_cm != null
      ? `${num(tree.diameter_cm, 2)} cm${(tree.stem_count || 1) > 1 ? `（${tree.stem_count} 支主幹，取最大胸徑那支）` : ''}`
      : '官方未提供'],
    ['胸圍（市政署）', tree.girth_cm != null ? `${num(tree.girth_cm, 1)} cm` : '官方未提供'],
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
    stemMeasures: String(tree.stem_measures || '').trim(),
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
        ${model.stemMeasures ? `<h3>各主幹量測（官方）</h3><p class="card-desc">${esc(model.stemMeasures)}</p>` : ''}
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

/**
 * 優先保育名單（A4）：第一頁是評分方法與摘要，其後分頁列名次。
 * 純函式，方便測試頁數與欄位。
 */
export const PRIORITY_PAGE_ROWS = 40;

export function priorityListHtml(data = {}, opts = {}) {
  const items = data.items || [];
  const m = data.method || { weights: {}, steps: [], marks: [], caveats: [] };
  const s = data.summary || {};
  const per = opts.pageRows || PRIORITY_PAGE_ROWS;

  const methodRows = (m.steps || []).map((x) => `<tr><th>${esc(x.name)}</th><td>${num(x.weight)} 分</td><td>${esc(x.rule)}</td></tr>`).join('');
  // 「分數刻度」只用來說明閱讀分組，刻意不叫「級」——級別一律以官方為準。
  const markRows = (m.marks || []).map((t) => `<tr><th>${esc(t.label)}</th><td>${esc(t.hint)}</td></tr>`).join('');
  // 封面刻意拆成兩張 A4：兩欄式版面在列印時無法跨頁（實測一張封面被切成 4 張紙），
  // 因此改成「單欄、兩頁」，頁數才可預期：2 ＋ 名單分頁。
  const cover = `<article class="card-page card-priority">
    <header class="card-head">
      <div>
        <h1>澳門古樹優先保育名單</h1>
        <p class="card-sub">依樹齡、官方健康狀況、官方分級、樹種稀有度、區位風險五項評分（合計 ${num(m.total || 100)} 分）｜分級一律採官方名錄</p>
      </div>
      <div class="card-tags"><span class="tag">共 ${num(data.evaluated)} 株受評</span><span class="tag">本表列出 ${num(items.length)} 株</span></div>
    </header>
    <h3>一、評分方法</h3>
    <table class="card-table"><tbody>${methodRows}</tbody></table>
    <h3>二、分數刻度（閱讀用，不是分級）</h3>
    <table class="card-table"><tbody>${markRows}</tbody></table>
    <p class="card-desc">${esc(m.grading_policy || '分級一律以官方為準，本表不自行分級。')}</p>
    <footer class="card-foot"><p>資料來源：市政署《古樹名木保護名錄》公開資料（本表僅重新排序，未變更官方數據）</p>
      <p>產生時間：${esc(opts.date || '－')}　｜　本表由平台自動產生，非官方文件</p></footer>
  </article>`;

  const guide = `<article class="card-page card-priority">
    <header class="card-head compact">
      <div><h2>澳門古樹優先保育名單｜評估結果與使用說明</h2></div>
      <div class="card-tags"><span class="tag">方法與限制</span></div>
    </header>
    <h3>三、整體結果</h3>
    <table class="card-table"><tbody>
      <tr><th>受評古樹</th><td>${num(s.evaluated)} 株（全澳名錄）</td></tr>
      <tr><th>官方分級：一級</th><td>${num((s.by_grade || {}).一級)} 株</td></tr>
      <tr><th>官方分級：二級</th><td>${num((s.by_grade || {}).二級)} 株</td></tr>
      <tr><th>官方分級：三級</th><td>${num((s.by_grade || {}).三級)} 株</td></tr>
      <tr><th>官方分級：不分級</th><td>${num((s.by_grade || {}).不分級)} 株</td></tr>
      <tr><th>官方健康狀況：瀕危</th><td>${num((s.by_health || {}).瀕危)} 株</td></tr>
      <tr><th>官方健康狀況：一般</th><td>${num((s.by_health || {}).一般)} 株</td></tr>
      <tr><th>官方健康狀況：健康</th><td>${num((s.by_health || {}).健康)} 株</td></tr>
      <tr><th>平均分數（本站排序用）</th><td>${num(s.mean_score, 1)} 分</td></tr>
      <tr><th>75 分以上／60–74 分</th><td>${num((s.by_score || {}).m75)} 株／${num((s.by_score || {}).m60)} 株（閱讀分組，非分級）</td></tr>
      ${s.top ? `<tr><th>最高分</th><td>#${esc(s.top.tree_no)} ${esc(s.top.species)}（${num(s.top.age_years)} 年・官方健康狀況 ${esc(s.top.health || '—')}・官方分級 ${esc(s.top.grade || '未列級')}）${num(s.top.score)} 分</td></tr>` : ''}
    </tbody></table>
    <h3>四、名次規則</h3>
    <p class="card-desc">${esc(m.tie_break || '')}</p>
    <h3>五、使用限制（請務必一起看）</h3>
    <ul class="card-list">${(m.caveats || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <footer class="card-foot"><p>分數＝樹齡＋健康狀況＋官方級別＋樹種稀有度＋區位風險（合計 100 分）</p>
      <p>產生時間：${esc(opts.date || '－')}</p></footer>
  </article>`;

  const chunks = [];
  for (let i = 0; i < items.length; i += per) chunks.push(items.slice(i, i + per));

  const pages = chunks.map((chunk, idx) => `<article class="card-page card-priority">
    <header class="card-head compact">
      <div><h2>優先保育名單（續）</h2></div>
      <div class="card-tags"><span class="tag">第 ${idx + 1}／${chunks.length} 頁</span>
        <span class="tag">${num(chunk[0].rank)}–${num(chunk[chunk.length - 1].rank)} 名</span></div>
    </header>
    <table class="card-table prio">
      <thead><tr><th>名次</th><th>編號</th><th>樹種</th><th>樹齡</th><th>健康（官方）</th><th>分級（官方）</th><th>胸徑</th><th>風險</th><th>分數</th><th>主要理由</th></tr></thead>
      <tbody>${chunk.map((r) => `<tr>
        <td>${num(r.rank)}</td><td>#${esc(r.tree_no)}</td><td>${esc(r.species)}</td>
        <td>${num(r.age_years)}</td><td>${esc(r.health)}</td><td>${esc(r.grade || '—')}</td>
        <td>${r.diameter_cm == null ? '—' : num(r.diameter_cm, 1)}</td>
        <td>${esc(({ high: '高', mid: '中', low: '低' })[r.risk_level] || '中')}</td>
        <td><strong>${num(r.score)}</strong></td>
        <td class="small">${esc((r.reasons || []).slice(0, 2).join('；'))}</td>
      </tr>`).join('')}</tbody>
    </table>
    <footer class="card-foot"><p>分數＝樹齡＋健康狀況＋官方級別＋樹種稀有度＋區位風險（合計 100 分）</p>
      <p>產生時間：${esc(opts.date || '－')}</p></footer>
  </article>`);

  return { pages: [cover, guide, ...pages], html: [cover, guide, ...pages].join('\n') };
}

/**
 * 路綫下拉選項（純函式，可測試）。
 *
 * 2026-09-25 修正的 bug：原本顯示「（${r.site_count} 站）」，而 site_count 是「候選地點數」，
 * 「路綫五：全澳最老古樹巡禮」的候選地點刻意是空的（停靠點由系統按樹齡自動選出），
 * 因此畫面出現「（0 站）」這種不可能的數字——它明明會產生 10 站。
 * 現在一律顯示該路綫自己的 max_stops（策劃時設定的停靠上限），並把實際產生的站數
 * 交給產生後的提示顯示（「已產生 N 頁（封面 ＋ M 站）」），兩者不再互相矛盾。
 */
export function routeOptionsHtml(routes = [], wanted = '') {
  const opts = (routes || []).map((r) => {
    const max = Number(r.max_stops) || 0;
    const places = Number(r.site_count) || 0;
    const label = max > 0 ? `最多 ${max} 站` : '站數依產生結果';
    const extra = places > 0 ? `${places} 個候選地點・` : '';
    return `<option value="${esc(r.code)}" data-max="${max}"${r.code === wanted ? ' selected' : ''}>${esc(r.name)}（${extra}${label}）</option>`;
  });
  return opts.join('') || '<option value="">（尚無路綫）</option>';
}

/* ── 畫面（列印分頁） ─────────────────────────────────── */

const stamp = () => new Date().toLocaleString('zh-TW', { hour12: false });

export async function render(section, params = new URLSearchParams()) {
  const mode = params.get('mode') || (params.get('route') ? 'book' : (params.get('field') ? 'form' : 'card'));
  const prioLimit = params.get('limit') || '50';
  const prioGrade = params.get('grade') || '';
  const prioHealth = params.get('health') || '';
  const base = location.origin;
  section.innerHTML = `
    <h1 class="view-title">列印</h1>
    <p class="view-sub">把古樹資料變成可帶去現場的紙本：單株檔案卡、空白考察單、整條路綫的資料冊。按「列印／存成 PDF」後在列印對話框選擇「另存為 PDF」即可。</p>
    <div class="card-controls">
      <div class="seg" role="tablist">
        <button type="button" class="seg-btn${mode === 'card' ? ' active' : ''}" data-mode="card">古樹檔案卡</button>
        <button type="button" class="seg-btn${mode === 'form' ? ' active' : ''}" data-mode="form">實地考察單</button>
        <button type="button" class="seg-btn${mode === 'book' ? ' active' : ''}" data-mode="book">路綫資料冊</button>
        <button type="button" class="seg-btn${mode === 'priority' ? ' active' : ''}" data-mode="priority">優先保育名單</button>
      </div>
      <label class="field" data-only="card"><span>古樹編號</span><input type="number" min="1" id="c-no" value="${esc(params.get('tree') || '66')}"></label>
      <label class="field" data-only="form"><span>帶入古樹編號（可留空＝空白表）</span><input type="number" min="1" id="f-no" value="${esc(params.get('tree') || '')}"></label>
      <label class="field" data-only="book"><span>路綫</span><select id="b-route"></select></label>
      <label class="field" data-only="priority"><span>名單長度</span>
        <select id="p-limit2">${['20', '50', '100', '200', '0'].map((v) => `<option value="${v}"${prioLimit === v ? ' selected' : ''}>${v === '0' ? '全部 658 株' : `前 ${v} 株`}</option>`).join('')}</select></label>
      <label class="field" data-only="priority"><span>官方分級</span>
        <select id="p-grade2"><option value="">全部分級</option>
          ${['一級', '二級', '三級', '不分級'].map((g) => `<option value="${g}"${prioGrade === g ? ' selected' : ''}>${g}</option>`).join('')}
        </select></label>
      <label class="field" data-only="priority"><span>官方健康狀況</span>
        <select id="p-health2"><option value="">全部健康狀況</option>
          ${['健康', '一般', '瀕危'].map((h) => `<option value="${h}"${prioHealth === h ? ' selected' : ''}>${h}</option>`).join('')}
        </select></label>
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
    routeSel.innerHTML = routeOptionsHtml(data.routes || [], wanted);
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
      } else if (mode2 === 'priority') {
        const limit = section.querySelector('#p-limit2').value;
        const grade = section.querySelector('#p-grade2').value;
        const health = section.querySelector('#p-health2').value;
        const data = await api.priority({ limit, grade, health });
        const list = priorityListHtml(data, { date: stamp() });
        sheet.innerHTML = list.html;
        hint.textContent = `已產生 ${list.pages.length} 頁（方法頁 1 頁 ＋ 名單 ${list.pages.length - 1} 頁，每頁 ${PRIORITY_PAGE_ROWS} 列）。`;
      } else {
        const code = routeSel.value;
        if (!code) { sheet.innerHTML = '<p class="empty">沒有可印的路綫。</p>'; return; }
        // 把路綫自己的停靠上限傳進去，成品站數才會與下拉顯示的「最多 N 站」一致
        const maxStops = Number((routeSel.selectedOptions[0] || {}).dataset?.max) || undefined;
        const data = await api.route({ code, max_stops: maxStops });
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

export default { render, cardModel, cardHtml, fieldFormHtml, routeBookHtml, priorityListHtml, schematicMapSvg, checkItems, projectXY };
