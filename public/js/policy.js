/**
 * 政策方案（#/policy）—— 城市綠化／環保節能／文旅文創三個方向的政策型設計方案
 *
 * 這一頁的任務：把「保護古樹」從一句口號，變成三組有政策依據、有主管單位、有期程、有指標的行動。
 *
 * 【誠實原則】（與化學視角同一套規矩）
 *   - 每一條政策、每一個數字都附官方出處，並在畫面上可點開原始文件。
 *   - 官方查不到的一律列在「本頁沒有的東西」，不臆造、不拿鄰近地區數字代替。
 *   - 國際研究只作定性引用，並明確標示那不是澳門實測值。
 *   - 行動的優先順序以本站 658 株古樹的官方資料為依據（哪個堂區密度最高、哪一批最需關注）。
 */
import { api, cached } from './api.js';
import { esc, num, loading, toast, copyText, downloadCsv, errDetail } from './ui.js';

function sourceLink(s) {
  if (!s) return '<span class="tone-warn tiny">（未附出處）</span>';
  return `<a class="src-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}《${esc(s.title)}》${s.date ? `・${esc(s.date)}` : ''}</a>`;
}

function policyRow(p) {
  return `
    <tr>
      <th scope="row">${esc(p.name)}${p.year ? `<br><span class="muted tiny">${esc(p.year)}</span>` : ''}</th>
      <td>${esc(p.dept || '—')}</td>
      <td>${esc(p.key || '')}</td>
      <td>${p.numbers && p.numbers !== '－' ? `<strong>${esc(p.numbers)}</strong>` : '<span class="muted">－</span>'}</td>
      <td class="tiny">${sourceLink(p.source)}</td>
    </tr>`;
}

