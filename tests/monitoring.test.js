/**
 * 監測時間序列（E）測試
 *
 * 分三層：
 *   1) 純函式（lib/monitoring.js）：序列組成、逐次差異、趨勢擬合、異常規則 —— 用合成資料測邊界
 *   2) 真實資料：#1132 的官方分級更新、全站變動株數必須與官方值優先的 5 株一致
 *   3) 端到端：真的啟動本機伺服器打 /api/monitoring，驗證回應內容與 404
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSeries, trend, detectAnomalies, monitoringSummary, toTime } from '../lib/monitoring.js';
import { SNAPSHOTS } from '../lib/official-history.js';
import { startServer, stopServer, get } from './helpers/server.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const TREE = { tree_no: '999', species: '測試樹', site: '測試地點', parish: '大堂區', grade: '三級', health: '健康', height_m: 10, diameter_cm: 50, girth_cm: 157.1 };

// ── 1) 純函式 ────────────────────────────────────────────────
test('toTime：支援 YYYY-MM-DD 與 ISO，無法解析回 null', () => {
  assert.equal(toTime('2026-09-25'), Date.UTC(2026, 8, 25));
  assert.ok(typeof toTime('2026-09-25T00:09:28+0800') === 'number');
  assert.equal(toTime(''), null);
  assert.equal(toTime(null), null);
  assert.equal(toTime('查無日期'), null);
});

test('buildSeries：名錄版本視為最早的時間點，且沒有日期不參與趨勢', () => {
  const s = buildSeries(TREE, {
    listing: { grade: '三級', health: '一般' },
    snapshots: [{ date: '2026-09-25', trees: { 999: { grade: '不分級', health: '健康', diameter_cm: 51, height_m: 10.2 } } }],
    records: [],
  });
  assert.equal(s.points.length, 2);
  assert.equal(s.points[0].source, 'listing');
  assert.equal(s.points[0].date, null);
  assert.equal(s.points[1].source, 'official');
  assert.equal(s.steps.length, 1);
  assert.equal(s.steps[0].grade_change, '三級 → 不分級');
  assert.equal(s.steps[0].health_change, '一般 → 健康');
  assert.equal(s.trend, null, '只有一個有日期的點，不得擬合趨勢');
});

test('buildSeries：缺值不內插、不用平均補值；只比較兩邊都有值的欄位', () => {
  const s = buildSeries(TREE, {
    listing: { grade: '三級', health: '一般', height_m: null, diameter_cm: null },
    snapshots: [{ date: '2026-06-01', trees: { 999: { health: '一般', diameter_cm: 50 } } },
      { date: '2026-09-01', trees: { 999: { health: '一般', height_m: 10.5 } } }],
    records: [],
  });
  const st = s.steps[1];
  assert.equal(st.diameter_delta, null, '一端缺值時不得算出變化量');
  assert.equal(st.height_delta, null);
  assert.ok(s.points.every((p) => p.diameter_cm === null || typeof p.diameter_cm === 'number'));
});

test('trend：跨距不足 30 天只說明原因，不給斜率', () => {
  const pts = [
    { date: '2026-09-01', diameter_cm: 50 },
    { date: '2026-09-20', diameter_cm: 50.4 },
  ];
  const t = trend(pts);
  assert.equal(t.slope, null);
  assert.match(t.reason, /30 天/);
  assert.equal(t.n, 2);
});

test('trend：跨距足夠時給出每年變化量與 R²', () => {
  const pts = [
    { date: '2024-01-01', diameter_cm: 50.0 },
    { date: '2025-01-01', diameter_cm: 50.5 },
    { date: '2026-01-01', diameter_cm: 51.0 },
  ];
  const t = trend(pts);
  assert.ok(Math.abs(t.slope - 0.5) < 0.01, `每年應約 +0.5 公分，實際 ${t.slope}`);
  assert.ok(t.r2 > 0.999);
  assert.equal(t.unit, '公分／年');
  assert.ok(t.span_days > 700);
});

test('detectAnomalies：胸徑減少 ≥0.5 公分、樹高減少 ≥0.2 公尺列為需確認', () => {
  const series = buildSeries(TREE, {
    records: [
      { observed_on: '2025-01-10', health: '健康', diameter_cm: 50, height_m: 10, observer: '甲' },
      { observed_on: '2026-01-10', health: '一般', diameter_cm: 49, height_m: 9.5, observer: '乙' },
    ],
  });
  const kinds = series.anomalies.map((a) => a.kind);
  assert.ok(kinds.includes('diameter_down'));
  assert.ok(kinds.includes('height_down'));
  assert.ok(kinds.includes('health_worse'));
  const worse = series.anomalies.find((a) => a.kind === 'health_worse');
  assert.equal(worse.level, 'warn', '實地考察看到的惡化屬需確認');
  // 微小變化不得誤報
  const small = buildSeries(TREE, {
    records: [
      { observed_on: '2025-01-10', diameter_cm: 50, height_m: 10 },
      { observed_on: '2026-01-10', diameter_cm: 49.8, height_m: 9.95 },
    ],
  });
  assert.ok(!small.anomalies.some((a) => a.level === 'warn'), '變化在容許範圍內不應列異常');
});

test('detectAnomalies：官方值變動是資料更新（info），不是異常', () => {
  const series = buildSeries(TREE, {
    listing: { grade: '三級', health: '一般' },
    snapshots: [{ date: '2026-09-25', trees: { 999: { grade: '不分級', health: '一般' } } }],
  });
  const g = series.anomalies.find((a) => a.kind === 'grade_change');
  assert.ok(g, '官方分級變動要被記錄下來');
  assert.equal(g.level, 'info');
  assert.ok(!series.anomalies.some((a) => a.level === 'warn'), '官方更新不列入需確認');
});

test('detectAnomalies：無考察紀錄與超過 730 天未複查都要提醒', () => {
  const noField = buildSeries(TREE, { snapshots: [{ date: '2026-09-25', trees: { 999: { health: '健康' } } }] });
  assert.ok(noField.anomalies.some((a) => a.kind === 'no_field_record'));
  const gap = buildSeries(TREE, {
    records: [
      { observed_on: '2022-01-01', diameter_cm: 50 },
      { observed_on: '2025-06-01', diameter_cm: 50.5 },
    ],
  });
  assert.ok(gap.anomalies.some((a) => a.kind === 'long_gap'));
});

test('monitoringSummary：統計各項株數', () => {
  const a = buildSeries({ ...TREE, tree_no: '1' }, { snapshots: [{ date: '2026-09-25', trees: { 1: { health: '健康' } } }] });
  const b = buildSeries({ ...TREE, tree_no: '2' }, {
    listing: { grade: '三級' },
    snapshots: [{ date: '2026-09-25', trees: { 2: { grade: '不分級' } } }],
    records: [{ observed_on: '2026-08-01', diameter_cm: 50 }, { observed_on: '2026-09-01', diameter_cm: 48 }],
  });
  const sum = monitoringSummary([a, b], SNAPSHOTS, [{ tree_no: '2' }]);
  assert.equal(sum.trees, 2);
  assert.equal(sum.records, 1);
  assert.equal(sum.with_field_record, 1);
  assert.ok(sum.official_changed >= 1);
  assert.equal(sum.need_attention, 1, '胸徑掉了 2 公分要列入需確認');
  assert.deepEqual(sum.attention_trees.map((x) => x.tree_no), ['2']);
});

// ── 2) 真實資料 ──────────────────────────────────────────────
test('官方快照檔與 lib/official-history.js 必須一致（產生器 --check）', () => {
  const out = execFileSync('node', ['scripts/snapshot-observations.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /一致/);
  const files = fs.readdirSync(path.join(ROOT, 'data', 'observations')).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, SNAPSHOTS.length, '資料檔數與模組快照數不符');
  assert.ok(SNAPSHOTS.length >= 1);
  assert.equal(Object.keys(SNAPSHOTS[0].trees).length, 658);
});

test('#1132 的監測序列：官方分級由三級更新為不分級，且不列為異常', () => {
  const src = JSON.parse(read('data/snapshot.json'));
  const t = src.trees.find((x) => x.tree_no === '1132');
  const s = buildSeries({ ...t, grade: '不分級', health: t.health }, {
    listing: { grade: t.grade, health: t.health },
    snapshots: SNAPSHOTS,
    records: [],
  });
  assert.equal(s.points.length, 2);
  assert.equal(s.steps[0].grade_change, '三級 → 不分級');
  assert.equal(s.anomalies.filter((a) => a.level === 'warn').length, 0);
  assert.equal(s.trend, null, '只有官方兩個時間點且其中一個無日期，不得硬湊趨勢');
});

test('全站監測概況的變動株數，必須與「名錄 vs 官方現行」的差異一致', () => {
  const src = JSON.parse(read('data/snapshot.json'));
  const snap = SNAPSHOTS[SNAPSHOTS.length - 1].trees;
  const expected = src.trees.filter((t) => {
    const o = snap[t.tree_no] || {};
    return (t.grade && o.grade && t.grade !== o.grade) || (t.health && o.health && t.health !== o.health);
  }).map((t) => t.tree_no).sort();
  assert.deepEqual(expected, ['1132', '548', '627', '638', '641'], '官方兩個來源的差異株數改變了，請重新核對');
  const series = src.trees.map((t) => buildSeries(t, {
    listing: { grade: t.grade, health: t.health },
    snapshots: SNAPSHOTS,
  }));
  const sum = monitoringSummary(series, SNAPSHOTS, []);
  assert.equal(sum.official_changed, 5);
});

// ── 3) 端到端（真的啟動伺服器）────────────────────────────────
const PORT = 3994;
let base;
let child;

test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

test('GET /api/monitoring?tree=1132 回傳完整序列', async () => {
  const { status, json } = await get(base, '/api/monitoring?tree=1132');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.tree.tree_no, '1132');
  assert.equal(json.tree.grade, '不分級', '顯示分級必須是官方現行值');
  assert.equal(json.tree.listing_grade, '三級', '名錄值要保留');
  assert.equal(json.series.points.length, 2);
  assert.ok(json.series.steps.some((s) => s.grade_change === '三級 → 不分級'));
  assert.ok(json.data.fetched_at, '要附官方資料履歷');
  assert.ok(json.snapshots.length >= 1);
});

test('GET /api/monitoring 概況與清單（預設精簡）', async () => {
  const { status, json } = await get(base, '/api/monitoring?limit=5');
  assert.equal(status, 200);
  assert.equal(json.total, 658);
  assert.equal(json.count, 5);
  assert.equal(json.summary.official_changed, 5);
  assert.deepEqual(json.summary.changed_trees.sort(), ['1132', '548', '627', '638', '641']);
  assert.equal(json.summary.with_field_record, 0, '示範模式沒有考察紀錄');
  // 契約：changes 一定是陣列（前端要 .map）；精簡模式只省略 points／steps 這類完整序列
  assert.ok(json.items.every((r) => Array.isArray(r.changes)), 'changes 必須是陣列，否則前端 .map 會 TypeError');
  assert.ok(json.items.every((r) => r.points === undefined && r.steps === undefined), '預設回應不帶完整序列');
  assert.ok(Array.isArray(json.method.sources) && json.method.sources.length === 3);
});

test('GET /api/monitoring?rows=1 取得每株變動摘要', async () => {
  const { json } = await get(base, '/api/monitoring?only=changed&rows=1&limit=3');
  assert.equal(json.total, 5);
  assert.equal(json.count, 3);
  assert.ok(json.items.every((r) => Array.isArray(r.changes) && r.changes.length >= 1));
});

test('GET /api/monitoring?tree=99999 回 404，且不洩漏內部訊息', async () => {
  const { status, json } = await get(base, '/api/monitoring?tree=99999');
  assert.equal(status, 404);
  assert.equal(json.ok, false);
  assert.ok(!/at\s|\.js:|stack/i.test(JSON.stringify(json)));
});

test('監測頁面必須完成接線（分頁、路由、API、Service Worker 預載）', () => {
  const html = read('public/index.html');
  assert.match(html, /data-view="monitoring"/);
  assert.match(html, /id="view-monitoring"/);
  const app = read('public/js/app.js');
  assert.match(app, /monitoring: \(\) => import\('\.\/monitoring\.js'\)/);
  const api = read('public/js/api.js');
  assert.match(api, /monitoring: \(params\) => request\('\/monitoring', params\)/);
  assert.match(read('public/sw.js'), /js\/monitoring\.js/);
  // 頁面必須把「不硬湊」講清楚：不足兩點不畫趨勢、官方變動不是異常
  const view = read('public/js/monitoring.js');
  assert.match(view, /無法擬合/);
  assert.match(view, /官方資料更新/);
  assert.match(view, /不內插/);
});
