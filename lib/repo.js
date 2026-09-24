/**
 * 資料存取層（Repository）
 *
 * 兩種驅動：
 *   1. supabase — 正式環境。使用 @supabase/supabase-js 連到 Supabase (PostgreSQL)，
 *      聚合運算走資料庫端的 SQL 函式（rpc_*）與檢視表（v_*），前端不直接接觸資料庫。
 *   2. snapshot — 本機開發／示範模式。未設定 SUPABASE_URL 時，改讀 data/snapshot.js
 *      （由 supabase/seed.sql 同一份資料衍生），令網站可離線展示，並在介面上明示資料來源。
 *
 * 兩種驅動對外回傳的欄位名稱完全一致，前端無需分辨。
 */
import { createClient } from '@supabase/supabase-js';
import snapshot from '../data/snapshot.js';
import { mean, median, sd, variance, histogram, quantile } from './analysis.js';

const RAW_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const RAW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_KEY;

/**
 * 判斷環境變數是否為「真的已設定」的資料庫連線。
 * 複製 .env.example 卻忘了換成自己的專案時，URL 會是 https://xxxxxxxxxxxx.supabase.co
 * 這種佔位符；此時若當成已設定，每個 API 都會先等 DNS 逾時再回 500，頁面形同全站壞掉。
 * 佔位符／非 https／非法 URL 一律視為未設定，直接走內建快照。
 */
function isRealConfig(url, key) {
  if (!url || !key) return false;
  if (/x{6,}|placeholder|example\.(com|org|net)|your[-_]?(project|supabase|key)|changeme/i.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

const SUPABASE_URL = isRealConfig(RAW_URL, RAW_KEY) ? RAW_URL : null;
const SUPABASE_KEY = SUPABASE_URL ? RAW_KEY : null;

export const DATA_SOURCE = SUPABASE_URL && SUPABASE_KEY ? 'supabase' : 'snapshot';

let client = null;
if (DATA_SOURCE === 'supabase') {
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'macau-heritage-trees' } },
  });
}

function sb() {
  if (!client) throw new Error('Supabase 未設定：請設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  return client;
}

async function must({ data, error }) {
  if (error) throw new Error(`Supabase 查詢失敗：${error.message}${error.hint ? ` (${error.hint})` : ''}`);
  return data;
}

const num = (v) => (v == null ? null : typeof v === 'number' ? v : Number(v));

/** 安全地把外部輸入轉成有限數字；非數字／空白一律視為「未提供」 */
function toNumber(value, { min = null, max = null } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min !== null) return Math.max(n, min);
  if (max !== null) return Math.min(n, max);
  return n;
}

/** 只在白名單內才回傳，否則視為未提供（避免任意字串進入查詢） */
function pick(value, allowed) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value);
  return allowed.includes(s) ? s : null;
}

// ─────────────────────────────────────────────────────────────
// 站點資訊
// ─────────────────────────────────────────────────────────────
export function siteInfo() {
  return {
    data_source: DATA_SOURCE,
    dataset: snapshot.generated_from || '澳門古樹名錄',
    counts: {
      trees: snapshot.trees.length,
      sites: snapshot.sites.length,
      species: snapshot.species.filter((s) => s.name_zh).length,
      parishes: snapshot.parishes.length,
    },
    note: DATA_SOURCE === 'supabase'
      ? '資料即時來自 Supabase PostgreSQL（伺服器端查詢，金鑰僅存在於部署環境變數）。'
      : '示範模式：未設定資料庫連線環境變數（或仍為 .env.example 的範例佔位符），改讀內建資料快照（與 supabase/seed.sql 同源）。',
  };
}

