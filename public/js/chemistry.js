/**
 * 化學視角（#/chemistry）—— 官方環境數據與化學機制的呈現
 *
 * 把官方環境監測數據（環保局《澳門環境狀況報告2025》、氣象局《澳門空氣質量監測統計年度報告2025》）
 * 與本站的古樹資料放在一起看，並把「酸雨 → 土壤酸化 → 根系受害」、「水泥／鋪面 → 鹼性微環境與缺氧」
 * 這些機制的化學式與出處列清楚。
 *
 * 【誠實原則】
 *   - 只呈現官方公布的數字；沒有官方來源的數字一律不寫（例如 2000 年後的降雨 pH 就明說找不到）。
 *   - 區域空氣背景值 ≠ 某一株古樹的實測值，畫面上必須說清楚。
 *   - 空污背景與古樹健康只有並列對照，相關不等於因果。
 */
import { api, cached } from './api.js';
import { esc, num, loading, toast, copyText, downloadCsv, healthBadge, errDetail } from './ui.js';
import { lineChart, barChart, destroyAll } from './charts.js';

function kpiCard(k) {
  const std = k.standard === null || k.standard === undefined
    ? '<span class="muted small">官方未設年平均標準</span>'
    : `<span class="small ${k.compliant ? 'tone-good' : 'tone-danger'}">標準 ${num(k.standard)} ${esc(k.unit)}・${k.compliant ? '達標' : '超出'}（${num(k.pct_of_standard)}%）</span>`;
  const trend = k.trend === null || k.trend === undefined
    ? ''
    : `<span class="small muted">較 2024 年 ${k.trend > 0 ? '+' : ''}${num(k.trend, 2)}</span>`;
  return `
    <div class="stat">
      <div class="stat-label">${esc(k.label.split('（')[0])}</div>
      <div class="stat-value">${num(k.mean, 1)}<span class="stat-unit">${esc(k.unit)}</span></div>
      <div>${std}</div>
      <div>${trend}</div>
    </div>`;
}

function stationTable(air, year) {
  const pols = air.display_order;
  const head = pols.map((p) => `<th>${esc(p)}${air.pollutants[p].standard_annual ? `<br><span class="muted tiny">標準 ${num(air.pollutants[p].standard_annual)}</span>` : ''}</th>`).join('');
  const rows = air.stations.map((s) => {
    const cells = pols.map((p) => {
      const v = air.years[String(year)][p].by_station[s];
      const std = air.pollutants[p].standard_annual;
      const over = std !== null && std !== undefined && v !== undefined && v > std;
      return `<td${over ? ' class="tone-danger"' : ''}>${v === undefined ? '—' : num(v, 1)}</td>`;
    }).join('');
    const meta = air.station_meta[s] || {};
    return `<tr><th scope="row">${esc(s)}<br><span class="muted tiny">${esc(meta.character || '')}</span></th>${cells}</tr>`;
  }).join('');
  const mean = pols.map((p) => `<td><strong>${num(air.years[String(year)][p].mean, 1)}</strong></td>`).join('');
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>監測站</th>${head}</tr></thead>
        <tbody>${rows}<tr class="row-total"><th scope="row">官方平均</th>${mean}</tr></tbody>
      </table>
    </div>`;
}

function aqiTable(aqi) {
  const levels = aqi.levels;
  const head = levels.map((l) => `<th>${esc(l)}</th>`).join('');
  const rows = aqi.rows.map((r) => {
    const cells = levels.map((l) => `<td>${num(r.days[l] || 0)}</td>`).join('');
    return `<tr><th scope="row">${esc(r.station)}</th>${cells}
      <td>${num(r.good_or_fair_pct)}%</td>
      <td>${r.highest ? `${num(r.highest.index)}<br><span class="muted tiny">${esc(r.highest.level)}・${esc(r.highest.pollutant)}・${esc(r.highest.date)}</span>` : '—'}</td></tr>`;
  }).join('');
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>監測站</th>${head}<th>良好＋普通<br><span class="muted tiny">佔比</span></th><th>全年最高指數</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function mechanismCard(m, refs) {
  const list = (m.refs || []).map((id) => {
    const r = refs[id];
    if (!r) return '';
    return `<a class="src-link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.org)}：${esc(r.doc)}</a>`;
  }).filter(Boolean).join('　');
  return `
    <div class="card mech-card">
      <h3>${esc(m.title)}</h3>
      <ul class="eq-list small">${m.equations.map((e) => `<li><code>${esc(e)}</code></li>`).join('')}</ul>
      <p class="small">${esc(m.text)}</p>
      ${list ? `<p class="tiny muted">出處：${list}</p>` : ''}
    </div>`;
}

