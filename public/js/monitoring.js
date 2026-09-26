/**
 * 監測時間序列（#/monitoring）
 *
 * 一株古樹的變化，只有「同一株、不同時間的兩次觀測」才說得出來。
 * 本頁把三個有出處的來源接成一條序列：
 *   1) 《古樹名錄》官方版本值（較早的官方版本）
 *   2) 市政署自然網現行值（每次官方名錄變更，每日擷取會自動存一份帶日期的快照）
 *   3) 本站實地考察紀錄（field_records，學生實測）
 *
 * 【誠實原則】
 *   - 只有一次觀測就不畫趨勢，明說「需要至少兩次有日期的觀測」。
 *   - 官方分級／健康狀況變動屬「官方資料更新」，不當成異常。
 *   - 缺值不內插、不平均；只比較兩邊都有值的欄位。
 */
import { api, cached } from './api.js';
import { esc, num, loading, toast, copyText, downloadCsv, healthBadge, gradeBadge, errDetail } from './ui.js';
import { lineChart, destroyAll, HEALTH_COLORS } from './charts.js';

const SRC_LABEL = { listing: '《名錄》版本', official: '官方現行', field: '實地考察' };
const SRC_TONE = { listing: 'muted', official: 'good', field: 'warn' };

/** 後端欄位型別若有變動（例如 changes 一度變成數字），前端不該整個分頁掛掉。 */
const arr = (v) => (Array.isArray(v) ? v : []);

const levelTone = { warn: 'danger', good: 'good', info: 'muted' };
const kindLabel = {
  diameter_down: '胸徑變化', height_down: '樹高變化', health_worse: '健康轉差',
  health_better: '健康改善', grade_change: '官方分級更新', age_change: '官方樹齡更新', long_gap: '複查提醒',
  no_field_record: '尚無考察紀錄',
};

/** 概況摘要文字（複製到報告用）。 */
export function summaryText(data) {
  const s = data.summary || {};
  const lines = ['【澳門古樹監測概況】',
    `監測株數：${num(s.trees)} 株`,
    `官方快照：${num(s.snapshots)} 份${s.period ? `（${s.period.from} ～ ${s.period.to}）` : ''}`,
    `官方資料有變動：${num(s.official_changed)} 株`,
    `已有實地考察紀錄：${num(s.with_field_record)} 株（共 ${num(s.records)} 筆）`,
    `需要人工確認：${num(s.need_attention)} 株`,
    '',
    '資料來源：市政署《古樹名木保護名錄》、市政署「澳門自然網」歷次擷取快照、本站實地考察紀錄。',
    '分級與健康狀況一律為官方值；官方值變動標示為「官方資料更新」，非本平台評定。'];
  return lines.join('\n');
}

function stepRow(s) {
  const bits = [];
  if (s.grade_change) bits.push(`<span class="badge badge-muted">分級 ${esc(s.grade_change)}</span>`);
  if (s.age_change) bits.push(`<span class="badge badge-muted">官方樹齡 ${esc(s.age_change)}</span>`);
  if (s.health_change) bits.push(`${healthBadge(s.health_from)} <span class="muted">→</span> ${healthBadge(s.health_to)}`);
  if (s.diameter_delta !== null && s.diameter_delta !== undefined) bits.push(`<span class="badge ${s.diameter_delta < 0 ? 'badge-fair' : 'badge-good'}">胸徑 ${s.diameter_delta > 0 ? '+' : ''}${esc(s.diameter_delta)} 公分</span>`);
  if (s.height_delta !== null && s.height_delta !== undefined) bits.push(`<span class="badge ${s.height_delta < 0 ? 'badge-fair' : 'badge-good'}">樹高 ${s.height_delta > 0 ? '+' : ''}${esc(s.height_delta)} 公尺</span>`);
  if (!bits.length) bits.push('<span class="badge badge-muted">無量測變化</span>');
  return `
    <tr>
      <td>${esc(s.from_label)}<br><span class="muted small">${esc(SRC_LABEL[s.from_source] || '')}</span></td>
      <td>${esc(s.to_label)}<br><span class="muted small">${esc(SRC_LABEL[s.to_source] || '')}${s.days !== null && s.days !== undefined ? `・相距 ${num(s.days)} 天` : ''}</span></td>
      <td>${bits.join(' ')}</td>
    </tr>`;
}

