/**
 * 優先保育「行動建議」——由官方資料推導的規則式建議清單（v0.16.0）
 *
 * 【為什麼用規則而不是 AI 生成】
 * 建議行動會影響「先去看哪一株、先做什麼」，因此每一條都必須能回答：
 *   （1）依據哪一項官方資料？（2）為什麼這一株要做？（3）出處是什麼？
 * 這三件事只有規則式寫法講得清楚——同一個條件永遠得到同一個建議，
 * 學校與市政署拿同一份清單可以得到同一個結論，也不會出現「聽起來很合理但沒有依據」的建議。
 *
 * 【不是官方工程建議】
 * 這裡輸出的是「巡查與資料整理的優先順序」，不是樹木醫學診斷、也不是施工方案。
 * 真正的處置（修剪、支撐、土壤改良）必須由具職權的公共部門與專業人員評估後決定——
 * 第11/2013號法律第一百零六條也把維護與處置的權責放在權利人與具職權維護樹木的公共部門身上。
 */

/** 建議時程的排序權重（緊急的排前面） */
export const URGENCY_ORDER = ['立即處理', '今年內', '持續追蹤'];

/**
 * 規則清單：每一條包含
 *   id      穩定的識別碼（前端／CSV／列印共用）
 *   label   建議行動
 *   urgency 建議時程
 *   basis   出處（官方文件或本站可回溯的統計）
 *   why     依這一株的資料說明「為什麼」（純函式，回傳字串；無值時回 null 代表不適用）
 */
export const ACTION_RULES = [
  {
    id: 'rescue',
    label: '排入專家複查與搶救復壯評估',
    urgency: '立即處理',
    basis: '《澳門古樹名木養護指引》：「巡查養護」與「搶救復壯」並列為古樹名木保護工作的兩大核心；第11/2013號法律第一百零六條第五款禁止毀損古樹名木',
    why: (t) => (t.health === '瀕危' ? '官方健康狀況為「瀕危」' : null),
  },
  {
    id: 'risk-watch',
    label: '加做落枝風險評估、設現場告示並加密巡查',
    urgency: '立即處理',
    basis: '市政署樹木管理系統以「每年不少於一次的樹木檢查」記錄生長狀況與病蟲害（立法會質詢答覆，2026年9月）；《澳門古樹名木養護指引》巡查監測 11 項含「周邊環境安全」',
    // 「區位風險高」是優先保育評分的其中一項（近馬路／人流密集等），
    // 但高風險共 178 株——真正要「立即」處理的是其中分數也高（≥75）的那一群，其餘留給例行巡查。
    why: (t) => (t.risk_level === 'high' && Number(t.score) >= 75
      ? `區位風險高（${t.risk_note || '近馬路或人流密集處'}）且優先保育分數 ${t.score} 分`
      : null),
  },
  {
    id: 'support',
    label: '樹體支撐、樹穴與立地環境改善評估',
    urgency: '今年內',
    basis: '《澳門古樹名木養護指引》巡查監測 11 項含「樹體損壞」「立地環境」「營養」；樹穴土壤壓實與排水不良是都市老樹常見問題',
    why: (t) => (Number(t.age_years) >= 300 ? `樹齡 ${t.age_years} 年，樹體負荷與立地條件需個別評估` : null),
  },
  {
    id: 'legal-mark',
    label: '檢視法定保護牌、圍欄與解說牌是否完整',
    urgency: '今年內',
    basis: '第11/2013號法律第一百零六條第五款、第六款：禁止拔除、砍伐、毀損或移植名錄所載古樹名木（重大公共利益或預防危害公眾安全者除外）',
    why: (t) => (t.grade === '一級' || t.grade === '二級' ? `官方分級為「${t.grade}」` : null),
  },
  {
    id: 'annual-check',
    label: '維持每年至少一次樹體檢查並登錄系統',
    urgency: '持續追蹤',
    basis: '市政署樹木管理系統「透過每年不少於一次的樹木檢查」輸入樹種位置、影像、生長狀況、病蟲害與養護措施（立法會質詢答覆，2026年9月）',
    why: (t) => (t.health === '一般' && Number(t.score) >= 60 ? '官方健康狀況「一般」且優先保育分數 60 分以上' : null),
  },
  {
    id: 'measure-crown',
    label: '現場量測冠幅並補登官方缺漏欄位',
    urgency: '今年內',
    basis: '本站統計：市政署官方資料僅 67 株（658 株中的 10.2%）有冠幅值，其餘為缺漏，不內插、不推估',
    why: (t) => (t.crown_m == null ? '官方冠幅值缺漏，無法做樹冠與遮蔭評估' : null),
  },
  {
    id: 'photo',
    label: '補拍全株照與樹幹特寫，補齊官方照片',
    urgency: '今年內',
    basis: '本站統計：658 株中 657 株有可用的市政署官方照片（1 株的原始影像已下架）；缺照片的個體目前以樹種相片代替',
    why: (t) => (t.photo_missing ? '官方照片缺漏' : null),
  },
  {
    id: 'gps-fix',
    label: '以手機 GPS 校正座標並記錄精度',
    urgency: '今年內',
    basis: '市政署「澳門自然網」逐株公開資料附座標精度分級（逐株實測／近似值／堂區中心）；本站實地考察表單已內建「與官方座標比對」工具',
    why: (t) => (t.geo_precision && t.geo_precision !== 'official' ? `官方座標精度為「${t.geo_precision}」而非逐株實測` : null),
  },
  {
    id: 'rare-mother',
    label: '列入稀有母樹保護與種子採集評估',
    urgency: '持續追蹤',
    basis: '本站統計：全澳 658 株分屬 56 個樹種，其中僅有個位數株數的樹種一旦個體死亡即失去本地族群（官方資料，不另做推估）',
    why: (t) => (Number(t.species_count) > 0 && Number(t.species_count) <= 3 ? `全澳同種僅 ${t.species_count} 株` : null),
  },
  {
    id: 'heritage-route',
    label: '納入文化導覽路線與解說點，讓公眾看得見',
    urgency: '持續追蹤',
    basis: '第4/2024號行政法規《「澳門歷史城區」保護及管理計劃》要求保留名錄樹木並維持前地樹種與佈局；文化局「澳門歷史城區遊徑」提供互動地圖與語音導賞',
    why: (t) => (Number(t.age_years) >= 300 && t.grade !== '不分級' ? `樹齡 ${t.age_years} 年且列入名錄，具解說價值` : null),
  },
  {
    id: 'data-sync',
    label: '核對《古樹名錄》與官方現行值的差異並註記',
    urgency: '今年內',
    basis: '本站監測：658 株中 6 株的官方現行值與《名錄》不同（分級 1、健康狀況 4、樹齡 1），顯示一律以官方現行值為準',
    why: (t) => (t.data_mismatch ? `官方現行值與《名錄》不同（${t.data_mismatch}）` : null),
  },
];

