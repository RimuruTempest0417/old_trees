/**
 * 應用程式入口：雜湊路由、頁首資料來源標示、共用快取。
 * 檢視模組採動態 import，第一次進入某個分頁才載入對應程式碼。
 */
import { api, cached } from './api.js';
import { esc, toast, closeModal } from './ui.js';

const VIEWS = {
  overview: () => import('./dashboard.js'),
  map: () => import('./map.js'),
  routes: () => import('./routes.js'),
  analytics: () => import('./analytics.js'),
  knowledge: () => import('./knowledge.js'),
};

const TITLES = {
  overview: '總覽',
  map: '地圖查詢',
  routes: '路綫推薦',
  analytics: '數據分析',
  knowledge: '保育科普',
};

let current = null;

function parseHash() {
  const raw = (window.location.hash || '#/overview').replace(/^#\/?/, '');
  const [name, query] = raw.split('?');
  return { name: VIEWS[name] ? name : 'overview', params: new URLSearchParams(query || '') };
}

async function showView(name, params) {
  const section = document.getElementById(`view-${name}`);
  if (!section) return;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v !== section; });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  document.title = `${TITLES[name]}｜澳門古樹保育研究平台`;

  if (current && current.destroy) {
    try { current.destroy(); } catch (err) { console.warn('檢視清理失敗', err); }
  }
  current = { name, destroy: null };

  try {
    const mod = await VIEWS[name]();
    const ctl = await mod.render(section, params) || {};
    if (current && current.name === name) current.destroy = ctl.destroy || null;
  } catch (err) {
    console.error(err);
    section.innerHTML = `
      <div class="card">
        <h2>載入「${esc(TITLES[name])}」時發生錯誤</h2>
        <p class="muted">${esc(err.message || err)}</p>
        <p class="small">請確認 Serverless Functions 是否正常運作，或稍後重試。</p>
        <button class="btn btn-primary" onclick="location.reload()">重新載入</button>
      </div>`;
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function route() {
  const { name, params } = parseHash();
  showView(name, params);
}

async function initSourceBadge() {
  const badge = document.getElementById('source-badge');
  try {
    const meta = await cached('meta', () => api.meta());
    const s = meta.site;
    const module = meta.module || 'unknown';
    if (s.data_source === 'supabase') {
      badge.className = 'badge badge-good';
      badge.textContent = `Supabase 已連線・${s.counts.trees} 筆`;
      badge.title = `${s.note}\n資料集：${s.dataset}`;
    } else {
      badge.className = 'badge badge-fair';
      badge.textContent = `示範模式・${s.counts.trees} 筆`;
      badge.title = s.note;
    }
    // 讓示範模式在畫面上明顯可見
    if (s.data_source !== 'supabase') {
      const banner = document.createElement('div');
      banner.className = 'notice';
      banner.style.margin = '1rem auto 0';
      banner.style.maxWidth = 'var(--maxw)';
      banner.innerHTML = `<strong>資料來源：</strong>${esc(s.note)}`
        + ' 於部署環境設定資料庫連線環境變數（見 README 的「連接 Supabase」一節）後，即會改讀 Supabase PostgreSQL。';
      document.querySelector('main').prepend(banner);
    }
  } catch (err) {
    badge.className = 'badge badge-bad';
    badge.textContent = '無法連線 API';
    badge.title = String(err.message || err);
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#modal [data-close]').forEach((n) => n.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#/"]');
    if (link && link.getAttribute('href') === window.location.hash) {
      e.preventDefault();
      route();
    }
  });
  initSourceBadge();
  route();
});

export { toast };