function pointsTable(points) {
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>日期</th><th>來源</th><th>官方健康狀況</th><th>官方分級</th><th>樹齡（年）</th><th>樹高（公尺）</th><th>胸徑（公分）</th><th>胸圍（公分）</th><th>備註</th></tr></thead>
        <tbody>
          ${points.map((p) => `
            <tr>
              <td>${esc(p.date || '未載日期')}</td>
              <td><span class="badge badge-${SRC_TONE[p.source] || 'muted'}">${esc(SRC_LABEL[p.source] || p.source)}</span></td>
              <td>${p.health ? healthBadge(p.health) : '<span class="muted">—</span>'}</td>
              <td>${p.grade ? gradeBadge(p.grade) : '<span class="muted">—</span>'}</td>
              <td>${p.age_years !== null && p.age_years !== undefined ? num(p.age_years) : '<span class="muted">—</span>'}</td>
              <td>${p.height_m !== null && p.height_m !== undefined ? num(p.height_m, 2) : '<span class="muted">—</span>'}</td>
              <td>${p.diameter_cm !== null && p.diameter_cm !== undefined ? num(p.diameter_cm, 2) : '<span class="muted">—</span>'}</td>
              <td>${p.girth_cm !== null && p.girth_cm !== undefined ? num(p.girth_cm, 1) : '<span class="muted">—</span>'}</td>
              <td class="small">${esc(p.observer ? `觀察者 ${p.observer}${p.note ? `・${p.note}` : ''}` : (p.source === 'listing' ? '官方名錄版本（無日期）' : ''))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/** 趨勢文字：不足兩點就誠實說「無法擬合」與原因。 */
export function trendText(t) {
  if (!t) return '可量測的時間點不足兩個（需要同一欄位在兩個不同日期的觀測），無法擬合趨勢。';
  if (t.slope === null) return `無法擬合：${t.reason || '資料不足'}（現有 ${num(t.n)} 個可量測時間點、跨距 ${num(t.span_days)} 天）。`;
  const dir = t.slope > 0 ? '增加' : (t.slope < 0 ? '減少' : '持平');
  return `胸徑平均每年${dir} ${num(Math.abs(t.slope), 3)} 公分（最小平方擬合，R² = ${num(t.r2, 3)}、${num(t.n)} 個時間點、跨距 ${num(t.span_days)} 天）。`;
}

function detailHtml(data) {
  const t = data.tree;
  const s = data.series;
  const warn = arr(s.anomalies).filter((a) => a.level === 'warn');
  const dated = s.points.filter((p) => p.date);
  return `
    <div class="card">
      <h2>#${esc(t.tree_no)} ${esc(t.species || '')}　<span class="badge badge-muted">${esc(t.site || '')}</span></h2>
      <p class="muted small">
        ${esc(t.parish || '')}・樹齡 ${num(t.age_years)} 年・官方健康狀況
        <span class="badge badge-muted">${esc(t.health || '—')}</span>・官方分級
        <span class="badge badge-muted">${esc(t.grade || '未列級')}</span>
        ${t.listing_grade && t.listing_grade !== t.grade ? `<br>《古樹名錄》原本列「${esc(t.listing_grade)}」，市政署自然網現行為「${esc(t.official_grade || '—')}」— 本平台以官方現行值為準。` : ''}
        ${t.listing_age_years != null && t.listing_age_years !== t.age_years ? `<br>《古樹名錄》原本列 ${num(t.listing_age_years)} 年，市政署自然網現行為 ${num(t.official_age_years)} 年 — 本平台以官方現行值為準。` : ''}
      </p>
      <p class="small">${esc(trendText(s.trend))}</p>
      <h3>觀測點（共 ${num(s.points.length)} 個；有日期 ${num(dated.length)} 個）</h3>
      ${pointsTable(s.points)}
      ${s.steps.length ? `<h3>逐次差異</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>前一次</th><th>後一次</th><th>變化</th></tr></thead><tbody>${s.steps.map(stepRow).join('')}</tbody></table></div>` : ''}
      ${s.points.length >= 2 ? '<div class="chart-box"><canvas id="c-mon"></canvas></div>' : ''}
      <h3>異常與提醒（共 ${num((s.anomalies || []).length)} 項，需人工確認 ${num(warn.length)} 項）</h3>
      <ul class="plain-list">
        ${(s.anomalies || []).map((a) => `<li><span class="badge badge-${levelTone[a.level] || 'muted'}">${esc(kindLabel[a.kind] || a.kind)}</span> ${esc(a.text)}</li>`).join('') || '<li class="muted">無</li>'}
      </ul>
      <p class="small muted">新增考察紀錄後，下一次進入本頁就會看到新的時間點與差異；官方資料有更新時，每日擷取會自動存入新的快照。</p>
      <div class="btn-row">
        <a class="btn" href="#/map?tree=${esc(t.tree_no)}">看地圖詳情</a>
        <a class="btn" href="#/field?tree=${esc(t.tree_no)}">新增／查看實地考察紀錄</a>
        <a class="btn" href="#/card?tree=${esc(t.tree_no)}">列印檔案卡</a>
      </div>
    </div>`;
}

export async function render(section, params) {
  section.innerHTML = loading('正在整理監測時間序列…');
  const tree = params && params.get('tree') ? params.get('tree') : '';
  // 預設只看「有變動」的株：這一頁的用意是看變化，658 筆全列出來沒有意義
  // （2026-09-25 實際發生：標題寫「有變動的株（658 株）」卻把全部列出來）。
  const only = (params && params.get('only')) || 'changed';

  let detail = null;
  const list = await cached(`monitoring:${only}`, () => api.monitoring({ only: only === 'all' ? '' : only, limit: 0 }));
  if (tree) {
    try {
      detail = await api.monitoring({ tree });
    } catch (err) {
      toast(errTextSafe(err));
    }
  }
  const s = list.summary || {};

  section.innerHTML = `
    <div class="page-head">
      <div>
        <h1>監測時間序列</h1>
        <p class="muted">同一株樹、不同時間的官方值與實地考察值接成一條序列，用來看變化與異常。</p>
      </div>
      <div class="btn-row">
        <button class="btn" id="btn-copy-mon">複製概況摘要</button>
        <button class="btn" id="btn-csv-mon">匯出變動清單 CSV</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="card kpi"><div class="kpi-label">監測株數</div><div class="kpi-value">${num(s.trees)}</div><div class="kpi-note">全澳古樹</div></div>
      <div class="card kpi"><div class="kpi-label">官方快照</div><div class="kpi-value">${num(s.snapshots)}</div><div class="kpi-note">${s.period ? `${esc(s.period.from)} 起` : '尚未建立'}</div></div>
      <div class="card kpi"><div class="kpi-label">官方資料有變動</div><div class="kpi-value">${num(s.official_changed)}</div><div class="kpi-note">分級或健康狀況與《名錄》版本不同</div></div>
      <div class="card kpi"><div class="kpi-label">已有考察紀錄</div><div class="kpi-value">${num(s.with_field_record)}</div><div class="kpi-note">共 ${num(s.records)} 筆實地紀錄</div></div>
      <div class="card kpi"><div class="kpi-label">需人工確認</div><div class="kpi-value">${num(s.need_attention)}</div><div class="kpi-note">異常等級為「需確認」的株數</div></div>
    </div>

    <div class="card">
      <h2>怎麼看這一頁</h2>
      <ol class="plain-list">
        <li><strong>官方快照</strong>：市政署自然網只公布現行值，沒有歷史值。我們的每日擷取會在官方名錄<strong>內容有變更</strong>時自動存一份帶日期的快照（<code>data/observations/</code>），所以時間軸會隨時間變長。</li>
        <li><strong>《名錄》版本</strong>：官方名錄值視為較早的官方版本，因此一開始就有一組可比對的官方時間點。</li>
        <li><strong>實地考察</strong>：由師生實測的紀錄（<a href="#/field">實地考察</a>分頁新增），帶日期、觀察者、健康狀況與量測值。</li>
        <li><strong>不硬湊</strong>：缺值不內插、不平均；可量測時間點不足兩個（或跨距未滿 30 天）就不畫趨勢，並說明原因。</li>
        <li><strong>官方變動≠異常</strong>：官方分級／健康狀況的改變屬「官方資料更新」，會標示出來但不列為異常；只有量測值異常（胸徑減少 ≥ 0.5 公分、樹高減少 ≥ 0.2 公尺）或實地觀察惡化才列「需確認」。</li>
      </ol>
    </div>

    ${detail ? detailHtml(detail) : `
      <div class="card">
        <h2>查看單株序列</h2>
        <p class="small muted">輸入古樹編號即可看該株的完整時間序列（也可從<a href="#/map">地圖查詢</a>或<a href="#/priority">優先保育名單</a>點進來）。</p>
        <div class="form-row">
          <label for="mon-tree">古樹編號</label>
          <input id="mon-tree" type="text" inputmode="numeric" placeholder="例如 1132" value="">
          <button class="btn btn-primary" id="mon-go">查看</button>
        </div>
      </div>`}

    <div class="card">
      <h2>${only === 'changed' ? '官方資料有變動的株' : (only === 'attention' ? '需人工確認的株' : (only === 'field' ? '已有實地考察紀錄的株' : '全部監測株'))}（${num((list.items || []).length)} 株${list.total && list.total !== (list.items || []).length ? `／符合條件共 ${num(list.total)} 株` : ''}）</h2>
      <p class="small muted">
        目前共 ${num(s.snapshots)} 份官方快照；下表列出與《古樹名錄》版本不同的株，之後每次官方更新都會累積。
        切換：<a href="#/monitoring?only=changed">有變動</a>・<a href="#/monitoring?only=attention">需確認</a>・<a href="#/monitoring?only=field">有考察紀錄</a>・<a href="#/monitoring?only=all">全部</a>
      </p>
      ${(list.items || []).length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>編號</th><th>樹種</th><th>官方健康狀況</th><th>變化</th><th>異常</th><th></th></tr></thead>
          <tbody>
            ${(list.items || []).map((r) => `
              <tr>
                <td>#${esc(r.tree_no)}</td>
                <td>${esc(r.species || '')}</td>
                <td>${r.health ? healthBadge(r.health) : '<span class="muted">—</span>'}</td>
                <td class="small">${arr(r.changes).map((c) => (c.grade ? `分級 ${esc(c.grade)}` : (c.age ? `樹齡 ${esc(c.age)}` : `健康 ${esc(c.health || '')}`))).join('、') || '<span class="muted">—</span>'}</td>
                <td>${arr(r.anomalies).some((a) => a.level === 'warn') ? '<span class="badge badge-bad">需確認</span>' : '<span class="badge badge-muted">—</span>'}</td>
                <td><a href="#/monitoring?tree=${esc(r.tree_no)}">看序列</a></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="muted">目前沒有偵測到官方資料變動。</p>'}
    </div>`;

  // 單株趨勢圖（只有兩個以上有日期的觀測點才畫）
  if (detail) {
    const pts = detail.series.points.filter((p) => p.date);
    const canvas = section.querySelector('#c-mon');
    if (canvas && pts.length >= 2) {
      lineChart(canvas, pts.map((p) => p.date),
        [
          { label: '胸徑（公分）', data: pts.map((p) => p.diameter_cm), borderColor: '#166534', backgroundColor: 'rgba(34,163,92,.18)', fill: true, borderWidth: 2.5, spanGaps: true },
          { label: '樹高（公尺）', data: pts.map((p) => p.height_m), borderColor: '#b45309', backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 4], spanGaps: true },
        ],
        { xTitle: '日期', yTitle: '量測值', pointRadius: 3, extra: { spanGaps: true } });
    }
  }

  section.querySelector('#btn-copy-mon')?.addEventListener('click', async () => {
    const okCopy = await copyText(summaryText(list));
    toast(okCopy ? '已複製監測概況' : '複製失敗，請手動選取');
  });
  section.querySelector('#btn-csv-mon')?.addEventListener('click', () => {
    downloadCsv('古樹監測_變動清單.csv', (list.items || []).map((r) => ({
      編號: r.tree_no, 樹種: r.species, 地點: r.site, 堂區: r.parish,
      官方健康狀況: r.health, 官方分級: r.grade, 觀測點數: r.points,
      實地考察筆數: r.field_records,
      變化: arr(r.changes).map((c) => `${c.to || '未載日期'}:${c.grade || ''}${c.age || ''}${c.health || ''}`).join(' | '),
      異常: arr(r.anomalies).map((a) => a.text).join(' | '),
    })));
  });
  const go = section.querySelector('#mon-go');
  const input = section.querySelector('#mon-tree');
  if (go && input) {
    go.addEventListener('click', () => {
      const v = (input.value || '').trim();
      if (!/^[0-9A-Za-z_-]{1,24}$/.test(v)) { toast('請輸入正確的古樹編號'); return; }
      window.location.hash = `#/monitoring?tree=${encodeURIComponent(v)}`;
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
  }
  if (tree) {
    try { section.querySelector('#mon-tree')?.focus(); } catch { /* 忽略 */ }
  }

  return { destroy: () => destroyAll(section) };
}

/** toast 用的一行錯誤文字（避免 ui.js 內部函式相依）。 */
function errTextSafe(err) {
  if (err && err.status === 404) return '找不到這個編號的古樹';
  return `讀取失敗：${errDetail(err).slice(0, 60)}`;
}

export { HEALTH_COLORS };
