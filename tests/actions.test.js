/**
 * 優先保育「行動建議」測試（v0.16.0）
 *
 * 這份清單會影響「先去看哪一株、先做什麼」，所以測試的重點不是排版，而是：
 *   1. 每個建議都能回答「依據什麼、為什麼是這一株」——沒有出處、沒有理由的建議不許出現。
 *   2. 條件可預期：同一個條件永遠得到同一個建議（規則式，不看感覺排序）。
 *   3. 不硬湊：不符合任何規則的樹就沒有建議，不得為了讓名單好看而補建議。
 *   4. 分級鐵律與用語鐵律：不得自創級別、不得出現「作業」字樣。
 *   5. 名單／CSV／列印三處用同一份資料（同一套規則、同樣的株數）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';
import {
  ACTION_RULES, URGENCY_ORDER, urgencyRank, treeActions, actionPlan, actionsMethod,
} from '../lib/actions.js';
import { rankTrees } from '../lib/priority.js';
import { allTrees } from '../lib/repo.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PORT = 3999;

let base;
let child;
let trees;
let plan;
test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
  trees = await allTrees();
  plan = actionPlan(trees, rankTrees(trees));
});
test.after(() => stopServer(child));

/** 造一株最小可用資料（只填規則會看的欄位） */
const tree = (over = {}) => ({
  tree_no: '1', species: '細葉榕', parish: '風順堂區', loc: '測試地點',
  age_years: 120, health: '健康', grade: '三級', photo_url: '/photos/trees/1.jpg',
  crown_m: 12, geo_precision: 'official', ...over,
});

const ids = (t) => treeActions(t).map((a) => a.id);

// ── 1) 規則本身 ───────────────────────────────────────
test('規則齊全且欄位完整：id／行動／時程／依據／判斷式', () => {
  assert.ok(ACTION_RULES.length >= 8, '規則太少，行動清單會沒有內容');
  const seen = new Set();
  for (const r of ACTION_RULES) {
    assert.equal(typeof r.id, 'string');
    assert.ok(r.id && !seen.has(r.id), `id 重複：${r.id}`);
    seen.add(r.id);
    assert.ok(r.label && r.label.length >= 6, `${r.id} 沒有具體行動敘述`);
    assert.ok(URGENCY_ORDER.includes(r.urgency), `${r.id} 的建議時程不在分級內`);
    assert.ok(r.basis && r.basis.length >= 15, `${r.id} 沒有出處`);
    assert.equal(typeof r.why, 'function');
  }
});

test('每一條規則的出處都是官方文件或可回溯的本站統計', () => {
  for (const r of ACTION_RULES) {
    const ok = /號法律|號行政法規|號行政長官批示|指引|市政署|本站統計|名錄|質詢/.test(r.basis);
    assert.ok(ok, `${r.id} 的出處看不出是官方文件或本站統計：${r.basis}`);
  }
});

test('建議時程排序：立即處理 → 今年內 → 持續追蹤', () => {
  assert.deepEqual(URGENCY_ORDER, ['立即處理', '今年內', '持續追蹤']);
  assert.ok(urgencyRank('立即處理') < urgencyRank('今年內'));
  assert.ok(urgencyRank('今年內') < urgencyRank('持續追蹤'));
  assert.equal(urgencyRank('不存在'), URGENCY_ORDER.length, '未知時程要排到最後，不能排最前');
});

// ── 2) 判斷式 ─────────────────────────────────────────
test('官方健康瀕危→搶救複查；健康且分數不高→沒有這一條', () => {
  assert.ok(ids(tree({ health: '瀕危' })).includes('rescue'));
  assert.ok(!ids(tree({ health: '健康' })).includes('rescue'));
});

test('官方一級／二級→檢視法定保護牌；三級不觸發', () => {
  assert.ok(ids(tree({ grade: '一級' })).includes('legal-mark'));
  assert.ok(ids(tree({ grade: '二級' })).includes('legal-mark'));
  assert.ok(!ids(tree({ grade: '三級' })).includes('legal-mark'));
});

test('冠幅缺值→現場量測；有冠幅值就不列（不硬湊建議）', () => {
  assert.ok(ids(tree({ crown_m: null })).includes('measure-crown'));
  assert.ok(!ids(tree({ crown_m: 8.5 })).includes('measure-crown'));
});

