/**
 * API 路由表 —— 全站只有「一個」Vercel Serverless Function。
 *
 * 為什麼要這樣做：Vercel Hobby 方案限制「每個 Deployment 最多 12 個 Serverless Function」，
 * 而 `api/` 底下每一個 .js 檔都算一個。原本 12 個端點 ＋ 1 個動態路由（api/tree/[tree_no].js）
 * 剛好 13 個 → 部署直接失敗（No more than 12 Serverless Functions can be added to a Deployment
 * on the Hobby plan）。改法是把所有 handler 移到 `lib/routes/`（lib/ 不算 function），
 * `api/` 只留一個萬用入口 `api/[[...route]].js`，由本檔分派。
 *
 * 這一層同時被本機 dev-server 使用，因此「本機 == 線上」的路由行為完全一致。
 */

/** 路由表：路徑一律以 /api 開頭；:param 代表單一段動態參數 */
export const ROUTES = [
  { id: 'health', path: '/api/health' },
  { id: 'meta', path: '/api/meta' },
  { id: 'overview', path: '/api/overview' },
  { id: 'parishes', path: '/api/parishes' },
  { id: 'trees', path: '/api/trees' },
  { id: 'tree', path: '/api/tree/:tree_no', param: 'tree_no', queryParam: 'no' },
  { id: 'species', path: '/api/species' },
  { id: 'stats', path: '/api/stats' },
  { id: 'routes', path: '/api/routes' },
  { id: 'route', path: '/api/route' },
  { id: 'conservation', path: '/api/conservation' },
  { id: 'timeline', path: '/api/timeline' },
  { id: 'field-records', path: '/api/field-records' },
];

/**
 * 模組載入器。路徑必須是「字面字串」，Vercel 的打包器才能靜態追蹤到檔案；
 * 用變數組字串會導致線上找不到模組。
 */
const LOADERS = {
  health: () => import('./routes/health.js'),
  meta: () => import('./routes/meta.js'),
  overview: () => import('./routes/overview.js'),
  parishes: () => import('./routes/parishes.js'),
  trees: () => import('./routes/trees.js'),
  tree: () => import('./routes/tree.js'),
  species: () => import('./routes/species.js'),
  stats: () => import('./routes/stats.js'),
  routes: () => import('./routes/routes.js'),
  route: () => import('./routes/route.js'),
  conservation: () => import('./routes/conservation.js'),
  timeline: () => import('./routes/timeline.js'),
  'field-records': () => import('./routes/field-records.js'),
};

/**
 * 依路徑找路由；找不到回 null。回傳 { id, params }
 *
 * 兩種形式都支援：
 *   1. 路徑參數 `/api/tree/544` —— 本機 dev-server 與文件上的形式
 *   2. 單段落＋查詢參數 `/api/tree?no=544`
 *
 * 為什麼需要第 2 種：Vercel 的萬用入口 `api/[[...route]].js` 實際上線時
 * **只匹配一個路徑段落**（`/api/trees` ✓、`/api/tree/544` ✗ → 連 function 都進不去，
 * 直接回 Vercel 的 404「The page could not be found」，2026-09-24 實際發生）。
 * 因此前端一律呼叫單段落端點；`vercel.json` 另把 `/api/tree/:no` 重寫成
 * `/api/tree?no=:no`，讓 REST 形式在線上也可用。
 *
 * @param {string} pathname 例如 /api/tree/66
 * @param {string} [search] 查詢字串（可含開頭的 ?）
 */
export function matchRoute(pathname, search) {
  const clean = String(pathname || '').replace(/\/+$/, '') || '/';
  for (const r of ROUTES) {
    if (!r.param) {
      if (r.path === clean) return { id: r.id, params: {} };
      continue;
    }
    const [head, tail] = r.path.split('/:');           // '/api/tree' ／ 'tree_no'
    if (clean.startsWith(head + '/')) {
      const value = clean.slice(head.length + 1);
      if (value && !value.includes('/')) return { id: r.id, params: { [tail]: decodeURIComponent(value) } };
    }
  }
  if (search) {
    const q = new URLSearchParams(String(search).replace(/^\?/, ''));
    for (const r of ROUTES) {
      if (!r.param || !r.queryParam || r.path.split('/:')[0] !== clean) continue;
      const value = q.get(r.queryParam);
      if (value) return { id: r.id, params: { [r.param]: value } };
    }
  }
  return null;
}

/** 載入指定路由的 handler（回傳 `handler(fn, ttl)` 產生的函式） */
export async function loadRoute(id) {
  const loader = LOADERS[id];
  if (!loader) throw new Error(`未知的路由 id：${id}`);
  const mod = await loader();
  if (typeof mod.default !== 'function') throw new Error(`${id} 沒有 default export 函式`);
  return mod.default;
}

/**
 * 分派請求。
 * @param {object} req  Node/Vercel 風格的請求物件
 * @param {object} res  回應物件
 * @param {string} pathname  例如 /api/tree/66
 * @param {{handler?: Function}} [opts] 後端可自備 handler（dev-server 用來做熱重載）
 * @returns {Promise<boolean>} 是否已處理（false 表示 404）
 */
export async function dispatch(req, res, pathname, opts = {}) {
  const search = (() => {
    try { return new URL(req.url, `http://${req.headers?.host || 'localhost'}`).search; }
    catch { return ''; }
  })();
  const match = matchRoute(pathname, search);
  if (!match) return false;
  // 動態路由參數併入 req.query，讓 lib/http.js 的 params() 一併取用
  if (Object.keys(match.params).length) {
    req.query = { ...(req.query || {}), ...match.params };
  }
  const fn = opts.handler || (await loadRoute(match.id));
  await fn(req, res);
  return true;
}

/** 未命中時的一致 404（與舊版 dev-server 的回應格式相同，測試有斷言） */
export function notFound(res, pathname) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({ ok: false, error: `找不到 API 路由 ${pathname}` }));
}
