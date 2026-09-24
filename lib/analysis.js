/**
 * 統計與數學模型模組（純函式，無外部相依）
 *
 * 提供：基本統計量、相關係數、最小平方法迴歸（線性／對數／冪律／飽和指數）、
 * 品種啞變數多元迴歸、單因子變異數分析（ANOVA）、卡方獨立性檢定、
 * 分佈函數（F 分佈、卡方分佈）與古樹存續預測模型。
 *
 * 所有函式皆以「資料庫回傳的原始資料點」為輸入，方便在單元測試中以已知答案驗證。
 */

// ─────────────────────────────────────────────────────────────
// 基本統計量
// ─────────────────────────────────────────────────────────────
export const sum = (a) => a.reduce((s, v) => s + v, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);

export function variance(a, sample = true) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - (sample ? 1 : 0));
}
export const sd = (a, sample = true) => Math.sqrt(variance(a, sample));

export function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(a, p) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function skewness(a) {
  const n = a.length, m = mean(a), s = sd(a, false);
  if (!n || !s) return 0;
  return (n / ((n - 1) * (n - 2))) * a.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
}

export function histogram(values, bucketSize) {
  if (!values.length) return [];
  const size = Math.max(1, Math.floor(bucketSize));
  const min = Math.floor(Math.min(...values) / size) * size;
  const max = Math.floor(Math.max(...values) / size) * size + size;
  const bins = [];
  for (let start = min; start < max; start += size) {
    bins.push({ start, end: start + size, count: 0 });
  }
  for (const v of values) {
    const i = Math.min(bins.length - 1, Math.floor((v - min) / size));
    if (i >= 0) bins[i].count += 1;
  }
  return bins;
}

export function contingency(rows, colOf) {
  const table = new Map();
  for (const r of rows) {
    const c = colOf(r);
    table.set(c, (table.get(c) || 0) + 1);
  }
  return table;
}

// ─────────────────────────────────────────────────────────────
// 相關係數
// ─────────────────────────────────────────────────────────────
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = mean(xs.slice(0, n)), my = mean(ys.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function spearman(xs, ys) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

// ─────────────────────────────────────────────────────────────
// 最小平方法迴歸（兩個參數的模型，以高斯牛頓／網格＋精修求解）
// ─────────────────────────────────────────────────────────────
function goodness(ys, pred) {
  const n = ys.length;
  const my = mean(ys);
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    ssRes += (ys[i] - pred[i]) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return {
    n,
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    rmse: Math.sqrt(ssRes / n),
    ssRes,
    ssTot,
    residualSd: n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0,
  };
}

/** 標準化 OLS：給定設計矩陣 X（含截距欄）與 y，以正規方程式求解 */
export function ols(X, y) {
  const n = X.length, k = X[0].length;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < k; a += 1) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b += 1) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const pred = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const stats = goodness(y, pred);
  const dfRes = Math.max(1, n - k);
  const mse = stats.ssRes / dfRes;
  // 係數標準誤與 t 值（(X'X)^-1 的對角線）
  const inv = invert(XtX);
  const se = inv ? beta.map((_, j) => Math.sqrt(Math.max(0, mse * inv[j][j]))) : beta.map(() => 0);
  const t = beta.map((b, j) => (se[j] ? b / se[j] : 0));
  const r2adj = 1 - (1 - stats.r2) * ((n - 1) / dfRes);
  const fStat = k > 1 ? ((stats.ssTot - stats.ssRes) / (k - 1)) / (mse || 1) : 0;
  const pValue = k > 1 ? 1 - fCdf(fStat, k - 1, dfRes) : 1;
  return { beta, se, t, ...stats, dfRes, r2adj, fStat, pValue, mse, order: k };
}

export function linearModel(xs, ys) {
  const X = xs.map((x) => [1, x]);
  const r = ols(X, ys);
  if (!r) return null;
  return { type: 'linear', label: '線性 y = a + b·x', formula: 'y = a + b·x',
    params: { a: r.beta[0], b: r.beta[1] }, r2: r.r2, rmse: r.rmse, n: r.n,
    r2adj: r.r2adj, pValue: r.pValue, predict: (x) => r.beta[0] + r.beta[1] * x };
}