function actionCard(a) {
  const basis = (a.basis_sources || []).map((s) => s.missing
    ? `<span class="tone-warn tiny">${esc(s.id)}（來源缺漏）</span>`
    : `<a class="src-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('　');
  const rows = [
    ['做什麼', a.what],
    ['誰負責', a.who],
    ['一起做', a.partners],
    ['在哪裡', a.where],
    ['怎麼算成功', a.kpi],
    ['期程', a.term],
    ['成本概念', a.cost],
  ].filter(([, v]) => v);
  return `
    <div class="card policy-action">
      <h3><span class="tag">${esc(a.id)}</span> ${esc(a.title)}</h3>
      <table class="kv small">
        <tbody>
          ${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
        </tbody>
      </table>
      ${basis ? `<p class="tiny muted">政策依據：${basis}</p>` : ''}
      ${a.link ? `<p class="tiny"><a href="${esc(a.link)}">打開本站對應分頁：${esc(a.link)}</a></p>` : ''}
    </div>`;
}

function directionBlock(d) {
  return `
    <section class="card policy-direction" id="dir-${esc(d.id)}">
      <h2>${esc(d.name)}</h2>
      <p class="lead">${esc(d.goal)}</p>
      <p class="small">${esc(d.why)}</p>

      <h3>政策依據（每一條都附官方出處）</h3>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>政策／法規</th><th>主管</th><th>與古樹相關的內容</th><th>可引用數字</th><th>出處</th></tr></thead>
          <tbody>${d.policies.map(policyRow).join('')}</tbody>
        </table>
      </div>

      <h3>具體行動（${d.actions.length} 項）</h3>
      <div class="policy-actions">${d.actions.map(actionCard).join('')}</div>

      <h3>以本站資料支持的優先順序</h3>
      <ul class="small">
        ${d.evidence.map((e) => `<li><strong>${esc(e.label)}</strong>：${esc(e.value)}${e.source ? `　<span class="tiny muted">（出處：${esc(e.source.title)}）</span>` : '　<span class="tiny muted">（本站統計／現況）</span>'}</li>`).join('')}
      </ul>
    </section>`;
}

function summaryText(d) {
  const s = d.summary || {};
  const L = ['【政策型設計方案：城市綠化／環保節能／文旅文創】',
    `方案方向 ${s.direction_count} 個、政策依據 ${s.policy_count} 條、具體行動 ${s.action_count} 項、官方來源 ${s.source_count} 個（資料內容雜湊 ${s.hash}）`, ''];
  for (const dir of d.directions) {
    L.push(`■ ${dir.name}`);
    L.push(`  目標：${dir.goal}`);
    for (const p of dir.policies) {
      L.push(`  政策依據：${p.name}（${p.dept}）${p.numbers && p.numbers !== '－' ? `｜可引用：${p.numbers}` : ''}`);
    }
    for (const a of dir.actions) {
      L.push(`  行動 ${a.id}｜${a.title}`);
      L.push(`    ${a.what}`);
      L.push(`    負責：${a.who}；期間：${a.term}；指標：${a.kpi}`);
    }
    L.push('');
  }
  L.push('【本頁沒有的東西】');
  for (const g of d.gaps) L.push(`  ・${g.title}：${g.detail}`);
  return L.join('\n');
}

function actionRows(d) {
  const rows = [];
  for (const dir of d.directions) {
    for (const a of dir.actions) {
      rows.push({
        方向: dir.name,
        編號: a.id,
        行動: a.title,
        做什麼: a.what,
        負責單位: a.who,
        合作單位: a.partners || '',
        地點: a.where || '',
        成功指標: a.kpi,
        期程: a.term,
        成本概念: a.cost || '',
      });
    }
  }
  return rows;
}

export async function render(section) {
  section.innerHTML = `<div class="page-head">
      <h1>政策方案</h1>
      <p>這一頁把古樹保育接上澳門<strong>現行的政策與法規</strong>，分成
      <strong>城市綠化</strong>、<strong>環保節能</strong>、<strong>文旅文創</strong>三個方向，
      每個方向都寫出：政策依據（可點開原始文件）、具體行動（誰負責、做什麼、在哪裡、怎麼算成功、期程、成本概念），
      以及<strong>為什麼先做這幾項</strong>——優先順序來自本站 658 株古樹的官方資料。</p>
      <p class="tiny muted">每一項都附出處；官方查不到的一律寫在「本頁沒有的東西」，不臆造、不拿外國數字當澳門數字。</p>
    </div>
    <div id="policy-body">${loading('政策方案資料載入中…')}</div>`;

  const body = section.querySelector('#policy-body');
  let d;
  try {
    d = await cached('policy:all', () => api.policy({ all: 1 }));
  } catch (err) {
    body.innerHTML = `<div class="card"><h2>載入失敗</h2><p class="small">${esc(errDetail(err))}</p></div>`;
    return;
  }

  const s = d.summary || {};
  body.innerHTML = `
    <div class="stat-row">
      <div class="stat"><div class="stat-label">方案方向</div><div class="stat-value">${num(s.direction_count)}<span class="stat-unit">個</span></div>
        <div class="tiny muted">城市綠化／環保節能／文旅文創</div></div>
      <div class="stat"><div class="stat-label">政策依據</div><div class="stat-value">${num(s.policy_count)}<span class="stat-unit">條</span></div>
        <div class="tiny muted">全部附官方出處</div></div>
      <div class="stat"><div class="stat-label">具體行動</div><div class="stat-value">${num(s.action_count)}<span class="stat-unit">項</span></div>
        <div class="tiny muted">含負責單位、期程與指標</div></div>
      <div class="stat"><div class="stat-label">官方來源</div><div class="stat-value">${num(s.source_count)}<span class="stat-unit">個</span></div>
        <div class="tiny muted">法令資料庫、市政署、環保局、文化局…</div></div>
    </div>

    <div class="card">
      <h2>這份方案的方法</h2>
      <p class="small"><strong>範圍</strong>：${esc(s.method ? s.method.scope : '')}</p>
      <p class="small"><strong>誠實原則</strong>：${esc(s.method ? s.method.honesty : '')}</p>
      <p class="small"><strong>優先順序怎麼來</strong>：${esc(s.method ? s.method.data : '')}</p>
      <p class="btn-row">
        <button class="btn" id="policy-copy">複製方案摘要</button>
        <button class="btn btn-ghost" id="policy-csv">匯出行動清單 CSV</button>
        <a class="btn btn-ghost" href="#/card?mode=policy">列印 A4 方案摘要</a>
      </p>
    </div>

    ${d.directions.map(directionBlock).join('')}

    <section class="card" id="policy-gaps">
      <h2>本頁沒有的東西（先說清楚）</h2>
      <ul class="small">
        ${d.gaps.map((g) => `<li><strong>${esc(g.title)}</strong><br>${esc(g.detail)}${g.source ? `　<span class="tiny muted">相關出處：${sourceLink(g.source)}</span>` : ''}</li>`).join('')}
      </ul>
    </section>

    <section class="card">
      <h2>全部來源索引（${(d.summary && d.summary.source_count) || 0} 個）</h2>
      <details>
        <summary class="small">展開來源清單</summary>
        <ol class="small src-list">
          ${(d.sources || []).map((x) => `<li>${sourceLink(x)}</li>`).join('')}
        </ol>
      </details>
      <p class="tiny muted">資料內容雜湊：<code>${esc(s.hash || d.hash || '')}</code></p>
    </section>`;

  const dirs = d.directions.filter((x) => x.policies.length || x.actions.length);
  if (!dirs.length) {
    body.insertAdjacentHTML('afterbegin',
      '<div class="card tone-warn"><h2>方案內容尚未載入</h2><p class="small">資料檔目前沒有內容（directions 皆為空）。</p></div>');
  }

  body.querySelector('#policy-copy').addEventListener('click', () => copyText(summaryText(d)));
  body.querySelector('#policy-csv').addEventListener('click', () => {
    downloadCsv('澳門古樹_政策方案行動清單.csv', actionRows(d));
    toast('已匯出行動清單 CSV');
  });

  return () => {};
}

export default render;
