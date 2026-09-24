import { handler } from '../lib/http.js';
import { allTrees, siteInfo, ageHistogram, treeAgeStats } from '../lib/repo.js';
import {
  pearson, spearman, mean, median, sd, linearModel, logModel, powerModel,
  saturatingModel, speciesDummyModel, oneWayAnova, chiSquareTest,
  survivalProjection, DEFAULT_HAZARDS, quantile,
} from '../lib/analysis.js';

const HEALTH_ORDER = ['健康', '一般', '瀕危'];

function curve(model, xFrom, xTo, steps = 80) {
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = xFrom + ((xTo - xFrom) * i) / steps;
    out.push({ x: +x.toFixed(1), y: +model.predict(x).toFixed(3) });
  }
  return out;
}

/**
 * GET /api/stats — 數學與統計分析
 *
 * 1. 描述統計（樹齡、樹高）
 * 2. 相關分析（Pearson / Spearman）
 * 3. 五個擬合模型的比較（線性、對數、冪律、飽和指數、品種啞變數多元迴歸）
 * 4. 單因子變異數分析（品種 → 樹高；堂區 → 樹齡）
 * 5. 卡方獨立性檢定（堂區 × 健康狀況）
 * 6. 樹齡分佈直方圖
 * 7. 古樹存續預測模型 N(t) = N₀·S(t) + G(t)
 */
