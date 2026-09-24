/**
 * API 功能測試 —— 以本機開發伺服器（行為等同 Vercel Serverless Functions）
 * 實際發出 HTTP 請求，驗證每個端點的內容與內部一致性。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = fs.readFileSync(path.join(ROOT, 'source-data', '古樹.csv'), 'utf8').replace(/^\uFEFF/, '');
const csvRows = CSV.split(/\r?\n/).filter((l) => l.trim()).slice(2).map((l) => l.split(',')).filter((r) => r.length >= 8);
const PORT = 3987;

let base;
let child;

test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

test('GET /api/health 回報資料來源與筆數', async () => {
  const { status, json, headers } = await get(base, '/api/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.ok(['supabase', 'snapshot'].includes(json.data_source));
  assert.equal(json.tree_count, csvRows.length);
  assert.match(headers.get('content-type'), /application\/json/);
  assert.equal(headers.get('access-control-allow-origin'), '*');
});

test('GET /api/overview 統計與 CSV 直接計算一致', async () => {
  const { json } = await get(base, '/api/overview');
  const o = json.overview;
  assert.equal(o.tree_count, csvRows.length);
  assert.equal(o.max_age, Math.max(...csvRows.map((r) => Number(r[1]))));
  assert.equal(o.endangered, csvRows.filter((r) => r[5] === '瀕危').length);
  assert.equal(o.grade1 + o.grade2 + o.grade3 + o.grade_other, csvRows.length);
  assert.equal(o.good + o.fair + o.endangered, csvRows.length);
  assert.equal(json.oldest.length, 10);
  assert.ok(Number(json.oldest[0].age_years) >= Number(json.oldest[1].age_years));
  assert.equal(json.grade_distribution.length, 4);
  assert.equal(json.health_distribution.length, 3);
});

test('GET /api/parishes 各堂區株數加總正確、佔比合計 100%', async () => {
  const { json } = await get(base, '/api/parishes');
  assert.equal(json.rows.length, 8);
  assert.equal(json.rows.reduce((s, r) => s + r.tree_count, 0), csvRows.length);
  const share = json.rows.reduce((s, r) => s + r.share_pct, 0);
  assert.ok(Math.abs(share - 100) < 0.5, `佔比合計 ${share}`);
  assert.equal(json.density_ranking.length, 8);
  // 密度排序必須遞減
  const d = json.density_ranking.map((x) => x.density_per_km2);
  assert.deepEqual(d, [...d].sort((a, b) => b - a));
});

test('GET /api/trees 支援多重篩選且總數正確', async () => {
  const all = await get(base, '/api/trees?limit=2000');
  assert.equal(all.json.count, csvRows.length);

  const byParish = await get(base, `/api/trees?parish=${encodeURIComponent('聖方濟各堂區')}&limit=2000`);
  assert.equal(byParish.json.count, csvRows.filter((r) => r[7] === '聖方濟各堂區').length);

  const bySpecies = await get(base, `/api/trees?species=${encodeURIComponent('心葉榕')}&limit=2000`);
  assert.equal(bySpecies.json.count, csvRows.filter((r) => r[3] === '心葉榕').length);

  const combo = await get(base, `/api/trees?parish=${encodeURIComponent('風順堂區')}&health=${encodeURIComponent('瀕危')}&limit=2000`);
  assert.equal(combo.json.count,
    csvRows.filter((r) => r[7] === '風順堂區' && r[5] === '瀕危').length);

  const byAge = await get(base, '/api/trees?min_age=300&limit=2000');
  assert.equal(byAge.json.count, csvRows.filter((r) => Number(r[1]) >= 300).length);

  // 每筆都必須有座標與必要欄位
  for (const t of all.json.trees) {
    assert.ok(Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lon)));
    assert.ok(t.tree_no && t.species && t.parish && t.health && t.grade);
  }
});

test('GET /api/trees 分頁與排序正確', async () => {
  const p1 = await get(base, '/api/trees?limit=10&offset=0');
  const p2 = await get(base, '/api/trees?limit=10&offset=10');
  assert.equal(p1.json.count, 10);
  assert.equal(p1.json.total, csvRows.length);
  assert.equal(p1.json.has_more, true);
  const overlap = p1.json.trees.filter((a) => p2.json.trees.some((b) => b.tree_no === a.tree_no));
  assert.equal(overlap.length, 0);
  const ages = p1.json.trees.map((t) => t.age_years);
  assert.deepEqual(ages, [...ages].sort((a, b) => b - a));
});

test('GET /api/tree?no=：單段落形式（Vercel 上唯一可靠的形式）與路徑形式結果相同', async () => {
  // 2026-09-24：Vercel 的 api/[[...route]].js 只匹配一個路徑段落，
  // /api/tree/544 在線上直接 404（連 function 都進不去），因此前端改呼叫 /api/tree?no=…
  const oldest = csvRows[0][2];   // [分級, 樹齡, 古樹編號, 物種, …]
  const a = await get(base, `/api/tree/${oldest}`);
  const b = await get(base, `/api/tree?no=${encodeURIComponent(oldest)}`);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(b.json.tree, a.json.tree, '兩種形式的單株資料必須一致');

  const missing = await get(base, '/api/tree?no=999999999');
  assert.equal(missing.status, 404);
  const bad = await get(base, '/api/tree?no=%3Cscript%3E');
  assert.equal(bad.status, 400);
});

test('GET /api/tree/:tree_no 回傳單株詳情與同地點鄰居', async () => {
  const oldest = csvRows.reduce((a, b) => (Number(a[1]) >= Number(b[1]) ? a : b));
  const { json } = await get(base, `/api/tree/${oldest[2]}`);
  assert.equal(json.tree.tree_no, oldest[2]);
  assert.equal(json.tree.species, oldest[3]);
  assert.equal(Number(json.tree.age_years), Number(oldest[1]));
  assert.equal(json.tree.site, oldest[6]);
  assert.ok(Array.isArray(json.neighbours));
  assert.ok(json.neighbours.every((n) => n.site === json.tree.site));
  // 動態路由：不存在的編號必須是錯誤而非空白
  const missing = await get(base, '/api/tree/999999999');
  assert.equal(missing.status, 404);
  assert.equal(missing.json.ok, false);
  assert.ok(missing.json.error.includes('找不到'));
  // 格式不正確的編號回傳 400，且不原樣回顯輸入
  const bad = await get(base, `/api/tree/${encodeURIComponent("<script>alert(1)</script>")}`);
  assert.equal(bad.status, 400);
  assert.ok(!bad.text.includes('script'), '錯誤訊息不應回顯使用者輸入');
});

test('GET /api/stats 各項統計內部一致', async () => {
  const { json } = await get(base, '/api/stats');
  assert.equal(json.sample.n, csvRows.length);
  // 直方圖總和＝樣本數
  assert.equal(json.histogram.bins.reduce((s, b) => s + b.count, 0), csvRows.length);
  // 相關係數範圍
  for (const v of Object.values(json.correlations)) {
    assert.ok(v >= -1.0001 && v <= 1.0001, `相關係數超出範圍：${v}`);
  }
  // 模型 R² 範圍與必備欄位（R² 可為負：代表比直接用平均值更差）
  assert.ok(json.models.length >= 4);
  for (const m of json.models) {
    assert.ok(m.r2 >= -1 && m.r2 <= 1.0001, `${m.type} R²=${m.r2}`);
    assert.ok(m.rmse >= 0);
    assert.equal(m.n, csvRows.length);
    assert.ok(m.formula && m.label);
  }
  // 最佳的數值模型確實是 R² 最大者
  const numeric = json.models.filter((m) => m.type !== 'species-dummy');
  const best = numeric.reduce((a, b) => (a.r2 >= b.r2 ? a : b));
  assert.equal(json.best_numeric_model.type, best.type);
  // ANOVA 自由度
  const a = json.anova.height_by_species;
  assert.equal(a.dfBetween + a.dfWithin, a.n - 1);
  assert.ok(a.eta2 >= 0 && a.eta2 <= 1);
  // 卡方矩陣列和＝該堂區株數
  json.chi_square.rows.forEach((p, i) => {
    const sum = json.chi_square.matrix[i].reduce((x, y) => x + y, 0);
    assert.equal(sum, csvRows.filter((r) => r[7] === p).length);
  });
  assert.ok(json.chi_square.p >= 0 && json.chi_square.p <= 1);
  // 預測模型單調且序列完整
  assert.equal(json.projection.series.length, 51);
  assert.equal(json.projection.series[0].total, csvRows.length);
  for (let i = 1; i < json.projection.series.length; i += 1) {
    assert.ok(json.projection.series[i].survivedOnly <= json.projection.series[i - 1].survivedOnly + 1e-9);
  }
  assert.ok(json.conclusions.length >= 5);
});

test('GET /api/routes 與 GET /api/route 路綫推薦可用', async () => {
  const list = await get(base, '/api/routes');
  assert.equal(list.json.count, 5);
  const codes = list.json.routes.map((r) => r.code);
  assert.ok(codes.includes('coloane-wild'));

  for (const code of codes) {
    const r = await get(base, `/api/route?code=${encodeURIComponent(code)}&max_stops=8`);
    assert.equal(r.status, 200, `${code} 應回傳 200`);
    const d = r.json;
    assert.ok(d.stops.length > 0, `${code} 沒有停靠點`);
    assert.ok(d.stops.length <= 8);
    // 站序必須連續遞增
    assert.deepEqual(d.stops.map((s) => s.order), d.stops.map((_, i) => i + 1));
    // 總距離＝各段距離和
    const sum = d.legs.reduce((s, l) => s + l.distance_m, 0);
    assert.ok(Math.abs(sum - d.total_distance_m) <= d.legs.length, `總距離 ${d.total_distance_m} vs 分段和 ${sum}`);
    // 停靠點不得重複
    const keys = d.stops.map((s) => `${s.lat.toFixed(3)},${s.lon.toFixed(3)}`);
    assert.equal(new Set(keys).size, keys.length, `${code} 有重複停靠點`);
    // GeoJSON 折線點數＝站數
    assert.equal(d.geojson.geometry.coordinates.length, d.stops.length);
    // 每株被涵蓋的古樹都必須存在於 CSV
    const nos = new Set(csvRows.map((r) => r[2]));
    for (const s of d.stops) for (const t of s.trees) assert.ok(nos.has(t.tree_no), `未知古樹編號 ${t.tree_no}`);
  }
});

test('GET /api/route 自訂條件（堂區＋主題）可生成路綫', async () => {
  const r = await get(base, '/api/route?parish=' + encodeURIComponent('嘉模堂區') + '&theme=oldest&max_stops=5');
  assert.equal(r.status, 200);
  assert.ok(r.json.stops.length > 0);
  assert.ok(r.json.stops.length <= 5);
  assert.ok(r.json.stops.every((s) => s.parish === '嘉模堂區'));
  // 主題為 oldest 時，第一站應含較老的樹
  assert.ok(r.json.statistics.oldest_age >= 100);
  const invalid = await get(base, '/api/route?parish=' + encodeURIComponent('不存在的堂區'));
  assert.equal(invalid.json.stops.length, 0);
});

test('GET /api/species、/api/conservation、/api/timeline 內容完整', async () => {
  const sp = await get(base, '/api/species?limit=60');
  assert.equal(sp.json.count, new Set(csvRows.map((r) => r[3])).size);
  assert.equal(sp.json.rows.reduce((s, r) => s + r.tree_count, 0), csvRows.length);

  const cons = await get(base, '/api/conservation');
  assert.equal(cons.json.count, 11);
  assert.ok(cons.json.categories.length >= 5);
  const one = await get(base, '/api/conservation?slug=legislation');
  assert.equal(one.json.topic.slug, 'legislation');
  assert.ok(one.json.topic.body_md.includes('2013'));
  assert.ok((await get(base, '/api/conservation?slug=no-such')).json.error.includes('找不到'));

  const tl = await get(base, '/api/timeline');
  assert.equal(tl.json.count, 9);
  assert.ok(tl.json.events.some((e) => e.year === 2013));
});

test('未知的 API 路徑回傳 404 且為 JSON（不洩漏堆疊）', async () => {
  const { status, json, text } = await get(base, '/api/does-not-exist');
  assert.equal(status, 404);
  assert.equal(json.ok, false);
  assert.ok(!/at \w+ \(/.test(text), '回應不應包含堆疊追蹤');
});

test('API 回應具備快取標頭，且不包含任何環境變數或金鑰', async () => {
  const { headers, text } = await get(base, '/api/health');
  assert.ok(headers.get('cache-control').includes('no-store'));
  for (const p of ['/api/overview', '/api/trees?limit=1', '/api/stats']) {
    const r = await get(base, p);
    assert.match(r.headers.get('cache-control') || '', /s-maxage=\d+/);
    for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE', 'eyJhbGciOi', 'postgres://', 'DATABASE_URL']) {
      assert.ok(!r.text.includes(secret), `${p} 回應疑似洩漏機密：${secret}`);
    }
  }
  assert.ok(!text.includes('SERVICE_ROLE'));
});
