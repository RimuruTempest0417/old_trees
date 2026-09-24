/**
 * 每株古樹的二維碼（QR code）。
 *
 * 用途：把 658 株古樹各產生一個 QR 碼，掃描後直接開啟該株的
 *   - 古樹詳情（`#/map?tree=<編號>`），或
 *   - 實地考察紀錄表單（`#/field?tree=<編號>`，會自動帶入古樹編號）
 * 方便實地考察時在樹上掛牌、或做班級活動時分派任務。
 *
 * 編碼使用 public/vendor/qrcode.js（qrcode-generator 1.4.4，MIT，Kazuhiko Arase），
 * 以 `<script src>` 載入為全域 `qrcode`；本模組自己把矩陣畫成 SVG，
 * 這樣列印時是向量、不會模糊，也能加上無障礙屬性。
 *
 * 本模組同時匯出 `treeUrl`／`qrMatrix`／`qrSvg`，供地圖的詳情面板與測試使用。
 */
import { api } from './api.js';
import { esc, loading, toast, copyText, errDetail, openModal } from './ui.js';

/** 取得 QR 編碼程式庫（瀏覽器為 window.qrcode；Node 測試時可先掛到 globalThis.qrcode） */
function lib() {
  const q = globalThis.qrcode || (globalThis.window && globalThis.window.qrcode);
  if (typeof q !== 'function') throw new Error('QR 編碼程式庫未載入（預期 /vendor/qrcode.js）');
  return q;
}

/**
 * 網站根網址（結尾必為 `/`）。
 * 產生的連結必須是「絕對網址」——掃描者多半在手機、與產生者不同裝置，
 * 相對路徑無法使用。
 */
export function siteBase(href) {
  const u = new URL(href || (globalThis.location && globalThis.location.href) || 'https://example.com/');
  return `${u.origin}${u.pathname.replace(/[^/]*$/, '')}`;
}

/**
 * 單株古樹的 QR 目標網址。
 * @param {string|number} no 古樹編號
 * @param {{mode?: 'map'|'field', base?: string}} [opts] mode 決定掃描後開啟詳情還是考察表單
 */
export function treeUrl(no, opts = {}) {
  const mode = opts.mode === 'field' ? 'field' : 'map';
  const base = opts.base || siteBase();
  return `${base}#/${mode}?tree=${encodeURIComponent(String(no))}`;
}

/**
 * 把文字編成 QR 模組矩陣。
 * @param {string} text
 * @param {{level?: 'L'|'M'|'Q'|'H'}} [opts] 預設 M（約可容忍 15% 污損，適合貼在樹上風吹日曬）
 * @returns {{count: number, isDark: (r: number, c: number) => boolean}}
 */
export function qrMatrix(text, opts = {}) {
  const level = ['L', 'M', 'Q', 'H'].includes(opts.level) ? opts.level : 'M';
  const code = lib()(0, level);          // 0 = 依內容長度自動挑版本
  code.addData(String(text));            // 自動選擇數字／英數／位元組模式（含 UTF-8）
  code.make();
  return { count: code.getModuleCount(), isDark: (r, c) => code.isDark(r, c) };
}

/**
 * 產生 SVG 字串（向量、可列印；深色模組合成單一 path，DOM 輕量）。
 * @param {string} text 要編碼的文字
 * @param {{level?: string, margin?: number, dark?: string, light?: string, title?: string}} [opts]
 */
export function qrSvg(text, opts = {}) {
  const { count, isDark } = qrMatrix(text, opts);
  const margin = Number.isInteger(opts.margin) ? opts.margin : 2;   // 靜區（quiet zone）模組數
  const size = count + margin * 2;
  const dark = opts.dark || '#111';
  const light = opts.light || '#fff';
  let d = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
  return `<svg class="qr-svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%"`
    + ` role="img" aria-label="${esc(opts.title || '古樹二維碼')}" shape-rendering="crispEdges">`
    + `${title}<rect width="${size}" height="${size}" fill="${light}"/>`
    + `<path d="${d}" fill="${dark}"/></svg>`;
}

