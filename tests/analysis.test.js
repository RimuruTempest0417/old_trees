import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mean, median, variance, sd, quantile, histogram, pearson, spearman,
  linearModel, logModel, powerModel, saturatingModel, speciesDummyModel,
  oneWayAnova, chiSquareTest, fCdf, chi2Cdf, tToP, incompleteBeta,
  ols, solve, invert, survivalProjection, DEFAULT_HAZARDS,
} from '../lib/analysis.js';

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `期望 ${b}，實際 ${a}（容差 ${tol}）`);

test('描述統計：mean / median / variance / sd / quantile', () => {
  const x = [2, 4, 4, 4, 5, 5, 7, 9];
  close(mean(x), 5);
  close(median(x), 4.5);
  close(variance(x), 32 / 7, 1e-9);   // 樣本變異數
  close(variance(x, false), 4, 1e-9); // 母體變異數
  close(sd(x, false), 2, 1e-9);
  close(quantile(x, 0.5), 4.5);
  close(quantile(x, 0), 2);
  close(quantile(x, 1), 9);
});

test('直方圖分箱：總數守恆', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 101, 102];
  const bins = histogram(values, 10);
  assert.equal(bins.reduce((s, b) => s + b.count, 0), values.length);
  assert.ok(bins.every((b) => b.end - b.start === 10));
});

test('皮爾森相關係數：完全正相關 = 1、完全負相關 = −1', () => {
  close(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12);
  close(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-12);
  close(pearson([1, 2, 3, 4], [1, 2, 3, 4].map(() => 5)), 0, 1e-12);
});

test('斯皮爾曼等級相關：單調但非線性 → 1', () => {
  close(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]), 1, 1e-12);
});

test('線性迴歸：與已知答案一致（y = 1 + 2x 完全擬合）', () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = xs.map((x) => 1 + 2 * x);
  const m = linearModel(xs, ys);
  close(m.params.a, 1, 1e-9);
  close(m.params.b, 2, 1e-9);
  close(m.r2, 1, 1e-9);
  close(m.rmse, 0, 1e-9);
  close(m.predict(10), 21, 1e-9);
});

test('線性迴歸：經典最小平方例子 y=[1,2,3,3,4] on x=[1..5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = [1, 2, 3, 3, 4];
  const m = linearModel(xs, ys);
  // 手算：Sxy=7.0, Sxx=10 → b=0.7；a = ȳ − b·x̄ = 2.6 − 2.1 = 0.5
  close(m.params.b, 0.7, 1e-9);
  close(m.params.a, 0.5, 1e-9);
  // SSR=0.30, SST=5.20 → R² = 1 − 0.3/5.2 = 0.94230769…
  close(m.r2, 1 - 0.3 / 5.2, 1e-9);
  close(m.rmse, Math.sqrt(0.3 / 5), 1e-9);
});

test('對數與冪律迴歸可還原已知模型', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const ysLog = xs.map((x) => 3 + 2 * Math.log(x));
  close(logModel(xs, ysLog).params.b, 2, 1e-8);
  close(logModel(xs, ysLog).r2, 1, 1e-8);

  const ysPow = xs.map((x) => 4 * Math.pow(x, 1.5));
  const pm = powerModel(xs, ysPow);
  close(pm.params.a, 4, 1e-6);
  close(pm.params.b, 1.5, 1e-6);
  close(pm.r2, 1, 1e-8);
});

test('飽和指數模型可還原 A=20, k=0.05', () => {
  const xs = Array.from({ length: 80 }, (_, i) => (i + 1) * 5);
  const ys = xs.map((x) => 20 * (1 - Math.exp(-0.05 * x)));
  const m = saturatingModel(xs, ys);
  assert.ok(Math.abs(m.params.A - 20) < 0.6, `A=${m.params.A}`);
  assert.ok(Math.abs(m.params.k - 0.05) < 0.004, `k=${m.params.k}`);
  assert.ok(m.r2 > 0.9999, `R²=${m.r2}`);
});

