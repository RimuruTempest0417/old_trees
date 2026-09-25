/**
 * 官方值優先：分級與健康狀況一律採用市政署自然網「現行值」。
 *
 * 為什麼要有一組獨立測試：#1132（氹仔小潭山 2000 環山徑・華潤楠・14 年）
 * 《古樹名錄》CSV 寫「三級」，但市政署自然網現行是「不分級」——14 年的樹不可能是三級
 * （該級距為 100–299 年），且官方 5 株「不分級」的樹齡是 6–35 年。
 * 另類差異 4 株健康狀況（名錄「一般」／自然網「健康」）。
 *
 * 規則：顯示與統計一律用 official_grade／official_health；
 *       名錄值保留在 listing_grade／listing_health（供「資料核對」對照），原始資料不改動。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const snap = readJson('data/snapshot.json');
const iam = readJson('data/iam_trees.json');

const repo = await import('../lib/repo.js');
const { officialFirst } = repo;

test('officialFirst：官方現行值優先，名錄值保留在 listing_*，缺官方值時才回退', () => {
  const a = officialFirst({ grade: '三級', official_grade: '不分級', health: '一般', official_health: '健康', age_years: 155, official_age_years: 115 });
  assert.equal(a.grade, '不分級');
  assert.equal(a.health, '健康');
  assert.equal(a.age_years, 115, '樹齡也要用官方現行值');
  assert.equal(a.listing_grade, '三級', '名錄值必須保留（資料核對要用）');
  assert.equal(a.listing_health, '一般');
  assert.equal(a.listing_age_years, 155);
  // 官方沒有值時回退到名錄值，不得變成 null
  const b = officialFirst({ grade: '三級', official_grade: null, health: '一般', official_health: null, age_years: '300' });
  assert.equal(b.grade, '三級');
  assert.equal(b.health, '一般');
  assert.equal(b.age_years, 300, '缺官方樹齡時回退名錄值，且要轉成數字');
  assert.equal(b.official_age_years, null);
  assert.equal(officialFirst({}).grade, null);
  assert.equal(officialFirst({}).age_years, null);
  assert.equal(officialFirst(null).grade, null, '不得因 null 拋錯');
});

test('#1132 這一株：顯示不分級、名錄值仍看得到、胸徑胸圍與官方一致', async () => {
  const t = await repo.getTree('1132');
  assert.equal(t.tree_no, '1132');
  assert.equal(t.grade, '不分級', '顯示值必須是市政署自然網現行值');
  assert.equal(t.listing_grade, '三級', '《名錄》值要保留給資料核對');
  assert.equal(t.official_grade, '不分級');
  // 官方原始紀錄：treeAge 14、treeDiameter 12.00,14.00、treeSurround 37.7,44.0（π 完全吻合）
  assert.equal(t.age_years, 14);
  assert.equal(t.diameter_cm, 14, '代表值取最大胸徑那支');
  assert.equal(t.girth_cm, 44);
  assert.match(t.stem_measures, /12\.00／14\.00/, '各主幹胸徑要完整列出');
  assert.match(t.stem_measures, /37\.7／44\.0/, '各主幹胸圍要完整列出');
  assert.equal(t.stem_count, 2);
  // 健康狀況這一株兩個來源一致（一般），但欄位仍要齊全
  assert.equal(t.health, '一般');
  assert.equal(t.official_health, '一般');
  assert.ok(Math.abs(t.diameter_cm * Math.PI - t.girth_cm) < 1, '胸圍必須與官方胸徑自洽（不換算、直接取官方值）');
});

test('658 株：顯示的分級與健康狀況必須等於官方現行值', async () => {
  const trees = await repo.allTrees();
  assert.equal(trees.length, 658);
  let checked = 0;
  for (const t of trees) {
    const src = snap.trees.find((x) => x.tree_no === t.tree_no);
    if (src.official_grade) { assert.equal(t.grade, src.official_grade, `#${t.tree_no} 分級`); checked += 1; }
    if (src.official_health) assert.equal(t.health, src.official_health, `#${t.tree_no} 健康狀況`);
  }
  assert.ok(checked > 600, `應有大量官方分級可比對，實際 ${checked}`);
  // 名錄與官方的已知差異必須剛好是這 5 株（資料一旦更新，這裡會提醒我們重新確認）
  const gradeDiff = trees.filter((t) => t.listing_grade && t.listing_grade !== t.grade).map((t) => t.tree_no);
  const healthDiff = trees.filter((t) => t.listing_health && t.listing_health !== t.health).map((t) => t.tree_no);
  const ageDiff = trees.filter((t) => t.listing_age_years != null && t.listing_age_years !== t.age_years).map((t) => t.tree_no);
  assert.deepEqual(gradeDiff.sort(), ['1132'], '分級差異株數改變了，請重新核對官方資料');
  assert.deepEqual(healthDiff.sort(), ['548', '627', '638', '641'], '健康狀況差異株數改變了，請重新核對官方資料');
  assert.deepEqual(ageDiff, ['619'], '樹齡差異株數改變了，請重新核對官方資料');
  // 顯示的樹齡必須等於官方現行值（#619 名錄 155 年、自然網 115 年）
  for (const t of trees) {
    const src = snap.trees.find((x) => x.tree_no === t.tree_no);
    if (src.official_age_years != null) assert.equal(t.age_years, Number(src.official_age_years), `#${t.tree_no} 樹齡`);
  }
});

test('#619 這一株：顯示官方現行樹齡 115 年、名錄 155 年仍保留，年齡篩選跟著顯示值走', async () => {
  const t = await repo.getTree('619');
  assert.equal(t.age_years, 115, '顯示樹齡必須是市政署自然網現行值');
  assert.equal(t.listing_age_years, 155, '《名錄》原值要保留給資料核對');
  assert.equal(t.official_age_years, 115);
  // 年齡區間篩選必須與畫面一致：>=150 不該出現 #619，<=120 應該出現
  const old = await repo.findTrees({ min_age: 150, limit: 2000 });
  assert.ok(!old.rows.some((r) => r.tree_no === '619'), '顯示樹齡 115 年的株不得被 min_age=150 篩出來');
  const young = await repo.findTrees({ max_age: 120, limit: 2000 });
  assert.ok(young.rows.some((r) => r.tree_no === '619'), '顯示樹齡 115 年應被 max_age=120 篩到');
  // 總覽的平均樹齡也要用官方值（名錄 133.28 → 官方 133.22）
  const o = await repo.overview();
  assert.equal(o.avg_age, 133.2);
  assert.equal(o.max_age, 515, '最老仍是 515 年（不受影響）');
});

test('統計與篩選都用同一個「顯示值」：不分級 5 株（含 #1132）', async () => {
  const o = await repo.overview();
  assert.equal(o.grade_other, 5, '官方不分級應為 5 株');
  assert.equal(o.grade1, 1);
  assert.equal(o.grade2, 6);
  assert.equal(o.grade3, 646);
  assert.equal(o.good, 215, '官方健康狀況：健康 215');
  assert.equal(o.fair, 422);
  assert.equal(o.endangered, 21);
  // 篩選必須與畫面一致：用官方值篩得到 #1132
  const f = await repo.findTrees({ grade: '不分級', limit: 50 });
  assert.equal(f.total, 5);
  assert.ok(f.rows.some((r) => r.tree_no === '1132'), '用官方分級篩選必須包含 #1132');
  assert.ok(f.rows.every((r) => r.grade === '不分級'));
  const h = await repo.findTrees({ health: '健康', limit: 2000 });
  assert.equal(h.total, 215);
  assert.ok(h.rows.some((r) => r.tree_no === '548'));
});

test('堂區統計與總覽數字必須同源（不得一個用 SQL 舊值、一個用顯示值）', async () => {
  const o = await repo.overview();
  const rows = await repo.parishStats();
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  assert.equal(sum('tree_count'), o.tree_count);
  assert.equal(sum('grade1'), o.grade1);
  assert.equal(sum('grade3'), o.grade3);
  assert.equal(sum('grade_other'), o.grade_other, '堂區統計的不分級總數必須與總覽一致');
  assert.equal(sum('health_good'), o.good);
  assert.equal(sum('health_fair'), o.fair);
  assert.equal(sum('health_endangered'), o.endangered);
});

test('前端「資料核對」必須說明兩個來源並指明以官方現行值為準', () => {
  const map = read('public/js/map.js');
  assert.match(map, /official_grade/, '詳情頁要看得到官方分級');
  assert.match(map, /listing_grade|《名錄》值/, '詳情頁要看得到名錄值作對照');
  const repo = read('lib/repo.js');
  assert.match(repo, /export function officialFirst/, 'officialFirst 必須存在且可測試');
  assert.ok(!/health: t\.health, grade: t\.grade/.test(repo), 'allTrees 不得再直接回傳名錄的 health/grade');
});

test('官方來源本身：data/iam_trees.json 的 #1132 就是不分級（不是我們判定）', () => {
  assert.equal(iam['1132'].grade, '不分級');
  assert.equal(iam['1132'].age_years, 14);
  assert.equal(iam['1132'].diameter_cm, 14);
  assert.equal(iam['1132'].girth_cm, 44);
  // 官方「不分級」的 5 株樹齡都在 6–35 年，與「三級＝100–299 年」不相容
  const other = ['67', '66', '1131', '1135', '1132'].map((no) => iam[no].age_years);
  assert.ok(other.every((a) => a <= 40), `不分級應為幼齡／名木，實際樹齡 ${other.join(',')}`);
});
