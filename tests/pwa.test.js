/**
 * 離線 PWA 測試：manifest、service worker 預載清單、離線狀態邏輯。
 *
 * 這一組守住三個「錯了就很難發現」的地方：
 *  1. **預載清單與實際檔案必須同步**（少一個 → 離線白畫面；多一個不存在的 → install 直接失敗，
 *     等於完全沒有離線能力）。做法是重跑產生器比對（`--check`）＋ 逐一確認檔案存在。
 *  2. **service worker 必須從站台根目錄提供**（`/sw.js`、scope `/`），否則子路徑攔不到；
 *     而且要用 `text/javascript` MIME，否則瀏覽器直接拒絕註冊。
 *  3. **離線狀態的判斷邏輯**（純函式）要講人話：不支援、離線、有新版本、已就緒各有不同訊息，
 *     不能靜默失效讓使用者以為有離線功能。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer } from './helpers/server.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = (p) => path.join(ROOT, 'public', p);
const read = (p) => fs.readFileSync(pub(p), 'utf8');

const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const offline = read('offline.html');
const index = read('index.html');
const pwa = read('js/pwa.js');

const { pwaState, registrationIssue, SW_URL, SW_SCOPE } = await import('../public/js/pwa.js');

/** 從 sw.js 的標記區取出預載清單（順便證明標記還在，產生器才有地方寫）。 */
function precacheList() {
  const m = /\/\/ >>> 預載清單 開始[\s\S]*?const PRECACHE = \[([\s\S]*?)\];[\s\S]*?\/\/ <<< 預載清單 結束/.exec(sw);
  assert.ok(m, 'sw.js 找不到預載清單標記區');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** 讀 PNG 的 IHDR 取得真實尺寸（不信任 manifest 寫的數字）。 */
function pngSize(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(0, 8).toString('latin1'), '\x89PNG\r\n\x1a\n', `${file} 不是 PNG`);
  assert.equal(b.subarray(12, 16).toString('latin1'), 'IHDR', `${file} 不是 PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const PORT = 3991;
let base;
let child;

test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

// ── 1. manifest ────────────────────────────────────────────
test('manifest：必要欄位齊全，且可安裝（standalone、start_url、scope）', () => {
  assert.equal(manifest.short_name, '澳門古樹');
  assert.match(manifest.name, /澳門古樹保育研究平台/);
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.display_override.includes('standalone'));
  assert.equal(manifest.scope, '/');
  assert.match(manifest.start_url, /^\/index\.html#\//, 'start_url 應指向單頁應用的進入點');
  assert.equal(manifest.lang, 'zh-Hant');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, '主畫面長按應有捷徑');
  for (const s of manifest.shortcuts) {
    assert.ok(s.name && s.url, '捷徑要有名稱與網址');
    assert.ok(s.url.startsWith('/index.html#/'), `捷徑 ${s.url} 不是站內深連結`);
  }
});

test('manifest 圖示：192 與 512 真存在，尺寸與宣告一致，且附 maskable', () => {
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), '缺 192 圖示（安裝提示的最低要求）');
  assert.ok(sizes.includes('512x512'), '缺 512 圖示');
  assert.ok(manifest.icons.some((i) => String(i.purpose).includes('maskable')),
    '缺 maskable 圖示（Android 圓形裁切會破圖）——同一張圖可寫成 "any maskable"');
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('/'), `圖示 ${icon.src} 必須是站內絕對路徑`);
    const file = pub(icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(file), `圖示檔不存在：${icon.src}`);
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(file), { w, h }, `${icon.src} 實際尺寸與宣告不符`);
  }
  // Apple 主畫面圖示（iOS 不看 manifest 的 icons）
  assert.ok(fs.existsSync(pub('icons/apple-touch-icon.png')), '缺 apple-touch-icon.png');
  assert.match(index, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest">/);
});

// ── 2. service worker ─────────────────────────────────────
test('App 圖示與來源 SVG 同步（改了 icon.svg 忘了重跑 build-icons 要紅燈）', () => {
  const out = execFileSync('node', ['scripts/build-icons.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /已是最新/);
  // iOS 主畫面用的是 180×180 的 apple-touch-icon，不是 manifest 裡那兩張
  const { w, h } = pngSize(pub('icons/apple-touch-icon.png'));
  assert.equal(w, 180);
  assert.equal(h, 180);
  // 圖示要留安全區（maskable 圓形裁切）：內容最外緣半徑不得超過 410/1024
  const svg = fs.readFileSync(pub('icons/icon.svg'), 'utf8');
  const ring = svg.match(/<circle cx="512" cy="512" r="(\d+)" fill="none"/);
  assert.ok(ring, '圖示來源應該有一道金色外環（名錄印記）');
  assert.ok(Number(ring[1]) + 20 <= 410, `外環半徑 ${ring[1]} 太靠邊，Android 圓形裁切會切到`);
});

test('sw.js：預載清單與實際檔案同步（產生器 --check 必須無差異）', () => {
  const out = execFileSync('node', ['scripts/build-sw.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /已是最新/);
  // 逐一確認清單裡的檔案真的存在（install 是 addAll 語意，缺一個就整包失敗）
  const missing = precacheList().filter((u) => !fs.existsSync(pub(u.replace(/^\//, ''))));
  assert.deepEqual(missing, [], `預載清單指向不存在的檔案：${missing.join('、')}`);
  assert.ok(precacheList().length >= 40, `預載項目過少（${precacheList().length}），可能漏掉 vendor 或模組`);
});

test('sw.js：index.html 引用到的本機資源都在預載清單內（離線才不會少檔）', () => {
  const list = new Set(precacheList());
  const refs = [...index.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 12, `index.html 的本機引用只有 ${refs.length} 個，解析可能失效`);
  const missing = refs.filter((r) => !list.has(r));
  assert.deepEqual(missing, [], `這些資源沒有預載，離線時會失敗：${missing.join('、')}`);
  // 前端模組是動態 import 的，也要在清單裡
  for (const mod of ['/js/app.js', '/js/map.js', '/js/card.js', '/js/qr.js', '/js/pwa.js']) {
    assert.ok(list.has(mod), `${mod} 未預載`);
  }
});

test('sw.js：快取名稱帶版本、啟用時清掉舊版、且與 API_VERSION 一致', () => {
  const repo = fs.readFileSync(path.join(ROOT, 'lib', 'repo.js'), 'utf8');
  const apiVersion = /export const API_VERSION = '([^']+)'/.exec(repo)[1];
  assert.match(sw, new RegExp(`const VERSION = '${apiVersion}'`),
    `sw.js 的版本要跟著 API_VERSION（${apiVersion}）走，否則使用者永遠拿到舊快取`);
  assert.match(sw, /const SHELL_CACHE = `mht-shell-\$\{VERSION\}`/);
  assert.match(sw, /cacheName\.startsWith\('mht-'\)|name\.startsWith\('mht-'\)/, 'activate 要清掉舊版快取');
  assert.match(sw, /self\.clients\.claim\(\)/, 'activate 應立即接管頁面');
  assert.match(sw, /self\.skipWaiting\(\)/, 'install 應立即啟用新版本');
});

test('sw.js：只處理 GET（實地考察紀錄的 POST 絕不介入）', () => {
  assert.match(sw, /if \(req\.method !== 'GET'\) return;/);
  assert.ok(!/method: 'POST'/.test(sw), 'sw 不該自己發 POST');
});

test('sw.js：/api/health 不快取（診斷資訊必須即時）', () => {
  assert.match(sw, /url\.pathname === '\/api\/health'\) return;/);
});

test('sw.js：照片與圖磚有快取上限，且不主動批量下載（遵守 OSM 政策）', () => {
  assert.match(sw, /PHOTO_MAX = \d+/);
  assert.match(sw, /TILE_MAX = \d+/);
  assert.match(sw, /async function trim\(cacheName, max\)/, '沒有修剪機制，快取會無限成長');
  // sw.js 內是轉義過的正則（tile\.openstreetmap\.org），比對時只看關鍵字
  assert.match(sw, /openstreetmap/i, '應只針對 OSM 圖磚做媒體快取');
  assert.match(sw, /url\.origin !== self\.location\.origin/, '跨網域要先分流，其他網域不得快取');
  const photoMax = Number(/PHOTO_MAX = (\d+)/.exec(sw)[1]);
  const tileMax = Number(/TILE_MAX = (\d+)/.exec(sw)[1]);
  assert.ok(photoMax <= 400 && tileMax <= 500, '上限過大，會佔滿使用者裝置空間');
  // 不得出現「一次抓一批照片」的程式碼
  assert.ok(!/photos.*for \(|allPhotos|prefetchAll/i.test(sw), 'sw 不應批次抓取照片');
});

test('sw.js：API 採 stale-while-revalidate，離線且無快取時回可讀的 JSON', () => {
  assert.match(sw, /async function staleWhileRevalidate\(/);
  assert.match(sw, /offline: true/);
  assert.match(sw, /連上網路後重新整理/, '離線錯誤訊息要講人話');
});

// ── 3. 離線狀態邏輯（純函式）──────────────────────────────
test('pwaState：各種狀態都要有可讀的徽章與橫幅', () => {
  const ready = pwaState({ supported: true, online: true, controlled: true, cached: 128 });
  assert.equal(ready.chip, '離線可用');
  assert.equal(ready.banner, null);

  const offline = pwaState({ supported: true, online: false, controlled: true });
  assert.equal(offline.chip, '離線模式');
  assert.match(offline.banner, /離線/);
  assert.match(offline.banner, /快取/, '要告訴使用者看到的是快取資料');

  const cold = pwaState({ supported: true, online: false, controlled: false });
  assert.match(cold.banner, /還沒被快取/, '沒快取過的離線情況要說清楚');

  const updating = pwaState({ supported: true, online: true, controlled: true, updateReady: true });
  assert.equal(updating.chip, '有新版本');
  assert.equal(updating.canInstall, true);
  assert.match(updating.banner, /重新載入/);

  // navigator.onLine 說有網路、但請求失敗（伺服器掛了、被網路攔截）
  const netDown = pwaState({ supported: true, online: true, networkDown: true, controlled: true });
  assert.equal(netDown.chip, '離線模式', '請求失敗時也要顯示離線，不能只看 navigator.onLine');
  assert.match(netDown.banner, /快取/, '要說明正在看快取資料');
  assert.match(netDown.banner, /伺服器/, '要說明裝置有網路、是伺服器連不上');

  const pending = pwaState({ supported: true, online: true, controlled: false });
  assert.equal(pending.chip, '離線準備中');

  const noSw = pwaState({ supported: false });
  assert.match(noSw.chip, /不支援/);
  assert.match(noSw.chipTitle, /不受影響|仍可/, '要說明「不支援離線」不等於不能用網站');
});

test('registrationIssue：http 非 localhost、不支援 service worker 都要明講原因', () => {
  assert.equal(registrationIssue({ supported: true, secureContext: true }), null);
  assert.match(registrationIssue({ supported: true, secureContext: false, protocol: 'http:', hostname: 'example.com' }),
    /HTTPS/);
  assert.equal(registrationIssue({ supported: true, secureContext: false, protocol: 'http:', hostname: 'localhost' }),
    null, 'localhost 是安全來源，應該可以註冊');
  assert.match(registrationIssue({ supported: false }), /不支援 service worker/);
});

test('離線偵測：health 探針與 service worker 都要回報網路狀態', () => {
  // 離線時 /api/* 仍會被 service worker 用快取回答（HTTP 200），光看狀態碼會誤判為已連線
  const api = fs.readFileSync(path.join(ROOT, 'public', 'js', 'api.js'), 'utf8');
  const health = api.slice(api.indexOf('export async function healthRaw'));
  assert.match(health.slice(0, 900), /notifyNetwork\(true\)/, 'health 成功時要回報已連線');
  assert.match(health.slice(0, 900), /notifyNetwork\(false\)/, 'health 失敗時要回報離線');
  assert.ok(!/cache: 'no-store'[\s\S]{0,200}precached/.test(health), 'health 不該被快取');
  assert.match(sw, /postMessage\(\{ type: ok \? 'NET_OK' : 'NET_DOWN' \}\)/, 'sw 要主動回報網路狀態');
  assert.match(sw, /if \(lastNet === ok\) return;/, '狀態沒變就不要重複通知');
  assert.match(pwa, /type === 'NET_DOWN'/, 'pwa.js 要處理 NET_DOWN');
  assert.match(pwa, /type === 'NET_OK'/, 'pwa.js 要處理 NET_OK');
  // 從快取回答的 API 回應要標記，否則離線時每個請求看起來都成功
  assert.match(sw, /headers\.set\('X-MHT-Cache', 'hit'\)/, 'sw 要標記由快取回答的回應');
  assert.match(api, /res\.headers\.get\('x-mht-cache'\) !== 'hit'/, '前端要看這個標記再決定是否算已連線');
});

test('pwa.js：註冊路徑與 scope 都是站台根目錄', () => {
  assert.equal(SW_URL, '/sw.js');
  assert.equal(SW_SCOPE, '/');
  assert.match(pwa, /navigator\.serviceWorker\.register\(SW_URL, \{ scope: SW_SCOPE \}\)/);
  // app.js 要在啟動時呼叫（否則永遠不會註冊）
  const app = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
  assert.match(app, /import \{ initPwa \} from '\.\/pwa\.js'/);
  assert.match(app, /initPwa\(\);/);
});

// ── 4. 離線頁 ──────────────────────────────────────────────
test('offline.html：可獨立離線顯示（不連外、有重載按鈕、深淺色都適用）', () => {
  assert.match(offline, /<html lang="zh-Hant">/);
  assert.match(offline, /location\.reload\(\)/, '要能重新載入');
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(offline), '離線頁不得引用外部資源');
  assert.match(offline, /prefers-color-scheme: dark/, '離線頁也要支援深色模式');
  assert.match(offline, /div\(100dvh\)|100dvh/, '用動態視窗高度，手機才不會有白邊');
  assert.ok(precacheList().includes('/offline.html'), '離線頁本身必須被預載');
});

// ── 5. 伺服器實際提供（真的抓一次）────────────────────────
test('伺服器以正確的 MIME 提供 sw.js／manifest／圖示', async () => {
  const swRes = await fetch(`${base}/sw.js`);
  assert.equal(swRes.status, 200);
  assert.match(swRes.headers.get('content-type') || '', /javascript/,
    'sw.js 必須以 text/javascript 提供，否則瀏覽器拒絕註冊');
  const swText = await swRes.text();
  assert.match(swText, /const PRECACHE = \[/, '線上取得的 sw.js 內容不完整');

  const mfRes = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(mfRes.status, 200);
  assert.match(mfRes.headers.get('content-type') || '', /manifest\+json/,
    'manifest 的 MIME 應為 application/manifest+json');
  assert.equal((await mfRes.json()).short_name, '澳門古樹');

  const iconRes = await fetch(`${base}/icons/icon-512.png`);
  assert.equal(iconRes.status, 200);
  assert.equal(iconRes.headers.get('content-type'), 'image/png');

  const offRes = await fetch(`${base}/offline.html`);
  assert.equal(offRes.status, 200);
  assert.match(offRes.headers.get('content-type') || '', /text\/html/);
});

test('預載清單中的每個網址都回 200（避免 install 時才發現 404）', async () => {
  const urls = precacheList();
  const bad = [];
  for (const u of urls) {
    const res = await fetch(`${base}${u}`);
    if (res.status !== 200) bad.push(`${u} → ${res.status}`);
    await res.arrayBuffer();
  }
  assert.deepEqual(bad, [], `以下預載項目無法取得：${bad.join('、')}`);
});