export function logModel(xs, ys) {
  const safe = xs.map((x) => Math.max(x, 1));
  const X = safe.map((x) => [1, Math.log(x)]);
  const r = ols(X, ys);
  if (!r) return null;
  return { type: 'log', label: '對數 y = a + b·ln(x)', formula: 'y = a + b·ln(x)',
    params: { a: r.beta[0], b: r.beta[1] }, r2: r.r2, rmse: r.rmse, n: r.n,
    r2adj: r.r2adj, pValue: r.pValue, predict: (x) => r.beta[0] + r.beta[1] * Math.log(Math.max(x, 1)) };
}

export function powerModel(xs, ys) {
  const pts = xs.map((x, i) => [Math.max(x, 1), ys[i]]).filter(([, y]) => y > 0);
  if (pts.length < 3) return null;
  const X = pts.map((p) => [1, Math.log(p[0])]);
  const logy = pts.map((p) => Math.log(p[1]));
  const r = ols(X, logy);
  if (!r) return null;
  const a = Math.exp(r.beta[0]), b = r.beta[1];
  const pred = xs.map((x) => a * Math.pow(Math.max(x, 1), b));
  const g = goodness(ys, pred);
  return { type: 'power', label: '冪律 y = a·x^b', formula: 'y = a·x^b',
    params: { a, b }, r2: g.r2, rmse: g.rmse, n: g.n, r2adj: g.r2,
    pValue: r.pValue, predict: (x) => a * Math.pow(Math.max(x, 1), b),
    note: g.r2 < 0
      ? 'R² 為負：此模型的預測誤差比「直接用平均樹高」更大，客觀結論是冪律關係在本資料上不成立。'
      : undefined };
}

/** 飽和指數生長曲線 y = A·(1 − e^(−k·x))，以網格搜索＋Nelder–Mead 精修 */
export function saturatingModel(xs, ys) {
  const yMax = Math.max(...ys);
  let best = null;
  const err = (A, k) => {
    let s = 0;
    for (let i = 0; i < xs.length; i += 1) {
      const p = A * (1 - Math.exp(-k * xs[i]));
      s += (ys[i] - p) ** 2;
    }
    return s;
  };
  for (let A = yMax * 0.8; A <= yMax * 1.6; A += yMax * 0.05) {
    for (let k = 0.002; k <= 0.06; k += 0.002) {
      const e = err(A, k);
      if (!best || e < best.e) best = { A, k, e };
    }
  }
  // Nelder–Mead 精修（2 參數）
  let simplex = [
    { p: [best.A, best.k], e: best.e },
    { p: [best.A * 1.02, best.k], e: err(best.A * 1.02, best.k) },
    { p: [best.A, best.k * 1.05], e: err(best.A, best.k * 1.05) },
  ];
  for (let iter = 0; iter < 300; iter += 1) {
    simplex.sort((a, b) => a.e - b.e);
    const [b, g, w] = simplex;
    const c = b.p.map((v, i) => (v + g.p[i]) / 2);
    const r = c.map((v, i) => v + (v - w.p[i]));
    const er = err(r[0], r[1]);
    if (er < b.e) {
      const e = c.map((v, i) => v + 2 * (v - w.p[i]));
      const ee = err(e[0], e[1]);
      simplex[2] = ee < er ? { p: e, e: ee } : { p: r, e: er };
    } else if (er < g.e) {
      simplex[2] = { p: r, e: er };
    } else {
      const ct = c.map((v, i) => v + 0.5 * (w.p[i] - v));
      simplex[2] = { p: ct, e: err(ct[0], ct[1]) };
    }
  }
  simplex.sort((a, b) => a.e - b.e);
  const [A, k] = simplex[0].p;
  const pred = xs.map((x) => A * (1 - Math.exp(-k * x)));
  const g = goodness(ys, pred);
  return { type: 'saturating', label: '飽和指數 y = A·(1 − e^(−k·x))', formula: 'y = A·(1 − e^(−k·x))',
    params: { A, k }, r2: g.r2, rmse: g.rmse, n: g.n, r2adj: g.r2,
    note: '非線性最小平方法（網格搜索＋Nelder–Mead），R² 不計入自由度調整',
    predict: (x) => A * (1 - Math.exp(-k * x)) };
}

