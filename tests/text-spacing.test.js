/**
 * 中文排版空白測試（v1.0.1）。
 *
 * HTML 樣板裡的換行與縮排，瀏覽器會收成一個半角空格，中文句子中間就會出現
 * 多餘空白（「分成 城市綠化」）。使用者回報每一頁頁首都有這個問題，因此：
 *   1. 產生頁面的樣板（page-head 段落）不准再夾換行——源頭就寫成一行。
 *   2. ui.js 提供執行期清理（HTML 樣板以外的地方也會遇到），並由 app.js 接上。
 *   3. 數字與英文前後的空白是刻意的排版，清理時必須保留。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCjkText } from '../public/js/ui.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PAGES = ['map', 'routes', 'analytics', 'priority', 'field', 'chemistry', 'policy', 'knowledge'];
const CJK_SPACED = /[\u4e00-\u9fff][ \t]+[\u4e00-\u9fff]|[，。、；：）】》][ \t]+[\u4e00-\u9fff]/;

test('normalizeCjkText：中文字之間與中文標點後的空白會被清掉', () => {
  assert.equal(normalizeCjkText('分成 城市綠化').text, '分成城市綠化');
  assert.equal(normalizeCjkText('三個方向， 每個方向').text, '三個方向，每個方向');
  assert.equal(normalizeCjkText('（官方分級） 皆為原始欄位').text, '（官方分級）皆為原始欄位');
  assert.equal(normalizeCjkText('《古樹名木保護名錄》 整理').text, '《古樹名木保護名錄》整理');
});

test('normalizeCjkText：數字與英文前後的空白是刻意排版，必須保留', () => {
  assert.equal(normalizeCjkText('本站 658 株古樹').text, '本站 658 株古樹');
  assert.equal(normalizeCjkText('採計 100 分，權重 30%').text, '採計 100 分，權重 30%');
  assert.equal(normalizeCjkText('執行 min(a, b) 與 2-opt').text, '執行 min(a, b) 與 2-opt');
  assert.equal(normalizeCjkText('field_records 表').text, 'field_records 表');
});

test('normalizeCjkText：回傳清掉的字元數，沒有問題時為 0', () => {
  assert.equal(normalizeCjkText('分成 城市綠化').count, 1);
  assert.equal(normalizeCjkText('沒有任何問題').count, 0);
});

test('每個分頁的頁首段落都寫成單行（不再讓瀏覽器把縮排收成空格）', () => {
  for (const name of PAGES) {
    const src = readFileSync(`${ROOT}public/js/${name}.js`, 'utf8');
    const block = src.match(/<div class="page-head">([\s\S]*?)<\/div>/);
    assert.ok(block, `${name}.js 找不到 page-head`);
    const paragraphs = block[1].match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
    assert.ok(paragraphs.length >= 1, `${name}.js 的 page-head 應有說明段落`);
    for (const p of paragraphs) {
      assert.ok(!CJK_SPACED.test(p), `${name}.js 的頁首段落夾了多餘空白：${p.slice(0, 60)}`);
      assert.ok(!/[\u4e00-\u9fff][\s\n]+[\u4e00-\u9fff]/.test(p.replace(/<[^>]+>/g, '')),
        `${name}.js 的頁首段落原始碼內有換行，會被瀏覽器收成空格：${p.slice(0, 60)}`);
    }
  }
});

test('執行期清理已接上：ui.js 提供、app.js 每次換頁都清一次並持續監看', () => {
  const ui = readFileSync(`${ROOT}public/js/ui.js`, 'utf8');
  const app = readFileSync(`${ROOT}public/js/app.js`, 'utf8');
  assert.match(ui, /export function normalizeCjkSpacing/);
  assert.match(ui, /export function watchCjkSpacing/);
  assert.match(ui, /SPACING_SKIP_TAGS = new Set\(\['CODE', 'PRE'/);
  assert.match(app, /normalizeCjkSpacing, watchCjkSpacing/);
  assert.match(app, /normalizeCjkSpacing\(section\)/);
  assert.match(app, /spacingObserver = watchCjkSpacing\(section\)/);
});

test('頁首說明的行寬已放寬，短句不再被硬擠成兩行', () => {
  const css = readFileSync(`${ROOT}public/css/style.css`, 'utf8');
  assert.match(css, /\.page-head p \{[^}]*max-width: none/);
  assert.match(css, /\.page-head p \{[^}]*text-wrap: pretty/);
  assert.ok(!/\.page-head p \{[^}]*max-width: 78ch/.test(css), '不應再限制 78ch 行寬');
});
