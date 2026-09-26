import { handler } from '../http.js';
import { allTrees, siteInfo } from '../repo.js';
import { rankTrees, filterRanked, prioritySummary, methodDoc, WEIGHT_TOTAL } from '../priority.js';
import { actionPlan, actionsMethod } from '../actions.js';

/**
 * GET /api/priority — 優先保育名單
 *
 * 參數：limit（預設 50，0＝全部）、grade（官方分級，可逗號分隔）、health（官方健康狀況）、
 *       parish、species、q（樹號／樹種／地點關鍵字）
 *
 * 【分級鐵律】回傳不含任何自訂級別欄位；分級只有官方的 grade／health。
 * 回傳固定附上評分方法（weights／步驟／注意事項），讓前端與報告引用同一份說明，
 * 避免「畫面上的算法」與「報告寫的算法」兩套說法。
 */
export default handler(async (p) => {
  // limit：預設 50（名單是用來排序取前段，不是一次列 658 筆）；limit=0 或 all=1 代表全部
  const rawLimit = p.limit === undefined || p.limit === '' ? (p.all === '1' ? '0' : '50') : String(p.limit);
  const limit = Number(rawLimit);
  const trees = await allTrees();
  const rows = rankTrees(trees);
  // 行動建議（v0.16.0）：由官方資料推導的規則式清單，與名單用同一份排序結果
  const plan = actionPlan(trees, rows);
  if (p.all === 'actions' || p.actions === '1') {
    return {
      ok: true,
      evaluated: rows.length,
      actions: plan.actions,      // 含 members（完整成員清單）
      method: actionsMethod(),
      source: siteInfo().data_source,
    };
  }
  const filtered = filterRanked(rows, {
    grade: p.grade || '',
    health: p.health || '',
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
    // 一般請求只帶代表株（examples）；完整成員清單走 ?all=actions，避免頁面傳輸膨脹
    actions: plan.actions.map(({ members, ...rest }) => rest),
    actions_method: actionsMethod(),
    // 逐株建議：名單上的每一株都附上它的建議行動（前端與列印共用同一份）
    items: filtered.map((r) => ({ ...r, advice: plan.advice.get(String(r.tree_no)) || [] })),
    source: siteInfo().data_source,
  };
}, 900);
