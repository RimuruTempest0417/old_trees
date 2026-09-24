import { handler } from '../http.js';
import { healthCheck, siteInfo } from '../repo.js';

/**
 * GET /api/health — 健康檢查（同時作為監測 Supabase 連線是否正常）
 */
export default handler(async () => {
  const hc = await healthCheck();
  return { ...hc, site: siteInfo() };
}, 0);
