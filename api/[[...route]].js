/**
 * 全站唯一的 Vercel Serverless Function。
 *
 * `api/[[...route]].js` 是可選的「萬用路徑」（catch-all）：
 *   /api/health、/api/trees、/api/tree/66、/api/field-records … 全部由這一個檔案處理，
 *   再交給 lib/router.js 分派到 lib/routes/*.js 的 handler。
 *
 * 這樣做的原因：Vercel Hobby 方案限制每個 Deployment 最多 12 個 Serverless Function，
 * 而 api/ 底下每個 .js 都是一個 function（原本 12 個端點 ＋ 1 個動態路由 = 13 個 → 建置失敗）。
 * lib/ 底下的檔案不算 function，所以把 handler 全部搬到 lib/routes/。
 */
import { dispatch, notFound } from '../lib/router.js';

export default async function entry(req, res) {
  // Vercel 會把 catch-all 的段落放在 req.query.route（例如 /api/tree/66 → ['tree','66']）；
  // 直接解析 req.url 也一樣，兩者取其一即可，這裡以 req.url 為準（本機測試亦同）。
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  const handled = await dispatch(req, res, pathname);
  if (!handled && !res.writableEnded) notFound(res, pathname);
}
