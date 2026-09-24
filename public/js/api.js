/** API 客戶端：所有資料一律經由本專案的 Serverless Functions 取得，前端不直接連資料庫。 */

const BASE = '/api';

async function request(path, params = {}, options = {}) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Accept: 'application/json' }, ...options });
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`伺服器回應非 JSON（HTTP ${res.status}）：${path}`);
  }
  if (!res.ok || body.ok === false) {
    throw new Error(body && body.error ? body.error : `請求失敗（HTTP ${res.status}）：${path}`);
  }
  return body;
}

export const api = {
  meta: () => request('/meta', {}, {}),
  overview: () => request('/overview'),
  parishes: () => request('/parishes'),
  species: (params) => request('/species', params),
  trees: (params) => request('/trees', params),
  tree: (no) => request(`/tree/${encodeURIComponent(no)}`),
  stats: (params) => request('/stats', params),
  routes: () => request('/routes'),
  route: (params) => request('/route', params),
  conservation: (params) => request('/conservation', params),
  timeline: () => request('/timeline'),
  health: () => request('/health'),
};

/** 帶快取的 GET：同一 session 內相同查詢只打一次 API */
const cache = new Map();
export async function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  try {
    return await cache.get(key);
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}
