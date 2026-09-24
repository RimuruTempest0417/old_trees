import { handler } from '../http.js';
import { listRoutes, siteInfo } from '../repo.js';

/**
 * GET /api/routes — 精選路綫清單
 */
export default handler(async () => {
  const routes = await listRoutes();
  return {
    count: routes.length,
    routes: routes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((r) => ({
      code: r.code, name: r.name_zh, summary: r.summary,
      parish_codes: r.parish_codes || [], site_count: (r.site_names || []).length,
      species_focus: r.species_focus, max_stops: r.max_stops, tips: r.tips,
    })),
    source: siteInfo().data_source,
  };
}, 900);
