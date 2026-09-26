#!/usr/bin/env node
/**
 * 分頁稽核（v1.0.0）：把每個分頁的每一顆按鈕／下拉／開關「真的點一次」，
 * 並在多種視窗寬度下掃描文字溢出與被裁切的元素。
 *
 * 為什麼需要這支：單元測試只驗資料與函式，`cdp-check.mjs` 只驗「頁面文字有沒有出現」，
 * 兩者都不會告訴你「按下去有沒有反應」。圖表切換失效（Chart.js 同一塊 canvas 重複建立）
 * 就是單元測試全綠、畫面上卻完全沒反應的例子。
 *
 * 用法：
 *   node scripts/page-audit.mjs <base-url> [--mode all|clicks|overflow]
 *        [--width 1440] [--out 報告.md] [--views overview,map] [--limit N] [--budget 2400]
 * 離開碼：0 無問題；1 有 JS 錯誤／按了沒反應／文字溢出。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const base = argv[0];
if (!base) {
  console.error('用法：node scripts/page-audit.mjs <base-url> [--mode all|clicks|overflow] [--width 1440] [--out 報告.md]');
  process.exit(2);
}
const opt = { mode: 'all', width: 1440, out: null, views: null, limit: 0, settle: 400, budget: 2400 };
for (let i = 1; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--mode') opt.mode = argv[++i];
  else if (a === '--width') opt.width = Number(argv[++i]);
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--views') opt.views = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--limit') opt.limit = Number(argv[++i]);
  else if (a === '--settle') opt.settle = Number(argv[++i]);
  else if (a === '--budget') opt.budget = Number(argv[++i]);   // 整體時間上限（秒），避免卡在某一頁
  else { console.error(`未知參數：${a}`); process.exit(2); }
}
const DEADLINE = Date.now() + opt.budget * 1000;
const outOfTime = () => Date.now() > DEADLINE;

/**
 * 分頁清單。`view` 是 DOM 裡的容器 id（#view-xxx），用來判斷「這一頁的內容已經算完」：
 * 容器可見且裡面沒有 .loading。比對文字片段可靠得多——先前用文字等待時，
 * 只要那一段字沒出現（例如地圖頁的說明文字改過），每次載入都會白等 25 秒。
 */
const VIEWS = [
  { name: 'overview', view: 'overview', hash: '#/overview' },
  { name: 'map', view: 'map', hash: '#/map' },
  { name: 'routes', view: 'routes', hash: '#/routes' },
  { name: 'analytics', view: 'analytics', hash: '#/analytics' },
  { name: 'priority', view: 'priority', hash: '#/priority' },
  { name: 'field', view: 'field', hash: '#/field' },
  { name: 'monitoring', view: 'monitoring', hash: '#/monitoring' },
  { name: 'chemistry', view: 'chemistry', hash: '#/chemistry' },
  { name: 'policy', view: 'policy', hash: '#/policy' },
  { name: 'knowledge', view: 'knowledge', hash: '#/knowledge' },
  { name: 'qr', view: 'qr', hash: '#/qr' },
  { name: 'card', view: 'card', hash: '#/card' },
  { name: 'map(tree)', view: 'map', hash: '#/map?tree=619' },
  { name: 'monitoring(tree)', view: 'monitoring', hash: '#/monitoring?tree=1132' },
  { name: 'field(tree)', view: 'field', hash: '#/field?tree=544' },
  { name: 'card(form)', view: 'card', hash: '#/card?mode=form' },
];

const OW = [1440, 1024, 768, 430, 390];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 比較點擊前後的可觀察效果。
 * 判斷「按了有沒有反應」不能只看文字長度：勾選框、<details> 開合、路綫卡片選取、
 * 重新渲染出同樣內容的預覽，都要靠不同訊號才看得出來。
 */
