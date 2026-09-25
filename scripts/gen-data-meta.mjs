#!/usr/bin/env node
/**
 * 產生 lib/data-meta.js —— 官方資料的「履歷」。
 *
 * 為什麼要有這個檔案：
 *   1. 網站必須能回答「這份資料是什麼時候抓的」——否則無法確認資料是不是最新的。
 *   2. data/*.json 不會被打包進 Vercel 的 Serverless Function，改成 JS 模組才會。
 *   3. 內容雜湊寫進檔案後，tests/iam.test.js 可以驗證「資料換了但 meta 沒重跑」→ 紅燈。
 *
 * 用法：node scripts/gen-data-meta.mjs [--check]
 *   --check：只驗證是否為最新，不寫檔（差異時 exit 1，供 CI／npm test 使用）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'lib', 'data-meta.js');
const check = process.argv.includes('--check');

const treesPath = path.join(DATA, 'iam_trees.json');
if (!fs.existsSync(treesPath)) {
  console.error('✗ 找不到 data/iam_trees.json，請先執行 scripts/fetch_iam.py');
  process.exit(1);
}

const raw = fs.readFileSync(treesPath);
const trees = JSON.parse(raw.toString('utf8'));
const metaPath = path.join(DATA, 'iam_meta.json');
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};

const dataHash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
const payload = {
  source_name: meta.source_name || '澳門特別行政區政府市政署 澳門自然網 — 古樹名木',
  source_page: meta.source_page || 'https://www.iam.gov.mo/nature/c/tree',
  list_endpoint: meta.list_endpoint || 'https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json',
  fetched_at: meta.fetched_at || null,
  record_count: Object.keys(trees).length,
  photo_count: meta.photo_count || null,
  photos_missing: meta.photos_missing || [],
  license_note: meta.license_note || '資料與照片著作權屬澳門市政署；本平台為非商業教學研究用途並標示出處。',
  data_hash: dataHash,
};

const body = `/**
 * 官方資料履歷（由 scripts/gen-data-meta.mjs 自動產生，請勿手改）。
 *
 * 用途：讓網站與 API 能說出「這份官方資料是什麼時候抓的、共幾筆、內容雜湊多少」，
 * 資料一更新（npm run build:data）就會改動本檔 → 部署後前端立刻看得到新的擷取時間。
 * tests/iam.test.js 會驗證 data_hash 與 data/iam_trees.json 一致。
 */
export const DATA_META = ${JSON.stringify(payload, null, 2)};

export default DATA_META;
`;

if (check) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== body) {
    console.error('✗ lib/data-meta.js 與 data/ 不同步，請執行 node scripts/gen-data-meta.mjs');
    process.exit(1);
  }
  console.log(`✓ lib/data-meta.js 已是最新（${payload.record_count} 筆、雜湊 ${dataHash}、擷取於 ${payload.fetched_at}）`);
} else {
  fs.writeFileSync(OUT, body, 'utf8');
  console.log(`✓ 已更新 lib/data-meta.js：${payload.record_count} 筆、雜湊 ${dataHash}、擷取於 ${payload.fetched_at}`);
}
