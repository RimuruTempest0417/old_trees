#!/usr/bin/env node
/**
 * 官方觀測快照 → 監測時間序列的資料來源
 *
 * 為什麼要這個：監測需要「同一株樹在不同時間點的官方值」。
 * 市政署網站只提供現行值，沒有歷史值，所以我們自己存：
 * 每次官方名錄內容有變更（每日擷取發現差異）就存一份帶日期的快照，
 * 之後 lib/monitoring.js 就能把「官方歷次版本 + 我們的實地考察紀錄」接成一條序列。
 *
 * 用法：
 *   node scripts/snapshot-observations.mjs          寫入新快照並重建 lib/official-history.js
 *   node scripts/snapshot-observations.mjs --check  只檢查 lib/official-history.js 是否與資料一致（CI 用）
 *
 * 內容沒變就不重複存檔（以監測欄位的內容雜湊判斷），避免一年 365 份一樣的快照。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');
const OBS_DIR = path.join(DATA, 'observations');
const OUT_JS = path.join(ROOT, 'lib', 'official-history.js');
const CHECK = process.argv.includes('--check');

/** 監測會用到的欄位（只存這些，快照才不會變成整份名錄的副本） */
const FIELDS = ['health', 'grade', 'age_years', 'height_m', 'diameter_cm', 'girth_cm', 'crown_m'];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function canonical(trees) {
  const out = {};
  for (const no of Object.keys(trees).sort()) {
    const t = trees[no] || {};
    const row = {};
    for (const f of FIELDS) {
      if (t[f] !== undefined && t[f] !== null && t[f] !== '') row[f] = t[f];
    }
    out[no] = row;
  }
  return out;
}

const hashOf = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

function loadSnapshots() {
  if (!fs.existsSync(OBS_DIR)) return [];
  return fs.readdirSync(OBS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => {
      const j = readJson(path.join(OBS_DIR, f));
      return { date: j.date || f.replace('.json', ''), hash: j.hash, fetched_at: j.fetched_at || null, trees: j.trees || {} };
    });
}

function renderModule(snaps) {
  const lines = [];
  lines.push('/**');
  lines.push(' * 官方觀測快照（自動產生，請勿手改）');
  lines.push(' *');
  lines.push(' * 產生器：scripts/snapshot-observations.mjs（每日擷取 workflow 會自動執行）');
  lines.push(' * 用途：lib/monitoring.js 的監測時間序列——同一株樹在不同官方版本的官方值。');
  lines.push(` * 目前快照數：${snaps.length}${snaps.length ? `（${snaps[0].date} ～ ${snaps[snaps.length - 1].date}）` : ''}`);
  lines.push(' */');
  lines.push('');
  lines.push('export const SNAPSHOTS = [');
  for (const s of snaps) {
    lines.push('  {');
    lines.push(`    date: ${JSON.stringify(s.date)},`);
    lines.push(`    hash: ${JSON.stringify(s.hash)},`);
    lines.push(`    fetched_at: ${JSON.stringify(s.fetched_at)},`);
    lines.push('    trees: {');
    for (const no of Object.keys(s.trees).sort()) {
      lines.push(`      ${JSON.stringify(no)}: ${JSON.stringify(s.trees[no])},`);
    }
    lines.push('    },');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  lines.push('export const SNAPSHOT_COUNT = SNAPSHOTS.length;');
  lines.push('');
  lines.push('export default { SNAPSHOTS, SNAPSHOT_COUNT };');
  lines.push('');
  return lines.join('\n');
}

const metaPath = path.join(DATA, 'iam_meta.json');
const meta = fs.existsSync(metaPath) ? readJson(metaPath) : {};
const trees = canonical(readJson(path.join(DATA, 'iam_trees.json')));
const hash = hashOf(trees);
const date = (meta.fetched_at || new Date().toISOString()).slice(0, 10);

fs.mkdirSync(OBS_DIR, { recursive: true });
const existing = loadSnapshots();
const sameHash = existing.find((s) => s.hash === hash);

let action = 'skip';
if (sameHash) {
  console.log(`↷ 官方內容雜湊 ${hash} 已有快照（${sameHash.date}），不重複存檔`);
} else {
  action = 'write';
  const payload = {
    date,
    hash,
    fetched_at: meta.fetched_at || null,
    source_name: meta.source_name || null,
    source_page: meta.source_page || null,
    record_count: Object.keys(trees).length,
    fields: FIELDS,
    note: '只存監測欄位；分級與健康狀況皆為市政署自然網現行值。',
    trees,
  };
  fs.writeFileSync(path.join(OBS_DIR, `${date}.json`), `${JSON.stringify(payload, null, 1)}\n`);
  console.log(`✓ 新增官方觀測快照 data/observations/${date}.json（內容雜湊 ${hash}、${Object.keys(trees).length} 株）`);
}

const snaps = loadSnapshots();
const next = renderModule(snaps);
const current = fs.existsSync(OUT_JS) ? fs.readFileSync(OUT_JS, 'utf8') : null;

if (CHECK) {
  if (current === next) {
    console.log(`✓ lib/official-history.js 與 data/observations/ 一致（${snaps.length} 份快照）`);
    process.exit(0);
  }
  console.error('✗ lib/official-history.js 與資料不一致，請執行：node scripts/snapshot-observations.mjs');
  process.exit(1);
}

if (current !== next) {
  fs.writeFileSync(OUT_JS, next);
  console.log(`✓ 已重建 lib/official-history.js（${snaps.length} 份快照、${next.length} 位元組）`);
} else {
  console.log('↷ lib/official-history.js 無需更新');
}