// ─────────────────────────────────────────────────────────────
// 堂區統計（任務：各堂區古樹數目分佈圖）
// ─────────────────────────────────────────────────────────────
export async function parishStats() {
  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().from('v_parish_stats').select('*').order('tree_count', { ascending: false }));
    return rows.map(normalizeParishRow);
  }
  const byParish = new Map();
  for (const t of snapshot.trees) {
    if (!byParish.has(t.parish)) byParish.set(t.parish, []);
    byParish.get(t.parish).push(t);
  }
  const rows = snapshot.parishes.map((p) => {
    const list = byParish.get(p.code) || [];
    const ages = list.map((t) => t.age_years);
    const heights = list.map((t) => t.height_m);
    return {
      parish: p.code, name_pt: p.name_pt, area_km2: p.area_km2,
      tree_count: list.length,
      grade1: list.filter((t) => t.grade === '一級').length,
      grade2: list.filter((t) => t.grade === '二級').length,
      grade3: list.filter((t) => t.grade === '三級').length,
      grade_other: list.filter((t) => t.grade === '不分級').length,
      health_good: list.filter((t) => t.health === '健康').length,
      health_fair: list.filter((t) => t.health === '一般').length,
      health_endangered: list.filter((t) => t.health === '瀕危').length,
      avg_age: ages.length ? +mean(ages).toFixed(1) : 0,
      max_age: ages.length ? Math.max(...ages) : 0,
      avg_height: heights.length ? +mean(heights).toFixed(2) : 0,
      site_count: new Set(list.map((t) => t.site)).size,
      species_count: new Set(list.map((t) => t.species)).size,
      density_per_km2: p.area_km2 > 0 ? +(list.length / p.area_km2).toFixed(1) : null,
    };
  });
  return rows.sort((a, b) => b.tree_count - a.tree_count).map(normalizeParishRow);
}

function normalizeParishRow(r) {
  const out = { ...r };
  for (const k of ['tree_count', 'grade1', 'grade2', 'grade3', 'grade_other', 'health_good',
    'health_fair', 'health_endangered', 'max_age', 'site_count', 'species_count']) {
    out[k] = num(out[k]) ?? 0;
  }
  for (const k of ['avg_age', 'avg_height', 'area_km2', 'density_per_km2']) out[k] = num(out[k]);
  return out;
}

// ─────────────────────────────────────────────────────────────
// 總覽
// ─────────────────────────────────────────────────────────────
export async function overview() {
  if (DATA_SOURCE === 'supabase') {
    const data = await must(await sb().rpc('rpc_overview'));
    const o = Array.isArray(data) ? data[0] : data;
    const out = {};
    for (const [k, v] of Object.entries(o || {})) out[k] = num(v);
    return out;
  }
  const t = snapshot.trees;
  const ages = t.map((x) => x.age_years);
  const heights = t.map((x) => x.height_m);
  return {
    tree_count: t.length,
    species_count: new Set(t.map((x) => x.species)).size,
    site_count: new Set(t.map((x) => x.site)).size,
    parish_count: new Set(t.map((x) => x.parish)).size,
    max_age: Math.max(...ages),
    avg_age: +mean(ages).toFixed(1),
    avg_height: +mean(heights).toFixed(2),
    endangered: t.filter((x) => x.health === '瀕危').length,
    fair: t.filter((x) => x.health === '一般').length,
    good: t.filter((x) => x.health === '健康').length,
    grade1: t.filter((x) => x.grade === '一級').length,
    grade2: t.filter((x) => x.grade === '二級').length,
    grade3: t.filter((x) => x.grade === '三級').length,
    grade_other: t.filter((x) => x.grade === '不分級').length,
    attention_pct: +((100 * t.filter((x) => x.health !== '健康').length) / t.length).toFixed(1),
  };
}