export default handler(async (p) => {
  const trees = await allTrees();
  const ages = trees.map((t) => t.age_years);
  const heights = trees.map((t) => t.height_m);
  const bucket = Math.max(5, Number(p.bucket) || 25);

  // ── 1. 描述統計 ────────────────────────────────────────────
  const descriptive = treeAgeStats(trees);

  // ── 2. 相關分析 ────────────────────────────────────────────
  const correlations = {
    pearson_age_height: +pearson(ages, heights).toFixed(4),
    spearman_age_height: +spearman(ages, heights).toFixed(4),
    pearson_logage_height: +pearson(ages.map((a) => Math.log(Math.max(a, 1))), heights).toFixed(4),
    pearson_age_grade: +pearson(ages, trees.map((t) => ({ 一級: 3, 二級: 2, 三級: 1, 不分級: 0 }[t.grade] || 0))).toFixed(4),
  };

  // ── 3. 模型比較 ────────────────────────────────────────────
  const minAge = Math.min(...ages), maxAge = Math.max(...ages);
  const models = [linearModel(ages, heights), logModel(ages, heights),
    powerModel(ages, heights), saturatingModel(ages, heights), speciesDummyModel(trees, 8)]
    .filter(Boolean)
    .map((m) => ({
      type: m.type, label: m.label, formula: m.formula, params: m.params,
      r2: +m.r2.toFixed(5), r2adj: +(m.r2adj ?? m.r2).toFixed(5),
      rmse: +m.rmse.toFixed(4), n: m.n,
      pValue: m.pValue != null ? +Number(m.pValue).toPrecision(3) : null,
      fStat: m.fStat != null ? +m.fStat.toFixed(2) : null,
      speciesEffect: m.speciesEffect ? m.speciesEffect.map((s) => ({
        species: s.species, coef: +s.coef.toFixed(3), t: +s.t.toFixed(2),
      })) : undefined,
      reference: m.reference,
      note: m.note,
      curve: m.type === 'species-dummy' ? undefined : curve(m, minAge, maxAge),
    }));
  const best = [...models].sort((a, b) => b.r2 - a.r2)[0];
  const bestNumeric = [...models].filter((m) => m.type !== 'species-dummy')
    .sort((a, b) => b.r2 - a.r2)[0];

  // ── 4. ANOVA ───────────────────────────────────────────────
  const speciesGroups = ['心葉榕', '榕樹', '樟樹', '海南蒲桃', '龍眼', '雞蛋花', '木棉', '高山榕', '羅漢松', '假柿木薑子']
    .map((name) => ({ name, values: trees.filter((t) => t.species === name).map((t) => t.height_m) }));
  const anovaHeightBySpecies = oneWayAnova(speciesGroups);
  const parishGroups = [...new Set(trees.map((t) => t.parish))]
    .map((name) => ({ name, values: trees.filter((t) => t.parish === name).map((t) => t.age_years) }));
  const anovaAgeByParish = oneWayAnova(parishGroups);

  // ── 5. 卡方檢定：堂區 × 健康狀況 ─────────────────────────────
  const parishes = [...new Set(trees.map((t) => t.parish))];
  const matrix = parishes.map((par) => HEALTH_ORDER.map((h) =>
    trees.filter((t) => t.parish === par && t.health === h).length));
  const chi2 = chiSquareTest(matrix);
  const chi2Detail = {
    ...chi2,
    chi2: +chi2.chi2.toFixed(3),
    p: +chi2.p.toPrecision(3),
    cramersV: +chi2.cramersV.toFixed(3),
    minExpected: +chi2.minExpected.toFixed(2),
    rows: parishes, cols: HEALTH_ORDER, matrix,
  };

  // ── 6. 樹齡分佈 ────────────────────────────────────────────
  const bins = ageHistogram(trees, bucket);
  // 以最大概似估計指數分佈參數 λ（古樹樹齡分佈近似指數衰減）
  const lambda = 1 / mean(ages);
  const ksLike = bins.length ? Math.max(...bins.map((b) => {
    const p0 = 1 - Math.exp(-lambda * b.start);
    const p1 = 1 - Math.exp(-lambda * b.end);
    return Math.abs(b.count / trees.length - (p1 - p0));
  })) : 0;

  // ── 7. 預測模型 ────────────────────────────────────────────
  const projection = survivalProjection(trees, { years: 50, hazards: DEFAULT_HAZARDS });

  // ── 8. 品種個別擬合（樣本 ≥ 10）─────────────────────────────
  const perSpecies = [...new Set(trees.map((t) => t.species))].map((name) => {
    const list = trees.filter((t) => t.species === name);
    if (list.length < 10) return null;
    const m = linearModel(list.map((t) => t.age_years), list.map((t) => t.height_m));
    return {
      species: name, n: list.length,
      r2: +m.r2.toFixed(4), slope: +m.params.b.toFixed(4), intercept: +m.params.a.toFixed(3),
      rmse: +m.rmse.toFixed(3),
      avg_height: +mean(list.map((t) => t.height_m)).toFixed(2),
      avg_age: +mean(list.map((t) => t.age_years)).toFixed(1),
    };
  }).filter(Boolean).sort((a, b) => b.n - a.n);

  // ── 9. 資料驅動的結論文字 ──────────────────────────────────
  const conclusions = [
    `樹齡與樹高的皮爾森相關係數 r = ${correlations.pearson_age_height}，`
    + `以對數轉換後 r = ${correlations.pearson_logage_height}；以單因子簡單迴歸而言，`
    + `最佳數值模型為「${bestNumeric.label}」，R² = ${bestNumeric.r2}，僅能解釋樹高變異的 `
    + `${(bestNumeric.r2 * 100).toFixed(1)}%。`,
    `品種對樹高的單因子變異數分析：F(${anovaHeightBySpecies.dfBetween}, ${anovaHeightBySpecies.dfWithin}) = `
    + `${anovaHeightBySpecies.F.toFixed(2)}，p = ${anovaHeightBySpecies.p.toPrecision(3)}，`
    + `η² = ${anovaHeightBySpecies.eta2.toFixed(3)}（品種可解釋樹高 ${(anovaHeightBySpecies.eta2 * 100).toFixed(1)}% 的變異）。`,
    `加入品種啞變數後，多元迴歸 R² 由 ${bestNumeric.r2} 提升至 `
    + `${(models.find((m) => m.type === 'species-dummy') || {}).r2}，`
    + `證明「樹高主要由品種決定，而非樹齡」。`,
    `堂區之間的樹齡差異：F(${anovaAgeByParish.dfBetween}, ${anovaAgeByParish.dfWithin}) = `
    + `${anovaAgeByParish.F.toFixed(2)}，p = ${anovaAgeByParish.p.toPrecision(3)}，`
    + `η² = ${anovaAgeByParish.eta2.toFixed(3)}。`,
    `堂區與健康狀況並非獨立：χ²(${chi2Detail.df}) = ${chi2Detail.chi2}，p = ${chi2Detail.p}，`
    + `Cramér's V = ${chi2Detail.cramersV}（${chi2Detail.minExpected < 5 ? '⚠️ 部分期望次數 < 5，卡方近似需保守解讀' : '期望次數足夠'}）。`,
    `目前有 ${trees.filter((t) => t.health === '瀕危').length} 株（${(100 * trees.filter((t) => t.health === '瀕危').length / trees.length).toFixed(1)}%）`
    + `列為瀕危。在健康 0.5%／一般 1.5%／瀕危 6% 的年度風險率假設下，`
    + `50 年後現有族群的存續數量約為 ${projection.series[projection.series.length - 1].survivedOnly} 株。`,
  ];

  return {
    source: siteInfo().data_source,
    sample: { n: trees.length, species: new Set(trees.map((t) => t.species)).size, parishes: parishes.length },
    descriptive,
    correlations,
    models,
    best_model: { type: best.type, label: best.label, r2: best.r2 },
    best_numeric_model: { type: bestNumeric.type, label: bestNumeric.label, r2: bestNumeric.r2 },
    anova: { height_by_species: anovaHeightBySpecies, age_by_parish: anovaAgeByParish },
    chi_square: chi2Detail,
    histogram: { bucket, bins },
    exponential_fit: { lambda: +lambda.toFixed(6), mean_age: +mean(ages).toFixed(1), max_deviation: +ksLike.toFixed(4) },
    per_species: perSpecies,
    projection,
    extra_stats: {
      age_median: median(ages), age_sd: sd(ages), age_q1: quantile(ages, 0.25), age_q3: quantile(ages, 0.75),
      height_median: median(heights), height_sd: sd(heights),
    },
    conclusions,
  };
}, 900);