test('樹齡 300 年以上→立地改善與導覽解說；299 年不觸發', () => {
  assert.ok(ids(tree({ age_years: 300 })).includes('support'));
  assert.ok(ids(tree({ age_years: 300 })).includes('heritage-route'));
  assert.ok(!ids(tree({ age_years: 299 })).includes('support'));
});

test('官方照片缺漏→補拍', () => {
  assert.ok(ids(tree({ photo_url: null })).includes('photo'));
  assert.ok(!ids(tree({ photo_url: '/photos/trees/1.jpg' })).includes('photo'));
});

test('官方座標非逐株實測→GPS 校正；逐株實測不觸發', () => {
  assert.ok(ids(tree({ geo_precision: 'approx' })).includes('gps-fix'));
  assert.ok(!ids(tree({ geo_precision: 'official' })).includes('gps-fix'));
});

test('稀有樹種（全澳 ≤3 株）→母樹保護；常見樹種不觸發', () => {
  const counts = new Map([['細葉榕', 40], ['華潤楠', 2]]);
  const rare = treeActions(tree({ species: '華潤楠' }), { counts });
  const common = treeActions(tree({ species: '細葉榕' }), { counts });
  assert.ok(rare.some((a) => a.id === 'rare-mother'));
  assert.ok(rare.find((a) => a.id === 'rare-mother').why.includes('2 株'), '理由要寫出實際株數');
  assert.ok(!common.some((a) => a.id === 'rare-mother'));
});

test('《名錄》與官方現行值不同→核對註記；相同則不觸發', () => {
  const diff = treeActions(tree({ grade: '三級', listing_grade: '二級' }));
  assert.ok(diff.some((a) => a.id === 'data-sync'));
  assert.ok(diff.find((a) => a.id === 'data-sync').why.includes('二級→三級'));
  assert.ok(!ids(tree({ grade: '三級', listing_grade: '三級' })).includes('data-sync'));
});

test('區位風險高且分數 ≥75 才是「立即處理」的落枝風險，其餘留給例行巡查', () => {
  const high = treeActions({ ...tree(), risk_level: 'high', risk_note: '地點「測試」含「廟」', score: 80 });
  const low = treeActions({ ...tree(), risk_level: 'high', risk_note: '地點「測試」含「廟」', score: 55 });
  assert.ok(high.some((a) => a.id === 'risk-watch'));
  assert.ok(!low.some((a) => a.id === 'risk-watch'), '高風險但分數不高者不該列為立即處理');
});

test('缺值不抛錯：空物件只會得到「去補資料」類的建議，不會硬湊其他建議', () => {
  // 官方缺值（冠幅、照片）本來就該變成「去現場補量／補拍」的建議，這是設計而非硬湊；
  // 沒填資料卻跑出「搶救複壯」「立地改善」這種要有依據才成立的建議才是問題。
  const fillOnly = ['measure-crown', 'photo', 'gps-fix'];
  const acts = treeActions({});
  assert.ok(acts.length > 0 && acts.every((a) => fillOnly.includes(a.id)),
    `空物件只能得到補資料類建議，實際：${acts.map((a) => a.id).join('、')}`);
  assert.deepEqual(treeActions(null), []);
  assert.deepEqual(treeActions(undefined), []);
});

test('建議陣列一定按建議時程排序', () => {
  const acts = treeActions(tree({ health: '瀕危', crown_m: null, age_years: 400 }));
  const ranks = acts.map((a) => urgencyRank(a.urgency));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), '排序錯誤');
});

// ── 3) 全站行動計畫 ───────────────────────────────────
test('每條行動的株數與逐株建議一致（名單不能自己算一套）', () => {
  const tally = new Map();
  for (const [, acts] of plan.advice) for (const a of acts) tally.set(a.id, (tally.get(a.id) || 0) + 1);
  for (const a of plan.actions) {
    assert.equal(a.count, tally.get(a.id) || 0, `${a.id} 株數不一致`);
    assert.equal(a.members.length, a.count, `${a.id} 的成員清單長度與株數不符`);
    assert.deepEqual(a.trees, a.members.map((x) => x.tree_no), `${a.id} 的樹號清單要與成員一致`);
  }
  assert.ok(plan.actions.some((a) => a.count > 0), '全站不該完全沒有建議');
});

test('每一株最多只拿到每條規則一次，且成員資料足以分工', () => {
  for (const [, acts] of plan.advice) {
    assert.equal(new Set(acts.map((a) => a.id)).size, acts.length, '同一條規則重複列出');
  }
  for (const a of plan.actions) {
    for (const x of a.members.slice(0, 20)) {
      assert.ok(x.tree_no && x.why, `${a.id} 的成員缺樹號或理由`);
      assert.ok(typeof x.why === 'string' && x.why.length >= 4, '理由太短，等於沒寫');
    }
  }
});

