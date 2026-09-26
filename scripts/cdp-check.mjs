#!/usr/bin/env node
/**
 * 用 Chrome DevTools Protocol 檢查「跑完 JavaScript 之後」的頁面內容。
 *
 * 為什麼不用 --dump-dom：`--virtual-time-budget` 配 `--dump-dom` 會在第一次繪製就輸出，
 * 非同步的工作（抓 API、畫圖、service worker 接管）常常還沒定案，於是把
 * 「載入中」甚至「錯誤卡」當成結果（本站就曾因此在驗證時漏看一個 TypeError）。
 * 這支腳本改成：連上 CDP → 等畫面出現指定字串（或逾時）→ 才輸出文字與截圖，
 * 並把 console 錯誤與未捕捉例外一起印出來。
 *
 * 用法：
 *   node scripts/cdp-check.mjs <url> --wait "<片段>" [--wait "<片段>"…]
 *        [--timeout 20000] [--width 1440] [--height 2200]
 *        [--selector "#chem-body"] [--screenshot <檔案>] [--dump <文字檔>] [--json]
 *        [--eval "<JS 運算式>"]   ← 等畫面定案後在頁面裡求值，結果以 JSON 印出（驗 DOM 狀態用）
 * 離開碼：0 全部等到、1 有片段沒出現、2 執行錯誤。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const url = argv[0];
if (!url) {
  console.error('用法：node scripts/cdp-check.mjs <url> --wait "<片段>" [--screenshot file.png]');
  process.exit(2);
}
const opt = { wait: [], timeout: 20000, width: 1440, height: 2200, selector: null, screenshot: null, json: false, dump: null, eval: null, geo: null, print: false };
for (let i = 1; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--wait') opt.wait.push(argv[++i]);
  else if (a === '--timeout') opt.timeout = Number(argv[++i]);
  else if (a === '--width') opt.width = Number(argv[++i]);
  else if (a === '--height') opt.height = Number(argv[++i]);
  else if (a === '--selector') opt.selector = argv[++i];
  else if (a === '--screenshot') opt.screenshot = argv[++i];
  else if (a === '--json') opt.json = true;
  else if (a === '--dump') opt.dump = argv[++i];
  else if (a === '--eval') opt.eval = argv[++i];
  else if (a === '--geo') opt.geo = argv[++i];   // 模擬定位：--geo 22.205,113.541[,8]
  else if (a === '--print') opt.print = true;    // 以列印媒體量測（A4 版面檢查用）
  else { console.error(`未知參數：${a}`); process.exit(2); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpcheck-'));
let child;

async function portFromProfile() {
  const f = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100; i += 1) {
    if (fs.existsSync(f)) {
      const [p] = fs.readFileSync(f, 'utf8').split('\n');
      if (p) return Number(p);
    }
    await sleep(100);
  }
  throw new Error('Chrome 沒有寫出 DevToolsActivePort（啟動失敗？）');
}

async function main() {
  child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${opt.width},${opt.height}`, url,
  ], { stdio: 'ignore', detached: false });

  const port = await portFromProfile();
  let target = null;
  for (let i = 0; i < 100 && !target; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* 還沒準備好，重試 */ }
    if (!target) await sleep(100);
  }
  if (!target) throw new Error('找不到可用的分頁目標');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description || d.text || '未捕捉例外');
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });

  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('WebSocket 連線失敗')), { once: true });
  });
  await send('Runtime.enable');
  await send('Page.enable');
  if (opt.geo) {
    // 模擬手機定位（v0.15.0 驗 GPS 比對用）：CDP 要同時「授權」與「覆寫座標」，
    // 少一個 headless 的 getCurrentPosition 就直接進 error callback。
    const [lat, lon, acc] = String(opt.geo).split(',').map(Number);
    const { origin } = new URL(url);
    try {
      await send('Browser.grantPermissions', { origin, permissions: ['geolocation'] });
    } catch (e) {
      console.error(`（警告）授權定位失敗：${e.message}；仍會嘗試覆寫座標`);
    }
    await send('Emulation.setGeolocationOverride', {
      latitude: lat, longitude: lon, accuracy: Number.isFinite(acc) ? acc : 10,
    });
  }
  if (opt.print) await send('Emulation.setEmulatedMedia', { media: 'print' });
  await send('Page.navigate', { url });

  const expr = `(() => {
    const sel = ${JSON.stringify(opt.selector)};
    const node = sel ? document.querySelector(sel) : document.body;
    return { text: (node ? (node.innerText || node.textContent || '') : ''), url: location.href };
  })()`;

  const deadline = Date.now() + opt.timeout;
  let text = '';
  let missing = opt.wait.slice();
  while (Date.now() < deadline) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
    text = r?.result?.value?.text || '';
    missing = opt.wait.filter((w) => !text.includes(w));
    if (!missing.length) break;
    await sleep(250);
  }

  if (opt.screenshot) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.mkdirSync(path.dirname(path.resolve(opt.screenshot)), { recursive: true });
    fs.writeFileSync(opt.screenshot, Buffer.from(shot.data, 'base64'));
  }

  if (opt.dump) {
    fs.mkdirSync(path.dirname(path.resolve(opt.dump)), { recursive: true });
    fs.writeFileSync(opt.dump, text, 'utf8');
  }

  // --eval：把頁面「跑完之後」的真實 DOM 狀態取回來（例如勾選欄有幾格、input 有哪些屬性），
  // 這是文字比對做不到的部分（文字只看得到標籤，看不到 type／capture／name）。
  let evalResult;
  if (opt.eval) {
    const r = await send('Runtime.evaluate', { expression: opt.eval, returnByValue: true, awaitPromise: true });
    evalResult = r?.result?.value;
    if (r?.exceptionDetails) {
      errors.push(`--eval 例外：${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    }
  }

  if (opt.json) {
    console.log(JSON.stringify({ missing, errors, chars: text.length, eval: evalResult ?? null }));
  } else {
    for (const w of opt.wait) console.log(text.includes(w) ? `  ✓ 有：${w}` : `  ✗ 沒有：${w}`);
    console.log(`  畫面文字 ${text.length} 字${opt.screenshot ? `，截圖 ${opt.screenshot}` : ''}`);
    if (opt.eval) console.log(`  --eval 結果：${JSON.stringify(evalResult)}`);
    if (errors.length) {
      console.log(`  ⚠ 頁面有 ${errors.length} 個 JS 錯誤：`);
      for (const e of errors.slice(0, 5)) console.log(`    - ${String(e).split('\n')[0]}`);
    }
  }
  ws.close();
  child.kill('SIGKILL');
  // Chrome 有時還在寫 profile（ENOTEMPTY）→ 重試幾次，不要讓清理失敗蓋掉真正的結果
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  process.exit(missing.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  try { child?.kill('SIGKILL'); } catch { /* 忽略 */ }
  // Chrome 有時還在寫 profile（ENOTEMPTY）→ 重試幾次，不要讓清理失敗蓋掉真正的結果
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  process.exit(2);
});
