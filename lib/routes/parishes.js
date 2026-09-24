import { handler } from '../http.js';
import { parishStats, allParishes, siteInfo } from '../repo.js';

/**
 * GET /api/parishes — 各堂區古樹數目分佈（資訊任務 1）
 * 附帶：面積、密度、平均樹齡、健康結構、品種數
 */
export default handler(async () => {
  const [stats, parishes] = await Promise.all([parishStats(), allParishes()]);
  const total = stats.reduce((s, r) => s + r.tree_count, 0);
  const metaMap = new Map(parishes.map((p) => [p.code, p]));
  const rows = stats.map((r) => ({
    ...r,
    name_zh: metaMap.get(r.parish)?.name_zh || r.parish,
    note: metaMap.get(r.parish)?.note || null,
    centroid_lat: metaMap.get(r.parish)?.centroid_lat ?? null,
    centroid_lon: metaMap.get(r.parish)?.centroid_lon ?? null,
    share_pct: total ? +(100 * r.tree_count / total).toFixed(1) : 0,
    endangered_pct: r.tree_count ? +(100 * r.health_endangered / r.tree_count).toFixed(1) : 0,
  }));
  const rank = [...rows].sort((a, b) => b.density_per_km2 - a.density_per_km2)
    .map((r, i) => ({ rank: i + 1, parish: r.parish, density_per_km2: r.density_per_km2 }));
  return {
    total,
    parish_count: rows.length,
    rows,
    density_ranking: rank,
    source: siteInfo().data_source,
  };
}, 600);
