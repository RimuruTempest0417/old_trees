#!/usr/bin/env node
/**
 * 把 data/policy.json（政策型設計方案的資料層，每一項都有出處）轉成 data/policy-data.js
 * 這個 ESM 模組，讓 lib/ 與前端都能直接 import。
 *
 * 為什麼要轉：資料放 .js 才能被 Vercel 的打包器追蹤，也不必在執行期讀檔。
 * 轉出來會附內容雜湊（data_hash），tests/policy.test.js 會驗證雜湊與 JSON 一致
 * ——改了 JSON 卻忘了重跑本腳本就會紅燈。
 *
 * 用法：node scripts/gen-policy.mjs [--check]
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'data', 'policy.json');
const OUT = path.join(ROOT, 'data', 'policy-data.js');

const raw = fs.readFileSync(SRC, 'utf8');
const data = JSON.parse(raw);
const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

const body = `/**
 * 政策型設計方案（課程研究的設計方案部分）的資料（由 scripts/gen-policy.mjs 自動產生，請勿手改）。
 *
 * 每一項政策與行動都附出處（sources[]）；官方查不到的一律列入 gaps，不臆造。
 * 原始檔：data/policy.json（改資料請改那裡，再跑 npm run build:policy）。
 */
export const POLICY_HASH = ${JSON.stringify(hash)};
export const POLICY = ${JSON.stringify(data, null, 2)};

export default POLICY;
`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur === body) {
    console.log(`✓ 已是最新（hash ${hash}）`);
    process.exit(0);
  }
  console.error(`✗ 不同步：請執行 node scripts/gen-policy.mjs（預期 hash ${hash}）`);
  process.exit(1);
}

fs.writeFileSync(OUT, body);
console.log(`✓ 已更新 data/policy-data.js（hash ${hash}，${data.directions.length} 個方向、${data.sources.length} 個來源）`);
