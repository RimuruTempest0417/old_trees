/**
 * 前端適配測試：裝置深淺色模式與手機瀏覽器。
 *
 * 這些規則一旦被誤刪（例如改版時覆蓋 style.css），手機上會直接壞掉且不容易察覺，
 * 因此以測試守住：viewport 設定、深色模式變數與覆蓋、手機斷點、觸控目標、
 * iOS 輸入字級、動態視窗高度單位、安全區域，以及列印時不輸出背景圖。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const html = readFileSync(`${ROOT}public/index.html`, 'utf8');
const css = readFileSync(`${ROOT}public/css/style.css`, 'utf8');

test('viewport 支援瀏海螢幕（viewport-fit=cover）', () => {
  assert.match(html, /<meta name="viewport"[^>]*width=device-width[^>]*viewport-fit=cover/);
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
});

test('theme-color 分淺色與深色兩種（手機瀏覽器介面帶跟著變）', () => {
  const themeColors = [...html.matchAll(/<meta name="theme-color"[^>]*>/g)].map((m) => m[0]);
  assert.equal(themeColors.length, 2, '應有兩個 theme-color');
  assert.ok(themeColors.some((t) => /prefers-color-scheme:\s*dark/.test(t)), '深色版本需帶 media 條件');
});

test('CSS 宣告 color-scheme，原生控件才會跟著變色', () => {
  assert.match(css, /color-scheme:\s*light dark/);
});

test('深色模式：變數與連結色皆有覆蓋，且 Leaflet 內建樣式也被覆蓋', () => {
  const darkBlocks = css.match(/@media \(prefers-color-scheme: dark\)/g) || [];
  assert.ok(darkBlocks.length >= 3, `深色模式區塊過少：${darkBlocks.length}`);
  const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
  assert.match(dark, /--link:\s*#[0-9a-f]{6}/, '深色模式需另設連結色（深綠在深底上對比不足）');
  assert.match(dark, /\.leaflet-popup-content-wrapper/, '需覆蓋 Leaflet 彈窗底色');
  assert.match(dark, /\.leaflet-bar a/, '需覆蓋 Leaflet 縮放鈕');
  assert.match(dark, /\.leaflet-tile/, '地圖圖磚在深色模式應反相');
  assert.match(css, /--link:\s*#[0-9a-f]{6}/, '淺色模式也要定義 --link');
  assert.match(css, /color-scheme: light dark/);
});

test('手機斷點：700px 與 400px', () => {
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 400px\)/);
});

test('平板與手機輸入框字級 ≥16px（iOS 才不會自動放大整頁）', () => {
  // 直接定位「含 email 型別的那個 940 px 斷點區塊」（檔案裡有多個 940 px 斷點）
  const i16 = css.indexOf('input[type="email"]');
  const iBlock = css.lastIndexOf('@media (max-width: 940px)', i16);
  assert.ok(i16 > 0 && iBlock > 0 && i16 - iBlock < 400, '16 px 的輸入框規則應位於 940 px 斷點內');
  const block = css.slice(iBlock, css.indexOf('\n}', i16));
  assert.match(block, /font-size: 16px;/);
  assert.match(block, /\.btn \{ min-height: 44px; \}/, '平板觸控目標也要放大');
  // 基礎樣式裡的每一種 input 型別都必須重新宣告：屬性選擇器 input[type="text"] 權重
  // 高於 input，若不同權重覆寫，16 px 會被基礎樣式的 .92rem（14.72 px）蓋掉
  // ——這正是自動化稽核在手機寬度上實際抓到的 bug。
  const base = css.slice(css.indexOf('select, input[type="text"]'), css.indexOf('select:focus'));
  const types = [...base.matchAll(/input\[type="(\w+)"\]/g)].map((m) => m[1]);
  assert.ok(types.length >= 3, '基礎樣式應含多種 input 型別');
  for (const t of types) {
    assert.ok(block.includes(`input[type="${t}"]`), `940 斷點未覆蓋 input[type="${t}"]`);
  }
});

test('手機觸控目標放大（按鈕／頁籤至少 40px 高）', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 700px)'));
  assert.match(mobile, /\.btn \{ padding: [^}]*min-height: 44px; \}/);
  assert.match(mobile, /\.btn-sm \{ padding: [^}]*min-height: 40px; \}/);
  assert.match(mobile, /\.tab \{[^}]*min-height: 40px/);
});

test('手機把 tab 列做成可橫向滑動，不會擠成兩行', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 700px)'));
  assert.match(mobile, /\.tabs \{[^}]*overflow-x: auto/);
  assert.match(mobile, /\.tabs \{[^}]*flex-wrap: nowrap/);
});

test('手機使用動態視窗高度與安全區域，彈窗改為底部浮出', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 700px)'));
  assert.match(mobile, /dvh/, '應使用 dvh 避免手機網址列造成高度跳動');
  assert.match(mobile, /env\(safe-area-inset-bottom\)/, '需避開 iPhone 底部指示列');
  assert.match(mobile, /\.modal \{ padding: 0; align-items: flex-end; \}/);
});

test('不得用 overflow-x: hidden 擋溢出（會破壞 sticky 頁首）', () => {
  assert.match(css, /overflow-x: clip/);
  assert.doesNotMatch(css, /overflow-x: hidden/);
});

test('格線項目可縮到容器寬度，否則寬表格會撐破手機版面', () => {
  // 實測：360 px 螢幕上分析頁卡片被內容撐到 364 px，整頁橫向溢出 18 px
  assert.match(css, /\.grid > \*, \.split > \*, \.map-layout > \*[^}]*\{ min-width: 0; \}/);
  assert.match(css, /\.table-wrap \{ overflow-x: auto; min-width: 0; max-width: 100%; \}/);
  assert.doesNotMatch(css, /grid-template-columns: 1fr;/, '單欄一律寫 minmax(0, 1fr) 才能被內容壓縮');
});

test('列印時不輸出模糊背景圖，並回到淺色', () => {
  const print = css.slice(css.indexOf('@media print'));
  assert.match(print, /body::before, body::after \{ display: none !important; \}/);
  assert.match(print, /body \{ background: #fff; color: #000;/);
});

test('CSS 大括號成對（改版時常見的手誤）', () => {
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  assert.equal(open, close, `大括號不成對：{ ${open} 個 / } ${close} 個`);
  assert.ok(css.length > 15000, 'CSS 檔案異常小，可能被截斷');
});

/* ── 表格內插與圖表小結（v0.6.0 新增的守門測試）───────────────────────────
   1. <tbody>${rows}</tbody> 這種「直接內插陣列」會產生逗號；HTML 解析器會把
      表格內的非空白文字（逗號）foster-parent 搬出 <table>，在表格前面留下一整排「、」。
      這是實際發生過的顯示錯誤，因此以測試固定住寫法。
   2. 每一張分析圖都必須有 .summary 小結段落，避免改版時被刪掉。 */
