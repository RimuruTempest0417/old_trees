#!/usr/bin/env node
/**
 * 把前端相依的第三方函式庫複製到 public/vendor/，令網站不依賴 CDN、
 * 可離線運作，也讓後續的自動化測試不需要外網。
 *
 *   npm install --no-save leaflet leaflet.markercluster chart.js marked katex
 *   node scripts/vendor.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'public', 'vendor');

const COPIES = [
  ['leaflet/dist/leaflet.js', 'leaflet/leaflet.js'],
  ['leaflet/dist/leaflet.css', 'leaflet/leaflet.css'],
  ['leaflet/dist/images/marker-icon.png', 'leaflet/images/marker-icon.png'],
  ['leaflet/dist/images/marker-icon-2x.png', 'leaflet/images/marker-icon-2x.png'],
  ['leaflet/dist/images/marker-shadow.png', 'leaflet/images/marker-shadow.png'],
  ['leaflet.markercluster/dist/leaflet.markercluster.js', 'leaflet.markercluster.js'],
  ['leaflet.markercluster/dist/MarkerCluster.css', 'MarkerCluster.css'],
  ['leaflet.markercluster/dist/MarkerCluster.Default.css', 'MarkerCluster.Default.css'],
  ['chart.js/dist/chart.umd.js', 'chart.umd.js'],
  ['marked/lib/marked.umd.js', 'marked.umd.js'],
  ['marked/marked.min.js', 'marked.min.js'],
  ['katex/dist/katex.min.js', 'katex/katex.min.js'],
  ['katex/dist/katex.min.css', 'katex/katex.min.css'],
  ['katex/dist/contrib/auto-render.min.js', 'katex/auto-render.min.js'],
];

function copy(rel, dest) {
  const src = path.join(NM, rel);
  const target = path.join(OUT, dest);
  if (!fs.existsSync(src)) return { rel, ok: false };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  return { rel, ok: true, bytes: fs.statSync(target).size };
}

const results = COPIES.map(([a, b]) => copy(a, b));

// KaTeX 字型（數學式排版需要）
const fontDir = path.join(NM, 'katex/dist/fonts');
let fonts = 0;
if (fs.existsSync(fontDir)) {
  fs.mkdirSync(path.join(OUT, 'katex', 'fonts'), { recursive: true });
  for (const f of fs.readdirSync(fontDir)) {
    if (!f.endsWith('.woff2')) continue;
    fs.copyFileSync(path.join(fontDir, f), path.join(OUT, 'katex', 'fonts', f));
    fonts += 1;
  }
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.rel}${r.ok ? ` (${(r.bytes / 1024).toFixed(0)} KB)` : ' — 找不到'}`);
}
console.log(`✓ KaTeX 字型 ${fonts} 個`);
if (failed.length) {
  console.error(`✗ 有 ${failed.length} 個檔案未複製，請先執行 npm install --no-save leaflet leaflet.markercluster chart.js marked katex`);
  process.exit(1);
}
console.log(`完成：public/vendor 共 ${results.length + fonts} 個檔案`);
