import { handler } from '../http.js';
import { allTrees, siteInfo } from '../repo.js';
import { rankTrees, filterRanked, prioritySummary, methodDoc, WEIGHT_TOTAL } from '../priority.js';

/**
 * GET /api/priority — 優先保育名單
 *
 * 參數：limit（預設 50，0＝全部）、tier（S,A）、parish、species、q（樹號／樹種／地點關鍵字）
 * 回傳固定附上評分方法（weights／步驟／注意事項），讓前端與報告引用同一份說明，
 * 避免「畫面上的算法」與「報告寫的算法」兩套說法。
 */
export default handler(async (p) => {
  // limit：預設 50（名單是用來排序取前段，不是一次列 658 筆）；limit=0 或 all=1 代表全部
  const rawLimit = p.limit === undefined || p.limit === '' ? (p.all === '1' ? '0' : '50') : String(p.limit);
  const limit = Number(rawLimit);
  const trees = await allTrees();
  const rows = rankTrees(trees);
  const filtered = filterRanked(rows, {
    tier: p.tier || '',
    parish: p.parish || '',
    species: p.species || '',
    q: p.q || '',
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });
  return {
    ok: true,
    evaluated: rows.length,
    count: filtered.length,
    total: WEIGHT_TOTAL,
    summary: prioritySummary(rows),
    method: methodDoc(),
    items: filtered,
    source: siteInfo().data_source,
  };
}, 900);
