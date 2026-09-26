/**
 * 優先保育名單測試：評分規則、名次規則、篩選、API、列印頁面、前端串接。
 *
 * 這一組的重點不是「跑得過」，而是「規則改了會被發現」：
 * 每一個門檻值、每一個分數刻度邊界都在這裡寫死，之後有人動了 lib/priority.js 就會紅燈。
 * 另有一組「分級鐵律」測試：本站不得自行分級，級別只能來自官方欄位（grade／health）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const P = await import('../lib/priority.js');
const { rankTrees, scoreTree, filterRanked, methodDoc, prioritySummary, speciesCounts, scoreMark } = P;

// ── 1. 權重與分數刻度（分數刻度不是分級） ─────────────────
test('五個面向權重合計 100 分', () => {
  assert.deepEqual(P.PRIORITY_WEIGHTS, { age: 30, health: 25, grade: 20, rarity: 15, risk: 10 });
  assert.equal(P.WEIGHT_TOTAL, 100);
});

test('分數刻度（≥75／60–74／45–59／<45）與邊界值，且名稱不得出現「級」', () => {
  assert.equal(scoreMark(100).id, 'm75');
  assert.equal(scoreMark(75).id, 'm75');
  assert.equal(scoreMark(74).id, 'm60');
  assert.equal(scoreMark(60).id, 'm60');
  assert.equal(scoreMark(59).id, 'm45');
  assert.equal(scoreMark(45).id, 'm45');
  assert.equal(scoreMark(44).id, 'm0');
  assert.equal(scoreMark(0).id, 'm0');
  // 分數刻度只是閱讀分組：名稱不能長得像級別，否則又變成「自己分級」
  for (const m of P.SCORE_MARKS) {
    assert.ok(!/級/.test(m.label), `分數刻度名稱不得含「級」：${m.label}`);
    assert.ok(!/^[SABC]$/.test(m.id), `分數刻度 id 不得是等級字母：${m.id}`);
  }
});

// ── 2. 各項計分規則 ──────────────────────────────────────
test('樹齡級距計分（含邊界與缺值中性）', () => {
  assert.equal(P.ageScore(515).score, 30);
  assert.equal(P.ageScore(300).score, 30);
  assert.equal(P.ageScore(299).score, 25);
  assert.equal(P.ageScore(200).score, 25);
  assert.equal(P.ageScore(150).score, 19);
  assert.equal(P.ageScore(100).score, 13);
  assert.equal(P.ageScore(50).score, 7);
  assert.equal(P.ageScore(6).score, 3);
  assert.equal(P.ageScore(null).score, 15, '缺值要中性計分，不能當 0 也不能當滿分');
  assert.equal(P.ageScore(undefined).score, 15);
});

test('健康狀況計分（瀕危 25／一般 12／健康 5／未知中性 12）', () => {
  assert.equal(P.healthScore('瀕危').score, 25);
  assert.equal(P.healthScore('一般').score, 12);
  assert.equal(P.healthScore('健康').score, 5);
  assert.equal(P.healthScore('').score, 12);
  assert.equal(P.healthScore('其他').score, 12);
});

test('官方級別計分（一級 20／二級 14／三級 6／不分級 0）', () => {
  assert.equal(P.gradeScore('一級').score, 20);
  assert.equal(P.gradeScore('二級').score, 14);
  assert.equal(P.gradeScore('三級').score, 6);
  assert.equal(P.gradeScore('不分級').score, 0);
  assert.equal(P.gradeScore('').score, 0);
});

test('樹種稀有度：越少株分數越高', () => {
  assert.equal(P.rarityScore(1).score, 15);
  assert.equal(P.rarityScore(3).score, 12);
  assert.equal(P.rarityScore(4).score, 9);
  assert.equal(P.rarityScore(10).score, 9);
  assert.equal(P.rarityScore(11).score, 6);
  assert.equal(P.rarityScore(30).score, 6);
  assert.equal(P.rarityScore(31).score, 3);
  assert.equal(P.rarityScore(100).score, 3);
  assert.equal(P.rarityScore(356).score, 1);
  assert.equal(P.rarityScore(0).score, 8);
});

test('區位風險：車道／人流設施 → 高，郊野 → 低，公園街巷 → 中，未知 → 中', () => {
  assert.equal(P.riskOf('澳門區民國大馬路').level, 'high');
  assert.equal(P.riskOf('路環區竹灣馬路').level, 'high');
  assert.equal(P.riskOf('澳門區聖地牙哥酒店').level, 'high');
  assert.equal(P.riskOf('路環區石排灣郊野公園').level, 'low', '郊野公園要在「公園」之前被辨識');
  assert.equal(P.riskOf('氹仔區小潭山2000環山徑').level, 'low');
  assert.equal(P.riskOf('澳門區盧廉若公園').level, 'mid');
  assert.equal(P.riskOf('澳門區觀音古廟').level, 'mid');
  assert.equal(P.riskOf('某個不知名的地方').level, 'mid');
  assert.equal(P.riskOf('').level, 'mid');
  assert.equal(P.riskOf('澳門區白鴿巢公園').score, 6);
});

// ── 3. 單株評分與名次 ────────────────────────────────────
test('單株評分：所有配分相加等於總分，且附上主要理由', () => {
  const counts = new Map([['桑', 2], ['心葉榕', 356]]);
  const r = scoreTree({ tree_no: '981', species: '桑', age_years: 315, health: '瀕危', grade: '二級', official_loc: '澳門區聖地牙哥酒店', diameter_cm: 85 }, { counts });
  assert.equal(r.parts.age, 30);
  assert.equal(r.parts.health, 25);
  assert.equal(r.parts.grade, 14);
  assert.equal(r.parts.rarity, 12);
  assert.equal(r.parts.risk, 10);
  assert.equal(r.score, 91, '30+25+14+12+10 = 91');
  assert.equal(r.tier, undefined, '不得回傳任何自訂級別欄位');
  assert.equal(r.reasons.length, 3);
  assert.ok(r.reasons.every((x) => /\d+ 分/.test(x)), '理由必須看得出配分');
  assert.equal(r.tree_no, '981');
  assert.equal(r.risk_level, 'high');
});

test('缺值不會被當 0：沒有樹齡／健康／級別的樹仍有中性分', () => {
  const r = scoreTree({ tree_no: 'x', species: '未知', official_loc: '' }, { counts: new Map() });
  assert.equal(r.parts.age, 15);
  assert.equal(r.parts.health, 12);
  assert.equal(r.parts.grade, 0, '級別沒有中性值，官方未分級就是 0 分（與「不分級」一致）');
  assert.equal(r.parts.rarity, 8);
  assert.equal(r.parts.risk, 6);
  assert.equal(r.score, 41);
});

test('名次規則：分數高→樹齡高→樹號小（結果必須可重現）', () => {
  const counts = new Map();
  const trees = [
    { tree_no: '10', species: 'A', age_years: 100, health: '健康', grade: '三級', official_loc: '公園' },
    { tree_no: '9', species: 'A', age_years: 100, health: '健康', grade: '三級', official_loc: '公園' },
    { tree_no: '20', species: 'A', age_years: 200, health: '健康', grade: '三級', official_loc: '公園' },
    { tree_no: '30', species: 'A', age_years: 100, health: '瀕危', grade: '三級', official_loc: '公園' },
  ];
  const rows = rankTrees(trees, { counts });
  assert.deepEqual(rows.map((r) => r.tree_no), ['30', '20', '9', '10']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4]);
  // 同一份輸入跑兩次結果要完全一樣
  assert.deepEqual(rankTrees(trees, { counts }), rows);
});

test('speciesCounts 以樹種統計株數（含缺值歸類）', () => {
  const counts = speciesCounts([{ species: '心葉榕' }, { species: '心葉榕' }, { species: '' }]);
  assert.equal(counts.get('心葉榕'), 2);
  assert.equal(counts.get('（未提供樹種）'), 1);
});

// ── 4. 篩選與摘要 ────────────────────────────────────────
test('篩選：官方分級／官方健康狀況可多選、堂區／樹種／關鍵字、limit', () => {
  const rows = rankTrees([
    { tree_no: '1', species: '桑', age_years: 315, health: '瀕危', grade: '二級', official_loc: '酒店', parish: 'A' },
    { tree_no: '2', species: '樟', age_years: 120, health: '健康', grade: '三級', official_loc: '公園', parish: 'B' },
    { tree_no: '3', species: '桑', age_years: 60, health: '一般', grade: '三級', official_loc: '郊野公園', parish: 'A' },
  ]);
  // 篩選參數一律是官方欄位：grade（分級）與 health（健康狀況）
  assert.equal(filterRanked(rows, { grade: '二級' }).length, 1);
  assert.equal(filterRanked(rows, { grade: '三級' }).length, 2);
  assert.equal(filterRanked(rows, { grade: '二級,三級' }).length, 3);
  assert.equal(filterRanked(rows, { health: '瀕危' }).length, 1);
  assert.equal(filterRanked(rows, { health: '健康,一般' }).length, 2);
  assert.equal(filterRanked(rows, { grade: '一級' }).length, 0, '沒有官方一級就不該出現');
  assert.equal(filterRanked(rows, { parish: 'A' }).length, 2);
  assert.equal(filterRanked(rows, { species: '桑' }).length, 2);
  assert.equal(filterRanked(rows, { q: '樟' }).length, 1);
  assert.equal(filterRanked(rows, { q: '3' })[0].tree_no, '3', '關鍵字可比對樹號');
  assert.equal(filterRanked(rows, { q: '酒店' }).length, 1);
  assert.equal(filterRanked(rows, { limit: 2 }).length, 2);
  assert.equal(filterRanked(rows, { grade: '', health: '' }).length, 3, '未指定時不過濾');
});

test('摘要：官方分級／官方健康狀況分佈、分數刻度統計、平均分、最高分', () => {
  const rows = rankTrees([
    { tree_no: '1', species: '桑', age_years: 315, health: '瀕危', grade: '一級', official_loc: '酒店' },
    { tree_no: '2', species: '樟', age_years: 20, health: '健康', grade: '三級', official_loc: '公園' },
  ]);
  const s = prioritySummary(rows);
  assert.equal(s.evaluated, 2);
  assert.equal(s.by_grade['一級'], 1, '分級統計必須用官方欄位');
  assert.equal(s.by_grade['三級'], 1);
  assert.equal(s.by_health['瀕危'], 1);
  assert.equal(s.by_tier, undefined, '不得再有自訂等級統計');
  assert.equal(s.by_score.m75 + s.by_score.m60 + s.by_score.m45 + s.by_score.m0, 2);
  assert.equal(s.top.tree_no, '1');
  assert.equal(s.top.grade, '一級', '最高分摘要要帶官方分級，不是自訂等級');
  assert.ok(s.mean_score > 0);
});

test('方法說明包含權重、規則、分級政策與已知限制（介面與報告共用同一份）', () => {
  const m = methodDoc();
  assert.equal(m.total, 100);
  assert.equal(m.steps.length, 5);
  assert.ok(m.steps.every((s) => s.rule && s.name));
  assert.equal(m.marks.length, 4);
  assert.equal(m.tiers, undefined, '方法說明不得再提供自訂等級門檻');
  assert.ok(m.grading_policy.includes('官方'), '必須載明分級以官方為準');
  assert.ok(m.caveats.some((c) => c.includes('冠幅')), '必須說明冠幅未列入評分');
  assert.ok(m.caveats.some((c) => c.includes('不是市政署的官方認定')), '必須聲明非官方認定');
  assert.ok(m.caveats.some((c) => c.includes('不是級別')), '必須說明分數段落不是級別');
  assert.ok(m.tie_break.includes('樹齡'));
});

// ── 4b. 分級鐵律：本站不得自訂級別 ────────────────────────
test('分級鐵律：程式與介面都不得出現自訂等級（S／A／B／C 級）', () => {
  const files = [
    'lib/priority.js', 'lib/routes/priority.js', 'public/js/priority.js',
    'public/js/card.js', 'lib/routes/meta.js', 'lib/routes/overview.js',
  ];
  for (const f of files) {
    const src = read(f);
    for (const bad of ['S 級', 'A 級', 'B 級', 'C 級', 'tier']) {
      assert.ok(!src.includes(bad), `${f} 不得出現「${bad}」：分級一律以官方為準`);
    }
  }
});

test('分級鐵律：官方級別與健康狀況以外的值不得進入名單', () => {
  const raw = JSON.parse(read('data/iam_trees.json'));
  const GRADES = new Set(['一級', '二級', '三級', '不分級']);
  const HEALTH = new Set(['健康', '一般', '瀕危']);
  const rows = rankTrees(Object.entries(raw).map(([k, v]) => ({ ...v, tree_no: k })));
  for (const r of rows) {
    assert.ok(!r.grade || GRADES.has(r.grade), `非官方分級值：${r.grade}`);
    assert.ok(!r.health || HEALTH.has(r.health), `非官方健康狀況值：${r.health}`);
  }
  // 官方分級分佈必須與來源檔一致（一級 1／二級 6／三級 646／不分級 5）
  const s = prioritySummary(rows);
  assert.deepEqual(s.by_grade, { 一級: 1, 二級: 6, 三級: 646, 不分級: 5 });
});

// ── 5. 真實資料（用倉庫內的官方資料跑一次）────────────────
test('以真實 658 筆資料評分：名次合理且每株都有分數與理由', () => {
  const raw = JSON.parse(read('data/iam_trees.json'));
  const trees = Object.entries(raw).map(([k, v]) => ({ ...v, tree_no: k }));
  assert.equal(trees.length, 658);
  const rows = rankTrees(trees);
  assert.equal(rows.length, 658);
  assert.ok(rows.every((r) => r.score > 0 && r.score <= 100 && r.reasons.length === 3));
  assert.ok(rows.every((r) => r.tier === undefined), '任何一株都不得被本平台貼上自訂等級');
  // 最老的一株必須在前段（515 年、一級、瀕危）
  const oldest = rows.find((r) => r.tree_no === '544');
  assert.ok(oldest.rank <= 3, `515 年一級瀕危古樹名次應在前 3，實際 ${oldest.rank}`);
  // 名次連續
  assert.deepEqual(rows.map((r) => r.rank).slice(0, 5), [1, 2, 3, 4, 5]);
  // 官方分級的每一級都要有樹，且分數刻度也要分佈到各段（否則刻度沒意義）
  const grades = new Set(rows.map((r) => r.grade).filter(Boolean));
  assert.ok(grades.has('一級') && grades.has('二級') && grades.has('三級'));
  const marks = new Set(rows.map((r) => scoreMark(r.score).id));
  assert.ok(marks.size >= 3, `分數刻度應分散，實際只落在 ${[...marks].join('、')}`);
  // 最常見的樹種（心葉榕 356 株）不該拿到稀有分
  const common = rows.find((r) => r.species === '心葉榕');
  assert.equal(common.parts.rarity, 1);
});

// ── 6. API 與路由 ────────────────────────────────────────
test('API：/api/priority 是單段落（Vercel 只路由一段），且路由表有登記', async () => {
  const router = read('lib/router.js');
  assert.match(router, /\{ id: 'priority', path: '\/api\/priority' \}/);
  assert.doesNotMatch(router, /path: '\/api\/[^']*\/[^']*priority/, '不能是多段落路徑');
  assert.ok(fs.existsSync(path.join(ROOT, 'lib/routes/priority.js')));
});

test('API 實跑：預設回 50 筆、evaluated=658、附方法說明，官方篩選與 limit 生效', async () => {
  const { default: route } = await import('../lib/routes/priority.js');
  const call = (query) => new Promise((resolve, reject) => {
    const req = { method: 'GET', url: `/api/priority?${query}`, headers: { host: 'localhost' } };
    const res = {
      statusCode: 200, headers: {}, writableEnded: false,
      setHeader(k, v) { this.headers[k] = v; },
      end(body) { this.writableEnded = true; try { resolve(JSON.parse(body)); } catch (e) { reject(e); } },
    };
    route(req, res).catch(reject);
  });
  const all = await call('');
  assert.equal(all.ok, true);
  assert.equal(all.evaluated, 658);
  assert.equal(all.count, 50);
  assert.equal(all.items.length, 50);
  assert.equal(all.items[0].rank, 1);
  assert.ok(all.method.weights.age === 30);
  assert.equal(all.total, 100);
  const few = await call('limit=5&grade=二級');
  assert.ok(few.count <= 5);
  assert.ok(few.items.every((r) => r.grade === '二級'), 'grade 篩選必須只回官方二級');
  const endangered = await call('health=瀕危&limit=0');
  assert.ok(endangered.items.every((r) => r.health === '瀕危'));
  assert.ok(endangered.items.length > 0 && endangered.items.length < 658);
  // 不得有任何自訂等級欄位或值
  assert.ok(all.items.every((r) => r.tier === undefined && r.tier_label === undefined));
  const byNo = await call('q=544&limit=3');
  assert.equal(byNo.items[0].tree_no, '544');
  const everything = await call('limit=0');
  assert.equal(everything.items.length, 658, 'limit=0 代表全部');
});

// ── 7. 前端串接 ──────────────────────────────────────────
test('前端：分頁、模組、API 方法、列印模式都接好', () => {
  const app = read('public/js/app.js');
  assert.match(app, /priority: \(\) => import\('\.\/priority\.js'\)/);
  assert.match(app, /priority: '優先保育'/);
  const html = read('public/index.html');
  assert.match(html, /href="#\/priority" data-view="priority"/);
  assert.match(html, /id="view-priority"/);
  const api = read('public/js/api.js');
  assert.match(api, /priority: \(params\) => request\('\/priority', params\)/);
  const card = read('public/js/card.js');
  assert.match(card, /data-mode="priority"/);
  assert.match(card, /api\.priority\(/);
  assert.match(card, /priorityListHtml/);
});

test('前端 KPI：官方列級株數必須是數字相加，不能變成字串相接', async () => {
  // 2026-09-25 實際 bug：num(1) + num(6) 讓 KPI 顯示 16（正確 7）。
  // num() 回傳字串，任何「先格式化再相加」的寫法都會踩到。
  const { officialListedCount } = await import('../public/js/priority.js');
  assert.equal(officialListedCount({ by_grade: { 一級: 1, 二級: 6, 三級: 646, 不分級: 5 } }), 7);
  assert.equal(officialListedCount({ by_grade: { 一級: 0, 二級: 0 } }), 0);
  assert.equal(typeof officialListedCount({ by_grade: {} }), 'number');
  assert.equal(officialListedCount(undefined), 0, '缺摘要時不得拋錯');
  // 真實資料也要對得上（一級 1＋二級 6）
  const raw = JSON.parse(read('data/iam_trees.json'));
  const rows = rankTrees(Object.entries(raw).map(([k, v]) => ({ ...v, tree_no: k })));
  assert.equal(officialListedCount(prioritySummary(rows)), 7);
  // 前端不得再把格式化過的字串相加（先去掉註解，否則會被說明文字誤判）
  const src = read('public/js/priority.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/num\([^)]*\)\s*\+\s*num\(/.test(src), 'num() 不得直接相加（會變字串相接）');
});

test('前端名單：不得把陣列直接內插進 HTML（會變成一整排逗號）', () => {
  const src = read('public/js/priority.js');
  // 內插 map(...) 之後一定要 join。作法：把每個 ${...} 用括號配對切出來（正則會被箭頭函式
  // 裡的 ) 騙到，量不出真正的結尾），再看它有沒有 .join(。
  const exprs = [];
  for (let i = 0; i < src.length - 1; i += 1) {
    if (src[i] !== '$' || src[i + 1] !== '{') continue;
    let depth = 0;
    for (let j = i + 1; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) { exprs.push(src.slice(i + 2, j)); i = j; break; }
      }
    }
  }
  const bad = exprs.filter((e) => e.includes('.map(') && !e.includes('.join('));
  assert.equal(bad.length, 0, `發現未 join 的內插：${bad.map((e) => e.slice(0, 60)).join('｜')}`);
  assert.match(src, /r\.reasons\.map\(\(x\) => esc\(x\)\)\.join\('<br>'\)/, '理由要逐條跳脫後 join');
  // 分頁與模組必須在 service worker 的預載清單內（離線時才開得起來）
  const sw = read('public/sw.js');
  assert.match(sw, /\/js\/priority\.js/);
});

// ── 8. 列印 ──────────────────────────────────────────────
test('列印：每頁自成 A4、頁數＝方法頁 ＋ 名單分頁、欄位齊全', async () => {
  const { priorityListHtml, PRIORITY_PAGE_ROWS } = await import('../public/js/card.js');
  const raw = JSON.parse(read('data/iam_trees.json'));
  const trees = Object.entries(raw).map(([k, v]) => ({ ...v, tree_no: k }));
  const rows = rankTrees(trees);
  const data = {
    evaluated: rows.length, count: 60, summary: prioritySummary(rows), method: methodDoc(),
    items: rows.slice(0, 60),
  };
  const out = priorityListHtml(data, { date: '2026-09-25 12:00:00' });
  const pages = out.html.split('<article').length - 1;
  // 封面固定兩張 A4（方法頁＋說明頁；兩欄版面相容性差，已改成單欄兩頁），其後每頁 PRIORITY_PAGE_ROWS 列
  assert.equal(pages, 2 + Math.ceil(60 / PRIORITY_PAGE_ROWS));
  assert.equal(out.pages.length, pages);
  assert.match(out.html, /澳門古樹優先保育名單/);
  assert.match(out.html, /評分方法/);
  assert.match(out.html, /使用限制/);
  assert.match(out.html, /非官方文件/);
  // 每一列都要有名次、編號、分數；級別欄只能顯示官方分級，不得出現自訂等級
  assert.match(out.html, /#544/);
  assert.match(out.html, /健康（官方）/);
  assert.match(out.html, /分級（官方）/);
  assert.ok(!/S 級|A 級|B 級|C 級/.test(out.html), '列印名單不得出現自訂等級');
  assert.match(out.html, /分級一律以官方為準/);
  assert.ok(!/undefined/.test(out.html), '不得出現 undefined');
  // 空名單也要生得出封面（不能拋錯）
  const empty = priorityListHtml({ items: [], method: methodDoc(), summary: prioritySummary([]), evaluated: 0 });
  assert.equal(empty.pages.length, 2, '空名單仍要有封面與說明兩頁，不能拋錯');
  assert.match(empty.html, /澳門古樹優先保育名單/);
});

test('列印樣式：優先保育名單用到的類別都有定義', () => {
  const css = read('public/css/print.css');
  for (const cls of ['.card-table.prio', '.card-head.compact', '.card-sub']) {
    assert.ok(css.includes(cls), `print.css 缺少 ${cls}`);
  }
});
