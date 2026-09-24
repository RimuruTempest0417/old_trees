import { handler, clientError } from '../lib/http.js';
import { getRoute, findTrees, allTrees, siteInfo } from '../lib/repo.js';
import { solveRoute, walkEstimate, clusterStops, priorityScore, bearingLabel, haversine } from '../lib/geo.js';

/**
 * GET /api/route — 路綫推薦引擎
 *
 * 兩種模式：
 *  1) ?code=<路綫代碼>  使用資料庫中的精選路綫（routes 表）之候選地點
 *  2) 自訂查詢：?parish=風順堂區&species=榕樹&max_stops=8&theme=oldest|health|species
 *
 * 回傳：停靠次序、每段距離與方位、總距離、步行與停留時間估計、GeoJSON 折線、沿綫古樹統計。
 * 演算法：優先度排序 → 分群（120 公尺內合併為同一停靠點）→ 最近鄰法 → 2-opt 改良。
 */
export default handler(async (p) => {
  const maxStops = Math.min(Math.max(Number(p.max_stops) || 10, 2), 30);
  const theme = p.theme || 'balanced';

  let candidates = [];
  let routeMeta = null;

  if (p.code) {
    routeMeta = await getRoute(p.code);
    if (!routeMeta) throw clientError(404, '找不到指定的路綫代碼。');
    const sites = routeMeta.site_names || [];
    const parishes = routeMeta.parish_codes || [];
    if (p.code === 'oldest-trees' || sites.length === 0) {
      // 「最老古樹巡禮」：直接取全澳樹齡最高的個體
      candidates = [...(await allTrees())]
        .sort((a, b) => b.age_years - a.age_years)
        .slice(0, maxStops * 3);
    } else {
      for (const s of sites) {
        const { rows } = await findTrees({ keyword: s, limit: 60 });
        candidates.push(...rows.filter((r) => r.site === s || r.site.includes(s) || s.includes(r.site)));
      }
      if (!candidates.length && parishes.length) {
        for (const par of parishes) {
          const { rows } = await findTrees({ parish: par, limit: 200 });
          candidates.push(...rows);
        }
      }
    }
  } else {
    const { rows } = await findTrees({
      parish: p.parish || undefined, species: p.species || undefined,
      grade: p.grade || undefined, health: p.health || undefined,
      keyword: p.keyword || undefined, limit: 800,
    });
    candidates = rows;
  }

  // 去重
  const seen = new Set();
  candidates = candidates.filter((c) => {
    if (!c || c.lat == null || c.lon == null) return false;
    if (seen.has(c.tree_no)) return false;
    seen.add(c.tree_no);
    return true;
  });
  if (!candidates.length) {
    return { route: null, message: '沒有符合條件的古樹，請調整篩選條件。', stops: [], legs: [] };
  }

  // 優先度排序（依主題調整）
  const speciesCounts = candidates.reduce((m, c) => {
    m[c.species] = (m[c.species] || 0) + 1;
    return m;
  }, {});
  const scored = candidates.map((c) => {
    let score = priorityScore(c, { speciesCount: speciesCounts[c.species] });
    if (theme === 'oldest') score = 0.9 * Math.min(c.age_years / 520, 1) + 0.1 * score;
    if (theme === 'health') score = 0.9 * ({ 瀕危: 1, 一般: 0.5, 健康: 0.1 }[c.health] || 0) + 0.1 * score;
    if (theme === 'species') score = 0.7 * (1 / Math.sqrt(Math.max(1, speciesCounts[c.species]))) + 0.3 * score;
    return { ...c, _score: score };
  }).sort((a, b) => b._score - a._score);

  // 取前 N 個，再分群為停靠點
  const picked = scored.slice(0, Math.max(maxStops * 6, maxStops));
  const clusters = clusterStops(picked, 150)
    .sort((a, b) => {
      const sa = Math.max(...a.trees.map((t) => t._score || 0));
      const sb = Math.max(...b.trees.map((t) => t._score || 0));
      return sb - sa;
    })
    .slice(0, maxStops);

  const points = clusters.map((c, i) => ({
    id: i + 1, lat: c.lat, lon: c.lon,
    trees: c.trees.sort((a, b) => b.age_years - a.age_years),
    anchor: c.trees[0],
  }));

  const solved = solveRoute(points, {});
  const ordered = solved.order.map((i) => points[i]);
  const estimate = walkEstimate(solved.distance_m, ordered.length, {
    speedKmh: Number(p.speed_kmh) || 4.2,
    dwellSec: Number(p.dwell_sec) || 180,
  });

  const stops = ordered.map((s, i) => {
    const legs = solved.legs[i - 1];
    return {
      order: i + 1, lat: s.lat, lon: s.lon,
      site: s.anchor.site, parish: s.anchor.parish,
      tree_count: s.trees.length,
      trees: s.trees.slice(0, 12).map((t) => ({
        tree_no: t.tree_no, species: t.species, age_years: t.age_years,
        height_m: t.height_m, health: t.health, grade: t.grade,
        species_photo: t.species_photo || null, lat: t.lat, lon: t.lon,
      })),
      oldest: s.trees[0].age_years,
      species_here: [...new Set(s.trees.map((t) => t.species))],
      leg_from_previous_m: legs ? legs.distance_m : null,
      bearing_from_previous: legs ? Math.round(legs.bearing) : null,
      bearing_label: legs ? bearingLabel(legs.bearing) : null,
    };
  });

  // GeoJSON 折線（供前端直接畫線）
  const geojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: ordered.map((s) => [+s.lon.toFixed(6), +s.lat.toFixed(6)]) },
    properties: { name: routeMeta ? routeMeta.name_zh : '自訂路綫', stops: ordered.length,
      distance_m: solved.distance_m },
  };

  const allStops = stops.flatMap((s) => s.trees);
  const statistics = {
    stops: stops.length,
    trees_covered: stops.reduce((n, s) => n + s.tree_count, 0),
    species_count: new Set(allStops.map((t) => t.species)).size,
    oldest_age: Math.max(...allStops.map((t) => t.age_years)),
    avg_age: +(allStops.reduce((n, t) => n + t.age_years, 0) / allStops.length).toFixed(1),
    endangered: allStops.filter((t) => t.health === '瀕危').length,
    status_breakdown: allStops.reduce((m, t) => {
      m[t.health] = (m[t.health] || 0) + 1; return m;
    }, {}),
    span_m: Math.round(Math.max(...ordered.map((a) => Math.max(...ordered.map(
      (b) => haversine(a.lat, a.lon, b.lat, b.lon))))))
  };

  return {
    route: routeMeta ? {
      code: routeMeta.code, name: routeMeta.name_zh, summary: routeMeta.summary,
      tips: routeMeta.tips, species_focus: routeMeta.species_focus,
    } : {
      code: 'custom', name: `自訂路綫（${p.parish || '全澳'}${p.species ? `／${p.species}` : ''}）`,
      summary: '依你選擇的條件即時生成的路綫', tips: '按實際路況調整，注意行人與車輛。',
    },
    algorithm: {
      method: '優先度排序 → 空間分群 → 最近鄰法（nearest neighbour）→ 2-opt 改良',
      candidates_considered: candidates.length,
      clusters: clusters.length,
      stops_selected: stops.length,
      matrix_iterations: solved.iterations,
      objective: '最小化總步行距離（公尺）',
      theme,
    },
    estimate,
    statistics,
    stops,
    legs: solved.legs,
    total_distance_m: solved.distance_m,
    geojson,
    source: siteInfo().data_source,
  };
}, 300);