/** 複製到報告用的純文字摘要。 */
export function summaryText(d) {
  const ov = d.overview || {};
  const L = ['【澳門環境監測公開數據（化學視角）】',
    `資料來源：${ov.source ? ov.source.org + '《' + ov.source.doc + '》' : ''}（資料內容雜湊 ${d.hash}）`,
    `年均濃度年份：${ov.year}`];
  for (const k of ov.kpis || []) {
    L.push(`・${k.label}：${k.mean} ${k.unit}${k.standard ? `（官方年平均標準 ${k.standard}，${k.compliant ? '達標' : '超出'}，為標準的 ${k.pct_of_standard}%）` : '（官方未設年平均標準）'}${k.trend === null || k.trend === undefined ? '' : `；較前一年 ${k.trend > 0 ? '+' : ''}${k.trend}`}`);
  }
  const aqi = ov.aqi || {};
  if (aqi.rows) {
    const sum = aqi.rows.reduce((a, r) => a + (r.good_or_fair || 0), 0);
    const tot = aqi.rows.reduce((a, r) => a + (r.total_days || 0), 0);
    L.push(`空氣質量「良好＋普通」日數：六站合計 ${sum} 天／${tot} 天（${Math.round((sum / tot) * 1000) / 10}%）`);
  }
  const ar = d.acid_rain || {};
  if (ar.official_1990s) {
    L.push(`降雨酸鹼度（官方歷史監測）：${ar.official_1990s.period} 澳門氣台 pH ${ar.official_1990s.ph_range[0]}–${ar.official_1990s.ph_range[1]}；以 pH ≤ 5.6 計每年降雨都是酸雨。`);
  }
  if (ar.current_note) L.push(`補充：${ar.current_note}`);
  L.push('', '化學機制：酸雨（SO₂／NOx → H₂SO₄／HNO₃）→ 土壤鹽基淋溶與鋁離子溶出（pH < 5.5）→ 根系受害；',
    '水泥水化釋出 Ca(OH)₂ 使土壤偏鹼，鋪面阻斷水氣交換造成根部缺氧。');
  L.push('註：區域空氣背景值為官方監測站數值，非個別古樹實測；空污背景與古樹健康僅並列對照，不代表因果。');
  return L.join('\n');
}