test('OLS 線性代數：solve 與 invert 正確', () => {
  const A = [[2, 1], [1, 3]];
  const b = [5, 10];
  const x = solve(A, b);
  close(x[0], 1, 1e-9);
  close(x[1], 3, 1e-9);
  const inv = invert(A);
  close(inv[0][0], 3 / 5, 1e-9);
  close(inv[0][1], -1 / 5, 1e-9);
  close(inv[1][1], 2 / 5, 1e-9);
  assert.equal(solve([[1, 1], [1, 1]], [1, 2]), null); // 奇異矩陣
});

test('OLS 多元迴歸：能精確還原 y = 2 + 3·x₁ − 1·x₂', () => {
  const X = [[1, 0, 1], [1, 1, 0], [1, 2, 1], [1, 3, 0], [1, 4, 1], [1, 5, 0]];
  const y = X.map(([, a, b]) => 2 + 3 * a - 1 * b);
  const r = ols(X, y);
  assert.ok(r, 'OLS 應回傳結果');
  close(r.beta[0], 2, 1e-9);
  close(r.beta[1], 3, 1e-9);
  close(r.beta[2], -1, 1e-9);
  close(r.r2, 1, 1e-9);
  assert.equal(r.dfRes, 3);
  assert.ok(r.se.every((s) => Number.isFinite(s)));
});

test('單因子變異數分析：組間無差異時 F≈0，組間有差異時 F 大', () => {
  const same = oneWayAnova([
    { name: 'A', values: [10, 11, 12, 11, 10] },
    { name: 'B', values: [10, 12, 11, 10, 11] },
  ]);
  assert.ok(same.F < 0.5, `F=${same.F}`);
  assert.ok(same.p > 0.5, `p=${same.p}`);

  const diff = oneWayAnova([
    { name: 'A', values: [1, 2, 3, 2, 1] },
    { name: 'B', values: [11, 12, 13, 12, 11] },
  ]);
  assert.ok(diff.F > 50, `F=${diff.F}`);
  assert.ok(diff.p < 0.01, `p=${diff.p}`);
  assert.ok(diff.eta2 > 0.9, `eta2=${diff.eta2}`);
  assert.equal(diff.dfBetween, 1);
  assert.equal(diff.dfWithin, 8);
});

test('F 分佈 CDF 對照已知臨界值（α=0.05）', () => {
  close(fCdf(1, 1, 1), 0.5, 1e-9);   // F(1,1)：CDF(x) = (2/π)·arctan(√x)
  assert.ok(Math.abs(fCdf(2.696, 3, 100) - 0.95) < 5e-3, `F(3,100)@0.95=${fCdf(2.696, 3, 100)}`);
  assert.ok(Math.abs(fCdf(3.94, 1, 100) - 0.95) < 5e-3, `F(1,100)@0.95=${fCdf(3.94, 1, 100)}`);
  assert.ok(Math.abs(fCdf(4.96, 1, 10) - 0.95) < 5e-3, `F(1,10)@0.95=${fCdf(4.96, 1, 10)}`);
  assert.ok(Math.abs(fCdf(3.98, 3, 100) - 0.99) < 5e-3, `F(3,100)@0.99=${fCdf(3.98, 3, 100)}`);
});

test('卡方分佈 CDF 對照已知臨界值', () => {
  assert.ok(Math.abs(chi2Cdf(3.841, 1) - 0.95) < 1e-3, `χ²(1)@0.95=${chi2Cdf(3.841, 1)}`);
  assert.ok(Math.abs(chi2Cdf(5.991, 2) - 0.95) < 1e-3, `χ²(2)@0.95=${chi2Cdf(5.991, 2)}`);
  assert.ok(Math.abs(chi2Cdf(11.07, 5) - 0.95) < 1e-3, `χ²(5)@0.95=${chi2Cdf(11.07, 5)}`);
});

