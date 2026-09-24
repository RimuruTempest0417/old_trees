/** 共用介面工具：DOM 建立、格式化、徽章、Markdown 與數學式渲染、安全過濾。 */

/** HTML 轉義 —— 所有來自資料庫的字串都必須先經過此函式才可插入 innerHTML */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 只允許 http/https 的圖片網址，避免 javascript: 等危險協定 */
export function safeUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^(https?:)?\//i.test(s) || s.startsWith('data:image/')) return s;
  return '';
}

export const num = (v, digits = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-Hant', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const pct = (v, digits = 1) => (Number.isFinite(Number(v)) ? `${num(v, digits)}%` : '—');

export function fmtP(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '—';
  if (n < 0.001) return '< 0.001';
  return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export const healthBadge = (h) => {
  const cls = { 健康: 'badge-good', 一般: 'badge-fair', 瀕危: 'badge-bad' }[h] || 'badge-muted';
  return `<span class="badge ${cls}">${esc(h)}</span>`;
};

export const gradeBadge = (g) => {
  const cls = { 一級: 'badge-bad', 二級: 'badge-fair', 三級: 'badge-good', 不分級: 'badge-info' }[g] || 'badge-muted';
  return `<span class="badge ${cls}">${esc(g)}</span>`;
};

export const healthColor = (h) => ({ 健康: '#16a34a', 一般: '#f59e0b', 瀕危: '#dc2626' }[h] || '#6b7280');

export const render = (node, html) => { node.innerHTML = html; return node; };

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const loading = (label = '載入中…') =>
  `<div class="loading"><span class="spinner"></span><span>${esc(label)}</span></div>`;

export function toast(message, ms = 2600) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { box.hidden = true; }, ms);
}

export function openModal(html) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-body').innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const modal = document.getElementById('modal');
  modal.hidden = true;
  document.body.style.overflow = '';
}

/** 移除 Markdown 產生的危險節點與屬性（縱深防禦；即使內容來自自家資料庫仍過濾） */
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const BAD_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style', 'form', 'base'];
  root.querySelectorAll(BAD_TAGS.join(',')).forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((n) => {
    for (const attr of [...n.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if (name.startsWith('on')) n.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src' || name === 'xlink:href')
        && /^\s*(javascript|data:text\/html|vbscript):/i.test(value)) n.removeAttribute(attr.name);
      else if (name === 'style' && /expression|url\s*\(\s*['"]?\s*javascript:/i.test(value)) n.removeAttribute(attr.name);
    }
  });
  return root.innerHTML;
}

/** Markdown → HTML（含表格、註腳與行內數學式） */
export function markdown(md) {
  if (typeof window.marked === 'undefined') return `<pre>${esc(md)}</pre>`;
  window.marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
  const raw = window.marked.parse(md || '');
  const clean = sanitize(raw);
  // 交代 KaTeX 稍後處理：先插入佔位元素，掛載後再渲染
  return clean;
}

/** 在已插入 DOM 的容器內渲染數學式 */
export function renderMath(container) {
  if (typeof window.renderMathInElement !== 'function') return;
  try {
    window.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    });
  } catch (err) {
    console.warn('KaTeX 渲染失敗', err);
  }
}

/** 由資料陣列產生 CSV 並下載 */
export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')].concat(rows.map((r) =>
    headers.map((h) => {
      const v = r[h] === null || r[h] === undefined ? '' : String(r[h]);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已複製到剪貼簿');
  } catch {
    toast('複製失敗，請手動選取');
  }
}

/**
 * 把任何被 catch 到的東西轉成一句可讀文字。
 *
 * 為什麼一定要用這個：`esc(err.message || err)` 在 err 是「沒有 message 的物件」時，
 * 畫面會出現字面上的「[object Object]」——等於沒有任何錯誤資訊（部署後實際踩到）。
 * 這裡依序處理：字串 → Error／有 message → 伺服器回傳的 {error:{...}} → 物件 JSON。
 */
export function errText(err) {
  if (err == null) return '未知錯誤';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  if (typeof err.error === 'string' && err.error) return err.error;
  if (err.error && typeof err.error === 'object') return errText(err.error);
  if (typeof err === 'object') {
    try {
      const s = JSON.stringify(err);
      return s && s !== '{}' ? s.slice(0, 400) : '未知錯誤（沒有附帶訊息）';
    } catch {
      return '未知錯誤（無法序列化的物件）';
    }
  }
  return String(err);
}

/** 錯誤的完整描述（訊息 ＋ 伺服器附帶的提示），用於 notice／彈窗 */
export function errDetail(err) {
  const base = errText(err);
  const hint = err && typeof err.hint === 'string' ? err.hint : '';
  const where = err && err.path ? `（${err.path}${err.status ? ` HTTP ${err.status}` : ''}）` : '';
  return `${base}${where}${hint ? ` ${hint}` : ''}`;
}
