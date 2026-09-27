/**
 * 資安標頭與 CORS 守門測試
 *
 * 起因：2026-09-27 的 ZAP 被動掃描（被掃主機 old-trees-kappa.vercel.app）回報
 *   ① Content Security Policy (CSP) Header Not Set
 *   ② Missing Anti-clickjacking Header
 *   ③ 跨域配置錯誤（Access-Control-Allow-Origin: *）
 *   ④ X-Content-Type-Options Header Missing
 * 這四項都是「設定」而不是程式邏輯，最容易在後續改版悄悄退化（而且不會有任何錯誤訊息），
 * 所以用測試把意圖固定下來。
 *
 * 注意：vercel.json 的標頭由 Vercel 平台在 CDN 層套用，本機的 dev-server 不會套用，
 * 因此這裡是「讀設定檔＋驗 API 執行期行為」，線上實際標頭仍要用 curl 覆核
 * （見 docs/releases 與 skill 的驗證流程）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const PORT = 3991;

let base;
let child;

test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

function globalHeaders() {
  const block = (cfg.headers || []).find((h) => h.source === '/(.*)');
  assert.ok(block, 'vercel.json 必須有一段 source = "/(.*)" 的全站標頭');
  return Object.fromEntries(block.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

const cspOf = () => globalHeaders()['content-security-policy'] || '';
const directive = (name) => {
  const hit = cspOf().split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' '));
  return hit ? hit.slice(name.length + 1).trim() : '';
};

test('vercel.json 設定了四項掃描器會看的標頭', () => {
  const h = globalHeaders();
  assert.ok(h['content-security-policy'], '缺少 Content-Security-Policy');
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.equal(h['x-frame-options'], 'DENY');
  assert.ok(h['referrer-policy'], '缺少 Referrer-Policy');
});

test('CSP 不開後門：沒有 unsafe-eval，script-src 沒有 unsafe-inline', () => {
  assert.ok(cspOf(), 'CSP 不得為空');
  assert.ok(!/unsafe-eval/.test(cspOf()), 'CSP 不應允許 unsafe-eval');
  assert.ok(!directive('script-src').includes('unsafe-inline'), 'script-src 不應允許行內腳本');
  assert.equal(directive('script-src'), "'self'", "script-src 只允許 'self'");
  assert.equal(directive('frame-ancestors'), "'none'", 'CSP 應鎖住被嵌框（clickjacking）');
  assert.equal(directive('object-src'), "'none'");
  assert.equal(directive('base-uri'), "'self'");
  assert.equal(directive('form-action'), "'self'");
  assert.ok(directive('default-src').includes("'self'"));
  // style 必須放行行內：Leaflet／KaTeX／Chart.js 會產生 style 屬性
  assert.ok(directive('style-src').includes('unsafe-inline'), 'style-src 需允許行內樣式（函式庫需要）');
});

test('CSP 的 img-src 涵蓋前端真的會載入的外部圖片來源', () => {
  const img = directive('img-src');
  assert.ok(img.includes("'self'"), '本站照片（/photos/…）必須允許');
  assert.ok(img.includes('data:'), 'QR code／預覽用 data URL 必須允許');
  assert.ok(img.includes('blob:'), '現場照片預覽用 blob URL 必須允許');
  assert.ok(img.includes('https://tile.openstreetmap.org'), '地圖圖磚來源必須允許');
  assert.ok(img.includes('https://*.supabase.co'), '實地考察照片（Supabase Storage）必須允許');
  // 不要用「https:」把整個網際網路放進來（這樣等於沒有 img-src）
  assert.ok(!/(^|[\s;])img-src[^;]*https:(\s|;|$)/.test(cspOf()), 'img-src 不得開放整個 https:');

  // 反向核對：地圖模組真的只用這一個外部圖磚來源
  const mapJs = fs.readFileSync(path.join(ROOT, 'public/js/map.js'), 'utf8');
  const externals = [...mapJs.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]);
  const tileHosts = externals.filter((h) => /tile\.openstreetmap\.org$/.test(h));
  assert.ok(tileHosts.length > 0, '地圖應有圖磚來源');
  for (const h of new Set(externals)) {
    assert.ok(
      img.includes(h) || cspOf().includes(h) || /(^|\.)openstreetmap\.org$/.test(h) || /(^|\.)w3\.org$/.test(h),
      `map.js 出現的外部網域 ${h} 未列入 CSP（若只是連結可加白名單，若是圖片／請求則必須列入）`,
    );
  }
});

test('Permissions-Policy 只放行本站需要的定位與相機', () => {
  const p = globalHeaders()['permissions-policy'] || '';
  assert.ok(p.includes('geolocation=(self)'), '實地考察的 GPS 比對需要本站定位權限');
  assert.ok(p.includes('camera=(self)'), '手機拍照上傳需要本站相機權限');
  assert.ok(p.includes('microphone=()'), '本站不使用麥克風，應關閉');
});

test("前端沒有任何行內事件處理器或行內 script（否則 script-src 'self' 會擋掉功能）", () => {
  const files = ['public/index.html', 'public/offline.html'];
  for (const f of fs.readdirSync(path.join(ROOT, 'public/js'))) {
    if (f.endsWith('.js')) files.push(path.join('public/js', f));
  }
  const handler = /\son(click|change|input|submit|load|error|keydown|keyup|keypress|focus|blur|mouse[a-z]+|touch[a-z]+|pointer[a-z]+|drag[a-z]*|drop|scroll|wheel|contextmenu)\s*=/i;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!handler.test(src), `${f} 仍有行內事件處理器，會被 CSP 擋下`);
    // 行內 script 只在 HTML 裡才有意義（JS 用 innerHTML 寫入的 <script> 不會執行）
    if (f.endsWith('.html')) {
      assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>\s*[^\s<]/.test(src), `${f} 仍有行內 script`);
    }
  }
});

test('後端不再用萬用 CORS：程式與設定檔都不得出現 Access-Control-Allow-Origin: *', () => {
  const targets = [
    ...fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.js')).map((f) => path.join('lib', f)),
    ...fs.readdirSync(path.join(ROOT, 'lib/routes')).map((f) => path.join('lib/routes', f)),
    'api/[[...route]].js',
  ];
  for (const f of targets) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/Access-Control-Allow-Origin'?\s*,\s*'\*'/.test(src), `${f} 仍有 ACAO: *`);
  }
});

test('CORS 白名單：放行本站來源、拒絕其他來源、未帶 Origin 不回標頭', async () => {
  const allowed = 'https://old-trees-mylearning.vercel.app';

  const withAllowed = await get(base, '/api/trees?limit=1', { headers: { Origin: allowed } });
  assert.equal(withAllowed.headers.get('access-control-allow-origin'), allowed);
  assert.match(withAllowed.headers.get('vary') || '', /Origin/, '帶 Origin 時必須 Vary: Origin');

  const withEvil = await get(base, '/api/trees?limit=1', { headers: { Origin: 'https://evil.example' } });
  assert.equal(withEvil.status, 200);
  assert.equal(withEvil.headers.get('access-control-allow-origin'), null, '非白名單來源不得回 ACAO');
  assert.equal(withEvil.headers.get('access-control-allow-credentials'), null);

  const plain = await get(base, '/api/trees?limit=1');
  assert.equal(plain.headers.get('access-control-allow-origin'), null, '沒有 Origin 就不需要 CORS 標頭');
});

test('API 回應仍帶 nosniff 類的防護性標頭（執行期）與 JSON 型別', async () => {
  const res = await get(base, '/api/health');
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('x-powered-by'), null, '不得洩漏伺服器實作');
});
