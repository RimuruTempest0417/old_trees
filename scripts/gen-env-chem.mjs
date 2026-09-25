#!/usr/bin/env node
/**
 * 把 data/env_chem.json（人工整理、每一項都有出處的官方數據節錄）轉成
 * data/env-chem-data.js 這個 ESM 模組，讓 lib/ 與前端都能直接 import。
 *
 * 為什麼要轉：資料放 .js 才能被 Vercel 的打包器追蹤，也不必在執行期讀檔。
 * 轉出來會附上內容雜湊（data_hash），tests/env-chem.test.js 會驗證雜湊與 JSON 一致
 * ——改了 JSON 卻忘了重跑本腳本就會紅燈。
 *
 * 用法：node scripts/gen-env-chem.mjs [--check]
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'data', 'env_chem.json');
const OUT = path.join(ROOT, 'data', 'env-chem-data.js');

const raw = fs.readFileSync(SRC, 'utf8');
const data = JSON.parse(raw);
const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

const body = `/**
 * 環境監測公開數據（由 scripts/gen-env-chem.mjs 自動產生，請勿手改）。
 *
 * 來源：澳門環保局《澳門環境狀況報告2025》、地球物理氣象局《澳門空氣質量監測統計年度報告2025》
 *      、環保局歷年《澳門環境狀況報告》與可查證的學術文獻（每一項資料都帶 source 欄位）。
 * 原始檔：data/env_chem.json（改資料請改那裡，再跑 npm run build:env）。
 */
export const ENV_CHEM_HASH = ${JSON.stringify(hash)};
export const ENV_CHEM = ${JSON.stringify(data, null, 2)};

export default ENV_CHEM;
`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur === body) {
    console.log(`✓ 已是最新（hash ${hash}）`);
    process.exit(0);
  }
  console.error(`✗ 不同步：請執行 node scripts/gen-env-chem.mjs（預期 hash ${hash}）`);
  process.exit(1);
}

fs.writeFileSync(OUT, body);
console.log(`✓ 已更新 data/env-chem-data.js（hash ${hash}，${Object.keys(data).length} 個區塊）`);
