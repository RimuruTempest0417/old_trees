/**
 * 市政署官方資料整合測試。
 *
 * 背景：本站資料除《古樹名木保護名錄》整理之古樹.csv 外，另向市政署「澳門自然網」
 * 古樹名木專頁（https://www.iam.gov.mo/nature/c/tree）抓取逐株官方資料與照片。
 * 這條測試確保：
 *   1. 官方清單與照片來源檔存在，且抓取來源為 iam.gov.mo；
 *   2. 快照中每株古樹都帶官方座標、官方照片與官方描述；
 *   3. 照片檔案確實存在於 public/photos/trees/（不會出現破圖）；
 *   4. 官方編號與《名錄》編號一致（658 株全數對上）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(ROOT + p, 'utf8'));

const iam = read('data/iam_trees.json');
const meta = read('data/iam_meta.json');
const snap = read('data/snapshot.json');

test('官方清單來源為市政署 iam.gov.mo，且筆數與名錄一致', () => {
  assert.match(meta.list_endpoint, /^https:\/\/www\.iam\.gov\.mo\/nature\/BigJson\/oldtrees_c\.json$/);
  assert.match(meta.photo_base, /^https:\/\/www\.iam\.gov\.mo\//);
  assert.ok(meta.fetched_at, '應記錄抓取時間');
  assert.equal(Object.keys(iam).length, 658, '官方清單應為 658 筆');
  assert.equal(snap.trees.length, 658, '快照應為 658 株');
  assert.equal(snap.official.record_count, 658);
});

test('每株古樹都對上市政署官方編號（658/658）', () => {
  const missing = snap.trees.filter((t) => !t.official_no || t.official_no !== t.tree_no);
  assert.equal(missing.length, 0, `未對上官方編號：${missing.slice(0, 5).map((t) => t.tree_no)}`);
  const ids = new Set(snap.trees.map((t) => t.ref_id));
  assert.equal(ids.size, 658, '市政署唯一識別碼不應重複');
});

test('座標全部來自市政署逐株座標，無地理編碼近似值', () => {
  const off = snap.trees.filter((t) => t.geo_precision !== 'official');
  assert.equal(off.length, 0, `非官方座標：${off.slice(0, 5).map((t) => `${t.tree_no}:${t.geo_precision}`)}`);
  const noCoord = snap.trees.filter((t) => t.lat == null || t.lon == null);
  assert.equal(noCoord.length, 0, '不應有缺座標的古樹');
  // 澳門範圍合理檢查（避免經緯度寫反）
  const bad = snap.trees.filter((t) => !(22.0 < t.lat && t.lat < 22.25 && 113.5 < t.lon && t.lon < 113.65));
  assert.equal(bad.length, 0, `座標超出澳門範圍：${bad.slice(0, 5).map((t) => t.tree_no)}`);
});

test('官方照片：657 張可取得，官方已移除影像檔者明確標示', () => {
  const withPhoto = snap.trees.filter((t) => t.photo_url);
  const without = snap.trees.filter((t) => !t.photo_url);
  assert.equal(withPhoto.length + without.length, 658);
  assert.equal(withPhoto.length, meta.photo_count, '快照照片數應與 meta.photo_count 一致');
  assert.ok(Array.isArray(meta.photos_missing) && meta.photos_missing.length >= 1,
    '官方清單中存在已移除影像檔者，應被記錄');
  for (const no of meta.photos_missing) {
    assert.equal(iam[no] && iam[no].photo_ok, false, `${no} 應標記 photo_ok=false`);
    assert.ok(iam[no] && iam[no].image_path, `${no} 官方清單仍指向某影像檔`);
  }
  assert.deepEqual(without.map((t) => t.tree_no), meta.photos_missing,
    '沒有照片的樹應與 photos_missing 完全一致');
  // 沒有照片的樹不得留下 photo_source，否則詳情頁會出現無照片卻有出處的矛盾
  for (const t of without) assert.equal(t.photo_source, null, `${t.tree_no} 不應有 photo_source`);
  const badSrc = withPhoto.filter((t) => !/^https:\/\/www\.iam\.gov\.mo\/nature\/Content\//.test(t.photo_source));
  assert.equal(badSrc.length, 0, '照片原始網址應指向市政署網站');
  const noDesc = snap.trees.filter((t) => !t.official_description);
  assert.equal(noDesc.length, 0, '官方描述不應為空');
  const noLoc = snap.trees.filter((t) => !t.official_loc);
  assert.equal(noLoc.length, 0, '官方地點不應為空');
});

test('每張官方照片都是真的 JPEG，檔案也都在（不會出現破圖）', () => {
  const missing = [];
  const notJpeg = [];
  for (const t of snap.trees) {
    if (!t.photo_url) continue;
    const p = `${ROOT}public${t.photo_url}`;
    if (!existsSync(p)) { missing.push(t.photo_url); continue; }
    // 市政署網站對已移除的影像檔會回 HTTP 200 ＋ SPA 首頁 HTML，
    // 只檢查 HTTP 狀態會把 HTML 存成 .jpg（樹木 471 就是這樣壞的），故驗證檔頭。
    const head = readFileSync(p).subarray(0, 3);
    if (head[0] !== 0xFF || head[1] !== 0xD8 || head[2] !== 0xFF) notJpeg.push(t.photo_url);
  }
  assert.equal(missing.length, 0, `缺少照片檔：${missing.slice(0, 5)}`);
  assert.equal(notJpeg.length, 0, `不是 JPEG 的照片檔：${notJpeg.slice(0, 5)}`);
  // 目錄裡不應有孤兒檔或假 JPEG
  const files = readdirSync(`${ROOT}public/photos/trees`).filter((f) => f.endsWith('.jpg'));
  assert.equal(files.length, snap.trees.filter((t) => t.photo_url).length,
    '目錄檔案數應等於有照片的樹數（不應有孤兒檔）');
});

test('官方欄位已併入快照（冠幅、胸徑、周邊範圍、市政署編號）', () => {
  assert.ok(snap.trees.some((t) => t.crown_m > 0), '應有冠幅資料');
  assert.ok(snap.trees.some((t) => t.diameter_cm > 0), '應有胸徑資料');
  assert.ok(snap.trees.every((t) => /^T\d+$/.test(t.iam_tree_no || '')), '每株都應有市政署樹木編號');
  const withCrown = snap.trees.filter((t) => t.crown_m != null).length;
  assert.ok(withCrown >= 60, `冠幅覆蓋過少：${withCrown}`);
});

test('學名版本差異已保留（現行接受名＋市政署名）', () => {
  const both = snap.species.filter((s) => s.name_sci && s.name_sci_official);
  assert.ok(both.length >= 10, `應並列多個學名版本，實際 ${both.length}`);
  assert.ok(snap.species.every((s) => s.name_sci), '每個樹種都應有學名');
});

test('官方描述已進資料庫種子檔（Supabase 模式同享）', () => {
  const sql = readFileSync(ROOT + 'supabase/seed.sql', 'utf8');
  assert.match(sql, /official_description,official_loc,photo_url,photo_source/);
  assert.match(sql, /geo_precision/);
  assert.match(sql, /official_age_years/);
  const init = readFileSync(ROOT + 'supabase/init.sql', 'utf8');
  assert.match(init, /官方照片/, 'init.sql 應包含官方照片欄位註解');
});
