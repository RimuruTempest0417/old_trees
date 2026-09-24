/** 數據分析：描述統計、五個擬合模型比較、ANOVA、卡方檢定、存續預測。 */
import { api, cached } from './api.js';
import { esc, num, pct, fmtP, loading, downloadCsv } from './ui.js';
import { barChart, scatterWithFit, stackedBar, lineChart, destroyAll, PALETTE, HEALTH_COLORS } from './charts.js';

function modelTable(models) {
  return `
    <div class="table-wrap">
      <table class="data">
        <caption>以最小平方法擬合樹高（應變數）對樹齡（自變數）；R² 愈接近 1 表示解釋力愈強。</caption>
        <thead><tr>
          <th>模型</th><th>形式</th><th>參數</th>
          <th class="num">R²</th><th class="num">調整後 R²</th><th class="num">RMSE</th>
          <th class="num">n</th><th class="num">p 值</th>
        </tr></thead>
        <tbody>
          ${models.map((m) => `
            <tr>
              <td><strong>${esc(m.label)}</strong></td>
              <td class="mono tiny">${esc(m.formula)}</td>
              <td class="mono tiny">${Object.entries(m.params).map(([k, v]) => `${esc(k)}=${num(v, 4)}`).join(', ')}</td>
              <td class="num">${num(m.r2, 4)}</td>
              <td class="num">${num(m.r2adj, 4)}</td>
              <td class="num">${num(m.rmse, 3)}</td>
              <td class="num">${num(m.n)}</td>
              <td class="num">${m.pValue == null ? '—' : fmtP(m.pValue)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function anovaBlock(a, unit) {
  if (!a) return '<p class="muted small">樣本不足，無法進行變異數分析。</p>';
  return `
    <div class="table-wrap">
      <table class="data">
        <caption>單因子變異數分析：${esc(unit)}</caption>
        <thead><tr><th>變異來源</th><th class="num">平方和 SS</th><th class="num">自由度 df</th><th class="num">均方 MS</th><th class="num">F</th><th class="num">p 值</th></tr></thead>
        <tbody>
          <tr><td>組間（between）</td><td class="num">${num(a.ssBetween, 1)}</td><td class="num">${a.dfBetween}</td><td class="num">${num(a.msBetween, 1)}</td><td class="num" rowspan="2"><strong>${num(a.F, 2)}</strong></td><td class="num" rowspan="2">${fmtP(a.p)}</td></tr>
          <tr><td>組內（within）</td><td class="num">${num(a.ssWithin, 1)}</td><td class="num">${a.dfWithin}</td><td class="num">${num(a.msWithin, 1)}</td></tr>
          <tr><td>總變異</td><td class="num">${num(a.ssTotal, 1)}</td><td class="num">${a.n - 1}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
        </tbody>
      </table>
    </div>
    <p class="small" style="margin-top:.5rem">
      效果量 η² = <strong>${num(a.eta2, 3)}</strong>（可解釋的變異比例）、ω² = ${num(a.omega2, 3)}；
      ${a.p < 0.05 ? '在 α=0.05 下達統計顯著。' : '在 α=0.05 下未達統計顯著，組間差異可能來自隨機抽樣。'}
    </p>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>組別</th><th class="num">n</th><th class="num">平均</th><th class="num">標準差</th><th class="num">中位數</th><th class="num">95% 信賴區間半寬</th></tr></thead>
        <tbody>${a.groups.map((g) => `
          <tr><td>${esc(g.name)}</td><td class="num">${num(g.n)}</td><td class="num">${num(g.mean, 2)}</td>
          <td class="num">${num(g.sd, 2)}</td><td class="num">${num(g.median, 2)}</td><td class="num">±${num(g.ci95, 2)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export async function render(section, params) {
  section.innerHTML = `<div class="page-head"><h1>數據分析</h1>
    <p>本頁所有數字皆由資料庫即時計算，採用的演算法（最小平方法、牛頓法非線性擬合、F 與卡方分佈函數）
    皆實作於 <code>lib/analysis.js</code>，並有單元測試驗證。</p></div>
    <div id="an-body">${loading('正在計算統計模型…')}</div>`;

  const stats = await cached('stats', () => api.stats());
  const body = section.querySelector('#an-body');
  const m = stats.models;
  const primary = m.find((x) => x.type === 'species-dummy');
  const numeric = m.filter((x) => x.type !== 'species-dummy');
  const bestNumeric = stats.best_numeric_model;
  const projection = stats.projection;

  body.innerHTML = `
    <div class="grid grid-4">
      <div class="card kpi"><span class="kpi-value">${num(stats.sample.n)}</span><span class="kpi-label">分析樣本數</span><span class="kpi-hint">${num(stats.sample.species)} 個樹種・${num(stats.sample.parishes)} 個堂區</span></div>
      <div class="card kpi"><span class="kpi-value">${num(stats.correlations.pearson_age_height, 3)}</span><span class="kpi-label">樹齡與樹高之 r</span><span class="kpi-hint">皮爾森相關係數</span></div>
      <div class="card kpi"><span class="kpi-value">${num(bestNumeric.r2, 4)}</span><span class="kpi-label">最佳數值模型 R²</span><span class="kpi-hint">${esc(bestNumeric.label)}</span></div>
      <div class="card kpi"><span class="kpi-value">${num(primary.r2, 4)}</span><span class="kpi-label">加入品種啞變數後 R²</span><span class="kpi-hint">提升 ${num((primary.r2 - bestNumeric.r2) * 100, 1)} 個百分點</span></div>
      <div class="card kpi"><span class="kpi-value">${num(stats.anova.height_by_species.F, 1)}</span><span class="kpi-label">品種對樹高的 F 值</span><span class="kpi-hint">p = ${fmtP(stats.anova.height_by_species.p)}・η² = ${num(stats.anova.height_by_species.eta2, 3)}</span></div>
      <div class="card kpi"><span class="kpi-value">${num(stats.chi_square.chi2, 1)}</span><span class="kpi-label">堂區 × 健康 χ²</span><span class="kpi-hint">df=${stats.chi_square.df}・p = ${fmtP(stats.chi_square.p)}・V = ${num(stats.chi_square.cramersV, 3)}</span></div>
      <div class="card kpi"><span class="kpi-value">${num(stats.descriptive.age.median, 0)}</span><span class="kpi-label">樹齡中位數</span><span class="kpi-hint">平均 ${num(stats.descriptive.age.mean, 1)}・標準差 ${num(stats.descriptive.age.sd, 1)}</span></div>
      <div class="card kpi"><span class="kpi-value">${num(projection.series[projection.series.length - 1].survivedOnly)}</span><span class="kpi-label">50 年後現有族群存續數（模型估計）</span><span class="kpi-hint">假設年度風險率 健康 0.5%／一般 1.5%／瀕危 6%</span></div>
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>① 樹齡分佈直方圖</h2>
        <p class="tiny muted">以 ${num(stats.histogram.bucket)} 年為一組。分佈呈明顯右偏，多數古樹集中在 100–150 年，樹齡愈高個體愈少。</p>
        <div class="chart-box"><canvas id="c-hist"></canvas></div>
      </div>
      <div class="card">
        <h2>② 樹齡—樹高散點圖與擬合</h2>
        <div class="chips" id="fit-picker" style="margin-bottom:.5rem">
          ${numeric.map((x, i) => `<button class="chip${i === 0 ? ' active' : ''}" data-fit="${esc(x.type)}">${esc(x.type === 'linear' ? '線性' : x.type === 'log' ? '對數' : x.type === 'power' ? '冪律' : '飽和指數')} R²=${num(x.r2, 3)}</button>`).join('')}
        </div>
        <div class="chart-box tall"><canvas id="c-scatter"></canvas></div>
        <p class="tiny muted" id="fit-note" style="margin-top:.4rem"></p>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>③ 模型比較表</h2>
      ${modelTable(m)}
      <p class="small" style="margin-top:.6rem">
        加入品種啞變數後 R² 由 <strong>${num(bestNumeric.r2, 4)}</strong> 大幅提升至
        <strong>${num(primary.r2, 4)}</strong>，說明<b>樹高的主要決定因素是品種（基因），而非樹齡</b>。
        樹齡影響的是樹的「粗度、材積與碳儲量」，這一點在生物學上與樹木的異速生長（allometry）理論一致。
      </p>
      ${m.some((x) => x.r2 < 0) ? `<div class="notice small">
        <strong>關於負的 R²：</strong>${m.filter((x) => x.r2 < 0).map((x) => x.label).join('、')}
        的 R² 小於 0。這不是計算錯誤，而是「此模型比直接用平均樹高預測更差」的客觀結論——
        也就是說，樹齡與樹高之間不存在這類函數關係。科學上寧可誠實報告，也不要挑一個看起來好看的模型。
      </div>` : ''}
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>④ 變異數分析：品種 → 樹高</h2>
        ${anovaBlock(stats.anova.height_by_species, '依品種（前 10 大品種）對樹高的差異')}
      </div>
      <div class="card card-scroll">
        <h2>⑤ 各品種平均樹高</h2>
        <div class="chart-box short"><canvas id="c-spheight"></canvas></div>
        <p class="tiny muted">誤差由標準差反映；可見榕屬（心葉榕、榕樹、高山榕）與木棉、鳳凰木等明顯高於灌木型樹種。</p>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card card-scroll">
        <h2>⑥ 變異數分析：堂區 → 樹齡</h2>
        ${anovaBlock(stats.anova.age_by_parish, '依堂區對樹齡的差異')}
      </div>
      <div class="card">
        <h2>⑦ 卡方獨立性檢定：堂區 × 健康狀況</h2>
        <div class="table-wrap">
          <table class="data">
            <caption>χ²(${stats.chi_square.df}) = ${num(stats.chi_square.chi2, 3)}，p = ${fmtP(stats.chi_square.p)}，Cramér's V = ${num(stats.chi_square.cramersV, 3)}</caption>
            <thead><tr><th>堂區</th>${stats.chi_square.cols.map((c) => `<th class="num">${esc(c)}</th>`).join('')}<th class="num">小計</th></tr></thead>
            <tbody>
              ${stats.chi_square.rows.map((p, i) => {
    const row = stats.chi_square.matrix[i];
    return `<tr><td>${esc(p)}</td>${row.map((v) => `<td class="num">${num(v)}</td>`).join('')}<td class="num"><strong>${num(row.reduce((a, b) => a + b, 0))}</strong></td></tr>`;
  }).join('')}
            </tbody>
          </table>
        </div>
        <p class="small" style="margin-top:.5rem">
          ${stats.chi_square.minExpected < 5
    ? `⚠️ 最小期望次數 = ${num(stats.chi_square.minExpected, 2)}（&lt;5），卡方近似在此情況下需保守解讀，宜改用 Fisher 精確檢定或合併類別。`
    : `最小期望次數 = ${num(stats.chi_square.minExpected, 2)}（≥5），符合卡方檢定的適用條件。`}
          ${stats.chi_square.p < 0.05 ? '結果顯示堂區與健康狀況並非獨立。' : '未能拒絕獨立的虛無假設。'}
        </p>
        <div class="chart-box short"><canvas id="c-chi"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>⑧ 未來 50 年古樹數量預測（模型）</h2>
        <p class="tiny muted">模型：N(t) = N₀·S(t) + G(t)。S(t) 由各健康等級年度風險率推算，G(t) 為每年新晉級（跨越 100 年門檻）株數 ${num(projection.assumptions.recruitmentPerYear)} 株。</p>
        <div class="chart-box"><canvas id="c-proj"></canvas></div>
        <p class="small muted">${esc(projection.assumptions.note)}</p>
      </div>
      <div class="card card-scroll">
        <h2>⑨ 各品種個別擬合（樣本 ≥10）</h2>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>品種</th><th class="num">n</th><th class="num">平均樹齡</th><th class="num">平均樹高</th><th class="num">斜率 b</th><th class="num">R²</th></tr></thead>
            <tbody>${stats.per_species.map((s) => `
              <tr><td>${esc(s.species)}</td><td class="num">${num(s.n)}</td><td class="num">${num(s.avg_age, 1)}</td>
              <td class="num">${num(s.avg_height, 2)}</td><td class="num">${num(s.slope, 4)}</td><td class="num">${num(s.r2, 3)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="tiny muted">即使在同一品種內，樹齡對樹高的解釋力仍然有限，進一步支持「品種 ＋ 立地條件主導樹高」的結論。</p>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>⑩ 由資料得出的結論</h2>
      <ol class="small">
        ${stats.conclusions.map((c) => `<li>${esc(c)}</li>`).join('')}
      </ol>
      <div class="row" style="margin-top:.7rem">
        <button class="btn btn-sm" id="dl-stats">匯出模型參數 CSV</button>
        <button class="btn btn-sm" id="dl-raw">匯出分析用原始資料 CSV</button>
      </div>
    </div>`;

  // ── 圖表 ──────────────────────────────────────────────
  const bins = stats.histogram.bins.filter((b) => b.count > 0);
  barChart(body.querySelector('#c-hist'), bins.map((b) => `${b.start}–${b.end}`), bins.map((b) => b.count),
    { label: '株數', colors: PALETTE[1], yTitle: '株數', xTitle: '樹齡（年）' });

  const points = await cached('scatter', async () => {
    const all = await api.trees({ limit: 2000 });
    return all.trees.map((t) => ({ x: t.age_years, y: t.height_m }));
  });

  let currentFit = numeric[0];
  function drawFit() {
    const fit = m.find((x) => x.type === currentFit.type);
    scatterWithFit(
      body.querySelector('#c-scatter'),
      points,
      fit.curve || [],
      { xTitle: '樹齡（年）', yTitle: '樹高（公尺）', fitLabel: `${fit.label}（R²=${num(fit.r2, 4)}）` },
    );
    body.querySelector('#fit-note').textContent =
      `目前顯示：${fit.label}；R² = ${num(fit.r2, 4)}、RMSE = ${num(fit.rmse, 3)}、n = ${num(fit.n)}。`
      + `散佈圖顯示同一樹齡對應的樹高差距極大，這正是單一自變數模型無法解釋樹高的視覺證據。`;
  }
  drawFit();
  body.querySelectorAll('#fit-picker .chip').forEach((chip) => chip.addEventListener('click', () => {
    body.querySelectorAll('#fit-picker .chip').forEach((c) => c.classList.toggle('active', c === chip));
    currentFit = m.find((x) => x.type === chip.dataset.fit);
    drawFit();
  }));

  const spTop = stats.anova.height_by_species.groups.slice(0, 10);
  barChart(body.querySelector('#c-spheight'),
    spTop.map((g) => `${g.name} (${g.n})`),
    spTop.map((g) => +g.mean.toFixed(2)),
    { label: '平均樹高 (m)', colors: PALETTE[5], horizontal: true, yTitle: '公尺' });

  const chiRows = stats.anova.age_by_parish ? stats.chi_square.rows : [];
  stackedBar(body.querySelector('#c-chi'),
    chiRows.map((p) => p.replace('堂區', '')),
    ['健康', '一般', '瀕危'].map((h, hi) => ({
      label: h,
      data: stats.chi_square.matrix.map((row) => row[hi]),
      backgroundColor: HEALTH_COLORS[h],
      borderRadius: 4,
    })),
    { yTitle: '株數' });

  const years = projection.series.map((s) => s.year);
  lineChart(body.querySelector('#c-proj'), years, [
    { label: '總數（含新晉級）', data: projection.series.map((s) => s.total), borderColor: '#166534', backgroundColor: 'rgba(34,163,92,.18)', fill: true, borderWidth: 2.5 },
    { label: '現有族群存續數', data: projection.series.map((s) => s.survivedOnly), borderColor: '#b45309', backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 4] },
    { label: '瀕危株數', data: projection.series.map((s) => s.瀕危), borderColor: '#b91c1c', backgroundColor: 'transparent', borderWidth: 2 },
  ], { xTitle: '年份', yTitle: '株數' });

  // ── 匯出 ──────────────────────────────────────────────
  body.querySelector('#dl-stats').addEventListener('click', () => {
    downloadCsv('古樹分析_模型參數.csv', m.map((x) => ({
      模型: x.label, 形式: x.formula,
      參數: Object.entries(x.params).map(([k, v]) => `${k}=${v.toFixed(6)}`).join('; '),
      R2: x.r2, 調整後R2: x.r2adj, RMSE: x.rmse, n: x.n, p值: x.pValue ?? '',
    })));
  });
  body.querySelector('#dl-raw').addEventListener('click', async () => {
    const all = await api.trees({ limit: 2000 });
    downloadCsv('古樹分析_原始資料點.csv', all.trees.map((t) => ({
      古樹編號: t.tree_no, 品種: t.species, 樹齡: t.age_years, 樹高公尺: t.height_m,
      分級: t.grade, 健康狀況: t.health, 堂區: t.parish, 地點: t.site,
    })));
  });

  return { destroy: () => destroyAll(section) };
}
