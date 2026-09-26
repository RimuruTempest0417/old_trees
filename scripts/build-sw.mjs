#!/usr/bin/env node
/**
 * 產生 public/sw.js 的預載清單（App shell）。
 *
 * 為什麼要有這支腳本：預載清單是「手寫就會錯」的東西 —— 少列一個檔案，離線時某個分頁就是白畫面；
 * 多列一個不存在的檔案，service worker 的 install 直接失敗（等於完全沒有離線能力）。
 * 因此改為掃描實際檔案產生，並在 `tests/pwa.test.js` 驗證「重跑不會有差異」（冪等）＋
 * 「index.html 引用到的每個本機資源都在清單裡」。
 *
 * 用法：node scripts/build-sw.mjs [--check]
 *   --check  只檢查是否需要更新（CI／測試用），不寫檔；有差異時 exit 1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUB = path.join(ROOT, 'public');
const SW = path.join(PUB, 'sw.js');
const START = '// >>> 預載清單 開始';
const END = '// <<< 預載清單 結束';

// 版本以 lib/repo.js 的 API_VERSION 為準（/api/health 回報的就是它，兩者必須一致）
const repo = fs.readFileSync(path.join(ROOT, 'lib', 'repo.js'), 'utf8');
const APP_VERSION = (/export const API_VERSION = '([^']+)'/.exec(repo) || [])[1];
if (!APP_VERSION) {
  console.error('✗ 找不到 lib/repo.js 的 API_VERSION');
  process.exit(1);
}

const list = (dir, filter) => fs.readdirSync(path.join(PUB, dir))
  .filter(filter)
  .sort()
  .map((f) => `/${dir}/${f}`);

/** 1) index.html 直接引用的本機資源（CSS／vendor／前端模組） */
function fromIndexHtml() {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    const url = m[1];
    if (url.startsWith('/') && !url.startsWith('//')) out.push(url);
  }
  return out;
}

/** 2) vendor 內被 CSS／JS 連帶需要的檔案（Leaflet 圖示、KaTeX 字型） */
function vendorExtras() {
  const extras = list('vendor/leaflet/images', (f) => /\.(png|svg)$/.test(f));
  extras.push(...list('vendor/katex/fonts', (f) => f.endsWith('.woff2')));
  return extras;
}

const precache = [...new Set([
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  ...list('icons', (f) => /\.(png|svg)$/.test(f)),
  ...list('css', (f) => f.endsWith('.css')),
  ...fromIndexHtml(),
  ...list('js', (f) => f.endsWith('.js')),
  ...vendorExtras(),
])].sort((a, b) => (a === '/index.html' ? -1 : b === '/index.html' ? 1 : a.localeCompare(b)));

// 所有項目都要真的存在，否則 install 會失敗
const missing = precache.filter((u) => !fs.existsSync(path.join(PUB, u)));
if (missing.length) {
  console.error('✗ 預載清單指向不存在的檔案：', missing.join('、'));
  process.exit(1);
}

const block = [
  `${START}（由 scripts/build-sw.mjs 產生）`,
  'const PRECACHE = [',
  ...precache.map((u) => `  '${u}',`),
  '];',
  END,
].join('\n');

let src = fs.readFileSync(SW, 'utf8');
const re = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}`);
if (!re.test(src)) {
  console.error(`✗ sw.js 找不到標記 ${START} … ${END}`);
  process.exit(1);
}

// 版本字串也一起同步，避免快取名稱與發佈版本脫節
const next = src
  .replace(re, block)
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${APP_VERSION}';`);

const changed = next !== src;
const checkOnly = process.argv.includes('--check');

if (!changed) {
  console.log(`✓ 預載清單已是最新（${precache.length} 項，版本 ${APP_VERSION}）`);
  process.exit(0);
}
if (checkOnly) {
  console.error(`✗ 預載清單或版本需要更新：sw.js 與實際檔案不同步（應為 ${precache.length} 項、版本 ${APP_VERSION}）`);
  process.exit(1);
}
fs.writeFileSync(SW, next);
console.log(`✓ 已更新 sw.js：${precache.length} 項、版本 ${APP_VERSION}`);
