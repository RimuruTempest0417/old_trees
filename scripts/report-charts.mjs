#!/usr/bin/env node
/**
 * 數學科報告的圖表產生器：把 data 檔畫成 PNG（Chart.js ＋ 無頭 Chrome）。
 *
 * 為什麼不裝 matplotlib：這台機器沒有 numpy／matplotlib，而且本專案本來就用
 * Chart.js 畫網頁上的同一批圖（public/vendor/chart.umd.js）；直接沿用同一套繪圖程式，
 * 報告裡的圖與網站上看到的圖是同一種呈現，也少一個要維護的相依。
 *
 * 用法：
 *   node scripts/report-charts.mjs <data.json> <輸出目錄>
 *
 * data.json 由 scripts/report-math.py 產生（只含畫圖需要的數列，不含文字內容）。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 940;
const H = 430;

const [dataFile, outDir] = process.argv.slice(2);
if (!dataFile || !outDir) {
  console.error('用法：node scripts/report-charts.mjs <data.json> <輸出目錄>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const CHART_JS = fs.readFileSync(path.join(ROOT, 'public', 'vendor', 'chart.umd.js'), 'utf8');

const PAGE = (chartId, chartJs, payload) => `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#fff;
    font-family:"PingFang TC","Helvetica Neue",Helvetica,"Microsoft JhengHei",sans-serif}
  #box{width:${W}px;height:${H}px;padding:10px 14px;box-sizing:border-box}
</style></head>
<body><div id="box"><canvas id="c"></canvas></div>
<script>${chartJs}</script>
<script>
const D = ${JSON.stringify(payload)};
// 信賴區間畫成細線（Chart.js 沒有內建 error bar，用外掛在畫完長條後補畫）
const ciPlugin = {
  id: 'ci',
  afterDatasetsDraw(chart) {
    const ci = chart.options.plugins.ci && chart.options.plugins.ci.values;
    if (!ci) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    // 橫向長條圖（indexAxis: 'y'）與直向長條圖的座標軸不同，兩種都要處理
    // 方向由圖表設定直接指定（options.plugins.ci.orientation），不用猜：
    // 讀 indexAxis 或 isHorizontal() 在不同 Chart.js 版本的位置不一樣，猜錯會把誤差線畫到座標軸外
    const horizontal = chart.options.plugins.ci.orientation === 'horizontal';
    ctx.save(); ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.6;
    meta.data.forEach((bar, i) => {
      const [lo, hi] = ci[i];
      if (horizontal) {
        const xLo = chart.scales.x.getPixelForValue(lo);
        const xHi = chart.scales.x.getPixelForValue(hi);
        ctx.beginPath(); ctx.moveTo(xLo, bar.y); ctx.lineTo(xHi, bar.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xLo, bar.y - 6); ctx.lineTo(xLo, bar.y + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xHi, bar.y - 6); ctx.lineTo(xHi, bar.y + 6); ctx.stroke();
      } else {
        const yLo = chart.scales.y.getPixelForValue(Math.max(lo, 0));
        const yHi = chart.scales.y.getPixelForValue(hi);
        ctx.beginPath(); ctx.moveTo(bar.x, yHi); ctx.lineTo(bar.x, yLo); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bar.x - 6, yHi); ctx.lineTo(bar.x + 6, yHi); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bar.x - 6, yLo); ctx.lineTo(bar.x + 6, yLo); ctx.stroke();
      }
    });
    ctx.restore();
  },
};
Chart.register(ciPlugin);
Chart.defaults.font.family = '"PingFang TC",Helvetica,sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.color = '#1f2933';
Chart.defaults.animation = false;
${data.charts[chartId]}
</script></body></html>`;

function shoot(html, outFile) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mht-chart-'));
      const child = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--hide-scrollbars', '--force-device-scale-factor=2',
        `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
        '--virtual-time-budget=5000', `--screenshot=${outFile}`, url,
      ], { stdio: 'ignore' });
      let waited = 0;
      const timer = setInterval(() => {
        waited += 250;
        const ok = fs.existsSync(outFile) && fs.statSync(outFile).size > 8192;
        if (ok || waited > 30000) {
          clearInterval(timer);
          try { child.kill('SIGKILL'); } catch { /* 已結束 */ }
          server.close();
          fs.rmSync(profile, { recursive: true, force: true });
          if (!ok) reject(new Error(`Chrome 沒有產生 ${path.basename(outFile)}`));
          else resolve(fs.statSync(outFile).size);
        }
      }, 250);
    });
  });
}

let total = 0;
for (const id of Object.keys(data.charts)) {
  const out = path.join(outDir, `${id}.png`);
  const bytes = await shoot(PAGE(id, CHART_JS, data), out);
  total += bytes;
  console.log(`✓ ${id}.png　${Math.round(bytes / 1024)} KB`);
}
console.log(`✓ 共 ${Object.keys(data.charts).length} 張圖，${Math.round(total / 1024)} KB → ${outDir}`);