/** 建議時程 → 排序數字（給清單與列印用） */
export const urgencyRank = (u) => {
  const i = URGENCY_ORDER.indexOf(u);
  return i < 0 ? URGENCY_ORDER.length : i;
};

/** 補上「規則需要、但優先保育評分輸出沒帶」的欄位（都是官方或本站可回溯的統計） */
function enrichTree(tree, ctx = {}) {
  const counts = ctx.counts instanceof Map ? ctx.counts : new Map();
  const species = String(tree.species || '').trim();
  // 有沒有「可用的官方照片」＝有沒有 photo_url。不要用 photo_count：示範資料裡它是名錄欄位，
  // 每一株都填 1，但實際上有一株的官方影像已下架（本站統計 657／658）。
  const photoMissing = !tree.photo_url;
  // 官方現行值與《名錄》值的差異：只在真的有差異時才有字串
  const diffs = [];
  if (tree.listing_grade && tree.grade && tree.listing_grade !== tree.grade) diffs.push(`分級 ${tree.listing_grade}→${tree.grade}`);
  if (tree.listing_health && tree.health && tree.listing_health !== tree.health) diffs.push(`健康 ${tree.listing_health}→${tree.health}`);
  if (tree.listing_age_years != null && tree.official_age_years != null
    && Number(tree.listing_age_years) !== Number(tree.official_age_years)) {
    diffs.push(`樹齡 ${tree.listing_age_years}→${tree.official_age_years}`);
  }
  return {
    ...tree,
    species_count: counts.get(species) || 0,
    photo_missing: photoMissing,
    data_mismatch: diffs.join('、'),
  };
}

