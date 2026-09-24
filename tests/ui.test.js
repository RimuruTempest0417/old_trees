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
