#!/usr/bin/env node
/**
 * 語法檢查：對專案內所有 JavaScript 檔執行 `node --check`。
 *   node scripts/check-syntax.mjs
 * 結束碼 0 = 全部通過；1 = 有檔案語法錯誤。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKIP = new Set(['node_modules', '.git', '.vercel', 'public/vendor']);
const EXT = new Set(['.js', '.mjs', '.cjs']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, entry.name));
    // 跳過隱藏目錄／檔案：.git、.vercel，以及工具產生的暫存目錄（例如 .qr-check 內的 Chrome profile）
    if (entry.name.startsWith('.') || SKIP.has(entry.name) || SKIP.has(rel)) continue;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), out);
    else if (EXT.has(path.extname(entry.name))) out.push(path.join(dir, entry.name));
  }
  return out;
}

const files = walk(ROOT).sort();
let failed = 0;
const started = Date.now();

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`✗ ${path.relative(ROOT, file)}`);
    console.error(String(err.stderr || err.stdout || err.message).trim().split('\n').slice(0, 6).join('\n'));
  }
}

const sizeMb = (files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1048576).toFixed(2);
console.log(`node --check：掃描 ${files.length} 個檔案（${sizeMb} MB），耗時 ${Date.now() - started} ms`);
if (failed) {
  console.error(`✗ ${failed} 個檔案語法檢查失敗`);
  process.exit(1);
}
console.log('✓ 全部通過語法檢查');