export async function render(section) {
  section.innerHTML = `<div class="page-head">
      <h1>化學視角</h1>
      <p>這一頁把澳門官方的<strong>空氣監測與降雨酸鹼度</strong>數據，和本站的古樹資料放在一起看，
      並列出<strong>酸雨、土壤酸鹼、水泥與鋪面</strong>影響樹木的化學機制與出處。
      每一項數字都標明來源；官方沒有公開的，就明說沒有。</p>
    </div>
    <div id="chem-notice"></div>
    <div id="chem-body">${loading('讀取官方環境數據…')}</div>`;

  let d;
  try {
    const raw = await cached('env-chem', () => api.envChem({ trees: 1 }));
    // 後端回的是 { ok, hash, doc:{…}, stations, health_by_region, … }；
    // 本頁其餘程式碼讀的是「文件內容」，所以在這裡攤平一次，
    // 免得以後又在某處寫成 d.air 而整頁只剩錯誤卡（曾發生）。
    d = raw && raw.doc
      ? {
        ...raw.doc,
        hash: raw.hash,
        stations: raw.stations,
        tree_count: raw.tree_count,
        health_by_region: raw.health_by_region,
      }
      : raw;
    if (!d || !d.air || !d.air.display_order) throw new Error('環境數據格式不符（缺少 air.display_order）');
  } catch (err) {
    section.querySelector('#chem-body').innerHTML = `<div class="notice notice-warn">${errDetail(err)}</div>`;
    return;
  }
  const ov = d.overview || {};
  const aqi = ov.aqi || {};
  const ar = d.acid_rain || {};
  const mat = d.materials || {};

  // 來源索引由後端組好（含酸雨與機制兩份清單），前端不自行拼裝
  const refs = d.sources || {};

  const pm25 = ov.kpis ? ov.kpis.find((k) => k.key === 'PM2.5') : null;
  const years = ov.years || [];
  const body = section.querySelector('#chem-body');
  body.innerHTML = `
    <div class="notice notice-info small">
      <strong>資料來源</strong>：${esc(ov.source ? ov.source.org : '')}《${esc(ov.source ? ov.source.doc : '')}》、
      地球物理氣象局《澳門空氣質量監測統計年度報告》。數值為官方公布值，本平台不換算、不內插、不平均。
      <span class="muted">（資料內容雜湊 ${esc(d.hash)}；擷取日 ${esc(ov.source ? ov.source.retrieved : '')}）</span>
      <br>${esc(d.note || '')}
    </div>

    <div class="grid grid-4" style="margin-top:1rem">
      ${(ov.kpis || []).map(kpiCard).join('')}
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>各監測站 PM2.5 年平均濃度（${ov.year}）</h2>
        <p class="small muted">官方年平均標準 25 µg/m³。路邊站與高密度住宅區站通常較高。</p>
        <div class="chart-box"><canvas id="chem-pm25"></canvas></div>
      </div>
      <div class="card">
        <h2>六種污染物年平均濃度：${years.join(' 與 ')} 年對照</h2>
        <p class="small muted">單位為 µg/m³（CO 為 mg/m³），因此只比較趨勢、不比較絕對值。</p>
        <div class="chart-box"><canvas id="chem-trend"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>各站污染物年平均濃度（官方數據資料）</h2>
      <p class="small muted">紅色表示超過官方年平均濃度標準。O₃、SO₂、CO 官方未設年平均標準值。</p>
      ${stationTable(d.air, ov.year)}
      <p class="tiny muted">監測站改名：${esc(d.air.rename_note)}</p>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>空氣質量水平日數（${aqi.year} 年）</h2>
      <p class="small muted">空氣質量指數由六種污染物換算後取最大副指數，指數越高代表對健康影響越大。</p>
      ${aqiTable(aqi)}
      ${(aqi.events || []).map((e) => `<div class="notice notice-warn small" style="margin-top:.6rem">
        <strong>${esc(e.date_range)}</strong>：${esc(e.text)}</div>`).join('')}
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>荷蘭園站「不良」以上日數：2006–2025</h2>
      <p class="small muted">取自官方年報的歷年日數分佈（已註明部分年份資料從缺）。2025 年的 17 天中有一部分來自 4 月沙塵事件。</p>
      <div class="chart-box"><canvas id="chem-history"></canvas></div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>降雨酸鹼度：官方監測到什麼</h2>
      <p class="small">${esc(ar.definition || '')}</p>
      <ul class="small">
        ${ar.official_1990s ? `<li><strong>${esc(ar.official_1990s.period)}</strong>（${esc(ar.official_1990s.station)}）：
          降雨 pH 年均值 <strong>${num(ar.official_1990s.ph_range[0], 2)}–${num(ar.official_1990s.ph_range[1], 2)}</strong>；
          硫酸根 ${num(ar.official_1990s.sulfate_mg_per_l[0], 1)}–${num(ar.official_1990s.sulfate_mg_per_l[1], 2)} mg/L、
          硝酸根 ${num(ar.official_1990s.nitrate_mg_per_l[0], 2)}–${num(ar.official_1990s.nitrate_mg_per_l[1], 2)} mg/L。
          <span class="muted">${esc(ar.official_1990s.note)}</span></li>` : ''}
        ${ar.official_1999 ? `<li><strong>1999 年</strong>：${esc(ar.official_1999.note)}</li>` : ''}
      </ul>
      <div class="notice notice-info small">
        <strong>本站找不到的數字就不寫</strong>：${esc(ar.current_note || '')}
      </div>
      <p class="tiny muted">出處：${(ar.sources || []).map((s) => `<a class="src-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.org)}《${esc(s.doc)}》</a>`).join('　')}</p>
    </div>

    <div class="notice notice-info" style="margin-top:1rem">
      <strong>本頁沒有的東西</strong>
      <ul class="small" style="margin:.4rem 0 0 1.1rem">
        <li><strong>沒有澳門官方逐點土壤理化數據集</strong>：市區與郊區的土壤理化特性，
          公開資料只有官方報告的敘述段落與學術研究（見下方文獻），<strong>沒有可供逐株對照的官方土壤採樣數據</strong>；
          因此本平台不填任何自造數值。</li>
        <li><strong>沒有逐點礦物成分數據</strong>：因此不以數據推論「礦物成分差異影響物種分佈」，
          只在科普文章中說明機制與文獻看法。</li>
        <li><strong>沒有實地採樣</strong>：本站未對任何一株古樹取土或驗水，所有土壤化學敘述都是機制與背景值，
          <strong>不是這一株的實測結果</strong>。</li>
        <li>可以對照的是官方空氣監測（上方表格與圖表）與降雨酸鹼度的官方歷史值——這兩項確實有官方數據，
          數值一律照登、不換算。</li>
      </ul>
    </div>

    <h2 style="margin-top:1.4rem">化學機制：酸雨、土壤與水泥</h2>
    <div class="grid grid-2">
      ${(mat.mechanisms || []).map((m) => mechanismCard(m, refs)).join('')}
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>把古樹放進來看：區域空氣背景 × 官方健康狀況</h2>
      <p class="small muted">${esc(d.region_note || '')}</p>
      <div id="chem-regions">${loading()}</div>
      <div class="notice notice-warn small" style="margin-top:.6rem">${esc(d.causal_caveat || '')}</div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>引用文獻</h2>
      <ul class="small">
        ${(mat.references || []).map((r) => `<li><strong>${esc(r.org)}</strong>《${esc(r.doc)}》
          <a class="src-link" href="${esc(r.url)}" target="_blank" rel="noopener">連結</a>
          ${r.quote ? `<br><span class="muted">原文節錄：「${esc(r.quote)}」</span>` : ''}</li>`).join('')}
      </ul>
    </div>

    <div class="row" style="margin-top:1rem">
      <button class="btn btn-sm" id="chem-copy">複製摘要（給報告用）</button>
      <button class="btn btn-sm" id="chem-csv">匯出空氣數據 CSV</button>
      <a class="btn btn-sm" href="#/monitoring">看古樹監測</a>
    </div>`;

  // 圖表
  const chartOf = (id) => body.querySelector(id);
  if (pm25) {
    const mat25 = d.air.years[String(ov.year)]['PM2.5'];
    barChart(chartOf('#chem-pm25'), d.air.stations,
      d.air.stations.map((s) => mat25.by_station[s]),
      { label: 'PM2.5 年均（µg/m³）', colors: '#b91c1c', yTitle: 'µg/m³' });
  }
  lineChart(chartOf('#chem-trend'),
    d.air.display_order.map((p) => `${p}`),
    years.map((y) => ({
      label: `${y} 年`,
      data: d.air.display_order.map((p) => {
        const blk = d.air.years[String(y)][p];
        return blk.mean;
      }),
      borderColor: y === ov.year ? '#b91c1c' : '#94a3b8',
      backgroundColor: 'transparent',
      tension: 0.25,
    })),
    { yTitle: '年均（µg/m³，CO 為 mg/m³）', xTitle: '污染物', pointRadius: 4 });
  const h = aqi.history;
  if (h) {
    lineChart(chartOf('#chem-history'), h.years,
      [{ label: '不良以上（含非常不良、嚴重）日數',
        data: h.years.map((_, i) => (h['不良'][i] || 0) + (h['非常不良'][i] || 0) + (h['嚴重'][i] || 0)),
        borderColor: '#b45309', backgroundColor: 'rgba(180,83,9,.15)', fill: true, tension: 0.25, pointRadius: 2 }],
      { yTitle: '日數', xTitle: '年份' });
  }

  // 區域 × 古樹健康（需要 trees=1）
  const regions = d.health_by_region;
  const box = body.querySelector('#chem-regions');
  if (regions && regions.regions && regions.regions.length) {
    box.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>區域</th><th>古樹（株）</th><th>平均樹齡（年）</th><th>官方健康狀況</th><th>該區監測站 PM2.5（µg/m³）</th><th>該區監測站 NO₂（µg/m³）</th></tr></thead>
          <tbody>${regions.regions.map((r) => `
            <tr>
              <th scope="row">${esc(r.region)}</th>
              <td>${num(r.total)}</td>
              <td>${r.avg_age === null || r.avg_age === undefined ? '—' : num(r.avg_age, 1)}</td>
              <td>${['健康', '一般', '瀕危'].map((k) => (r.health[k] ? `${healthBadge(k)} ${num(r.health[k])}` : '')).filter(Boolean).join('　')}</td>
              <td>${((r.background && r.background['PM2.5']) || []).map((x) => `${esc(x.station)} ${num(x.value, 1)}`).join('　')}</td>
              <td>${((r.background && r.background.NO2) || []).map((x) => `${esc(x.station)} ${num(x.value, 1)}`).join('　')}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  } else {
    box.innerHTML = '<p class="muted small">（未載入古樹對照；請確認 API 可用。）</p>';
  }

  body.querySelector('#chem-copy').addEventListener('click', () => copyText(summaryText(d)));
  body.querySelector('#chem-csv').addEventListener('click', () => {
    const rows = d.air.display_order.map((p) => {
      const meta = d.air.pollutants[p];
      const blk = d.air.years[String(ov.year)][p];
      const row = {
        污染物: meta.name,
        單位: meta.unit,
        官方年平均標準: meta.standard_annual === null ? '未設' : meta.standard_annual,
        官方平均: blk.mean,
      };
      for (const s of d.air.stations) row[s] = blk.by_station[s] === undefined ? '' : blk.by_station[s];
      return row;
    });
    downloadCsv(`澳門環境監測數據_${ov.year}.csv`, rows);
    toast('已匯出空氣數據 CSV');
  });

  return () => destroyAll(section);
}

export default render;
