/**
 * GPS 誤差半徑比對（v0.15.0）測試
 *   1. 判定規則：距離在比對半徑內 → ok；超出 → far；定位精度太差 → weak；缺座標 → unknown
 *   2. 前後端同一套門檻（前端不能 import 後端的 lib/，是刻意的複製，因此要用測試綁住）
 *   3. 三處一致：前端欄位名／後端驗證值域／資料庫 CHECK
 *   4. 前端接線：定位按鈕、隱藏欄位、CSV 欄位、紀錄列的「位置比對」
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { gpsVerdict, GPS_MATCH_RADIUS_M, GPS_ACCURACY_LIMIT_M, haversine } from '../lib/geo.js';
import { normalizeFieldRecord, GPS_LIMITS, SCHEMA_PROBES } from '../lib/repo.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// 參考點：白鴿巢公園古樹一帶（約 22.2050, 113.5410）
const TREE = { treeLat: 22.2050, treeLon: 113.5410 };

/** 把參考點往北推 d 公尺（1 度緯度 ≈ 111,320 公尺） */
const north = (m) => TREE.treeLat + m / 111320;

test('距離在比對半徑內 → ok（並且回報距離與精度）', () => {
  const v = gpsVerdict({ ...TREE, lat: north(5), lon: TREE.treeLon, accuracy: 8 });
  assert.equal(v.status, 'ok');
  assert.equal(v.distance_m, 5);
  assert.equal(v.accuracy_m, 8);
  assert.equal(v.radius_m, 30);
  assert.match(v.message, /位置相符/);
  assert.match(v.message, /5 公尺/);
});

test('邊界：正好 30 公尺算相符、31 公尺算可能不是這一株', () => {
  assert.equal(gpsVerdict({ ...TREE, lat: north(30), lon: TREE.treeLon, accuracy: 5 }).status, 'ok');
  const far = gpsVerdict({ ...TREE, lat: north(31), lon: TREE.treeLon, accuracy: 5 });
  assert.equal(far.status, 'far');
  assert.equal(far.distance_m, 31);
  assert.match(far.message, /可能不是這一株/);
});

test('定位精度比門檻差 → weak（即使距離很近也不能說相符）', () => {
  const v = gpsVerdict({ ...TREE, lat: north(3), lon: TREE.treeLon, accuracy: 80 });
  assert.equal(v.status, 'weak');
  assert.equal(v.distance_m, 3);
  assert.match(v.message, /僅供參考/);
  // 邊界：正好等於門檻仍算可用精度
  assert.equal(gpsVerdict({ ...TREE, lat: north(3), lon: TREE.treeLon, accuracy: GPS_ACCURACY_LIMIT_M }).status, 'ok');
  assert.equal(gpsVerdict({ ...TREE, lat: north(3), lon: TREE.treeLon, accuracy: GPS_ACCURACY_LIMIT_M + 1 }).status, 'weak');
});

test('缺座標 → unknown，並說清楚缺的是哪一邊', () => {
  const noTree = gpsVerdict({ treeLat: null, treeLon: null, lat: 22.2, lon: 113.5, accuracy: 5 });
  assert.equal(noTree.status, 'unknown');
  assert.equal(noTree.distance_m, null);
  assert.match(noTree.message, /官方資料沒有這一株的座標/);

  const noField = gpsVerdict({ ...TREE, lat: null, lon: null });
  assert.equal(noField.status, 'unknown');
  assert.match(noField.message, /還沒有現場座標/);
});

test('沒有精度資訊時仍可比對距離（只是訊息不提精度）', () => {
  const v = gpsVerdict({ ...TREE, lat: north(10), lon: TREE.treeLon, accuracy: null });
  assert.equal(v.status, 'ok');
  assert.equal(v.accuracy_m, null);
  assert.ok(!v.message.includes('精度'));
  // 空字串（表單原始值）也要當成沒有精度，不能變成 0
  assert.equal(gpsVerdict({ ...TREE, lat: north(10), lon: TREE.treeLon, accuracy: '' }).accuracy_m, null);
});

test('前後端門檻與距離公式必須一致（前端是刻意的複製，用測試綁住）', () => {
  const geo = read('lib/geo.js');
  const field = read('public/js/field.js');
  assert.equal(GPS_MATCH_RADIUS_M, 30);
  assert.equal(GPS_ACCURACY_LIMIT_M, 50);
  for (const [name, value] of [['GPS_MATCH_RADIUS_M', 30], ['GPS_ACCURACY_LIMIT_M', 50]]) {
    assert.match(geo, new RegExp(`${name} = ${value}`), `lib/geo.js 的 ${name} 應為 ${value}`);
  }
  // 前端用同名概念（GPS_RADIUS_M／GPS_ACCURACY_LIMIT_M），數值必須一樣
  assert.match(field, /const GPS_RADIUS_M = 30;/);
  assert.match(field, /const GPS_ACCURACY_LIMIT_M = 50;/);
  // 同一個地球半徑與球面距離公式（兩邊都用 IUGG 平均半徑，不能一邊 6371 一邊 6371008.8）
  assert.match(field, /6371008\.8/);
  assert.match(geo, /EARTH_R = 6371008\.8/);
  assert.match(field, /Math\.asin\(Math\.min\(1, Math\.sqrt\(a\)\)\)/);
  assert.match(geo, /Math\.asin\(Math\.min\(1, Math\.sqrt\(a\)\)\)/);
  // 四種狀態的名稱兩邊都要有（前端要決定顏色）
  for (const s of ['ok', 'far', 'weak', 'unknown']) {
    assert.ok(field.includes(`'${s}'`), `前端缺少狀態 ${s}`);
  }
});

