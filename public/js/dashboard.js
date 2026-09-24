/** 總覽頁：整體統計、各堂區古樹數目分佈圖、品種排行、健康與分級結構、最老古樹、瀕危名單。 */
import { api, cached } from './api.js';
import {
  esc, num, pct, healthBadge, gradeBadge, safeUrl, loading, openModal, downloadCsv,
} from './ui.js';
import { barChart, doughnut, destroyAll, HEALTH_COLORS, GRADE_COLORS, PALETTE } from './charts.js';

const kpi = (value, label, hint = '') => `
  <div class="card kpi">
    <span class="kpi-value">${value}</span>
    <span class="kpi-label">${esc(label)}</span>
    ${hint ? `<span class="kpi-hint">${esc(hint)}</span>` : ''}
  </div>`;

function treeRows(list, { showSite = true } = {}) {
  return list.map((t) => `
    <tr>
      <td class="nowrap"><button class="btn btn-sm" data-tree="${esc(t.tree_no)}">${esc(t.tree_no)}</button></td>
      <td>${esc(t.species || '')}${t.name_sci ? `<br><span class="tiny muted">${esc(t.name_sci)}</span>` : ''}</td>
      <td class="num">${num(t.age_years)}</td>
      <td class="num">${num(t.height_m, t.height_m % 1 ? 2 : 0)}</td>
      <td>${gradeBadge(t.grade)}</td>
      <td>${healthBadge(t.health)}</td>
      ${showSite ? `<td class="small">${esc(t.site || '')}</td>` : ''}
    </tr>`).join('');
}

