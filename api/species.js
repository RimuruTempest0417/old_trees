import { handler } from '../lib/http.js';
import { speciesRanking, allSpecies, siteInfo } from '../lib/repo.js';

/**
 * GET /api/species — 品種清單與排行（含相片、學名、棲地統計）
 */
export default handler(async (p) => {
  const limit = Math.min(Math.max(Number(p.limit) || 60, 1), 200);
  const [ranking, all] = await Promise.all([speciesRanking(limit), allSpecies()]);
  const metaMap = new Map(all.map((s) => [s.name_zh, s]));
  const rows = ranking.map((r) => {
    const m = metaMap.get(r.species) || {};
    return {
      ...r,
      name_sci: r.name_sci || m.name_sci || null,
      wikidata: m.wikidata_id || null,
      photo_url: r.photo_url || m.photo_url || null,
      photo_credit: r.photo_credit || m.photo_credit || null,
      photo_license: r.photo_license || m.photo_license || null,
      photo_page: m.photo_page || null,
      description: m.description || null,
    };
  });
  return {
    count: rows.length,
    total_species: all.filter((s) => s.name_zh).length,
    rows,
    source: siteInfo().data_source,
  };
}, 900);
