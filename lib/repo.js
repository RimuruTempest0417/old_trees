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
import { DATA_META } from './data-meta.js';
import { mean, median, sd, variance, histogram, quantile } from './analysis.js';
import { errorText, publicError } from './http.js';

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

/**
 * 把 Supabase／PostgREST 的錯誤轉成「使用者看得懂、且知道下一步」的錯誤。
 *
 * 為什麼需要：部署到 Vercel 之後，函式只會回一句「伺服器處理請求時發生錯誤」，
 * 使用者（和我們）完全看不出是「資料庫還是舊版結構」。這裡依 Postgres 錯誤碼分類：
 *   42P01 / PGRST205 找不到資料表；42703 / PGRST204 找不到欄位；42883 / PGRST202 找不到函式
 * 並附上修復指示（重新執行 supabase/init.sql，它就含有升級段落會自動補齊）。
 */
export function describeDbFailure(error) {
  const raw = errorText(error);
  const code = String((error && error.code) || '');
  const when = /does not exist|not found|schema cache|找不到/i.test(raw);

  // 先分「缺什麼」，再抓名字。順序與抓法都會影響訊息可讀性，兩種寫法都要認得：
  //   PostgreSQL：column "bark_conditions" of relation "field_records" does not exist
  //   PostgREST ：Could not find the 'bark_conditions' column of 'field_records' in the schema cache
  // 2026-09-26 線上實際踩到兩個坑：
  //   ① 只認 `column "X"` 寫法 → PostgREST 的訊息抓成「缺少欄位 of」；
  //   ② 先判資料表（因為訊息裡也有「relation … does not exist」）→ 缺欄位被講成缺資料表。
  const kind = (code === '42703' || code === 'PGRST204') ? 'column'
    : (code === '42883' || code === 'PGRST202') ? 'function'
      : (code === '42P01' || code === 'PGRST205') ? 'table'
        : /column/i.test(raw) && when ? 'column'
          : /function/i.test(raw) && when ? 'function'
            : when && /relation|table/i.test(raw) ? 'table' : null;
  const STOP = new Set(['of', 'in', 'on', 'the', 'schema', 'cache', 'public']);
  const quotedBefore = new RegExp(`['"]([\\w.]+)['"]\\s+(?:column|table|relation|function)\\b`, 'i').exec(raw);
  const wordAfter = new RegExp(`\\b(?:public\\.)?(?:relation|table|column|function)\\s+["']?([\\w.]+)["']?`, 'i').exec(raw);
  const obj = [quotedBefore, wordAfter]
    .map((m) => (m ? m[1] : ''))
    .find((v) => v && !STOP.has(v.toLowerCase())) || '';

  if (kind) {
    const what = kind === 'table' ? '資料表' : kind === 'function' ? '資料庫函式' : '欄位';
    return {
      code: 'db_schema_outdated',
      status: 503,
      public: true,
      table: obj,
      missing: what,
      message: `資料庫結構是舊版：缺少${what}${obj ? ` ${obj}` : ''}，所以這個查詢無法完成。`,
      hint: '請在 Supabase Dashboard → SQL Editor 貼上並執行最新的 supabase/init.sql（開頭的「版本升級」段會自動補齊缺少的欄位、資料表與資料庫函式，可重複執行）；執行完重新整理本頁即可。',
    };
  }
  if (code === '42501' || /permission denied/i.test(raw)) {
    return {
      code: 'db_permission',
      status: 503, public: true,
      message: `資料庫權限不足：${raw}`,
      hint: '請確認 Vercel 的 SUPABASE_SERVICE_ROLE_KEY 是 Project Settings → API 的 service_role 金鑰（不是 anon）。',
    };
  }
  if (/fetch failed|ENOTFOUND|ETIMEDOUT|network|getaddrinfo/i.test(raw)) {
    return {
      code: 'db_unreachable',
      status: 503, public: true,
      message: `無法連線資料庫：${raw}`,
      hint: '請確認 Vercel 環境變數 SUPABASE_URL 是否為正確的 https://<project-ref>.supabase.co，且專案未被暫停。',
    };
  }
  return { code: 'db_query_failed', status: 502, public: true, message: `資料庫查詢失敗：${raw}` };
}

