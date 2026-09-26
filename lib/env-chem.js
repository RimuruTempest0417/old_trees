/**
 * 化學視角（F）的資料層：把官方環境監測數據與古樹資料接起來。
 *
 * 【誠實原則】本模組只做三件事：
 *   1. 忠實呈現官方公開數值（不換算、不內插、不平均，除官方自己算的平均值）。
 *   2. 把機制寫清楚（化學式與出處見 data/env_chem.json 的 materials）。
 *   3. 提供「區域背景值」對照 —— 那是**監測站的區域背景**，不是某一株古樹的實測值。
 *
 * 使用者指令（2026-09-25）：官方資料一律以官方為準、不得自創。因此本模組不產生任何
 * 未經官方公布的 pH／濃度數字；找不到官方值的項目（例如 2000 年後的降雨 pH）
 * 一律明說「本站未找到」。
 */
import { ENV_CHEM, ENV_CHEM_HASH } from '../data/env-chem-data.js';

export { ENV_CHEM_HASH };
export const DATA = ENV_CHEM;

/** 六個空氣監測站（官方現行名稱）。 */
export const STATIONS = ENV_CHEM.air.stations;

/** 污染物顯示順序與中文名。 */
export const POLLUTANTS = ENV_CHEM.air.display_order;

/** 有空氣質量指數日數資料的年份（目前只有官方最新一份年報）。 */
const AQI_YEAR = 2025;

/** 有年均濃度資料的年份（官方報告的數據資料表提供兩年對照）。 */
export const AIR_YEARS = Object.keys(ENV_CHEM.air.years).map(Number).sort();

/** 澳門堂區 → 地理區域（客觀分組，用於對照鄰近監測站）。 */
const REGION_OF_PARISH = {
  花地瑪堂區: '澳門半島', 花王堂區: '澳門半島', 望德堂區: '澳門半島', 大堂區: '澳門半島', 風順堂區: '澳門半島',
  嘉模堂區: '氹仔', 路氹填海區: '氹仔',
  聖方濟各堂區: '路環',
};

/** 各區域對應的官方監測站（依官方公布的裝置地點）。 */
const REGION_STATIONS = {
  澳門半島: ['荷蘭園站', '台山站'],
  氹仔: ['氹仔中心區站', '大潭山站'],
  路環: ['石排灣站', '九澳站'],
};

export function regionOf(parish) {
  return REGION_OF_PARISH[parish] || null;
}

function stationsOfRegion(region) {
  return REGION_STATIONS[region] || [];
}

const round = (v, d = 1) => (v === null || v === undefined ? null : Number(v.toFixed(d)));

/**
 * 區域空氣背景值：把該區域官方監測站的年均濃度取「官方平均」以外的逐站值並列，
 * 不做跨站平均（避免產生官方沒有公布的數字）。front-end 顯示時要標明是區域背景。
 */
export function regionBackground(parish, year = '2025') {
  const region = regionOf(parish);
  if (!region) return null;
  const y = String(year);
  const stations = stationsOfRegion(region).filter((s) => ENV_CHEM.air.years[y]);
  if (!stations.length) return null;
  const pollutants = {};
  for (const pol of POLLUTANTS) {
    const blk = ENV_CHEM.air.years[y][pol];
    if (!blk) continue;
    pollutants[pol] = {
      name: ENV_CHEM.air.pollutants[pol].name,
      unit: blk.unit || ENV_CHEM.air.pollutants[pol].unit,
      standard_annual: ENV_CHEM.air.pollutants[pol].standard_annual,
      by_station: Object.fromEntries(stations.filter((s) => blk.by_station[s] !== undefined)
        .map((s) => [s, blk.by_station[s]])),
    };
  }
  return { region, year: Number(y), stations, pollutants, note: REGION_NOTE };
}

const REGION_NOTE = '此為該區域官方監測站的空氣背景值，不是這一株古樹的實測值，也不代表該株的生長狀況。';

/** 概況：KPI 數字與達標比例（比例只用官方平均計算，四捨五入到整數百分比）。 */
export function overview(year = '2025') {
  const y = String(year);
  const yearData = ENV_CHEM.air.years[y];
  if (!yearData) return null;
  const kpis = POLLUTANTS.map((pol) => {
    const meta = ENV_CHEM.air.pollutants[pol];
    const mean = yearData[pol].mean;
    const std = meta.standard_annual;
    return {
      key: pol,
      label: meta.name,
      unit: meta.unit,
      mean,
      standard: std,
      pct_of_standard: std ? Math.round((mean / std) * 100) : null,
      compliant: std ? mean <= std : null,
      trend: AIR_YEARS.length === 2
        ? round(mean - ENV_CHEM.air.years[String(AIR_YEARS[0])][pol].mean, 2)
        : null,
    };
  });
  const aqi = aqiSummary();
  const totalDays = aqi.rows.length ? aqi.rows[0].total_days : null;
  return {
    year: Number(y),
    years: AIR_YEARS,
    stations: STATIONS,
    kpis,
    aqi,
    total_days: totalDays,
    source: ENV_CHEM.air.source,
    standards_note: ENV_CHEM.air.standards_note,
    station_meta: ENV_CHEM.air.station_meta,
    rename_note: ENV_CHEM.air.rename_note,
  };
}