/** 這一株的建議行動（陣列，依建議時程排序）；沒有符合的規則就回空陣列（不硬湊建議） */
export function treeActions(tree, ctx = {}) {
  if (!tree || typeof tree !== 'object') return [];   // 沒有資料就沒有建議，也不抛錯
  const t = ctx.enriched ? tree : enrichTree(tree, ctx);
  const out = [];
  for (const rule of ACTION_RULES) {
    let why = null;
    try {
      why = rule.why(t);
    } catch {
      why = null;                                  // 缺值造成的例外不該讓整頁掛掉
    }
    if (why) out.push({ id: rule.id, label: rule.label, urgency: rule.urgency, basis: rule.basis, why });
  }
  out.sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency));
  return out;
}

/**
 * 全站行動計畫：每條規則有多少株要做、代表株有哪些。
 * 回傳 { actions, advice }；advice 是 Map（tree_no → 建議陣列），供名單逐株顯示用。
 * topN 控制每條行動的代表株數量（畫面與列印共用同一組，避免兩邊不一致）；
 * 完整成員放在 members（CSV 匯出與列印用，一般頁面請求不會回傳，見 lib/routes/priority.js）。
 */
export function actionPlan(trees, ranked, { topN = 12 } = {}) {
  const list = trees || [];
  const counts = new Map();
  for (const t of list) {
    const sp = String(t.species || '').trim();
    counts.set(sp, (counts.get(sp) || 0) + 1);
  }
  const scoreOf = new Map((ranked || []).map((r) => [String(r.tree_no), r]));
  const advice = new Map();
  const buckets = new Map(ACTION_RULES.map((r) => [r.id, []]));
  for (const raw of list) {
    const no = String(raw.tree_no);
    const row = scoreOf.get(no);
    // 合併「官方原始欄位」與「優先保育評分輸出」：評分才有 risk_level／score，
    // 原始列才有冠幅、照片、座標精度與名錄差異——規則兩邊都會用到，缺一邊就會少掉建議。
    const t = { ...enrichTree(raw, { counts }), ...(row || {}) };
    const acts = treeActions(t, { enriched: true });
    advice.set(no, acts);
    for (const a of acts) {
      buckets.get(a.id).push({
        tree_no: no,
        species: t.species || '',
        parish: t.parish || '',
        loc: String(t.official_loc || t.loc || ''),
        age_years: t.age_years != null ? Number(t.age_years) : null,
        health: t.health || '',
        grade: t.grade || '',
        score: row ? row.score : null,
        why: a.why,
      });
    }
  }
  const actions = ACTION_RULES.map((rule) => {
    const items = buckets.get(rule.id) || [];
    items.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
      || (Number(b.age_years) || 0) - (Number(a.age_years) || 0));
    return {
      id: rule.id,
      label: rule.label,
      urgency: rule.urgency,
      basis: rule.basis,
      count: items.length,
      trees: items.map((x) => x.tree_no),
      examples: items.slice(0, topN),
      // members＝完整成員清單（CSV 匯出與列印用）；頁面只拿 examples，避免每次都傳上千筆
      members: items,
    };
  }).sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || b.count - a.count);
  return { actions, advice };
}

/** 方法說明（畫面與報告引用同一份，避免兩套說法） */
export function actionsMethod() {
  return {
    rule_count: ACTION_RULES.length,
    urgency_order: URGENCY_ORDER,
    disclaimer: '這裡輸出的是巡查與資料整理的優先順序，不是樹木醫學診斷或施工方案；'
      + '真正的處置（修剪、支撐、土壤改良）必須由具職權的公共部門與專業人員評估後決定。',
    notes: [
      '每一條建議都由官方資料推導，條件寫在規則裡（同一個條件永遠得到同一個建議），不看感覺排序。',
      '缺值不補：官方沒有的欄位（例如冠幅、照片）會變成「去現場補量／補拍」的建議，而不是推估值。',
      '建議時程分三級：立即處理（官方健康瀕危或區位風險高）／今年內（資料缺漏或法定標示檢視）／持續追蹤（例行檢查與稀有母樹）。',
    ],
  };
}