function table(headers, rows, caption = '') {
  return `
    <div class="table-wrap">
      <table class="data">
        ${caption ? `<caption>${esc(caption)}</caption>` : ''}
        <thead><tr>${headers.map((h) => `<th${typeof h === 'object' && h.num ? ' class="num"' : ''}>${esc(typeof h === 'object' ? h.label : h)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export async function render(section, params) {
  section.innerHTML = `<div class="page-head"><h1>澳門古樹總覽</h1>
    <p>以澳門市政署《古樹名木保護名錄》整理之資料建立的即時統計。所有數字由資料庫查詢即時產生，並非寫死在網頁中。</p></div>
    <div id="ov-body">${loading('正在讀取資料庫…')}</div>`;

  const data = await cached('overview', () => api.overview());
  const body = section.querySelector('#ov-body');
  const o = data.overview;
  const site = data.site;

  const oldest = data.oldest[0] || {};

  body.innerHTML = `
    <div class="grid grid-4">
      ${kpi(num(o.tree_count), '古樹總株數', `遍布 ${o.site_count} 個地點、${o.parish_count} 個堂區`)}
      ${kpi(num(o.species_count), '樹種數', '含榕屬、樟科、桃金孃科等')}
      ${kpi(num(o.max_age), '最老樹齡（年）', `${oldest.species || ''}｜${oldest.site || ''}`)}
      ${kpi(num(o.avg_age, 1), '平均樹齡（年）', `平均樹高 ${num(o.avg_height, 2)} 公尺`)}
      ${kpi(num(o.attention_pct, 1) + '%', '需關注比例', `健康狀況非「健康」者 ${num(o.good === o.tree_count ? 0 : o.tree_count - o.good)} 株`)}
      ${kpi(num(o.endangered), '瀕危古樹', '需優先巡查與風險評估')}
      ${kpi(num(data.parishes[0] ? data.parishes[0].tree_count : 0), `最多古樹堂區`, data.parishes[0] ? data.parishes[0].parish : '')}
      ${kpi(site.data_source === 'supabase' ? 'Supabase' : '示範模式', '資料來源', site.data_source === 'supabase' ? 'PostgreSQL 即時查詢' : '內建資料快照')}
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>各堂區古樹數目分佈圖 <span class="tiny muted">（資訊任務 1）</span></h2>
        <p class="tiny muted">按株數排序；滑鼠移到柱上可看健康結構。點擊柱可查看該堂區明細。</p>
        <div class="chart-box"><canvas id="chart-parish"></canvas></div>
      </div>
      <div class="card">
        <h2>每平方公里古樹密度</h2>
        <p class="tiny muted">以堂區面積（平方公里）換算，觀察「高密度但面積小」的舊城區與「大面積低密度」的離島差異。</p>
        <div class="chart-box"><canvas id="chart-density"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>品種排行（前 12）</h2>
        <p class="tiny muted">心葉榕（假菩提樹）在全澳佔比極高，是澳門古樹群最鮮明的特徵。</p>
        <div class="chart-box"><canvas id="chart-species"></canvas></div>
      </div>
      <div class="card">
        <h2>健康狀況與分級結構</h2>
        <div class="chart-box short"><canvas id="chart-health"></canvas></div>
        <div class="chart-box short" style="margin-top:.6rem"><canvas id="chart-grade"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card card-scroll">
        <h2>最老的十株古樹</h2>
        ${table(['古樹編號', '品種', { label: '樹齡（年）', num: true }, { label: '樹高（m）', num: true }, '分級', '健康', '地點'],
    treeRows(data.oldest))}
      </div>
      <div class="card card-scroll">
        <h2>瀕危古樹關注名單（前 10）</h2>
        <p class="tiny muted">健康狀況為「瀕危」者，依市政署制度需每月巡查並視情況加密。</p>
        ${table(['古樹編號', '品種', { label: '樹齡（年）', num: true }, { label: '樹高（m）', num: true }, '分級', '健康', '地點'],
    treeRows(data.endangered))}
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>堂區明細表</h2>
      <p class="tiny muted">「加強版」古樹名目分區表：合併株數、密度、平均樹齡、健康結構與樹種數。</p>
      ${table(
    ['堂區', { label: '株數', num: true }, '佔比', { label: '面積 km²', num: true }, { label: '密度 /km²', num: true },
      { label: '平均樹齡', num: true }, { label: '最老', num: true }, { label: '平均樹高 m', num: true },
      { label: '地點數', num: true }, { label: '樹種數', num: true }, '健康結構'],
    data.parishes.map((p) => `
        <tr>
          <td><strong>${esc(p.parish)}</strong>${p.note ? `<br><span class="tiny muted">${esc(p.note)}</span>` : ''}</td>
          <td class="num">${num(p.tree_count)}</td>
          <td class="num">${pct(p.share_pct)}</td>
          <td class="num">${num(p.area_km2, 1)}</td>
          <td class="num">${p.density_per_km2 == null ? '—' : num(p.density_per_km2, 1)}</td>
          <td class="num">${num(p.avg_age, 1)}</td>
          <td class="num">${num(p.max_age)}</td>
          <td class="num">${num(p.avg_height, 2)}</td>
          <td class="num">${num(p.site_count)}</td>
          <td class="num">${num(p.species_count)}</td>
          <td class="tiny nowrap">
            <span class="badge badge-good">健 ${num(p.health_good)}</span>
            <span class="badge badge-fair">一 ${num(p.health_fair)}</span>
            <span class="badge badge-bad">瀕 ${num(p.health_endangered)}</span>
          </td>
        </tr>`),
    '資料來源：本平台資料庫即時統計；面積為堂區面積。',
  )}
      <div class="row" style="margin-top:.7rem">
        <button class="btn btn-sm" id="dl-parishes">下載堂區統計 CSV</button>
        <button class="btn btn-sm" id="dl-trees">下載全部古樹 CSV（658 筆）</button>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>相片牆：古樹與牠們的地方</h2>
      <p class="tiny muted">相片來源為 Wikimedia Commons 自由授權圖片，每張標示作者與授權；點擊可看大圖與授權連結。</p>
      <div class="photo-grid" id="photo-wall"></div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>資料方法說明</h2>
      <ul class="small">
        <li><strong>資料筆數</strong>：${num(site.counts.trees)} 筆古樹紀錄、${num(site.counts.sites)} 個地點、${num(site.counts.species)} 個樹種、${num(site.counts.parishes)} 個堂區。</li>
        <li><strong>資料來源</strong>：${esc(site.dataset)}。</li>
        <li><strong>座標</strong>：以 OpenStreetMap Nominatim 就每個「地點」文字做地理編碼，再以人工校核補齊無匹配者；同一地點的多株古樹以確定性的小半徑（15–95 公尺）展開，避免地圖上完全重疊。座標為**研究用近似值**，非官方測量成果。</li>
        <li><strong>與官方數字的差異</strong>：市政署 2025 年公布為 654 棵古樹名木；本資料集為 ${num(site.counts.trees)} 筆，差異來自名錄版本與統計時點不同，屬正常現象。</li>
      </ul>
    </div>`;

  // ── 圖表 ──────────────────────────────────────────────
  const parishLabels = data.parishes.map((p) => p.parish.replace('堂區', ''));
  const chart = barChart(
    body.querySelector('#chart-parish'),
    parishLabels,
    data.parishes.map((p) => p.tree_count),
    { label: '古樹株數', colors: PALETTE[0], yTitle: '株數' },
  );
  chart.options.onClick = (evt, elements) => {
    if (!elements.length) return;
    const p = data.parishes[elements[0].index];
    window.location.hash = `#/map?parish=${encodeURIComponent(p.parish)}`;
  };

  barChart(body.querySelector('#chart-density'), parishLabels,
    data.parishes.map((p) => p.density_per_km2 || 0),
    { label: '每平方公里株數', colors: PALETTE[3], horizontal: true, yTitle: '株 / km²' });

  barChart(body.querySelector('#chart-species'),
    data.species.slice(0, 12).map((s) => s.species),
    data.species.slice(0, 12).map((s) => s.tree_count),
    { label: '株數', colors: PALETTE[1], yTitle: '株數' });

  doughnut(body.querySelector('#chart-health'),
    data.health_distribution.map((d) => d.name),
    data.health_distribution.map((d) => d.value),
    data.health_distribution.map((d) => HEALTH_COLORS[d.name]));

  doughnut(body.querySelector('#chart-grade'),
    data.grade_distribution.map((d) => d.name),
    data.grade_distribution.map((d) => d.value),
    ['一級', '二級', '三級', '不分級'].map((g) => GRADE_COLORS[g]));

  // ── 相片牆（挑選有相片的品種與地點） ────────────────────
  const wall = body.querySelector('#photo-wall');
  const withPhoto = data.species.filter((s) => safeUrl(s.photo_url)).slice(0, 8);
  wall.innerHTML = withPhoto.map((s) => `
    <figure class="photo-card" style="margin:0">
      <img src="${esc(safeUrl(s.photo_url))}" alt="${esc(s.species)}相片" loading="lazy"
           data-credit="${esc(s.photo_credit || '')}" data-license="${esc(s.photo_license || '')}">
      <figcaption class="photo-body">
        <div class="photo-title">${esc(s.species)}</div>
        <div class="photo-sub">${esc(s.name_sci || '')}｜${num(s.tree_count)} 株</div>
        <div class="photo-sub">© ${esc(s.photo_credit || 'Wikimedia Commons')}（${esc(s.photo_license || 'CC')}）</div>
      </figcaption>
    </figure>`).join('');

  wall.querySelectorAll('img').forEach((img) => img.addEventListener('click', () => {
    openModal(`<h3>${esc(img.getAttribute('alt'))}</h3>
      <img src="${esc(img.getAttribute('src'))}" alt="${esc(img.getAttribute('alt'))}" style="max-width:100%;border-radius:8px">
      <p class="small muted" style="margin-top:.6rem">作者：${esc(img.dataset.credit || 'Wikimedia Commons')}｜授權：${esc(img.dataset.license || 'CC')}｜來源：Wikimedia Commons</p>`);
  }));

  // ── 事件 ──────────────────────────────────────────────
  body.querySelectorAll('button[data-tree]').forEach((btn) => btn.addEventListener('click', () => {
    window.location.hash = `#/map?tree=${encodeURIComponent(btn.dataset.tree)}`;
  }));

  body.querySelector('#dl-parishes').addEventListener('click', () => {
    downloadCsv('澳門古樹_堂區統計.csv', data.parishes.map((p) => ({
      堂區: p.parish, 株數: p.tree_count, 佔比百分比: p.share_pct, 面積平方公里: p.area_km2,
      每平方公里株數: p.density_per_km2, 平均樹齡: p.avg_age, 最老樹齡: p.max_age,
      平均樹高公尺: p.avg_height, 健康: p.health_good, 一般: p.health_fair, 瀕危: p.health_endangered,
      地點數: p.site_count, 樹種數: p.species_count,
    })));
  });

  body.querySelector('#dl-trees').addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = '匯出中…';
    try {
      const all = await api.trees({ limit: 2000 });
      downloadCsv('澳門古樹名錄_658筆.csv', all.trees.map((t) => ({
        古樹編號: t.tree_no, 品種: t.species, 學名: t.name_sci || '', 樹齡: t.age_years,
        樹高公尺: t.height_m, 分級: t.grade, 健康狀況: t.health, 地點: t.site, 堂區: t.parish,
        緯度: t.lat, 經度: t.lon, 座標精度: t.geo_precision || '',
      })));
    } finally {
      e.target.disabled = false;
      e.target.textContent = '下載全部古樹 CSV（658 筆）';
    }
  });

  return { destroy: () => destroyAll(section) };
}
