/**
 * Supabase / PostgreSQL 綱要驗證 —— 以 PGlite（真正的 PostgreSQL 16，WASM 版）
 * 實際執行 supabase/schema.sql 與 supabase/seed.sql，再驗證檢視表與 RPC 函式。
 *
 * 這組測試證明「部署到 Supabase 的那份 SQL」本身是正確可執行的，
 * 而不只是靠閱讀確認。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCHEMA = fs.readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8');
const SEED = fs.readFileSync(path.join(ROOT, 'supabase', 'seed.sql'), 'utf8');
const CSV = fs.readFileSync(path.join(ROOT, 'source-data', '古樹.csv'), 'utf8');

let db;
test.before(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(SEED);
});

test.after(async () => { if (db) await db.close(); });

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;

// 由 CSV 獨立算出期望值，避免「自我驗證」
function parseCsv() {
  const lines = CSV.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.slice(2).map((l) => l.split(','));
  return rows.filter((r) => r.length >= 8);
}

const csv = parseCsv();
const csvCount = (fn) => csv.filter(fn).length;

test('官方胸徑／胸圍入庫：658 株皆有值，且 v_trees 帶得出來', async () => {
  const t = await one(`select count(*)::int as n,
                              count(diameter_cm)::int as d,
                              count(girth_cm)::int as g,
                              count(*) filter (where stem_count > 1)::int as multi
                       from public.trees`);
  assert.equal(t.n, 658);
  assert.equal(t.d, 658, `trees.diameter_cm 只有 ${t.d}/658 筆有值`);
  assert.equal(t.g, 658, `trees.girth_cm 只有 ${t.g}/658 筆有值`);
  assert.equal(t.multi, 290, '多主幹株數應為 290');
  // 官方值抽查（古樹編號 491、86）
  const a = await one(`select diameter_cm::float8 as d, girth_cm::float8 as g, stem_count,
                              stem_measures from public.v_trees where official_no = '491'`);
  assert.equal(a.d, 86); assert.equal(a.g, 270.2); assert.equal(a.stem_count, 1);
  const b = await one(`select diameter_cm::float8 as d, girth_cm::float8 as g, stem_count,
                              stem_measures from public.v_trees where official_no = '86'`);
  assert.equal(b.d, 282); assert.equal(b.g, 885.9); assert.equal(b.stem_count, 3);
  assert.match(b.stem_measures, /三個|3 支主幹|共 3/);
  // 不得出現「由胸徑換算」的推算值：胸圍必須等於官方欄位，而非我們算出來的
  const mismatch = await all(`select t.tree_no from public.trees t
                              where t.girth_cm is not null and t.diameter_cm is not null
                                and abs(t.girth_cm - (t.diameter_cm * pi())) > greatest(1.0, t.diameter_cm * 0.05)`);
  assert.equal(mismatch.length, 0, `${mismatch.length} 株胸圍與官方胸徑不一致`);
});

test('綱要與種子資料可完整執行，且重複執行不會出錯（idempotent）', async () => {
  await db.exec(SCHEMA);   // 第二次執行 create if not exists / or replace
  await db.exec(SEED);     // 第二次執行 truncate + insert
  const t = await one('select count(*)::int as n from public.trees');
  assert.equal(t.n, csv.length);
});

test('舊版資料庫可直接升級：缺欄位的舊表跑一次 schema ＋ seed 即可補齊', async () => {
  // 重現使用者在 Supabase 遇到的狀況：資料庫裡已有「舊版 init.sql 建立的表」，
  // 但缺了後來才新增的欄位（geo_precision、official_* …）。
  // create table if not exists 不會補欄位，於是 seed 會出現
  // 「column "geo_precision" of relation "public.trees" does not exist」而整段回滾。
  const old = new PGlite();
  try {
    await old.exec(`
      create table public.parishes (code text primary key, name_zh text, name_pt text);
      create table public.species (id serial primary key, name_zh text, name_sci text);
      create table public.sites (id serial primary key, name_zh text, short_name text, parish_code text,
                                 lat numeric(9,6), lon numeric(9,6));
      create table public.trees (id serial primary key, tree_no text unique, species_id integer,
                                 site_id integer, parish_code text, grade text, age_years integer,
                                 height_m numeric(5,2), health text, lat numeric(9,6), lon numeric(9,6));
      insert into public.trees (tree_no,grade,age_years,height_m,health)
        values ('OLD-1','三級',120,10.5,'健康');
    `);
    await old.exec(SCHEMA);       // 升級段落應就地補齊所有缺少的欄位
    await old.exec(SEED);         // 補齊後 seed 必須能成功
    const cols = (await old.query(
      `select column_name from information_schema.columns where table_schema='public' and table_name='trees'`,
    )).rows.map((r) => r.column_name);
    for (const c of ['geo_precision', 'official_no', 'iam_tree_no', 'crown_m', 'photo_url', 'in_namelist']) {
      assert.ok(cols.includes(c), `升級後 trees 仍缺少欄位 ${c}`);
    }
    const n = (await old.query('select count(*)::int n from public.trees')).rows[0].n;
    assert.equal(n, csv.length, '升級後 seed 應寫入完整 658 筆');
    // 有 default 的欄位必須補上值，不能是 NULL（否則前端篩選會出現「未命名」）
    const nulls = (await old.query('select count(*)::int n from public.trees where in_namelist is null')).rows[0].n;
    assert.equal(nulls, 0, 'in_namelist 升級後不可為 NULL');
    const upd = (await old.query('select count(*)::int n from public.trees where updated_at is null')).rows[0].n;
    assert.equal(upd, 0, 'updated_at 升級後不可為 NULL');
  } finally {
    await old.close();
  }
});

test('重新初始化種子資料不會清掉實地考察紀錄（field_records 刻意不設外鍵）', async () => {
  // seed.sql 會 truncate public.trees … cascade；若 field_records 對 trees 有外鍵，
  // PostgreSQL 會連帶把學生的考察紀錄一起清空（已用 PGlite 實測）。
  const fk = await one(`select count(*)::int n from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'field_records' and c.contype = 'f'`);
  assert.equal(fk.n, 0, 'field_records 不應有外鍵，否則重新 seed 會清掉考察紀錄');

  await db.exec(`insert into public.field_records (tree_no, observer, health)
                 values ('66', '高三甲 12 號', '健康')`);
  await db.exec(SEED);          // 重新初始化種子資料
  const kept = await one('select count(*)::int n from public.field_records');
  assert.ok(kept.n >= 1, '重新 seed 後實地考察紀錄被清掉了');
  await db.exec('delete from public.field_records');   // 還原，避免影響其他測試
});

test('舊資料庫的檢視表欄位順序與函式回傳型別不同時，重跑 schema.sql 仍能升級（42P16／42P13 修復）', async () => {
  // 這是實際發生在 Supabase 上的錯誤：
  //   ERROR: 42P16: cannot change name of view column "species" to "tree_geo_precision"
  // 成因：CREATE OR REPLACE VIEW 只能往後追加欄位，不能改變既有欄位的位置／名稱。
  const old = new PGlite();
  await old.exec(SCHEMA);          // 先建好（當作「已經存在的新版」）
  // 把 v_trees 換成「舊版」欄位順序：第 10 欄叫 species（新版同位置是 tree_geo_precision）
  await old.exec(`
    drop view if exists public.v_trees cascade;
    create view public.v_trees as
      select t.id, t.tree_no, t.grade, t.age_years, t.height_m, t.health,
             t.lat, t.lon, t.in_namelist,
             s.name_zh as species, s.name_sci,
             st.name_zh as site, p.code as parish
      from public.trees t
        left join public.species s on s.id = t.species_id
        left join public.sites   st on st.id = t.site_id
        left join public.parishes p on p.code = t.parish_code;
    -- 舊版函式回傳型別不同（jsonb 而非 json），CREATE OR REPLACE FUNCTION 會報 42P13
    drop function if exists public.rpc_overview() cascade;
    create function public.rpc_overview() returns jsonb language sql stable as
      $$ select '{}'::jsonb $$;
  `);
  // 重跑新版 schema.sql：應該先刪除舊檢視表與函式，再重建，全程無錯
  await old.exec(SCHEMA);
  const cols = (await old.query(`select column_name from information_schema.columns
    where table_schema='public' and table_name='v_trees' order by ordinal_position`)).rows.map((r) => r.column_name);
  assert.ok(cols.includes('tree_geo_precision'), 'v_trees 應重建為新版欄位');
  assert.ok(cols.includes('species'), 'species 欄位仍應存在（改名為 tree_geo_precision 的修正）');
  const ov = (await old.query(`select rpc_overview() as o`)).rows[0].o;
  assert.ok(ov && typeof ov === 'object' && 'tree_count' in ov, 'rpc_overview 應重建為新版（回傳 json）');
  await old.close();
});

test('舊版 CHECK 限制條件的允許值不同時也能升級（23514 修復）', async () => {
  // 實際發生在 Supabase 上的錯誤：
  //   ERROR: 23514: new row for relation "sites" violates check constraint "sites_geo_precision_check"
  //   DETAIL: Failing row contains (1, 氹仔區兵房斜巷6號, …, official, iam, …)
  // 成因：舊版資料庫的限制條件只允許 ('exact','approx','parish')，不含 'official'；
  //       舊版升級段落只「在不存在時才新增」，因此永遠不會更新，seed 一寫入官方座標值就爆。
  const old = new PGlite();
  await old.exec(SCHEMA);
  await old.exec(`
    alter table public.sites drop constraint if exists sites_geo_precision_check;
    alter table public.sites add constraint sites_geo_precision_check
      check (geo_precision in ('exact','approx','parish'));   -- 舊版：不含 official
  `);
  await old.exec(SCHEMA);      // 修正前：舊限制條件被保留 → 這裡不會錯，但 seed 會爆
  await old.exec(SEED);        // 修正前：23514（seed 內含 geo_precision='official'）
  const official = (await old.query(
    `select count(*)::int n from public.sites where geo_precision = 'official'`)).rows[0].n;
  assert.ok(official > 0, '升級後應可寫入 geo_precision = official 的官方座標資料');
  const def = (await old.query(`select pg_get_constraintdef(oid) d from pg_constraint
    where conname = 'sites_geo_precision_check'`)).rows[0].d;
  assert.match(def, /official/, '限制條件應更新為含 official 的新版');
  await old.close();
});

test('舊資料庫若有超出新允許值的資料，升級時會先正規化再重建限制條件', async () => {
  const old = new PGlite();
  await old.exec(SCHEMA);
  // 完全沒有 geo_precision 限制條件，且已有一筆不在新允許值內的舊資料
  await old.exec(`
    alter table public.sites drop constraint if exists sites_geo_precision_check;
    update public.sites set geo_precision = 'osm' where id = (select min(id) from public.sites);
  `);
  await old.exec(SCHEMA);      // 若沒有先正規化，這裡的 add constraint 會失敗
  const bad = (await old.query(`select count(*)::int n from public.sites where geo_precision = 'osm'`)).rows[0].n;
  assert.equal(bad, 0, '超出新允許值的舊資料應被正規化為 approx');
  await old.close();
});

test('只執行 seed.sql（未執行 schema 升級段）也能自我修復舊版 CHECK 限制條件', async () => {
  // 情境：使用者在 SQL Editor 中「選取了一部分」再按 Run，或只貼了 seed 這一段；
  // 此時 schema 檔頭的升級段落不會被執行，必須由 seed 自己在 truncate 之後修好限制條件，
  // 否則 insert 'official' 會撞 23514。
  const old = new PGlite();
  await old.exec(SCHEMA);
  await old.exec(`
    alter table public.sites drop constraint if exists sites_geo_precision_check;
    alter table public.sites add constraint sites_geo_precision_check
      check (geo_precision in ('exact','approx','parish'));
  `);
  await old.exec(SEED);        // 只跑 seed：必須自己修好限制條件
  const official = (await old.query(
    `select count(*)::int n from public.sites where geo_precision = 'official'`)).rows[0].n;
  assert.ok(official > 0, 'seed 應能自我修復限制條件並寫入 official 資料');
  await old.close();
});

test('舊資料庫（缺欄位／缺表／舊 CHECK）跑完 init.sql 後，健康檢查每一項都通過', async () => {
  // 完整模擬使用者的處境：舊庫 → 貼上 init.sql → 重新整理頁面應顯示一切正常。
  const { SCHEMA_PROBES } = await import('../lib/repo.js');
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`
    alter table public.trees  drop column if exists official_no cascade;
    alter table public.trees  drop column if exists official_age_years cascade;
    alter table public.routes drop column if exists species_focus cascade;
    drop table if exists public.field_records cascade;          -- v0.6.0 才新增的表
    drop view if exists public.v_trees cascade;                 -- 舊庫可能沒有這個檢視表
    alter table public.sites drop constraint if exists sites_geo_precision_check;
    alter table public.sites add constraint sites_geo_precision_check
      check (geo_precision in ('exact','approx','parish'));
  `);
  await db.exec(SCHEMA);        // 等同使用者貼上 init.sql 的前半
  await db.exec(SEED);          // 等同 init.sql 的後半

  for (const p of SCHEMA_PROBES) {
    let err = null;
    try { await db.query(`select ${p.columns} from public.${p.table} limit 1`); }
    catch (e) { err = e; }
    assert.ok(!err, `升級後探測項「${p.label}」仍失敗：${err && err.message}`);
  }
  const def = (await db.query(`select pg_get_constraintdef(oid) d from pg_constraint
      where conname = 'sites_geo_precision_check'`)).rows[0].d;
  assert.match(def, /official/, '升級後 sites.geo_precision 應允許 official');
  assert.match(def, /parish/, '升級後 sites.geo_precision 應允許 parish');
  const official = (await db.query(
    `select count(*)::int n from public.sites where geo_precision = 'official'`)).rows[0].n;
  assert.ok(official > 0, '升級後 official 座標地點應寫得進去');
  await db.close();
});

test('健康檢查的探測清單與綱要一致（每一張表／欄位／函式都真實存在）', async () => {
  // 這項測試是為了防止 2026-09-24 的誤報：健康檢查曾要求 v_trees.photo_url、
  // trees.species、routes.slug —— 這三個欄位在 schema.sql 裡根本不存在
  // （檢視表叫 tree_photo、trees 用 species_id、routes 用 code），
  // 於是資料庫明明已經升級完成，畫面仍顯示「資料庫需要升級」。
  const { SCHEMA_PROBES, RPC_PROBES } = await import('../lib/repo.js');
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(SEED);

  for (const p of SCHEMA_PROBES) {
    let err = null;
    try { await db.query(`select ${p.columns} from public.${p.table} limit 1`); }
    catch (e) { err = e; }
    assert.ok(!err, `探測項「${p.label}」失敗：${p.table}(${p.columns}) — ${err && err.message}`);
  }

  const fns = (await db.query(`select proname, count(*)::int n from pg_proc
      where pronamespace = 'public'::regnamespace group by proname`)).rows;
  const have = new Set(fns.map((r) => r.proname));
  for (const r of RPC_PROBES) {
    assert.ok(have.has(r.fn), `探測的資料庫函式不存在：${r.fn}`);
  }
  await db.close();
});

test('seed.sql 的限制條件自我修復段落存在（防止未來被產生器覆蓋掉）', () => {
  assert.match(SEED, /限制條件自我修復/);
  assert.match(SEED, /alter table public\.sites add constraint sites_geo_precision_check/);
  assert.ok(SEED.indexOf('限制條件自我修復') > SEED.indexOf('truncate table'),
    '自我修復必須排在 truncate 之後、insert 之前');
  assert.ok(SEED.indexOf('限制條件自我修復') < SEED.indexOf('insert into public.parishes'),
    '自我修復必須排在 insert 之前');
});

test('升級段落以 alter table if exists ＋ add column if not exists 寫成，可安全重複執行', async () => {
  const start = SCHEMA.indexOf('-- >>> 版本升級 開始');
  const end = SCHEMA.indexOf('-- <<< 版本升級 結束');
  assert.ok(start > 0 && end > start, '找不到升級段落標記');
  const upgrade = SCHEMA.slice(start, end);
  assert.ok(upgrade.length > 500, '升級段落過短');
  assert.ok(/add column if not exists/.test(upgrade), '升級段落必須使用 add column if not exists');
  assert.ok(/alter table if exists/.test(upgrade), '升級段落必須使用 alter table if exists（與 create table 順序無關）');
  // 限制條件必須「先移除再重建」：只判斷存在與否會漏掉「舊版允許值不同」的情況
  assert.match(upgrade, /drop constraint if exists sites_geo_precision_check/);
  assert.match(upgrade, /add constraint sites_geo_precision_check check/);
  assert.match(upgrade, /to_regclass\('public\.sites'\) is not null/, '升級段在全新資料庫上必須安全跳過');
  assert.ok(!/add column (?!if not exists)/.test(upgrade), '升級段落有未加 if not exists 的欄位');
  // 舊版資料庫若已對 trees 設外鍵，必須移除，否則重新 seed 會清掉考察紀錄
  assert.match(upgrade, /drop constraint if exists field_records_tree_no_fkey/);
  // 產生器必須幂等（重跑不會產生第二段）
  assert.equal((SCHEMA.match(/-- >>> 版本升級 開始/g) || []).length, 1, '升級段落只能有一份');
  // 升級段落之後才能跑 seed：init.sql 的順序必須是 schema（含升級）→ seed
  const INIT = fs.readFileSync(path.join(ROOT, 'supabase', 'init.sql'), 'utf8');
  assert.ok(INIT.indexOf('add column if not exists') < INIT.indexOf('insert into public.trees'),
    'init.sql 的升級段落必須排在 seed 之前');
});

test('資料表列數與 CSV 一致', async () => {
  assert.equal((await one('select count(*)::int n from public.trees')).n, csv.length);
  assert.equal((await one('select count(*)::int n from public.sites')).n, new Set(csv.map((r) => r[6])).size);
  assert.equal((await one('select count(*)::int n from public.species')).n, new Set(csv.map((r) => r[3])).size);
  assert.equal((await one('select count(*)::int n from public.parishes')).n, 8);
  assert.equal((await one('select count(*)::int n from public.routes')).n, 5);
  assert.equal((await one('select count(*)::int n from public.conservation_topics')).n, 12);
  assert.equal((await one('select count(*)::int n from public.timeline_events')).n, 9);
});

test('古樹編號唯一且無空值、樹高樹齡皆為正數', async () => {
  const dup = await one('select count(*)::int n from (select tree_no from public.trees group by tree_no having count(*) > 1) x');
  assert.equal(dup.n, 0);
  const bad = await one(`select count(*)::int n from public.trees
    where tree_no is null or age_years <= 0 or height_m <= 0 or grade is null or health is null`);
  assert.equal(bad.n, 0);
});

test('級別與健康狀況只允許合法值（CHECK 約束生效）', async () => {
  await assert.rejects(
    () => db.exec(`insert into public.trees (tree_no,grade,age_years,height_m,health)
                   values ('TEST-BAD-GRADE','超級級',120,10,'健康')`),
    /violates check constraint/i,
  );
  await assert.rejects(
    () => db.exec(`insert into public.trees (tree_no,grade,age_years,height_m,health)
                   values ('TEST-BAD-AGE','三級',-5,10,'健康')`),
    /violates check constraint/i,
  );
});

test('每株古樹都有座標與對應的地點、品種、堂區（外部鍵完整）', async () => {
  const bad = await one(`select count(*)::int n from public.trees t
    left join public.sites s on s.id = t.site_id
    left join public.species p on p.id = t.species_id
    left join public.parishes pa on pa.code = t.parish_code
    where t.lat is null or t.lon is null or s.id is null or p.id is null or pa.code is null`);
  assert.equal(bad.n, 0);
  // 座標必須落在澳門一帶（21.9–22.25 N, 113.5–113.65 E）
  const outside = await one(`select count(*)::int n from public.trees
    where lat not between 21.9 and 22.25 or lon not between 113.5 and 113.65`);
  assert.equal(outside.n, 0);
});

test('檢視表 v_parish_stats：加總等於總株數，且與 CSV 分組一致', async () => {
  const rows = await all('select * from public.v_parish_stats order by tree_count desc');
  assert.equal(rows.length, 8);
  const total = rows.reduce((s, r) => s + Number(r.tree_count), 0);
  assert.equal(total, csv.length);
  // 抽樣比對三個堂區
  for (const p of ['聖方濟各堂區', '風順堂區', '花地瑪堂區']) {
    const expected = csvCount((r) => r[7] === p);
    const got = Number(rows.find((r) => r.parish === p).tree_count);
    assert.equal(got, expected, `${p} 期望 ${expected}，實際 ${got}`);
  }
  // 分級與健康小計必須等於總數
  for (const r of rows) {
    assert.equal(Number(r.grade1) + Number(r.grade2) + Number(r.grade3) + Number(r.grade_other),
      Number(r.tree_count));
    assert.equal(Number(r.health_good) + Number(r.health_fair) + Number(r.health_endangered),
      Number(r.tree_count));
  }
});

test('檢視表 v_species_stats：平均樹高與 CSV 直接計算相符', async () => {
  const rows = await all('select * from public.v_species_stats where tree_count > 0');
  assert.equal(rows.length, new Set(csv.map((r) => r[3])).size);
  const heartFig = rows.find((r) => r.species === '心葉榕');
  const heights = csv.filter((r) => r[3] === '心葉榕').map((r) => Number(r[4]));
  const avg = heights.reduce((a, b) => a + b, 0) / heights.length;
  assert.ok(Math.abs(Number(heartFig.avg_height) - avg) < 0.01, `avg_height=${heartFig.avg_height}`);
  assert.equal(Number(heartFig.tree_count), heights.length);
});

test('RPC rpc_overview 回傳正確的整體統計', async () => {
  const o = (await db.query('select public.rpc_overview() as j')).rows[0].j;
  assert.equal(Number(o.tree_count), csv.length);
  assert.equal(Number(o.max_age), Math.max(...csv.map((r) => Number(r[1]))));
  assert.equal(Number(o.grade1), csvCount((r) => r[0] === '一級'));
  assert.equal(Number(o.grade2), csvCount((r) => r[0] === '二級'));
  assert.equal(Number(o.endangered), csvCount((r) => r[5] === '瀕危'));
  const sum = Number(o.good) + Number(o.fair) + Number(o.endangered);
  assert.equal(sum, csv.length);
});

test('RPC rpc_age_histogram：分箱總數守恆', async () => {
  for (const bucket of [10, 25, 50, 100]) {
    const rows = await all(`select * from public.rpc_age_histogram(${bucket})`);
    const total = rows.reduce((s, r) => s + Number(r.tree_count), 0);
    assert.equal(total, csv.length, `bucket=${bucket} 總數 ${total}`);
    assert.ok(rows.every((r) => Number(r.bucket_end) - Number(r.bucket_start) === bucket));
  }
});

test('RPC rpc_find_trees：各篩選條件與 CSV 計算一致', async () => {
  const parish = '聖方濟各堂區';
  const byParish = await all('select * from public.rpc_find_trees(p_parish => $1, p_limit => 1000)', [parish]);
  assert.equal(byParish.length, csvCount((r) => r[7] === parish));

  const bySpecies = await all('select * from public.rpc_find_trees(p_species => $1, p_limit => 1000)', ['心葉榕']);
  assert.equal(bySpecies.length, csvCount((r) => r[3] === '心葉榕'));

  const byGrade = await all('select * from public.rpc_find_trees(p_grade => $1, p_limit => 1000)', ['二級']);
  assert.equal(byGrade.length, csvCount((r) => r[0] === '二級'));

  const byHealth = await all('select * from public.rpc_find_trees(p_health => $1, p_limit => 1000)', ['瀕危']);
  assert.equal(byHealth.length, csvCount((r) => r[5] === '瀕危'));

  const byAge = await all('select * from public.rpc_find_trees(p_min_age => 300, p_limit => 1000)');
  assert.equal(byAge.length, csvCount((r) => Number(r[1]) >= 300));

  const combo = await all(
    'select * from public.rpc_find_trees(p_parish => $1, p_health => $2, p_min_age => 100, p_limit => 1000)',
    ['風順堂區', '瀕危'],
  );
  assert.equal(combo.length, csvCount((r) => r[7] === '風順堂區' && r[5] === '瀕危' && Number(r[1]) >= 100));

  // 排序：樹齡遞減
  const ages = byParish.map((r) => Number(r.age_years));
  assert.deepEqual(ages, [...ages].sort((a, b) => b - a));
});

test('RPC rpc_find_trees：關鍵字以參數化傳入，SQL 注入無效且不報錯', async () => {
  const payloads = [
    "'; drop table public.trees; --",
    "' or '1'='1",
    "榕樹' union select null, null --",
    '100%', '_', '%',
    "\\'; select pg_sleep(0); --",
  ];
  for (const p of payloads) {
    const rows = await all('select * from public.rpc_find_trees(p_keyword => $1, p_limit => 1000)', [p]);
    // 表格必須仍然存在且筆數未變
    const n = (await one('select count(*)::int n from public.trees')).n;
    assert.equal(n, csv.length, `注入字串破壞了資料表：${p}`);
    assert.ok(Array.isArray(rows));
  }
  // 正常關鍵字仍可搜尋（榕樹為子字串）
  const hit = await all('select * from public.rpc_find_trees(p_keyword => $1, p_limit => 1000)', ['榕樹']);
  assert.ok(hit.length >= csvCount((r) => r[3] === '榕樹'));
});

test('RPC rpc_find_trees：分頁 limit / offset 正確', async () => {
  const page1 = await all('select * from public.rpc_find_trees(p_limit => 10, p_offset => 0)');
  const page2 = await all('select * from public.rpc_find_trees(p_limit => 10, p_offset => 10)');
  assert.equal(page1.length, 10);
  assert.equal(page2.length, 10);
  const overlap = page1.filter((a) => page2.some((b) => b.tree_no === a.tree_no));
  assert.equal(overlap.length, 0, '分頁結果不應重疊');
});

test('RPC rpc_scatter：回傳所有資料點且樹齡與樹高為數值', async () => {
  const rows = await all('select * from public.rpc_scatter()');
  assert.equal(rows.length, csv.length);
  assert.ok(rows.every((r) => Number.isFinite(Number(r.age_years)) && Number(r.height_m) > 0));
});

test('RPC rpc_species_ranking：依株數遞減並受 limit 限制', async () => {
  const rows = await all('select * from public.rpc_species_ranking(5)');
  assert.equal(rows.length, 5);
  const counts = rows.map((r) => Number(r.tree_count));
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  assert.equal(Number(rows[0].tree_count), csvCount((r) => r[3] === '心葉榕'));
});

test('RPC rpc_parishes 與檢視表一致', async () => {
  const a = await all('select * from public.rpc_parishes()');
  const b = await all('select * from public.v_parish_stats order by tree_count desc');
  assert.deepEqual(a.map((r) => r.parish), b.map((r) => r.parish));
});

test('半徑查詢：以觀音古廟為中心 2 公里內應包含全澳最老古樹', async () => {
  const oldest = await one('select * from public.trees order by age_years desc limit 1');
  assert.equal(Number(oldest.age_years), Math.max(...csv.map((r) => Number(r[1]))));
  const near = await all(
    `select * from public.rpc_find_trees(p_lat => $1, p_lon => $2, p_radius_m => 2000, p_limit => 1000)`,
    [oldest.lat, oldest.lon],
  );
  assert.ok(near.some((r) => r.tree_no === oldest.tree_no), '中心點自身必須包含在結果內');
  // 距離計算抽樣驗證
  const distant = await all(
    `select * from public.rpc_find_trees(p_lat => $1, p_lon => $2, p_radius_m => 100, p_limit => 1000)`,
    [oldest.lat, oldest.lon],
  );
  assert.ok(distant.length <= near.length);
});

test('路綫資料具備候選地點與堂區', async () => {
  const rows = await all(`select code, name_zh, array_length(site_names,1) as sites,
                                 array_length(parish_codes,1) as parishes from public.routes order by sort_order`);
  assert.equal(rows.length, 5);
  for (const r of rows) {
    assert.ok(r.name_zh && r.name_zh.length > 3);
    if (r.code !== 'oldest-trees') assert.ok(Number(r.sites) > 0, `${r.code} 缺少候選地點`);
  }
});

test('保育科普文章內容完整（標題／摘要／內文／來源）', async () => {
  const rows = await all('select slug, category, title, summary, body_md, sources from public.conservation_topics');
  // 篇數不寫死：直接跟資料檔比對，新增文章時不必再來改這個數字
  const arts = JSON.parse(fs.readFileSync(new URL('../data/conservation.json', import.meta.url), 'utf8'));
  assert.equal(rows.length, arts.length, '入庫篇數要與 data/conservation.json 一致');
  assert.ok(rows.some((r) => r.slug === 'chemistry-view'), '化學視角文章要在庫內');
  for (const r of rows) {
    assert.ok(r.title.length > 4, `${r.slug} 標題過短`);
    assert.ok(r.body_md.length > 200, `${r.slug} 內文過短`);
    assert.ok((r.sources || []).length > 0, `${r.slug} 缺少來源`);
  }
  const categories = new Set(rows.map((r) => r.category));
  assert.ok(categories.size >= 5);
});

test('時間線涵蓋 2013 立法與 2016 首次名錄', async () => {
  const rows = await all('select year, event_date, title from public.timeline_events order by year');
  const years = rows.map((r) => Number(r.year));
  assert.ok(years.includes(2013));
  assert.ok(years.includes(2014));
  assert.ok(years.includes(2016));
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  assert.ok(rows.some((r) => r.title.includes('文化遺產保護法')));
});

test('Row Level Security 已啟用，並為匿名讀取建立政策', async () => {
  const enabled = await all(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity = true order by relname`);
  const names = enabled.map((r) => r.relname);
  for (const t of ['parishes', 'species', 'sites', 'trees', 'routes', 'conservation_topics', 'timeline_events', 'field_records']) {
    assert.ok(names.includes(t), `${t} 未啟用 RLS`);
  }
  const policies = await all(`select tablename, policyname, cmd, roles::text as roles
    from pg_policies where schemaname = 'public' order by tablename`);
  assert.equal(policies.length, 8);
  assert.ok(policies.every((p) => p.cmd === 'SELECT'), '政策應僅允許 SELECT');
  assert.ok(policies.every((p) => /anon/.test(p.roles) && /authenticated/.test(p.roles)));
  // 不得存在任何 INSERT/UPDATE/DELETE 政策
  const writes = await one(`select count(*)::int n from pg_policies
    where schemaname = 'public' and cmd <> 'SELECT'`);
  assert.equal(writes.n, 0);
});

test('anon 角色僅能讀取，不能寫入', async () => {
  await db.exec('set role anon');
  const readable = await all('select count(*)::int n from public.trees');
  assert.equal(readable[0].n, csv.length);
  await db.exec('reset role');
  const privs = await all(`select privilege_type from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' and table_name = 'trees'`);
  assert.deepEqual(privs.map((p) => p.privilege_type), ['SELECT']);
});

test('單檔 init.sql（schema + seed 合併）可一次貼進 SQL Editor 執行', async () => {
  const INIT = fs.readFileSync(path.join(ROOT, 'supabase', 'init.sql'), 'utf8');
  // 合併檔必須真的等於 schema.sql + seed.sql 的內容
  assert.ok(INIT.includes(SCHEMA.trim().slice(0, 200)), 'init.sql 未包含 schema.sql');
  assert.ok(INIT.includes(SEED.trim().slice(0, 200)), 'init.sql 未包含 seed.sql');

  const fresh = new PGlite();
  try {
    await fresh.exec(INIT);       // 一次執行整份檔案
    const t = await fresh.query('select count(*)::int n from public.trees');
    assert.equal(t.rows[0].n, csv.length);
    const v = await fresh.query('select count(*)::int n from public.v_trees');
    assert.equal(v.rows[0].n, csv.length);
    const r = await fresh.query('select count(*)::int n from public.rpc_parishes()');
    assert.equal(r.rows[0].n, 8);
    // 可重複執行（模擬使用者按兩次 Run）
    await fresh.exec(INIT);
    const t2 = await fresh.query('select count(*)::int n from public.trees');
    assert.equal(t2.rows[0].n, csv.length);
  } finally {
    await fresh.close();
  }
});