// ─────────────────────────────────────────────────────────────
// 品種
// ─────────────────────────────────────────────────────────────
export async function speciesRanking(limit = 15) {
  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().rpc('rpc_species_ranking', { p_limit: limit }));
    return rows.map(normalizeSpeciesRow);
  }
  const bySpecies = new Map();
  for (const t of snapshot.trees) {
    if (!bySpecies.has(t.species)) bySpecies.set(t.species, []);
    bySpecies.get(t.species).push(t);
  }
  const meta = new Map(snapshot.species.map((s) => [s.name_zh, s]));
  const rows = [...bySpecies.entries()].map(([name, list]) => {
    const m = meta.get(name) || {};
    const ages = list.map((t) => t.age_years);
    const heights = list.map((t) => t.height_m);
    return {
      species: name, name_sci: m.name_sci || m.scientific || null, photo_url: m.photo_url || null,
      photo_credit: m.photo_credit || null, photo_license: m.photo_license || null,
      tree_count: list.length,
      avg_age: +mean(ages).toFixed(1), max_age: Math.max(...ages),
      avg_height: +mean(heights).toFixed(2),
      sd_height: +sd(heights).toFixed(2), sd_age: +sd(ages).toFixed(1),
      endangered: list.filter((t) => t.health === '瀕危').length,
      parish_count: new Set(list.map((t) => t.parish)).size,
    };
  });
  return rows.sort((a, b) => b.tree_count - a.tree_count || b.avg_age - a.avg_age)
    .slice(0, limit).map(normalizeSpeciesRow);
}

function normalizeSpeciesRow(r) {
  const out = { ...r };
  for (const k of ['tree_count', 'max_age', 'endangered', 'parish_count']) out[k] = num(out[k]) ?? 0;
  for (const k of ['avg_age', 'avg_height', 'sd_height', 'sd_age']) out[k] = num(out[k]);
  return out;
}

export async function allSpecies() {
  if (DATA_SOURCE === 'supabase') {
    return await must(await sb().from('species').select('*').order('name_zh'));
  }
  return snapshot.species;
}

export async function allParishes() {
  if (DATA_SOURCE === 'supabase') {
    return await must(await sb().from('parishes').select('*').order('code'));
  }
  return snapshot.parishes;
}

// ─────────────────────────────────────────────────────────────
// 古樹查詢（地圖查詢）
// ─────────────────────────────────────────────────────────────
export async function findTrees(f = {}) {
  const limit = toNumber(f.limit, { min: 1 }) === null ? 500 : Math.min(Math.max(toNumber(f.limit, { min: 1 }), 1), 2000);
  const offset = toNumber(f.offset, { min: 0 }) ?? 0;
  // 數值參數一律經過有限數字檢查；非數字輸入視為未提供
  const filters = {
    parish: f.parish ? String(f.parish).slice(0, 60) : null,
    species: f.species ? String(f.species).slice(0, 60) : null,
    grade: pick(f.grade, ['一級', '二級', '三級', '不分級']),
    health: pick(f.health, ['健康', '一般', '瀕危']),
    keyword: f.keyword ? String(f.keyword).slice(0, 120) : null,
    min_age: toNumber(f.min_age, { min: 0 }),
    max_age: toNumber(f.max_age, { min: 0 }),
    min_lat: toNumber(f.min_lat), max_lat: toNumber(f.max_lat),
    min_lon: toNumber(f.min_lon), max_lon: toNumber(f.max_lon),
    lat: toNumber(f.lat), lon: toNumber(f.lon),
    radius_m: toNumber(f.radius_m, { min: 0 }),
  };

  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().rpc('rpc_find_trees', {
      p_parish: filters.parish,
      p_species: filters.species,
      p_grade: filters.grade,
      p_health: filters.health,
      p_min_age: filters.min_age,
      p_max_age: filters.max_age,
      p_keyword: filters.keyword,
      p_min_lat: filters.min_lat,
      p_max_lat: filters.max_lat,
      p_min_lon: filters.min_lon,
      p_max_lon: filters.max_lon,
      p_lat: filters.lat,
      p_lon: filters.lon,
      p_radius_m: filters.radius_m,
      p_limit: limit,
      p_offset: offset,
    }));
    return { rows: rows.map(normalizeTreeRow), total: rows.length, limit, offset };
  }
  const kw = (filters.keyword || '').trim();
  let rows = snapshot.trees.filter((t) => {
    if (filters.parish && t.parish !== filters.parish) return false;
    if (filters.species && t.species !== filters.species) return false;
    if (filters.grade && t.grade !== filters.grade) return false;
    if (filters.health && t.health !== filters.health) return false;
    if (filters.min_age !== null && t.age_years < filters.min_age) return false;
    if (filters.max_age !== null && t.age_years > filters.max_age) return false;
    if (filters.min_lat !== null && t.lat != null && t.lat < filters.min_lat) return false;
    if (filters.max_lat !== null && t.lat != null && t.lat > filters.max_lat) return false;
    if (filters.min_lon !== null && t.lon != null && t.lon < filters.min_lon) return false;
    if (filters.max_lon !== null && t.lon != null && t.lon > filters.max_lon) return false;
    if (kw) {
      const hay = `${t.tree_no}${t.species}${t.site}${t.parish}`
        + `${t.official_loc || ''}${t.iam_tree_no || ''}`;
      if (!hay.includes(kw)) return false;
    }
    if (filters.radius_m !== null && filters.lat !== null && filters.lon !== null && t.lat != null) {
      const R = 6371008.8, r = Math.PI / 180;
      const dLat = (t.lat - filters.lat) * r, dLon = (t.lon - filters.lon) * r;
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(filters.lat * r) * Math.cos(t.lat * r) * Math.sin(dLon / 2) ** 2;
      if (2 * R * Math.asin(Math.sqrt(a)) > filters.radius_m) return false;
    }
    return true;
  });
  rows = rows.sort((a, b) => b.age_years - a.age_years || a.tree_no.localeCompare(b.tree_no));
  return {
    rows: rows.slice(offset, offset + limit).map((t) => normalizeTreeRow(enrich(t))),
    total: rows.length, limit, offset,
  };
}

