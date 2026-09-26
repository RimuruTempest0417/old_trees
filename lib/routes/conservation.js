import { handler, clientError } from '../http.js';
import { listConservation, getTopic, siteInfo, allTrees } from '../repo.js';
import { rankTrees } from '../priority.js';
import { buildMetrics, resolveGuides, guidesMethod } from '../knowledge-guides.js';
import { overview as envOverview } from '../env-chem.js';

/**
 * GET /api/conservation      — 文章清單（可依 category 篩選）
 * GET /api/conservation?slug=legislation — 單篇文章全文
 * GET /api/conservation?guides=1 — 科普「數據導讀」（v0.16.0）：每篇文章可引用的官方數據，
 *   數字由後端即時計算（同一份官方資料），前端只負責填句子與連結
 */
export default handler(async (p) => {
  const source = siteInfo().data_source;
  if (p.guides === '1' || p.all === 'guides') {
    const trees = await allTrees();
    const metrics = buildMetrics(trees, rankTrees(trees), envOverview('2025'));
    return {
      ok: true,
      metrics,
      guides: resolveGuides(metrics),
      method: guidesMethod(),
      source,
    };
  }
  if (p.slug) {
    const topic = await getTopic(p.slug);
    if (!topic) throw clientError(404, '找不到指定的科普文章。');
    // 附上這一篇的數據導讀（同一次請求拿到，避免前端多打一次 API）
    const trees = await allTrees();
    const metrics = buildMetrics(trees, rankTrees(trees), envOverview('2025'));
    const guide = resolveGuides(metrics).find((g) => g.slug === topic.slug) || null;
    return { topic, guide, source };
  }
  let list = await listConservation();
  if (p.category) list = list.filter((t) => t.category === p.category);
  const categories = [...new Set(list.map((t) => t.category))];
  return {
    count: list.length,
    categories,
    topics: list.map((t) => ({
      slug: t.slug, category: t.category, title: t.title, summary: t.summary,
      sources: t.sources || [], sort_order: t.sort_order,
    })),
    source,
  };
}, 900);
