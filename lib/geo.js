/**
 * 地理運算與路綫推薦演算法
 *
 * 路綫推薦採用兩階段啟發式：
 *   1. 以最小樹齡／健康風險／稀有度計算每個候選點的「造訪優先度」
 *   2. 最近鄰法（nearest neighbour）建立初始路徑，再以 2-opt 反覆改良
 * 目標函數為總步行距離，輸出停靠次序、距離與時間估計。
 */

export const EARTH_R = 6371008.8; // 公尺（IUGG 平均地球半徑）

const rad = (d) => (d * Math.PI) / 180;

/** 兩點球面距離（公尺） */
export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 以「路線參考點」為中心，帶入小型投影，回傳點在 30 公里內誤差 <1% 的公里座標 */
function project(points) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const kx = 111.32 * Math.cos(rad(lat0));
  return points.map((p) => ({ x: p.lon * kx, y: p.lat * 110.574 }));
}

/** 全部點兩兩距離矩陣（公尺） */
export function distanceMatrix(points) {
  const n = points.length;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = haversine(points[i].lat, points[i].lon, points[j].lat, points[j].lon);
      m[i][j] = d; m[j][i] = d;
    }
  }
  return m;
}

export function pathLength(order, D) {
  let total = 0;
  for (let i = 0; i + 1 < order.length; i += 1) total += D[order[i]][order[i + 1]];
  return total;
}

/** 最近鄰法：由起點出發，每次前往最近的未造訪點 */
export function nearestNeighbour(D, start = 0) {
  const n = D.length;
  const visited = new Array(n).fill(false);
  const order = [start];
  visited[start] = true;
  for (let step = 1; step < n; step += 1) {
    const last = order[order.length - 1];
    let best = -1, bestD = Infinity;
    for (let j = 0; j < n; j += 1) {
      if (!visited[j] && D[last][j] < bestD) { bestD = D[last][j]; best = j; }
    }
    if (best < 0) break;
    visited[best] = true;
    order.push(best);
  }
  return order;
}

/** 2-opt 改良：反覆反轉子路徑直到無法再縮短（或達迭代上限） */
export function twoOpt(order, D, maxIter = 4000) {
  let best = [...order];
  let bestLen = pathLength(best, D);
  let improved = true, iter = 0;
  while (improved && iter < maxIter) {
    improved = false;
    for (let i = 1; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        iter += 1;
        const a = best[i - 1], b = best[i], c = best[j], d = best[j + 1];
        const delta = (D[a][c] + (d === undefined ? 0 : D[b][d]))
                    - (D[a][b] + (d === undefined ? 0 : D[c][d]));
        if (delta < -1e-9) {
          const next = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
          const len = pathLength(next, D);
          if (len < bestLen - 1e-9) {
            best = next; bestLen = len; improved = true;
          }
        }
        if (iter >= maxIter) break;
      }
      if (iter >= maxIter) break;
    }
  }
  return { order: best, length: bestLen, iterations: iter };
}

/** 起點選擇：對每個候選起點跑最近鄰＋2-opt，取總距離最短者 */
export function solveRoute(points, opts = {}) {
  if (points.length === 0) return { order: [], distance_m: 0, legs: [] };
  if (points.length === 1) return { order: [0], distance_m: 0, legs: [] };
  const D = distanceMatrix(points);
  const starts = opts.starts || [...new Set([0, Math.floor(points.length / 2), points.length - 1])];
  let best = null;
  for (const s of starts) {
    const nn = nearestNeighbour(D, s);
    const t = twoOpt(nn, D);
    if (!best || t.length < best.length) best = { ...t, start: s };
  }
  const legs = [];
  for (let i = 0; i + 1 < best.order.length; i += 1) {
    const a = points[best.order[i]], b = points[best.order[i + 1]];
    legs.push({
      from: a.id ?? a.tree_no ?? best.order[i],
      to: b.id ?? b.tree_no ?? best.order[i + 1],
      distance_m: Math.round(D[best.order[i]][best.order[i + 1]]),
      bearing: bearing(a, b),
      straight_line_m: Math.round(haversine(a.lat, a.lon, b.lat, b.lon)),
    });
  }
  return {
    order: best.order,
    distance_m: Math.round(best.length),
    start_index: best.start,
    legs,
    matrix_size: points.length,
  };
}

/** 方位角（度，0 = 北） */
export function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat))
    - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function bearingLabel(deg) {
  const dirs = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
  return dirs[Math.round(((deg + 360) % 360) / 45) % 8];
}

/**
 * 步行時間估計：以 Naismith 法則的平地速度 4.2 km/h，
 * 並對每段加上固定停留時間（觀賞／拍照）。
 */
export function walkEstimate(distanceM, stops, opts = {}) {
  const speedKmh = opts.speedKmh ?? 4.2;
  const dwellSec = opts.dwellSec ?? 180;
  const walkMin = (distanceM / 1000 / speedKmh) * 60;
  const dwellMin = stops * dwellSec / 60;
  return {
    speed_kmh: speedKmh,
    dwell_min_per_stop: dwellSec / 60,
    walk_min: Math.round(walkMin),
    dwell_min: Math.round(dwellMin),
    total_min: Math.round(walkMin + dwellMin),
    total_km: +(distanceM / 1000).toFixed(2),
  };
}

/** 簡化折線（Douglas–Peucker 會過度複雜，這裡改用距離門檻下採樣） */
export function simplify(points, minGapM = 8) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || haversine(last.lat, last.lon, p.lat, p.lon) >= minGapM) out.push(p);
  }
  return out;
}

/** 依座標做「最近地點分群」：把同一地點的多株古樹合併為一個停靠點 */
export function clusterStops(trees, radiusM = 120) {
  const clusters = [];
  for (const t of trees) {
    if (t.lat == null || t.lon == null) continue;
    let found = clusters.find((c) => haversine(c.lat, c.lon, t.lat, t.lon) <= radiusM);
    if (!found) {
      found = { lat: t.lat, lon: t.lon, trees: [] };
      clusters.push(found);
    }
    found.trees.push(t);
  }
  for (const c of clusters) {
    c.lat = c.trees.reduce((s, t) => s + t.lat, 0) / c.trees.length;
    c.lon = c.trees.reduce((s, t) => s + t.lon, 0) / c.trees.length;
    c.trees.sort((a, b) => b.age_years - a.age_years);
  }
  return clusters;
}

/**
 * 依資料特性計算「推薦優先度」：樹齡高、健康風險高、品種在該區稀有 → 優先造訪
 */
export function priorityScore(tree, extras = {}) {
  const age = Math.min(tree.age_years / 520, 1);
  const risk = { 瀕危: 1, 一般: 0.5, 健康: 0.15 }[tree.health] ?? 0.2;
  const rarity = extras.speciesCount ? 1 / Math.sqrt(extras.speciesCount) : 0.3;
  const grade = { 一級: 1, 二級: 0.75, 三級: 0.4, 不分級: 0.3 }[tree.grade] ?? 0.3;
  return 0.45 * age + 0.2 * risk + 0.2 * rarity + 0.15 * grade;
}
