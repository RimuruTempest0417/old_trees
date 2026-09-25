import { handler, clientError } from '../http.js';
import { allTrees } from '../repo.js';
import {
  doc, overview, stationMatrix, aqiSummary, acidRain, mechanisms,
  regionBackground, healthByRegion, POLLUTANTS, STATIONS, ENV_CHEM_HASH, AIR_YEARS,
} from '../env-chem.js';

/**
 * GET /api/env-chem — 化學視角（作業要求 F）的官方環境數據
 *
 * 參數：
 *   year    年均濃度年份（預設官方最新，目前 2025）
 *   block   all（預設）／overview／air／acid／materials／aqi
 *   matrix  指定污染物（PM10／PM2.5／NO2／O3／SO2／CO）→ 回該污染物各站數值
 *   region  堂區名稱 → 回該堂區所屬區域的「官方監測站背景值」（不是該株實測）
 *   trees   1 → 附加「區域 × 古樹官方健康狀況」對照（含相關不等於因果的說明）
 *
 * 【鐵律】所有數值都來自官方公開文件（見 data/env_chem.json 的 source 欄位），
 * 不換算、不內插、不自行平均；找不到官方值就回 null 並說明原因。
 */
export default handler(async (p) => {
  const year = p.year ? String(p.year) : '2025';
  const block = (p.block || 'all').toLowerCase();
  const ov = overview(year);
  if (!ov) {
    throw clientError(400, `沒有 ${year} 年的官方年均濃度資料（官方報告提供 ${AIR_YEARS.join('、')} 年）`);
  }

  if (block === 'overview') return { ok: true, hash: ENV_CHEM_HASH, year: Number(year), overview: ov };
  if (block === 'air') return { ok: true, hash: ENV_CHEM_HASH, year: Number(year), air: ov };
  if (block === 'aqi') return { ok: true, hash: ENV_CHEM_HASH, aqi: aqiSummary() };
  if (block === 'acid') return { ok: true, hash: ENV_CHEM_HASH, acid_rain: acidRain() };
  if (block === 'materials') return { ok: true, hash: ENV_CHEM_HASH, materials: mechanisms() };

  const out = { ok: true, hash: ENV_CHEM_HASH, doc: doc() };

  if (p.matrix) {
    const pol = String(p.matrix).toUpperCase();
    if (!POLLUTANTS.includes(pol)) {
      throw clientError(400, `matrix 只接受 ${POLLUTANTS.join('／')}`);
    }
    out.matrix = stationMatrix(pol, year);
  }

  if (p.region) {
    const bg = regionBackground(String(p.region), year);
    if (!bg) throw clientError(404, `找不到「${p.region}」對應的區域或監測站`);
    out.region = bg;
  }

  if (p.trees === '1' || p.trees === 'true') {
    const trees = await allTrees();
    out.health_by_region = healthByRegion(trees);
    out.tree_count = trees.length;
  }

  out.stations = STATIONS;
  return out;
});