test('摘要文字與 API 契約：可複製、可分工（每條都有依據與代表株）', () => {
  for (const a of plan.actions) {
    assert.ok(a.basis, `${a.id} 缺依據`);
    assert.ok(a.examples.length <= 12);
    assert.ok(a.count === 0 ? a.examples.length === 0 : a.examples.length > 0, `${a.id} 代表株數量不對`);
  }
  const m = actionsMethod();
  assert.ok(m.disclaimer.includes('不是樹木醫學診斷'), '必須說明這不是官方工程建議');
  assert.equal(m.rule_count, ACTION_RULES.length);
  assert.ok((m.notes || []).length >= 3);
});

test('全站主要行動與官方資料一致（株數對得上官方統計）', async () => {
  const count = (id) => (plan.actions.find((a) => a.id === id) || { count: 0 }).count;
  const endangered = trees.filter((t) => t.health === '瀕危').length;
  assert.equal(count('rescue'), endangered, '「瀕危」株數要等於官方健康狀況統計');
  const noCrown = trees.filter((t) => t.crown_m == null).length;
  assert.equal(count('measure-crown'), noCrown, '冠幅缺漏株數應等於官方缺值株數');
  assert.equal(count('photo'), trees.filter((t) => !t.photo_url).length);
  assert.equal(count('support'), trees.filter((t) => Number(t.age_years) >= 300).length);
});

// ── 4) 用語與分級鐵律 ─────────────────────────────────
test('行動清單不得自創級別、不得出現「作業」字樣', () => {
  const blob = JSON.stringify(plan.actions) + JSON.stringify(ACTION_RULES) + JSON.stringify(actionsMethod());
  assert.ok(!/作業/.test(blob), '行動清單出現「作業」字樣');
  assert.ok(!/[SABCＡＢＣ]級/.test(blob), '行動清單出現自創級別');
  assert.ok(!/官方級別[：:]/.test(blob));
});

// ── 5) API 契約 ───────────────────────────────────────
test('GET /api/priority 附帶行動清單與逐株建議（不含完整成員，避免傳輸膨脹）', async () => {
  const { status, json } = await get(base, '/api/priority?limit=5');
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.actions) && json.actions.length >= 8);
  assert.ok(json.actions_method && json.actions_method.disclaimer);
  assert.ok(!('members' in json.actions[0]), '一般請求不該回傳完整成員');
  assert.equal(json.items.length, 5);
  for (const it of json.items) {
    assert.ok(Array.isArray(it.advice), `#${it.tree_no} 沒有建議陣列`);
  }
  const withAdvice = json.items.find((it) => it.advice.length);
  assert.ok(withAdvice, '前 5 名應該至少有一株帶建議');
  assert.ok(withAdvice.advice[0].label && withAdvice.advice[0].why && withAdvice.advice[0].basis);
});

test('GET /api/priority?all=actions 回傳完整成員（CSV／列印用），且株數與一般請求一致', async () => {
  const full = (await get(base, '/api/priority?all=actions')).json;
  const normal = (await get(base, '/api/priority?limit=1')).json;
  assert.equal(full.actions.length, normal.actions.length);
  for (const a of full.actions) {
    assert.ok(Array.isArray(a.members), `${a.id} 沒有完整成員`);
    assert.equal(a.members.length, a.count);
  }
  const urgent = full.actions.find((a) => a.urgency === '立即處理');
  assert.ok(urgent.members.length > 0, '立即處理應該有成員');
  for (const x of urgent.members) assert.ok(x.tree_no && x.why);
  // 兩次請求的株數必須相同，否則名單和列印會各說各話
  for (const a of normal.actions) {
    const same = full.actions.find((x) => x.id === a.id);
    assert.equal(same.count, a.count, `${a.id} 兩種請求的株數不同`);
  }
});

