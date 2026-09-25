import { handler } from '../http.js';
import { allParishes, allSpecies, siteInfo } from '../repo.js';

/**
 * GET /api/meta — 前端篩選器選項（堂區、品種、分級、健康）與站點資訊
 */
export default handler(async () => {
  const [parishes, species] = await Promise.all([allParishes(), allSpecies()]);
  return {
    site: siteInfo(),
    parishes: parishes.map((p) => ({ code: p.code, name: p.name_zh, name_pt: p.name_pt,
      area_km2: p.area_km2, note: p.note })),
    species: species.filter((s) => s.name_zh).map((s) => ({
      name: s.name_zh, name_sci: s.name_sci, photo_url: s.photo_url,
    })).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
    // 分級一律照官方名錄原文，不自行附加年齡級距（避免看起來像本平台自訂的分級規則）
    grades: [
      { code: '一級', label: '一級古樹' },
      { code: '二級', label: '二級古樹' },
      { code: '三級', label: '三級古樹' },
      { code: '不分級', label: '不分級／名木' },
    ],
    health: [
      { code: '健康', label: '健康' },
      { code: '一般', label: '一般' },
      { code: '瀕危', label: '瀕危' },
    ],
    themes: [
      { code: 'balanced', label: '均衡推薦（綜合樹齡、健康風險與稀有度）' },
      { code: 'oldest', label: '最老優先' },
      { code: 'health', label: '關注瀕危優先' },
      { code: 'species', label: '稀有品種優先' },
    ],
  };
}, 3600);