const dashboard = readFileSync(`${ROOT}public/js/dashboard.js`, 'utf8');
const analytics = readFileSync(`${ROOT}public/js/analytics.js`, 'utf8');

test('表格內容若為陣列必須 join，不可直接內插', () => {
  assert.ok(!/<tbody>\$\{rows\}<\/tbody>/.test(dashboard), '<tbody> 不可直接內插陣列');
  assert.match(dashboard, /<tbody>\$\{Array\.isArray\(rows\) \? rows\.join\(''\) : rows\}<\/tbody>/);
  const unjoined = [...dashboard.matchAll(/\$\{(data\.[a-z_]+\.map\([^{}]*\))\}/g)].map((m) => m[1]);
  assert.deepEqual(unjoined, [], `下列內插未 join：${unjoined.join(' / ')}`);
});

test('總覽與分析頁的每張圖都有小結說明文字', () => {
  const summaryCss = /\.summary\s*\{/.test(css);
  assert.ok(summaryCss, 'style.css 缺少 .summary 樣式');
  // 總覽頁：堂區分佈、密度、品種排行、健康與分級 —— 皆須有小結
  assert.equal((dashboard.match(/<div class="summary">/g) || []).length, 4);
  // 分析頁：直方圖、散點圖、品種樹高、卡方、預測 —— 小結以模板或動態填入
  const analyticsSummaries = (analytics.match(/class="summary"/g) || []).length;
  assert.ok(analyticsSummaries >= 5, `分析頁小結數量不足：${analyticsSummaries}`);
});

test('堂區名稱完整顯示，不再截去「堂區」二字', () => {
  assert.ok(!/replace\('堂區', ''\)/.test(dashboard), '總覽頁仍會截短堂區名稱');
  assert.ok(!/replace\('堂區', ''\)/.test(analytics), '分析頁仍會截短堂區名稱');
});

test('胸徑／胸圍一律顯示市政署官方值，前端不得再自己換算', () => {
  const map = readFileSync(`${ROOT}public/js/map.js`, 'utf8');
  const card = readFileSync(`${ROOT}public/js/card.js`, 'utf8');
  for (const [name, src] of [['map.js', map], ['card.js', card]]) {
    assert.ok(!/diameter_cm\s*\*\s*Math\.PI|Math\.PI\s*\*\s*t\.diameter_cm/.test(src),
      `${name} 仍在用胸徑 × π 換算胸圍`);
    assert.ok(!src.includes('由胸徑換算'), `${name} 仍有「由胸徑換算」字樣`);
    assert.ok(src.includes('girth_cm'), `${name} 沒有使用官方胸圍欄位 girth_cm`);
  }
  // 市政署兩個欄位都要標明來源
  assert.match(map, /胸徑（市政署）/);
  assert.match(map, /胸圍（市政署）/);
});

test('routeProblem 實際行為：空路綫給可讀訊息，正常路綫回 null', async () => {
  const { routeProblem } = await import('../public/js/routes.js');
  // 後端在沒有候選古樹時回這個形狀
  assert.equal(routeProblem({ route: null, stops: [], message: '沒有符合條件的古樹，請調整篩選條件。' }),
    '沒有符合條件的古樹，請調整篩選條件。');
  assert.equal(routeProblem(null), '路綫資料讀取失敗，請稍後再試。');
  assert.equal(routeProblem({ route: { name: '路綫五' }, stops: [], message: '' }),
    '這條路綫沒有產生任何停靠站，請調整停靠站數或篩選條件。');
  assert.equal(routeProblem({ route: { name: '路綫五' }, stops: [{ lat: 22.2, lon: 113.5 }] }), null);
});

test('路綫推薦：後端回傳空路綫時前端必須顯示訊息，而不是拋錯', () => {
  // 回歸：後端可能回 {route: null, stops: [], message}，前端讀 r.route.name 會出現
  // 「Cannot read properties of null (reading 'name')」，使用者只看到一句看不懂的英文。
  const routes = readFileSync(`${ROOT}public/js/routes.js`, 'utf8');
  assert.match(routes, /export function routeProblem/, 'routes.js 缺少 routeProblem 守門函式');
  assert.match(routes, /if \(!data\.route\)/, 'routeProblem 沒有處理 route 為 null 的情況');
  assert.match(routes, /return data\.message \|\|/, 'routeProblem 沒有帶出後端訊息');
  const detail = routes.slice(routes.indexOf('function renderDetail(r)'));
  assert.ok(/routeProblem\(r\)/.test(detail.slice(0, 400)), 'renderDetail 沒有先檢查路綫資料');
  // 不得再有無保護的 r.route.name
  assert.ok(!/const\s+g\s*=\s*r\.route\.name/.test(routes), '仍有未受保護的 r.route.name');
});

test('模態框必須高於 Leaflet 控制項（縮放鈕不得蓋住彈窗）', () => {
  const modalZ = /\.modal \{ position: fixed; inset: 0; z-index: (\d+);/.exec(css);
  assert.ok(modalZ, '找不到 .modal 的 z-index');
  assert.ok(Number(modalZ[1]) > 1000, `模態框 z-index ${modalZ[1]} 低於 Leaflet 控制項的 1000`);
  assert.match(css, /\.leaflet-container \{ isolation: isolate; z-index: 0; \}/);
});
