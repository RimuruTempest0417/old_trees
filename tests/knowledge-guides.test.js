/**
 * 科普「數據導讀」測試（v0.16.0）
 *
 * 重點不是排版，而是「文章裡的數字不會變成過期數字」：
 *   1. 每一篇科普文章都有導讀，而且指標都存在（打錯字會讓整句消失，測試要抓得到）。
 *   2. 導讀數字由官方資料算出，與 /api/overview 同源；官方更新時一起變。
 *   3. 缺值不顯示假句子（不會出現「— 株」這種話），也不填推估值。
 *   4. 連結必須是站上真的有的分頁，不能連到不存在的頁面。
 *   5. 標示「官方資料」／「本站統計」，不得把本站統計寫成官方公布。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';
import { buildMetrics, resolveGuides, guidesMethod, GUIDES } from '../lib/knowledge-guides.js';
import { allTrees, listConservation, overview } from '../lib/repo.js';
import { rankTrees } from '../lib/priority.js';
import { overview as envOverview } from '../lib/env-chem.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PORT = 3998;

let base;
let child;
let metrics;
let guides;
test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
  const trees = await allTrees();
  metrics = buildMetrics(trees, rankTrees(trees), envOverview('2025'));
  guides = resolveGuides(metrics);
});
test.after(() => stopServer(child));

// ── 1) 覆蓋率：每一篇文章都要有導讀 ───────────────────
test('每一篇科普文章都有數據導讀，且沒有指向不存在文章的設定', async () => {
  const topics = await listConservation();
  const slugs = topics.map((t) => t.slug);
  assert.ok(slugs.length >= 12, `文章數偏少：${slugs.length}`);
  for (const slug of slugs) {
    assert.ok(guides.some((g) => g.slug === slug), `文章 ${slug} 沒有數據導讀`);
  }
  for (const g of GUIDES) {
    assert.ok(slugs.includes(g.slug), `GUIDES 設定了不存在的文章：${g.slug}`);
  }
});

test('每篇至少 3 條導讀，且每條都有句子、連結與來源標示', () => {
  for (const g of guides) {
    assert.ok(g.items.length >= 3, `${g.slug} 只有 ${g.items.length} 條導讀`);
    for (const it of g.items) {
      assert.ok(it.text && it.text.length >= 8, `${g.slug} 有太短的句子`);
      assert.ok(it.link && it.link.startsWith('#/'), `${g.slug} 的連結不是站內分頁：${it.link}`);
      assert.ok(['official', 'stat'].includes(it.kind), `${g.slug} 的來源標示不明：${it.kind}`);
    }
  }
});

// ── 2) 數字正確性 ─────────────────────────────────────
test('導讀數字與官方資料同源（株數、健康分佈、最老的一株）', async () => {
  const trees = await allTrees();
  const o = await overview();
  assert.equal(metrics.trees_total, o.tree_count, '株數要與 /api/overview 一致');
  assert.equal(metrics.trees_total, trees.length);
  assert.equal(metrics.health_endangered, trees.filter((t) => t.health === '瀕危').length);
  assert.equal(metrics.attention_count, o.tree_count - o.good, '需關注株數要與總覽同一套算法');
  const oldest = trees.reduce((b, t) => (Number(t.age_years) > Number(b.age_years || 0) ? t : b), {});
  assert.equal(metrics.oldest_age, Number(oldest.age_years));
  assert.equal(metrics.oldest_no, String(oldest.tree_no));
  assert.equal(metrics.crown_known, trees.filter((t) => t.crown_m != null).length);
  assert.equal(metrics.photo_available, trees.filter((t) => t.photo_url).length);
});

test('導讀模板不會留下未替換的佔位符，也不會在缺值時硬湊句子', () => {
  for (const g of guides) {
    for (const it of g.items) {
      assert.ok(!/\{\w+\}/.test(it.text), `${g.slug} 有未替換的佔位符：${it.text}`);
      assert.ok(!/—\s*(株|年|%)/.test(it.text), `${g.slug} 出現缺值硬湊的句子：${it.text}`);
      assert.ok(!/undefined|null|NaN/.test(it.text), `${g.slug} 出現未定義值：${it.text}`);
    }
  }
  assert.deepEqual(resolveGuides({}), [], '沒有指標時應該一條都不顯示');
  assert.deepEqual(resolveGuides({ trees_total: null }), []);
});

test('化學視角的導讀用的是官方標準值與判定', () => {
  const env = envOverview('2025');
  const kpis = Object.fromEntries((env.kpis || []).map((k) => [k.key, k]));
  assert.equal(metrics.pm10.mean, kpis.PM10.mean);
  assert.equal(metrics.pm10.standard, kpis.PM10.standard);
  const chem = guides.find((g) => g.slug === 'chemistry-view');
  assert.ok(chem, '化學視角沒有導讀');
  assert.match(chem.items[0].text, new RegExp(String(kpis.PM10.standard)));
  assert.match(chem.items[0].text, kpis.PM10.compliant ? /低於標準/ : /高於標準/);
});

test('稀有樹種與差異株數的統計正確（本站統計，不是官方公布）', async () => {
  const trees = await allTrees();
  const counts = new Map();
  for (const t of trees) counts.set(t.species, (counts.get(t.species) || 0) + 1);
  const rare = [...counts.values()].filter((c) => c <= 3);
  assert.equal(metrics.rare_species_total, rare.length);
  assert.equal(metrics.rare_tree_total, rare.reduce((a, b) => a + b, 0));
  const mismatched = trees.filter((t) => (t.listing_grade && t.grade && t.listing_grade !== t.grade)
    || (t.listing_health && t.health && t.listing_health !== t.health)
    || (t.listing_age_years != null && t.official_age_years != null
        && Number(t.listing_age_years) !== Number(t.official_age_years))).length;
  assert.equal(metrics.mismatch_total, mismatched);
  // 「故事」那篇的第一條是最老的一株（官方資料），稀有度兩條才是本站統計
  const stories = guides.find((g) => g.slug === 'stories');
  const rareItems = stories.items.filter((it) => it.metric === 'rare_species_total' || it.metric === 'rare_tree_total');
  assert.equal(rareItems.length, 2);
  assert.ok(rareItems.every((it) => it.kind === 'stat'), '稀有度是本站統計，不能標成官方公布');
});

// ── 3) 連結與用語 ─────────────────────────────────────
test('導讀連結都指向站上真的有的分頁', () => {
  const views = read('public/js/app.js');
  const names = [...views.matchAll(/^\s{2}([a-z]+): \(\) => import\('\.\/([a-z]+)\.js'\)/gm)].map((m) => m[1]);
  assert.ok(names.length >= 12, `解析到的分頁只有 ${names.length} 個`);
  for (const g of guides) {
    for (const it of g.items) {
      const page = it.link.replace(/^#\//, '').split(/[?&]/)[0];
      assert.ok(names.includes(page), `${g.slug} 連到不存在的分頁 #/${page}`);
    }
  }
});

test('導讀不得出現「作業」字樣，也不自創級別', () => {
  const blob = JSON.stringify(guides) + JSON.stringify(GUIDES) + JSON.stringify(guidesMethod()) + JSON.stringify(metrics);
  assert.ok(!/作業/.test(blob), '導讀出現「作業」字樣');
  assert.ok(!/[SABCＡＢＣ]級/.test(blob), '導讀出現自創級別');
});

test('方法說明寫清楚數字從哪來（官方 vs 本站統計）', () => {
  const m = guidesMethod();
  assert.match(m.note, /官方資料/);
  assert.match(m.note, /本站統計/);
  assert.ok(m.note.includes('澳門自然網'));
});

// ── 4) API 契約 ───────────────────────────────────────
test('GET /api/conservation?guides=1 回傳全部導讀與指標', async () => {
  const { status, json } = await get(base, '/api/conservation?guides=1');
  assert.equal(status, 200);
  assert.ok(json.metrics && json.metrics.trees_total > 0);
  assert.ok(json.guides.length >= 12);
  assert.ok(json.method && json.method.note);
  for (const g of json.guides) assert.ok(g.items.length >= 3);
});

test('GET /api/conservation?slug=… 附上這一篇的導讀，未知 slug 回 404', async () => {
  const topics = await listConservation();
  const { status, json } = await get(base, `/api/conservation?slug=${topics[0].slug}`);
  assert.equal(status, 200);
  assert.ok(json.topic && json.guide, '單篇文章要帶上導讀');
  assert.equal(json.guide.slug, topics[0].slug);
  assert.ok(json.guide.items.length >= 3);
  const notFound = await get(base, '/api/conservation?slug=no-such-article');
  assert.equal(notFound.status, 404);
});

// ── 5) 前端接線 ───────────────────────────────────────
test('科普頁把導讀放在文章開頭，且與 API 共用同一份資料', () => {
  const js = read('public/js/knowledge.js');
  assert.match(js, /export function guideBlock/);
  assert.match(js, /const \{ topic, guide \} = await api\.conservation\(\{ slug \}\)/);
  assert.match(js, /\$\{guideBlock\(guide\)\}/);
  assert.match(js, /官方資料/);
  assert.match(js, /本站統計/);
  // 導讀要放在文章正文之前（讀者先看到數據，再看內文）
  const idxGuide = js.indexOf('${guideBlock(guide)}');
  const idxBody = js.indexOf('id="article-body"');
  assert.ok(idxGuide > 0 && idxBody > 0 && idxGuide < idxBody, '導讀應該在正文之前');
});

test('導讀用到的樣式類別都有定義', () => {
  const css = read('public/css/style.css');
  for (const cls of ['.guide-card', '.guide-list', '.src-link', '.badge-good', '.badge-muted']) {
    assert.ok(css.includes(cls), `${cls} 沒有樣式定義`);
  }
});

test('README 的導讀條數與實際一致（文件數字最容易改版後忘了同步）', () => {
  const total = guides.reduce((a, g) => a + g.items.length, 0);
  assert.ok(total >= 36, `導讀總數偏少：${total}`);
  const readme = read('README.md');
  assert.ok(readme.includes(`${total} 條`), `README 沒有寫出實際的導讀條數（${total} 條）`);
});

test('GUIDES 的文章數與 README 寫的一致', () => {
  const readme = read('README.md');
  assert.ok(readme.includes(`${GUIDES.length} 篇文章`), 'README 的文章數與 GUIDES 不一致');
});
