import { handler, clientError } from '../lib/http.js';
import { listConservation, getTopic, siteInfo } from '../lib/repo.js';

/**
 * GET /api/conservation      — 文章清單（可依 category 篩選）
 * GET /api/conservation?slug=legislation — 單篇文章全文
 */
export default handler(async (p) => {
  const source = siteInfo().data_source;
  if (p.slug) {
    const topic = await getTopic(p.slug);
    if (!topic) throw clientError(404, '找不到指定的科普文章。');
    return { topic, source };
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
