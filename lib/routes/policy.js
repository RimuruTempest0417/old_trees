import { handler, clientError } from '../http.js';
import { summary, directions, allDirections, directionById, gaps, policyHash, sourcesList } from '../policy.js';

/**
 * GET /api/policy — 政策型設計方案（作業要求 4）
 *
 * 參數：
 *   direction=<green|energy|tourism>  只取該方向（未知方向回 404）
 *   all=1                             所有方向（含行動細節）
 *   sources=1                         附來源索引（會用到的話；預設每個條目已內嵌來源物件）
 *   gaps=1                            只取「本頁沒有的東西」
 */
export default handler(async (p, req) => {
  // 這一頁是唯讀資料：只允許 GET／HEAD，其他方法一律 405（不要讓 POST 也回一份資料，
  // 那會讓人以為這裡可以寫入）。
  const method = String((req && req.method) || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    throw clientError(405, `政策方案資料是唯讀的，不接受 ${method}（請改用 GET）`);
  }
  const hash = policyHash();
  if (p.gaps === '1' || p.gaps === 'true') {
    return { ok: true, hash, gaps: gaps() };
  }
  const dir = p.direction || p.dir;
  if (dir) {
    const one = directionById(dir);
    if (!one) {
      throw clientError(404, `沒有這個方案方向：${dir}（可用：green／energy／tourism）`);
    }
    return { ok: true, hash, direction: one };
  }
  if (p.all === '1' || p.all === 'true') {
    return {
      ok: true,
      hash,
      directions: allDirections(),
      gaps: gaps(),
      sources: sourcesList(),   // 列印頁與前端來源索引需要完整清單
      summary: summary(),
    };
  }
  return {
    ok: true,
    hash,
    directions: directions(),
    gaps: gaps(),
    summary: summary(),
  };
}, 600);