test('三處一致：後端值域 ↔ 資料庫 CHECK ↔ 前端欄位名', () => {
  assert.equal(GPS_LIMITS.accuracy_m, 1000);
  assert.equal(GPS_LIMITS.distance_m, 100000);
  const schema = read('supabase/schema.sql');
  const init = read('supabase/init.sql');
  for (const sql of [schema, init]) {
    assert.match(sql, /gps_accuracy_m/);
    assert.match(sql, /gps_distance_m/);
    assert.match(sql, /gps_accuracy_m >= 0 and gps_accuracy_m <= 1000/);
    assert.match(sql, /gps_distance_m >= 0 and gps_distance_m <= 100000/);
  }
  assert.match(schema, /constraint field_records_gps_check/);
  const field = read('public/js/field.js');
  assert.match(field, /name="gps_accuracy_m"/);
  assert.match(field, /name="gps_distance_m"/);
});

test('後端驗證：合法值通過、超界擋下並說出範圍、空字串存 null', () => {
  const ok = normalizeFieldRecord({
    observer: '高二丙 15 號', tree_no: '66', gps_accuracy_m: '8.4', gps_distance_m: '12',
  });
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.record.gps_accuracy_m, 8.4);
  assert.equal(ok.record.gps_distance_m, 12);

  const empty = normalizeFieldRecord({ observer: '高二丙 15 號', gps_accuracy_m: '', gps_distance_m: '' });
  assert.equal(empty.errors.length, 0);
  assert.equal(empty.record.gps_accuracy_m, null);
  assert.equal(empty.record.gps_distance_m, null);

  const bad = normalizeFieldRecord({ observer: '高二丙 15 號', gps_accuracy_m: '5000', gps_distance_m: '-3' });
  assert.equal(bad.errors.length, 2);
  assert.ok(bad.errors.some((e) => e.includes('GPS 定位精度')));
  assert.ok(bad.errors.some((e) => e.includes('與官方座標的距離')));
});

test('前端接線：定位按鈕會比對、精度與距離都會被記錄、CSV 與紀錄列都看得到', () => {
  const field = read('public/js/field.js');
  assert.match(field, /enableHighAccuracy: true/);
  assert.match(field, /Math\.round\(pos\.coords\.accuracy\)/);       // 定位精度要記下來
  assert.match(field, /gps_distance_m/);                             // 距離寫進表單
  assert.match(field, /定位精度公尺: r\.gps_accuracy_m/);            // CSV 欄位
  assert.match(field, /與官方座標距離公尺: r\.gps_distance_m/);
  assert.match(field, /<th>位置比對<\/th>/);                          // 紀錄清單有這一欄
  assert.match(field, /function refreshGps\(\)/);
  assert.match(field, /用目前位置比對樹木位置/);
  // 官方座標是比對基準：必須從 /api/tree 取得的資料帶入
  assert.match(field, /currentTree = tree;/);
  assert.match(field, /treeLat: currentTree \? currentTree\.lat : null/);
});

test('官方查不到座標時不能假裝比對成功（誠實原則）', () => {
  const v = gpsVerdict({ treeLat: null, treeLon: null, lat: 22.2050, lon: 113.5410, accuracy: 5 });
  assert.equal(v.status, 'unknown');
  assert.equal(v.distance_m, null, '沒有官方座標就不該有距離數字');
  // 距離一律四捨五入到公尺，不假裝有小數點精度
  const d = gpsVerdict({ ...TREE, lat: north(123.6), lon: TREE.treeLon, accuracy: 5 });
  assert.equal(d.distance_m, Math.round(haversine(TREE.treeLat, TREE.treeLon, north(123.6), TREE.treeLon)));
});

test('健康檢查的探測欄位要涵蓋前端會寫入的欄位（資料庫沒升級要在健康檢查就看得出來）', () => {
  // 學生在樹下按儲存才發現資料庫沒升級是最糟的情況：健康檢查就要看得出來，
  // 頁首的「資料庫需要升級」橫幅才會提前出現並說明重跑 init.sql。
  const probe = SCHEMA_PROBES.find((p) => p.table === 'field_records');
  assert.ok(probe, '找不到 field_records 的探測項');
  for (const col of ['bark_conditions', 'surround_items', 'concrete_cover', 'photo_paths',
    'gps_accuracy_m', 'gps_distance_m']) {
    assert.ok(probe.columns.includes(col), `健康檢查沒有探測 ${col}`);
  }
});

test('紙本考察單也留有位置比對欄位（現場沒網路時照樣能用）', () => {
  const card = read('public/js/card.js');
  assert.match(card, /現場 GPS 座標/);
  assert.match(card, /定位精度（± 公尺）/);
  assert.match(card, /與官方座標距離（公尺）/);
});
