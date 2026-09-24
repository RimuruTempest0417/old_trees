/** 保育科普：文章清單、全文（Markdown ＋ KaTeX）、立法時間線、參考來源。 */
import { api, cached } from './api.js';
import { esc, num, errDetail, loading, markdown, renderMath } from './ui.js';

let activeSlug = null;

export async function render(section, params) {
  section.innerHTML = `<div class="page-head"><h1>保育科普</h1>
    <p>回答「為什麼要保育古樹」「分佈與歷史」「何時立法」「如何應對未來」等問題，並附可查證的來源。
    每篇文章下方均列出參考出處。</p></div>
    <div class="split">
      <div class="stack">
        <div class="card card-tight">
          <div class="chips" id="cat-chips"></div>
        </div>
        <div class="card card-scroll" style="max-height:56vh">
          <div class="stack" id="topic-list">${loading('載入文章…')}</div>
        </div>
        <div class="card card-tight">
          <h3 style="font-size:.98rem">立法時間線</h3>
          <div id="timeline-box" class="timeline" style="margin-top:.5rem">${loading()}</div>
        </div>
      </div>
      <div class="card article" id="article-box">
        <p class="muted">請由左側選擇一篇文章。</p>
      </div>
    </div>`;

  const [data, timeline] = await Promise.all([
    cached('conservation', () => api.conservation()),
    cached('timeline', () => api.timeline()),
  ]);

  // ── 分類標籤 ──────────────────────────────────────────
  let filter = params.get('category') || '';
  const chips = section.querySelector('#cat-chips');
  chips.innerHTML = [`<button class="chip${filter ? '' : ' active'}" data-cat="">全部（${data.count}）</button>`]
    .concat(data.categories.map((c) => {
      const n = data.topics.filter((t) => t.category === c).length;
      return `<button class="chip${filter === c ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}（${n}）</button>`;
    })).join('');

  // ── 文章清單 ──────────────────────────────────────────
  function renderList() {
    const list = section.querySelector('#topic-list');
    const items = data.topics.filter((t) => !filter || t.category === filter);
    list.innerHTML = items.map((t) => `
      <button class="card card-tight" data-slug="${esc(t.slug)}" style="text-align:left;cursor:pointer;border-radius:var(--radius-sm)">
        <div class="tiny muted">${esc(t.category)}</div>
        <div style="font-weight:700;font-size:.94rem;margin:.1rem 0">${esc(t.title)}</div>
        <div class="tiny muted">${esc(t.summary || '')}</div>
      </button>`).join('') || '<p class="muted small">此分類暫無文章。</p>';
    list.querySelectorAll('[data-slug]').forEach((btn) => btn.addEventListener('click', () => loadTopic(btn.dataset.slug)));
  }

  // ── 單篇文章 ──────────────────────────────────────────
  async function loadTopic(slug) {
    activeSlug = slug;
    const box = section.querySelector('#article-box');
    box.innerHTML = loading('載入文章…');
    section.querySelectorAll('#topic-list [data-slug]').forEach((b) => {
      b.style.borderColor = b.dataset.slug === slug ? 'var(--green-700)' : '';
      b.style.background = b.dataset.slug === slug ? 'var(--green-100)' : '';
    });
    try {
      const { topic } = await api.conservation({ slug });
      box.innerHTML = `
        <div class="tiny muted">${esc(topic.category)}</div>
        <h1 style="font-size:1.45rem">${esc(topic.title)}</h1>
        ${topic.summary ? `<p class="muted">${esc(topic.summary)}</p>` : ''}
        <hr>
        <div id="article-body">${markdown(topic.body_md)}</div>
        ${(topic.sources || []).length ? `
          <h3 style="margin-top:1.4rem">參考來源</h3>
          <div class="sources"><ul>${topic.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
        <div class="row" style="margin-top:1rem">
          <button class="btn btn-sm" id="dl-article">匯出本篇 Markdown</button>
          <a class="btn btn-sm" href="#/map">前往地圖查詢相關古樹</a>
          <a class="btn btn-sm" href="#/analytics">查看數據分析</a>
        </div>`;
      renderMath(box.querySelector('#article-body'));
      box.querySelector('#dl-article').addEventListener('click', () => {
        const blob = new Blob([`# ${topic.title}\n\n${topic.body_md}\n\n---\n\n## 參考來源\n`
          + (topic.sources || []).map((s) => `- ${s}`).join('\n')], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${topic.slug}.md`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
      window.location.hash = `#/knowledge?slug=${encodeURIComponent(slug)}`;
    } catch (err) {
      box.innerHTML = `<h3>載入失敗</h3><p class="muted">${esc(errDetail(err))}</p>`;
    }
  }

  chips.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
    filter = chip.dataset.cat;
    chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderList();
  }));

  // ── 時間線 ────────────────────────────────────────────
  section.querySelector('#timeline-box').innerHTML = timeline.events.map((e) => `
    <div class="timeline-item">
      <div class="timeline-year">${num(e.year)}${e.date && e.date !== String(e.year) ? `　<span class="tiny muted">${esc(e.date)}</span>` : ''}</div>
      <div style="font-weight:600;font-size:.92rem">${esc(e.title)}</div>
      <div class="tiny muted">${esc(e.detail || '')}</div>
      ${e.source ? `<div class="tiny muted">來源：${esc(e.source)}</div>` : ''}
    </div>`).join('');

  renderList();

  // 由網址指定文章，否則載入第一篇
  const slug = params.get('slug');
  await loadTopic(data.topics.some((t) => t.slug === slug) ? slug : data.topics[0].slug);

  return {
    destroy: () => { /* 保留目前文章狀態，返回時由網址參數還原 */ },
  };
}
