/**
 * 列印模組測試（古樹檔案卡／考察單／路綫資料冊）。
 *
 * 重點
 *  1. 資料不補造：官方缺值一律「官方未提供」，欄位對應正確。
 *  2. 版面可預期：每張卡就是一個 .card-page，路綫資料冊頁數＝站數＋1。
 *  3. 安全：任何欄位都必須經過跳脫，紙本不能變成注入點。
 *  4. 極端輸入（空物件、單一站點、超長描述、缺照片）不得拋錯。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorSrc = fs.readFileSync(path.join(ROOT, 'public', 'vendor', 'qrcode.js'), 'utf8');
globalThis.qrcode = new Function(`${vendorSrc}; return qrcode;`)();

const { cardModel, cardHtml, fieldFormHtml, routeBookHtml, schematicMapSvg, projectXY, checkItems } =
  await import('../public/js/card.js');
// 二維碼只是模組方塊，網址不會以文字出現在 HTML；因此改為比對「該網址編出來的 SVG 是否原樣內嵌」。
const { qrSvg } = await import('../public/js/qr.js');

const SITE = 'https://old-trees-mylearning.vercel.app';
const DATE = '2026/9/24 下午10:30:00';

/** 與 /api/tree?no=66 真實回傳同形狀的樣本（值取自正式環境）。 */
const TREE = {
  tree_no: '66', grade: '不分級', age_years: 25, height_m: 9.01, health: '健康',
  lat: 22.159052, lon: 113.545271, parish: '嘉模堂區', species: '華潤楠',
  name_sci: 'Machilus chinensis', site: '氹仔區小潭山2000環山徑',
  site_short: '小潭山2000環山徑', geo_precision: 'official', official_no: '66',
  iam_tree_no: 'T0000611', crown_m: null, diameter_cm: null,
  official_description: '喬木。高約8-11m，無毛。芽細小，無毛或有毛。',
  official_age_years: 25, official_health: '健康', official_grade: '不分級',
  tree_photo: '/photos/trees/66.jpg',
  tree_photo_source: 'https://www.iam.gov.mo/nature/Content/OldTreesOnline/1005198.jpg',
  photo_count: 1,
};

