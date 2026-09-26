/* 澳門古樹保育研究平台 — Service Worker（離線 PWA）
 *
 * 設計原則
 *  1. **App shell 預載**：第一次連線就把介面（HTML／CSS／前端 JS／vendor／圖示）存起來，
 *     之後即使完全斷網也能開啟並切換分頁。
 *  2. **資料快取（stale-while-revalidate）**：`/api/*` 的回應先回快取、背景再更新，
 *     斷網時仍看得到上次的統計與清單；`/api/health` 不快取（診斷資訊必須即時）。
 *  3. **媒體快取（cache-first ＋ 上限）**：古樹照片與「使用者實際看過」的地圖圖磚，
 *     不主動批量下載（遵守 OSM 圖磚政策），只保存看過的部分並限制數量。
 *  4. **只處理 GET**：`POST /api/field-records` 一律直接進網路，絕不快取或改寫。
 *
 * 預載清單由 `scripts/build-sw.mjs` 依實際檔案產生，不要手改標記區內的內容。
 */
const VERSION = 'v0.16.0';
const SHELL_CACHE = `mht-shell-${VERSION}`;
const DATA_CACHE = `mht-data-${VERSION}`;
const MEDIA_CACHE = `mht-media-${VERSION}`;
const PHOTO_MAX = 150;      // 最多保留 150 張古樹照片
const TILE_MAX = 200;       // 最多保留 200 張看過的地圖圖磚

// >>> 預載清單 開始（由 scripts/build-sw.mjs 產生）
const PRECACHE = [
  '/index.html',
  '/css/print.css',
  '/css/style.css',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/js/analytics.js',
  '/js/api.js',
  '/js/app.js',
  '/js/card.js',
  '/js/charts.js',
  '/js/chemistry.js',
  '/js/dashboard.js',
  '/js/field.js',
  '/js/knowledge.js',
  '/js/map.js',
  '/js/monitoring.js',
  '/js/policy.js',
  '/js/priority.js',
  '/js/pwa.js',
  '/js/qr.js',
  '/js/routes.js',
  '/js/ui.js',
  '/manifest.webmanifest',
  '/offline.html',
  '/vendor/chart.umd.js',
  '/vendor/katex/auto-render.min.js',
  '/vendor/katex/fonts/KaTeX_AMS-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Main-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  '/vendor/katex/fonts/KaTeX_Main-Italic.woff2',
  '/vendor/katex/fonts/KaTeX_Main-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  '/vendor/katex/fonts/KaTeX_Math-Italic.woff2',
  '/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  '/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Script-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size1-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size2-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size3-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size4-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2',
  '/vendor/katex/katex.min.css',
  '/vendor/katex/katex.min.js',
  '/vendor/leaflet.markercluster.js',
  '/vendor/leaflet/images/marker-icon-2x.png',
  '/vendor/leaflet/images/marker-icon.png',
  '/vendor/leaflet/images/marker-shadow.png',
  '/vendor/leaflet/leaflet.css',
  '/vendor/leaflet/leaflet.js',
  '/vendor/marked.umd.js',
  '/vendor/MarkerCluster.css',
  '/vendor/MarkerCluster.Default.css',
  '/vendor/qrcode.js',
];
// <<< 預載清單 結束

/** 沒有它就等於沒有離線能力的核心檔案；缺任何一個就讓 install 失敗（不要靜默半殘）。 */
const CORE = new Set(['/index.html', '/offline.html', '/css/style.css', '/js/app.js']);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const failed = [];
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        failed.push(url);
      }
    }));
    if (failed.length) {
      console.warn('[sw] 預載失敗：', failed.join('、'));
      if (failed.some((u) => CORE.has(u))) {
        throw new Error(`service worker 預載核心檔案失敗：${failed.join('、')}`);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE, MEDIA_CACHE]);
    for (const name of await caches.keys()) {
      if (name.startsWith('mht-') && !keep.has(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  // 頁面剛載入時可主動查詢目前網路狀態：不用等某個請求失敗才知道（offline 時機不易掌握）
  if (data.type === 'PING_NET' && event.source) {
    event.source.postMessage({ type: lastNet === false ? 'NET_DOWN' : 'NET_OK' });
  }
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('mht-')) await caches.delete(name);
      }
      const clients = await self.clients.matchAll();
      for (const c of clients) c.postMessage({ type: 'CACHE_CLEARED' });
    })());
  }
});

const OFFLINE_HTML = `<!DOCTYPE html><html lang="zh-Hant"><meta charset="utf-8">
<title>目前離線</title><body style="font-family:sans-serif;padding:2rem;line-height:1.7">
<h1>目前離線，且這個頁面尚未被快取</h1>
<p>請連上網路後重新開啟；已瀏覽過的頁面在離線時仍可查看。</p></body></html>`;

/** 主動告訴頁面「網路現在可不可達」——只有 service worker 知道背景更新成功與否。 */
let lastNet = null;
async function reportNetwork(ok) {
  if (lastNet === ok) return;
  lastNet = ok;
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage({ type: ok ? 'NET_OK' : 'NET_DOWN' });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const req of keys.slice(0, keys.length - max)) await cache.delete(req);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) {
    await cache.put(request, res.clone());
    if (max) await trim(cacheName, max);
  }
  return res;
}

/**
 * 由快取回答時加一個標記標頭。
 * 為什麼需要：離線時 API 仍回得出 200（來自快取），前端光看狀態碼會以為「已連線」，
 * 頁首就會一直顯示「離線可用」。有了這個標記，前端才知道該筆不是即時資料。
 */
async function markCached(res) {
  if (!res || res.status === 0) return res;
  const headers = new Headers(res.headers);
  headers.set('X-MHT-Cache', 'hit');
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then(async (res) => {
    if (res && res.ok) await cache.put(request, res.clone());
    reportNetwork(true);
    return res;
  }).catch(() => { reportNetwork(false); return null; });
  if (hit) return markCached(hit);            // 先回快取（標記為非即時），背景更新
  const res = await network;
  if (res) return res;
  return new Response(JSON.stringify({
    ok: false, offline: true,
    error: '目前離線，這項資料還沒有快取過',
    hint: '連上網路後重新整理即可取得最新資料。',
  }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

const precached = new Set(PRECACHE);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // POST（實地考察紀錄）永不介入

  const url = new URL(req.url);

  // 導覽：優先網路（拿到新版），斷網時回快取的 App shell（前端自己用 hash 路由）
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await networkFirst(req, SHELL_CACHE);
      } catch (err) {
        reportNetwork(false);
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html'))
          || (await cache.match('/offline.html'))
          || new Response(OFFLINE_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // 跨網域：只快取 OpenStreetMap 圖磚（使用者看過的才存，遵守圖磚政策）
  if (url.origin !== self.location.origin) {
    if (/^[abc]\.tile\.openstreetmap\.org$/.test(url.hostname)) {
      event.respondWith(cacheFirst(req, MEDIA_CACHE, TILE_MAX));
    }
    return;                                          // 其他跨網域一律不介入
  }

  // 診斷端點必須即時，不快取
  if (url.pathname === '/api/health') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }
  if (url.pathname.startsWith('/photos/')) {
    event.respondWith(cacheFirst(req, MEDIA_CACHE, PHOTO_MAX));
    return;
  }
  if (precached.has(url.pathname)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }
  event.respondWith((async () => {
    try {
      return await networkFirst(req, SHELL_CACHE);
    } catch (err) {
      const cache = await caches.open(SHELL_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
