import { handler, clientError } from '../lib/http.js';
import {
  listFieldRecords, insertFieldRecord, normalizeFieldRecord, DATA_SOURCE,
} from '../lib/repo.js';

/**
 * GET  /api/field-records — 實地考察紀錄清單
 * POST /api/field-records — 新增一筆實地考察紀錄
 *
 * 這是刻意「預留空間」給實地考察的端點：資料庫（Supabase）連線時才真正寫入，
 * 未連線（示範模式）時回報 writable:false，前端改把紀錄暫存在瀏覽器，
 * 並在畫面上明示「尚未寫入資料庫」——不假裝寫成功。
 */
export default handler(async (p, req) => {
  const writable = DATA_SOURCE === 'supabase';

  if (req.method === 'POST') {
    const { record, errors } = normalizeFieldRecord(p);
    if (errors.length) throw clientError(400, errors.join(' '));
    try {
      const saved = await insertFieldRecord(record);
      return {
        writable: true,
        stored: true,
        record: saved,
        count: (await listFieldRecords()).length,
        source: DATA_SOURCE,
      };
    } catch (err) {
      if (!err.demo) throw err;
      // 示範模式：驗證通過但沒有資料庫可寫，明確告知前端改存本機
      return {
        writable: false,
        stored: false,
        record,
        note: err.message,
        source: DATA_SOURCE,
      };
    }
  }

  const records = await listFieldRecords(p.limit);
  return {
    writable,
    stored: writable,
    count: records.length,
    records,
    source: DATA_SOURCE,
    note: writable
      ? null
      : '示範模式：本站目前未連接 Supabase，新增的紀錄只會暫存在你自己的瀏覽器（localStorage）。',
  };
}, 0);
