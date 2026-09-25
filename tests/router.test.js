/**
 * API 路由層測試
 *
 * 為什麼要有這組：Vercel Hobby 方案限制「每個 Deployment 最多 12 個 Serverless Function」，
 * 而 `api/` 底下每個 .js 都是一個 function。曾經因為有 13 個檔案（12 個端點 ＋ 1 個動態路由）
 * 導致部署直接失敗（No more than 12 Serverless Functions can be added to a Deployment）。
 * 現在全部端點集中在唯一入口 api/[[...route]].js，由 lib/router.js 分派到 lib/routes/。
 * 以下測試守住這個結構，避免以後新增端點時又踩到上限。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchRoute, ROUTES, loadRoute } from '../lib/router.js';
import { startServer, stopServer, get } from './helpers/server.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3994;

test('api/ 只有一個 Serverless Function（Vercel Hobby 上限 12）', () => {
  const files = fs.readdirSync(path.join(ROOT, 'api'), { recursive: true })
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.js'));
  assert.equal(files.length, 1, `api/ 有 ${files.length} 個 function：${files.join('、')}`);
  assert.equal(files[0], '[[...route]].js', '唯一入口必須是可選萬用路徑 api/[[...route]].js');
});

test('路由表與 lib/routes/ 的檔案一一對應', () => {
  const dir = path.join(ROOT, 'lib', 'routes');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
  const ids = ROUTES.map((r) => r.id);
  assert.deepEqual([...ids].sort(), [...files].sort(), '路由表與 lib/routes/ 不一致（多或少檔）');
  // handler 已不在 api/ 底下，否則又會變成一個 function
  for (const id of ids) assert.ok(!fs.existsSync(path.join(ROOT, 'api', `${id}.js`)), `api/${id}.js 不該存在`);
});

test('每個路由 id 都要有「字面字串」的模組載入器（線上才找得到檔案）', async () => {
  // 2026-09-25 實際故障：新增 /api/priority 時只加了路由表，忘了加 LOADERS。
  // 本機沒事，是因為 scripts/dev-server.mjs 自己用檔案路徑 import 後以 opts.handler 傳進來，
  // 完全繞過 LOADERS；線上的唯一入口 api/[[...route]].js 走的是 loadRoute()，
  // 找不到載入器就整個 function 崩掉（Vercel 回 FUNCTION_INVOCATION_FAILED，HTTP 500）。
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'router.js'), 'utf8');
  // 1. 每一個路由 id 都必須能載入（真的呼叫 loadRoute，不是看原始碼）
  for (const r of ROUTES) {
    const fn = await loadRoute(r.id);
    assert.equal(typeof fn, 'function', `${r.id} 載入後不是函式`);
  }
  // 2. 載入器只能是字面字串路徑（用變數組字串，Vercel 的打包器追蹤不到）
  const loaderBlock = src.slice(src.indexOf('const LOADERS = {'), src.indexOf('};', src.indexOf('const LOADERS = {')));
  const paths = [...loaderBlock.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  assert.equal(paths.length, ROUTES.length, `載入器數量 ${paths.length} 與路由數 ${ROUTES.length} 不符`);
  for (const p of paths) {
    assert.match(p, /^\.\/routes\/[a-z0-9-]+\.js$/, `載入器路徑必須是字面字串且指向 lib/routes：${p}`);
  }
  // 3. lib/routes 底下的每個檔案都要有人載入，反之亦然
  const files = fs.readdirSync(path.join(ROOT, 'lib', 'routes')).filter((f) => f.endsWith('.js'));
  assert.deepEqual(paths.map((p) => p.replace('./routes/', '')).sort(), files.sort(),
    'lib/routes 的檔案與載入器不一致');
});

test('不用 dev-server 的捷徑也要能分派（模擬線上唯一入口的路徑）', async () => {
  // dev-server 會傳 opts.handler；線上 api/[[...route]].js 不會傳，
  // 因此這裡刻意「不傳 handler」跑一次真正的 loadRoute + handler。
  const { dispatch } = await import('../lib/router.js');
  let body = '';
  const res = {
    statusCode: 200, headers: {}, writableEnded: false,
    setHeader(k, v) { this.headers[k] = v; },
    end(chunk) { this.writableEnded = true; body = String(chunk || ''); },
  };
  const req = { method: 'GET', url: '/api/priority?limit=2', headers: { host: 'localhost' } };
  const handled = await dispatch(req, res, '/api/priority');
  assert.equal(handled, true, 'router 必須處理 /api/priority');
  const data = JSON.parse(body);
  assert.equal(data.ok, true, `回應不是成功：${body.slice(0, 200)}`);
  assert.equal(data.items.length, 2);
});

test('路徑比對：固定路徑、單段動態參數、未知路徑', () => {
  assert.deepEqual(matchRoute('/api/health'), { id: 'health', params: {} });
  assert.deepEqual(matchRoute('/api/tree/66'), { id: 'tree', params: { tree_no: '66' } });
  assert.deepEqual(matchRoute('/api/tree/T0000611'), { id: 'tree', params: { tree_no: 'T0000611' } });
  assert.deepEqual(matchRoute('/api/health/'), { id: 'health', params: {} });     // 尾斜線容錯
  assert.equal(matchRoute('/api/tree'), null, '/api/tree 缺少參數時不該命中');
  assert.equal(matchRoute('/api/tree/66/extra'), null, '動態參數只吃單一段');
  assert.equal(matchRoute('/api/不存在'), null);
  assert.equal(matchRoute('/api/__proto__'), null, '不可把原型屬性當成路由');
});

test('單段落 ＋ 查詢參數的路由形式（Vercel 唯一可靠的形式）', async () => {
  assert.deepEqual(matchRoute('/api/tree', '?no=544'), { id: 'tree', params: { tree_no: '544' } });
  assert.deepEqual(matchRoute('/api/tree', '?tree_no=544') , null, '只認 queryParam 指定的參數名');
  assert.deepEqual(matchRoute('/api/tree/544'), { id: 'tree', params: { tree_no: '544' } }, '路徑形式仍要可用');
  assert.equal(matchRoute('/api/tree'), null, '沒有查詢參數時不算命中');
});

test('前端只能呼叫「單段落」API 路徑（Vercel 的 api catch-all 只匹配一個段落）', () => {
  // 2026-09-24 實際故障：/api/tree/544 在 Vercel 上 404（「The page could not be found」），
  // 但 /api/trees、/api/health 正常 —— 因為萬用入口只匹配一個路徑段落。
  // 這項測試擋住「前端又出現多段落呼叫」這種回歸。
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'api.js'), 'utf8');
  const paths = [...js.matchAll(/request\(\s*[`'"]\/([^`'"$]*)/g)].map((m) => m[1]);
  assert.ok(paths.length >= 10, `應解析到多個端點，實際 ${paths.length}`);
  for (const p of paths) {
    assert.ok(!p.includes('/'), `前端不可呼叫多段落端點：/${p}`);
  }
});

test('vercel.json 把 /api/tree/:no 重寫成單段落形式', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rw = (cfg.rewrites || []).find((r) => r.source === '/api/tree/:no');
  assert.ok(rw, 'vercel.json 必須有 /api/tree/:no 的 rewrite');
  assert.equal(rw.destination, '/api/tree?no=:no');
});

test('萬用入口在真實伺服器上仍能正確分派（含動態路由與 404）', async () => {
  const { base, child } = await startServer(PORT);
  try {
    const health = await get(base, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);

    const tree = await get(base, '/api/tree/66');
    assert.equal(tree.status, 200);
    assert.ok(tree.json.tree && tree.json.tree.tree_no === '66');

    const unknown = await get(base, '/api/not-a-real-endpoint');
    assert.equal(unknown.status, 404);
    assert.equal(unknown.json.ok, false);
    assert.match(unknown.json.error, /找不到 API 路由/);

    const deep = await get(base, '/api/tree/66/extra');
    assert.equal(deep.status, 404, '多一層路徑也必須是 404');
  } finally {
    await stopServer(child);
  }
});
