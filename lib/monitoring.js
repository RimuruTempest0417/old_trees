/**
 * 監測時間序列（純函式，可單元測試）
 *
 * 目的：把「官方名錄的歷次版本」與「我們的實地考察紀錄」接成一條時間序列，
 * 讓每一株古樹都能回答：跟上次比，健康狀況、樹高、胸徑變了多少？有沒有異常？
 *
 * 三個資料來源（全部有出處，不估算、不補造）：
 *   1) listing ：《古樹名錄》CSV 的官方值（較早的官方版本）
 *   2) official：市政署自然網現行值（每次官方名錄有變更時由每日擷取自動存檔）
 *   3) field   ：我們自己的實地考察紀錄（field_records，含日期、觀察者、量測值）
 *
 * 【不變的鐵律】
 *   - 分級與健康狀況一律以官方為準；官方的「分級變動」視為資料更新，不是我們評的異常。
 *   - 缺值就是缺值：不做內插、不用平均值填補。點與點之間只比較「兩邊都有值」的欄位。
 */

const HEALTH_RANK = { 健康: 3, 一般: 2, 瀕危: 1 };

/** 把日期字串（YYYY-MM-DD 或 ISO）轉成毫秒；無法解析回 null。 */
export function toTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const t = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const asNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 建立一株樹的監測序列。
 *
 * @param {object} tree      古樹基本資料（tree_no／species／grade／health／height_m／diameter_cm／girth_cm）
 * @param {object} opts
 *   - listing   {{grade,health,height_m,diameter_cm,age_years}} 《古樹名錄》值（可空）
 *   - snapshots [{date, trees:{[tree_no]:{...}}}]  官方歷史快照（由 scripts/gen-official-history.mjs 產生）
 *   - records   [{observed_on, health, height_m, diameter_cm, crown_m, observer, ...}] 實地考察紀錄
 */
export function buildSeries(tree, { listing = null, snapshots = [], records = [] } = {}) {
  const no = tree && tree.tree_no != null ? String(tree.tree_no) : '';
  const points = [];

  if (listing && (listing.grade || listing.health)) {
    points.push({
      date: null,                       // 《古樹名錄》未載日期
      label: '《古樹名錄》官方版本',
      source: 'listing',
      health: listing.health || null,
      grade: listing.grade || null,
      age_years: asNum(listing.age_years),
      height_m: asNum(listing.height_m),
      diameter_cm: asNum(listing.diameter_cm),
      girth_cm: asNum(listing.girth_cm),
    });
  }

  for (const snap of snapshots || []) {
    const t = (snap.trees || {})[no];
    if (!t) continue;
    points.push({
      date: snap.date || null,
      label: `市政署自然網（${snap.date || '未載日期'}）`,
      source: 'official',
      health: t.health || null,
      grade: t.grade || null,
      height_m: asNum(t.height_m),
      diameter_cm: asNum(t.diameter_cm),
      girth_cm: asNum(t.girth_cm),
      age_years: asNum(t.age_years),
    });
  }

  for (const r of records || []) {
    points.push({
      date: r.observed_on || r.created_at || null,
      label: `實地考察${r.observer ? `（${r.observer}）` : ''}`,
      source: 'field',
      health: r.health || null,
      height_m: asNum(r.height_m),
      diameter_cm: asNum(r.diameter_cm),
      girth_cm: r.diameter_cm != null ? +((asNum(r.diameter_cm) || 0) * Math.PI).toFixed(1) || null : null,
      crown_m: asNum(r.crown_m),
      observer: r.observer || null,
      weather: r.weather || null,
      note: r.site_note || r.damage_note || null,
    });
  }

  // 排序：有日期的依日期；《古樹名錄》版本沒有日期，視為最早（它是較早的官方版本）
  points.sort((a, b) => {
    const ta = toTime(a.date);
    const tb = toTime(b.date);
    if (ta === null && tb === null) return 0;
    if (ta === null) return -1;
    if (tb === null) return 1;
    return ta - tb;
  });

  // 相鄰比較（只比兩邊都有值的欄位）
  const steps = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const d = {
      from: prev.date, to: cur.date,
      from_label: prev.label, to_label: cur.label,
      from_source: prev.source, to_source: cur.source,
      health_from: prev.health, health_to: cur.health,
      grade_from: prev.grade, grade_to: cur.grade,
      age_from: prev.age_years, age_to: cur.age_years,
      height_delta: (prev.height_m !== null && cur.height_m !== null) ? +(cur.height_m - prev.height_m).toFixed(2) : null,
      diameter_delta: (prev.diameter_cm !== null && cur.diameter_cm !== null) ? +(cur.diameter_cm - prev.diameter_cm).toFixed(2) : null,
      days: (toTime(prev.date) !== null && toTime(cur.date) !== null)
        ? Math.round((toTime(cur.date) - toTime(prev.date)) / 86400000) : null,
    };
    d.age_change = (prev.age_years !== null && cur.age_years !== null && prev.age_years !== cur.age_years)
      ? `${prev.age_years} → ${cur.age_years} 年` : null;
    d.health_change = (d.health_from && d.health_to && d.health_from !== d.health_to) ? `${d.health_from} → ${d.health_to}` : null;
    d.grade_change = (d.grade_from && d.grade_to && d.grade_from !== d.grade_to) ? `${d.grade_from} → ${d.grade_to}` : null;
    steps.push(d);
  }

  const latest = points.length ? points[points.length - 1] : null;
  const baseline = points.length ? points[0] : null;

  return {
    tree_no: no,
    species: (tree && tree.species) || '',
    site: (tree && tree.site) || '',
    parish: (tree && tree.parish) || '',
    current: {
      grade: (tree && tree.grade) || null,
      health: (tree && tree.health) || null,
      height_m: asNum(tree && tree.height_m),
      diameter_cm: asNum(tree && tree.diameter_cm),
      girth_cm: asNum(tree && tree.girth_cm),
      age_years: asNum(tree && tree.age_years),
    },
    points,
    steps,
    baseline,
    latest,
    anomalies: detectAnomalies(points, steps),
    trend: trend(points),
  };
}

