#!/usr/bin/env node
/**
 * 產生 App 圖示（PWA／iOS 主畫面）——由 public/icons/icon.svg 這個單一來源渲染。
 *
 * 為什麼要有這支腳本：圖示檔原本是「用手工流程產生的一次性產物」，沒有任何可重現的來源，
 * 換一台機器就做不出同一組圖示，改色改形也沒有依據。改成「SVG 是唯一來源 → 腳本渲染」
 * 之後，改圖示只要改 SVG 再跑 `npm run build:icons`，而且可以檢查是否忘了重跑。
 *
 * 做法：SVG 用無頭 Chrome 以 1024×1024 渲染成母圖（這台機器沒有 rsvg/cairosvg，
 * Chrome 是唯一穩定可用的點陣器），再用 macOS 內建 `sips` 縮成各尺寸。
 * 不引入任何 npm 相依。
 *
 * 用法：
 *   node scripts/build-icons.mjs           # 重新產生全部圖示
 *   node scripts/build-icons.mjs --check   # 只驗證（尺寸、來源雜湊），CI／npm test 用
 *
 * 產出：
 *   public/icons/apple-touch-icon.png   180×180（iOS 加到主畫面用，iOS 不看 manifest）
 *   public/icons/icon-192.png           192×192（Android）
 *   public/icons/icon-512.png           512×512（Android／安裝提示；已含 maskable 安全區）
 *   public/icons/icon-meta.json         來源雜湊與尺寸（--check 用來抓「改了 SVG 忘了重跑」）
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ICON_DIR = path.join(ROOT, 'public', 'icons');
const SOURCE = path.join(ICON_DIR, 'icon.svg');
const META = path.join(ICON_DIR, 'icon-meta.json');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MASTER = 1024;

/** 各尺寸的來源檔名固定，manifest 與 index.html 都指向這些名字 */
const OUTPUTS = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

/** 讀 PNG 的 IHDR，取得實際寬高（不引入影像函式庫） */
export function pngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 24 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`${file} 不是 PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** SVG → PNG（1024 母圖）。用本機 http 提供 SVG：file:// 的 SVG 截圖在這台機器會間歇性卡住 */
function renderMaster(svg, outFile) {
  return new Promise((resolve, reject) => {
    const page = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#0b3222;overflow:hidden}
img{display:block;width:${MASTER}px;height:${MASTER}px}</style>
<img src="/icon.svg" width="${MASTER}" height="${MASTER}" alt="">`;
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/icon.svg')) {
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' });
        res.end(svg);
      } else {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(page);
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mht-icon-'));
      const child = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--hide-scrollbars', '--force-device-scale-factor=1',
        `--user-data-dir=${profile}`, `--window-size=${MASTER},${MASTER}`,
        '--virtual-time-budget=4000', `--screenshot=${outFile}`, url,
      ], { stdio: 'ignore' });
      // 這台機器的無頭 Chrome 有時寫完檔不自己結束 → 輪詢輸出檔，好了就砍掉
      let waited = 0;
      const timer = setInterval(() => {
        waited += 250;
        const ok = fs.existsSync(outFile) && fs.statSync(outFile).size > 4096;
        if (ok || waited > 30000) {
          clearInterval(timer);
          try { child.kill('SIGKILL'); } catch { /* 已結束 */ }
          server.close();
          fs.rmSync(profile, { recursive: true, force: true });
          if (!ok) reject(new Error('Chrome 沒有產生圖示檔'));
          else resolve();
        }
      }, 250);
    });
  });
}

const sipsResize = (from, to, size) => execFileSync('sips', ['-z', String(size), String(size), from, '--out', to], { stdio: 'ignore' });

async function build() {
  const svg = fs.readFileSync(SOURCE, 'utf8');
  const master = path.join(os.tmpdir(), `mht-icon-master-${Date.now()}.png`);
  await renderMaster(svg, master);
  const made = [];
  for (const [name, size] of OUTPUTS) {
    const out = path.join(ICON_DIR, name);
    sipsResize(master, out, size);
    const { w, h } = pngSize(out);
    if (w !== size || h !== size) throw new Error(`${name} 尺寸錯誤：${w}×${h}`);
    made.push({ file: name, size, bytes: fs.statSync(out).size });
  }
  fs.rmSync(master, { force: true });
  const meta = {
    source: 'public/icons/icon.svg',
    source_sha256: sha256(svg),
    master_px: MASTER,
    renderer: 'headless Chrome + sips',
    icons: made,
  };
  fs.writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

function check() {
  if (!fs.existsSync(META)) {
    console.error('✗ 找不到 public/icons/icon-meta.json，請先跑 node scripts/build-icons.mjs');
    return 1;
  }
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const svg = fs.readFileSync(SOURCE, 'utf8');
  let bad = 0;
  if (meta.source_sha256 !== sha256(svg)) {
    console.error('✗ icon.svg 已變更但沒有重新產生圖示（請跑 node scripts/build-icons.mjs）');
    bad += 1;
  }
  for (const [name, size] of OUTPUTS) {
    const file = path.join(ICON_DIR, name);
    if (!fs.existsSync(file)) {
      console.error(`✗ 缺少圖示檔：${name}`);
      bad += 1;
      continue;
    }
    const { w, h } = pngSize(file);
    if (w !== size || h !== size) {
      console.error(`✗ ${name} 尺寸 ${w}×${h}，應為 ${size}×${size}`);
      bad += 1;
    }
  }
  if (bad) return 1;
  console.log(`✓ 圖示已是最新（來源 ${meta.source_sha256.slice(0, 12)}，${OUTPUTS.length} 個尺寸）`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    process.exit(check());
  } else {
    build().then((meta) => {
      console.log(`✓ 已產生 ${meta.icons.length} 個圖示（來源雜湊 ${meta.source_sha256.slice(0, 12)}）`);
      for (const i of meta.icons) console.log(`   ${i.file}　${i.size}×${i.size}　${Math.round(i.bytes / 1024)} KB`);
    }).catch((err) => {
      console.error('✗ 產生圖示失敗：', err.message);
      process.exit(1);
    });
  }
}

export { build, check };
