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
