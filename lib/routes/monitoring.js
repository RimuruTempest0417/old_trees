import { handler, clientError } from '../http.js';
import { allTrees, getTree, listFieldRecords, siteInfo } from '../repo.js';
import { SNAPSHOTS } from '../official-history.js';
import { DATA_META } from '../data-meta.js';
import { buildSeries, monitoringSummary } from '../monitoring.js';

/**
 * GET /api/monitoring — 監測時間序列
 *
 * 參數：
 *   tree=<編號>       只看一株（回傳完整序列、逐次差異、趨勢、異常）；找不到回 404
 *   only=changed      只看官方資料有變動的株
 *   only=attention    只看需要人工確認的株（異常等級 warn）
 *   only=field        只看已有實地考察紀錄的株
 *   limit（預設 50，0＝全部）
 *   rows=1            連同每株的序列一起回傳（預設只回摘要，避免 658 株的回應過大）
 *
 * 資料來源三個，全部有出處、不估算：
 *   1) 《古樹名錄》官方值（listing）
 *   2) 市政署自然網現行值（逐次快照，data/observations/ → lib/official-history.js）
 *   3) 本站實地考察紀錄（field_records）
 *
 * 【分級鐵律】分級與健康狀況一律官方值；官方的分級變動標為「資料更新」而非異常。
 */
export default handler(async (p) => {
  const rawLimit = p.limit === undefined || p.limit === '' ? (p.all === '1' ? '0' : '50') : String(p.limit);
  const limit = Number(rawLimit);
  const want = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const withRows = p.rows === '1' || p.tree !== undefined;

  const trees = await allTrees();
  // 考察紀錄：一次取回再用株號分組，避免逐株查詢
  let records = [];
  try {
    records = await listFieldRecords(500);
  } catch {
    records = [];   // 讀不到紀錄不應讓整個監測頁掛掉（例如資料庫暫時不可用）
  }
  const byTree = new Map();
  for (const r of records || []) {
    const k = String(r.tree_no);
    if (!byTree.has(k)) byTree.set(k, []);
    byTree.get(k).push(r);
  }

  const series = trees.map((t) => buildSeries(t, {
    listing: {
      grade: t.listing_grade, health: t.listing_health,
      age_years: t.listing_age_years,
      height_m: null, diameter_cm: null, girth_cm: null,
    },
    snapshots: SNAPSHOTS,
    records: byTree.get(String(t.tree_no)) || [],
  }));

  // 單株查詢
  if (p.tree !== undefined && p.tree !== '') {
    const no = String(p.tree).trim();
    const t = await getTree(no);
    if (!t) throw clientError(404, '找不到符合的古樹編號。');
    const s = buildSeries(t, {
      listing: { grade: t.listing_grade, health: t.listing_health, age_years: t.listing_age_years },
      snapshots: SNAPSHOTS,
      records: byTree.get(no) || [],
    });
    return {
      ok: true,
      tree: {
        tree_no: t.tree_no, species: t.species, sci_name: t.sci_name || t.species_sci || null,
        site: t.site, parish: t.parish, age_years: t.age_years,
        grade: t.grade, official_grade: t.official_grade, listing_grade: t.listing_grade,
        health: t.health, official_health: t.official_health, listing_health: t.listing_health,
        age_years: t.age_years, official_age_years: t.official_age_years, listing_age_years: t.listing_age_years,
        height_m: t.height_m, diameter_cm: t.diameter_cm, girth_cm: t.girth_cm,
      },
      series: s,
      field_records: (byTree.get(no) || []).length,
      trend: s.trend,
      snapshots: SNAPSHOTS.map((x) => ({ date: x.date, hash: x.hash, fetched_at: x.fetched_at })),
      data: DATA_META,
      source: siteInfo().data_source,
    };
  }

  const summary = monitoringSummary(series, SNAPSHOTS, records);
  let rows = series.map((s) => ({
    tree_no: s.tree_no, species: s.species, site: s.site, parish: s.parish,
    grade: s.current.grade, health: s.current.health,
    points: s.points.length,
    field_records: s.points.filter((x) => x.source === 'field').length,
    changes: s.steps
      .filter((x) => x.health_change || x.grade_change || x.age_change || x.diameter_delta || x.height_delta)
      .map((x) => ({
        date: x.to, from: x.from_label, to: x.to_label,
        health: x.health_change, grade: x.grade_change, age: x.age_change,
        height_delta: x.height_delta, diameter_delta: x.diameter_delta,
      })),
    anomalies: (s.anomalies || []).map((a) => ({ level: a.level, kind: a.kind, text: a.text })),
  }));

  const only = String(p.only || '').trim();
  if (only === 'changed') rows = rows.filter((r) => r.changes.length);
  if (only === 'attention') rows = rows.filter((r) => r.anomalies.some((a) => a.level === 'warn'));
  if (only === 'field') rows = rows.filter((r) => r.field_records > 0);
  rows.sort((a, b) => (b.changes.length - a.changes.length)
    || (b.anomalies.filter((x) => x.level === 'warn').length - a.anomalies.filter((x) => x.level === 'warn').length)
    || String(a.tree_no).localeCompare(String(b.tree_no), 'zh-Hant'));

  const total = rows.length;
  if (want) rows = rows.slice(0, want);
  // 精簡模式（未指定 rows=1）只省略每株的完整序列（points／steps），
  // changes 必須保持「陣列」——2026-09-25 曾把這裡換成筆數（數字），
  // 前端 `r.changes.map(...)` 直接 TypeError，整個分頁掛掉。
  if (!withRows) rows = rows.map(({ points, steps, ...rest }) => rest);

  return {
    ok: true,
    count: rows.length,
    total,
    summary,
    method: {
      sources: [
        { id: 'listing', label: '《古樹名錄》官方值' },
        { id: 'official', label: '市政署自然網現行值（逐次快照存檔）' },
        { id: 'field', label: '本站實地考察紀錄' },
      ],
      trend: '線性最小平方擬合（每年變化量、R²），觀測跨距需 ≥ 30 天；不足時只顯示「無法擬合」並說明原因',
      rules: [
        '缺值不做內插、不用平均值填補；只比較兩邊都有值的欄位',
        '胸徑較前次減少 ≥ 0.5 公分、樹高減少 ≥ 0.2 公尺 → 提列人工確認',
        '官方分級／健康狀況變動屬官方資料更新，標示為資訊而非異常',
        '同一株距上次觀測超過 730 天 → 提醒安排複查',
      ],
    },
    snapshots: SNAPSHOTS.map((s) => ({ date: s.date, hash: s.hash, fetched_at: s.fetched_at })),
    items: rows,
    data: DATA_META,
    source: siteInfo().data_source,
  };
}, 900);
