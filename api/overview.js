import { handler } from '../lib/http.js';
import { overview, parishStats, speciesRanking, allTrees, siteInfo } from '../lib/repo.js';

/**
 * GET /api/overview
 * 首頁總覽：整體統計、各堂區分佈、品種排行、健康與分級結構、最老古樹、資料來源。
 */
export default handler(async () => {
  const [o, parishes, species, trees] = await Promise.all([
    overview(), parishStats(), speciesRanking(20), allTrees(),
  ]);
  const oldest = [...trees].sort((a, b) => b.age_years - a.age_years).slice(0, 10);
  const tallest = [...trees].sort((a, b) => b.height_m - a.height_m).slice(0, 5);
  const endangered = trees.filter((t) => t.health === '瀕危')
    .sort((a, b) => b.age_years - a.age_years).slice(0, 10);
  return {
    site: siteInfo(),
    overview: o,
    parishes,
    species,
    oldest,
    tallest,
    endangered,
    grade_distribution: [
      { name: '一級（≥500年）', value: o.grade1 },
      { name: '二級（300–499年）', value: o.grade2 },
      { name: '三級（100–299年）', value: o.grade3 },
      { name: '不分級／名木', value: o.grade_other },
    ],
    health_distribution: [
      { name: '健康', value: o.good },
      { name: '一般', value: o.fair },
      { name: '瀕危', value: o.endangered },
    ],
  };
}, 600);
