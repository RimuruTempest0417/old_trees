import { handler } from '../http.js';
import { listTimeline, siteInfo } from '../repo.js';

/**
 * GET /api/timeline — 澳門古樹保護立法與名錄時間線
 */
export default handler(async () => {
  const events = await listTimeline();
  return {
    count: events.length,
    events: events.map((e) => ({
      year: e.year, date: e.event_date, title: e.title, detail: e.detail, source: e.source,
    })),
    source: siteInfo().data_source,
  };
}, 3600);
