/**
 * 政策型設計方案（課程研究的設計方案部分）的資料層存取 —— 純函式，不碰網路與資料庫。
 *
 * 為什麼要做成 API 而不是把內容寫死在頁面裡：
 *   1. 每一項政策、數字與行動都要附出處，來源索引由後端統一組好（前端不重複抄網址）；
 *   2. 資料層可以單獨測試（tests/policy.test.js 驗「每項都有出處、沒有空的行動」）；
 *   3. 列印用的 A4 方案摘要與網頁共用同一份資料，兩邊不會講不一樣的話。
 *
 * 【誠實原則】官方查不到的一律寫進 gaps，不臆造、不用鄰近地區數字代替。
 */
import { POLICY, POLICY_HASH } from '../data/policy-data.js';

export const policyHash = () => POLICY_HASH;

/** 來源清單（給前端與列印頁的來源索引；照 sources[] 原順序） */
export function sourcesList() {
  return (POLICY.sources || []).map((s) => ({ ...s }));
}

/** 來源索引：id → { id, title, publisher, date, url } */
export function sourcesIndex() {
  const out = {};
  for (const s of POLICY.sources || []) out[s.id] = s;
  return out;
}

/** 把條目裡的 source id 換成完整來源物件（找不到就標成「來源索引缺漏」，讓測試與畫面都能發現） */
function withSource(item, index) {
  const id = item.source || null;
  const found = id ? index[id] : null;
  // 行動項目還可能引用多條政策依據（basis[]），一樣解析成完整來源物件，
  // 讓畫面不必自己查表，也讓測試能一次抓出「引用了不存在的來源」。
  const basis = (item.basis || []).map((b) => (typeof b === 'string' ? b : b && b.id));
  return {
    ...item,
    source_id: id,
    source: found || null,
    source_missing: Boolean(id) && !found,
    basis_ids: basis,
    basis_sources: basis.map((b) => index[b] || { id: b, missing: true }),
    basis_missing: basis.filter((b) => !index[b]),
  };
}

function decorate(direction, index) {
  return {
    ...direction,
    policies: (direction.policies || []).map((p) => withSource(p, index)),
    actions: (direction.actions || []).map((a) => withSource(a, index)),
    evidence: (direction.evidence || []).map((e) => withSource(e, index)),
  };
}

/** 目錄（不含內文細節）：方向、每個方向的政策數／行動數 */
export function directions() {
  return POLICY.directions.map((d) => ({
    id: d.id,
    name: d.name,
    goal: d.goal,
    policy_count: (d.policies || []).length,
    action_count: (d.actions || []).length,
  }));
}

/** 單一方向的完整內容；找不到回 null（路由層轉 404） */
export function directionById(id) {
  const want = String(id == null ? '' : id).trim();
  const hit = POLICY.directions.find((d) => d.id === want);
  return hit ? decorate(hit, sourcesIndex()) : null;
}

/** 全部方向（含內文）；`?all=1` 用 */
export function allDirections() {
  const index = sourcesIndex();
  return POLICY.directions.map((d) => decorate(d, index));
}

/** 誠實卡：官方查不到的、以及本站做不到的 */
export function gaps() {
  return (POLICY.gaps || []).map((g) => withSource(g, sourcesIndex()));
}

/** 頁首用的統計與方法說明 */
export function summary() {
  const index = sourcesIndex();
  const dirs = allDirections();
  return {
    hash: POLICY_HASH,
    direction_count: dirs.length,
    policy_count: dirs.reduce((n, d) => n + d.policies.length, 0),
    action_count: dirs.reduce((n, d) => n + d.actions.length, 0),
    source_count: Object.keys(index).length,
    gap_count: gaps().length,
    directions: dirs.map((d) => ({ id: d.id, name: d.name, goal: d.goal,
      policy_count: d.policies.length, action_count: d.actions.length })),
    missing_sources: [...dirs.flatMap((d) => [...d.policies, ...d.actions, ...d.evidence]),
      ...gaps()].filter((x) => x.source_missing).map((x) => x.source_id),
    missing_basis: dirs.flatMap((d) => d.actions).flatMap((a) => a.basis_missing || []),
    method: {
      scope: '以澳門現行政策與法規為依據，提出可切實執行的行動；每一項都標明主管單位、期程與可量測指標。',
      honesty: '官方查不到的一律列在「本頁沒有的東西」，不臆造、不用鄰近地區數字代替。',
      data: '行動的優先順序以本站 658 株古樹的官方資料（官方健康狀況、官方分級、樹齡、區位風險）為依據。',
    },
  };
}
