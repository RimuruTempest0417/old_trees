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

/* ---------------------------------------------------------------
   中文排版的空白清理（v1.0.1）
   HTML 樣板裡的換行與縮排，瀏覽器會收成一個半角空格，中文句子中間因此
   出現多餘空白（例如「分成 城市綠化」）。這裡把「中文字之間」與「中文
   標點之後」的半角空白去掉；數字與英文前後的空白是刻意的排版，保留不動。
   <code>／<pre> 等程式碼區塊一律跳過。
   --------------------------------------------------------------- */
const CJK_CHAR = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff';
const CJK_SPACE_CJK = new RegExp(`([${CJK_CHAR}])[ \\t]+(?=[${CJK_CHAR}])`, 'g');
const PUNCT_SPACE_CJK = new RegExp(`([，。、；：！？）】》」』…])[ \\t]+(?=[${CJK_CHAR}])`, 'g');
const SPACING_SKIP_TAGS = new Set(['CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SCRIPT', 'STYLE', 'KBD', 'SAMP']);
// 這幾種標籤是行內元素：文字節點被它們隔開時，中間的空白仍然會顯示成一個空格
const INLINE_TAGS = new Set(['STRONG', 'EM', 'CODE', 'SPAN', 'A', 'B', 'I', 'SMALL', 'MARK', 'ABBR', 'SUP', 'SUB', 'U', 'S', 'LABEL', 'TIME', 'CITE', 'Q']);
const CJK_TAIL = new RegExp(`[${CJK_CHAR}，。、；：！？）】》」』…]$`);
const CJK_HEAD = new RegExp(`^[ \\t]+[${CJK_CHAR}]`);

/** 清掉一段文字裡多餘的半角空白。回傳 { text, count }，count 為清掉的字元數。 */
export function normalizeCjkText(value) {
  const before = String(value);
  const after = before.replace(CJK_SPACE_CJK, '$1').replace(PUNCT_SPACE_CJK, '$1');
  return { text: after, count: before.length - after.length };
}

/** 兩個文字節點之間只隔著行內元素嗎？（是的話，中間的空白會真的顯示出來） */
function inlineNeighbours(a, b) {
  const chain = (node) => {
    const out = [];
    for (let el = node.parentElement; el; el = el.parentElement) out.push(el);
    return out;
  };
  const up = new Set(chain(b));
  let common = null;
  for (const el of chain(a)) if (up.has(el)) { common = el; break; }
  if (!common) return false;
  const allInline = (node) => {
    for (let el = node.parentElement; el && el !== common; el = el.parentElement) {
      if (!INLINE_TAGS.has(el.tagName)) return false;
    }
    return true;
  };
  return allInline(a) && allInline(b);
}

/** 清理整個容器內所有文字節點的多餘空白，回傳清掉的字元總數。 */
export function normalizeCjkSpacing(root) {
  if (!root || typeof document === 'undefined' || !document.createTreeWalker) return 0;
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      for (let p = node.parentElement; p && p !== root; p = p.parentElement) {
        if (SPACING_SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let removed = 0;
  const strip = (node, re, flag) => {
    const before = node.nodeValue;
    const after = before.replace(re, '');
    if (after !== before) { node.nodeValue = after; removed += before.length - after.length; }
    return flag;
  };
  for (const node of nodes) {
    const r = normalizeCjkText(node.nodeValue);
    if (r.count) { node.nodeValue = r.text; removed += r.count; }
  }
  // 相鄰文字節點被行內標籤隔開時（例如「依 <strong>樹齡</strong>」），
  // 中間的空白也會顯示出來——看前一個字與下一個字是不是中文，是就吃掉。
  for (let i = 0; i + 1 < nodes.length; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (!a.isConnected || !b.isConnected) continue;
    if (!inlineNeighbours(a, b)) continue;
    const at = a.nodeValue;
    const bt = b.nodeValue;
    const aEndsCjk = CJK_TAIL.test(at.replace(/[ \t]+$/, ''));
    const bStartsCjk = new RegExp(`^[${CJK_CHAR}]`).test(bt.replace(/^[ \t]+/, ''));
    if (CJK_HEAD.test(bt) && aEndsCjk) strip(b, /^[ \t]+/, true);
    else if (/[ \t]+$/.test(at) && bStartsCjk) strip(a, /[ \t]+$/, true);
  }
  return removed;
}

/** 持續監看容器後續的內容變更（動態載入的表格、清單都涵蓋），回傳 observer。 */
export function watchCjkSpacing(root) {
  if (!root || typeof MutationObserver !== 'function') return null;
  const pending = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const el of pending) if (el.isConnected) normalizeCjkSpacing(el);
    pending.clear();
  };
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.type === 'characterData' ? r.target.parentElement : r.target;
      if (el && el.nodeType === 1) pending.add(el);
    }
    if (pending.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return observer;
}

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
