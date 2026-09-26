/**
 * 離線 PWA 客戶端：註冊 service worker、顯示連線狀態、處理版本更新。
 *
 * 這裡刻意把「判斷邏輯」抽成純函式（`pwaState`／`registrationIssue`），
 * 讓 `tests/pwa.test.js` 能在 node 直接測，不必開瀏覽器。
 * 瀏覽器端只負責把狀態畫到頁面上。
 */
import { esc } from './ui.js';

/** service worker 檔案與其作用範圍（必須是站台根目錄，否則子路徑不會被攔截）。 */
export const SW_URL = '/sw.js';
export const SW_SCOPE = '/';

/**
 * 依瀏覽器狀態算出要顯示什麼（純函式）。
 * @param {{online?: boolean, supported?: boolean, controlled?: boolean, updateReady?: boolean, cached?: number}} s
 * @returns {{chip: string, chipTitle: string, tone: 'ok'|'warn'|'off'|'muted', banner: string|null, canInstall: boolean}}
 */
export function pwaState(s = {}) {
  // navigator.onLine 說有網路、但請求其實失敗（伺服器掛了／被攔截）→ 一樣算離線
  const offlineLike = s.online === false || s.networkDown === true;
  if (!s.supported) {
    return {
      chip: '離線：不支援', tone: 'muted', canInstall: false, banner: null,
      chipTitle: '這個瀏覽器不支援 service worker，離線功能無法使用（改用線上瀏覽不受影響）。',
    };
  }
  if (offlineLike) {
    return {
      chip: '離線模式', tone: 'off', canInstall: false,
      banner: s.controlled
        ? `${s.online === false ? '目前離線（裝置沒有網路）' : '目前連不上伺服器（裝置有網路，可能是伺服器暫時無法連線）'}：顯示的是上次快取的資料。新分頁若先前沒開過可能無法顯示；照片與地圖圖磚只有看過的部分還在。`
        : '目前離線：這個頁面還沒被快取起來，連上網路後重新整理即可使用離線功能。',
      chipTitle: s.online === false ? '裝置目前沒有網路連線。' : '伺服器目前無法連線，顯示的是快取資料。',
    };
  }
  if (s.updateReady) {
    return {
      chip: '有新版本', tone: 'warn', canInstall: true, banner: '已下載新版本，重新載入即可使用最新內容。',
      chipTitle: 'service worker 已取得新版本，重新載入後生效。',
    };
  }
  if (s.controlled) {
    return {
      chip: '離線可用', tone: 'ok', canInstall: true, banner: null,
      chipTitle: `離線功能已就緒：介面與已看過的資料都已存到本機${s.cached ? `（快取 ${s.cached} 項）` : ''}。`,
    };
  }
  return {
    chip: '離線準備中', tone: 'muted', canInstall: false, banner: null,
    chipTitle: '正在把介面存到本機，完成後即可離線使用。',
  };
}

/**
 * 什麼情況下「離線功能不會生效」——要在畫面上老實說，不要靜默失效（純函式）。
 * @returns {string|null} 原因，正常時回 null
 */
