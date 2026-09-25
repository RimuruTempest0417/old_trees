/**
 * 化學視角（F）測試
 *   1. 資料層：官方數值齊全、每一項都有出處、數值在合理範圍
 *   2. 計算層：達標判定、區域背景對照、古樹健康 × 區域
 *   3. API：契約與錯誤處理
 *   4. 前端接線：分頁、模組、API 客戶端、稽核清單
 *   5. 資料與產生檔同步（改了 JSON 忘了重跑產生器要紅燈）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';
import { ENV_CHEM } from '../data/env-chem-data.js';
import {
  overview, stationMatrix, aqiSummary, acidRain, mechanisms,
  regionBackground, regionOf, healthByRegion, STATIONS, POLLUTANTS, DATA, sourceIndex,
} from '../lib/env-chem.js';
import { allTrees } from '../lib/repo.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PORT = 3996;

let base;
let child;
test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

// ── 1) 資料層 ─────────────────────────────────────────
test('產生檔與 data/env_chem.json 同步（--check）', () => {
  const out = execFileSync('node', ['scripts/gen-env-chem.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /已是最新/);
});

test('每一項官方數據都帶出處，且數值在合理範圍', () => {
  const air = ENV_CHEM.air;
  assert.ok(air.source.org && air.source.doc && /^https:\/\//.test(air.source.url), '空氣數據要有官方出處與連結');
  assert.equal(air.stations.length, 6, '六個空氣監測站');
  assert.deepEqual(air.display_order, POLLUTANTS);

  for (const year of Object.keys(air.years)) {
    for (const pol of air.display_order) {
      const blk = air.years[year][pol];
      assert.ok(blk && Number.isFinite(blk.mean), `${year} ${pol} 要有官方平均值`);
      assert.ok(blk.mean >= 0 && blk.mean < 200, `${year} ${pol} 平均濃度不合理：${blk.mean}`);
      for (const s of air.stations) {
        const v = blk.by_station[s];
        assert.ok(Number.isFinite(v), `${year} ${pol} 缺 ${s} 的值`);
        assert.ok(v >= 0 && v < 200, `${year} ${pol} ${s} 數值不合理：${v}`);
      }
    }
  }
  // 二氧化碳（CO）單位是 mg/m³，合理範圍更小
  for (const year of Object.keys(air.years)) {
    for (const s of air.stations) {
      const v = air.years[year].CO.by_station[s];
      assert.ok(v > 0 && v < 5, `CO ${year} ${s} 應以 mg/m³ 為單位：${v}`);
    }
  }
});

test('降雨酸鹼度只寫官方查到的事，並且明說找不到的部分', () => {
  const ar = acidRain();
  assert.ok(ar.sources.length >= 3, '酸雨段落要有官方／學術出處');
  const [lo, hi] = ar.official_1990s.ph_range;
  assert.ok(lo >= 3 && hi <= 7 && lo < hi, 'pH 範圍要在合理區間');
  assert.ok(ar.official_1999.min_ph < 5.6, '1999 最低值應低於酸雨門檻');
  assert.match(ar.current_note, /未能找到|找不到/, '沒有近年官方值時必須說清楚，不得留白或編造');
});

test('土壤與水泥的機制都有化學式與文獻出處', () => {
  const m = mechanisms();
  assert.ok(m.references.length >= 4, '至少四筆可查證文獻');
  for (const r of m.references) {
    assert.ok(r.org && r.doc && /^https?:\/\//.test(r.url), `文獻要有機構、文件名與連結：${r.id}`);
  }
  const ids = new Set(Object.keys(sourceIndex()));
  for (const mech of m.mechanisms) {
    assert.ok(mech.equations.length >= 1, `${mech.id} 要有化學式`);
    assert.ok(mech.title && mech.text, `${mech.id} 要有標題與說明`);
    for (const ref of mech.refs) {
      assert.ok(ids.has(ref), `${mech.id} 引用了不存在的文獻 ${ref}`);
    }
  }
  // 關鍵機制必須存在，避免以後被刪掉
  const keys = m.mechanisms.map((x) => x.id);
  for (const need of ['acid-formation', 'soil-acid', 'cement']) {
    assert.ok(keys.includes(need), `缺少機制：${need}`);
  }
});

// ── 2) 計算層 ─────────────────────────────────────────
test('overview 依官方年平均標準判定達標，且與官方數字一致', () => {
  const ov = overview('2025');
  assert.equal(ov.stations.length, 6);
  assert.equal(ov.kpis.length, 6);
  const by = Object.fromEntries(ov.kpis.map((k) => [k.key, k]));
  assert.equal(by['PM2.5'].mean, 17.3);
  assert.equal(by['PM2.5'].standard, 25);
  assert.equal(by['PM2.5'].compliant, true);
  assert.equal(by['PM2.5'].pct_of_standard, 69);
  assert.equal(by.NO2.mean, 29.3);
  assert.equal(by.NO2.compliant, true);
  assert.equal(by.O3.standard, null, '官方未設 O3 年平均標準');
  assert.equal(by.O3.pct_of_standard, null);
  assert.equal(overview('1999'), null, '沒有資料的年份回 null，不亂編');
});

test('各站矩陣與 AQI 概況：站數、日數與官方一致', () => {
  const m = stationMatrix('PM2.5', '2025');
  assert.equal(m.rows.length, 6);
  assert.equal(m.standard, 25);
  assert.equal(m.rows.find((r) => r.station === '荷蘭園站').value, 19.1);
  assert.equal(m.rows.find((r) => r.station === '石排灣站').character, '一般性環境');

  const a = aqiSummary();
  assert.equal(a.rows.length, 6);
  const h = a.rows.find((r) => r.station === '荷蘭園站');
  assert.equal(h.days['良好'], 224);
  assert.equal(h.days['不良'], 17);
  assert.equal(h.highest.index, 286);
  assert.ok(a.events.length >= 1 && /沙塵/.test(a.events[0].text), '沙塵事件要保留');
  assert.equal(a.history.years.length, 20);
  assert.equal(a.history.years[0], 2006);
  assert.equal(a.history['不良'][0], 81);
});

test('區域背景：堂區 → 區域 → 官方監測站，未知堂區回 null', () => {
  assert.equal(regionOf('嘉模堂區'), '氹仔');
  assert.equal(regionOf('聖方濟各堂區'), '路環');
  assert.equal(regionOf('不存在的堂區'), null);

  const bg = regionBackground('嘉模堂區');
  assert.equal(bg.region, '氹仔');
  assert.deepEqual(bg.stations, ['氹仔中心區站', '大潭山站']);
  assert.equal(bg.pollutants.NO2.by_station['氹仔中心區站'], 26.0);
  assert.match(bg.note, /不是這一株古樹的實測值/, '區域背景必須標明不是單株實測');
  assert.equal(regionBackground('火星堂區'), null);
});

test('古樹 × 區域：總數與官方健康狀況可對照，且附「相關不等於因果」說明', () => {
  return allTrees().then((trees) => {
    const r = healthByRegion(trees);
    assert.equal(r.regions.reduce((a, x) => a + x.total, 0), trees.length, '每個區域的株數加總要等於全部古樹');
    assert.ok(r.regions.length >= 3, '至少要涵蓋半島／氹仔／路環');
    const island = r.regions.find((x) => x.region === '路環');
    assert.ok(island.total > 0 && island.background['PM2.5'].length >= 1);
    // 每個區域都要帶平均樹齡：健康差異可能來自樹齡，這是必須讓讀者看到的干擾因素
    for (const reg of r.regions) {
      assert.ok(Number.isFinite(reg.avg_age) && reg.avg_age > 0, `${reg.region} 缺平均樹齡`);
    }
    assert.ok(new Set(r.regions.map((x) => x.avg_age)).size > 1, '各區平均樹齡不應全部相同（顯示才有意義）');
    assert.match(r.caveat, /相關不等於因果/);
  });
});

// ── 3) API ───────────────────────────────────────────
test('GET /api/env-chem 回完整文件（含官方出處與雜湊）', async () => {
  const { status, json } = await get(base, '/api/env-chem');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.match(json.hash, /^[0-9a-f]{16}$/);
  assert.ok(json.doc.overview.kpis.length === 6);
  assert.ok(json.doc.air.source.url.includes('dspa.gov.mo'));
  assert.ok(json.doc.acid_rain.sources.length >= 3);
  assert.ok(json.doc.materials.mechanisms.length >= 4);
  assert.match(json.doc.causal_caveat, /相關不等於因果/);
  assert.deepEqual(json.stations, STATIONS);
});

test('GET /api/env-chem 參數：block／matrix／region／year', async () => {
  const acid = await get(base, '/api/env-chem?block=acid');
  assert.equal(acid.json.acid_rain.official_1999.min_ph, 3.1);

  const mat = await get(base, '/api/env-chem?block=materials');
  assert.ok(mat.json.materials.references.length >= 4);

  const mx = await get(base, '/api/env-chem?matrix=no2');
  assert.equal(mx.json.matrix.rows.length, 6, 'matrix 參數不分大小寫');

  const rg = await get(base, `/api/env-chem?region=${encodeURIComponent('嘉模堂區')}`);
  assert.equal(rg.json.region.region, '氹仔');

  const trees = await get(base, '/api/env-chem?trees=1');
  assert.equal(trees.json.tree_count, 658);
  assert.ok(trees.json.health_by_region.regions.length >= 3);
});

test('GET /api/env-chem 錯誤處理：未知區域 404、沒有資料的年份 400、壞的污染物 400', async () => {
  const r404 = await get(base, `/api/env-chem?region=${encodeURIComponent('不存在堂區')}`);
  assert.equal(r404.status, 404);
  assert.equal(r404.json.ok, false);

  const r400 = await get(base, '/api/env-chem?year=1999');
  assert.equal(r400.status, 400);
  assert.match(String(r400.json.error), /1999/);

  const rPol = await get(base, '/api/env-chem?matrix=XYZ');
  assert.equal(rPol.status, 400);
  assert.match(String(rPol.json.error), /PM2\.5|PM10/);
});

// ── 4) 前端接線 ───────────────────────────────────────
test('化學視角分頁已接好（nav／view／VIEWS／TITLES／API 客戶端／稽核清單）', () => {
  const html = read('public/index.html');
  assert.match(html, /href="#\/chemistry" data-view="chemistry"/);
  assert.match(html, /id="view-chemistry"/);

  const app = read('public/js/app.js');
  assert.match(app, /chemistry: \(\) => import\('\.\/chemistry\.js'\)/);
  assert.match(app, /chemistry: '化學視角'/);

  const apiJs = read('public/js/api.js');
  assert.match(apiJs, /envChem: \(params\) => request\('\/env-chem', params\)/);

  const audit = read('scripts/ui-audit.sh');
  assert.match(audit, /monitoring,chemistry/, 'UI 稽核要涵蓋新分頁');

  const page = read('public/js/chemistry.js');
  assert.match(page, /不換算、不內插、不平均/);
  assert.match(page, /區域空氣背景/);
  assert.match(page, /相關不等於因果/);
  // 前端不得出現字面環境變數名（安全測試另有一條，這裡先守住本頁）
  assert.ok(!/SUPABASE_|supabase\.co/.test(page), '前端不得出現資料庫環境變數或網域');
});

test('單株詳情面板會帶出該株所在區域的空氣背景值', () => {
  const map = read('public/js/map.js');
  assert.match(map, /api\.envChem\(\{ region: t\.parish \}\)/);
  assert.match(map, /不是這一株古樹的實測值/);
});

test('官方年均值一律顯示到小數第一位（不得四捨五入成整數）', () => {
  const page = read('public/js/chemistry.js');
  assert.match(page, /num\(k\.mean, 1\)/, 'KPI 平均值要一位小數');
  assert.match(page, /num\(v, 1\)/, '各站污染物表要一位小數');
  assert.match(page, /num\(air\.years\[String\(year\)\]\[p\]\.mean, 1\)/, '官方平均列要一位小數');
  assert.match(page, /num\(x\.value, 1\)/, '區域背景濃度要一位小數');
  assert.match(page, /年平均濃度（\$\{ov\.year\}）/, '年份不得套千分位');
  assert.match(read('public/js/map.js'), /num\(v, 1\)/, '單株詳情的區域背景要一位小數');
});

test('一鍵初始化檔（init.sql）已重新產生，且含有化學視角分類', () => {
  const out = execFileSync('node', ['scripts/gen-init-sql.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /已是最新/);
  const init = read('supabase/init.sql');
  assert.match(init, /'chemistry-view'/, 'init.sql 要含新文章，否則使用者重跑資料庫拿不到');
  assert.match(init, /conservation_topics_category_check check \(category in \('為何保育'/, 'CHECK 允許值要含新分類');
  assert.match(init, /'化學視角'/, 'CHECK 允許值要含新分類');
});

test('保育科普第 12 篇：化學視角（含化學式與來源）', () => {
  const arts = JSON.parse(read('data/conservation.json'));
  const a = arts.find((x) => x.slug === 'chemistry-view');
  assert.ok(a, '缺少 chemistry-view 文章');
  assert.equal(a.category, '化學視角');
  assert.ok(a.sources.length >= 8, '化學視角的來源要具體列出');
  assert.match(a.body_md, /H_2SO_4/, '要有硫酸生成的化學式');
  assert.match(a.body_md, /Al\(OH\)_3/, '要有鋁溶出的機制');
  assert.match(a.body_md, /Ca\\?\(OH\)_2/, '要有水泥氫氧化鈣的機制');
  assert.match(a.body_md, /相關不等於因果|找不到就不寫/, '要有誠實聲明');
});
