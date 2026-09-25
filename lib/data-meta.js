/**
 * 官方資料履歷（由 scripts/gen-data-meta.mjs 自動產生，請勿手改）。
 *
 * 用途：讓網站與 API 能說出「這份官方資料是什麼時候抓的、共幾筆、內容雜湊多少」，
 * 資料一更新（npm run build:data）就會改動本檔 → 部署後前端立刻看得到新的擷取時間。
 * tests/iam.test.js 會驗證 data_hash 與 data/iam_trees.json 一致。
 */
export const DATA_META = {
  "source_name": "澳門特別行政區政府市政署 澳門自然網 — 古樹名木",
  "source_page": "https://www.iam.gov.mo/nature/c/tree",
  "list_endpoint": "https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json",
  "fetched_at": "2026-09-25T00:09:28+0800",
  "record_count": 658,
  "photo_count": 657,
  "photos_missing": [
    "471"
  ],
  "license_note": "資料與照片著作權屬澳門市政署；本平台為非商業教學研究用途並標示出處。",
  "data_hash": "d8b20e74b40a581d"
};

export default DATA_META;
