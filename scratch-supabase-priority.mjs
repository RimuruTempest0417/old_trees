// 模擬 Supabase 模式：用假 fetch 回傳 v_trees 的列，直接跑 /api/priority handler
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40);
const rows = [
  { tree_no: '981', age_years: 315, height_m: 12.5, species: '桑', parish: 'SFA', health: '瀕危', grade: '二級', lat: 22.1, lon: 113.5, diameter_cm: 85, official_loc: '澳門區聖地牙哥酒店' },
  { tree_no: '544', age_years: 515, height_m: 14, species: '海南蒲桃', parish: 'SFA', health: '瀕危', grade: '一級', lat: 22.2, lon: 113.5, diameter_cm: 100, official_loc: '澳門區觀音古廟' },
];
globalThis.fetch = async (url) => {
  console.log('  fetch →', String(url).slice(0, 120));
  return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
};
const { default: route } = await import('./lib/routes/priority.js');
const req = { method: 'GET', url: '/api/priority?limit=2', headers: { host: 'localhost' } };
const res = {
  statusCode: 200, headers: {}, writableEnded: false,
  setHeader(k, v) { this.headers[k] = v; },
  end(body) { this.writableEnded = true; console.log('  回應狀態', this.statusCode, '長度', body.length); const j = JSON.parse(body); console.log('  ok=', j.ok, 'evaluated=', j.evaluated, 'items=', (j.items||[]).length, 'error=', j.error); },
};
try { await route(req, res); } catch (e) { console.log('  ✗ handler 拋出：', e.message); }