/** 產生可供下載的 SVG 檔（含 XML 宣告與註明用途） */
export function qrSvgFile(text, opts = {}) {
  const svg = qrSvg(text, opts).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${esc(text)} -->\n${svg}\n`;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** 詳情面板用：以彈窗顯示單株的二維碼，可複製連結或下載 SVG */
export function openTreeQr(tree, opts = {}) {
  const mode = opts.mode === 'field' ? 'field' : 'map';
  const url = treeUrl(tree.tree_no, { mode });
  const label = `古樹 ${tree.tree_no}｜${tree.species || ''}`;
  const svg = qrSvg(url, { title: label, margin: 2 });
  openModal(`
    <h3>${esc(label)} 的二維碼</h3>
    <p class="muted small">掃描後開啟${mode === 'field' ? '這株樹的實地考察紀錄表單' : '這株古樹的詳情頁'}。
      程式為向量圖，放大或列印都不會模糊。</p>
    <div class="qr-preview">${svg}</div>
    <p class="qr-url mono small">${esc(url)}</p>
    <div class="qr-actions">
      <button class="btn btn-sm" data-copy="${esc(url)}">複製連結</button>
      <button class="btn btn-sm" data-svg="1">下載 SVG</button>
      <a class="btn btn-sm" href="${esc(url)}">開啟頁面</a>
      <button class="btn btn-sm btn-primary" data-print="1">列印</button>
    </div>`);

  const body = document.getElementById('modal-body');
  body.querySelector('[data-copy]')?.addEventListener('click', () => copyText(url));
  body.querySelector('[data-svg]')?.addEventListener('click', () => {
    download(`古樹${tree.tree_no}_QR.svg`, qrSvgFile(url, { title: label }), 'image/svg+xml');
    toast('已下載 SVG');
  });
  body.querySelector('[data-print]')?.addEventListener('click', () => window.print());
}

const MODE_LABEL = { map: '古樹詳情', field: '實地考察表單' };
const SORTS = {
  age: ['樹齡由高至低', (a, b) => (b.age_years || 0) - (a.age_years || 0)],
  no: ['編號由小至大', (a, b) => String(a.tree_no).localeCompare(String(b.tree_no), 'zh-Hant', { numeric: true })],
  site: ['地點名稱', (a, b) => String(a.site || '').localeCompare(String(b.site || ''), 'zh-Hant')],
};

/**
 * `#/qr` 分頁：挑選古樹 → 產生可列印的二維碼標籤。
 * 支援深連結：`#/qr?tree=66`、`#/qr?parish=花王堂區&mode=field&limit=48`
 */
export async function render(section, params = new URLSearchParams()) {
  const state = {
    mode: params.get('mode') === 'field' ? 'field' : 'map',
    parish: params.get('parish') || '',
    q: params.get('q') || '',
    limit: Number(params.get('limit')) || 24,
    sort: SORTS[params.get('sort')] ? params.get('sort') : 'age',
    tree: params.get('tree') || '',
    all: [],
  };

  section.innerHTML = loading('載入古樹清單…');
  let data;
  try {
    data = await api.trees({ limit: 5000 });
  } catch (err) {
    section.innerHTML = `<div class="card"><h2>讀取古樹清單失敗</h2><p class="muted">${esc(errDetail(err))}</p></div>`;
    return {};
  }
  state.all = data.trees || [];
  if (state.tree) {
    // 深連結指定單株：只產生那一張
    state.q = state.tree;
    state.limit = 0;
  }

  const parishes = [...new Set(state.all.map((t) => t.parish).filter(Boolean))].sort();

  section.innerHTML = `
    <div class="card">
      <h2>每株古樹的二維碼${state.tree ? `（單株 ${esc(state.tree)}）` : ''}</h2>
      <p class="muted">為 <strong>658 株古樹</strong>各產生一個二維碼：掃描即可在手機開啟該株的詳情，
        或直接填寫該株的實地考察紀錄（表單會自動帶入古樹編號）。
        標籤為向量圖，可直接列印貼在樹上或做成考察任務卡。</p>
      <div class="qr-controls">
        <label>掃描後開啟
          <select id="qr-mode">
            <option value="map"${state.mode === 'map' ? ' selected' : ''}>古樹詳情</option>
            <option value="field"${state.mode === 'field' ? ' selected' : ''}>實地考察表單</option>
          </select>
        </label>
        <label>堂區
          <select id="qr-parish">
            <option value="">全部堂區</option>
            ${parishes.map((p) => `<option value="${esc(p)}"${state.parish === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}
          </select>
        </label>
        <label>排序
          <select id="qr-sort">
            ${Object.entries(SORTS).map(([k, [label]]) =>
              `<option value="${k}"${state.sort === k ? ' selected' : ''}>${esc(label)}</option>`).join('')}
          </select>
        </label>
        <label>關鍵字
          <input id="qr-q" type="search" placeholder="編號／樹種／地點" value="${esc(state.q)}">
        </label>
        <label>數量
          <select id="qr-limit">
            ${[12, 24, 48, 120, 0].map((n) =>
              `<option value="${n}"${state.limit === n ? ' selected' : ''}>${n === 0 ? '全部符合' : `${n} 株`}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="qr-toolbar">
        <button class="btn btn-sm btn-primary" id="qr-generate">產生二維碼</button>
        <button class="btn btn-sm" id="qr-print">列印標籤</button>
        <span class="muted small" id="qr-count"></span>
      </div>
      <p class="small muted">提示：列印時標籤會自動以三欄排列；手機掃描需要能連上本網站
        （${esc(siteBase())}）。</p>
    </div>
    <div id="qr-sheet" class="qr-sheet" aria-live="polite"></div>`;

  const sheet = section.querySelector('#qr-sheet');
  const countEl = section.querySelector('#qr-count');

  function current() {
    const q = state.q.trim().toLowerCase();
    let rows = state.all.filter((t) => {
      // 深連結帶入單株編號時要精確比對：用關鍵字比對會連 166、266、366… 一起命中
      if (state.tree) return String(t.tree_no) === String(state.tree);
      if (state.parish && t.parish !== state.parish) return false;
      if (!q) return true;
      return `${t.tree_no} ${t.species || ''} ${t.site || ''} ${t.parish || ''}`.toLowerCase().includes(q);
    });
    rows = rows.slice().sort(SORTS[state.sort][1]);
    return state.limit > 0 ? rows.slice(0, state.limit) : rows;
  }

  function draw() {
    const rows = current();
    countEl.textContent = `共 ${rows.length} 張（全部 ${state.all.length} 株）`;
    if (!rows.length) {
      sheet.innerHTML = '<p class="muted">沒有符合條件的古樹，請調整篩選條件。</p>';
      return;
    }
    sheet.innerHTML = rows.map((t) => {
      const url = treeUrl(t.tree_no, { mode: state.mode });
      const title = `古樹 ${t.tree_no}｜${t.species || ''}｜${t.site || ''}`;
      return `
      <figure class="qr-label">
        <div class="qr-box">${qrSvg(url, { title, margin: 2 })}</div>
        <figcaption>
          <strong>古樹 ${esc(t.tree_no)}</strong>
          <span class="qr-species">${esc(t.species || '—')}</span>
          <span class="small muted">${esc(t.site || '')}${t.parish ? `・${esc(t.parish)}` : ''}</span>
          <span class="small muted">${t.age_years ? `${t.age_years} 年・` : ''}${MODE_LABEL[state.mode]}</span>
          <span class="qr-label-actions">
            <button class="btn btn-sm" data-svg="${esc(t.tree_no)}">SVG</button>
            <button class="btn btn-sm" data-copy="${esc(url)}">複製</button>
          </span>
        </figcaption>
      </figure>`;
    }).join('');
  }

  function syncFromUi() {
    state.mode = section.querySelector('#qr-mode').value === 'field' ? 'field' : 'map';
    state.parish = section.querySelector('#qr-parish').value;
    state.sort = section.querySelector('#qr-sort').value;
    state.q = section.querySelector('#qr-q').value;
    state.limit = Number(section.querySelector('#qr-limit').value);
    // 把目前條件寫進網址，方便分享或存書籤
    const p = new URLSearchParams();
    if (state.mode !== 'map') p.set('mode', state.mode);
    if (state.parish) p.set('parish', state.parish);
    if (state.sort !== 'age') p.set('sort', state.sort);
    if (state.q) p.set('q', state.q);
    if (state.limit !== 24) p.set('limit', String(state.limit));
    const hash = `#/qr${p.toString() ? `?${p}` : ''}`;
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
    draw();
  }

  section.querySelector('#qr-generate').addEventListener('click', syncFromUi);
  for (const id of ['#qr-mode', '#qr-parish', '#qr-sort', '#qr-limit']) {
    section.querySelector(id).addEventListener('change', syncFromUi);
  }
  let timer = null;
  section.querySelector('#qr-q').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(syncFromUi, 250);
  });
  section.querySelector('#qr-print').addEventListener('click', () => window.print());

  sheet.addEventListener('click', (e) => {
    const svgBtn = e.target.closest('[data-svg]');
    if (svgBtn) {
      const no = svgBtn.dataset.svg;
      const t = state.all.find((x) => String(x.tree_no) === String(no));
      download(`古樹${no}_QR.svg`,
        qrSvgFile(treeUrl(no, { mode: state.mode }), { title: `古樹 ${no}｜${t ? t.species || '' : ''}` }),
        'image/svg+xml');
      toast('已下載 SVG');
      return;
    }
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) copyText(copyBtn.dataset.copy);
  });

  draw();
  return {};
}
