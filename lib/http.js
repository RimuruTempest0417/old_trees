/** HTTP 回應輔助工具（Vercel Serverless Functions） */

const JSON_HEADERS = {
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

/**
 * 建立「可以安全對外顯示」的 5xx 錯誤。
 * 一般 5xx 只回覆通用訊息（不洩漏內部細節），但資料庫結構是舊版這類問題
 * 必須讓使用者看到「哪張表／哪個欄位缺少、該做什麼」，否則部署後只看到
 * 「伺服器處理請求時發生錯誤」，完全無法自我排除。設定 err.public = true 即可原樣回傳。
 */
export function publicError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.public = true;
  Object.assign(err, extra);
  return err;
}

/**
 * 把任何丟出來的東西轉成一句可讀文字。
 * 為什麼需要：`String(err.message || err)` 在 err 是「沒有 message 的物件」時會變成
 * 字面上的「[object Object]」——前端只看到這串，等於完全沒有錯誤資訊（實際踩過）。
 */
export function errorText(err) {
  if (err == null) return '未知錯誤';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  if (typeof err.error === 'string' && err.error) return err.error;
  if (typeof err.error === 'object' && err.error) return errorText(err.error);
  if (typeof err === 'object') {
    try {
      const s = JSON.stringify(err);
      return s && s !== '{}' ? s.slice(0, 400) : '未知錯誤（沒有附帶訊息）';
    } catch {
      return '未知錯誤（無法序列化的物件）';
    }
  }
  return String(err);
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
      // 可預期的用戶端錯誤以 err.status 指定（400／404）；其餘視為伺服器錯誤。
      // err.public = true 的 5xx 例外（例如「資料庫結構是舊版」）會原樣回傳訊息，
      // 讓使用者知道該做什麼，而不是只看到一句通用錯誤。
      const status = Number(err && err.status) || 500;
      if (status >= 500) {
        // eslint-disable-next-line no-console
        console.error('[api error]', err);
      }
      if (!res.writableEnded) {
        const message = status >= 500 && !(err && err.public)
          ? '伺服器處理請求時發生錯誤，請稍後再試。'
          : errorText(err);
        fail(res, status, message, {
          took_ms: Date.now() - t0,
          ...(err && err.code ? { code: err.code } : {}),
          ...(err && err.hint ? { hint: err.hint } : {}),
        });
      }
    }
  };
}
