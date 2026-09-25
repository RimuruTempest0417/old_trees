/**
 * 優先保育名單：評分模型（純函式，可單元測試）
 *
 * 目的：把 658 株古樹依「保育急迫性」排序，讓有限的養護資源先用在最需要的樹上。
 * 五個面向、合計 100 分。每一項都用市政署公開欄位推導，不作人為調整：
 *
 *   樹齡 30｜健康 25｜級別 20｜樹種稀有度 15｜區位風險 10
 *
 * 三個原則（延續本專案既有鐵律）：
 *   1. 只用官方欄位（年齡／健康／級別／胸徑／地點文字），不估算、不補造。
 *   2. 缺值不當 0 分也不當滿分：該項改以「中性」計分並在理由中標明（例如冠幅只有 67 株有值，
 *      因此不列入評分，避免變成「有量測的樹才高分」）。
 *   3. 每株都要說得出「為什麼拿這個分數」：回傳逐項配分與命中理由。
 *
 * 分數是相對排序工具，不是官方認定；畫面上必須同時顯示這個說明。
 *
 * 【分級鐵律】級別一律以官方為準。本站不自行分級、不依樹齡換算級別，
 * 只呈現市政署名錄的 grade（一級／二級／三級／不分級）與 health（健康／一般／瀕危）。
 */

export const PRIORITY_WEIGHTS = { age: 30, health: 25, grade: 20, rarity: 15, risk: 10 };

export const WEIGHT_TOTAL = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * 分數區間（純粹方便閱讀長名單，**不是分級**）。
 *
 * 【鐵律】分級一律以官方為準：本站只顯示市政署名錄的「分級」欄位
 * （一級／二級／三級／不分級）與官方「健康狀況」，不自行創造任何級別名稱、
 * 也不依樹齡自行換算級別。下面是排序分數的閱讀刻度，只是把連續分數切成段落，
 * 名稱刻意避開「級」字，避免與官方分級混淆。
 */
export const SCORE_MARKS = [
  { id: 'm75', min: 75, label: '75 分以上', hint: '老齡／瀕危／稀有／高風險多項同時出現，建議優先安排現地檢查' },
  { id: 'm60', min: 60, label: '60–74 分', hint: '兩項以上偏嚴峻，建議排入年度養護計畫' },
  { id: 'm45', min: 45, label: '45–59 分', hint: '常規巡護與紀錄即可' },
  { id: 'm0', min: 0, label: '45 分以下', hint: '現況相對穩定，維持既有巡護頻率' },
];

/** 取某個分數所屬的閱讀刻度（僅供分組統計，不是官方級別）。 */
export function scoreMark(score) {
  return SCORE_MARKS.find((t) => score >= t.min) || SCORE_MARKS[SCORE_MARKS.length - 1];
}

/** 樹齡：以《古樹名錄》的年齡級距給分（不內插，級距本身就是可解釋的規則）。 */
export function ageScore(age) {
  // 注意：Number(null) === 0、Number('') === 0，光用 Number.isFinite 判斷會把「缺值」
  // 當成「樹齡 0 年」（掉到 <50 年那一階），所以缺值要先單獨攔下來。
  if (age === null || age === undefined || String(age).trim() === '') {
    return { score: 15, note: '官方未提供樹齡（以中性計分）' };
  }
  const a = Number(age);
  if (!Number.isFinite(a)) return { score: 15, note: '官方未提供樹齡（以中性計分）' };
  if (a >= 300) return { score: 30, note: `${a} 年（≥300 年）` };
  if (a >= 200) return { score: 25, note: `${a} 年（200–299 年）` };
  if (a >= 150) return { score: 19, note: `${a} 年（150–199 年）` };
  if (a >= 100) return { score: 13, note: `${a} 年（100–149 年）` };
  if (a >= 50) return { score: 7, note: `${a} 年（50–99 年）` };
  return { score: 3, note: `${a} 年（<50 年）` };
}

