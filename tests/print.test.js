/**
 * 列印測試：紙上的樣子。
 *
 * 2026-09-27 使用者回報「政策方案那一版的排版和文字都有問題」——
 * 實際印出來（Safari 存成 PDF）是 402×14400pt 的「一張超長紙」，
 * 表格欄位被壓成一條條細長條。原因有兩個，都寫在這裡守著：
 *   ① print.css 寫死「只印 A4 列印分頁（#view-card）」，在其他分頁按 ⌘P
 *      會得到一張完全空白的 A4（實測 595×842pt、文字 0 字）。
 *   ② 列印寬度只有 A4（約 793px），三欄的行動卡格線會把每欄壓到 260px，
 *      中文每行兩三個字就斷行。
 * 這些規則一旦被誤刪，網頁上看起來完全正常，只有印出來才發現，所以用測試守住。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const print = readFileSync(`${ROOT}public/css/print.css`, 'utf8');
const check = readFileSync(`${ROOT}scripts/cdp-check.mjs`, 'utf8');

test('列印不再寫死「只印列印分頁」——否則其他分頁按列印是一張空白紙', () => {
  assert.doesNotMatch(
    print,
    /section\.view:not\(#view-card\)\s*\{\s*display:\s*none/,
    'print.css 不該把非列印分頁整個隱藏（會印出空白紙）；只隱藏帶 hidden 的分頁',
  );
  assert.match(print, /main > section\.view\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('A4 列印分頁的規則不能被動到（每張紙一頁、邊界歸零）', () => {
  assert.match(print, /@page\s*\{\s*size:\s*A4;\s*margin:\s*0;\s*\}/);
  assert.match(print, /\.card-page\s*\{[^}]*page-break-after:\s*always/);
  assert.match(print, /\.card-page:last-child\s*\{\s*page-break-after:\s*auto/);
});

test('一般分頁列印：多欄格線收成單欄（A4 寬度放不下三欄）', () => {
  const viewBlock = print.slice(print.indexOf('/* ── 一般分頁列印'));
  assert.match(viewBlock, /\.policy-actions\)\s*\{\s*grid-template-columns:\s*1fr\s*!important;/);
  assert.match(viewBlock, /\.stat-row\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
  assert.match(viewBlock, /table\.kv\s*\{[^}]*table-layout:\s*fixed/);
});

test('一般分頁列印：隱藏互動元件與空篩選欄位、大容器可跨頁', () => {
  const viewBlock = print.slice(print.indexOf('/* ── 一般分頁列印'));
  for (const sel of ['nav.tabs', 'button', 'select', '\\.field']) {
    assert.match(viewBlock, new RegExp(`${sel}\\b`), `列印時應隱藏 ${sel}`);
  }
  assert.match(viewBlock, /:is\(\.card,\s*\.table-wrap,\s*table,\s*tbody\)\s*\{\s*break-inside:\s*auto\s*!important/);
  assert.match(viewBlock, /thead\s*\{\s*display:\s*table-header-group;\s*\}/);
  assert.match(viewBlock, /tr\s*\{\s*break-inside:\s*avoid/);
});

test('深色模式下列印仍然用淺色（否則整張黑、又吃碳粉）', () => {
  const viewBlock = print.slice(print.indexOf('/* ── 一般分頁列印'));
  assert.match(viewBlock, /:root\s*\{[^}]*--card:\s*#fff/);
  assert.match(viewBlock, /:root\s*\{[^}]*color-scheme:\s*light/);
});

test('cdp-check 支援 --pdf（用瀏覽器自己的列印引擎驗紙上結果）', () => {
  assert.match(check, /a === '--pdf'/);
  assert.match(check, /Page\.printToPDF/);
  assert.match(check, /preferCSSPageSize:\s*true/);
});
