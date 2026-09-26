/**
 * 政策型設計方案（#/policy）測試
 *   1. 資料層：三個方向齊全、每一條政策與行動都有出處、沒有引用不存在的來源
 *   2. 誠實原則：官方缺口必須寫在 gaps，且不得出現「澳門樹木降溫×度」這類沒來源的數字
 *   3. API：契約、未知方向 404、缺漏來源自我檢查
 *   4. 前端接線：分頁、模組、API 客戶端、稽核清單、列印模式
 *   5. 資料與產生檔同步（改了 JSON 忘了重跑產生器要紅燈）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, get } from './helpers/server.js';
import { POLICY } from '../data/policy-data.js';
import {
  summary, directions, allDirections, directionById, gaps, sourcesIndex, policyHash,
} from '../lib/policy.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PORT = 3997;

let base;
let child;
test.before(async () => {
  const s = await startServer(PORT);
  base = s.base;
  child = s.child;
});
test.after(() => stopServer(child));

// ── 1) 資料層 ─────────────────────────────────────────
test('產生檔與 data/policy.json 同步（--check）', () => {
  const out = execFileSync('node', ['scripts/gen-policy.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /已是最新/);
});

test('三個方向齊全，且每個方向都有目標、政策與行動', () => {
  const dirs = allDirections();
  assert.deepEqual(dirs.map((d) => d.id), ['green', 'energy', 'tourism']);
  assert.deepEqual(dirs.map((d) => d.name), ['城市綠化', '環保節能', '文旅文創']);
  for (const d of dirs) {
    assert.ok(d.goal && d.goal.length > 20, `${d.id} 缺目標`);
    assert.ok(d.why && d.why.length > 40, `${d.id} 缺「為什麼是這個方向」的說明`);
    assert.ok(d.policies.length >= 3, `${d.id} 政策依據少於 3 條`);
    assert.ok(d.actions.length >= 3, `${d.id} 具體行動少於 3 項`);
    assert.ok(d.evidence.length >= 3, `${d.id} 缺少以本站資料支持的優先順序`);
  }
});

test('每一條政策與行動都附官方出處（沒有出處的要回報，不是默默帶過）', () => {
  const index = sourcesIndex();
  const missing = [];
  for (const d of allDirections()) {
    for (const item of [...d.policies, ...d.actions, ...d.evidence]) {
      const id = item.source_id;
      if (!id) {
        // 行動可以沒有單一「主要出處」，但必須有政策依據（basis），否則就是無憑無據的建議
        if (item.what && !(item.basis_ids || []).length) {
          missing.push(`行動 ${item.id}（${item.title}）既沒有出處也沒有政策依據`);
        }
        continue;
      }
      if (!index[id]) missing.push(`引用了不存在的來源 ${id}`);
    }
  }
  for (const g of gaps()) {
    if (g.source_id && !index[g.source_id]) missing.push(`缺口引用了不存在的來源 ${g.source_id}`);
  }
  assert.deepEqual(missing, []);
});

test('來源索引：每一筆都有標題、發布者與 https 網址', () => {
  const index = sourcesIndex();
  assert.ok(Object.keys(index).length >= 15, '官方來源太少，方案會站不住');
  for (const [id, s] of Object.entries(index)) {
    assert.ok(s.title && s.title.length > 4, `${id} 缺標題`);
    assert.ok(s.publisher && s.publisher.length > 1, `${id} 缺發布者`);
    assert.match(s.url, /^https:\/\//, `${id} 的網址不是 https`);
  }
});

test('行動欄位完整：做什麼、誰負責、在哪裡、怎麼算成功、期程、成本概念', () => {
  for (const d of allDirections()) {
    for (const a of d.actions) {
      for (const field of ['id', 'title', 'what', 'who', 'where', 'kpi', 'term', 'cost']) {
        assert.ok(String(a[field] || '').trim().length > 1, `${d.id}/${a.id} 缺 ${field}`);
      }
      assert.match(a.id, /^[GNT]\d$/, `行動編號格式應如 G1／N1／T1：${a.id}`);
      // 成功指標要可核對：必須含數字或明確的頻率用詞
      assert.match(a.kpi, /[0-9]|每|至少|不低於/, `${a.id} 的成功指標無法核對：${a.kpi}`);
      // 政策依據要指向真實來源
      assert.ok((a.basis_ids || []).length >= 2, `${a.id} 的政策依據少於 2 條`);
      assert.deepEqual(a.basis_missing, [], `${a.id} 引用了不存在的依據`);
    }
  }
});

test('誠實原則：兩個官方缺口必須寫出來，且不得把外國數字當澳門數字', () => {
  const gs = gaps().map((g) => g.title + g.detail).join('\n');
  assert.match(gs, /降溫/, '缺少「官方沒有城市樹木降溫度數」的說明');
  assert.match(gs, /碳匯/, '缺少「官方沒有逐株碳匯數字」的說明');
  const all = JSON.stringify(POLICY);
  // 引用國際研究時必須同時標明不是澳門實測
  assert.match(all, /不是澳門實測值|跨城市綜合研究/);
  // 不得出現「澳門（城市）樹木降溫 X 度」這種沒有官方來源的具體數字
  assert.doesNotMatch(all, /澳門[^。]{0,12}降溫[^。]{0,8}[0-9]/);
  assert.doesNotMatch(all, /古樹[^。]{0,6}碳匯[^。]{0,6}[0-9]+[^。]{0,4}公噸/);
});

test('方案內容不得出現會被老師誤會的「作業」字眼', () => {
  for (const p of ['data/policy.json', 'data/policy-data.js', 'lib/policy.js', 'public/js/policy.js']) {
    assert.ok(!read(p).includes('作業'), `${p} 含「作業」二字`);
  }
});

// ── 2) 計算層 ─────────────────────────────────────────
test('summary 統計與方向清單一致，且自我回報缺漏來源', () => {
  const s = summary();
  const dirs = allDirections();
  assert.equal(s.direction_count, 3);
  assert.equal(s.policy_count, dirs.reduce((n, d) => n + d.policies.length, 0));
  assert.equal(s.action_count, dirs.reduce((n, d) => n + d.actions.length, 0));
  assert.equal(s.source_count, Object.keys(sourcesIndex()).length);
  assert.equal(s.hash, policyHash());
  assert.deepEqual(s.missing_sources, []);
  assert.deepEqual(s.missing_basis, []);
  assert.ok(s.method.scope && s.method.honesty && s.method.data);
});

test('directionById：找到回完整內容、找不到回 null（不亂丟錯）', () => {
  const one = directionById('green');
  assert.equal(one.id, 'green');
  assert.ok(one.policies[0].source && one.policies[0].source.url.startsWith('https://'));
  assert.equal(directionById('no-such-direction'), null);
  assert.equal(directionById(''), null);
  assert.equal(directionById(null), null);
});

test('directions() 只回目錄，不含內文（清單端點不該把整份方案吐出來）', () => {
  const list = directions();
  assert.equal(list.length, 3);
  for (const d of list) {
    assert.equal(d.policies, undefined);
    assert.equal(d.actions, undefined);
    assert.ok(d.policy_count > 0 && d.action_count > 0);
  }
});

// ── 3) API ────────────────────────────────────────────
test('GET /api/policy 回目錄與統計', async () => {
  const r = await get(base, '/api/policy');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.directions.length, 3);
  assert.equal(r.json.summary.direction_count, 3);
  assert.equal(r.json.hash, policyHash());
  assert.ok(r.json.gaps.length >= 5, '誠實卡條目太少');
});

test('GET /api/policy?direction=green 回單一方向；未知方向回 404 並可用訊息', async () => {
  const ok = await get(base, '/api/policy?direction=green');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.direction.id, 'green');
  assert.ok(ok.json.direction.actions.length >= 3);

  const bad = await get(base, '/api/policy?direction=nope');
  assert.equal(bad.status, 404);
  assert.match(String(bad.json.error), /green/);
});

test('GET /api/policy?all=1 回完整內容；?gaps=1 只回缺口', async () => {
  const all = await get(base, '/api/policy?all=1');
  assert.equal(all.status, 200);
  assert.ok(all.json.directions[0].policies[0].key, 'all=1 應含政策內文');
  assert.ok(all.json.sources.length >= 15);
  assert.equal(all.json.summary.missing_sources.length, 0);

  const g = await get(base, '/api/policy?gaps=1');
  assert.equal(g.status, 200);
  assert.ok(g.json.gaps.length >= 5);
  assert.equal(g.json.directions, undefined);
});

test('POST /api/policy 不被接受（這一頁是唯讀資料）', async () => {
  const r = await get(base, '/api/policy', { method: 'POST' });
  assert.ok([404, 405].includes(r.status), `POST 應被拒，實際 ${r.status}`);
});

// ── 4) 前端接線 ────────────────────────────────────────
test('分頁、模組、API 客戶端與稽核清單都已接上 policy', () => {
  const html = read('public/index.html');
  assert.match(html, /href="#\/policy"[^>]*data-view="policy"/);
  assert.match(html, /id="view-policy"/);
  const app = read('public/js/app.js');
  assert.match(app, /policy: \(\) => import\('\.\/policy\.js'\)/);
  assert.match(app, /policy: '政策方案'/);
  assert.match(read('public/js/api.js'), /policy: \(params\) => request\('\/policy', params\)/);
  assert.match(read('scripts/ui-audit.sh'), /chemistry,policy/);
});

test('列印分頁有「政策方案摘要」模式，且與網頁共用同一份資料', () => {
  const card = read('public/js/card.js');
  assert.match(card, /data-mode="policy"/);
  assert.match(card, /policySheetHtml/);
  assert.match(card, /api\.policy\(\{ all: 1 \}\)/);
  assert.match(card, /export function policySheetHtml/);
});

test('政策方案頁的樣式已定義（用到的類別不得只有程式碼在用、樣式表裡沒有）', () => {
  const css = read('public/css/style.css') + read('public/css/print.css');
  for (const cls of ['.stat-row', '.stat-value', '.tone-danger', '.src-link', '.policy-action', '.kv', '.card-policy']) {
    assert.ok(css.includes(cls), `${cls} 沒有樣式定義`);
  }
});

test('路由清單與載入器都有 policy（v0.9.1 的兩份清單教訓）', async () => {
  const { ROUTES, matchRoute, loadRoute } = await import('../lib/router.js');
  assert.ok(ROUTES.some((r) => r.id === 'policy' && r.path === '/api/policy'));
  assert.equal(matchRoute('/api/policy').id, 'policy');
  // loadRoute 回傳的是處理函式本身（不是模組）
  const fn = await loadRoute('policy');
  assert.equal(typeof fn, 'function');
});
