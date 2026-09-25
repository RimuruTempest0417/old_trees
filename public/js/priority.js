/**
 * 優先保育名單（#/priority）
 *
 * 依「樹齡／健康狀況／官方級別／樹種稀有度／區位風險」五項、合計 100 分排序，
 * 讓有限的養護資源先用在最急迫的樹上。評分規則由後端 lib/priority.js 提供，
 * 前端只負責呈現，並把「為什麼是這個名次」攤開給使用者看。
 */
import { api, cached } from './api.js';
import {
  esc, num, loading, toast, copyText, downloadCsv, healthBadge, errDetail,
} from './ui.js';

const TIER_TONE = { S: 'danger', A: 'warn', B: 'info', C: 'muted' };

/** 等級徽章（S／A／B／C）。 */
export function tierBadge(tier) {
  return `<span class="badge badge-${TIER_TONE[tier] || 'muted'}">${esc(tier)} 級</span>`;
}

/** 名單摘要文字（複製到報告用）。 */
export function summaryText(data) {
  const s = data.summary || {};
  const lines = ['【澳門古樹優先保育名單】',
    `評估範圍：全澳 ${num(data.evaluated)} 株古樹`,
    `評分方式：${Object.entries(data.method.weights).map(([k, v]) => `${({ age: '樹齡', health: '健康狀況', grade: '官方級別', rarity: '樹種稀有度', risk: '區位風險' })[k]} ${v}`).join(' ＋ ')}（合計 ${data.method.total} 分）`,
    `等級分佈：${Object.entries(s.by_tier || {}).map(([k, v]) => `${k} 級 ${v} 株`).join('／')}，平均 ${num(s.mean_score, 1)} 分`,
    '', `本次列出前 ${num(data.count)} 株：`];
  (data.items || []).forEach((r) => {
    lines.push(`${r.rank}. #${r.tree_no} ${r.species}（${num(r.age_years)} 年・${r.health}・${r.grade}・${num(r.score)} 分／${r.tier} 級）`);
  });
  lines.push('', '資料來源：市政署《古樹名木保護名錄》公開資料（本平台僅重新排序，未變更官方數據）。');
  return lines.join('\n');
}

/** 以目前條件產生列印用網址。 */
export function printHref(state) {
  const q = new URLSearchParams({ mode: 'priority' });
  if (state.limit) q.set('limit', String(state.limit));
  if (state.tier) q.set('tier', state.tier);
  if (state.parish) q.set('parish', state.parish);
  return `#/card?${q.toString()}`;
}