/** 健康狀況：越差越急。官方三級（健康／一般／瀕危）。 */
export function healthScore(health) {
  const h = String(health || '').trim();
  if (h === '瀕危') return { score: 25, note: '健康狀況：瀕危' };
  if (h === '一般') return { score: 12, note: '健康狀況：一般' };
  if (h === '健康') return { score: 5, note: '健康狀況：健康' };
  return { score: 12, note: `健康狀況：${h || '官方未提供'}（以中性計分）` };
}

/** 級別：一級／二級／三級／不分級（官方分級）。 */
export function gradeScore(grade) {
  const g = String(grade || '').trim();
  if (g === '一級') return { score: 20, note: '官方級別：一級' };
  if (g === '二級') return { score: 14, note: '官方級別：二級' };
  if (g === '三級') return { score: 6, note: '官方級別：三級' };
  return { score: 0, note: `官方級別：${g || '未分級'}` };
}

/**
 * 樹種稀有度：以同一樹種在名錄中的株數計分。
 * 這一項是「保育遺傳多樣性」的替代理論指標——同一樹種只剩一兩株時，任何一株死亡都是不可逆的損失。
 */
export function rarityScore(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return { score: 8, note: '樹種株數未知（以中性計分）' };
  if (n === 1) return { score: 15, note: '全澳名錄僅此 1 株' };
  if (n <= 3) return { score: 12, note: `全澳名錄僅 ${n} 株` };
  if (n <= 10) return { score: 9, note: `全澳名錄 ${n} 株` };
  if (n <= 30) return { score: 6, note: `全澳名錄 ${n} 株` };
  if (n <= 100) return { score: 3, note: `全澳名錄 ${n} 株` };
  return { score: 1, note: `全澳名錄 ${n} 株（常見樹種）` };
}

/**
 * 區位風險：由官方「地點」文字推斷該株承受的人為壓力。
 * 高風險＝車道旁／人流密集／工程與設施周邊（修剪、碰撞、鋪面施工最常發生在這些地方）；
 * 低風險＝郊野、山徑、海灘等干擾較少的環境。文字無法辨識時以中性計分。
 */
export const RISK_RULES = [
  {
    level: 'high', score: 10, label: '高',
    words: ['大馬路', '馬路', '圓形地', '行車天橋', '口岸', '碼頭', '總站', '停車場', '車場',
      '酒店', '泳池', '醫院', '學校', '狗房', '公司', '工廠', '工業', '街市', '市場',
      '治安警察', '消防', '球場', '渡輪'],
  },
  {
    level: 'low', score: 3, label: '低',
    words: ['郊野公園', '步行徑', '環山徑', '行山', '海灘', '沙灘', '農場', '水塘', '墳場', '聖堂', '教堂'],
  },
  {
    level: 'mid', score: 6, label: '中',
    words: ['前地', '廣場', '公園', '花園', '休憩區', '眺望台', '圖書館', '村', '廟', '堂',
      '街', '巷', '圍', '里', '山', '台'],
  },
];
export const RISK_NEUTRAL = { level: 'mid', score: 6, label: '中', matched: [], note: '地點文字無法判別（以中性計分）' };

export function riskOf(loc) {
  const s = String(loc || '').trim();
  if (!s) return { ...RISK_NEUTRAL };
  for (const rule of RISK_RULES) {
    const hit = rule.words.filter((w) => s.includes(w));
    if (hit.length) {
      return {
        level: rule.level, score: rule.score, label: rule.label, matched: hit,
        note: `地點「${s}」含「${hit.join('、')}」`,
      };
    }
  }
  return { ...RISK_NEUTRAL, note: `地點「${s}」未命中既有分類（以中性計分）` };
}