/**
 * 品種啞變數多元迴歸：y = a + b·樹齡 + Σ cᵢ·Dᵢ
 * 只對樣本數最多的 topK 個品種建立啞變數，其餘合併為參照組。
 */
export function speciesDummyModel(records, topK = 8) {
  const counts = contingency(records, (r) => r.species);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK).map((e) => e[0]);
  const base = top[top.length - 1];
  const dummies = top.slice(0, -1);
  const X = records.map((r) => [1, r.age_years, ...dummies.map((d) => (r.species === d ? 1 : 0))]);
  const y = records.map((r) => r.height_m);
  const r = ols(X, y);
  if (!r) return null;
  const speciesEffect = dummies.map((d, i) => ({ species: d, coef: r.beta[2 + i], t: r.t[2 + i] }));
  return {
    type: 'species-dummy',
    label: `品種啞變數多元迴歸（參照組：${base}）`,
    formula: 'y = a + b·樹齡 + Σ cᵢ·Dᵢ',
    params: { a: r.beta[0], b: r.beta[1] },
    speciesEffect,
    reference: base,
    terms: dummies.length,
    r2: r.r2, r2adj: r.r2adj, rmse: r.rmse, n: r.n, pValue: r.pValue, fStat: r.fStat,
    agePValue: tToP(r.t[1], r.dfRes),
  };
}

