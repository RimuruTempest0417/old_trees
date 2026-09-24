import { handler } from '../lib/http.js';
import { findTrees, siteInfo } from '../lib/repo.js';

/**
 * GET /api/trees — 地圖查詢
 * 參數：parish, species, grade, health, min_age, max_age, keyword,
 *       min_lat, max_lat, min_lon, max_lon, lat, lon, radius_m, limit, offset
 */
export default handler(async (p) => {
  const { rows, total, limit, offset } = await findTrees(p);
  const summary = rows.reduce((acc, r) => {
    acc.by_parish[r.parish] = (acc.by_parish[r.parish] || 0) + 1;
    acc.by_health[r.health] = (acc.by_health[r.health] || 0) + 1;
    acc.by_species[r.species] = (acc.by_species[r.species] || 0) + 1;
    return acc;
  }, { by_parish: {}, by_health: {}, by_species: {} });
  const noCoord = rows.filter((r) => r.lat == null || r.lon == null).length;
  return {
    count: rows.length,
    total,
    limit,
    offset,
    has_more: offset + rows.length < total,
    missing_coordinates: noCoord,
    summary,
    source: siteInfo().data_source,
    trees: rows,
  };
}, 300);