/**
 * 線性趨勢：以「有日期且有該欄位值」的點做最小平方擬合。
 * 回傳 { n, slope, intercept, r2, unit, span_days }；點數不足 2 或跨距 < 30 天回 null（不硬湊）。
 */
export function trend(points, field = 'diameter_cm') {
  const pts = (points || [])
    .map((p) => ({ t: toTime(p.date), v: asNum(p[field]) }))
    .filter((p) => p.t !== null && p.v !== null);
  if (pts.length < 2) return null;
  const spanDays = (pts[pts.length - 1].t - pts[0].t) / 86400000;
  if (spanDays < 30) return { n: pts.length, slope: null, r2: null, span_days: Math.round(spanDays), reason: '觀測跨距不足 30 天，不做趨勢擬合' };
  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / (365.25 * 86400000));   // 年
  const ys = pts.map((p) => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return { n: pts.length, slope: null, r2: null, span_days: Math.round(spanDays), reason: '所有觀測同一天' };
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : +((sxy ** 2) / (sxx * syy)).toFixed(4);
  return {
    field, n: pts.length,
    slope: +slope.toFixed(3),          // 每年變化量（與 field 同單位）
    intercept: +intercept.toFixed(3),
    r2,
    span_days: Math.round(spanDays),
    unit: field === 'diameter_cm' ? '公分／年' : '公尺／年',
  };
}

/**
 * 異常與追蹤提醒。全部是可解釋的規則，不做黑箱判斷：
 *  - 胸徑縮小（> 0.5 公分）：可能是量測位置不同、也可能是損傷；一律提出來人工確認。
 *  - 樹高下降（> 0.2 公尺）：通常是修剪或斷折。
 *  - 健康狀況轉差：官方的健康變動屬資料更新；含實地考察的變差則列為異常。
 *  - 官方分級變動：官方資料更新（不是異常），另列。
 *  - 同一株兩次觀測間隔超過 730 天：提醒該安排複查。
 */
export function detectAnomalies(points = [], steps = []) {
  const out = [];
  for (const s of steps) {
    if (s.diameter_delta !== null && s.diameter_delta <= -0.5) {
      out.push({ level: s.to_source === 'field' ? 'warn' : 'info', kind: 'diameter_down', text: `胸徑較上次減少 ${Math.abs(s.diameter_delta)} 公分（${s.from_label} → ${s.to_label}），請確認是否為量測位置差異或損傷` });
    }
    if (s.height_delta !== null && s.height_delta <= -0.2) {
      out.push({ level: 'warn', kind: 'height_down', text: `樹高較上次減少 ${Math.abs(s.height_delta)} 公尺（${s.from_label} → ${s.to_label}），可能是修剪或斷折` });
    }
    if (s.health_change) {
      const from = HEALTH_RANK[s.health_from];
      const to = HEALTH_RANK[s.health_to];
      if (from && to && to < from) {
        out.push({ level: s.to_source === 'official' ? 'info' : 'warn', kind: 'health_worse', text: `健康狀況轉差：${s.health_change}（${s.to_label}）` });
      } else if (from && to && to > from) {
        out.push({ level: 'good', kind: 'health_better', text: `健康狀況改善：${s.health_change}（${s.to_label}）` });
      }
    }
    if (s.grade_change) {
      out.push({ level: 'info', kind: 'grade_change', text: `官方分級更新：${s.grade_change}（${s.to_label}）；分級一律以官方為準` });
    }
    if (s.age_change) {
      out.push({ level: 'info', kind: 'age_change', text: `官方樹齡更新：${s.age_change}（${s.to_label}）；樹齡一律以官方現行值為準` });
    }
    if (s.days !== null && s.days > 730) {
      out.push({ level: 'info', kind: 'long_gap', text: `距上次觀測 ${s.days} 天（超過 2 年），建議安排複查` });
    }
  }
  if (!points.some((p) => p.source === 'field')) {
    out.push({ level: 'info', kind: 'no_field_record', text: '尚無實地考察紀錄：目前只有官方資料的時間點，無法看出樹木本身的變化' });
  }
  return out;
}

/** 全站監測概況（監測分頁上方用）。 */
export function monitoringSummary(series = [], snapshots = [], records = []) {
  const withField = series.filter((s) => s.points.some((p) => p.source === 'field'));
  const officialChanged = series.filter((s) => s.steps.some((x) => x.health_change || x.grade_change || x.age_change
    || (x.diameter_delta !== null && x.diameter_delta !== 0) || (x.height_delta !== null && x.height_delta !== 0)));
  const needAttention = series.filter((s) => (s.anomalies || []).some((a) => a.level === 'warn'));
  const dates = (snapshots || []).map((s) => s.date).filter(Boolean).sort();
  return {
    trees: series.length,
    snapshots: (snapshots || []).length,
    period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    records: (records || []).length,
    with_field_record: withField.length,
    official_changed: officialChanged.length,
    need_attention: needAttention.length,
    changed_trees: officialChanged.map((s) => s.tree_no),
    attention_trees: needAttention.map((s) => ({ tree_no: s.tree_no, species: s.species, reasons: (s.anomalies || []).filter((a) => a.level === 'warn').map((a) => a.text) })),
  };
}

export default {
  toTime, buildSeries, trend, detectAnomalies, monitoringSummary, HEALTH_RANK,
};