// ── 6) 前端接線與列印 ─────────────────────────────────
test('優先保育頁有行動清單卡、逐株建議欄與匯出', () => {
  const js = read('public/js/priority.js');
  assert.match(js, /export function actionsCard/);
  assert.match(js, /export function urgencyBadge/);
  assert.match(js, /export function actionsText/);
  assert.match(js, /建議行動/);
  assert.match(js, /#p-csv-actions/);
  assert.match(js, /api\.priority\(\{ all: 'actions' \}\)/);
  assert.match(js, /建議行動: \(r\.advice \|\| \[\]\)/);
});

test('列印有「行動清單」模式，兩段式（總表＋逐株）', async () => {
  const card = read('public/js/card.js');
  assert.match(card, /data-mode="actions"/);
  assert.match(card, /export function actionsSheetHtml/);
  const { actionsSheetHtml } = await import('../public/js/card.js');
  const out = actionsSheetHtml({
    evaluated: 658,
    actions: [{
      id: 'rescue',
      label: '排入專家複查與搶救復壯評估',
      urgency: '立即處理',
      basis: '《澳門古樹名木養護指引》巡查養護與搶救復壯',
      count: 2,
      members: [
        { tree_no: '981', species: '細葉榕', age_years: 300, health: '瀕危', grade: '三級', score: 91, why: '官方健康狀況為「瀕危」' },
        { tree_no: '544', species: '海南蒲桃', age_years: 515, health: '瀕危', grade: '三級', score: 87, why: '官方健康狀況為「瀕危」' },
      ],
    }],
    actions_method: { notes: ['規則式'], disclaimer: '不是樹木醫學診斷' },
  }, { date: '2026/9/26 下午1:00:00' });
  assert.equal(out.pages.length, 2, '總表 1 頁＋逐株 1 頁');
  assert.match(out.html, /優先保育行動清單/);
  assert.match(out.html, /#981/);
  assert.match(out.html, /#544/);
  assert.match(out.html, /不是樹木醫學診斷/);
  assert.match(out.html, /card-page/);
  const many = actionsSheetHtml({
    evaluated: 658,
    actions: [{
      id: 'measure-crown', label: '現場量測冠幅', urgency: '今年內', basis: '本站統計：官方僅 67 株有冠幅值',
      count: 100,
      members: Array.from({ length: 100 }, (_, i) => ({
        tree_no: String(i + 1), species: '細葉榕', age_years: 120, health: '一般', grade: '三級', score: 50, why: '官方冠幅值缺漏',
      })),
    }],
    actions_method: { notes: ['規則式'], disclaimer: '不是樹木醫學診斷' },
  });
  // 非「立即處理」只列代表株，其餘以一行帶過（紙本不該變成幾十頁）
  assert.ok(many.pages.length <= 3, `非立即處理的行動不該印出全部 100 株（實際 ${many.pages.length} 頁）`);
  assert.match(many.html, /另有 94 株/);
});

test('行動清單用到的樣式類別都有定義', () => {
  const css = read('public/css/style.css') + read('public/css/print.css');
  for (const cls of ['.card-actions', '.card-notes', '.card-page', '.card-table', '.badge-bad', '.badge-fair', '.badge-info', '.badge-muted', '.guide-card', '.guide-list']) {
    assert.ok(css.includes(cls), `${cls} 沒有樣式定義`);
  }
});

test('優先保育頁的說明沒有把行動清單說成官方認定', () => {
  const js = read('public/js/priority.js');
  assert.match(js, /不是樹木醫學診斷|不是官方/);
  assert.ok(!/官方(建議|工程)/.test(js), '不要把本站建議寫成官方建議');
});

test('列印每頁列數在程式與驗證腳本裡一致（改了一邊、另一邊不會默默過關）', async () => {
  // 每頁列數同時出現在 public/js/card.js（版面）與 scripts/card-pdf.py（預期頁數），
  // 兩邊若不一致，PDF 檢查會拿錯的預期值去比對——那比沒有檢查更糟。
  const { ACTION_PAGE_ROWS } = await import('../public/js/card.js');
  assert.ok(Number.isInteger(ACTION_PAGE_ROWS) && ACTION_PAGE_ROWS >= 20 && ACTION_PAGE_ROWS <= 40,
    `每頁列數不合理：${ACTION_PAGE_ROWS}`);
  const py = read('scripts/card-pdf.py');
  assert.match(py, new RegExp(`ACTION_PAGE_ROWS = ${ACTION_PAGE_ROWS}\\b`),
    'card-pdf.py 的每頁列數與 card.js 不一致');
  assert.match(py, /ACTION_SAMPLE_ROWS = 6\b/, '代表株數量也要與 actionsSheetHtml 一致');
  const card = read('public/js/card.js');
  assert.match(card, /members\.slice\(0, opts\.sampleRows \|\| 6\)/, 'card.js 的代表株數量應為 6');
});
