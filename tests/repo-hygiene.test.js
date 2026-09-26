/**
 * 倉庫整潔守門：擋掉「不該進版控的東西」與「沒人用的孤兒腳本」。
 *
 * 為什麼要有這支測試：這個專案曾把一整個無頭 Chrome 的設定檔目錄（`prof-微細懸浮粒子/`，
 * 484 個檔案、7.7 MB，含瀏覽器擴充功能的程式碼）commit 進版控。它不會讓任何測試紅燈，
 * 只會讓 clone 變慢、讓 `node --check` 掃到不屬於本專案的檔案，也讓「專案有多大」講不清楚。
 *
 * 這裡只檢查「可以用機械方式判定」的事情，判斷性的清理不寫進測試。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);

const read = (p) => {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } // 已刪但尚未 commit 的檔案
};

test('版控裡不得有瀏覽器設定檔、暫存頁、日誌或系統檔', () => {
  const banned = tracked.filter((f) => {
    const top = f.split('/')[0];
    if (top.startsWith('prof-') || top === '.qr-check') return true;
    if (/\.(log|tmp|pyc|DS_Store)$/.test(f)) return true;
    if (f.startsWith('public/__') && f.endsWith('.html')) return true;
    return false;
  });
  assert.deepEqual(banned, [],
    `這些檔案不該進版控（請 git rm --cached 並加進 .gitignore）：\n  ${banned.join('\n  ')}`);
});

test('版控裡不得有超大檔案（單檔 > 1.5 MB）', () => {
  const big = [];
  for (const f of tracked) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) continue;
    const size = fs.statSync(abs).size;
    if (size > 1.5 * 1024 * 1024) big.push(`${(size / 1024 / 1024).toFixed(2)} MB  ${f}`);
  }
  assert.deepEqual(big, [],
    `單一檔案過大，通常是產生器的產物或誤放的二進位檔：\n  ${big.join('\n  ')}`);
});

test('scripts/ 裡不得有沒人用的孤兒腳本', () => {
  const scripts = tracked.filter((f) => f.startsWith('scripts/'));
  const others = tracked.filter((f) => !f.startsWith('scripts/') && !f.endsWith('.md'));
  const docs = tracked.filter((f) => f.endsWith('.md'));
  const orphans = [];
  for (const s of scripts) {
    const base = path.basename(s);
    const referenced = [...others, ...docs].some((f) => read(f).includes(base))
      || scripts.some((f) => f !== s && read(f).includes(base));
    if (!referenced) orphans.push(s);
  }
  // 孤兒腳本有兩種處理：刪掉，或在 README 的腳本表補一行說明它什麼時候用
  assert.deepEqual(orphans, [],
    `這些腳本沒有任何地方引用（README、package.json、workflow、其他腳本、tests 都沒有）：\n  ${orphans.join('\n  ')}`);
});

test('scripts/ 每個檔案都被 README 的腳本表提到', () => {
  const readme = read('README.md');
  const missing = tracked.filter((f) => f.startsWith('scripts/'))
    .map((f) => path.basename(f))
    .filter((base) => !readme.includes(base));
  assert.deepEqual(missing, [],
    `README 的腳本表少了這些（新增腳本要一起補說明，不然下次沒人知道它做什麼）：\n  ${missing.join('\n  ')}`);
});

test('.gitignore 擋住會再長回來的目錄', () => {
  const ignore = read('.gitignore');
  for (const pattern of ['node_modules/', '.env', 'prof-*/', '*.log']) {
    assert.ok(ignore.includes(pattern), `.gitignore 少了 ${pattern}`);
  }
});
