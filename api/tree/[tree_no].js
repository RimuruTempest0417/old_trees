import { handler, clientError } from '../../lib/http.js';
import { getTree, getNeighbours, siteInfo } from '../../lib/repo.js';

/**
 * GET /api/tree/:tree_no — 單株古樹詳情（含同地點鄰居）
 */
export default handler(async (p, req) => {
  const raw = p.tree_no
    || new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean).pop() || '';
  // 古樹編號只允許英數字與連字號；其他輸入一律不原樣回顯（避免反射式注入與資訊洩漏）
  if (!/^[0-9A-Za-z_-]{1,24}$/.test(String(raw))) {
    throw clientError(400, '查詢參數格式不正確：古樹編號應為 1–24 位英數字。');
  }
  const treeNo = String(raw);
  const tree = await getTree(treeNo);
  if (!tree) throw clientError(404, '找不到符合的古樹編號。');
  const neighbours = await getNeighbours(treeNo, 8);
  return { tree, neighbours, source: siteInfo().data_source };
}, 600);