test('t 分佈雙尾 p 值對照已知臨界值', () => {
  assert.ok(Math.abs(tToP(2.228, 10) - 0.05) < 2e-3, `t(10)@0.05=${tToP(2.228, 10)}`);
  assert.ok(Math.abs(tToP(1.96, 1e6) - 0.05) < 1e-3, `t(∞)@0.05=${tToP(1.96, 1e6)}`);
  assert.ok(Math.abs(tToP(1.812, 10) - 0.10) < 2e-3, `t(10)@0.10=${tToP(1.812, 10)}`);
});

test('不完全 Beta 函數：對稱性 I_x(a,b) = 1 − I_{1−x}(b,a)', () => {
  for (const [x, a, b] of [[0.3, 2, 5], [0.7, 4, 3], [0.15, 1, 1]]) {
    close(incompleteBeta(x, a, b), 1 - incompleteBeta(1 - x, b, a), 1e-9);
  }
  close(incompleteBeta(0.5, 1, 1), 0.5, 1e-12);
});

test('卡方獨立性檢定：完全獨立 → χ²≈0；完全相關 → χ² 極大', () => {
  const indep = chiSquareTest([[50, 50], [50, 50]]);
  close(indep.chi2, 0, 1e-9);
  assert.equal(indep.df, 1);
  const strong = chiSquareTest([[100, 0], [0, 100]]);
  assert.ok(strong.chi2 > 190, `χ²=${strong.chi2}`);
  assert.ok(strong.p < 1e-30);
  assert.ok(strong.cramersV > 0.9);
});

test('品種啞變數迴歸：加入品種後 R² 不低於單純線性模型', () => {
  // 造出「品種決定樹高、樹齡幾乎無關」的資料
  const records = [];
  for (let i = 0; i < 40; i += 1) {
    records.push({ species: 'A', age_years: 100 + i, height_m: 20 + (i % 5) });
    records.push({ species: 'B', age_years: 100 + i, height_m: 8 + (i % 5) });
  }
  const dummy = speciesDummyModel(records, 2);
  const linear = linearModel(records.map((r) => r.age_years), records.map((r) => r.height_m));
  assert.ok(dummy.r2 > linear.r2, `dummy R²=${dummy.r2} 應大於 linear R²=${linear.r2}`);
  assert.ok(dummy.r2 > 0.85, `dummy R²=${dummy.r2}`);
  assert.equal(dummy.speciesEffect.length, 1); // 2 個品種 → 1 個啞變數
});

test('存續預測模型：單調、守恆且與風險率相符', () => {
  const trees = [
    ...Array.from({ length: 100 }, () => ({ health: '健康', age_years: 150 })),
    ...Array.from({ length: 100 }, () => ({ health: '一般', age_years: 200 })),
    ...Array.from({ length: 100 }, () => ({ health: '瀕危', age_years: 300 })),
  ];
  const p = survivalProjection(trees, { years: 10, recruitmentPerYear: 0 });
  assert.equal(p.series[0].total, 300);
  // 10 年後僅存活的數量（無新血）
  const expected = 100 * (1 - DEFAULT_HAZARDS['健康']) ** 10
                 + 100 * (1 - DEFAULT_HAZARDS['一般']) ** 10
                 + 100 * (1 - DEFAULT_HAZARDS['瀕危']) ** 10;
  assert.ok(Math.abs(p.series[10].survivedOnly - expected) <= 1.5,
    `預測 ${p.series[10].survivedOnly} vs 解析解 ${expected.toFixed(1)}`);
  // 單調遞減
  for (let i = 1; i < p.series.length; i += 1) {
    assert.ok(p.series[i].survivedOnly <= p.series[i - 1].survivedOnly + 1e-9);
  }
  // 有新增時總數應上升
  const q = survivalProjection(trees, { years: 10, recruitmentPerYear: 20 });
  assert.ok(q.series[10].total > p.series[10].total);
});
