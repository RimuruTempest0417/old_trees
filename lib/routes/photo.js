import { handler, clientError } from '../http.js';
import { uploadFieldPhoto, DATA_SOURCE } from '../repo.js';

/**
 * POST /api/photo — 上傳一張實地考察照片
 *
 * 為什麼要有這個端點：現場照片若只能貼外部網址，等於沒有真的把照片存下來
 * （照片在別人的服務上、連結會失效）。這裡由 Serverless Function 用 service_role
 * 上傳到 Supabase Storage 的 field-photos bucket，前端只拿到公開網址。
 *
 * 示範模式（未連接 Supabase）：回 HTTP 200 且 stored:false，前端改存本機瀏覽器，
 * 並在畫面明示「只暫存在這台裝置」——不假裝上傳成功。
 */
export default handler(async (p, req) => {
  if (req.method !== 'POST') throw clientError(405, '這個端點只接受 POST（上傳照片）。');
  const dataUrl = p.data_url || p.dataUrl || p.image;
  const treeNo = p.tree_no || p.treeNo || null;
  try {
    const saved = await uploadFieldPhoto({ dataUrl, treeNo });
    return { ...saved, source: DATA_SOURCE };
  } catch (err) {
    if (!err.demo) throw err;
    return {
      stored: false,
      path: null,
      url: null,
      note: err.message,
      source: DATA_SOURCE,
    };
  }
}, 0);