export function enrich(t) {
  const sp = snapshot.species.find((s) => s.name_zh === t.species) || {};
  const st = snapshot.sites.find((s) => s.name_zh === t.site) || {};
  return {
    tree_no: t.tree_no, grade: t.grade, age_years: t.age_years, height_m: t.height_m,
    health: t.health, lat: t.lat, lon: t.lon, parish: t.parish,
    species: t.species, name_sci: sp.name_sci || sp.scientific || null,
    species_photo: sp.photo_url || null, species_photo_credit: sp.photo_credit || null,
    species_photo_page: sp.photo_page || null,
    site: t.site, site_short: t.site_short || st.short_name || null,
    geo_precision: t.geo_precision || st.geo_precision || null,
    site_photo: st.photo_url || null,
    // ── 市政署澳門自然網官方欄位 ──
    official_no: t.official_no || null,
    iam_tree_no: t.iam_tree_no || null,
    crown_m: t.crown_m ?? null,
    diameter_cm: t.diameter_cm ?? null,
    surround_m: t.surround_m ?? null,
    official_description: t.official_description || null,
    official_loc: t.official_loc || null,
    official_age_years: t.official_age_years ?? null,
    official_height_m: t.official_height_m ?? null,
    official_health: t.official_health || null,
    official_grade: t.official_grade || null,
    tree_photo: t.photo_url || null,
    tree_photo_source: t.photo_source || null,
    photo_count: t.photo_count ?? null,
  };
}

function normalizeTreeRow(r) {
  return {
    ...r,
    age_years: num(r.age_years), height_m: num(r.height_m),
    lat: num(r.lat), lon: num(r.lon), id: r.id != null ? num(r.id) : undefined,
    crown_m: r.crown_m != null ? num(r.crown_m) : null,
    diameter_cm: r.diameter_cm != null ? num(r.diameter_cm) : null,
    surround_m: r.surround_m != null ? num(r.surround_m) : null,
    photo_count: r.photo_count != null ? num(r.photo_count) : null,
    official_age_years: r.official_age_years != null ? num(r.official_age_years) : null,
    official_height_m: r.official_height_m != null ? num(r.official_height_m) : null,
  };
}