// ─────────────────────────────────────────────────────────────
// 單因子變異數分析（one-way ANOVA）
// ─────────────────────────────────────────────────────────────
export function oneWayAnova(groups) {
  const valid = groups.filter((g) => g.values.length >= 2);
  if (valid.length < 2) return null;
  const all = valid.flatMap((g) => g.values);
  const grand = mean(all);
  let ssBetween = 0, ssWithin = 0;
  for (const g of valid) {
    const m = mean(g.values);
    ssBetween += g.values.length * (m - grand) ** 2;
    ssWithin += g.values.reduce((s, v) => s + (v - m) ** 2, 0);
  }
  const k = valid.length, n = all.length;
  const dfBetween = k - 1, dfWithin = n - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / Math.max(dfWithin, 1);
  const F = msBetween / (msWithin || 1);
  const ssTotal = ssBetween + ssWithin;
  const p = 1 - fCdf(F, dfBetween, Math.max(dfWithin, 1));
  return {
    k, n, dfBetween, dfWithin, ssBetween, ssWithin, ssTotal,
    msBetween, msWithin, F, p,
    eta2: ssTotal ? ssBetween / ssTotal : 0,
    omega2: ssTotal ? Math.max(0, (ssBetween - dfBetween * msWithin) / (ssTotal + msWithin)) : 0,
    groups: valid.map((g) => ({
      name: g.name, n: g.values.length, mean: mean(g.values), sd: sd(g.values),
      median: median(g.values),
      ci95: 1.96 * sd(g.values) / Math.sqrt(g.values.length),
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// 卡方獨立性檢定
// ─────────────────────────────────────────────────────────────
export function chiSquareTest(matrix) {
  const rows = matrix.length, cols = matrix[0].length;
  const rowSum = matrix.map((r) => sum(r));
  const colSum = Array.from({ length: cols }, (_, j) => sum(matrix.map((r) => r[j])));
  const total = sum(rowSum);
  if (!total) return null;
  let chi2 = 0, minExpected = Infinity;
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const e = (rowSum[i] * colSum[j]) / total;
      minExpected = Math.min(minExpected, e);
      if (e > 0) chi2 += (matrix[i][j] - e) ** 2 / e;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const k = Math.min(rows, cols);
  return {
    chi2, df, p: 1 - chi2Cdf(chi2, df),
    cramersV: total ? Math.sqrt(chi2 / (total * Math.max(1, k - 1))) : 0,
    minExpected, total,
  };
}

// ─────────────────────────────────────────────────────────────
// 分佈函數：F 分佈、卡方分佈、t 分佈（以不完全 Beta/Gamma 函數實作）
// ─────────────────────────────────────────────────────────────
function logGamma(z) {
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const zz = z - 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i += 1) x += g[i] / (zz + i + 1);
  const t = zz + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** 正則化不完全 Beta 函數 I_x(a,b) */
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** 正則化不完全 Gamma 函數 P(a,x) */
export function lowerGamma(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a, sumv = 1 / a, del = sumv;
    for (let n = 1; n <= 500; n += 1) {
      ap += 1; del *= x / ap; sumv += del;
      if (Math.abs(del) < Math.abs(sumv) * 1e-14) break;
    }
    return sumv * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 500; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** F 分佈累積分佈函數 P(F ≤ f) */
export function fCdf(f, d1, d2) {
  if (!(f > 0) || d1 <= 0 || d2 <= 0) return 0;
  return incompleteBeta((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2);
}

/** 卡方分佈累積分佈函數 P(χ² ≤ x) */
export function chi2Cdf(x, df) {
  if (x <= 0) return 0;
  return lowerGamma(df / 2, x / 2);
}

/** 學生 t 分佈雙尾 p 值 */
export function tToP(t, df) {
  if (!df || df <= 0) return 1;
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

// ─────────────────────────────────────────────────────────────
// 線性代數：高斯消去法與反矩陣
// ─────────────────────────────────────────────────────────────
export function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let piv = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c += 1) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

export function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col += 1) {
    let piv = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let c = 0; c < 2 * n; c += 1) M[col][c] /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = 0; c < 2 * n; c += 1) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row.slice(n));
}

// ─────────────────────────────────────────────────────────────
// 古樹存續預測模型：N(t) = N₀·S(t) + G(t)
// ─────────────────────────────────────────────────────────────
export const DEFAULT_HAZARDS = { 健康: 0.005, 一般: 0.015, 瀕危: 0.06 };

/**
 * @param {Array} trees  資料庫中的古樹紀錄（含 health、age_years）
 * @param {object} opts  { years, hazards, recruitmentPerYear }
 * @returns {{ years:number[], series:Array, assumptions:object }}
 */
export function survivalProjection(trees, opts = {}) {
  const years = opts.years || 50;
  const hazards = { ...DEFAULT_HAZARDS, ...(opts.hazards || {}) };
  const n0 = trees.length;
  const byHealth = contingency(trees, (t) => t.health);
  // 每年因「新樹跨越 100 年門檻」而晉級的數量：以資料中年齡 95–100 歲的個數估算
  const near = trees.filter((t) => t.age_years < 100).length;
  const recruitment = opts.recruitmentPerYear ?? Math.max(1, Math.round(near / 5) || 2);
  const series = [];
  let alive = { 健康: byHealth.get('健康') || 0, 一般: byHealth.get('一般') || 0, 瀕危: byHealth.get('瀕危') || 0 };
  let total = n0;
  for (let y = 0; y <= years; y += 1) {
    series.push({
      year: 2026 + y,
      健康: Math.round(alive.健康), 一般: Math.round(alive.一般), 瀕危: Math.round(alive.瀕危),
      total: Math.round(total),
      survivedOnly: Math.round(alive.健康 + alive.一般 + alive.瀕危),
    });
    const next = {
      健康: alive.健康 * (1 - hazards.健康),
      一般: alive.一般 * (1 - hazards.一般),
      瀕危: alive.瀕危 * (1 - hazards.瀕危),
    };
    // 新增晉級：以歷史健康比例分配
    const add = recruitment;
    const tot = next.健康 + next.一般 + next.瀕危 || 1;
    next.健康 += add * (next.健康 / tot);
    next.一般 += add * (next.一般 / tot);
    next.瀕危 += add * (next.瀕危 / tot);
    alive = next;
    total = next.健康 + next.一般 + next.瀕危;
  }
  return {
    years: series.map((s) => s.year),
    series,
    n0,
    assumptions: {
      hazards, recruitmentPerYear: recruitment,
      note: '年度風險率與晉級數量為模型假設，非官方預測；僅用於說明「未來古樹數量如何變化」的數學機制。',
    },
  };
}