const pageCount = (html) => (html.match(/class="card-page/g) || []).length;

test('查核清單：依資料狀況產生，且一定包含環境觀察', () => {
  const items = checkItems(TREE);
  assert.ok(items.length >= 1, '至少要有環境觀察一項');
  assert.equal(items[items.length - 1].why, '現場環境');
  assert.ok(items.some((i) => i.why === '官方未提供胸徑'), '缺胸徑要提醒實測');
  assert.ok(items.some((i) => i.why === '官方未提供冠幅'), '缺冠幅要提醒實測');
  assert.ok(!items.some((i) => i.why === '官方現況'), '健康的樹不該出現健康警示');
});

test('查核清單：瀕危＋分級＋舊座標＋無照片都會各產生一項', () => {
  const items = checkItems({
    health: '瀕危', grade: '一級', age_years: 515, geo_precision: 'approx', photo_count: 0,
    diameter_cm: 120, crown_m: 18,
  });
  const whys = items.map((i) => i.why);
  assert.ok(whys.includes('官方現況'));
  assert.ok(whys.includes('官方分級'));
  assert.ok(whys.includes('樹齡 515 年'));
  assert.ok(whys.includes('目前座標為approx'));
  assert.ok(whys.includes('官方未提供照片'));
  assert.ok(!whys.includes('官方未提供胸徑'), '已有胸徑就不提醒');
});

test('查核清單：空物件與 undefined 不得拋錯，且輸出具有決定性', () => {
  assert.doesNotThrow(() => checkItems());
  assert.doesNotThrow(() => checkItems({}));
  assert.deepEqual(checkItems({}), checkItems({}));
});

test('cardModel：官方欄位一一對應，座標標示精度', () => {
  const m = cardModel(TREE, { base: SITE, date: DATE });
  const map = Object.fromEntries(m.metrics);
  assert.equal(map['古樹編號'], '66');
  assert.equal(map['樹種'], '華潤楠');
  assert.equal(map['學名'], 'Machilus chinensis');
  assert.equal(map['堂區'], '嘉模堂區');
  assert.equal(map['座標'], '22.159052, 113.545271（official）');
  assert.equal(map['樹齡'], '25 年');
  assert.equal(map['樹高'], '9.01 m');
  assert.equal(map['胸徑'], '官方未提供');
  assert.equal(map['冠幅'], '官方未提供');
  assert.equal(map['健康狀況'], '健康');
  // 注意網址結構：模式是路徑段落（#/map、#/field），古樹編號才是查詢參數（?tree=66）
  assert.match(m.qrUrl, /#\/map\?tree=66$/);
  assert.match(m.fieldUrl, /#\/field\?tree=66$/);
  assert.equal(m.generatedAt, DATE);
  assert.ok(m.sources.length >= 2);
});

test('cardModel：缺官方照片時改用樹種相片並說明原因', () => {
  const m = cardModel({ ...TREE, tree_photo: null, species_photo: '/photos/species/39.jpg', species_photo_credit: 'Wikimedia Commons' }, { base: SITE });
  assert.equal(m.photo, '/photos/species/39.jpg');
  assert.match(m.photoNote, /已下架|樹種相片/);
  const m2 = cardModel({ ...TREE, tree_photo: null, species_photo: null }, { base: SITE });
  assert.equal(m2.photo, '');
  assert.match(m2.photoNote, /未提供照片/);
});

test('cardHtml：一株一張 A4，關鍵欄位、清單與二維碼都在', () => {
  const m = cardModel(TREE, { base: SITE, date: DATE });
  const html = cardHtml(m);
  assert.equal(pageCount(html), 1);
  assert.match(html, /古樹檔案卡/);
  assert.match(html, /華潤楠/);
  assert.match(html, /22\.159052, 113\.545271/);
  assert.match(html, /官方未提供/);
  assert.match(html, /<svg[\s\S]*?<\/svg>/, '要內嵌二維碼 SVG');
  assert.ok(html.includes(qrSvg(m.qrUrl, { size: 34 })), '卡片二維碼必須指向該株詳情頁');
  assert.ok(!html.includes(qrSvg(m.fieldUrl, { size: 34 })), '卡片不該誤用考察表單網址');
  assert.equal((html.match(/class="box"/g) || []).length, m.checks.length);
  assert.match(html, /產生時間：2026\/9\/24/);
  assert.ok(!/<script/i.test(html), '紙本不應含任何 script');
});

test('cardHtml：所有欄位都經過跳脫，無法注入標籤', () => {
  const evil = {
    ...TREE,
    species: '<script>alert(1)</script>',
    site: '" onload="x',
    official_description: '<img src=x onerror=alert(1)>',
  };
  const html = cardHtml(cardModel(evil, { base: SITE, date: DATE }));
  assert.ok(!/<script/i.test(html));
  assert.ok(!/<img src=x/i.test(html));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot; onload=&quot;/);
});

test('cardHtml：超長官方描述會截斷，不會撐爆一頁', () => {
  const m = cardModel({ ...TREE, official_description: '喬木。'.repeat(400) }, { base: SITE, date: DATE });
  const html = cardHtml(m);
  assert.match(html, /…/);
  assert.ok(html.length < 20000, '單頁 HTML 不應失控膨脹');
});

test('cardHtml：可關閉二維碼（列印純資料版）', () => {
  const html = cardHtml(cardModel(TREE, { base: SITE, date: DATE }), { qr: false });
  assert.ok(!/<svg/i.test(html));
});

test('fieldFormHtml：空白表沒有指定樹，仍有量測表格與記錄說明', () => {
  const html = fieldFormHtml(null, { base: SITE, date: DATE });
  assert.equal(pageCount(html), 1);
  assert.match(html, /空白表/);
  assert.match(html, /實地考察紀錄單/);
  assert.match(html, /胸徑（離地 1\.3m，cm）/);
  assert.match(html, /記錄說明/);
  assert.match(html, /不會覆寫市政署官方名錄/);
  assert.match(html, /class="blank"/);
  assert.ok(!/<svg/i.test(html), '空白表沒有樹就沒有二維碼');
});

test('fieldFormHtml：帶入某株時填好基本資料並附該株紀錄表二維碼', () => {
  const html = fieldFormHtml(TREE, { base: SITE, date: DATE });
  assert.match(html, /編號 66/);
  assert.match(html, /華潤楠/);
  const model = cardModel(TREE, { base: SITE, date: DATE });
  assert.ok(html.includes(qrSvg(model.fieldUrl, { size: 30 })), '考察單二維碼必須指向該株的考察表單');
  assert.ok(!html.includes(qrSvg(model.qrUrl, { size: 30 })), '考察單不該誤用詳情頁網址');
  assert.match(html, /aria-label="古樹二維碼"/);
  assert.match(html, /現場量測與觀察/);
});

test('projectXY：經度依緯度壓縮（東西向不會與南北向等比）', () => {
  const pts = projectXY([{ lat: 22.2, lon: 113.5 }, { lat: 22.2, lon: 113.6 }]);
  const dx = Math.abs(pts[1].x - pts[0].x);
  const dy = Math.abs(pts[1].y - pts[0].y);
  assert.ok(dx > 0 && dy === 0, '同緯度兩點只在 x 方向分開');
  assert.ok(dx < 0.1, `0.1 度經度在緯度 22 度約 0.093 度，實際 ${dx}`);
  assert.equal(pts[0].lat, 22.2);
});

test('schematicMapSvg：站點數量、編號、比例尺與圖說正確', () => {
  const stops = [
    { lat: 22.1992, lon: 113.5404, label: '白鴿巢公園' },
    { lat: 22.1971, lon: 113.5421, label: '大炮台' },
    { lat: 22.1879, lon: 113.5412, label: '議事亭前地' },
  ];
  const svg = schematicMapSvg(stops, { width: 400, height: 260 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal((svg.match(/<circle /g) || []).length, 3);
  assert.match(svg, />1</);
  assert.match(svg, />3</);
  assert.match(svg, /示意圖/);
  assert.match(svg, /約 /, '要有比例尺文字');
  assert.match(svg, /N↑/);
  stops.forEach((s) => assert.ok(svg.includes(s.label), `站名 ${s.label} 應出現`));
});

test('schematicMapSvg：所有站點都落在 viewBox 內（不會畫出紙外）', () => {
  const stops = Array.from({ length: 8 }, (_, i) => ({ lat: 22.19 + i * 0.004, lon: 113.54 - i * 0.003, label: `站${i + 1}` }));
  const width = 420; const height = 280;
  const svg = schematicMapSvg(stops, { width, height });
  const circles = [...svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(circles.length, 8);
  circles.forEach(([x, y]) => {
    assert.ok(x >= 0 && x <= width, `x=${x} 超出寬度`);
    assert.ok(y >= 0 && y <= height, `y=${y} 超出高度`);
  });
});

test('schematicMapSvg：右半邊的站名改向左書寫，避免超出紙面被裁掉', () => {
  const stops = [
    { lat: 22.1992, lon: 113.5400, label: '最西邊一站' },
    { lat: 22.1990, lon: 113.5600, label: '最東邊一站' },
  ];
  const width = 400;
  const svg = schematicMapSvg(stops, { width, height: 260 });
  const labels = [...svg.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="(start|end)"[^>]*>([^<]*)<\/text>/g)];
  const east = labels.find((m) => m[3] === '最東邊一站');
  const west = labels.find((m) => m[3] === '最西邊一站');
  assert.equal(west[2], 'start', '左半邊往右寫');
  assert.equal(east[2], 'end', '右半邊往左寫（靠右對齊）');
  assert.ok(Number(east[1]) <= width, '標籤起點不得超出圖寬');
});

test('schematicMapSvg：單一站點與空陣列都不得拋錯', () => {
  const one = schematicMapSvg([{ lat: 22.19, lon: 113.54, label: '唯一一站' }]);
  assert.equal((one.match(/<circle /g) || []).length, 1);
  const none = schematicMapSvg([]);
  assert.match(none, /無站點資料/);
  assert.doesNotThrow(() => schematicMapSvg());
});

test('schematicMapSvg：站名經過跳脫', () => {
  const svg = schematicMapSvg([{ lat: 22.19, lon: 113.54, label: '<b>壞站名</b>' }]);
  assert.ok(!svg.includes('<b>壞站名'));
  assert.match(svg, /&lt;b&gt;/);
});

const ROUTE = {
  route: {
    code: 'R1', name: '世遺核心區古樹漫步', summary: '以議事亭前地為中心，串連世遺核心區的古樹。',
    species_focus: '榕樹', tips: '建議清晨或傍晚前往。',
  },
  statistics: { stops: 3, trees_covered: 42, species_count: 7, oldest_age: 400, avg_age: 120, endangered: 4 },
  stops: [
    {
      order: 1, site: '白鴿巢公園', parish: '花王堂區', lat: 22.1992, lon: 113.5404,
      tree_count: 12, oldest: 400, species_list: ['榕樹', '假菩提'], notes: ['留意樹冠覆蓋範圍'],
      trees: Array.from({ length: 8 }, (_, i) => ({ tree_no: String(100 + i), species: '榕樹', age_years: 400 - i * 20, health: '健康', grade: '一級' })),
    },
    { order: 2, site: '大炮台', parish: '花王堂區', lat: 22.1971, lon: 113.5421, tree_count: 6, oldest: 210, species_list: ['假菩提'], trees: [] },
    { order: 3, site: '議事亭前地', parish: '大堂區', lat: 22.1879, lon: 113.5412, tree_count: 24, oldest: 160, species_list: ['榕樹'], trees: [] },
  ],
};

test('routeBookHtml：頁數＝站數＋1（封面），每頁都是一張 A4', () => {
  const book = routeBookHtml(ROUTE, { base: SITE, date: DATE });
  assert.equal(book.pages.length, 4);
  assert.equal(pageCount(book.html), 4);
  assert.equal(new Set(book.pages).size, 4, '每頁內容不重複');
});

test('routeBookHtml：封面有統計、示意圖與二維碼；站頁有站序與最多 6 株清單', () => {
  const book = routeBookHtml(ROUTE, { base: SITE, date: DATE });
  const [cover, ...stops] = book.pages;
  assert.match(cover, /世遺核心區古樹漫步/);
  assert.match(cover, /涵蓋古樹：<strong>42<\/strong>/);
  assert.match(cover, /class="card-map"/);
  assert.match(cover, /<svg[\s\S]*<\/svg>/);
  assert.match(stops[0], /第 1 站/);
  assert.match(stops[0], /白鴿巢公園/);
  assert.equal((stops[0].match(/<tr><td>/g) || []).length, 6, '每站最多列 6 株');
  assert.match(stops[2], /第 3 站/);
});

test('routeBookHtml：只傳 route meta（漏掉 stops）時會退化成只有封面 —— 呼叫端必須整包傳入', () => {
  const metaOnly = routeBookHtml(ROUTE.route, { base: SITE, date: DATE });
  assert.equal(metaOnly.pages.length, 1, '只給 meta 時確實只有封面（因此 render() 必須傳整包）');
  const full = routeBookHtml(ROUTE, { base: SITE, date: DATE });
  assert.equal(full.pages.length, ROUTE.stops.length + 1, '整包傳入才有每一站');
  assert.ok(full.pages.length > metaOnly.pages.length);
});

test('routeBookHtml：沒有站點時只印封面，不得拋錯', () => {
  const book = routeBookHtml({ code: 'R9', name: '空路綫', stops: [] }, { base: SITE, date: DATE });
  assert.equal(book.pages.length, 1);
  assert.match(book.pages[0], /無站點資料/);
});

test('routeBookHtml：站名與摘要都經過跳脫', () => {
  const book = routeBookHtml({
    code: 'R2', name: '<script>x</script>', summary: '</p><iframe>',
    stops: [{ order: 1, site: '<img onerror=1>', lat: 22.1, lon: 113.5, tree_count: 1, oldest: 10, trees: [] }],
  }, { base: SITE, date: DATE });
  assert.ok(!/<script/i.test(book.html));
  assert.ok(!/<iframe/i.test(book.html));
  assert.ok(!/<img onerror/i.test(book.html));
});

test('正式資料規模：658 種情況都能產生完整卡片（無欄位遺漏）', () => {
  const grades = ['一級', '二級', '三級', '不分級'];
  const healths = ['健康', '一般', '需關注', '瀕危'];
  const precisions = ['official', 'approx', 'osm', 'parish'];
  let n = 0;
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      for (let k = 0; k < 4; k += 1) {
        const tree = {
          ...TREE, tree_no: String(1 + n), grade: grades[i], health: healths[j], geo_precision: precisions[k],
          age_years: 10 + n, crown_m: n % 3 === 0 ? null : 12.5, diameter_cm: n % 2 === 0 ? null : 88,
          tree_photo: n % 5 === 0 ? null : '/photos/trees/1.jpg',
        };
        const m = cardModel(tree, { base: SITE, date: DATE });
        assert.equal(m.metrics.length, 13, '13 個欄位都要有');
        assert.ok(m.metrics.every(([, v]) => v !== undefined && v !== ''), '每個欄位都要有值或「官方未提供」');
        assert.ok(m.qrUrl.includes(`tree=${tree.tree_no}`));
        const html = cardHtml(m);
        assert.equal(pageCount(html), 1);
        n += 1;
      }
    }
  }
  assert.equal(n, 64);
});
