/**
 * Supabase 模式的查詢形狀測試 —— 不需要真的連上資料庫。
 *
 * 為什麼需要這一組：線上事故「路綫推薦只出現 Cannot read properties of null」的根因是
 * 後端在 Supabase 模式下用 rpc_scatter 當候選來源，而它為了畫散佈圖只回傳
 * (tree_no, age_years, height_m, species, parish, health) —— 沒有 lat/lon。
 * 候選點全被座標檢查濾掉 → 回 {route: null, stops: []}。本機 snapshot 模式不會重現，
 * 因此改為攔截 PostgREST 請求，直接驗證「我們送出的查詢欄位」是否正確。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-not-real';

const repo = await import('../lib/repo.js');

const json = (body) => new Response(JSON.stringify(body), {
  status: 200, headers: { 'content-type': 'application/json' },
});

function stubFetch() {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, method: (init && init.method) || 'GET' });
    if (u.includes('/rest/v1/v_trees')) {
      return json([{
        tree_no: '1', official_no: '1', age_years: 100, height_m: 12.5, species: '樹種',
        parish: '大堂區', health: '健康', grade: '一級', lat: 22.1992, lon: 113.5409,
      }]);
    }
    return json([]);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('測試前提：這支測試確實跑在 Supabase 模式', () => {
  assert.equal(repo.DATA_SOURCE, 'supabase');
});

test('allTrees() 送出的查詢必須包含座標（線上事故的回歸測試）', async () => {
  const { calls, restore } = stubFetch();
  try {
    const rows = await repo.allTrees();
    const q = calls.find((c) => c.url.includes('/rest/v1/v_trees'));
    assert.ok(q, `沒有向 v_trees 取資料，實際請求：${calls.map((c) => c.url).join(' | ')}`);

    const select = decodeURIComponent(new URL(q.url).searchParams.get('select') || '');
    for (const col of ['tree_no', 'species', 'parish', 'health', 'grade', 'age_years', 'height_m', 'lat', 'lon']) {
      assert.ok(select.includes(col), `allTrees 的查詢沒有帶 ${col}（select=${select}）`);
    }
    assert.ok(!calls.some((c) => c.url.includes('rpc_scatter')),
      'allTrees 不得再呼叫 rpc_scatter —— 它沒有回傳座標，會讓路綫推薦找不到任何候選古樹');

    // 回傳值也必須帶座標（路綫推薦靠它做 150 公尺合併與最近鄰排序）
    assert.equal(rows.length, 1);
    assert.equal(rows[0].lat, 22.1992);
    assert.equal(rows[0].lon, 113.5409);
    assert.equal(rows[0].age_years, 100);
    assert.equal(rows[0].height_m, 12.5);
  } finally {
    restore();
  }
});

test('findTrees() 與 getTree() 維持原有行為（只確認沒有動到）', async () => {
  const { calls, restore } = stubFetch();
  try {
    await repo.findTrees({ limit: 1 }).catch(() => {});
    await repo.getTree('1').catch(() => {});
    assert.ok(calls.every((c) => c.url.startsWith('https://example.supabase.co/rest/v1/')),
      '不應發出非 PostgREST 的請求');
  } finally {
    restore();
  }
});


test('getTree() 在 Supabase 模式也必須套用官方值優先（線上單株詳情曾顯示名錄舊分級）', async () => {
  // 2026-09-25 線上實際狀況：/api/tree/1132 回 grade「三級」（資料庫的名錄值），
  // 但 /api/trees 與優先保育名單顯示「不分級」——同一株在兩個頁面不一致。
  // 根因：Supabase 分支的 getTree 直接回 v_trees 的原始列，沒有走 normalizeTreeRow／officialFirst，
  // 而本機 snapshot 分支走 normalizeTreeRow(enrich(t))，所以本機測試看不到。
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/rest/v1/v_trees')) {
      return json([{
        tree_no: '1132', official_no: '1132', age_years: 14, height_m: 6.01, species: '華潤楠',
        parish: '嘉模堂區', site: '小潭山', health: '一般', grade: '三級',
        official_health: '一般', official_grade: '不分級',
        lat: 22.15, lon: 113.55, diameter_cm: 14, girth_cm: 44, stem_count: 2,
        stem_measures: '胸徑 12.00／14.00 公分；胸圍 37.7／44.0 公分（共 2 支主幹，代表值取最大胸徑那支）',
      }]);
    }
    return json([]);
  };
  try {
    const t = await repo.getTree('1132');
    assert.ok(calls.some((u) => u.includes('/rest/v1/v_trees')), '應向 v_trees 取單株');
    assert.equal(t.grade, '不分級', '單株詳情的分級必須是官方現行值');
    assert.equal(t.listing_grade, '三級', '《名錄》值要保留給資料核對');
    assert.equal(t.official_grade, '不分級');
    assert.equal(t.girth_cm, 44);
    assert.match(t.stem_measures, /37\.7／44\.0/);
  } finally {
    globalThis.fetch = orig;
  }
});

test('官方值優先：Supabase 模式的分級／健康狀況也要用官方的 official_* 欄位', async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, body: init && init.body ? JSON.parse(init.body) : null });
    if (u.includes('/rest/v1/v_trees')) {
      return json([
        // 資料庫的 grade／health 是《名錄》CSV 值；official_* 才是自然網現行值
        { tree_no: '1132', official_no: '1132', age_years: 14, height_m: 6.01, species: '華潤楠', site: '小潭山',
          parish: '嘉模堂區', health: '一般', grade: '三級', official_health: '一般', official_grade: '不分級',
          lat: 22.15, lon: 113.55, diameter_cm: 14 },
        { tree_no: '548', official_no: '548', age_years: 300, height_m: 14, species: '榕樹', site: '某地',
          parish: '花地瑪堂區', health: '一般', grade: '三級', official_health: '健康', official_grade: '三級',
          lat: 22.2, lon: 113.54, diameter_cm: 90 },
      ]);
    }
    if (u.includes('/rest/v1/rpc/rpc_find_trees')) {
      return json([
        { tree_no: '1132', health: '一般', grade: '三級', official_health: '一般', official_grade: '不分級', parish: '嘉模堂區' },
        { tree_no: '548', health: '一般', grade: '三級', official_health: '健康', official_grade: '三級', parish: '花地瑪堂區' },
      ]);
    }
    return json([]);
  };
  try {
    // 1) 查詢欄位必須包含官方欄位，否則映射不到官方值
    const rows = await repo.allTrees();
    const sel = decodeURIComponent(new URL(calls[0].url).searchParams.get('select') || '');
    assert.ok(sel.includes('official_grade'), `allTrees 必須取 official_grade（select=${sel}）`);
    assert.ok(sel.includes('official_health'), `allTrees 必須取 official_health（select=${sel}）`);
    const t1132 = rows.find((r) => r.tree_no === '1132');
    assert.equal(t1132.grade, '不分級', '顯示分級必須是官方現行值');
    assert.equal(t1132.listing_grade, '三級', '《名錄》值要保留');
    assert.equal(rows.find((r) => r.tree_no === '548').health, '健康', '顯示健康狀況必須是官方現行值');

    // 2) 用官方值篩選時，SQL 端不得再帶該條件（資料庫欄位是名錄值，會漏掉 #1132），
    //    改由 JS 以顯示值篩選 —— 否則會出現「畫面上看不到、卻篩得出來」的反向問題
    calls.length = 0;
    const found = await repo.findTrees({ grade: '不分級', limit: 10 });
    const rpc = calls.find((c) => c.url.includes('rpc_find_trees'));
    assert.ok(rpc, '應該呼叫 rpc_find_trees');
    assert.equal(rpc.body.p_grade, null, '官方分級條件不得交給 SQL（SQL 用的是名錄值）');
    assert.deepEqual(found.rows.map((r) => r.tree_no), ['1132'], 'JS 端篩選要依顯示值只留 #1132');
    assert.equal(found.total, 1);

    // 3) 健康狀況同理：#548 在資料庫是「一般」、官方現行是「健康」
    calls.length = 0;
    const h = await repo.findTrees({ health: '健康', limit: 10 });
    assert.equal(calls.find((c) => c.url.includes('rpc_find_trees')).body.p_health, null);
    assert.deepEqual(h.rows.map((r) => r.tree_no), ['548']);
  } finally {
    globalThis.fetch = orig;
  }
});

