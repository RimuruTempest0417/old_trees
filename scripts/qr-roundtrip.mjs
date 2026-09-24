#!/usr/bin/env node
/**
 * 二維碼「真的掃得出來」驗證（第一段）：產生 SVG，再轉成 PNG。
 *
 * 為什麼需要這個：
 *   tests/qr.test.js 檢查的是矩陣結構（尺寸、定位圖案、時序圖案、決定性），
 *   但「結構看起來對」不等於「手機掃得出來」。這裡把我們實際會提供給使用者的
 *   產物（SVG）轉成圖片，交給**與本專案無關的獨立解碼器**（Python OpenCV）解讀，
 *   比對解出來的文字是否等於原始網址。
 *
 * 用法：
 *   node scripts/qr-roundtrip.mjs            # 產生 SVG 與 PNG 到 .qr-check/
 *   python3 scripts/qr-decode.py .qr-check   # 獨立解碼並比對（需 opencv-python）
 *   或直接： npm run qr:verify
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, '.qr-check');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Chrome 的使用者資料目錄要放在暫存區：放進專案會把瀏覽器內建擴充功能的程式碼
// 一起寫進來（數 MB），污染 node --check 的掃描範圍。
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-check-'));

// 以瀏覽器相同的方式載入第三方編碼程式庫
const vendorSrc = fs.readFileSync(path.join(ROOT, 'public', 'vendor', 'qrcode.js'), 'utf8');
globalThis.qrcode = new Function(`${vendorSrc}; return qrcode;`)();

const { treeUrl, qrSvgFile } = await import(path.join(ROOT, 'public', 'js', 'qr.js'));

const BASE = process.env.QR_BASE || 'https://old-trees-mylearning.vercel.app/';
const CSV = fs.readFileSync(path.join(ROOT, 'source-data', '古樹.csv'), 'utf8').replace(/^\uFEFF/, '');
const rows = CSV.split(/\r?\n/).filter((l) => l.trim()).slice(2).map((l) => l.split(','));
const allNos = rows.map((r) => r[2]).filter(Boolean);

// 取樣：第一株、最老的一株、官方照片已下架的那一株、編號最大的一株，加上固定的 66
const samples = [...new Set(['66', allNos[0], rows[0][2], '471', allNos[allNos.length - 1]])].filter(Boolean);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const cases = [];
for (const no of samples) {
  for (const mode of ['map', 'field']) {
    const url = treeUrl(no, { base: BASE, mode });
    const name = `tree-${no}-${mode}`;
    const svg = path.join(OUT, `${name}.svg`);
    fs.writeFileSync(svg, qrSvgFile(url, { title: `古樹 ${no}` }), 'utf8');
    cases.push({ name, text: url, svg });
  }
}

// 點陣化與解碼交給 scripts/qr-decode.py：
//   無頭 Chrome 對 file:// 的 SVG 截圖會間歇性卡住（實際踩到，每個檔要等逾時），
//   因此改由解碼腳本直接解析 SVG 的 viewBox 與 path 幾何做點陣化——
//   那正是使用者下載／列印的向量圖，再交給獨立解碼器解讀。
fs.writeFileSync(path.join(OUT, 'expected.json'), `${JSON.stringify(cases, null, 2)}\n`, 'utf8');
console.log(`產生 ${cases.length} 個 SVG（每株各「詳情」與「實地考察」兩種）→ ${OUT}`);
console.log('接著執行： python3 scripts/qr-decode.py .qr-check');
