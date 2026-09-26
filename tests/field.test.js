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

test('頁面下方只保留「還在規劃中」：已上線清單整段移除，但功能不得跟著被刪', () => {
  // 使用者 2026-09-26 明確要求：實地考察頁面下方不要再顯示
  //「這一區現在就能做的事（已上線）」那一大段（含導言與五個入口說明）。
  const field = read('public/js/field.js');
  assert.ok(!field.includes('這一區現在就能做的事'), '「這一區現在就能做的事」整段應已移除');
  assert.ok(!field.includes('原本列在這裡的規劃'), '該段的導言也應移除');

  // 「還在規劃中」保留，且只留下真的還沒做的兩項
  const iTodo = field.indexOf('還在規劃中');
  assert.ok(iTodo > 0, '找不到「還在規劃中」');
  const pending = field.slice(iTodo);
  for (const todo of ['多人協作與審核']) {
    assert.ok(pending.includes(todo), `規劃中清單缺少「${todo}」`);
  }
  // GPS 誤差半徑比對已於 v0.15.0 實作 → 不得再留在規劃中（做了的事不要留在規劃中）
  assert.ok(!pending.includes('GPS 誤差半徑比對'), 'GPS 比對已實作，不該留在規劃中');
  // 已經做完的事不得再掛在待辦
  for (const done of ['手機拍照上傳', '觀察項目結構化', 'QR 掃描帶入樹號', '與官方巡查比對', '列印版考察單']) {
    assert.ok(!pending.includes(done), `「${done}」已經做好，不該留在規劃中`);
  }

  // 刪說明文字時最容易誤刪功能：這些欄位／呼叫必須還在
  for (const keep of ['name="bark_conditions"', 'name="surround_items"', 'name="concrete_cover"',
    'capture="environment"', 'api.uploadPhoto(', 'prefillTree', 'field-csv', 'field-locate']) {
    assert.ok(field.includes(keep), `移除說明段落時不得誤刪功能：${keep}`);
  }
});

