/**
 * 錯誤診斷測試
 *
 * 背景：部署到 Vercel 之後，如果資料庫還是舊版結構，畫面只會出現
 *   （1）實地考察頁：「讀取紀錄失敗：伺服器處理請求時發生錯誤，請稍後再試。」
 *   （2）地圖頁：「讀取失敗 [object Object]」
 * 兩種都等於沒有資訊。(2) 是前端 `esc(err.message || err)` 在 err 是物件時的字面輸出。
 * 這組測試守住：錯誤文字一定可讀、5xx 只在使用者該看到指示時才原樣回傳、資料庫結構
 * 問題一定要帶「缺什麼」與「怎麼修」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { errorText, publicError, handler, clientError } from '../lib/http.js';
import { describeDbFailure, healthCheck, SCHEMA_FIX_HINT } from '../lib/repo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── errorText：任何東西都要變成一句話 ──────────────────────────
test('errorText：字串、Error、巢狀物件、null 都能轉成可讀文字', () => {
  assert.equal(errorText('查詢失敗'), '查詢失敗');
  assert.equal(errorText(new Error('資料庫逾時')), '資料庫逾時');
  assert.equal(errorText({ error: { message: 'Vercel 錯誤' } }), 'Vercel 錯誤');
  assert.equal(errorText({ error: '字串錯誤' }), '字串錯誤');
  assert.equal(errorText({ code: 'X', detail: '無 message 的物件' }), JSON.stringify({ code: 'X', detail: '無 message 的物件' }));
  assert.equal(errorText(null), '未知錯誤');
  assert.equal(errorText(undefined), '未知錯誤');
});

test('errorText：不會產生 "[object Object]"', () => {
  const cases = [{}, { a: 1 }, { error: {} }, new (class { })()];
  for (const c of cases) {
    const t = errorText(c);
    assert.ok(!/\[object Object\]/.test(t), `又出現 [object Object]：${t}`);
    assert.ok(t.length > 0);
  }
});

// ── 資料庫錯誤分類 ──────────────────────────────────────────────
test('describeDbFailure：缺資料表 → 503＋指出表名＋提供修復指示', () => {
  const d = describeDbFailure({
    code: '42P01',
    message: 'relation "public.field_records" does not exist',
  });
  assert.equal(d.code, 'db_schema_outdated');
  assert.equal(d.status, 503);
  assert.equal(d.public, true);
  assert.match(d.message, /資料庫結構是舊版/);
  assert.match(d.message, /field_records/);
  assert.match(d.hint, /init\.sql/);
});

test('describeDbFailure：缺欄位 → 歸為 schema 舊版並附修復指示', () => {
  const d = describeDbFailure({ code: '42703', message: 'column "official_no" does not exist' });
  assert.equal(d.code, 'db_schema_outdated');
  assert.match(d.message, /欄位/);
  assert.match(d.hint, /版本升級/);
});

test('describeDbFailure：PostgREST schema cache 訊息（PGRST205／PGRST204）也算結構問題', () => {
  const t = describeDbFailure({ code: 'PGRST205', message: "Could not find the table 'public.field_records' in the schema cache" });
  const c = describeDbFailure({ code: 'PGRST204', message: "Could not find the 'official_no' column of 'trees' in the schema cache" });
  assert.equal(t.code, 'db_schema_outdated');
  assert.equal(c.code, 'db_schema_outdated');
});

test('describeDbFailure：缺資料庫函式 → 指向 init.sql 補上函式', () => {
  const d = describeDbFailure({ code: '42883', message: 'function public.rpc_overview() does not exist' });
  assert.equal(d.code, 'db_schema_outdated');
  assert.match(d.message, /rpc_overview/);
  assert.match(d.hint, /函式/);
});

test('describeDbFailure：權限不足與連線失敗要給不同的排除方向', () => {
  const perm = describeDbFailure({ code: '42501', message: 'permission denied for table trees' });
  assert.equal(perm.code, 'db_permission');
  assert.match(perm.hint, /service_role/);
  const net = describeDbFailure({ message: 'fetch failed' });
  assert.equal(net.code, 'db_unreachable');
  assert.match(net.hint, /SUPABASE_URL/);
});

test('describeDbFailure：其他資料庫錯誤不會假裝是結構問題', () => {
  const d = describeDbFailure({ code: '23505', message: 'duplicate key value violates unique constraint' });
  assert.equal(d.code, 'db_query_failed');
  assert.ok(!/舊版/.test(d.message));
});

// ── handler 的錯誤輸出 ─────────────────────────────────────────
function fakeRes() {
  return {
    statusCode: 0, headers: {}, writableEnded: false, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    end(payload) { this.body = JSON.parse(payload); this.writableEnded = true; },
  };
}
const reqOf = (url = '/api/x') => ({ url, method: 'GET', headers: { host: 'localhost' } });

test('handler：public 的 5xx 會把訊息與 hint 原樣回給使用者', async () => {
  const res = fakeRes();
  await handler(async () => { throw publicError(503, '資料庫結構是舊版：缺少資料表 field_records，所以這個查詢無法完成。', { code: 'db_schema_outdated', hint: '請執行 supabase/init.sql' }); }, 0)(reqOf(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /資料庫結構是舊版/);
  assert.equal(res.body.code, 'db_schema_outdated');
  assert.match(res.body.hint, /init\.sql/);
});

test('handler：一般 5xx 仍只回通用訊息（不洩漏內部細節）', async () => {
  const res = fakeRes();
  await handler(async () => { throw new Error('內部堆疊細節：/srv/app/lib/repo.js:123'); }, 0)(reqOf(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, '伺服器處理請求時發生錯誤，請稍後再試。');
  assert.ok(!/repo\.js/.test(res.body.error));
  assert.equal(res.body.code, undefined);
});

test('handler：4xx（用戶端錯誤）原樣回傳訊息', async () => {
  const res = fakeRes();
  await handler(async () => { throw clientError(400, '查詢參數格式不正確'); }, 0)(reqOf(), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, '查詢參數格式不正確');
});

test('handler：丟出「沒有 message 的物件」時也不會變成 [object Object]', async () => {
  const res = fakeRes();
  await handler(async () => { throw { code: 'WEIRD', detail: '非 Error 物件' }; }, 0)(reqOf(), res);
  assert.equal(res.statusCode, 500);
  assert.ok(!/\[object Object\]/.test(res.body.error), `錯誤訊息不可為 [object Object]：${res.body.error}`);
});

// ── /api/health 的結構自我檢查 ─────────────────────────────────
test('healthCheck：示範模式（snapshot）回報結構正常且不需要修復指示', async () => {
  const h = await healthCheck();
  assert.equal(h.schema.data_source, 'snapshot');
  assert.equal(h.schema.ok, true);
  assert.deepEqual(h.schema.missing, []);
  assert.equal(h.schema.hint, null);
});

test('SCHEMA_FIX_HINT 一定要指向 init.sql 與「可重複執行」', () => {
  assert.match(SCHEMA_FIX_HINT, /init\.sql/);
  assert.match(SCHEMA_FIX_HINT, /可重複執行/);
});

// ── 前端錯誤顯示守門 ────────────────────────────────────────────
test('前端所有錯誤顯示都必須經過 errText／errDetail', () => {
  const files = fs.readdirSync(path.join(ROOT, 'public/js')).filter((f) => f.endsWith('.js'));
  const bad = [];
  for (const f of files) {
    const src = read(`public/js/${f}`);
    src.split('\n').forEach((line, i) => {
      if (/err\.message \|\| err/.test(line) && !/^\s*(\*|\/\/)/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [], `仍有可能顯示 [object Object] 的地方：${bad.join(', ')}`);
});

test('前端 errText 會處理伺服器回傳的物件與巢狀錯誤', () => {
  const src = read('public/js/ui.js');
  assert.match(src, /export function errText/);
  assert.match(src, /typeof err\.error === 'object'/);
  assert.match(src, /JSON\.stringify\(err\)/);
  const api = read('public/js/api.js');
  assert.match(api, /import \{ errText \} from '\.\/ui\.js'/);
  assert.match(api, /e\.hint/, 'API 客戶端要把伺服器附帶的 hint 傳給畫面');
  assert.match(api, /e\.path/, 'API 客戶端要記錄失敗的端點');
});

test('前端會依 /api/health 的 schema 結果顯示「資料庫需要升級」提示', () => {
  const src = read('public/js/app.js');
  assert.match(src, /checkSchema/);
  assert.match(src, /schema\.missing/);
  assert.match(src, /資料庫需要升級/);
  assert.match(src, /healthRaw\(\)/, '必須用寬容版讀 health，否則 ok:false 會被當成失敗而看不到提示');
});