export async function getTree(treeNo) {
  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().from('v_trees').select('*').eq('tree_no', String(treeNo)).limit(1));
    if (!rows.length) return null;
    const r = rows[0];
    return {
      ...r, age_years: num(r.age_years), height_m: num(r.height_m), lat: num(r.lat), lon: num(r.lon),
    };
  }
  const t = snapshot.trees.find((x) => x.tree_no === String(treeNo));
  return t ? normalizeTreeRow(enrich(t)) : null;
}

/** 一株樹的「鄰居」：同地點其他古樹 */
export async function getNeighbours(treeNo, limit = 6) {
  const t = await getTree(treeNo);
  if (!t) return [];
  const { rows } = await findTrees({ keyword: t.site, limit: 500 });
  return rows.filter((r) => r.tree_no !== String(treeNo)).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// 分析用：全部資料點
// ─────────────────────────────────────────────────────────────
export async function allTrees() {
  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().rpc('rpc_scatter'));
    return rows.map((r) => ({ ...r, age_years: num(r.age_years), height_m: num(r.height_m) }));
  }
  return snapshot.trees.map((t) => ({
    tree_no: t.tree_no, age_years: t.age_years, height_m: t.height_m,
    species: t.species, parish: t.parish, health: t.health,
    grade: t.grade, lat: t.lat, lon: t.lon,
  }));
}

export function ageHistogram(trees, bucket = 25) {
  return histogram(trees.map((t) => t.age_years), bucket);
}

export function treeAgeStats(trees) {
  const ages = trees.map((t) => t.age_years);
  const heights = trees.map((t) => t.height_m);
  return {
    age: { n: ages.length, min: Math.min(...ages), max: Math.max(...ages), mean: +mean(ages).toFixed(1),
      median: median(ages), sd: +sd(ages).toFixed(1), q1: quantile(ages, 0.25), q3: quantile(ages, 0.75),
      variance: +variance(ages).toFixed(1) },
    height: { n: heights.length, min: Math.min(...heights), max: Math.max(...heights),
      mean: +mean(heights).toFixed(2), median: median(heights), sd: +sd(heights).toFixed(2),
      q1: quantile(heights, 0.25), q3: quantile(heights, 0.75), variance: +variance(heights).toFixed(2) },
  };
}

// ─────────────────────────────────────────────────────────────
// 路綫與科普
// ─────────────────────────────────────────────────────────────
export async function listRoutes() {
  if (DATA_SOURCE === 'supabase') {
    return await must(await sb().from('routes').select('*').order('sort_order'));
  }
  return snapshot.routes;
}

export async function getRoute(code) {
  const list = await listRoutes();
  return list.find((r) => r.code === code) || null;
}

export async function listConservation() {
  if (DATA_SOURCE === 'supabase') {
    return await must(await sb().from('conservation_topics')
      .select('id,slug,category,title,summary,sources,sort_order').order('sort_order'));
  }
  return snapshot.conservation.map(({ body_md, ...rest }) => rest)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getTopic(slug) {
  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().from('conservation_topics').select('*').eq('slug', slug).limit(1));
    return rows[0] || null;
  }
  return snapshot.conservation.find((t) => t.slug === slug) || null;
}

export async function listTimeline() {
  if (DATA_SOURCE === 'supabase') {
    return await must(await sb().from('timeline_events').select('*').order('year'));
  }
  return [...snapshot.timeline].sort((a, b) => a.year - b.year);
}

export async function healthCheck() {
  const started = Date.now();
  try {
    const o = await overview();
    return {
      ok: true, data_source: DATA_SOURCE, latency_ms: Date.now() - started,
      tree_count: o.tree_count, checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, data_source: DATA_SOURCE, error: String(err.message || err),
      latency_ms: Date.now() - started, checked_at: new Date().toISOString() };
  }
}