/** 各站 × 污染物矩陣（給圖表用）。 */
export function stationMatrix(pollutant, year = '2025') {
  const y = String(year);
  const blk = ENV_CHEM.air.years[y] && ENV_CHEM.air.years[y][pollutant];
  if (!blk) return null;
  const meta = ENV_CHEM.air.pollutants[pollutant];
  return {
    pollutant,
    name: meta.name,
    unit: meta.unit,
    standard: meta.standard_annual,
    year: Number(y),
    mean: blk.mean,
    rows: STATIONS.map((s) => ({
      station: s,
      character: ENV_CHEM.air.station_meta[s] ? ENV_CHEM.air.station_meta[s].character : '',
      value: blk.by_station[s] === undefined ? null : blk.by_station[s],
    })),
  };
}

/** 2025 年各站空氣質量水平日數（含官方最高指數與沙塵事件）。 */
export function aqiSummary() {
  const a = ENV_CHEM.aqi;
  const levels = ['良好', '普通', '不良', '非常不良', '嚴重'];
  const rows = STATIONS.map((s) => {
    const days = a.daily[s] || {};
    const total = levels.reduce((acc, l) => acc + (days[l] || 0), 0);
    const good = (days['良好'] || 0) + (days['普通'] || 0);
    return {
      station: s,
      days,
      total_days: total,
      good_or_fair: good,
      good_or_fair_pct: total ? Math.round((good / total) * 1000) / 10 : null,
      highest: a.highest[s] || null,
    };
  });
  return {
    year: AQI_YEAR,
    levels,
    rows,
    events: a.events,
    source: a.source,
    history: a['history_荷蘭園站'],
    history_note: a.history_note,
    history_caveat: a.history_caveat,
  };
}

/** 降雨酸鹼度（官方歷史監測；沒有近年官方值時明說）。 */
export function acidRain() {
  return ENV_CHEM.acid_rain;
}

/** 土壤／水泥／機制的可查證文獻。 */
export function mechanisms() {
  return ENV_CHEM.materials;
}

/**
 * 來源索引（id → 來源）：把「機制文獻」與「酸雨來源」兩份清單合成一份，
 * 機制卡片才能只寫 id 就找到出處。前端與測試共用同一份，避免兩邊各建一次而漏掉。
 */
export function sourceIndex() {
  const out = {};
  for (const r of ENV_CHEM.materials.references || []) out[r.id] = r;
  for (const s of ENV_CHEM.acid_rain.sources || []) if (s.id) out[s.id] = s;
  return out;
}

/** 古樹健康狀況 × 區域空污背景：只做並列對照，不做因果推論。 */
export function healthByRegion(trees) {
  const out = {};
  for (const t of trees || []) {
    const region = regionOf(t.parish);
    if (!region) continue;
    if (!out[region]) out[region] = { region, total: 0, health: {}, stations: stationsOfRegion(region), _age_sum: 0, _age_n: 0 };
    out[region].total += 1;
    // 一併累計樹齡：區域之間樹齡差很多（半島老樹多），並列出來才看得見這個干擾因素
    const age = Number(t.age_years);
    if (Number.isFinite(age)) { out[region]._age_sum += age; out[region]._age_n += 1; }
    const h = t.health || '未載';
    out[region].health[h] = (out[region].health[h] || 0) + 1;
  }
  for (const region of Object.keys(out)) {
    const stations = out[region].stations;
    const pol = {};
    for (const key of ['PM2.5', 'NO2']) {
      const blk = ENV_CHEM.air.years['2025'][key];
      pol[key] = stations.filter((s) => blk.by_station[s] !== undefined).map((s) => ({ station: s, value: blk.by_station[s] }));
    }
    out[region].background = pol;
    out[region].avg_age = out[region]._age_n ? Math.round((out[region]._age_sum / out[region]._age_n) * 10) / 10 : null;
    delete out[region]._age_sum;
    delete out[region]._age_n;
  }
  return { regions: Object.values(out).sort((a, b) => b.total - a.total), caveat: CAUSAL_CAVEAT };
}

const CAUSAL_CAVEAT = '同一張圖上並列的是①官方監測站的區域空污背景②該區域古樹的官方健康狀況。兩者相關不等於因果：'
  + '古樹健康受樹齡、樹種、立地條件（鋪面、土壤體積、工程擾動）、病蟲害與颱風等多重因素影響，'
  + '本平台未做實地採樣或土壤化驗，因此只呈現背景對照，不作因果結論。';

/** 給前端一次取齊的完整文件（也讓測試能斷言契約）。 */
export function doc() {
  return {
    hash: ENV_CHEM_HASH,
    air: ENV_CHEM.air,
    overview: overview('2025'),
    acid_rain: acidRain(),
    materials: mechanisms(),
    sources: sourceIndex(),
    note: ENV_CHEM._note,
    causal_caveat: CAUSAL_CAVEAT,
    region_note: REGION_NOTE,
  };
}
