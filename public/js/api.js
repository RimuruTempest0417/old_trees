/** API 客戶端：所有資料一律經由本專案的 Serverless Functions 取得，前端不直接連資料庫。 */

const BASE = '/api';

import { errText } from './ui.js';

async function request(path, params = {}, options = {}) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, v);
  }
  const shown = url.pathname + url.search;
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, ...options });
  } catch (err) {
    // 網路層失敗（離線、DNS、被攔截）：一樣給出可讀訊息與位置
    const e = new Error(`無法連線伺服器：${errText(err)}`);
    e.path = shown; e.status = 0;
    throw e;
  }
  let body;
  try {
    body = await res.json();
  } catch {
    const e = new Error(`伺服器回應非 JSON（HTTP ${res.status}）`);
    e.path = shown; e.status = res.status;
    throw e;
  }
  if (!res.ok || body.ok === false) {
    // 伺服器可能回字串、物件、或 Vercel 自己的 {error:{...}}；
    // 一律轉成可讀文字，並附上端點與狀態碼，避免畫面出現「[object Object]」。
    const e = new Error(errText(body && body.error ? body.error : `請求失敗（HTTP ${res.status}）`));
    e.path = shown;
    e.status = res.status;
    e.code = body && body.code ? String(body.code) : '';
    e.hint = body && typeof body.hint === 'string' ? body.hint : '';
    e.body = body;
    throw e;
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
  fieldRecords: (params) => request('/field-records', params),
  saveFieldRecord: (body) => request('/field-records', {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }),
  health: () => request('/health'),
};

/**
 * 健康檢查的寬容版本：`/api/health` 在「伺服器沒問題、但資料庫有狀況」時仍回 HTTP 200，
 * 內容是 `{ok:false, error_code, hint, schema}`。這種回應不能當成失敗丟出去
 * （否則前端就看不到「資料庫需要升級」的說明），因此這裡直接讀 JSON。
 * 只有在連線本身失敗時才丟錯。
 */
export async function healthRaw() {
  const res = await fetch(`${BASE}/health`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    const e = new Error(`健康檢查失敗（HTTP ${res.status}）`);
    e.path = '/api/health'; e.status = res.status;
    throw e;
  }
  return res.json();
}

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
