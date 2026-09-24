/**
 * 機密掃描測試：確保版本庫裡不會出現真實憑證。
 *
 * 背景：本專案曾把真實的 Supabase URL 與金鑰寫進 .env.example 並推上公開倉庫。
 * 這條測試會掃描所有 git 追蹤的檔案，一旦發現 JWT 形式的金鑰或真實的
 * Supabase 專案網址就讓測試失敗，避免再犯。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const TEXT_EXT = /\.(js|mjs|cjs|json|md|txt|sql|css|html|yml|yaml|sh|example|gitignore)$/i;
const SKIP_PATH = /(^|\/)(node_modules|\.git|photos)\//;

/** JWT 形式的權杖：三段以 . 分隔的 base64url */
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
/** 真實的 Supabase 專案網址（專案代號 20 個字元）；.env.example 的 xxxxxxxxxxxx 佔位符不會命中 */
const REAL_SUPABASE_URL = /https:\/\/[a-z0-9]{20}\.supabase\.co/;
/** 常見的服務金鑰欄位被填了非佔位符的值 */
const FILLED_SECRET_LINE = /^(SUPABASE_(?:SERVICE_ROLE_KEY|ANON_KEY)|SUPABASE_KEY)=(\S{40,})$/m;

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: process.cwd() })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return null; // 非 git 工作區（例如部署環境）時跳過
  }
}

const files = trackedFiles();

test('版本庫中不得出現真實憑證', (t) => {
  if (!files) return t.skip('非 git 工作區，略過');
  const offences = [];
  for (const f of files) {
    if (SKIP_PATH.test(f) || !TEXT_EXT.test(f)) continue;
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    if (JWT.test(text)) offences.push(`${f}：含 JWT 形式的金鑰`);
    if (REAL_SUPABASE_URL.test(text)) offences.push(`${f}：含真實 Supabase 專案網址`);
    const m = text.match(FILLED_SECRET_LINE);
    if (m) offences.push(`${f}：${m[1]} 被填入長值（疑似真實金鑰）`);
  }
  assert.deepEqual(offences, [], `發現疑似外洩的憑證：\n  ${offences.join('\n  ')}`);
});

test('.env.example 只放佔位符', (t) => {
  if (!existsSync('.env.example')) return t.skip('沒有 .env.example');
  const s = readFileSync('.env.example', 'utf8');
  assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\./.test(s), '.env.example 含 JWT 形式的金鑰');
  assert.ok(!REAL_SUPABASE_URL.test(s), '.env.example 含真實 Supabase 專案網址');
  assert.match(s, /SUPABASE_URL=https:\/\/xxx+\.supabase\.co/, '.env.example 的 SUPABASE_URL 應為 xxx 佔位符');
});

test('.gitignore 必須忽略真實的環境變數檔', () => {
  const gi = readFileSync('.gitignore', 'utf8');
  for (const pattern of ['.env', '.env.local']) {
    assert.ok(gi.split('\n').some((line) => line.trim() === pattern),
      `.gitignore 應包含 ${pattern}`);
  }
  assert.equal(existsSync('.env') && files && files.includes('.env'), false,
    '.env 不應被 git 追蹤');
});