/** 統一的資料庫錯誤物件（供 handler 原樣回傳給使用者） */
function dbFailure(error) {
  const d = describeDbFailure(error);
  return publicError(d.status, d.message, { code: d.code, hint: d.hint, ...(d.table ? { object: d.table } : {}) });
}

async function must({ data, error }) {
  if (error) throw dbFailure(error);
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
    // 官方資料履歷：讓任何人（含使用者）都能確認「這份資料是什麼時候抓的」
    data: {
      source_name: DATA_META.source_name,
      source_page: DATA_META.source_page,
      list_endpoint: DATA_META.list_endpoint,
      fetched_at: DATA_META.fetched_at,
      record_count: DATA_META.record_count,
      photo_count: DATA_META.photo_count,
      data_hash: DATA_META.data_hash,
      license_note: DATA_META.license_note,
    },
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
  // 與 overview() 同理：統計一律以 allTrees()（官方現行值優先）為準，
  // 不用 v_parish_stats 的 SQL 統計，避免同一頁出現兩套分級／健康數字。
  const trees = await allTrees();
  const byParish = new Map();
  for (const t of trees) {
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
  // 不再走 rpc_overview／v_parish_stats 的 SQL 統計：那些用資料庫的 grade／health 欄位
  // （＝名錄 CSV 值），會與畫面上「官方現行值優先」的分級／健康狀況對不起來。
  // 兩種模式都改用同一份 allTrees()（已套用 officialFirst），數字才會前後一致。
  const t = await allTrees();
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
  // 與 overview()／parishStats() 同理：品種的平均樹齡也必須用「畫面上顯示的樹齡」
  // （官方現行值），所以兩種模式統一以 allTrees() 計算，不再走 rpc_species_ranking
  // （那是資料庫的名錄值，會與總覽頁的平均樹齡不一致）。
  const bySpecies = new Map();
  for (const t of await allTrees()) {
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

/**
 * 官方值優先：分級與健康狀況一律採用市政署自然網的「現行值」（official_grade／official_health），
 * 《古樹名錄》CSV 的值保留在 listing_grade／listing_health，供「資料核對」對照，原始資料不改動。
 *
 * 為什麼：官方兩個來源不總是一致。實例 #1132（氹仔小潭山 2000 環山徑・華潤楠・14 年）——
 * 名錄 CSV 寫「三級」，但市政署自然網現行是「不分級」；14 年的樹不可能是三級（該級距為 100–299 年），
 * 官方 5 株「不分級」的樹齡是 6–35 年，故採自然網值。同類差異另有 4 株健康狀況。
 */
export function officialFirst(row) {
  const src = row || {};
  // 樹齡同理：名錄 #619 寫 155 年，市政署自然網現行是 115 年 → 一律採自然網現行值。
  const officialAge = src.official_age_years;
  const age = (officialAge !== null && officialAge !== undefined && officialAge !== '')
    ? num(officialAge)
    : (src.age_years !== null && src.age_years !== undefined ? num(src.age_years) : null);
  return {
    grade: src.official_grade || src.grade || null,
    health: src.official_health || src.health || null,
    age_years: age,
    listing_grade: src.grade || null,
    listing_health: src.health || null,
    listing_age_years: (src.age_years === null || src.age_years === undefined) ? null : num(src.age_years),
    official_grade: src.official_grade || null,
    official_health: src.official_health || null,
    official_age_years: (officialAge === null || officialAge === undefined) ? null : num(officialAge),
  };
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
    // 有分級／健康狀況條件時，SQL 條件的依據是資料庫欄位（＝名錄 CSV 值），
    // 與畫面顯示的「官方現行值」可能差 1–4 株（例如 #1132：DB 寫三級、自然網寫不分級）。
    // 為避免「畫面上看不到卻篩得出來」，這種情況改為先取回全部，再用顯示值在 JS 內篩選。
    // 樹齡同理：資料庫的 age_years 是《名錄》值（#619 是 155 年），畫面顯示的是官方現行值（115 年）。
    // 有任一「顯示值」條件時就改為取回後在 JS 內篩選，避免「畫面上看不到卻篩得出來」（或反之）。
    const jsRefilter = Boolean(filters.grade || filters.health
      || filters.min_age !== null || filters.max_age !== null);
    const rows = await must(await sb().rpc('rpc_find_trees', {
      p_parish: filters.parish,
      p_species: filters.species,
      p_grade: jsRefilter ? null : filters.grade,
      p_health: jsRefilter ? null : filters.health,
      p_min_age: jsRefilter ? null : filters.min_age,
      p_max_age: jsRefilter ? null : filters.max_age,
      p_keyword: filters.keyword,
      p_min_lat: filters.min_lat,
      p_max_lat: filters.max_lat,
      p_min_lon: filters.min_lon,
      p_max_lon: filters.max_lon,
      p_lat: filters.lat,
      p_lon: filters.lon,
      p_radius_m: filters.radius_m,
      p_limit: jsRefilter ? 2000 : limit,
      p_offset: jsRefilter ? 0 : offset,
    }));
    if (jsRefilter) {
      const shownRows = rows.map((r) => ({ r, s: officialFirst(r) })).filter(({ s }) => {
        if (filters.grade && s.grade !== filters.grade) return false;
        if (filters.health && s.health !== filters.health) return false;
        if (filters.min_age !== null && (s.age_years === null || s.age_years < filters.min_age)) return false;
        if (filters.max_age !== null && (s.age_years === null || s.age_years > filters.max_age)) return false;
        return true;
      }).map(({ r }) => r);
      return {
        rows: shownRows.slice(offset, offset + limit).map(normalizeTreeRow),
        total: shownRows.length, limit, offset,
      };
    }
    return { rows: rows.map(normalizeTreeRow), total: rows.length, limit, offset };
  }
  const kw = (filters.keyword || '').trim();
  let rows = snapshot.trees.filter((t) => {
    if (filters.parish && t.parish !== filters.parish) return false;
    if (filters.species && t.species !== filters.species) return false;
    // 篩選必須與畫面顯示的值一致（官方現行值優先），否則會出現「畫面上看不到卻篩得到」
    const shown = officialFirst(t);
    if (filters.grade && shown.grade !== filters.grade) return false;
    if (filters.health && shown.health !== filters.health) return false;
    // 一樣用顯示值（官方現行樹齡）判斷，才與畫面一致
    if (filters.min_age !== null && (shown.age_years === null || shown.age_years < filters.min_age)) return false;
    if (filters.max_age !== null && (shown.age_years === null || shown.age_years > filters.max_age)) return false;
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
    girth_cm: t.girth_cm ?? null,
    stem_count: t.stem_count ?? null,
    stem_measures: t.stem_measures || null,
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
    ...officialFirst(r),          // 顯示用的分級／健康狀況／樹齡一律官方現行值；名錄值放 listing_*
    // age_years 由 officialFirst 決定，這裡不可再寫 age_years: num(r.age_years) 蓋掉官方值
    height_m: num(r.height_m),
    lat: num(r.lat), lon: num(r.lon), id: r.id != null ? num(r.id) : undefined,
    crown_m: r.crown_m != null ? num(r.crown_m) : null,
    diameter_cm: r.diameter_cm != null ? num(r.diameter_cm) : null,
    girth_cm: r.girth_cm != null ? num(r.girth_cm) : null,
    stem_count: r.stem_count != null ? num(r.stem_count) : null,
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
    // 一定要走 normalizeTreeRow：Supabase 模式的這一條路徑原本直接回 v_trees 原始列，
    // 少了 officialFirst → 線上單株詳情仍顯示《名錄》的舊分級（#1132 顯示「三級」），
    // 而本機 snapshot 模式因為走 normalizeTreeRow(enrich(t)) 看不到這個問題。
    // 與 snapshot 分支回傳同一組欄位（含 listing_grade／listing_health、官方胸徑胸圍）。
    return normalizeTreeRow(rows[0]);
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
    // 注意：這裡不能改用 rpc_scatter。它為了畫散佈圖只回傳
    // (tree_no, age_years, height_m, species, parish, health) —— 沒有座標，
    // 而路綫推薦的候選點必須有 lat/lon；一旦缺座標，候選全被濾掉，
    // 路綫推薦就會回 {route: null, stops: []}（線上真的發生過）。
    const rows = await must(await sb().from('v_trees')
      .select('tree_no,age_years,official_age_years,height_m,species,parish,site,health,grade,'
        + 'official_health,official_grade,lat,lon,diameter_cm,official_loc,'
        // 行動建議（v0.16.0）需要的欄位：冠幅、照片、座標精度
        + 'crown_m,tree_photo,photo_count,tree_geo_precision')
      .limit(2000));
    return rows.map((r) => ({
      ...r,
      ...officialFirst(r),          // 分級／健康狀況／樹齡一律用官方現行值（見 officialFirst 說明）
      height_m: num(r.height_m),    // age_years 由 officialFirst 給（不可再覆寫成名錄值）
      lat: num(r.lat), lon: num(r.lon),
      crown_m: r.crown_m != null ? num(r.crown_m) : null,
      // ⚠ v_trees 裡有兩個精度欄位：tree_geo_precision 是「這一株」的座標精度，
      //   geo_precision 是「地點」的精度。行動建議要判斷的是樹木座標，所以明寫對應，
      //   不要把兩者混用（名稱一樣很容易誤讀）。
      geo_precision: r.tree_geo_precision != null ? String(r.tree_geo_precision) : null,
      photo_url: r.tree_photo || null,
      photo_count: r.photo_count != null ? num(r.photo_count) : null,
    }));
  }
  return snapshot.trees.map((t) => ({
    tree_no: t.tree_no, age_years: t.age_years, height_m: t.height_m,
    // 行動建議需要的欄位（示範模式的欄位名與 v_trees 對應欄位一致）
    crown_m: t.crown_m != null ? num(t.crown_m) : null,
    photo_url: t.photo_url || null,
    photo_count: t.photo_count != null ? num(t.photo_count) : null,
    geo_precision: t.geo_precision != null ? String(t.geo_precision) : null,
    species: t.species, parish: t.parish, site: t.site,
    ...officialFirst(t),          // 分級／健康狀況一律用官方現行值（見 officialFirst 說明）
    lat: t.lat, lon: t.lon,
    // 與 Supabase 模式（v_trees）欄位一致：優先保育評分需要胸徑與官方地點
    diameter_cm: t.diameter_cm, official_loc: t.official_loc || t.loc || '',
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

// ─────────────────────────────────────────────────────────────
// 實地考察紀錄 field_records
//   資料庫（Supabase）是唯一真實來源；示範模式（snapshot）唯讀，
//   前端會把紀錄暫存在瀏覽器，並在介面上明示尚未寫入資料庫。
// ─────────────────────────────────────────────────────────────
const FIELD_LIMITS = { observer: 60, weather: 20, site_note: 600, damage_note: 600, photo_url: 500, photo_path: 300 };

// GPS 比對欄位的值域（v0.15.0）：與 supabase/schema.sql 的 field_records_gps_check 一致（測試會比對兩邊）
export const GPS_LIMITS = { accuracy_m: 1000, distance_m: 100000 };

const FIELD_HEALTH = ['健康', '一般', '瀕危'];

/**
 * 結構化觀察欄位（v0.13.0）——作業要求的「樹皮狀況」與「周邊環境」，
 * 一律用固定選項（勾選）而不是只寫在自由文字裡，這樣才能被統計、被 CSV 匯出、被紙本表單對照。
 * 這裡的允許值必須與 supabase/schema.sql 的 CHECK 限制條件完全一致（測試會比對兩邊）。
 */
export const FIELD_BARK = ['剝落', '黴斑', '白色鹽類結晶', '無明顯異常'];
export const FIELD_SURROUND = ['鄰近馬路', '鄰近建築物', '排水口', '水泥覆蓋', '裸露土壤', '其他'];
export const FIELD_CONCRETE_COVER = ['無', '少量（少於三分之一）', '約一半', '大部分（超過三分之二）', '幾乎全部覆蓋'];
export const PHOTO_BUCKET = 'field-photos';
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/** 把「勾選清單／逗號字串」整理成合法值陣列（去掉非法值與重複） */
function pickList(input, allowed, max) {
  const raw = Array.isArray(input)
    ? input
    : (input == null || input === '' ? [] : String(input).split(/[,、]/));
  const out = [];
  for (const item of raw) {
    const v = String(item == null ? '' : item).trim();
    if (allowed.includes(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** 照片路徑清單：只接受安全的相對路徑（擋掉 ../ 與絕對路徑） */
function pickPaths(input, max = 6) {
  const raw = Array.isArray(input) ? input : (input == null || input === '' ? [] : [input]);
  const out = [];
  for (const item of raw) {
    const v = String(item == null ? '' : item).trim().slice(0, FIELD_LIMITS.photo_path);
    if (!v || v.includes('..') || v.startsWith('/') || v.includes('://')) continue;
    if (!out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** 由 Storage 路徑組出公開網址（bucket 為 public，前端 <img> 可直接讀） */
function photoPublicUrl(path) {
  if (!SUPABASE_URL || !path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/** 把紀錄裡的 photo_paths 轉成可直接顯示的 photo_urls（清單與單筆都用同一套） */
function withPhotoUrls(record) {
  if (!record || typeof record !== 'object') return record;
  const paths = Array.isArray(record.photo_paths) ? record.photo_paths : [];
  return { ...record, photo_urls: paths.map(photoPublicUrl).filter(Boolean) };
}

/** 驗證並正規化一筆考察紀錄；回傳 { record, errors } */
export function normalizeFieldRecord(input = {}) {
  const txt = (v) => (v == null ? '' : String(v).trim());
  const numOrNull = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const clip = (v, max) => { const t = txt(v); return t ? t.slice(0, max) : null; };
  const record = {
    tree_no: txt(input.tree_no) || null,
    observed_on: /^\d{4}-\d{2}-\d{2}$/.test(txt(input.observed_on)) ? txt(input.observed_on) : null,
    observer: txt(input.observer),
    weather: clip(input.weather, FIELD_LIMITS.weather),
    health: FIELD_HEALTH.includes(txt(input.health)) ? txt(input.health) : null,
    height_m: numOrNull(input.height_m),
    diameter_cm: numOrNull(input.diameter_cm),
    crown_m: numOrNull(input.crown_m),
    site_note: clip(input.site_note, FIELD_LIMITS.site_note),
    damage_note: clip(input.damage_note, FIELD_LIMITS.damage_note),
    photo_url: clip(input.photo_url, FIELD_LIMITS.photo_url),
    bark_conditions: pickList(input.bark_conditions, FIELD_BARK, FIELD_BARK.length),
    surround_items: pickList(input.surround_items, FIELD_SURROUND, FIELD_SURROUND.length),
    concrete_cover: FIELD_CONCRETE_COVER.includes(txt(input.concrete_cover)) ? txt(input.concrete_cover) : null,
    photo_paths: pickPaths(input.photo_paths),
    lat: numOrNull(input.lat),
    lon: numOrNull(input.lon),
    gps_accuracy_m: numOrNull(input.gps_accuracy_m),
    gps_distance_m: numOrNull(input.gps_distance_m),
  };
  const errors = [];
  if (!record.observer) errors.push('請填寫記錄者（班級／座號或姓名）。');
  if (txt(input.health) && !record.health) errors.push('健康狀況只接受「健康」「一般」「瀕危」三種值。');
  // 有填但不合法 → 明確說出允許值（不要靜默丟掉學生填的內容）
  const rawList = (v) => (Array.isArray(v) ? v.filter((x) => String(x == null ? '' : x).trim()) : (v ? [v] : []));
  if (rawList(input.bark_conditions).length && !record.bark_conditions.length) {
    errors.push(`樹皮狀況只接受：${FIELD_BARK.join('、')}。`);
  }
  if (rawList(input.surround_items).length && !record.surround_items.length) {
    errors.push(`周邊環境只接受：${FIELD_SURROUND.join('、')}。`);
  }
  if (txt(input.concrete_cover) && !record.concrete_cover) {
    errors.push(`水泥覆蓋範圍只接受：${FIELD_CONCRETE_COVER.join('、')}。`);
  }
  if (record.lat != null && (record.lat < -90 || record.lat > 90)) errors.push('緯度必須介於 -90 與 90 之間。');
  if (record.lon != null && (record.lon < -180 || record.lon > 180)) errors.push('經度必須介於 -180 與 180 之間。');
  if (record.height_m != null && (record.height_m <= 0 || record.height_m > 100)) errors.push('樹高必須介於 0 與 100 公尺之間。');
  if (record.diameter_cm != null && (record.diameter_cm <= 0 || record.diameter_cm > 1000)) errors.push('胸徑必須介於 0 與 1000 公分之間。');
  if (record.crown_m != null && (record.crown_m <= 0 || record.crown_m > 100)) errors.push('冠幅必須介於 0 與 100 公尺之間。');
  if (record.gps_accuracy_m != null && (record.gps_accuracy_m < 0 || record.gps_accuracy_m > GPS_LIMITS.accuracy_m)) {
    errors.push(`GPS 定位精度必須介於 0 與 ${GPS_LIMITS.accuracy_m} 公尺之間。`);
  }
  if (record.gps_distance_m != null && (record.gps_distance_m < 0 || record.gps_distance_m > GPS_LIMITS.distance_m)) {
    errors.push(`與官方座標的距離必須介於 0 與 ${GPS_LIMITS.distance_m} 公尺之間。`);
  }
  return { record, errors };
}

export async function listFieldRecords(limit = 200) {
  if (DATA_SOURCE === 'supabase') {
    const n = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const rows = await must(await sb().from('field_records').select('*')
      .order('observed_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(n));
    return rows.map(withPhotoUrls);
  }
  return (snapshot.field_records || []).map(withPhotoUrls);
}

/** 新增一筆紀錄；示範模式丟出可預期的錯誤，由 API 轉成「未寫入資料庫」的回應 */
export async function insertFieldRecord(record) {
  if (DATA_SOURCE === 'supabase') {
    const rows = await must(await sb().from('field_records').insert(record).select());
    return withPhotoUrls(rows[0]);
  }
  throw Object.assign(
    new Error('示範模式（未連接 Supabase）不會寫入資料庫；本筆紀錄已暫存在這台裝置的瀏覽器。'),
    { status: 503, demo: true },
  );
}

/**
 * 上傳一張實地考察照片到 Supabase Storage（bucket: field-photos）。
 *
 * 為什麼用 fetch 直接打 Storage REST 而不是 supabase-js 的 storage API：
 *   1. 這一層的測試是「攔截 fetch 檢查送出的請求」，直打 REST 才能被完整驗證；
 *   2. 少一層封裝，錯誤碼與回應文字可以原樣轉成給使用者看的訊息。
 * 前端已把照片壓縮過（長邊 1280、JPEG），所以 3 MB 的上限對現場照片很寬鬆。
 */
export async function uploadFieldPhoto({ dataUrl, treeNo } = {}) {
  if (DATA_SOURCE !== 'supabase') {
    throw Object.assign(
      new Error('示範模式（未連接 Supabase）不會上傳照片；這張照片只會暫存在這台裝置的瀏覽器。'),
      { status: 503, demo: true },
    );
  }
  const raw = String(dataUrl == null ? '' : dataUrl).trim();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!m) throw publicError(400, '照片格式只接受 JPEG／PNG／WebP 的 data URL（前端會先壓縮再送）。');
  const mime = m[1];
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length) throw publicError(400, '照片內容是空的，請重新選擇檔案。');
  if (buf.length > PHOTO_MAX_BYTES) {
    throw publicError(413, `照片過大（${(buf.length / 1048576).toFixed(1)} MB），請重新選擇或讓前端壓縮後再上傳。`);
  }
  const ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  const day = new Date().toISOString().slice(0, 10);
  const tree = String(treeNo == null ? '' : treeNo).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 12) || 'unknown';
  const path = `${day}/${tree}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'false',
        'Cache-Control': 'public, max-age=31536000',
      },
      body: buf,
    });
  } catch (err) {
    throw publicError(502, `連不上儲存空間：${errorText(err)}`, {
      hint: '請確認 Vercel 的 SUPABASE_URL 是否正確，以及專案是否被暫停。',
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const missingBucket = /bucket/i.test(text) && /not\s*found/i.test(text);
    throw publicError(missingBucket ? 503 : 502,
      missingBucket
        ? '儲存空間（field-photos）還不存在，照片沒有上傳。'
        : `儲存空間回應 ${res.status}，照片沒有上傳。`,
      {
        hint: missingBucket
          ? '請到 Supabase → SQL Editor 重跑最新的 supabase/init.sql（會建立 field-photos bucket）。'
          : '請稍後再試；若持續失敗，請檢查 Storage 是否已啟用。',
        code: `storage_${res.status}`,
      });
  }
  return { stored: true, path, url: photoPublicUrl(path), bytes: buf.length, mime };
}

/**
 * 資料庫結構自我檢查。
 *
 * 部署後最常見的故障是「程式碼是新的、資料庫還是舊版結構」：網站看起來連上了
 * （/api/meta 正常），但某些分頁一片錯誤，而且錯誤訊息被 5xx 通用化，完全看不出原因。
 * 這裡逐一探測本專案實際會用到的資料表／欄位／函式，缺什麼就列出來並附上修復指示，
 * 讓 /api/health 直接告訴使用者要做什麼。
 */
// 這份清單的每一欄都必須真實存在於 supabase/schema.sql，
// 否則健康檢查會誤報「資料庫需要升級」（tests/sql.test.js 會用 PGlite 逐一驗證，避免與綱要脫節）。
export const SCHEMA_PROBES = [
  { label: '檢視表 v_trees（含市政署欄位）', table: 'v_trees', columns: 'tree_no,official_no,tree_geo_precision,geo_precision,tree_photo,official_age_years,diameter_cm,girth_cm,stem_count' },
  { label: '資料表 trees', table: 'trees', columns: 'tree_no,species_id,age_years,height_m,lat,lon' },
  // 探測欄位要涵蓋「前端會寫入的欄位」：資料庫沒升級時，應該在健康檢查就看得出來，
  // 而不是等學生在樹下按了儲存才失敗（v0.15.1）。
  { label: '資料表 field_records（實地考察）', table: 'field_records',
    columns: 'id,tree_no,observer,health,bark_conditions,surround_items,concrete_cover,photo_paths,gps_accuracy_m,gps_distance_m' },
  { label: '資料表 conservation_topics（保育科普）', table: 'conservation_topics', columns: 'slug,title,sources' },
  { label: '資料表 timeline_events（大事記）', table: 'timeline_events', columns: 'year,title' },
  { label: '資料表 routes（路綫）', table: 'routes', columns: 'code,site_names' },
];
export const RPC_PROBES = [
  { label: '資料庫函式 rpc_overview', fn: 'rpc_overview' },
  { label: '資料庫函式 rpc_find_trees', fn: 'rpc_find_trees', args: { p_limit: 1 } },
  { label: '資料庫函式 rpc_scatter', fn: 'rpc_scatter' },
];

// 前端可顯示的版本標記：方便一眼判斷「線上跑的是哪一版程式」，
// 也讓「明明貼了新檔卻還是舊行為」這類問題可以直接由畫面確認。
export const API_VERSION = 'v1.0.0';

export const SCHEMA_FIX_HINT = '請在 Supabase Dashboard → SQL Editor 貼上並執行最新的 supabase/init.sql'
  + '（開頭的「版本升級」段會自動補齊缺少的欄位、資料表與函式，可重複執行）；完成後重新整理頁面即可。';

async function probeSchema() {
  if (DATA_SOURCE !== 'supabase') {
    return { ok: true, data_source: 'snapshot', missing: [], hint: null };
  }
  const missing = [];
  let hardStop = false;                      // 連線／權限層級的失敗，後續探測必然同樣失敗
  const probe = async (label, run) => {
    let err = null;
    try {
      const r = await run();
      err = r.error || null;
    } catch (e) {
      err = e;
    }
    if (!err) return;
    missing.push(`${label}：${errorText(err).slice(0, 160)}`);
    const d = describeDbFailure(err);
    if (d.code === 'db_unreachable' || d.code === 'db_permission') hardStop = true;
  };
  for (const p of SCHEMA_PROBES) {
    if (hardStop) break;
    await probe(p.label, () => sb().from(p.table).select(p.columns).limit(1));
  }
  for (const r of RPC_PROBES) {
    if (hardStop) break;
    await probe(r.label, () => sb().rpc(r.fn, r.args || {}));
  }
  return { ok: missing.length === 0, data_source: 'supabase', missing, hint: missing.length ? SCHEMA_FIX_HINT : null };
}

export async function healthCheck() {
  const started = Date.now();
  const schema = await probeSchema();
  try {
    const o = await overview();
    return {
      ok: true, data_source: DATA_SOURCE, latency_ms: Date.now() - started,
      tree_count: o.tree_count, checked_at: new Date().toISOString(), schema,
    };
  } catch (err) {
    const d = describeDbFailure(err);
    return {
      ok: false, data_source: DATA_SOURCE, error: errorText(err), error_code: d.code,
      hint: d.hint || null, latency_ms: Date.now() - started,
      checked_at: new Date().toISOString(), schema,
    };
  }
}