test('結構化觀察欄位：三份清單（前端／後端／資料庫）完全一致', () => {
  // 同一個選項清單寫在三處（避免前端送得出、資料庫卻擋掉），用測試綁在一起
  const field = read('public/js/field.js');
  const repo = read('lib/repo.js');
  const sql = read('supabase/schema.sql');
  // 前端有兩種寫法：[值, 說明] 成對陣列（勾選欄要顯示白話說明）與純值陣列（下拉選單）→ 都只取值；後端是純值陣列
  const frontVals = (src) => src.split('\n').flatMap((line) => {
    const quoted = [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    // 一行以 [ 開頭者＝[值, 說明] 成對寫法，只取第一個字串（值）
    return /^\s*\[/.test(line) ? quoted.slice(0, 1) : quoted;
  });
  const backVals = (src) => [...src.matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const frontBark = field.slice(field.indexOf('const BARK = ['), field.indexOf('const SURROUND = ['));
  const repoBark = repo.slice(repo.indexOf('export const FIELD_BARK'), repo.indexOf('export const FIELD_SURROUND'));
  const repoSur = repo.slice(repo.indexOf('export const FIELD_SURROUND'), repo.indexOf('export const FIELD_CONCRETE_COVER'));
  const repoCover = repo.slice(repo.indexOf('export const FIELD_CONCRETE_COVER'), repo.indexOf('export const PHOTO_BUCKET'));
  const frontSur = field.slice(field.indexOf('const SURROUND = ['), field.indexOf('const COVERS = '));
  const frontCover = field.slice(field.indexOf('const COVERS = '), field.indexOf('const MAX_PHOTOS'));

  for (const [name, front, back, expected] of [
    ['樹皮狀況', frontBark, repoBark, 4],
    ['周邊環境', frontSur, repoSur, 6],
    ['水泥覆蓋範圍', frontCover, repoCover, 5],
  ]) {
    const f = frontVals(front);
    const b = backVals(back);
    // 兩邊都要真的抓到清單（改壞了、被刪掉了要紅燈，而不是空陣列默默通過）
    assert.equal(f.length, expected, `${name}：前端清單應有 ${expected} 項，實際 ${f.length} 項`);
    assert.equal(b.length, expected, `${name}：後端清單應有 ${expected} 項，實際 ${b.length} 項`);
    const missing = f.filter((v) => !b.includes(v));
    assert.deepEqual(missing, [], `${name}：後端 lib/repo.js 缺少 ${missing.join('、')}`);
  }

  // 資料庫端的 CHECK 限制條件要含同一組值（樹皮狀況與水泥覆蓋範圍逐字比對）
  for (const v of ['剝落', '黴斑', '白色鹽類結晶', '無明顯異常']) {
    assert.ok(sql.includes(`'${v}'`), `schema.sql 的 CHECK 缺少樹皮狀況值「${v}」`);
  }
  for (const v of ['鄰近馬路', '鄰近建築物', '排水口', '水泥覆蓋', '裸露土壤', '其他']) {
    assert.ok(sql.includes(`'${v}'`), `schema.sql 的 CHECK 缺少周邊環境值「${v}」`);
  }
  for (const v of ['無', '少量（少於三分之一）', '約一半', '大部分（超過三分之二）', '幾乎全部覆蓋']) {
    assert.ok(sql.includes(`'${v}'`), `schema.sql 的 CHECK 缺少水泥覆蓋範圍值「${v}」`);
  }
  // 紙本考察單要能對照（同一組勾選格印得出來）
  const card = read('public/js/card.js');
  for (const v of ['剝落', '黴斑', '白色鹽類結晶']) {
    assert.ok(card.includes(v), `A4 考察單缺少樹皮狀況勾選格「${v}」`);
  }
  for (const v of ['鄰近馬路', '排水口', '幾乎全部覆蓋']) {
    assert.ok(card.includes(v), `A4 考察單缺少周邊環境／水泥覆蓋勾選格「${v}」`);
  }
});

test('POST /api/field-records 接受結構化觀察欄位；非法值回 400 並列出允許值', async () => {
  const good = await post({
    observer: '高三甲 1 號', bark_conditions: ['剝落', '黴斑'],
    surround_items: ['鄰近馬路', '排水口'], concrete_cover: '約一半',
  });
  assert.equal(good.status, 200);

  const bad = await post({ observer: '甲', bark_conditions: ['樹皮爛掉'] });
  assert.equal(bad.status, 400);
  assert.match(JSON.stringify(bad.json), /樹皮狀況只接受/);
  assert.match(JSON.stringify(bad.json), /白色鹽類結晶/, '錯誤訊息要列出允許值，學生才知道怎麼改');

  const badCover = await post({ observer: '甲', concrete_cover: '很多' });
  assert.equal(badCover.status, 400);
});

test('POST /api/photo：只接受 POST；示範模式不假裝上傳成功', async () => {
  const notAllowed = await get(base, '/api/photo');
  assert.equal(notAllowed.status, 405, '照片上傳只開放 POST');

  const res = await get(base, '/api/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', tree_no: '1060' }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.stored, false, '示範模式不得回 stored:true');
  assert.equal(res.json.path, null);
  assert.equal(res.json.url, null);
  assert.match(res.json.note, /示範模式/);
});

test('前端：結構化勾選欄位、前端壓縮與拍照上傳都已接上', () => {
  const field = read('public/js/field.js');
  for (const sel of ['name="bark_conditions"', 'name="surround_items"', 'name="concrete_cover"']) {
    assert.ok(field.includes(sel), `表單缺少 ${sel}`);
  }
  // 勾選清單要用 getAll 收集，否則只會送出一項
  assert.match(field, /fd\.getAll\('bark_conditions'\)/);
  assert.match(field, /fd\.getAll\('surround_items'\)/);
  // 「以上皆無」與其他項目互斥（前端要先過濾）
  assert.match(field, /無明顯異常[^\n]*filter|filter[^\n]*無明顯異常|includes\('無明顯異常'\)/);
  // 拍照上傳：相機、前端壓縮、上傳端點、張數上限
  assert.match(field, /capture="environment"/);
  assert.match(field, /canvas\.toDataURL\('image\/jpeg'/);
  assert.match(field, /api\.uploadPhoto\(/);
  assert.match(field, /MAX_PHOTOS = 3/);
  assert.match(field, /PHOTO_MAX_EDGE = 1280/, '照片要先在前端縮到長邊 1280 再上傳');
  // 本機暫存爆掉時要有處理，不能默默失敗
  assert.match(field, /本機暫存空間不足/);
  // CSV 要含新欄位，報告表格直接可用
  for (const col of ['樹皮狀況', '周邊環境', '水泥覆蓋範圍', '照片張數']) {
    assert.ok(field.includes(col), `CSV 匯出缺少欄位「${col}」`);
  }
  const api = read('public/js/api.js');
  assert.match(api, /uploadPhoto:/);
  assert.match(api, /request\('\/photo'/);
  const css = read('public/css/style.css');
  assert.match(css, /\.field-thumb\b/, '縮圖樣式');
  assert.match(css, /\.check-grid\b/, '勾選格樣式');
});

test('A4 考察單：新的勾選格放在右欄並橫向展開（單頁限制的版面約束）', () => {
  // 這條不是吹毛求疵：一開始把 15 個勾選格放在左欄，A4 立刻從 1 頁變 3 頁
  // （左欄是 60mm 窄欄，勾選格被擠成多行）。改成右欄 + 橫向展開後量到 233mm、PDF 回到 1 頁。
  // 所以用測試把「放在右欄、用 card-check-inline」綁住，避免以後又被搬回去。
  const card = read('public/js/card.js');
  const iForm = card.indexOf('export function fieldFormHtml');
  const iRight = card.indexOf('card-col-right', iForm);   // 必須從考察單那段開始找（檔案卡也有右欄）
  assert.ok(iForm > 0 && iRight > iForm, '找不到考察單的 card-col-right');
  const rightCol = card.slice(iRight, card.indexOf('card-foot', iRight));
  for (const label of ['樹皮狀況（可多選）', '周邊環境（可多選）', '樹穴水泥覆蓋範圍', '現場照片（請註明編號或貼上）']) {
    assert.ok(rightCol.includes(label), `「${label}」應在右欄（左欄只有 60mm 寬，會把 A4 撐成多頁）`);
  }
  assert.match(rightCol, /card-check-inline/);
  const print = read('public/css/print.css');
  assert.match(print, /\.card-checklist\.card-check-inline/);
  assert.match(print, /--cols/);
  // 驗證工具本身也要硬起來：頁數不符必須算失敗（曾出現印 ✗ 卻說「全部通過」）
  const pdf = read('scripts/card-pdf.py');
  assert.match(pdf, /if len\(pages\) != expect:/);
  assert.match(pdf, /fails\.append\(f'\{name\}：\{len\(pages\)\} 頁（預期 \{expect\}）'\)/);
  // 空白考察單也要驗（現場常用），不能只驗帶樹號的
  assert.match(pdf, /'form-blank'/);
  // repo 不得出現重複檔（patch 工具曾多寫一份 supabase/schema 2.sql，測試撈不到）
  assert.match(read('tests/ui.test.js'), /不得出現「重複檔」/);
});