/** 統計每個樹種的株數，供稀有度計分。 */
export function speciesCounts(trees) {
  const m = new Map();
  for (const t of trees || []) {
    const key = String((t && (t.species || t.species_zh)) || '').trim() || '（未提供樹種）';
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

/**
 * 單株評分。回傳分數、等級、逐項配分與理由；不修改輸入。
 * @param {object} tree 需含 age_years / health / grade / species / official_loc（或 loc）/ tree_no / diameter_cm
 * @param {{counts: Map<string, number>}} ctx
 */
export function scoreTree(tree, ctx = {}) {
  const counts = ctx.counts instanceof Map ? ctx.counts : speciesCounts(ctx.trees || []);
  const species = String((tree && (tree.species || tree.species_zh)) || '').trim();
  const loc = (tree && (tree.official_loc || tree.loc)) || '';
  const age = ageScore(tree && tree.age_years);
  const health = healthScore(tree && tree.health);
  const grade = gradeScore(tree && tree.grade);
  const rarity = rarityScore(species ? counts.get(species) : 0);
  const risk = riskOf(loc);
  const diameter = Number(tree && tree.diameter_cm);
  const parts = { age, health, grade, rarity, risk };
  const score = Math.round(age.score + health.score + grade.score + rarity.score + risk.score);
  // 主要理由：挑出配分相對高的三項（同分時依權重順序），讓清單一眼看得出為什麼
  const order = ['age', 'health', 'grade', 'rarity', 'risk'];
  const reasons = order.map((k) => ({ key: k, ...parts[k] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => `${r.note}（${r.score} 分）`);
  return {
    tree_no: (tree && tree.tree_no != null) ? String(tree.tree_no) : '',
    species,
    parish: (tree && tree.parish) || '',
    loc: String(loc),
    age_years: Number.isFinite(Number(tree && tree.age_years)) ? Number(tree.age_years) : null,
    health: (tree && tree.health) || '',
    grade: (tree && tree.grade) || '',
    diameter_cm: Number.isFinite(diameter) ? diameter : null,
    score: Math.min(100, Math.max(0, score)),
    // 注意：這裡刻意不回傳任何「級」欄位。級別只有官方資料（grade／health）能決定。
    parts: {
      age: age.score, health: health.score, grade: grade.score, rarity: rarity.score, risk: risk.score,
    },
    risk_level: risk.level,
    risk_note: risk.note,
    reasons,
    lat: Number.isFinite(Number(tree && tree.lat)) ? Number(tree.lat) : null,
    lon: Number.isFinite(Number(tree && tree.lon)) ? Number(tree.lon) : null,
  };
}

/**
 * 全部排序。名次規則（寫進介面與報告，避免「為什麼它在前面」的爭議）：
 *   分數高者在前 → 同分時樹齡高者在前 → 再同則樹號小者在前（純粹為了結果穩定可重現）。
 */
export function rankTrees(trees, ctx = {}) {
  const counts = ctx.counts instanceof Map ? ctx.counts : speciesCounts(trees);
  const scored = (trees || []).map((t) => scoreTree(t, { counts }));
  scored.sort((a, b) => (b.score - a.score)
    || ((b.age_years || 0) - (a.age_years || 0))
    || (String(a.tree_no).localeCompare(String(b.tree_no), 'en', { numeric: true })));
  return scored.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** 依條件篩選（提供給 API 與前端共用同一套語意）。 */
export function filterRanked(rows, { grade, health, parish, species, q, limit } = {}) {
  let out = rows;
  // 篩選一律用官方欄位：分級（grade）與健康狀況（health）。
  if (grade) {
    const want = String(grade).split(',').map((s) => s.trim()).filter(Boolean);
    out = out.filter((r) => want.includes(r.grade));
  }
  if (health) {
    const want = String(health).split(',').map((s) => s.trim()).filter(Boolean);
    out = out.filter((r) => want.includes(r.health));
  }
  if (parish) out = out.filter((r) => r.parish === parish);
  if (species) out = out.filter((r) => r.species === species);
  if (q) {
    const key = String(q).trim();
    out = out.filter((r) => r.tree_no === key || r.species.includes(key) || r.loc.includes(key));
  }
  const n = Number(limit);
  if (Number.isFinite(n) && n > 0) out = out.slice(0, n);
  return out;
}

/** 摘要統計（KPI 卡用）。分數段落只作閱讀分組；級別統計一律用官方欄位。 */
export function prioritySummary(rows) {
  const byScore = {};
  for (const t of SCORE_MARKS) byScore[t.id] = 0;
  const byGrade = {};
  const byHealth = {};
  let sum = 0;
  for (const r of rows || []) {
    byScore[scoreMark(r.score).id] += 1;
    if (r.grade) byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
    if (r.health) byHealth[r.health] = (byHealth[r.health] || 0) + 1;
    sum += r.score;
  }
  const n = (rows || []).length;
  const top = n ? rows[0] : null;
  return {
    evaluated: n,
    by_score: byScore,
    by_grade: byGrade,
    by_health: byHealth,
    mean_score: n ? +(sum / n).toFixed(1) : 0,
    top: top ? { tree_no: top.tree_no, species: top.species, score: top.score, grade: top.grade, health: top.health, age_years: top.age_years } : null,
  };
}

/** 評分方法說明（介面與報告都直接引用這份，避免兩處說法不一致）。 */
export function methodDoc() {
  return {
    weights: PRIORITY_WEIGHTS,
    total: WEIGHT_TOTAL,
    steps: [
      { key: 'age', name: '樹齡', weight: PRIORITY_WEIGHTS.age, rule: '≥300 年 30 分／200–299 年 25 分／150–199 年 19 分／100–149 年 13 分／50–99 年 7 分／<50 年 3 分' },
      { key: 'health', name: '健康狀況', weight: PRIORITY_WEIGHTS.health, rule: '瀕危 25 分／一般 12 分／健康 5 分' },
      { key: 'grade', name: '官方級別', weight: PRIORITY_WEIGHTS.grade, rule: '一級 20 分／二級 14 分／三級 6 分／不分級 0 分' },
      { key: 'rarity', name: '樹種稀有度', weight: PRIORITY_WEIGHTS.rarity, rule: '名錄僅 1 株 15 分／2–3 株 12 分／4–10 株 9 分／11–30 株 6 分／31–100 株 3 分／>100 株 1 分' },
      { key: 'risk', name: '區位風險', weight: PRIORITY_WEIGHTS.risk, rule: '車道／人流與設施周邊 10 分／公園、前地、街巷 6 分／郊野、山徑、海灘 3 分（依官方地點文字判別）' },
    ],
    marks: SCORE_MARKS,
    tie_break: '分數高者在前；同分時樹齡高者在前；再同則樹號小者在前。',
    grading_policy: '分級一律以官方為準：本站只呈現市政署名錄的「分級」（一級／二級／三級／不分級）與官方「健康狀況」，不自行分級、不依樹齡換算級別；分數只是排序工具，不會改變任何一株的官方級別。',
    caveats: [
      '冠幅官方僅 67 株有值，因此不列入評分（避免變成「有量測的樹才高分」）。',
      '分數是本平台的相對排序工具，不是市政署的官方認定；名單上的「分級」與「健康狀況」才是官方資料。',
      '區位風險以「地點名稱文字」推斷，只能反映概略環境，不等於現場危害評估。',
      '分數段落（75／60／45 分）只是為了讓人讀長名單，不是級別，也不對應任何官方分類。',
    ],
  };
}

export default {
  PRIORITY_WEIGHTS, WEIGHT_TOTAL, SCORE_MARKS, scoreMark, ageScore, healthScore, gradeScore,
  rarityScore, riskOf, RISK_RULES, speciesCounts, scoreTree, rankTrees, filterRanked,
  prioritySummary, methodDoc,
};
