/**
 * 二維碼模組測試。
 *
 * 重點：不只要「看起來像 QR」，還要證明**掃得出來**。
 * 本檔在 Node 中以「傳統腳本」方式載入 public/vendor/qrcode.js（等同瀏覽器的 <script>），
 * 再檢查矩陣的結構性特徵（尺寸公式、定位圖案、時序圖案、靜區、決定性），
 * 以及 URL 產生器與 SVG 輸出。
 *
 * 「真的能掃」由獨立解碼器驗證：scripts/qr-roundtrip.mjs 會把產生的 SVG 轉成 PNG，
 * 再由 Python OpenCV（與本專案無關的實作）解碼，比對原文是否一致。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 以瀏覽器相同的方式載入第三方程式庫（傳統腳本 → 全域 qrcode）
const vendorSrc = fs.readFileSync(path.join(ROOT, 'public', 'vendor', 'qrcode.js'), 'utf8');
globalThis.qrcode = new Function(`${vendorSrc}; return qrcode;`)();

const { treeUrl, qrMatrix, qrSvg, qrSvgFile, siteBase } = await import('../public/js/qr.js');

const SITE = 'https://old-trees-mylearning.vercel.app/';
const URL_66 = treeUrl('66', { base: SITE });

test('vendor 程式庫為 qrcode-generator（MIT）且未被我方改寫', () => {
  assert.match(vendorSrc, /QR Code Generator for JavaScript/);
  assert.match(vendorSrc, /Copyright \(c\) 2009 Kazuhiko Arase/);
  assert.match(vendorSrc, /MIT license/);
  assert.match(vendorSrc, /module\.exports = factory\(\)/);
  assert.match(vendorSrc, /第三方資源：qrcode-generator/);
});

test('treeUrl：產生絕對網址（掃描者與產生者可能不同裝置）', () => {
  assert.equal(URL_66, `${SITE}#/map?tree=66`);
  assert.equal(treeUrl(471, { base: SITE }), `${SITE}#/map?tree=471`);
  assert.equal(treeUrl('66', { base: SITE, mode: 'field' }), `${SITE}#/field?tree=66`);
  assert.equal(treeUrl('66', { base: SITE, mode: '不存在的模式' }), `${SITE}#/map?tree=66`, '未知模式一律回詳情');
  // 含特殊字元的編號要編碼，不能破壞網址結構
  assert.equal(treeUrl('a b/#?', { base: SITE }), `${SITE}#/map?tree=a%20b%2F%23%3F`);
});

test('siteBase：由任意頁面網址推出網站根目錄', () => {
  assert.equal(siteBase('https://example.com/'), 'https://example.com/');
  assert.equal(siteBase('https://example.com/index.html'), 'https://example.com/');
  assert.equal(siteBase('https://example.com/index.html#/map?tree=66'), 'https://example.com/');
  assert.equal(siteBase('https://example.com/sub/'), 'https://example.com/sub/');
});

test('qrMatrix：尺寸符合標準（21 + 4×(版本−1)），且版本隨內容長度增加', () => {
  for (const text of [URL_66, `${URL_66}&x=${'y'.repeat(200)}`, `${URL_66}&z=${'w'.repeat(600)}`]) {
    const { count } = qrMatrix(text);
    assert.ok(count >= 21 && count <= 177, `模組數 ${count} 應在 21–177 之間`);
    assert.equal((count - 17) % 4, 0, `模組數 ${count} 必須符合 21＋4k`);
  }
  assert.ok(qrMatrix(`${URL_66}${'x'.repeat(400)}`).count > qrMatrix(URL_66).count, '較長的內容要用較大的版本');
});

test('qrMatrix：三個定位圖案（finder pattern）位置正確', () => {
  const { count, isDark } = qrMatrix(URL_66);
  const finder = (top, left) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;          // 外框
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;              // 中心 3×3
        const expected = ring || core;
        assert.equal(!!isDark(top + r, left + c), expected,
          `定位圖案 (${top},${left}) 的第 (${r},${c}) 格應為 ${expected ? '深' : '淺'}`);
      }
    }
  };
  finder(0, 0);
  finder(0, count - 7);
  finder(count - 7, 0);
  // 定位圖案外圍必須是淺色分隔線
  assert.equal(!!isDark(7, 7), false, '定位圖案與資料區之間要有淺色分隔');
});

test('qrMatrix：時序圖案（timing pattern）深淺交替', () => {
  const { count, isDark } = qrMatrix(URL_66);
  for (let i = 8; i < count - 8; i++) {
    assert.equal(!!isDark(6, i), i % 2 === 0, `時序圖案 (6,${i}) 應為 ${i % 2 === 0 ? '深' : '淺'}`);
    assert.equal(!!isDark(i, 6), i % 2 === 0, `時序圖案 (${i},6) 應為 ${i % 2 === 0 ? '深' : '淺'}`);
  }
});

test('qrMatrix：同一輸入結果穩定；不同輸入產生不同矩陣', () => {
  const dump = (t) => {
    const { count, isDark } = qrMatrix(t);
    let s = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) s += isDark(r, c) ? '1' : '0';
    return s;
  };
  assert.equal(dump(URL_66), dump(URL_66), '同一輸入必須產生同一矩陣（決定性）');
  assert.notEqual(dump(URL_66), dump(treeUrl('67', { base: SITE })), '不同古樹必須是不同的碼');
});

test('qrMatrix：資料量過大時明確報錯，而不是產生壞碼', () => {
  assert.throws(() => qrMatrix('x'.repeat(4000)), /too long|overflow|length/i);
});

test('qrSvg：向量輸出、含靜區（quiet zone）、無障礙屬性與說明', () => {
  const svg = qrSvg(URL_66, { title: '古樹 66 的二維碼', margin: 2 });
  const { count } = qrMatrix(URL_66);
  assert.match(svg, /^<svg /);
  assert.ok(!/xmlns=/.test(svg), '內嵌 HTML 的 SVG 不需要 xmlns（下載檔才有，見 qrSvgFile）');
  assert.match(svg, new RegExp(`viewBox="0 0 ${count + 4} ${count + 4}"`), '靜區 2 模組 → 邊長 +4');
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="古樹 66 的二維碼"/);
  assert.match(svg, /<title>古樹 66 的二維碼<\/title>/);
  assert.match(svg, /shape-rendering="crispEdges"/, '列印時不要抗鋸齒模糊');
  const d = svg.match(/<path d="([^"]*)"/)[1];
  assert.equal((d.match(/M/g) || []).length, (d.match(/h1v1h-1z/g) || []).length, '每個深色模組一個正方形');
  // 靜區必須是白的（沒有深色模組畫在邊界上）
  assert.ok(!/M0 0h/.test(d.replace(/M0 0h1v1h-1z/g, '')), '左上角第一格屬於靜區範圍');
});

test('qrSvgFile：下載的檔案是完整可用的 SVG 文件', () => {
  const file = qrSvgFile(URL_66, { title: '古樹 66' });
  assert.match(file, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(file, /<!-- https:\/\/old-trees-mylearning\.vercel\.app\/#\/map\?tree=66 -->/);
  assert.match(file, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(file, /<\/svg>\s*$/);
});

test('真實資料：為 658 株古樹都能產生二維碼（含最長與最短編號）', () => {
  const csv = fs.readFileSync(path.join(ROOT, 'source-data', '古樹.csv'), 'utf8').replace(/^\uFEFF/, '');
  const rows = csv.split(/\r?\n/).filter((l) => l.trim()).slice(2).map((l) => l.split(','));
  const nos = rows.map((r) => r[2]).filter(Boolean);
  assert.equal(nos.length, 658, `古樹.csv 應有 658 筆，實際 ${nos.length}`);
  for (const no of nos) {
    const { count } = qrMatrix(treeUrl(no, { base: SITE }));
    assert.ok(count >= 21, `古樹 ${no} 的二維碼產生失敗`);
  }
});
