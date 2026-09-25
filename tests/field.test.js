/**
 * 實地考察（field_records）測試
 *   1. API：清單、可寫入旗標、輸入驗證
 *   2. 驗證函式：長度截斷、非法值處理
 *   3. 資料庫綱要：表、索引、RLS 與匿名唯讀政策
 *   4. 前端：分頁、模組、API 客戶端與地圖詳情的串接
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';
import { normalizeFieldRecord } from '../lib/repo.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PORT = 3993;

let base;
let child;

test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

const post = (body) => get(base, '/api/field-records', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('GET /api/field-records 回傳清單、筆數與可寫入旗標', async () => {
  const { status, json } = await get(base, '/api/field-records');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.ok(Array.isArray(json.records));
  assert.equal(json.count, json.records.length);
  assert.equal(typeof json.writable, 'boolean');
  // 本機測試環境沒有資料庫 → 必須誠實回報不可寫入，並附上說明
  if (json.writable === false) assert.match(json.note, /示範模式/);
});

test('POST /api/field-records 接受合法紀錄（示範模式不寫入資料庫）', async () => {
  const { status, json } = await post({
    tree_no: '1060',
    observed_on: '2026-09-24',
    observer: '高三甲 12 號',
    weather: '晴',
    health: '健康',
    height_m: '8.5',
    diameter_cm: '70',
    site_note: '樹穴透水良好，周邊無施工',
  });
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.record.tree_no, '1060');
  assert.equal(json.record.observed_on, '2026-09-24');
  assert.equal(json.record.height_m, 8.5);
  if (json.writable === false) {
    assert.equal(json.stored, false);
    assert.match(json.note, /示範模式/);
  } else {
    assert.equal(json.stored, true);
    assert.ok(json.record.id);
  }
});

test('POST /api/field-records 缺記錄者或健康值非法時回 400', async () => {
  const missing = await post({ tree_no: '1' });
  assert.equal(missing.status, 400);
  assert.match(missing.json.error, /記錄者/);

  const badHealth = await post({ observer: '高三甲 1 號', health: '很好' });
  assert.equal(badHealth.status, 400);
  assert.match(badHealth.json.error, /健康狀況/);
});

test('normalizeFieldRecord 截斷超長欄位（容錯，不算錯誤）', () => {
  const long = 'x'.repeat(900);
  const { record, errors } = normalizeFieldRecord({
    observer: '高三甲 1 號',
    weather: long,
    site_note: long,
    damage_note: long,
    health: '一般',
  });
  assert.deepEqual(errors, []);
  assert.equal(record.weather.length, 20);
  assert.equal(record.site_note.length, 600);
  assert.equal(record.damage_note.length, 600);
  assert.equal(record.health, '一般');
});

test('normalizeFieldRecord 只接受三種健康值，其餘視為未判斷並報錯', () => {
  const ok = normalizeFieldRecord({ observer: 'a', health: '瀕危' });
  assert.equal(ok.record.health, '瀕危');
  assert.deepEqual(ok.errors, []);

  const blank = normalizeFieldRecord({ observer: 'a', health: '' });
  assert.equal(blank.record.health, null);
  assert.deepEqual(blank.errors, []);

  const bad = normalizeFieldRecord({ observer: 'a', health: '很好' });
  assert.equal(bad.record.health, null);
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /健康狀況/);
});

test('normalizeFieldRecord 拒絕空的記錄者與越界數值', () => {
  const empty = normalizeFieldRecord({ observer: '   ' });
  assert.ok(empty.errors.some((e) => /記錄者/.test(e)));

  const outOfRange = normalizeFieldRecord({ observer: 'a', height_m: '150', lat: '91', crown_m: '-3' });
  assert.ok(outOfRange.errors.some((e) => /樹高/.test(e)));
  assert.ok(outOfRange.errors.some((e) => /緯度/.test(e)));
  assert.ok(outOfRange.errors.some((e) => /冠幅/.test(e)));
});

test('schema.sql 已建立 field_records（含索引與匿名唯讀 RLS）', () => {
  const sql = read('supabase/schema.sql');
  assert.match(sql, /create table if not exists public\.field_records/);
  assert.match(sql, /idx_field_records_observed/);
  assert.match(sql, /alter table public\.field_records\s+enable row level security/);
  assert.match(sql, /'field_records'/);          // 匿名唯讀政策迴圈內
  // 刻意「不」設外鍵：seed.sql 的 truncate … cascade 會連帶清空考察紀錄（已實測）
  assert.ok(!/tree_no\s+text references public\.trees/.test(sql), 'field_records.tree_no 不應設外鍵');
  assert.match(sql, /drop constraint if exists field_records_tree_no_fkey/);  // 舊版若有外鍵則移除
});

test('init.sql（Supabase SQL Editor 用）也已包含 field_records', () => {
  const sql = read('supabase/init.sql');
  assert.match(sql, /create table if not exists public\.field_records/);
});

test('前端已接好實地考察分頁與 API 客戶端', () => {
  const html = read('public/index.html');
  assert.match(html, /href="#\/field" data-view="field"/);
  assert.match(html, /id="view-field"/);

  const app = read('public/js/app.js');
  assert.match(app, /field: \(\) => import\('\.\/field\.js'\)/);
  assert.match(app, /field: '實地考察'/);

  const apiJs = read('public/js/api.js');
  assert.match(apiJs, /fieldRecords:/);
  assert.match(apiJs, /saveFieldRecord:/);

  const field = read('public/js/field.js');
  assert.match(field, /api\.fieldRecords\(\)/);
  assert.match(field, /api\.saveFieldRecord\(/);
  assert.match(field, /localStorage/);            // 示範模式的本機暫存
});

test('地圖詳情提供「新增實地考察紀錄」入口並帶入樹號', () => {
  const map = read('public/js/map.js');
  assert.match(map, /#\/field\?tree=\$\{esc\(t\.tree_no\)\}/);
  assert.match(map, /closeModal\(\)/);
});

test('預留空間已分成「已上線／規劃中」，做完的事不得再掛在待辦', () => {
  const field = read('public/js/field.js');
  const iLive = field.indexOf('這一區現在就能做的事');
  const iTodo = field.indexOf('還在規劃中');
  assert.ok(iLive > 0 && iTodo > iLive, '找不到「已上線／規劃中」兩段');

  const live = field.slice(iLive, iTodo);
  // 已完成的三項都要有真的可以點的入口，不是只有文字
  assert.match(live, /#\/qr\?mode=field/, 'QR 分頁入口');
  assert.match(live, /#\/monitoring/, '監測分頁入口');
  assert.match(live, /#\/card\?mode=form/, '列印考察單入口');

  const pending = field.slice(iTodo);
  for (const done of ['QR 掃描帶入樹號', '與官方巡查比對', '列印版考察單']) {
    assert.ok(!pending.includes(done), `「${done}」已經做好，不該留在規劃中`);
  }
  for (const todo of ['手機拍照上傳', 'GPS 自動定位', '多人協作與審核', '觀察項目結構化']) {
    assert.ok(pending.includes(todo), `規劃中清單缺少「${todo}」`);
  }
});
