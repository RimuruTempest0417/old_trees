/**
 * 科普「數據導讀」——每一篇科普文章底下，「用本站的官方數據讀懂這篇」那一段（v0.16.0）
 *
 * 【為什麼要把數字集中在後端算】
 * 這些數字（株數、平均樹齡、健康分佈…）會隨著市政署官方資料更新而改變。如果寫死在文章裡，
 * 文章就會講出過期的數字；集中在後端、用同一份官方資料算，畫面與報告引用的是同一組值。
 * 前端只負責把值填進句子與連結，不自己算。
 *
 * 【誠實原則】
 * - 每個指標都標明它是「官方資料」還是「本站統計」（例如照片可用數、名錄與官方值差異株數）。
 * - 沒有官方數據的主題（例如 2000 年後沒有公開的降雨 pH 年值）就以「缺口」的形式寫出來，
 *   不填推估值、也不用鄰近地區數字代替。
 */

/** 取值小工具（全部防呆，缺值回 null） */
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

/** 依官方樹木資料與優先保育排序算出所有可用指標 */
export function buildMetrics(trees = [], ranked = [], env = null) {
  const list = trees || [];
  const byHealth = {};
  const byGrade = {};
  const byParish = {};
  const speciesCount = new Map();
  for (const t of list) {
    if (t.health) byHealth[t.health] = (byHealth[t.health] || 0) + 1;
    if (t.grade) byGrade[t.grade] = (byGrade[t.grade] || 0) + 1;
    if (t.parish) byParish[t.parish] = (byParish[t.parish] || 0) + 1;
    const sp = String(t.species || '').trim();
    if (sp) speciesCount.set(sp, (speciesCount.get(sp) || 0) + 1);
  }
  const ages = list.map((t) => n(t.age_years)).filter((x) => x != null);
  const avgAge = ages.length ? r1(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
  const oldest = list.reduce((best, t) => {
    const a = n(t.age_years);
    return a != null && (!best || a > best.age_years) ? { age_years: a, tree_no: String(t.tree_no), species: t.species } : best;
  }, null);
  const attention = list.filter((t) => t.health && t.health !== '健康').length;
  const rareSpecies = [...speciesCount.entries()].filter(([, c]) => c <= 3);
  const topParish = Object.entries(byParish).sort((a, b) => b[1] - a[1])[0] || null;
  const mismatched = list.filter((t) => (t.listing_grade && t.grade && t.listing_grade !== t.grade)
    || (t.listing_health && t.health && t.listing_health !== t.health)
    || (t.listing_age_years != null && t.official_age_years != null
        && Number(t.listing_age_years) !== Number(t.official_age_years))).length;
  const scores = (ranked || []).map((r) => n(r.score)).filter((x) => x != null);
  const kpi = (key) => {
    const found = ((env && env.kpis) || []).find((k) => k.key === key);
    return found ? { mean: found.mean, standard: found.standard, unit: found.unit, compliant: found.compliant } : null;
  };
  return {
    trees_total: list.length,
    species_total: speciesCount.size,
    avg_age: avgAge,
    oldest_age: oldest ? oldest.age_years : null,
    oldest_no: oldest ? oldest.tree_no : null,
    oldest_species: oldest ? oldest.species : null,
    health_healthy: byHealth['健康'] || 0,
    health_fair: byHealth['一般'] || 0,
    health_endangered: byHealth['瀕危'] || 0,
    attention_count: attention,
    attention_pct: list.length ? r1((attention / list.length) * 100) : null,
    grade1: byGrade['一級'] || 0,
    grade2: byGrade['二級'] || 0,
    grade3: byGrade['三級'] || 0,
    grade_other: byGrade['不分級'] || 0,
    age_300plus: ages.filter((a) => a >= 300).length,
    crown_known: list.filter((t) => t.crown_m != null).length,
    photo_available: list.filter((t) => t.photo_url).length,
    parish_total: Object.keys(byParish).length,
    parish_top: topParish ? topParish[0] : null,
    parish_top_count: topParish ? topParish[1] : null,
    priority_high: scores.filter((s) => s >= 75).length,
    priority_mid: scores.filter((s) => s >= 60 && s < 75).length,
    mismatch_total: mismatched,
    rare_species_total: rareSpecies.length,
    rare_tree_total: rareSpecies.reduce((a, [, c]) => a + c, 0),
    pm10: kpi('PM10'),
    pm25: kpi('PM2.5'),
    no2: kpi('NO2'),
  };
}

/**
 * 文章 → 導讀項目。每一項：
 *   metric 指標鍵（buildMetrics 的鍵）
 *   text   句子模板（{v} 會換成格式化後的數值；{metric} 可跨指標引用）
 *   link   連到本站哪一頁（深連結，讓讀者直接去看資料）
 *   kind   official＝官方資料／stat＝本站統計（畫面會標示，避免把統計當官方）
 */
export const GUIDES = [
  {
    slug: 'why-conserve',
    items: [
      { metric: 'trees_total', text: '全澳受《古樹名木保護名錄》保護的古樹共 {v} 株', link: '#/map', kind: 'official' },
      { metric: 'attention_count', text: '其中 {v} 株（{attention_pct}%）的官方健康狀況不是「健康」', link: '#/priority', kind: 'official' },
      { metric: 'health_endangered', text: '{v} 株官方列為「瀕危」，是優先複查的對象', link: '#/priority', kind: 'official' },
      { metric: 'oldest_age', text: '最老的一株 {v} 年（#{oldest_no}，{oldest_species}）', link: '#/map?tree={oldest_no}', kind: 'official' },
    ],
  },
  {
    slug: 'distribution',
    items: [
      { metric: 'parish_total', text: '分布於 {v} 個堂區', link: '#/analytics', kind: 'official' },
      { metric: 'parish_top_count', text: '單一堂區最多的是 {parish_top}，共 {v} 株', link: '#/map', kind: 'official' },
      { metric: 'species_total', text: '{v} 個樹種，平均樹齡 {avg_age} 年', link: '#/analytics', kind: 'official' },
    ],
  },
  {
    slug: 'history-link',
    items: [
      { metric: 'oldest_age', text: '最老的一株 {v} 年（#{oldest_no}），種下時是清朝康熙年間', link: '#/map?tree={oldest_no}', kind: 'official' },
      { metric: 'age_300plus', text: '{v} 株樹齡超過 300 年，橫跨三個世紀', link: '#/priority', kind: 'official' },
      { metric: 'grade1', text: '官方一級古樹 {v} 株、二級 {grade2} 株', link: '#/analytics', kind: 'official' },
    ],
  },
  {
    slug: 'conditions',
    items: [
      { metric: 'crown_known', text: '官方只有 {v} 株（{trees_total} 株中的 {crown_pct}%）有冠幅值，其餘要去現場量', link: '#/field', kind: 'official' },
      { metric: 'photo_available', text: '{v} 株有可用的官方照片，缺的以樹種相片代替', link: '#/card', kind: 'stat' },
      { metric: 'mismatch_total', text: '{v} 株的《名錄》值與官方現行值不同，以官方現行值為準', link: '#/monitoring', kind: 'stat' },
    ],
  },
  {
    slug: 'legislation',
    items: [
      { metric: 'trees_total', text: '第279/2025號行政長官批示的名錄共 {v} 株（2026年1月6日生效）', link: '#/policy', kind: 'official' },
      { metric: 'grade_other', text: '另有 {v} 株官方「不分級」（樹齡不足但具特殊意義或樹種珍貴）', link: '#/analytics', kind: 'official' },
      { metric: 'mismatch_total', text: '{v} 株的官方現行值與名錄不同，本站一律以官方現行值顯示並保留名錄值供核對', link: '#/monitoring', kind: 'stat' },
    ],
  },
  {
    slug: 'residents',
    items: [
      { metric: 'priority_high', text: '{v} 株的優先保育分數在 75 分以上（樹齡、健康、級別、稀有度、區位風險五項）', link: '#/priority', kind: 'stat' },
      { metric: 'attention_pct', text: '{attention_count} 株（{v}%）官方健康狀況需關注', link: '#/priority', kind: 'official' },
      { metric: 'crown_known', text: '樹冠遮蔭的關鍵值是冠幅，但官方只有 {v} 株有；遮蔽效果的推估要靠現場量測', link: '#/field', kind: 'official' },
    ],
  },
  {
    slug: 'future',
    items: [
      { metric: 'avg_age', text: '全澳平均樹齡 {v} 年——多數個體在 21 世紀末會同時進入老年期', link: '#/analytics', kind: 'official' },
      { metric: 'age_300plus', text: '{v} 株已超過 300 年，是後續世代能否看到同一批樹的關鍵', link: '#/priority', kind: 'official' },
      { metric: 'health_endangered', text: '{v} 株已列瀕危，若不處理就不會有「未來會更多」', link: '#/priority', kind: 'official' },
    ],
  },
  {
    slug: 'stories',
    items: [
      { metric: 'oldest_no', text: '最老的一株是 #{v}（{oldest_species}，{oldest_age} 年）', link: '#/map?tree={oldest_no}', kind: 'official' },
      { metric: 'rare_species_total', text: '{v} 個樹種全澳不超過 3 株，稀有度最高的個體一旦死亡就沒有替代', link: '#/analytics', kind: 'stat' },
      { metric: 'rare_tree_total', text: '這些稀有樹種合計只有 {v} 株', link: '#/analytics', kind: 'stat' },
    ],
  },
  {
    slug: 'math-analysis',
    items: [
      { metric: 'trees_total', text: '{v} 筆官方資料就是這篇的母體（平均樹齡 {avg_age} 年、{species_total} 個樹種）', link: '#/analytics', kind: 'official' },
      { metric: 'priority_mid', text: '{v} 株落在 60–74 分區間，是「該排但還沒排到」的中段', link: '#/priority', kind: 'stat' },
      { metric: 'oldest_age', text: '極端值：最老 {v} 年，其餘大多數集中在 100–150 年', link: '#/analytics', kind: 'official' },
    ],
  },
  {
    slug: 'extras',
    items: [
      { metric: 'species_total', text: '{v} 個樹種、{trees_total} 株，最多的是榕屬（細葉榕、榕樹、高山榕）', link: '#/analytics', kind: 'official' },
      { metric: 'grade3', text: '{v} 株官方列為三級（樹齡 100–299 年），是名錄的主體', link: '#/analytics', kind: 'official' },
      { metric: 'photo_available', text: '{v} 株有官方照片，可作為現場核對的比對基準', link: '#/card', kind: 'stat' },
    ],
  },
  {
    slug: 'faq',
    items: [
      { metric: 'trees_total', text: '「澳門有幾株古樹？」→ {v} 株（第279/2025號行政長官批示的名錄）', link: '#/map', kind: 'official' },
      { metric: 'parish_total', text: '「分佈在哪？」→ {v} 個堂區，路環與澳門半島舊城區最集中', link: '#/analytics', kind: 'official' },
      { metric: 'mismatch_total', text: '「為什麼網站上的數字和名錄不同？」→ 有 {v} 株的官方現行值與名錄不同，本站以官方現行值為準並保留名錄值', link: '#/monitoring', kind: 'stat' },
    ],
  },
  {
    slug: 'chemistry-view',
    items: [
      { metric: 'pm10', text: '官方 2025 年 PM10 年均 {v} µg/m³（標準 {pm10_standard}，{pm10_verdict}）', link: '#/chemistry', kind: 'official' },
      { metric: 'pm25', text: 'PM2.5 年均 {v} µg/m³（標準 {pm25_standard}）；粒狀物會沉降在葉面，影響光合作用', link: '#/chemistry', kind: 'official' },
      { metric: 'no2', text: 'NO₂ 年均 {v} µg/m³（標準 {no2_standard}）——交通排放的指標污染物', link: '#/chemistry', kind: 'official' },
      { metric: 'attention_count', text: '把空污背景與官方健康狀況並列時要記得：{v} 株需關注，且各區平均樹齡不同（相關不等於因果）', link: '#/chemistry', kind: 'official' },
    ],
  },
];

/** 數值格式化：整數加千分位、小數保留一位（與站上其他頁面一致） */
function fmt(v, metric) {
  if (v == null) return '—';
  if (typeof v === 'object') return v.mean != null ? String(v.mean) : '—';
  if (Number.isInteger(v) || metric.endsWith('_total') || metric.endsWith('_count')) return Number(v).toLocaleString('en-US');
  return String(v);
}

/** 把模板裡的 {metric} 佔位換成實際值；缺值就整句略過（不顯示「— 株」這種句子） */
export function resolveGuides(metrics, { linkBase = '' } = {}) {
  const out = [];
  for (const g of GUIDES) {
    const items = [];
    for (const item of g.items) {
      const raw = metrics[item.metric];
      if (raw == null) continue;
      if (typeof raw === 'object' && raw.mean == null) continue;
      let text = item.text.replace(/\{v\}/g, fmt(raw, item.metric));
      let missing = false;
      text = text.replace(/\{(\w+)\}/g, (_, key) => {
        if (key === 'crown_pct') {
          const pct = metrics.trees_total ? Math.round((metrics.crown_known / metrics.trees_total) * 1000) / 10 : null;
          if (pct == null) { missing = true; return ''; }
          return String(pct);
        }
        if (key.endsWith('_standard')) {
          const val = (metrics[key.slice(0, -'_standard'.length)] || {}).standard;
          if (val == null) { missing = true; return ''; }
          return String(val);
        }
        if (key.endsWith('_verdict')) {
          const val = (metrics[key.slice(0, -'_verdict'.length)] || {}).compliant;
          if (val == null) { missing = true; return ''; }
          return val ? '低於標準' : '高於標準';
        }
        const m = metrics[key];
        if (m == null) { missing = true; return ''; }
        return typeof m === 'object' ? fmt(m.mean, key) : fmt(m, key);
      });
      if (missing) continue;
      let link = item.link;
      link = link.replace(/\{(\w+)\}/g, (_, key) => (metrics[key] != null ? String(metrics[key]) : ''));
      if (linkBase) link = linkBase + link;
      items.push({ text, link, kind: item.kind, metric: item.metric });
    }
    if (items.length) out.push({ slug: g.slug, items });
  }
  return out;
}

/** 方法說明（給畫面用，說明這些數字從哪裡來） */
export function guidesMethod() {
  return {
    note: '這些數字由本站後端以同一份市政署官方資料即時計算，官方資料更新時會跟著改變；'
      + '標「官方資料」者取自《古樹名木保護名錄》與市政署「澳門自然網」，標「本站統計」者是本站對官方資料的統計（例如照片可用數、名錄與官方值差異株數）。',
    metrics_count: Object.keys(buildMetrics([], [], null)).length,
  };
}