export async function render(section, params) {
  const st = {
    limit: params.get('limit') || '50',
    tier: params.get('tier') || '',
    parish: params.get('parish') || '',
    q: params.get('q') || '',
  };

  section.innerHTML = `
    <div class="page-head">
      <h1>優先保育名單</h1>
      <p>苗木有限、人力有限，先顧最急的。本頁依 <strong>樹齡、健康狀況、官方級別、樹種稀有度、區位風險</strong>
      五項、合計 100 分為全澳古樹排序，並列出每一株「為什麼拿這個分數」。分數是相對排序工具，
      不是市政署的官方認定；實際養護仍應以現地檢查為準。</p>
    </div>
    <div id="priority-body">${loading('正在計算名單…')}</div>`;

  const body = section.querySelector('#priority-body');
  let meta = { parishes: [], species: [] };
  try { meta = await cached('meta', () => api.meta()); } catch { /* 示範模式下沒有就跳過篩選來源 */ }

  async function load() {
    body.innerHTML = loading('正在計算名單…');
    let data;
    try {
      data = await api.priority({ limit: st.limit, tier: st.tier, parish: st.parish, q: st.q });
    } catch (err) {
      body.innerHTML = `<div class="card"><p class="muted">讀取名單失敗：${esc(errDetail(err))}</p></div>`;
      return;
    }
    renderBody(data);
  }

  function renderBody(data) {
    const s = data.summary || {};
    const m = data.method || { weights: {}, steps: [], tiers: [], caveats: [] };
    const rows = data.items || [];
    const parishOptions = (meta.parishes || []).map((p) => p.code).filter(Boolean);
    const usedParishes = [...new Set([...parishOptions, ...(rows.map((r) => r.parish).filter(Boolean))])];

    body.innerHTML = `
      <div class="grid grid-4">
        <div class="kpi"><span class="kpi-value">${num(s.evaluated)}</span><span class="kpi-label">納入評估古樹</span></div>
        <div class="kpi"><span class="kpi-value">${num((s.by_tier || {}).S)}</span><span class="kpi-label">S 級（最優先）</span></div>
        <div class="kpi"><span class="kpi-value">${num((s.by_tier || {}).A)}</span><span class="kpi-label">A 級（高度優先）</span></div>
        <div class="kpi"><span class="kpi-value">${num(s.mean_score, 1)}</span><span class="kpi-label">平均分數</span></div>
      </div>

      <div class="card" style="margin-top:.9rem">
        <div class="grid grid-4" style="gap:.5rem">
          <label class="field"><span>顯示數量</span>
            <select id="p-limit">
              ${['20', '50', '100', '200', '0'].map((v) => `<option value="${v}"${String(st.limit) === v ? ' selected' : ''}>${v === '0' ? '全部 658 株' : `前 ${v} 株`}</option>`).join('')}
            </select></label>
          <label class="field"><span>優先等級</span>
            <select id="p-tier">
              <option value="">全部等級</option>
              ${(m.tiers || []).map((t) => `<option value="${esc(t.id)}"${st.tier === t.id ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}
            </select></label>
          <label class="field"><span>堂區</span>
            <select id="p-parish"><option value="">全部堂區</option>
              ${usedParishes.map((p) => `<option value="${esc(p)}"${st.parish === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}
            </select></label>
          <label class="field"><span>關鍵字（樹號／樹種／地點）</span>
            <input type="search" id="p-q" value="${esc(st.q)}" placeholder="例如 544、桑、觀音古廟"></label>
        </div>
        <div class="row" style="margin-top:.6rem">
          <button class="btn btn-sm btn-primary" id="p-apply">套用條件</button>
          <a class="btn btn-sm" id="p-print" href="${printHref(st)}">列印名單</a>
          <button class="btn btn-sm" id="p-csv">匯出 CSV</button>
          <button class="btn btn-sm" id="p-copy">複製摘要</button>
          <span class="tiny muted">符合條件 ${num(data.count)} 株／共 ${num(data.evaluated)} 株</span>
        </div>
      </div>

      ${s.top ? `<div class="notice notice-info" style="margin-top:.8rem">
        <strong>目前最高分：</strong>#${esc(s.top.tree_no)} ${esc(s.top.species)}（${num(s.top.age_years)} 年）
        ${num(s.top.score)} 分・${esc(s.top.tier)} 級 —— 名次依「分數高→樹齡高→樹號小」決定。
      </div>` : ''}

      <div class="card" style="margin-top:.9rem">
        <div class="table-wrap">
          <table class="table" id="p-table">
            <thead><tr>
              <th>名次</th><th>古樹</th><th>樹種</th><th>樹齡</th><th>健康</th><th>級別</th>
              <th>胸徑</th><th>區位風險</th><th>分數</th><th>等級</th><th>主要理由</th>
            </tr></thead>
            <tbody>
              ${rows.map((r) => `
                <tr>
                  <td><strong>${num(r.rank)}</strong></td>
                  <td><a href="#/map?tree=${encodeURIComponent(r.tree_no)}">#${esc(r.tree_no)}</a>
                    <div class="tiny muted">${esc(r.loc || '')}</div></td>
                  <td>${esc(r.species)}</td>
                  <td>${num(r.age_years)} 年</td>
                  <td>${healthBadge(r.health)}</td>
                  <td>${esc(r.grade || '—')}</td>
                  <td>${r.diameter_cm == null ? '—' : `${num(r.diameter_cm, 2)} cm`}</td>
                  <td><span class="badge badge-${r.risk_level === 'high' ? 'danger' : (r.risk_level === 'low' ? 'info' : 'muted')}">${esc(({ high: '高', mid: '中', low: '低' })[r.risk_level] || '中')}</span></td>
                  <td><strong>${num(r.score)}</strong></td>
                  <td>${tierBadge(r.tier)}</td>
                  <td class="tiny">
                    ${r.reasons.map((x) => esc(x)).join('<br>')}
                    <div class="tiny muted" style="margin-top:.2rem">配分：樹齡 ${num(r.parts.age)}／健康 ${num(r.parts.health)}／級別 ${num(r.parts.grade)}／稀有 ${num(r.parts.rarity)}／區位 ${num(r.parts.risk)}</div>
                  </td>
                </tr>`).join('') || '<tr><td colspan="11" class="muted">沒有符合條件的古樹，請調整篩選條件。</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <details class="card" style="margin-top:.9rem">
        <summary><strong>評分方法（點開看每項規則與注意事項）</strong></summary>
        <div class="table-wrap" style="margin-top:.6rem">
          <table class="table">
            <thead><tr><th>面向</th><th>權重</th><th>規則</th></tr></thead>
            <tbody>${(m.steps || []).map((x) => `<tr><td>${esc(x.name)}</td><td>${num(x.weight)} 分</td><td class="small">${esc(x.rule)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <h3 style="margin-top:.8rem">等級門檻</h3>
        <ul class="small">${(m.tiers || []).map((t) => `<li><strong>${esc(t.id)} 級</strong>（${num(t.min)} 分以上）：${esc(t.hint)}</li>`).join('')}</ul>
        <p class="small muted" style="margin-top:.5rem">名次規則：${esc(m.tie_break || '')}</p>
        <h3 style="margin-top:.8rem">這份名單的限制（請務必一起看）</h3>
        <ul class="small">${(m.caveats || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      </details>`;

    body.querySelector('#p-apply').addEventListener('click', () => {
      st.limit = body.querySelector('#p-limit').value;
      st.tier = body.querySelector('#p-tier').value;
      st.parish = body.querySelector('#p-parish').value;
      st.q = body.querySelector('#p-q').value.trim();
      location.hash = `#/priority?${new URLSearchParams({ limit: st.limit, tier: st.tier, parish: st.parish, q: st.q }).toString()}`;
    });
    body.querySelector('#p-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') body.querySelector('#p-apply').click(); });
    body.querySelector('#p-copy').addEventListener('click', () => copyText(summaryText(data)));
    body.querySelector('#p-csv').addEventListener('click', () => downloadCsv('優先保育名單.csv', rows.map((r) => ({
      名次: r.rank, 古樹編號: r.tree_no, 樹種: r.species, 堂區: r.parish, 地點: r.loc,
      樹齡: r.age_years, 健康狀況: r.health, 官方級別: r.grade, 胸徑公分: r.diameter_cm,
      區位風險: ({ high: '高', mid: '中', low: '低' })[r.risk_level] || '中',
      分數: r.score, 優先等級: r.tier, 樹齡配分: r.parts.age, 健康配分: r.parts.health,
      級別配分: r.parts.grade, 稀有配分: r.parts.rarity, 區位配分: r.parts.risk,
      主要理由: r.reasons.join('；'), 緯度: r.lat, 經度: r.lon,
    }))));
    body.querySelector('#p-print').href = printHref(st);
  }

  await load();
  return { destroy: () => { try { toast(''); } catch { /* 忽略 */ } } };
}
