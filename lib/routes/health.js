import { handler } from '../http.js';
import { healthCheck, siteInfo, API_VERSION } from '../repo.js';

/**
 * GET /api/health — 健康檢查（同時作為監測 Supabase 連線是否正常）
 */
export default handler(async () => {
  const hc = await healthCheck();
  return { ...hc, version: API_VERSION, site: siteInfo() };
}, 0);   // 不快取：使用者執行完 init.sql 重新整理時，必須立刻看到最新結果
