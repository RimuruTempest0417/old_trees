/**
 * API 安全測試
 *
 * 涵蓋：SQL／NoSQL 注入字串、路徑穿越、參數汙染與邊界濫用、超長輸入、
 * 回應標頭與資訊洩漏、HTTP 方法限制，以及前端輸出轉義函式。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';
import { esc, safeUrl } from '../public/js/ui.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = fs.readFileSync(path.join(ROOT, 'source-data', '古樹.csv'), 'utf8').replace(/^\uFEFF/, '');
const csvRows = CSV.split(/\r?\n/).filter((l) => l.trim()).slice(2).map((l) => l.split(',')).filter((r) => r.length >= 8);
const PORT = 3988;

let base;
let child;

test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

const INJECTIONS = [
  "' OR '1'='1",
  "'; DROP TABLE public.trees; --",
  "1'; DELETE FROM public.trees WHERE '1'='1",
  "榕樹' UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL--",
  '"; DROP TABLE trees; --',
  "\\'; SELECT pg_sleep(5); --",
  "' AND 1=(SELECT COUNT(*) FROM information_schema.tables) --",
  "') OR ('1'='1",
  '100%',
  '_',
  '%',
  'admin\'--',
  "javascript:alert(1)",
  '<script>alert(1)</script>',
  '../../etc/passwd',
  '$where: "1"',
  '{"$ne": null}',
  '\u0000null\u0000',
  '\\x27',
  '𝔘𝔫𝔦𝔠𝔬𝔡𝔢𝟘',
  'a'.repeat(5000),
];

test('SQL／指令注入字串注入所有字串參數後，資料仍完整且服務正常', async () => {
  const params = ['parish', 'species', 'grade', 'health', 'keyword'];
  for (const payload of INJECTIONS) {
    for (const p of params) {
      const url = `/api/trees?${p}=${encodeURIComponent(payload)}&limit=50`;
      const res = await get(base, url);
      assert.equal(res.status, 200, `${p}=${payload.slice(0, 30)} 回傳 ${res.status}`);
      assert.equal(res.json.ok, true);
      assert.ok(Array.isArray(res.json.trees));
      assert.ok(res.json.count <= 50);
    }
  }
  // 資料表未被破壞
  const all = await get(base, '/api/trees?limit=2000');
  assert.equal(all.json.count, csvRows.length, '注入後資料筆數改變，代表有查詢被竄改');
});

test('注入字串進入 /api/tree/:tree_no 動態路由不會洩漏或執行', async () => {
  for (const payload of INJECTIONS) {
    const res = await get(base, `/api/tree/${encodeURIComponent(payload)}`);
    assert.ok([200, 400, 404].includes(res.status), `狀態碼 ${res.status}`);
    assert.equal(res.json.ok, false);
    assert.ok(!/information_schema|pg_catalog|syntax error|stack/i.test(res.text),
      `錯誤訊息洩漏內部資訊：${res.text.slice(0, 200)}`);
    assert.ok(!res.text.includes('root:'), '疑似洩漏系統檔案內容');
    // 使用者輸入不得原樣出現在回應中（反射式注入的防線）
    if (payload.length > 3) {
      assert.ok(!res.text.includes(payload), `回應原樣回顯了輸入：${payload.slice(0, 40)}`);
    }
  }
});

test('路徑穿越無法讀取專案檔案或系統檔案', async () => {
  const attacks = [
    '/api/tree/..%2f..%2fpackage.json',
    '/api/tree/....//package.json',
    '/%2e%2e%2fpackage.json',
    '/..%2fpackage.json',
    '/%2e%2e/%2e%2e/etc/passwd',
    '/vendor/../../package.json',
    '/photos/..%2f..%2fpackage.json',
    '/api/tree/%2e%2e%5cpackage.json',
  ];
  for (const a of attacks) {
    const res = await get(base, a);
    assert.ok(res.status >= 400, `${a} 非預期成功（${res.status}）`);
    assert.ok(!res.text.includes('"dependencies"'), `${a} 洩漏了 package.json`);
    assert.ok(!res.text.includes('root:x:'), `${a} 洩漏了 /etc/passwd`);
    assert.ok(!res.text.includes('SUPABASE'), `${a} 洩漏了環境設定`);
  }
});

test('數值參數邊界值不會造成崩潰或無上限回應', async () => {
  const cases = [
    ['/api/trees?limit=999999', (j) => assert.ok(j.count <= 2000)],
    ['/api/trees?limit=-100', (j) => assert.ok(j.count <= 2000)],
    ['/api/trees?limit=abc', (j) => assert.ok(j.count <= 2000)],
    ['/api/trees?limit=1e309', (j) => assert.ok(j.count <= 2000)],
    ['/api/trees?offset=-5', (j) => assert.ok(Array.isArray(j.trees))],
    ['/api/trees?offset=99999999', (j) => assert.equal(j.count, 0)],
    ['/api/trees?min_age=abc&max_age=xyz', (j) => assert.ok(j.count >= 0)],
    ['/api/trees?min_age=NaN&max_age=Infinity', (j) => assert.ok(j.count >= 0)],
    ['/api/trees?lat=abc&lon=xyz&radius_m=def', (j) => assert.ok(j.count >= 0)],
    ['/api/trees?lat=91&lon=181&radius_m=100', (j) => assert.ok(j.count >= 0)],
    ['/api/route?max_stops=99999', (j) => assert.ok(j.stops.length <= 30)],
    ['/api/route?max_stops=-1', (j) => assert.ok(j.stops.length <= 30)],
    ['/api/route?max_stops=abc', (j) => assert.ok(j.stops.length <= 30)],
    ['/api/route?speed_kmh=-5&dwell_sec=99999', (j) => assert.ok(j.estimate.total_min >= 0)],
    ['/api/stats?bucket=0', (j) => assert.ok(j.histogram.bins.length > 0)],
    ['/api/stats?bucket=99999', (j) => assert.ok(Array.isArray(j.histogram.bins))],
  ];
  for (const [url, check] of cases) {
    const res = await get(base, url);
    assert.equal(res.status, 200, `${url} 回傳 ${res.status}`);
    assert.equal(res.json.ok, true, `${url} 回應 ok=false：${res.json.error || ''}`);
    check(res.json);
  }
});

test('重複參數與參數汙染（HPP）不會繞過驗證', async () => {
  const res = await get(base, '/api/trees?grade=%E4%B8%89%E7%B4%9A&grade=%E4%B8%8D%E5%AD%98%E5%9C%A8&limit=5');
  assert.equal(res.status, 200);
  assert.ok(res.json.count <= 5);
  const res2 = await get(base, '/api/trees?limit=1&limit=999999');
  assert.ok(res2.json.count <= 2000);
  // 空值參數不應視為「符合全部」
  const empty = await get(base, '/api/trees?health=&grade=&limit=2000');
  assert.equal(empty.json.count, csvRows.length);
});

test('HTTP 方法：不支援的方法不會造成寫入或錯誤的狀態碼', async () => {
  // 讀取型 API 允許 GET／POST（POST body 亦作為查詢參數），但不得有任何寫入行為
  const before = (await get(base, '/api/trees?limit=2000')).json.count;
  const post = await get(base, '/api/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parish: '大堂區', limit: 5 }),
  });
  assert.equal(post.status, 200);
  assert.ok(post.json.count <= 5);
  const after = (await get(base, '/api/trees?limit=2000')).json.count;
  assert.equal(after, before, 'POST 之後資料筆數改變，代表存在未授權的寫入路徑');

  // 專案中不得存在任何寫入型 API 端點
  const apiDir = path.join(ROOT, 'api');
  const files = fs.readdirSync(apiDir, { recursive: true }).filter((f) => String(f).endsWith('.js'));
  for (const f of files) {
    const src = fs.readFileSync(path.join(apiDir, String(f)), 'utf8');
    for (const op of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(\'rpc_write']) {
      assert.ok(!src.includes(op), `${f} 含有寫入操作 ${op}`);
    }
  }
  const methods = await get(base, '/api/trees', { method: 'DELETE' });
  const stillThere = (await get(base, '/api/trees?limit=2000')).json.count;
  assert.equal(stillThere, before, `DELETE 之後資料筆數改變（狀態 ${methods.status}）`);
});

test('回應標頭不洩漏伺服器資訊，且不允許任意來源的憑證', async () => {
  const { headers } = await get(base, '/api/health');
  assert.equal(headers.get('x-powered-by'), null);
  assert.equal(headers.get('access-control-allow-credentials'), null);
  assert.equal(headers.get('access-control-allow-origin'), '*');
  assert.match(headers.get('content-type'), /application\/json/);
});

test('錯誤回應結構化且不含內部實作細節', async () => {
  const res = await get(base, '/api/tree/999999999');
  assert.equal(res.json.ok, false);
  assert.ok(typeof res.json.error === 'string');
  for (const leak of ['node_modules', '/Users/', 'at Object.', 'postgresql://', 'eyJ', 'relation "', 'SELECT ']) {
    assert.ok(!res.text.includes(leak), `錯誤回應洩漏：${leak}`);
  }
});

test('前端輸出轉義：HTML 特殊字元與危險 URL 一律處理', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('" onmouseover="alert(1)'), '&quot; onmouseover=&quot;alert(1)');
  assert.equal(esc("' or '1'='1"), '&#39; or &#39;1&#39;=&#39;1');
  assert.equal(esc('a & b'), 'a &amp; b');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');

  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('JaVaScRiPt:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(safeUrl('vbscript:msgbox(1)'), '');
  assert.equal(safeUrl('https://upload.wikimedia.org/a.jpg'), 'https://upload.wikimedia.org/a.jpg');
  assert.equal(safeUrl('/photos/species/01.jpg'), '/photos/species/01.jpg');
  assert.equal(safeUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
});

test('資料庫連線資訊不會隨 API 回應外流', async () => {
  for (const p of ['/api/health', '/api/meta', '/api/overview', '/api/stats', '/api/trees?limit=1']) {
    const res = await get(base, p);
    for (const secret of ['service_role', 'SERVICE_ROLE', 'anon_key', 'ANON_KEY', 'supabase.co',
      'postgres', 'password', 'PRIVATE KEY', 'eyJhbGciOiJIUzI1NiIs']) {
      assert.ok(!res.text.toLowerCase().includes(secret.toLowerCase()), `${p} 回應含有 ${secret}`);
    }
  }
});

test('前端不直接持有資料庫金鑰（僅呼叫自家 /api）', () => {
  const jsDir = path.join(ROOT, 'public', 'js');
  for (const f of fs.readdirSync(jsDir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
    assert.ok(!/supabase\.co/i.test(src), `${f} 直接連線 Supabase`);
    assert.ok(!/service_role|SERVICE_ROLE/i.test(src), `${f} 含有服務金鑰字樣`);
    assert.ok(!/createClient\s*\(/.test(src), `${f} 建立了資料庫客戶端`);
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(src), `${f} 疑似內嵌 JWT`);
  }
  // HTML 只可出現說明文字，不得出現端點或金鑰
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  assert.ok(!/supabase\.co/i.test(html), 'index.html 出現 Supabase 端點');
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(html), 'index.html 疑似內嵌 JWT');
  assert.ok(!/service_role/i.test(html), 'index.html 出現服務金鑰字樣');
});

test('內容安全：文章 Markdown 不含遠端可執行腳本或外部追蹤', async () => {
  const res = await get(base, '/api/conservation');
  for (const t of res.json.topics) {
    const one = await get(base, `/api/conservation?slug=${encodeURIComponent(t.slug)}`);
    const body = one.json.topic.body_md;
    assert.ok(!/<script/i.test(body), `${t.slug} 含 script 標籤`);
    assert.ok(!/onerror\s*=/i.test(body), `${t.slug} 含事件屬性`);
    assert.ok(!/javascript:/i.test(body), `${t.slug} 含 javascript: 連結`);
    assert.ok(!/<iframe/i.test(body), `${t.slug} 含 iframe`);
  }
});