export function registrationIssue({ supported, secureContext, protocol, hostname } = {}) {
  if (!supported) return '這個瀏覽器不支援 service worker，離線功能無法使用。';
  if (!secureContext) {
    // 依規範，http://localhost 與 127.0.0.1 本身就是安全來源（本機開發用）
    if (protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return null;
    if (protocol === 'http:') return '離線功能需要 HTTPS（或在本機 localhost 測試）；目前是 http，因此不會啟用。';
    return '這個環境不是安全來源（secure context），離線功能不會啟用。';
  }
  return null;
}

/** 色調 → 既有樣式類別（badge-good／notice-fair …）；離線用琥珀色，不用紅色嚇人。 */
const TONE_CLASS = { ok: 'good', warn: 'fair', off: 'fair', muted: 'muted' };
const toneClass = (tone) => TONE_CLASS[tone] || 'muted';

let deferredInstall = null;
let state = { supported: false, online: true, controlled: false, updateReady: false, cached: 0, networkDown: false };
const listeners = new Set();

const snapshot = () => ({ ...state });

function publish(patch = {}) {
  state = { ...state, ...patch };

  const s = snapshot();
  for (const fn of listeners) {
    try { fn(s); } catch (err) { console.warn('PWA 狀態監聽失敗', err); }
  }
  renderUi(s);
}

function countCached() {
  if (!('caches' in window)) return Promise.resolve(0);
  return caches.keys()
    .then((names) => Promise.all(names.filter((n) => n.startsWith('mht-'))
      .map((n) => caches.open(n).then((c) => c.keys()).then((k) => k.length))))
    .then((counts) => counts.reduce((a, b) => a + b, 0))
    .catch(() => 0);
}

function chipHtml(s) {
  const st = pwaState(s);
  return `<button type="button" id="pwa-chip" class="badge badge-${toneClass(st.tone)}" data-tone="${st.tone}"
    data-pwa="panel" title="${esc(st.chipTitle)}" aria-label="離線使用狀態：${esc(st.chip)}">${esc(st.chip)}</button>`;
}

/** 點狀態徽章後的面板：說明離線能力、快取數量與可用的操作。 */
function panelHtml(s) {
  const st = pwaState(s);
  const rows = [
    ['連線狀態', s.online === false ? '目前離線' : '已連線'],
    ['離線能力', !s.supported ? '不支援（見下方說明）' : s.controlled ? '已就緒（介面與看過的資料已存在本機）' : '準備中'],
    ['已快取項目', s.cached ? `${s.cached} 項（介面、資料、照片、圖磚）` : '尚無'],
  ];
  return `
    <h2>離線使用</h2>
    <p class="muted small">${esc(st.chipTitle)}</p>
    <table class="data"><tbody>
      ${rows.map(([k, v]) => `<tr><th style="width:8rem">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
    </tbody></table>
    <ul class="small muted" style="margin:.8rem 0 0;padding-left:1.2rem">
      <li>第一次連線時會把介面存到本機，之後即使斷網也能開啟與切換分頁。</li>
      <li>統計與清單會先顯示上次的結果，連上網路後自動更新。</li>
      <li>古樹照片與地圖圖磚只快取「看過的」，不主動批量下載（遵守 OpenStreetMap 圖磚政策）。</li>
      <li>實地考察紀錄的送出永遠走網路，離線時會暫存在這台裝置的瀏覽器。</li>
    </ul>
    <div class="row" style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem">
      <button class="btn" data-pwa="clear" ${s.supported ? '' : 'hidden'}>清除離線快取</button>
      <button class="btn btn-primary" data-pwa="install" ${deferredInstall ? '' : 'hidden'}>安裝到主畫面</button>
    </div>`;
}

function bannerHtml(s) {
  const st = pwaState(s);
  if (!st.banner) return '';
  const action = s.updateReady
    ? '<button class="btn btn-sm" data-pwa="reload">重新載入</button>'
    : '';
  return `<div class="notice notice-${toneClass(st.tone)}" id="pwa-banner" role="status">
    <span>${esc(st.banner)}</span>${action}
  </div>`;
}

function renderUi(s) {
  if (typeof document === 'undefined') return;
  const st = pwaState(s);
  document.documentElement.dataset.pwa = s.supported ? (s.controlled ? 'ready' : 'pending') : 'unsupported';
  document.documentElement.dataset.pwaOnline = s.online ? 'yes' : 'no';
  document.documentElement.dataset.pwaNet = s.networkDown ? 'down' : 'up';
  document.documentElement.dataset.pwaCached = String(s.cached || 0);
  const host = document.getElementById('pwa-chip-slot') || document.querySelector('.header-status');
  if (host) {
    const existing = document.getElementById('pwa-chip');
    const html = chipHtml(s);
    if (existing) existing.outerHTML = html;
    else host.insertAdjacentHTML('beforeend', html);
  }
  const bannerHost = document.getElementById('pwa-banner-host');
  if (bannerHost) {
    const html = bannerHtml(s);
    if (html) bannerHost.innerHTML = html;
    else bannerHost.innerHTML = '';
  }
  const chip = document.getElementById('pwa-chip');
  if (chip) chip.title = st.chipTitle;
}

/** 向 service worker 查詢目前的網路狀態（它才知道背景更新成功與否）。 */
function pingNetworkState() {
  const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (ctrl) ctrl.postMessage({ type: 'PING_NET' });
}

function messageSw(payload) {
  const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (ctrl) ctrl.postMessage(payload);
}

/** 重新載入以套用新版本（給 banner 的按鈕用）。 */
function applyUpdate() {
  messageSw({ type: 'SKIP_WAITING' });
  window.location.reload();
}

/** 清掉所有離線快取（照片／資料／介面），並重新註冊一次。 */
export async function clearOfflineCache() {
  if (!('caches' in window)) return 0;
  const names = (await caches.keys()).filter((n) => n.startsWith('mht-'));
  await Promise.all(names.map((n) => caches.delete(n)));
  publish({ cached: 0, updateReady: false });
  return names.length;
}

/** 綁定瀏覽器事件（在 node 匯入本模組做純函式測試時不會被執行）。 */
function bindDomEvents() {
document.addEventListener('click', (event) => {
  const btn = event.target.closest && event.target.closest('[data-pwa]');
  if (!btn) return;
  const action = btn.dataset.pwa;
  if (action === 'reload') applyUpdate();
  if (action === 'clear') {
    clearOfflineCache().then((n) => {
      import('./ui.js').then(({ toast }) => toast(n ? `已清除 ${n} 組離線快取，重新整理後會重新下載。` : '目前沒有離線快取。', 3600));
    });
  }
  if (action === 'install' && deferredInstall) {
    deferredInstall.prompt();
    deferredInstall = null;
  }
  if (action === 'panel') {
    import('./ui.js').then(({ openModal }) => openModal(panelHtml(snapshot())));
  }
});

window.addEventListener('app:netissue', (event) => {
  const ok = !!(event.detail && event.detail.ok);
  if (ok === (state.networkDown === false)) return;      // 狀態沒變就不重繪
  publish({ networkDown: !ok });
  if (ok) countCached().then((cached) => publish({ cached }));
});
window.addEventListener('online', () => { publish({ online: true }); countCached().then((cached) => publish({ cached })); });
window.addEventListener('offline', () => publish({ online: false }));
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
  publish({});
});
}

/** 註冊 service worker（app.js 於啟動時呼叫一次就好）。 */
export async function initPwa() {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const issue = registrationIssue({
    supported,
    secureContext: typeof window !== 'undefined' && window.isSecureContext,
    protocol: typeof location !== 'undefined' ? location.protocol : '',
    hostname: typeof location !== 'undefined' ? location.hostname : '',
  });
  if (!document.getElementById('pwa-banner-host')) {
    const main = document.getElementById('main');
    if (main) main.insertAdjacentHTML('afterbegin', '<div id="pwa-banner-host"></div>');
  }
  publish({ supported: supported && !issue, online: navigator.onLine !== false });
  if (issue) console.info('[pwa]', issue);
  bindDomEvents();

  if (!supported || issue) return null;

  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    publish({ controlled: !!navigator.serviceWorker.controller });
    pingNetworkState();
    countCached().then((cached) => publish({ cached }));

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) publish({ updateReady: true });
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      publish({ controlled: true, updateReady: false });
      pingNetworkState();
      countCached().then((cached) => publish({ cached }));
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
      const type = event.data && event.data.type;
      if (type === 'CACHE_CLEARED') publish({ cached: 0 });
      // service worker 才知道背景更新成功與否 —— 離線時 API 仍會回快取，
      // 光看 HTTP 200 會誤判為「已連線」。
      if (type === 'NET_OK') publish({ networkDown: false });
      if (type === 'NET_DOWN') publish({ networkDown: true });
    });
    if (reg.waiting) publish({ updateReady: true });
    return reg;
  } catch (err) {
    console.warn('[pwa] service worker 註冊失敗', err);
    publish({ supported: false });
    return null;
  }
}

// 供無頭瀏覽器驗證用（--dump-dom 讀不到 JS 變數，只能靠 DOM 屬性與這裡的狀態）
if (typeof window !== 'undefined') {
  window.__pwa = { state: snapshot, clearOfflineCache, applyUpdate, pwaState };
}
