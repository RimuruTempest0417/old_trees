/** HTTP 回應輔助工具（Vercel Serverless Functions） */

export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function send(res, status, payload, cacheSeconds = 300) {
  res.setHeader('Content-Type', JSON_HEADERS['Content-Type']);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (cacheSeconds > 0) {
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=600`);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

export const ok = (res, payload, cacheSeconds = 300) => send(res, 200, { ok: true, ...payload }, cacheSeconds);

export const fail = (res, status, message, extra = {}) =>
  send(res, status, { ok: false, error: message, ...extra }, 0);

/** 建立帶有 HTTP 狀態碼的錯誤（4xx 為用戶端錯誤，訊息原樣回傳；5xx 訊息一律通用化） */
export function clientError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** 解析查詢字串（同時支援 GET query 與 POST body） */
export function params(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const out = Object.fromEntries(url.searchParams.entries());
  // Vercel 動態路由參數（api/tree/[tree_no].js → req.query.tree_no）
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && out[k] === undefined) out[k] = Array.isArray(v) ? v[0] : v;
    }
  }
  if (req.body && typeof req.body === 'object') Object.assign(out, req.body);
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try { Object.assign(out, JSON.parse(req.body)); } catch { /* 忽略非 JSON body */ }
  }
  return out;
}

/** 統一的外層錯誤處理：任何 handler 失敗都回傳結構化錯誤而非 500 空白 */
export function handler(fn, cacheSeconds = 300) {
  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.end();
    }
    const t0 = Date.now();
    try {
      const payload = await fn(params(req), req);
      if (!res.writableEnded) ok(res, { ...payload, took_ms: Date.now() - t0 }, cacheSeconds);
    } catch (err) {
      // 可預期的用戶端錯誤以 err.status 指定（400／404）；其餘視為伺服器錯誤
      const status = Number(err && err.status) || 500;
      if (status >= 500) {
        // eslint-disable-next-line no-console
        console.error('[api error]', err);
      }
      if (!res.writableEnded) {
        const message = status >= 500
          ? '伺服器處理請求時發生錯誤，請稍後再試。'
          : String(err && err.message ? err.message : err);
        fail(res, status, message, { took_ms: Date.now() - t0 });
      }
    }
  };
}
