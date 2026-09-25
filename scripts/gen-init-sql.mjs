#!/usr/bin/env node
/**
 * 產生 supabase/init.sql ＝ 檔頭 ＋ schema.sql ＋ seed.sql（Supabase SQL Editor 一鍵初始化用）。
 *
 * 為什麼要有這支腳本：init.sql 以前是手工拼出來的，改了 schema.sql 或 seed.sql 之後
 * 常常忘記重拼，於是「線上要貼的那個檔」就落後好幾版（本檔就是為了修這個問題而存在）。
 * 用法：node scripts/gen-init-sql.mjs [--check]
 *   --check：只驗證 init.sql 是否為最新（給測試用），不會改檔。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const HEADER = `-- ============================================================
-- 澳門古樹保育研究平台 — 一鍵初始化（schema.sql + seed.sql）
-- 用法：Supabase 儀表板 → SQL Editor → New query → 全文貼上 → Run
-- 可重複執行：資料表用 if not exists，種子資料會先 truncate 再寫入。
-- 本檔由 scripts/gen-init-sql.mjs 產生，請勿手改。
-- ============================================================

`;

const schema = read('supabase/schema.sql');
const seed = read('supabase/seed.sql');
const out = HEADER + schema.trimEnd() + '\n\n' + seed.trimEnd() + '\n';
const target = path.join(ROOT, 'supabase/init.sql');

if (process.argv.includes('--check')) {
  const cur = fs.readFileSync(target, 'utf8');
  if (cur === out) {
    console.log('✓ supabase/init.sql 已是最新');
    process.exit(0);
  }
  console.error('✗ supabase/init.sql 落後了：請執行 npm run build:init 重新產生');
  process.exit(1);
}

fs.writeFileSync(target, out, 'utf8');
console.log(`✓ 已更新 supabase/init.sql（${out.split('\n').length} 行，${(out.length / 1024).toFixed(0)} KB）`);