function effectsOf(before, after, clicked) {
  const fx = [];
  if (!before || !after) return fx;
  if (clicked && clicked.set) fx.push(`select→${clicked.set}`);
  if (after.hash !== before.hash) fx.push(`hash→${after.hash}`);
  if (after.modal !== before.modal) fx.push(after.modal ? '開啟面板' : '關閉面板');
  if (after.toast) fx.push(`toast「${after.toast}」`);
  if (after.prints > before.prints) fx.push('呼叫列印');
  if (after.opens > before.opens) fx.push('開新視窗');
  if (after.dl > before.dl) fx.push('產生下載');
  if (after.clip > before.clip) fx.push('複製到剪貼簿');
  if (after.checked > before.checked) fx.push(`勾選 ${after.checked - before.checked} 項`);
  if (after.detailsOpen !== before.detailsOpen) fx.push(after.detailsOpen > before.detailsOpen ? '展開說明' : '收合說明');
  if (after.active !== before.active) fx.push('切換選取狀態');
  if (after.dom !== before.dom) fx.push('內容更新');
  return fx;
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'page-audit-'));
let child;
let ws;
let id = 0;
const pending = new Map();
const errors = [];          // 累積的 JS 錯誤（含發生時間與當前分頁）
let currentView = '';

const send = (method, params = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
  const mid = ++id;
  // 每個 CDP 呼叫都要有逾時：headless Chrome 偶爾會在「導覽中的頁面」上不回應某個指令，
  // 少了逾時整個稽核就會卡死在那裡（第一版就發生過，卡在 about:blank 不動）。
  const timer = setTimeout(() => {
    pending.delete(mid);
    reject(new Error(`CDP ${method} 逾時 ${timeoutMs}ms`));
  }, timeoutMs);
  pending.set(mid, {
    resolve: (v) => { clearTimeout(timer); resolve(v); },
    reject: (e) => { clearTimeout(timer); reject(e); },
  });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

async function evalJs(expression) {
  let r;
  try {
    r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  } catch (e) {
    errors.push({ view: currentView, kind: 'evaluate', text: e.message });
    return null;
  }
  if (r && r.exceptionDetails) {
    const msg = r.exceptionDetails.exception?.description || r.exceptionDetails.text;
    errors.push({ view: currentView, kind: 'eval', text: String(msg).split('\n')[0] });
    return null;
  }
  return r?.result?.value ?? null;
}

/** 每一份新文件都先注入計數器，才不會把「下載／列印」當成沒反應。 */
const INJECT = `
window.__audit = { prints: 0, opens: 0, blobDl: 0, clipboard: 0 };
window.print = function () { window.__audit.prints += 1; };
window.open = function () { window.__audit.opens += 1; return null; };
window.__domHash = function () {
  const b = document.body;
  // canvas 的內容不會反映在 DOM 上，所以另外把「每張圖表的資料集」納入指紋，
  // 否則「切換模型後曲線變了」會被誤判成沒反應。
  const charts = [...document.querySelectorAll('canvas')].map(function (c) {
    const ch = c._chart;
    if (!ch) return 'none';
    const ds = (ch.data && ch.data.datasets) || [];
    const first = ds[0] && ds[0].data ? (Array.isArray(ds[0].data) ? ds[0].data.length : Object.keys(ds[0].data).length) : 0;
    const last = ds[ds.length - 1];
    const lastSig = last ? String(last.label || '') + ':' + (Array.isArray(last.data) ? last.data.length : 0) + ':' + JSON.stringify(last.data && last.data[0] || '') : '';
    return ds.length + '/' + first + '/' + lastSig;
  }).join('|');
  // 表單狀態、<details> 開合、.active 選取狀態都不會改變文字長度，
  // 但「勾了勾選框」「展開說明」「切換路綫卡片」都是使用者看得到的反應。
  const formState = [...document.querySelectorAll('input, select, textarea')].map(function (el) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? '1' : '0';
    if (el.type === 'file') return el.files ? String(el.files.length) : '0';
    return String(el.value || '');
  }).join('\\u0001');
  return [b.textContent.length, document.querySelectorAll('*').length,
    document.querySelectorAll('#modal:not([hidden])').length,
    document.querySelectorAll('input:checked').length,
    [...document.querySelectorAll('details')].filter(function (d) { return d.open; }).length,
    document.querySelectorAll('.active').length,
    document.querySelectorAll('svg').length,
    formState.length, formState, charts].join('/');
};
try {
  const orig = URL.createObjectURL ? URL.createObjectURL.bind(URL) : null;
  URL.createObjectURL = function (blob) { window.__audit.blobDl += 1; return orig ? orig(blob) : ''; };
} catch (e) { /* 忽略 */ }
try {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: function () { window.__audit.clipboard += 1; return Promise.resolve(); },
      readText: function () { return Promise.resolve(''); },
    },
  });
} catch (e) { /* 忽略 */ }
document.addEventListener('click', function (e) {
  const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
  if (a) window.__audit.blobDl += 1;
}, true);
`;

/** 頁面就緒條件：容器可見、且容器內沒有「載入中」的轉圈圈。 */
function readyExpr(view) {
  return `(() => {
    const s = document.querySelector('#view-${view}');
    if (!s || s.hidden) return false;
    return !s.querySelector('.loading');
  })()`;
}

async function goto(url, view, timeoutMs = 20000) {
  try {
    await send('Page.navigate', { url: 'about:blank' }, 10000);
    await sleep(100);
    await send('Page.navigate', { url }, 15000);
  } catch (e) {
    errors.push({ view: currentView, kind: 'navigate', text: `${url}：${e.message}` });
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  let ready = false;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await evalJs(readyExpr(view));
    if (ok) { ready = true; break; }
    // eslint-disable-next-line no-await-in-loop
    await sleep(150);
  }
  if (!ready) errors.push({ view: currentView, kind: 'load', text: `頁面未就緒（${view}）：${url}` });
  await sleep(opt.settle);
  return ready;
}

const CANDIDATE_SEL = [
  'button:not([disabled])',
  '[role="button"]',
  'summary',
  'a.btn',
  '.tab',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(', ');

/** 標記候選元素並回傳清單（用 data-audit 當穩定索引，重新載入後順序一致）。 */
const MARK = `
(() => {
  const sel = ${JSON.stringify(CANDIDATE_SEL)};
  const nodes = [...document.querySelectorAll(sel)]
    .filter((el) => !el.hasAttribute('data-audit-skip'))
    .filter((el) => el.tagName === 'SELECT' || el.tagName === 'SUMMARY' || el.offsetParent !== null || el.closest('#modal'))
    .filter((el) => !el.closest('.table-wrap') || el.tagName === 'BUTTON' || el.tagName === 'SELECT');
  const inModal = (el) => !!el.closest('#modal');
  const list = nodes.map((el, i) => {
    el.setAttribute('data-audit', String(i));
    return {
      i,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      cls: (el.className || '').toString().slice(0, 40),
      label: (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\\s+/g, ' ').trim().slice(0, 42),
      href: el.getAttribute('href') || null,
      options: el.tagName === 'SELECT' ? [...el.options].map((o) => o.value).slice(0, 8) : null,
      inModal: inModal(el),
    };
  });
  return list;
})()
`;

const SNAPSHOT = `
(() => ({
  hash: location.hash,
  modal: !document.getElementById('modal').hidden,
  toast: (document.getElementById('toast')?.textContent || '').trim().slice(0, 90),
  prints: window.__audit.prints,
  opens: window.__audit.opens,
  dl: window.__audit.blobDl,
  clip: window.__audit.clipboard,
  checked: document.querySelectorAll('input:checked').length,
  detailsOpen: [...document.querySelectorAll('details')].filter((d) => d.open).length,
  active: document.querySelectorAll('.active').length,
  dom: window.__domHash(),
}))()
`;

const OVERFLOW = `
(() => {
  const items = [];
  const clipped = [];
  const doc = document.documentElement;
  const scrollX = doc.scrollWidth - doc.clientWidth;
  const skipZone = (el) => el.closest('.table-wrap, .chart-box, .card-scroll, #modal, pre, svg, .modal, .leaflet-container, nav.tabs');
  document.querySelectorAll('body *').forEach((el) => {
    if (el.tagName === 'HTML' || el.tagName === 'BODY') return;
    if (el.offsetParent === null) return;
    if (skipZone(el)) return;
    const cs = getComputedStyle(el);
    const dx = el.scrollWidth - el.clientWidth;
    if (!el.clientWidth || dx <= 2) return;
    const info = {
      kind: '溢寬', over: dx, tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 44),
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 46),
    };
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') {
      // 內容超出自己的框、但沒有被裁切：超過 8px 才算真的會壓到隔壁。
      // （4px 以內多半是瀏覽器對 <input type="range"> 這類置換元件的內部量測誤差，
      //   既不會被裁切、也不會造成整頁橫向捲動。）
      if (dx > 8) items.push(info);
    } else {
      // 只有 hidden／clip 才是「真的被切掉」；auto／scroll 是刻意讓它捲動
      // （例如手機的頁籤列），不算問題。
      if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
        clipped.push({ ...info, kind: '裁切', overflow: cs.overflowX });
      }
    }
  });
  // 手機寬度另外看「手指按得到嗎」：主要互動元件若小於 28×28px 就列出來參考
  // （WCAG 2.2 的目標尺寸下限是 24×24，這裡留一點餘裕）。
  const small = [];
  if (window.innerWidth <= 430) {
    document.querySelectorAll('.btn, button, select, a.tab, .chip, summary, a.btn, input[type="text"], input[type="number"], input[type="search"]').forEach((el) => {
      if (el.offsetParent === null) return;
      if (el.closest('#modal') && document.getElementById('modal').hidden) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.height < 28 || r.width < 28) {
        small.push({
          tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height),
          cls: (el.className || '').toString().slice(0, 32),
          text: (el.textContent || el.value || '').replace(/\\s+/g, ' ').trim().slice(0, 26),
        });
      }
    });
  }
  return { scrollX, items, clipped, small };
})()
`;

async function main() {
  child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${opt.width},1400`, 'about:blank',
  ], { stdio: 'ignore', detached: false });
  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 100 && !port; i += 1) {
    if (fs.existsSync(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    if (!port) await sleep(100);
  }
  if (!port) throw new Error('Chrome 未啟動');
  let target = null;
  for (let i = 0; i < 100 && !target; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* 重試 */ }
    if (!target) await sleep(100);
  }
  if (!target) throw new Error('找不到分頁目標');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push({ view: currentView, kind: 'exception', text: String(d.exception?.description || d.text || '未捕捉例外').split('\n')[0] });
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push({ view: currentView, kind: 'console', text: (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160) });
    }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('WebSocket 連線失敗')), { once: true });
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch?.(() => {});
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });

  const views = VIEWS.filter((v) => !opt.views || opt.views.includes(v.name));
  const report = { base, mode: opt.mode, views: [], overflow: [], errors: [], noop: [], small: [] };

  if (opt.mode === 'all' || opt.mode === 'overflow') {
    for (const w of OW) {
      if (outOfTime()) { report.note = '時間上限已到：版面稽核未跑完'; break; }
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w <= 430 });
      for (const v of views) {
        if (outOfTime()) break;
        currentView = `${v.name}@${w}`;
        // eslint-disable-next-line no-await-in-loop
        await goto(`${base}/${v.hash}`, v.view, 15000);
        // eslint-disable-next-line no-await-in-loop
        const res = await evalJs(OVERFLOW);
        if (res && (res.scrollX > 2 || (res.items || []).length || (res.clipped || []).length)) {
          report.overflow.push({
            view: v.name, width: w, scrollX: res.scrollX,
            items: res.items || [], clipped: res.clipped || [],
          });
        }
        if (res && res.small && res.small.length) {
          report.small.push({ view: v.name, width: w, items: res.small });
        }
      }
    }
    await send('Emulation.clearDeviceMetricsOverride');
  }

  if (opt.mode === 'all' || opt.mode === 'clicks') {
    await send('Emulation.setDeviceMetricsOverride', { width: opt.width, height: 1200, deviceScaleFactor: 1, mobile: false });
    for (const v of views) {
      if (outOfTime()) { report.note = '時間上限已到：互動稽核未跑完'; break; }
      currentView = v.name;
      const url = `${base}/${v.hash}`;
      // eslint-disable-next-line no-await-in-loop
      await goto(url, v.view, 20000);
      // eslint-disable-next-line no-await-in-loop
      let list = await evalJs(MARK) || [];
      if (opt.limit) list = list.slice(0, opt.limit);
      const rows = [];
      for (const cand of list) {
        if (outOfTime()) { rows.push({ i: cand.i, status: 'skip', note: '時間上限已到' }); break; }
        if (cand.href && !cand.href.startsWith('#')) {
          rows.push({ ...cand, status: 'skip', note: '外部連結（只驗網址不點擊）' });
          continue;
        }
        currentView = `${v.name}#${cand.i}`;
        let clicked = null;
        let before = null;
        let after = {};
        let newErr = [];
        // 沒有可見變化時再重試一次：重新載入的那一瞬間偶爾會吞掉第一次點擊，
        // 直接記成「沒反應」會製造假警報。兩次都沒有變化才判定。
        for (let attempt = 0; attempt < 2; attempt += 1) {
          // eslint-disable-next-line no-await-in-loop
          await goto(url, v.view, 8000);
          // 重新載入後 data-audit 標記會消失，必須依同樣順序再標一次（DOM 順序固定，索引一致）
          // eslint-disable-next-line no-await-in-loop
          await evalJs(MARK);
          // eslint-disable-next-line no-await-in-loop
          before = await evalJs(SNAPSHOT);
          const errBefore = errors.length;
          // eslint-disable-next-line no-await-in-loop
          clicked = await evalJs(`(() => {
          const el = document.querySelector('[data-audit="${cand.i}"]');
          if (!el) return { ok: false };
          el.scrollIntoView({ block: 'center' });
          // 這幾種情況本來就不該有變化，先標記起來，避免誤判成「按了沒反應」
          if (el.closest('#modal') && document.getElementById('modal').hidden) return { ok: true, expect: '面板未開啟時按關閉' };
          if (el.classList.contains('tab') && el.getAttribute('href') === location.hash) return { ok: true, expect: '已是目前分頁' };
          if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') === location.hash) return { ok: true, expect: '已是目前分頁' };
          if (el.classList.contains('chip') && el.classList.contains('active')) return { ok: true, expect: '已是選取中的項目' };
          // 路綫卡片這類「選取型」按鈕：點已經選取的那一張，狀態本來就不會變
          if (el.classList.contains('active')) return { ok: true, expect: '已是選取中的項目' };
          // 文章清單：點的若是目前開啟的那一篇，重繪出來的內容一模一樣
          if (el.dataset.slug && location.hash.includes(el.dataset.slug)) return { ok: true, expect: '已是目前開啟的文章' };
          if (el.tagName === 'BUTTON' && el.type === 'submit' && el.form && el.form.checkValidity && !el.form.checkValidity()) {
            return { ok: true, expect: '必填欄位未填，瀏覽器原生驗證阻擋送出' };
          }
          // 「產生」類按鈕（二維碼／檔案卡預覽）：頁面載入時就已用預設值產生過一次，
          // 直接重按會重繪出一模一樣的內容而看似沒反應。先改一個相關輸入再按，
          // 這樣驗到的是「改設定 → 重新產生 → 內容真的變了」的完整流程。
          if (el.id === 'qr-generate') {
            const sel = document.getElementById('qr-limit') || document.getElementById('qr-q') || document.getElementById('qr-sort');
            if (sel && sel.tagName === 'SELECT') {
              const other = [...sel.options].find((o) => o.value !== sel.value);
              if (other) { sel.value = other.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
            }
          }
          if (el.id === 'c-build') {
            const n = document.getElementById('c-no');
            if (n && n.value) { n.value = String(Number(n.value) + 1); n.dispatchEvent(new Event('change', { bubbles: true })); }
          }
          // 地圖的「套用篩選」同理：表單維持預設值時重新套用只會得到一樣的結果。
          // 先改一個篩選條件再按，驗的是「改條件 → 套用 → 地圖與統計真的跟著變」。
          if (el.id === 'btn-apply') {
            const sels = [...document.querySelectorAll('#view-map select')];
            const sel = sels.find((s) => [...s.options].some((o) => o.value && o.value !== s.value));
            const other = sel && [...sel.options].find((o) => o.value && o.value !== sel.value);
            if (other) { sel.value = other.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
          }
          // 「全覽」只把地圖視野縮放到全部結果，頁面文字不會變，屬預期行為
          if (el.id === 'btn-fit') return { ok: true, expect: '只調整地圖視野，頁面文字不變' };
          if (el.tagName === 'SELECT') {
            const other = [...el.options].find((o) => o.value !== el.value);
            if (other) { el.value = other.value; el.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true, set: other.value }; }
            return { ok: false };
          }
          el.click();
          return { ok: true };
        })()`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(650);
          // eslint-disable-next-line no-await-in-loop
          after = await evalJs(SNAPSHOT) || {};
          newErr = errors.slice(errBefore);
          if (newErr.length || (clicked && clicked.expect) || effectsOf(before, after, clicked).length) break;
        }
        const effects = effectsOf(before, after, clicked);
        const status = newErr.length ? 'fail'
          : (!clicked || !clicked.ok ? 'missing'
            : (clicked.expect ? 'expected' : (effects.length ? 'ok' : 'noop')));
        rows.push({ ...cand, status, effects, expect: clicked && clicked.expect, errors: newErr.map((e) => e.text) });
        if (status === 'noop') report.noop.push({ view: v.name, label: cand.label, tag: cand.tag });
      }
      report.views.push({ name: v.name, hash: v.hash, candidates: rows });
      console.log(`  · ${v.name}：${rows.filter((r) => r.status === 'ok').length}/${rows.length} 有反應`
        + `${rows.filter((r) => r.status === 'expected').length ? `，${rows.filter((r) => r.status === 'expected').length} 個預期無變化` : ''}`
        + `${rows.some((r) => r.status === 'fail') ? `，${rows.filter((r) => r.status === 'fail').length} 個報錯` : ''}`
        + `${rows.some((r) => r.status === 'noop') ? `，${rows.filter((r) => r.status === 'noop').length} 個沒反應` : ''}`);
    }
  }

  report.errors = errors;

  // ── 報告 ───────────────────────────────────────────────
  const L = [];
  L.push('# 分頁稽核報告', '');
  L.push(`- 對象：${base}`);
  L.push(`- 模式：${opt.mode}（互動寬度 ${opt.width}px；版面寬度 ${OW.join('／')}）`);
  L.push(`- 時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Macau' })}`, '');
  L.push('## 互動稽核', '');
  for (const v of report.views) {
    L.push(`### ${v.name}（${v.hash}）`, '');
    L.push('| # | 元素 | 標籤 | 結果 | 反應 |');
    L.push('|---|---|---|---|---|');
    for (const r of v.candidates) {
      const icon = { ok: '✅', noop: '⚠️ 沒反應', fail: '❌ 報錯', skip: '—', missing: '⚠️ 找不到', expected: '✅ 預期無變化' }[r.status] || r.status;
      L.push(`| ${r.i} | ${r.tag}${r.type ? `[${r.type}]` : ''} | ${r.label.replace(/\|/g, '/')} | ${icon} | ${(r.effects || []).join('、')}${r.expect ? `（${r.expect}）` : ''}${r.errors && r.errors.length ? ` ❌ ${r.errors.join(' / ')}` : ''} |`);
    }
    L.push('');
  }
  L.push('## 版面溢出（文字換行）', '');
  if (!report.overflow.length) L.push('未發現文字溢出，也沒有內容被容器裁切。', '');
  for (const o of report.overflow) {
    L.push(`- **${o.view} @ ${o.width}px**（整頁橫向溢出 ${o.scrollX}px）`);
    for (const it of o.items.slice(0, 12)) L.push(`  - ${it.kind} ${it.over}px｜${it.tag}.${it.cls}｜${it.text}`);
    for (const it of (o.clipped || []).slice(0, 12)) L.push(`  - ${it.kind}（容器 ${it.overflow}）${it.over}px｜${it.tag}.${it.cls}｜${it.text}`);
  }
  L.push('', '## 手機可點範圍（≤430px，小於 28×28px 者）', '');
  if (!report.small.length) L.push('主要互動元件都在 28×28px 以上。', '');
  for (const s of report.small) {
    L.push(`- **${s.view} @ ${s.width}px**：${s.items.length} 項`);
    for (const it of s.items.slice(0, 10)) L.push(`  - ${it.tag}.${it.cls} ${it.w}×${it.h}px｜${it.text}`);
  }
  L.push('', '## JS 錯誤', '');
  if (!report.errors.length) L.push('無。', '');
  const seen = new Set();
  for (const e of report.errors) {
    const key = `${e.view}|${e.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    L.push(`- [${e.view}] ${e.kind}：${e.text}`);
  }
  const text = L.join('\n');
  if (opt.out) {
    fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true });
    fs.writeFileSync(opt.out, text, 'utf8');
    console.log(`報告：${opt.out}`);
  } else {
    console.log(text);
  }
  const bad = report.errors.length + report.noop.length + report.overflow.length
    + report.views.reduce((a, v) => a + v.candidates.filter((r) => r.status === 'fail' || r.status === 'missing').length, 0);
  console.log(bad ? `\n⚠️ 共 ${bad} 項待處理` : '\n✅ 全部通過');
  ws.close();
  child.kill('SIGKILL');
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* 忽略 */ }
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(`稽核失敗：${e.message}`);
  try { child?.kill('SIGKILL'); } catch { /* 忽略 */ }
  process.exit(2);
});
