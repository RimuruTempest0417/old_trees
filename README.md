# 澳門古樹保育研究平台 · Macau Heritage Tree Conservation Platform

以《古樹保育研究(1).docx》所列題目為綱，把 **658 株澳門古樹名木**整理成一個可查詢、可分析、可導覽的資料庫網站。

- **資料庫**：Supabase（PostgreSQL 15+）
- **部署**：Vercel Serverless Functions（`/api/*`）＋ 靜態前端（`public/`）
- **前端**：原生 ES Modules、Leaflet（地圖）、Chart.js（圖表）、KaTeX ＋ marked（科普文章）
- **原始資料**：`source-data/古樹.csv`（658 筆）、**澳門市政署「澳門自然網」古樹名木專頁（658 筆逐株資料與官方照片）**、《古樹保育研究(1).docx》（需求文件）

[![每日擷取官方古樹名錄](https://github.com/RimuruTempest0417/old_trees/actions/workflows/refresh-official-data.yml/badge.svg)](https://github.com/RimuruTempest0417/old_trees/actions/workflows/refresh-official-data.yml)
[![線上網站](https://img.shields.io/badge/%E7%B7%9A%E4%B8%8A%E7%B6%B2%E7%AB%99-old--trees--mylearning.vercel.app-2ea44f)](https://old-trees-mylearning.vercel.app)

---

## 目錄

1. [線上功能](#一線上功能)
2. [需求對照表](#二需求對照表docx-第-1--24-題)
3. [系統架構](#三系統架構)
4. [資料庫設計Supabase--postgresql](#四資料庫設計supabase--postgresql)
5. [API 端點](#五api-端點)
6. [統計與演算法方法論](#六統計與演算法方法論)
7. [本機開發](#七本機開發)
8. [連接 Supabase](#八連接-supabase)
9. [部署到 Vercel](#九部署到-vercel)
10. [測試與驗證](#十測試與驗證)
11. [離線使用與安裝（PWA）](#十一離線使用與安裝pwa)
12. [優先保育名單（評分方法）](#十二優先保育名單評分方法)
13. [官方資料自動擷取與資料履歷](#十三官方資料自動擷取與資料履歷)
14. [疑難排解（部署後常見狀況）](#十四疑難排解部署後常見狀況)
15. [資料來源與授權](#十五資料來源與授權)
16. [監測時間序列](#十六監測時間序列)

---

## 一、線上功能

網站分為十個分頁：

| 分頁 | 內容 |
| --- | --- |
| **總覽** | 關鍵指標、**各堂區古樹數目分佈圖**、品種排行、健康狀況與分級結構、最老 10 株、瀕危關注名單、**古樹名目分區表**、原始資料 CSV 下載 |
| **地圖查詢** | 658 株古樹地圖（叢集標記、顏色代表健康狀況）；以堂區／品種／分級／健康／樹齡區間／關鍵字篩選；地圖任意點擊設定中心做**半徑搜尋**；點擊標記看單株詳情（含相片、同地點鄰居），並可直接為該株新增實地考察紀錄 |
| **路綫推薦** | 5 條精選路綫（列表顯示站數、距離、步行時間），或以堂區／品種／主題即時生成自訂路綫；地圖繪製路徑與編號站點，並提供 Google Maps 導航連結 |
| **數據分析** | 描述統計、5 個數學模型擬合比較（線性／對數／冪律／飽和指數／含品種啞變數迴歸）、ANOVA、卡方檢定、存續預測曲線、可下載的分析資料 CSV；**每張分析圖皆附一段「小結」說明** |
| **實地考察** | 現場記錄表單（古樹編號、觀察日期、記錄者、天氣、健康狀況、樹高／胸徑／冠幅、立地環境、病蟲害與損傷、照片、座標一鍵定位）、紀錄清單與 CSV 匯出、現場檢查清單與安全提醒；頁面下方分「**這一區現在就能做的事（已上線）**」（QR 掃描帶入樹號、與官方值比對的時間序列、A4 紙本考察單，各附入口）與「**還在規劃中**」（拍照上傳、GPS 誤差比對、多人協作審核、觀察項目結構化）。紀錄存於 `field_records` 表，官方名錄不會被覆寫 |
| **監測** | 把「《名錄》官方版本值 → 市政署自然網歷次快照 → 師生實地考察紀錄」接成**每一株的時間序列**：觀測點表、逐次差異（胸徑／樹高／健康狀況／官方分級）、線性趨勢（每年變化量與 R²）、異常與複查提醒（胸徑減少 ≥ 0.5 公分、樹高減少 ≥ 0.2 公尺、超過 730 天未複查）；官方值變動標示為「官方資料更新」而非異常。可切換「有變動／需確認／有考察紀錄／全部」，並匯出 CSV 與複製摘要 |
| **QR 碼** | 為 658 株古樹各產生一個二維碼：可選「掃描後開啟古樹詳情」或「實地考察表單」、依堂區／關鍵字／排序篩選、可下載單張 SVG；列印時自動三欄排版，適合做樹上掛牌或考察任務卡（編碼用 qrcode-generator，MIT） |
| **優先保育** | 以**樹齡、健康狀況、官方級別、樹種稀有度、區位風險**五項、合計 100 分為 658 株排序，列出名次、分數、**分數段落（純閱讀用：75 分以上／60–74／45–59／45 分以下，不是級別）**與每一株的逐項配分與理由；健康與分級兩欄一律是市政署官方值；可依**官方分級／官方健康狀況**／堂區／關鍵字篩選、匯出 CSV、複製摘要，並可列印成 A4 名單（每頁 40 列）。分數是相對排序工具，不是官方認定 |
| **列印** | 把資料變成可帶去現場的紙本：**單株 A4 樹木檔案卡**（官方照片、13 項基本資料、形態描述、現場查核清單、二維碼）、**實地考察紀錄單**（可帶入某株基本資料或空白表，含量測表格與勾選清單）、**路綫資料冊**（封面含站點示意圖與比例尺，之後每站一頁）；按「列印／存成 PDF」即可在列印對話框選擇「另存為 PDF」，A4 一頁一株 |
| **化學視角** | **作業要求 F** 的網站化呈現：官方**空氣污染物年均濃度**（六站 × 六污染物，2024/2025 對照、官方年平均標準達標判定）、**空氣質量水平日數**（2025 年六站 ＋ 2006–2025 荷蘭園站趨勢）、**降雨酸鹼度官方歷史值**，以及酸雨／土壤酸化／水泥與鋪面的**化學式與出處**；另外把「區域空氣背景 × 官方健康狀況」並列（附平均樹齡，說明相關不等於因果），並誠實列出**本頁沒有的數據**（無官方逐點土壤理化與礦物成分數據集） |
| **保育科普** | 12 篇繁體中文專題文章（含 KaTeX 數學式）、立法時間線、每篇附參考來源 |

> **實地考察紀錄的儲存方式**：連接 Supabase 時寫入 `field_records` 資料表（所有人可見）；
> 未連接資料庫（示範模式）時，畫面會明確標示「只暫存在這台裝置的瀏覽器」，不假裝已寫入資料庫。

### 相片

- **古樹官方照片 658 張**：每株古樹各一張，取自澳門市政署「澳門自然網」古樹名木專頁
  （`https://www.iam.gov.mo/nature/Content/OldTreesOnline/<影像檔>`），下載後統一縮為長邊 320 px 存放於
  `public/photos/trees/`，每株標示市政署樹木編號與原始出處連結。
- **品種相片 56 張**：來自 Wikimedia Commons，附作者與授權標示（CC BY-SA / CC0 / 公有領域）。
- **地點實景照 116 張**：以地點座標向 Wikimedia Commons 做半徑 400 公尺地理搜尋所得，附作者與授權。（已搜尋 119 個地點，其中 3 個半徑內沒有 Commons 授權照片——徐日昇寅公圓形地、聖公會聖馬可堂、聖地牙哥酒店；這 3 處的單株詳情只顯示樹種相片，不會出現破圖。）

---

## 二、需求對照表（docx 第 1–24 題）

| # | docx 題目 | 對應實作 |
| --- | --- | --- |
| 1 | 為什麼要保育古樹？對現在、將來的意義 | 科普〈為什麼要保育「古樹」？〉；總覽頁碳儲與生態效益說明 |
| 2 | 古樹在澳門的分佈如何（生物與地理角度） | 科普〈古樹在澳門的分佈〉；**總覽頁各堂區分佈圖**；地圖查詢 |
| 3 | 分佈上有何特徵 | 科普〈古樹在澳門的分佈〉；數據分析頁堂區／品種分佈統計 |
| 4 | 保育古樹需要什麼條件 | 科普〈保育古樹需要什麼條件？〉 |
| 5 | 澳門歷史背景與現存古樹的關聯 | 科普〈澳門歷史背景與現存古樹的關聯〉；立法時間線 |
| 6 | 為何在該時段出現 | 科普〈為何在「那個時段」出現？〉（樹齡推算與歷史分期） |
| 7 | 何時立法保護古樹 | 科普〈何時立法保護古樹？〉；**保育科普頁立法時間線（9 個事件）** |
| 8 | 古樹對附近居民的影響 ＋ 圖片 | 科普〈古樹對附近居民的影響〉；地點實景照 |
| 9 | 有何方法應對未來越來越多的古樹 | 科普〈為何未來古樹會越來越多？又該如何應對？〉；數據分析頁存續預測 |
| 10 | 解釋為何未來會越來越多古樹 | 同上；統計模型預測曲線與名錄擴充推算 |
| 11 | 古樹所在地方與樹本身的故事 | 科普〈古樹與地方的故事〉；地圖單株詳情的地點描述 |
| 12 | 分析古樹的分布（歷史角度） | 科普〈古樹在澳門的分佈〉歷史段；時間線 |
| 13 | **用一種數學模型擬合及分析關係** | **數據分析頁 5 個模型**（見方法論第六節） |
| 14 | 想補充的相關知識 | 科普〈古樹名木的專業常識〉、〈常見問題 FAQ〉 |
| 15 | 資訊任務 | 全站（總覽頁為入口） |
| 16 | **各堂區古樹數目分佈圖** | **總覽頁長條圖**（另附密度、平均樹齡、最老古樹） |
| 17 | 從澳門古樹清單中做澳門古樹分析 | 數據分析頁（描述統計 ＋ 推論統計 ＋ 模型） |
| 18 | 古樹名目分區表（任務 1 加強版） | 總覽頁「古樹名目分區表」＋ `/api/parishes` |
| 19 | 創作古樹保育影片 | **不在本專案範圍**（另案處理） |
| 20 | **古樹保育網頁**：相片、地圖查詢、路綫推薦、保育科普 | **本專案主體**：相片 ✅／地圖查詢 ✅／路綫推薦 ✅／保育科普 ✅ |
| 21 | 其他 | 資料可下載（CSV）、API 開放、可離線瀏覽 |
| 22 | 數學圖表 | 數據分析頁：直方圖、散點＋擬合曲線、模型比較表、ANOVA／卡方表、預測曲線 |
| 23 | 數學角度分析 | 見第六節方法論；負 R² 亦如實呈現並解釋 |
| 24 | 設計方案 | 見下方〈設計方案〉 |

### 分析 A–G（作業第 3 點）對照

| 要求 | 對應實作 |
| --- | --- |
| A 為什麼要保育、對現在將來的意義 | 科普〈為什麼要保育「古樹」？〉；總覽頁碳儲與生態效益 |
| B 澳門的分佈與特徵 | 科普〈古樹在澳門的分佈〉；總覽頁各堂區分佈圖；地圖查詢 |
| C 保育需要什麼條件 | 科普〈保育古樹需要什麼條件？〉；管護技術篇 |
| D 歷史背景與現存古樹的關聯 | 科普〈澳門歷史背景與現存古樹的關聯〉；立法時間線 |
| E 用數學模型擬合分析 | 數據分析頁 5 個模型（見第六節方法論） |
| **F 針對 A–D 選一點做化學視角補充** | **「化學視角」分頁**（官方空氣與酸雨數據、化學式與出處、區域背景對照）＋科普〈化學視角：酸雨、土壤酸鹼與水泥如何影響澳門古樹〉 |
| G 其他想補充的相關知識 | 科普〈古樹名木的專業常識〉、〈常見問題 FAQ〉；監測分頁的時間序列 |
| 分析範圍（氣候、空氣質量、土壤、品種、共生動植物、經濟價值、來源、地緣、城市發展、公民素養、歷史原因、旅遊資源、化學環境、文化推廣…） | 總覽／分析／優先保育／化學視角各頁；科普 12 篇涵蓋生態服務、土壤、歷史、社區與制度 |

### 設計方案

1. **資料正規化**：把 CSV 的扁平欄位拆成 `parishes / species / sites / trees` 四層，避免地點與品種名稱重複儲存。
2. **座標補齊**：127 個地點先以 OSM Nominatim 地理編碼，無法匹配者人工校核填入 `data/manual_coords.json`，確保每株古樹都能定位。
3. **行動裝置優先的互動**：地圖為主的查詢介面 ＋ 可捲動結果清單，兩者雙向同步。
4. **統計誠實原則**：模型以決定係數與 RMSE 客觀比較，**負的 R² 照實顯示**（代表該模型比用平均值更差），不挑好看的回報。
5. **金鑰不落地**：前端只呼叫自家 `/api`，Supabase 服務金鑰只存在於 Vercel 環境變數。

### 裝置適配（深淺色模式與手機瀏覽器）

| 面向 | 做法 |
| --- | --- |
| **跟隨系統深淺色** | `@media (prefers-color-scheme: dark)` 覆寫全套色票變數；`:root { color-scheme: light dark }` 讓下拉選單、捲軸、日期選擇器等原生控件同步；`<meta name="theme-color">` 淺色 `#14532d`／深色 `#101613` 兩版，手機瀏覽器介面帶跟著變 |
| **深色下的細節** | 表頭改不透明底色（捲動時資料列不從底下透出）、模態遮罩加深、`::selection` 反白；**Leaflet 內建樣式另外覆蓋**（彈窗、縮放鈕、比例尺、授權列），地圖圖磚以 `invert(1) hue-rotate(180deg)` 反相，夜間不刺眼 |
| **不靠顏色單獨傳達** | 健康狀況除色點外皆有文字標籤；色票在深淺兩模式都維持 WCAG AA 對比 |
| **手機瀏覽器** | `viewport-fit=cover` ＋ `env(safe-area-inset-*)` 避開瀏海與底部指示列；`100dvh` 取代 `100vh` 避免網址列造成高度跳動；`-webkit-text-size-adjust: 100%` 防止橫向時字級被自動放大 |
| **觸控操作** | 按鈕／頁籤／篩選標籤在 ≤940 px 放大到 40–44 px 高；`touch-action: manipulation` 消除點擊延遲與高亮方塊 |
| **iOS 輸入放大** | 輸入框在 ≤940 px 一律 16 px（iOS 對 <16 px 的輸入框聚焦時會自動放大整頁；注意屬性選擇器 `input[type="text"]` 權重較高，必須同權重覆寫才蓋得掉） |
| **窄螢幕排版** | 五個分頁斷點 940 / 700 / 400 px：統計卡 2 欄、圖表縮高、**地圖移到最上方**、表格自帶橫向捲動（不用 `overflow-x: hidden`，避免破壞 sticky 頁首）、單株詳情改為底部浮出的面板而非置中彈窗、頁籤列改可橫向滑動不擠成兩行 |
| **列印** | 不輸出模糊森林背景、隱藏頁首頁尾與按鈕，回到白底黑字 |

自動化稽核 `scripts/ui-audit.sh`（需另備注入式量測頁）以無頭 Chrome 在 360／390／834／1440 px 與深淺色共 14 種組合下量測頁面捲動寬度、元素溢出、觸控目標高度與輸入框字級，全部 `pageOverflow = 0`。

---

## 三、系統架構

```
瀏覽器（public/：原生 ES Modules）
   │  fetch('/api/...')
   ▼
Vercel Serverless Function（api/[[...route]].js，唯一入口，Node.js 20+）
   │  lib/router.js  路由分派（本機 dev-server 也用同一套）
   │  lib/repo.js    資料存取層（雙驅動）
   ├──► Supabase PostgreSQL ── 正式模式
   │      （supabase-js ＋ service_role，僅在伺服器端）
   └──► data/snapshot.json ── 示範模式（未設環境變數時）
```

- **為什麼只有一個 Function**：Vercel Hobby 方案限制「每個 Deployment 最多 12 個 Serverless Function」，而 `api/` 底下每個 `.js` 都算一個。原本 12 個端點 ＋ 1 個動態路由 = 13 個，部署會直接失敗（`No more than 12 Serverless Functions can be added to a Deployment`）。因此把所有 handler 移到 `lib/routes/`（`lib/` 不算 Function），`api/` 只留萬用入口 `api/[[...route]].js`，由 `lib/router.js` 分派——端點網址完全不變。
- **無 SQLite**：資料庫只有 Supabase（PostgreSQL）一種；`data/snapshot.json` 是同源唯讀快照，讓專案在沒有資料庫連線時仍可完整展示，並非替代資料庫。
- **前端零依賴外部 CDN**：Leaflet、Chart.js、marked、KaTeX、qrcode-generator（二維碼）全部置於 `public/vendor/`（`node scripts/vendor.mjs` 可重建；`scripts/` 下有來源與授權說明）。

### 目錄結構

```
macau-heritage-trees/
├── api/
│   └── [[...route]].js     唯一的 Serverless Function（萬用入口）
├── lib/
│   ├── router.js           路由表與分派（線上與本機共用）
│   ├── routes/             16 個端點的 handler（health／trees／tree／stats／priority／monitoring／env-chem…）
│   ├── analysis.js｜geo.js｜repo.js｜http.js｜priority.js（優先保育評分模型）
│   ├── monitoring.js       監測時間序列純函式（序列組成、逐次差異、趨勢擬合、異常規則）
│   ├── official-history.js 官方觀測快照（監測用；由 scripts/snapshot-observations.mjs 產生）
│   └── data-meta.js        官方資料履歷（擷取時間、筆數、內容雜湊；由 scripts/gen-data-meta.mjs 產生）
├── public/                 前端（index.html、css/、js/、photos/、vendor/、sw.js、manifest.webmanifest、offline.html、icons/）
│   ├── js/priority.js      優先保育名單分頁（名次表、篩選、CSV、列印入口）
│   ├── js/monitoring.js    監測分頁（概況、單株時間序列、逐次差異、趨勢圖、異常清單）
│   └── photos/trees/       658 張古樹官方照片（市政署，縮圖）
├── supabase/
│   ├── schema.sql          資料表、檢視表、RPC、RLS、版本升級段落（可直接貼進 Supabase SQL Editor）
│   ├── seed.sql            658 筆古樹（含官方座標／照片／描述）＋ 品種 ＋ 地點 ＋ 文章 ＋ 時間線
│   └── init.sql            schema.sql ＋ seed.sql 合併檔（一鍵初始化）
├── data/                   建置產物（snapshot.json、iam_trees.json、conservation.json、species.json…）
│   └── observations/       官方觀測快照（每次官方名錄內容變更存一份，監測時間序列的來源）
├── scripts/                資料處理（Python：fetch_iam／geocode／content／build_seed／make_icons）、開發伺服器、驗證腳本（Node：check-syntax／vendor／build-sw／gen-data-meta／qr-roundtrip；Python：card-check／card-pdf／pwa-check／qr-decode／ui-audit）
├── source-data/            原始 CSV 與 docx
├── .github/workflows/      每日自動擷取官方名錄（refresh-official-data.yml）
└── tests/                  18 組測試（統計／SQL／API／路由／安全／機密／官方資料／官方值優先／前端／實地考察／優先保育／監測時間序列／**化學視角與環境數據**／二維碼／列印／Supabase 查詢形狀／離線 PWA）
```

---

## 四、資料庫設計（Supabase / PostgreSQL）

`supabase/schema.sql` 內含 8 張表、3 個檢視表、6 個函式，可整體重複執行（idempotent）。

### 資料表

| 表 | 說明 |
| --- | --- |
| `parishes` | 澳門堂區（7 堂區＋路氹填海區）與面積 |
| `species` | 古樹品種，含學名、Wikidata 對應、相片與授權 |
| `sites` | 古樹所在地點（127 個），含座標、歷史與故事 |
| `trees` | 古樹個體清單（658 筆）：樹齡、樹高、健康狀況、分級、座標 |
| `routes` | 精選路綫（5 條） |
| `conservation_topics` | 保育科普文章（11 篇） |
| `timeline_events` | 立法與名錄時間線（9 個事件） |
| `field_records` | **實地考察紀錄**（預留給現場記錄）：古樹編號、觀察日期、記錄者、天氣、健康狀況、樹高／胸徑／冠幅、立地環境、病蟲害與損傷、照片、座標、建立時間 |

索引：`parish_code / species_id / site_id / health / grade / age_years / (lat, lon)`、`field_records(observed_on)`。

### 檢視表

- `v_trees`：古樹 ＋ 品種、地點、堂區的完整視圖（前端主要資料來源）
- `v_parish_stats`：各堂區株數、佔比、平均樹齡、最老古樹、健康分佈
- `v_species_stats`：各品種株數、平均／最高樹高、平均樹齡

### RPC 函式

`rpc_overview()`、`rpc_parishes()`、`rpc_species_ranking(limit)`、`rpc_age_histogram(bucket)`、`rpc_scatter()`、`rpc_find_trees(篩選參數…)` —— 把統計下推到資料庫端執行。

### 安全（RLS）

- 8 張表**全部啟用 Row Level Security**。
- 只授予 `select` 政策給 `anon` / `authenticated`；**沒有任何 INSERT／UPDATE／DELETE 政策**。
- 寫入一律經 `service_role`（僅存在於 Vercel 伺服器端環境變數），前端與匿名使用者無法修改資料；
  實地考察紀錄也是先送到自家 `POST /api/field-records` 驗證後才由伺服器端寫入。

---

## 五、API 端點

所有端點皆為 `GET`（`POST` 亦接受 JSON body），回應格式 `{ ok, ...資料, took_ms }`，錯誤為 `{ ok: false, error }`。
線上只有**一個** Serverless Function 處理全部端點：`api/[[...route]].js` → `lib/router.js` → `lib/routes/<端點>.js`。

| 端點 | 說明 |
| --- | --- |
| `GET /api/health` | 健康檢查：資料來源、古樹筆數 |
| `GET /api/meta` | 詮釋資料：堂區、品種、篩選選項、API 清單 |
| `GET /api/overview` | 總覽統計（KPI、健康分佈、分級、亮點） |
| `GET /api/parishes` | 各堂區統計（分區表） |
| `GET /api/trees` | 古樹清單；參數 `parish, species, grade, health, min_age, max_age, q, sort, limit, offset` |
| `GET /api/tree/:tree_no` | 單株詳情＋同地點鄰居（編號須符合 `[0-9A-Za-z_-]{1,24}`）；含市政署官方 `diameter_cm`（胸徑）、`girth_cm`（胸圍）、`stem_count`（主幹數）、`stem_measures`（多主幹逐支量測） |
| `GET /api/species` | 品種清單與統計 |
| `GET /api/stats` | 完整統計分析（模型、ANOVA、卡方、預測） |
| `GET /api/routes` | 精選路綫清單 |
| `GET /api/route` | 路綫計算；`code=<精選路綫>` 或 `parish/species/theme/max_stops` 自訂 |
| `GET /api/conservation` | 科普文章清單；`slug=<文章>` 取全文 |
| `GET /api/timeline` | 立法與名錄時間線 |
| `GET /api/priority` | 優先保育名單；參數 `limit`（預設 50，`0`／`all=1` 為全部）、`grade`（**官方分級**，可逗號多選）、`health`（**官方健康狀況**）、`parish`、`species`、`q`；回傳 `summary`（官方分級／健康狀況分佈、分數刻度統計、平均分）與 `method`（權重、規則、分級政策、限制）。**不含任何自訂級別欄位** |
| `GET /api/field-records` | 實地考察紀錄清單；`limit` 可選（上限 500）；回傳 `writable` 旗標說明是否已連接資料庫 |
| `GET /api/env-chem` | **化學視角（作業要求 F）** 的官方環境數據；參數 `block=air｜acid｜materials`（只取一段）、`matrix=<污染物>`（各站該污染物年均矩陣）、`region=<堂區>`（該區域官方監測站背景值，未知堂區回 404）、`year`（僅官方有資料的年份，否則 400）、`trees=1`（附上「區域 × 官方健康狀況」對照）。回傳 `doc`（官方出處、數值、機制與化學式、**來源索引**）、`hash`（資料內容雜湊，便於核對版本）、`stations`。**數值一律官方原值：不換算、不內插、不平均**，官方查不到的（例如 2000 年後的降雨 pH、逐點土壤理化）一律標明「找不到」而不填空 |
| `GET /api/monitoring` | **監測時間序列**；`tree=<編號>` 回單株完整序列（觀測點、逐次差異、趨勢、異常；找不到回 404）、`only=changed｜attention｜field` 篩選、`limit`（預設 50，`0`／`all=1` 為全部）、`rows=1` 附上每株變動摘要；回傳 `summary`（快照數與期間、官方變動株數、已有考察紀錄株數、需確認株數）、`method`（三個來源與規則）、`snapshots`、`data`（官方資料履歷）。**不含任何自訂級別**；官方值變動標為資訊而非異常 |
| `POST /api/field-records` | 新增一筆實地考察紀錄（JSON body）；欄位驗證不過回 `400`，示範模式回 `stored: false` 並附說明 |

### 實地考察紀錄欄位

`tree_no`（古樹編號，可空）、`observed_on`（`YYYY-MM-DD`）、`observer`（必填，≤60 字）、`weather`（≤20 字）、
`health`（僅接受「健康」「一般」「瀕危」）、`height_m`（0–100）、`diameter_cm`（0–1000）、`crown_m`（0–100）、
`site_note`／`damage_note`（≤600 字）、`photo_url`、`lat`／`lon`。超出長度一律截斷、非數值一律視為未填。

---

## 六、統計與演算法方法論

### 6.1 相關分析

以樹齡為自變數、樹高為應變數，計算 **Pearson** 與 **Spearman** 相關係數及 p 值。

### 6.2 五個擬合模型

| 模型 | 形式 | 擬合方式 |
| --- | --- | --- |
| 線性 | $y = a + bx$ | 一般最小平方法 |
| 對數 | $y = a + b\ln x$ | 對 $x$ 取對數後 OLS |
| 冪律 | $y = a\,x^{b}$ | 對數—對數空間 OLS |
| 飽和指數 | $y = A(1-e^{-kx})$ | 網格搜索 ＋ Nelder–Mead 精修 |
| 含品種啞變數迴歸 | $y = \beta_0 + \sum \beta_i D_i$ | 多變數 OLS（品種啞變數） |

以 **決定係數 $R^2$** 與 **RMSE** 比較。**若某模型的 $R^2 < 0$，代表它比「直接用平均樹高」更差**，網站照實顯示並解釋，不做粉飾。

**主要結論**：樹齡與樹高的相關性**幾乎為零**（Pearson $r = -0.001$、Spearman $\\rho = 0.082$），五個模型中最佳的數值模型（飽和指數）$R^2$ 僅 $0.0185$；**但加入品種啞變數後 $R^2$ 提升至 $0.1704$**（提升約 15.2 個百分點，$p < 0.001$）。結論是：**樹高的主要決定因素是品種（基因），而非樹齡**——這與樹木異速生長（allometry）理論一致；樹齡影響的是樹的粗度、材積與碳儲量。

另外，樹齡與**分級**的相關性很高（$r = 0.644$，以官方現行分級計算），這是合理的：分級本身即以樹齡為主要依據（一級 ≥ 300 年、二級 ≥ 200 年、三級 ≥ 100 年）。

### 6.3 變異數分析（ANOVA）

- 各品種間樹高差異是否顯著
- 各堂區間樹齡差異是否顯著

以 F 統計量、自由度與 p 值呈現（F 分佈 CDF 自行實作，未使用外部統計套件）。

### 6.4 卡方獨立性檢定

堂區 × 健康狀況的列聯表，檢定健康狀況是否與所在堂區獨立；同時輸出標準化殘差以指出偏離最大的格。

### 6.5 存續與名錄擴充預測

以現有樹齡分佈與名錄擴充速度，推算未來 50 年古樹數量的變化趨勢（回應 docx 第 9、10 題）。

### 6.6 路綫推薦

以 **最近鄰法（nearest neighbour）** 建立初始路徑，再以 **2-opt** 反覆交換邊改善，目標函數為總步行距離；步行時間以 4.2 km/h 步行速度 ＋ 每站停留時間估算。

---

## 七、本機開發

需求：Node.js ≥ 20（開發不需 Python；只有重建資料時才需要 Python 3）。

```bash
npm install
npm run dev            # http://localhost:3311（模擬 Vercel：靜態檔案 ＋ Functions）
```

未設定資料庫環境變數時，伺服器以 `data/snapshot.json` 示範模式運行，**功能完全一致**。

### 重建資料（需要 Python 3）

```bash
python3 scripts/fetch_iam.py        # 抓市政署官方古樹資料（658 筆）與官方照片到 data/、public/photos/trees/
python3 scripts/geocode.py          # OSM Nominatim 地理編碼（含快取；官方座標已覆蓋大部分）
python3 scripts/content.py          # 產生科普文章與時間線
python3 scripts/build_seed.py       # 產生 supabase/seed.sql 與 data/snapshot.json
node  scripts/vendor.mjs            # 複製前端第三方函式庫到 public/vendor/
```

`scripts/fetch_iam.py` 具續傳能力（已下載的照片會跳過），常用參數：

| 參數 | 作用 |
| --- | --- |
| `--no-images` | 只更新資料，不下載照片 |
| `--recompress` | 依目前設定重新壓縮既有照片（換縮圖尺寸時用） |

---

## 八、連接 Supabase

1. 在 [Supabase](https://supabase.com) 建立專案。
2. 打開 **SQL Editor → New query**，貼上 **`supabase/init.sql`**（`schema.sql` ＋ `seed.sql` 的合併檔，1609 行）並按 **Run**——
   一次就會建立 7 張表、3 個檢視表、6 個 RPC、RLS 政策，並匯入 658 筆古樹。
   （若偏好分開執行，也可先跑 `supabase/schema.sql` 再跑 `supabase/seed.sql`。）
3. 到 **Project Settings → API** 取得 `Project URL` 與 `service_role` 金鑰。
4. 在 Vercel 專案設定環境變數：

| 變數 | 說明 |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 金鑰（**只在伺服器端使用，切勿放進前端**） |
| `DATA_SOURCE` | 選填，`supabase` 或 `snapshot`；預設自動判斷 |

設定後 `/api/health` 的 `data_source` 會變成 `supabase`，網站上的「示範模式」提示會消失。

> **資料庫已經跑過舊版 init.sql 怎麼辦？** `create table if not exists` 對已存在的舊表**不會**補欄位，
> 因此在舊資料庫上再貼一次新版 `init.sql` 時，seed 會出現
> `column "geo_precision" of relation "public.trees" does not exist` 而整段回滾（資料不會壞，只是沒更新）。
> 目前版本的 `schema.sql`／`init.sql` 開頭已有一段**版本升級**（`alter table if exists … add column if not exists …`，
> 共 8 張表、89 個欄位），會就地補齊缺少的欄位並保留預設值，可安全重複執行。
> 直接把最新 `supabase/init.sql` 重新貼上執行即可，**不需要**刪表重建，實地考察紀錄也不會遺失。

> **金鑰安全**：`.env`、`.env.local` 已列入 `.gitignore`；前端程式碼不含任何 Supabase 端點或金鑰（由 `tests/api-security.test.js` 自動驗證）。
>
> **若金鑰曾出現在版本庫**：`.env.example` 只放佔位符，切勿填入真實值——這個檔案會提交到 GitHub，一旦推送就收不回來（歷史紀錄仍留有該 blob）。處理順序：(1) 把檔案改回佔位符並推送；(2) 立刻到 Supabase Dashboard → Project Settings → API 輪換 `anon` 與 `service_role` 金鑰；(3) 更新 Vercel 環境變數並重新部署。**輪換才是真正的補救，改檔案只是止血。** `tests/secrets.test.js` 會在下次不小心再犯時擋下來。

---

## 九、部署到 Vercel

**方式 A：從 GitHub 匯入（推薦，之後每次 push 自動部署）**

1. 到 [vercel.com/new](https://vercel.com/new)，選擇 GitHub 倉庫 `RimuruTempest0417/old_trees`。
2. Framework Preset 選 **Other**，Root Directory 保持預設（`./`），Build Command 與 Output Directory **全部留空**——`vercel.json` 已設定 `framework: null` 與 `outputDirectory: public`，會自動套用。
3. 在 **Environment Variables** 加入 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`。
4. 按 **Deploy**。之後每次 push 到 `main` 都會自動重新部署。

**方式 B：使用 CLI**

```bash
npm i -g vercel
vercel            # 連結專案（第一次）
vercel --prod     # 部署到正式環境
```

`vercel.json` 已設定：

- `outputDirectory: public`（靜態前端）
- `framework: null`（純靜態 ＋ Functions，無建置步驟）
- `functions.maxDuration: 30` 秒（只有 `api/*.js` 一個 Function）
- 相片與 vendor 資源長快取標頭

> **Hobby 方案的 12 個 Function 上限**：Vercel Hobby 每個 Deployment 最多 12 個 Serverless Function，
> 而 `api/` 底下每個 `.js` 檔都算一個。本專案把所有 handler 放在 `lib/routes/`，
> `api/` 只有 `[[...route]].js` 一個萬用入口，因此**永遠只佔 1 個 Function**，新增端點也不會超限。
> 若曾經看到 `Build Failed: No more than 12 Serverless Functions can be added to a Deployment
> on the Hobby plan`，那是舊結構（13 個檔案）造成的，改用目前版本重新部署即可，不需要升級 Pro。

GitHub 倉庫推送後，Vercel 亦會自動部署每次 commit。

---

## 十、測試與驗證

```bash
npm run check          # node --check：對所有 JS 檔執行語法檢查
npm test               # 18 組測試，共 277 項
npm run verify         # check ＋ test
```

| 測試檔 | 內容 | 項數 |
| --- | --- | --- |
| `tests/analysis.test.js` | 統計函式單元測試（相關係數、迴歸、F 分佈、卡方分佈） | 18 |
| `tests/env-chem.test.js` | **化學視角與環境數據**：資料層完整性（六站 × 六污染物 × 兩年、每一項都要有官方出處、數值範圍合理、CO 以 mg/m³ 為單位）、**酸雨段落必須明說「本站找不到近年官方值」**（不得留白或編造）、機制的化學式與文獻 id 互相對得上（來源索引由後端統一組好）、`overview()` 的官方年平均標準達標判定、區域背景（堂區→區域→官方監測站；未知堂區回 null）、古樹 × 區域（各區株數加總＝658、**各區平均樹齡必須顯示**——樹齡是健康差異的干擾因素）、API 契約與錯誤處理（未知區域 404、沒有資料的年份 400、壞的污染物 400）、**官方年均值必須顯示到小數第一位**（曾把 17.3 印成 17）、前端接線（分頁／VIEWS／TITLES／稽核清單／單株詳情的區域背景）、**`init.sql` 必須已重新產生且含新分類**（防止忘了重跑產生器） | 16 |
| `tests/sql.test.js` | **以 PGlite（PostgreSQL 16 WASM）實跑 `schema.sql` ＋ `seed.sql` ＋ `init.sql`**，驗證檢視表、RPC、RLS 政策、一鍵初始化檔、**舊版資料庫就地升級**（缺欄位／缺表／舊 CHECK 跑一次即可補齊；重新初始化種子資料不會清掉實地考察紀錄）、**官方胸徑／胸圍入庫與多主幹株數**，以及**健康檢查探測清單與綱要一致**（逐一在真資料庫上執行探測查詢，避免誤報「資料庫需要升級」） | 33 |
| `tests/api.test.js` | 啟動真實伺服器打 13 個端點，對照 CSV 直接計算的結果，檢查內部一致性（含 `/api/tree?no=` 與路徑形式一致、**官方胸徑／胸圍**、**主題路綫一定要產生停靠站**） | 16 |
| `tests/supabase-path.test.js` | **Supabase 模式的查詢形狀**：以假的 `fetch` 攔截 PostgREST 請求，驗證 `allTrees()` 送出的欄位含座標（線上事故：曾誤用只回散佈圖欄位的 `rpc_scatter`，候選古樹全被濾掉，路綫推薦回 `route: null`）；**官方值優先也要在 Supabase 模式成立**（查詢必須取 `official_grade`／`official_health`；用官方分級／健康狀況篩選時，SQL 端不得再帶該條件，改由 JS 以顯示值篩選，否則會漏掉 #1132 這種名錄值與官方現行值不同的株；**`getTree()` 也必須走正常化**——Supabase 分支曾繞過 `normalizeTreeRow()`，導致線上單株詳情仍顯示《名錄》舊分級，而本機示範模式測不到）；**樹齡**：查詢要取 `official_age_years`，且年齡區間條件不得交給 SQL（否則用 115–120 年會漏掉 DB 寫 155 年的 #619） | 6 |
| `tests/pwa.test.js` | **離線 PWA**：manifest 欄位與圖示尺寸（實際讀 PNG 標頭比對）、`sw.js` 預載清單與實際檔案同步（重跑產生器必須無差異，且逐一以 HTTP 確認 200）、`index.html` 引用的每個本機資源都在預載清單內、只處理 GET、`/api/health` 不快取、照片與圖磚有上限、離線狀態文案（含「伺服器連不上但裝置有網路」的情況）、伺服器以正確 MIME 提供 `sw.js`／manifest | 16 |
| `tests/api-security.test.js` | API 安全測試（見下） | 12 |
| `tests/router.test.js` | **路由結構守門**：`api/` 只能有一個 Serverless Function（Vercel Hobby 上限 12）、路由表與 `lib/routes/` 一致、動態參數與 404 行為、單段落＋查詢參數形式、**前端不得出現多段落呼叫**、`vercel.json` 的 rewrite；**每個路由 id 都必須能以字面字串載入模組**（線上唯一入口走 `loadRoute()`，本機 dev-server 會用 `opts.handler` 繞過，曾因此讓 `/api/priority` 上線即 500）、**不傳 handler 也要能分派** | 9 |
| `tests/diagnostics.test.js` | **錯誤診斷**：資料庫錯誤分類（缺資料表／欄位／函式／權限／連線）、`errText` 不會產生 `[object Object]`、public 5xx 才原樣回傳訊息、`/api/health` 的結構自我檢查、前端所有錯誤顯示都經過 `errText` | 17 |
| `tests/secrets.test.js` | 機密掃描：掃描所有 git 追蹤檔案，出現 JWT 形式金鑰、真實 Supabase 網址或未忽略的 `.env` 即失敗 | 3 |
| `tests/iam.test.js` | 市政署官方資料整合：658 筆對上、座標全部 official、照片檔存在不破圖、官方欄位已進快照與 seed.sql、**胸徑／胸圍 658/658 官方值**、**多主幹取最大胸徑那支且逐支保留**、**官方資料履歷（`lib/data-meta.js`）雜湊必須與 `data/` 同步** | 12 |
| `tests/ui.test.js` | 裝置適配（viewport／theme-color／深色模式／手機斷點／觸控目標／輸入框 16 px／列印樣式），並守住**表格內插陣列必須 `join`**（否則會出現一整排逗號）、圖表小結數量與模態框層級、**胸徑胸圍不得自行換算**、**空路綫必須顯示訊息而不是拋錯**、**介面不得出現「作業」字眼**（網站不是寫給評分者看的，措辭一旦洩漏來源就會讓老師誤會） | 21 |
| `tests/field.test.js` | 實地考察：API 清單與新增、輸入驗證（必填、健康值、數值範圍、長度截斷）、`schema.sql`／`init.sql` 含 `field_records`、前端分頁與地圖入口串接；**「已上線／規劃中」兩段不得把做完的事留在待辦**（三項已完成各須有可點入口） | 11 |
| `tests/qr.test.js` | 二維碼：標準尺寸公式、三個定位圖案、時序圖案、靜區、決定性、資料過大時明確報錯、URL 產生器（絕對網址／特殊字元編碼）、SVG 與下載檔格式、**658 株全部試算一次** | 11 |
| `tests/priority.test.js` | **優先保育名單**：五項權重合計 100、各項門檻與分數刻度邊界（75／60／45）、缺值必須中性計分（`Number(null)===0` 的陷阱）、名次規則可重現、**分級鐵律**（程式與介面不得出現 S／A／B／C 級或 `tier` 欄位；官方分級與健康狀況以外的值不得進入名單；官方分佈必須與來源檔一致）、**KPI 株數必須數字相加**（`num(1)+num(6)` 會變 "16"）、官方分級／健康狀況篩選、方法說明必含分級政策與「冠幅未列入」「非官方認定」「分數段落不是級別」、**以真實 658 筆資料評分**（515 年一級瀕危株必須在前 3 名）、`/api/priority` 實跑、前端與列印串接、**內插陣列必須 join** 的靜態守門、列印頁數＝2＋名單分頁 | 24 |
| `tests/monitoring.test.js` | **監測時間序列**：序列組成（《名錄》版本無日期、視為最早；排序正確）、**缺值不得內插或用平均補值**（只比較兩邊都有值的欄位）、趨勢擬合邊界（點數不足／跨距 < 30 天只說明原因、給得出每年變化量與 R²）、異常規則（胸徑減少 ≥ 0.5 公分、樹高減少 ≥ 0.2 公尺、實地看到的健康惡化列「需確認」；官方值變動只列資訊）、複查提醒（> 730 天）、**真實資料**（#1132 官方分級三級→不分級；全站變動株數必須等於名錄與官方現行值的差異株）、**官方快照產生器 `--check`**、`/api/monitoring` 實跑（含 404 與**回應契約：`changes` 必須是陣列**——曾誤改成筆數，前端 `.map` 直接 TypeError 讓整頁掛掉）、分頁接線與 Service Worker 預載；**官方樹齡更新**（#619 155→115 年列為官方資料更新而非異常） | 18 |
| `tests/official-values.test.js` | **官方值優先**：`officialFirst()`（官方現行值優先、名錄值保留在 `listing_*`、缺官方值才回退、`null` 不拋錯）、**#1132 這一株**（顯示不分級、名錄值三級仍留存、官方胸徑 12.00／14.00 與胸圍 37.7／44.0、代表值取最大胸徑那支、胸圍與官方胸徑自洽）、658 株顯示值必須等於官方值、**官方與名錄的差異必須剛好是這 5 株**（1 株分級＋4 株健康狀況，資料一變就提醒重新核對）、**統計與篩選同源**（不分級 5 株含 #1132；堂區統計總和必須等於總覽）；**樹齡同樣官方值優先**（#619 顯示 115 年、名錄 155 年保留、`min_age=150` 不得篩出它、`max_age=120` 要篩到它、平均樹齡 133.2） | 8 |
| `tests/card.test.js` | 列印模組：官方缺值一律標「官方未提供」（不補造）、查核清單規則、A4 頁面結構（每張卡就是一個 `.card-page`）、**路綫資料冊頁數＝站數＋1**、**路綫下拉不得出現「（0 站）」（顯示路綫自己的停靠上限，名稱必須跳脫）**、站點示意圖落在紙內且比例尺合理、二維碼指向正確網址、**所有欄位都經過跳脫（紙本也是注入點）**、極端輸入（空物件／超長描述／缺照片）不拋錯、右半邊站名不得畫出框外、**胸徑胸圍採官方值（多主幹加註）**、座標精度以中文呈現 | 26 |

### API 安全測試涵蓋範圍

- **SQL／指令注入**：14 種注入字串（`' OR 1=1 --`、`'; DROP TABLE`、`UNION SELECT`、時間盲注等）注入所有字串參數，驗證資料筆數不變、服務正常、錯誤訊息不洩漏 schema。
- **反射式注入**：動態路由不吃使用者輸入，錯誤訊息不回顯原始輸入。
- **路徑穿越**：`../`、`%2e%2e`、`%2f`、`..\` 等組合無法讀取專案或系統檔案。
- **參數邊界／汙染**：`limit` 上限夾制（≤2000）、負數、`NaN`、超長字串、重複參數（HPP）皆不造成崩潰或無上限回應。
- **HTTP 方法**：不支援的方法不產生寫入，狀態碼正確。
- **資訊洩漏**：回應標頭不洩漏伺服器資訊；不包含環境變數、金鑰或 JWT；錯誤訊息結構化且不含堆疊。
- **前端轉義**：`esc()` 與 `safeUrl()` 對 XSS payload 與 `javascript:` URL 的處理。
- **前端不持有金鑰**：掃描 `public/js/*.js` 與 `index.html`，確認無 Supabase 端點、無 `createClient`、無 JWT。
- **內容安全**：科普文章的 Markdown 不含遠端腳本或外部追蹤。

### 前端渲染驗證

`scripts/verify-ui.sh <port>` 以無頭 Chrome 抓取五個分頁渲染後的 DOM，確認 JavaScript 真的執行、圖表與地圖標記真的產生（而非只檢查原始碼）。實測結果：總覽 5 張圖表、地圖 658 個標記、分析頁 5 張圖表。

### 列印模組驗證（不是「看起來可以印」）

除了 `tests/card.test.js` 的純函式測試，另以無頭 Chrome 實際渲染並用 `--print-to-pdf` 產生真正的 PDF，再用 `pypdf` 檢查頁數、紙張尺寸（595×842 pt＝A4）與文字內容：

```bash
node scripts/dev-server.mjs 3370 &
python3 scripts/card-check.py 3370   # 三種模式的 DOM 檢查（頁數、二維碼、欄位）
pip install pypdf                     # 需要 pypdf 讀 PDF
python3 scripts/card-pdf.py 3370      # 產生 PDF 並檢查頁數／A4 尺寸／關鍵文字
```

實測：單株檔案卡 1 頁、考察單 1 頁、路綫資料冊 11 頁（封面＋10 站），紙張尺寸全部為 A4，且每頁文字都抽得出來（代表不是空白頁）。

### 二維碼「真的掃得出來」驗證

矩陣結構正確 ≠ 手機掃得出來，所以除了 `tests/qr.test.js` 的結構檢查，另有獨立解碼驗證：

```bash
node scripts/qr-roundtrip.mjs     # 產生 SVG，再用無頭 Chrome 轉成 PNG（輸出到 .qr-check/）
pip install opencv-python-headless
python3 scripts/qr-decode.py .qr-check   # 用 OpenCV（與本專案無關的實作）解碼並比對原文
npm run qr:verify                 # 等同上面兩步
```
取樣包含固定編號、最老一株、官方照片已下架的一株、編號最大的一株，每株各產生「詳情」與「實地考察」兩種碼。

### 「跑完 JavaScript 之後」的頁面驗證

`--dump-dom` 配 `--virtual-time-budget` 會在第一次繪製就輸出，非同步的工作（抓 API、畫圖、Service Worker 接管）
常常還沒定案——本站就曾因此在驗證時把「載入中的錯誤卡」當成正常結果放過。因此新增
`scripts/cdp-check.mjs`：以 Chrome DevTools Protocol 連上頁面，**等到指定字串真的出現（或逾時）才輸出**，
同時把 console 錯誤與未捕捉例外一起印出來（離開碼 1 代表有片段沒出現或有 JS 錯誤）：

```bash
node scripts/dev-server.mjs 3463 &
node scripts/cdp-check.mjs "http://127.0.0.1:3463/#/chemistry" \
  --wait "17.3" --wait "降雨酸鹼度" --dump /tmp/chem.txt --screenshot /tmp/chem.png
node scripts/cdp-check.mjs "http://127.0.0.1:3463/#/map?tree=619" --wait "環境背景"
```

> 支援 `--wait`（可重複）、`--selector`、`--dump`（把畫面文字存檔）、`--screenshot`、`--timeout`、`--json`。
> 另有 `scripts/dom-grep.sh`（同概念的精簡版）與 `scripts/shot.sh`（只截圖）。

`scripts/ui-audit.sh <port>` 是**裝置適配稽核**：在 360／390／414／834／1440 px 與深淺色共 50 組組合下，量測頁面橫向溢出、元素溢出、觸控目標高度、文字輸入框字級、統計卡欄數、地圖是否排到最前、頁籤是否改為橫向滑動。因為無頭 Chrome 的視窗寬度下限約 500 px，量測在**同源 iframe** 內進行（寬度才真正可控）：

```bash
node scripts/dev-server.mjs 3351 &
bash scripts/ui-audit.sh 3351          # 有問題時離開碼為 1
```

---

## 十一、離線使用與安裝（PWA）

野外考察常常沒有訊號，因此網站是可安裝的離線應用（Progressive Web App）。

### 使用方式

1. **手機安裝**：以 Chrome（Android）或 Safari（iOS）開啟 `https://old-trees-mylearning.vercel.app`，
   選單選「加到主畫面／安裝應用程式」，之後從主畫面圖示開啟即為獨立視窗（不顯示瀏覽器網址列）。
2. **離線瀏覽**：第一次連線時，介面（HTML／CSS／16 個前端模組／vendor／圖示，共 59 項）會存到本機。
   之後即使完全斷網，仍可開啟網站、切換分頁、查看上次的統計與清單。
3. **狀態徽章**：頁首右上角有一顆可點的徽章 —— 「離線可用」／「離線準備中」／「離線模式」／「有新版本」。
   點開可看已快取項目數、**清除離線快取**、**安裝到主畫面**。

```bash
node scripts/build-sw.mjs          # 重新產生 sw.js 的預載清單與快取版本（改動前端檔案後要跑）
node scripts/build-sw.mjs --check  # 只檢查是否同步（測試會用這個）
npm run pwa:check                  # 真實斷網測試：關掉伺服器後頁面是否仍開得起來
```

### 快取策略

| 對象 | 策略 | 上限 |
| --- | --- | --- |
| 導覽（HTML） | 先網路、失敗回快取的 App shell | 1 份 |
| `/api/*`（除 `/api/health`） | stale-while-revalidate：先回上次結果、背景更新 | 依瀏覽器額度 |
| `/photos/*`（古樹照片） | cache-first，只存看過的 | 150 張，超過自動修剪 |
| OpenStreetMap 圖磚 | cache-first，只存看過的（**不批量下載**，遵守 OSM 政策） | 200 張 |
| `/api/health` | 不快取 | — |
| `POST`（實地考察送出） | 不介入，一律走網路 | — |

> 快取名稱帶版本（`mht-shell-v0.8.0`…），新版本啟用時會自動刪掉舊版快取；`sw.js` 的版本由
> `scripts/build-sw.mjs` 依 `lib/repo.js` 的 `API_VERSION` 自動同步，不會出現「改了程式但使用者拿到舊快取」。

### 已知限制

- **只有看過的區域能離線看地圖**：圖磚僅快取使用者實際瀏覽過的（不提供全澳離線圖磚包）。
- **第一次就是離線狀態**：從未連上過本站時 service worker 還沒安裝，會顯示自製的 `offline.html`
  （連上網路一次之後才有離線能力）。
- iOS Safari 以 `apple-touch-icon` 顯示圖示，不支援 `shortcuts` 長按捷徑。
- 裝置有網路但伺服器連不上時（公司網路攔截、伺服器重啟），徽章同樣會顯示「離線模式」並說明
  顯示的是快取資料 —— 這個判斷來自 `api.js` 回報的實際請求結果，不是 `navigator.onLine`。

## 十二、優先保育名單（評分方法）

有限的養護人力與預算要先用在最急迫的樹上。本頁用五個面向、合計 **100 分** 為 658 株排序：

| 面向 | 權重 | 規則 |
| --- | --- | --- |
| 樹齡 | 30 | ≥300 年 30 分／200–299 年 25 分／150–199 年 19 分／100–149 年 13 分／50–99 年 7 分／<50 年 3 分 |
| 官方健康狀況 | 25 | 瀕危 25 分／一般 12 分／健康 5 分 |
| 官方分級 | 20 | 一級 20 分／二級 14 分／三級 6 分／不分級 0 分 |
| 樹種稀有度 | 15 | 全澳名錄僅 1 株 15 分／2–3 株 12 分／4–10 株 9 分／11–30 株 6 分／31–100 株 3 分／>100 株 1 分 |
| 區位風險 | 10 | 車道、人流與設施周邊（馬路、圓形地、酒店、學校、街市…）10 分／公園、前地、街巷 6 分／郊野、山徑、海灘 3 分 |

**分數刻度**（純閱讀分段，**不是級別**）：75 分以上／60–74 分／45–59 分／45 分以下。
**名次規則**：分數高者在前 → 同分時樹齡高者在前 → 再同則樹號小者在前（結果可重現）。

> **分級鐵律（v0.10.0 起）**：本平台**不自行分級**。畫面上的「健康」與「分級」兩欄
> 都是市政署名錄的官方欄位（健康／一般／瀕危；一級／二級／三級／不分級，官方未列級者顯示「官方未列級」），
> 篩選條件也只用官方值。0–100 分是排序工具，不會改變任何一株的官方級別。
> 程式與介面上任何自訂等級字樣（S／A／B／C 級、`tier` 欄位）都由 `tests/priority.test.js` 擋下。
>
> **官方值優先（v0.11.0 起）**：官方有兩個來源不總是一致——《古樹名錄》CSV 與市政署自然網現行值。
> 兩者不一致時，畫面與統計**一律採用自然網現行值**，CSV 值保留在 `listing_grade`／`listing_health`
> 並在單株詳情的「資料核對」標明差異。實例：#1132（14 年的華潤楠）名錄寫「三級」（該級距為 100–299 年），
> 自然網現行為「不分級」且官方 5 株不分級的樹齡都在 6–35 年 → 採自然網值。
> **樹齡同樣比照辦理（v0.11.2 起）**：名錄 #619 寫 155 年、市政署自然網現行為 115 年 → 顯示、統計、
> 篩選與優先保育評分一律採自然網現行值，名錄值保留在 `listing_age_years`。
> 因此「最老 10 株」「平均樹齡」「年齡區間篩選」與分析結果都以官方現行樹齡計算
> （平均樹齡由 133.28 年變為 133.22 年）。
> 目前全部 658 株中僅 1 株分級（#1132）、4 株健康狀況（#548／#627／#638／#641）、1 株樹齡（#619）有此差異，
> 由 `tests/official-values.test.js` 逐筆看守。

設計上的三個原則（與專案其他部分一致）：

1. **只用官方欄位**推導，不估算、不補造：樹齡、健康、級別、地點文字全部取自市政署名錄的公開資料。
2. **缺值以中性計分**，不當 0 分也不給滿分（否則會變成「沒量測的樹自動高分或低分」）。冠幅只有 67 株有值，因此**不列入評分**。
3. **每一株都要說得出為什麼**：畫面上每一列都列出前三項配分與完整五項配分明細，紙本名單則附評分方法頁。

> 分數是**本平台的相對排序工具，不是市政署的官方認定**；實際養護決策仍應以現地檢查為準。
> 區位風險由「地點名稱文字」推斷，只能反映概略環境，不等於現場危害評估。

實作：`lib/priority.js`（純函式，回傳逐項配分與理由）、`lib/routes/priority.js`（`GET /api/priority`）、
`public/js/priority.js`（分頁）、`public/js/card.js` 的 `priorityListHtml`（A4 名單，每頁 40 列）。

### 實際結果（2026-09 官方資料）

- 658 株受評，平均 41.3 分；分數分佈：**75 分以上 5 株、60–74 分 8 株、45–59 分 167 株、45 分以下 478 株**。
- 官方分級分佈：一級 1、二級 6、三級 646、不分級 5；官方健康狀況：健康 215、一般 422、瀕危 21（畫面上的數字與官方來源檔逐筆一致）。
- 前 3 名：#981 桑（315 年・官方健康狀況 瀕危・官方分級 二級・91 分）、#544 海南蒲桃（515 年・瀕危・一級・87 分）、#543 海南蒲桃（495 年・瀕危・二級・81 分）。

---

## 十三、官方資料自動擷取與資料履歷

官方名錄會變（新登錄、健康狀況更新、植株移除），所以不能只靠人手重抓。

| 機制 | 位置 | 說明 |
| --- | --- | --- |
| 每日自動擷取 | `.github/workflows/refresh-official-data.yml` | 每天 04:20（澳門時間）抓 `https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json`（不含照片） |
| 變更偵測 | 同上的 `diff` 步驟 | **只比對官方名錄內容**；內容沒變就還原痕跡、不提交、不重新部署 |
| 官方觀測快照 | `data/observations/`（`scripts/snapshot-observations.mjs`） | 官方只公布現行值、沒有歷史值，所以**每次官方內容變更就存一份帶日期的快照**，成為監測時間序列的第二個時間點；內容沒變不重複存檔（以監測欄位的內容雜湊判斷） |
| 內容有變時 | 同上 | 存入官方觀測快照 → 重建 `supabase/seed.sql`、前端快照、`lib/data-meta.js` → 先跑 `npm test` → 提交推送 → Vercel 自動重新部署 |
| 資料庫同步 | GitHub Issue 通知 | Supabase 需重跑 `supabase/init.sql`（SQL Editor 手動執行，本站不保管資料庫金鑰） |
| 資料履歷 | `lib/data-meta.js`（由 `scripts/gen-data-meta.mjs` 產生） | 來源、清單端點、擷取時間、筆數、照片數、內容雜湊 |
| 前端顯示 | 總覽頁「資料方法說明」 | 顯示**官方資料擷取時間**與內容雜湊，任何人一眼可驗資料新舊 |

手動執行（需要立刻更新時）：

```bash
npm run build:data-meta   # 只更新履歷（會驗證是否與 data/ 同步）
npm run refresh:official  # 重抓官方名錄 → 重建種子檔／快照／履歷／sw.js（完整一輪）
```

`tests/iam.test.js` 會驗證 `lib/data-meta.js` 的內容雜湊與 `data/iam_trees.json` 一致——
抓了新資料卻忘了更新履歷（或反過來）都會讓 `npm test` 紅燈。

## 十四、疑難排解（部署後常見狀況）

### 症狀：某些分頁出現「伺服器處理請求時發生錯誤」，實地考察頁寫「無法連線 API」

**原因幾乎都是「程式碼是新的、資料庫還是舊版結構」**：舊資料庫少了後來新增的
`field_records` 表或 `v_trees` 的部分欄位，查詢就會失敗。

**先看診斷資訊**：開 `https://<你的網址>/api/health`，回應中的 `schema` 會列出缺少的項目：

```json
{ "ok": false, "error_code": "db_schema_outdated",
  "error": "資料庫結構是舊版：缺少資料表 field_records，所以這個查詢無法完成。",
  "hint": "請在 Supabase Dashboard → SQL Editor 貼上並執行最新的 supabase/init.sql…",
  "schema": { "ok": false, "missing": ["資料表 field_records（實地考察）：Could not find the table …"] } }
```

網站也會在頁面最上方顯示「資料庫需要升級」提示（含可展開的缺少項目清單）。

**解法**：Supabase → SQL Editor → 貼上 `supabase/init.sql` 全文 → Run。
檔頭的「版本升級」段會自動補齊缺少的欄位、資料表與函式（可重複執行，不會弄丟實地考察紀錄）。
執行完重新整理，`/api/health` 的 `schema.ok` 應變成 `true`、`missing` 為空。

### 症狀：`ERROR: 42P16: cannot change name of view column "species" to "tree_geo_precision"`

**原因**：`CREATE OR REPLACE VIEW` 只能「在既有欄位後面追加」，不能改變既有欄位的位置或名稱。
舊版 `v_trees` 的第 10 欄是 `species`，新版同一位置是 `tree_geo_precision`，舊資料庫重跑時就報 42P16。
（同理，函式回傳型別改變時 `CREATE OR REPLACE FUNCTION` 會報 42P13。）

**解法**：`supabase/schema.sql` 的檢視表段落現在**先 `drop view … cascade` 再重建**，
並用 DO 迴圈刪除本專案的 `rpc_*` 函式後重建，因此**直接重跑 `supabase/init.sql` 即可**。
若想單獨先修這一步，可先執行 `supabase/fix_42P16.sql`（只刪檢視表與函式，不動資料）。

驗證方式（PGlite 實跑，已納入 `tests/sql.test.js`）：把 `v_trees` 換成舊版欄位順序與舊版
`rpc_overview` 回傳型別後重跑 `init.sql`，必須成功重建且 `trees`／`v_trees`／`rpc_overview` 都恢復正常。

### 症狀：`ERROR: 23514: new row for relation "sites" violates check constraint "sites_geo_precision_check"`

**原因**：限制條件（CHECK）的**允許值**在版本間改變了。舊版 `sites.geo_precision` 只允許
`('exact','approx','parish')`，新版加入 `'official'`（市政署逐株座標）；舊資料庫的限制條件
仍然是舊的，seed 一寫入官方座標就違反。

**解法**：升級段落現在對本專案定義的 CHECK 條件一律**先移除再重建**（先前只「不存在才新增」，
因此永遠更新不到舊定義），並在重建前把超出新允許值的既有資料正規化：

```sql
if to_regclass('public.sites') is not null then
  update public.sites set geo_precision = 'approx'
    where geo_precision is not null and geo_precision not in ('official','exact','approx','parish');
  alter table public.sites drop constraint if exists sites_geo_precision_check;
  alter table public.sites add constraint sites_geo_precision_check
    check (geo_precision in ('official','exact','approx','parish'));
end if;
```

（`trees.grade`、`trees.health` 同樣處理。）已納入 `tests/sql.test.js` 回歸測試。

### 某些 API 端點在線上 404（「The page could not be found」），本機卻正常？

**Vercel 的萬用入口 `api/[[...route]].js` 實際上線時只匹配「一個」路徑段落**：
`/api/health`、`/api/trees` 正常，但 `/api/tree/544` 會直接被 Vercel 回 404，
連 Serverless Function 都進不去（本機 dev-server 走 `lib/router.js`，不受此限制，所以本機正常）。

v0.6.7 的三層修正：

1. 前端一律呼叫**單段落**端點：單株詳情改用 `/api/tree?no=544`（`public/js/api.js`）。
2. `lib/router.js` 同時支援 `/api/tree/:tree_no` 與 `/api/tree?no=…` 兩種形式。
3. `vercel.json` 加上 rewrite，把 `/api/tree/:no` 轉成 `/api/tree?no=:no`，
   讓 REST 形式在線上也可用。

`tests/router.test.js` 有兩項守門測試：解析 `public/js/api.js` 確認前端不得出現多段落呼叫；
並確認 `vercel.json` 的 rewrite 存在。

### 網站打開後被導到 Vercel 登入頁？

Vercel 專案的 **Deployment Protection** 開啟了（`Vercel Authentication`），
連正式網址都會要求登入 Vercel，老師與同學將無法開啟。
到 Vercel → 專案 → **Settings → Deployment Protection**，把
**Vercel Authentication** 設為 `Disabled`（只想保護預覽環境時選 `Standard Protection`），
存檔後重新整理即可。

### 畫面顯示「資料庫需要升級」，但 `init.sql` 已經跑完了？

先開 `https://<你的網址>/api/health` 看 `version` 與 `schema.missing`。

**2026-09-24 曾發生誤報**：健康檢查當時期待 `v_trees.photo_url`、`trees.species`、`routes.slug`
三個欄位，但綱要裡實際是 `v_trees.tree_photo`／`trees.species_id`／`routes.code`，
於是資料庫明明已升級完成，畫面仍一直顯示需要升級（v0.6.6 已修正）。
因此：**探測清單必須以真資料庫驗證**——`tests/sql.test.js` 現在會在 PGlite 上
逐一執行每個探測查詢，欄位或函式不存在就讓測試失敗；另有一項測試模擬
「舊庫缺欄位／缺表／舊 CHECK」跑完 `init.sql` 後所有探測項都必須通過。

### 錯誤碼對照

| `error_code` | 意思 | 下一步 |
| --- | --- | --- |
| `db_schema_outdated` | 資料庫缺少資料表／欄位／函式 | 重跑 `supabase/init.sql` |
| `db_permission` | 權限不足 | 確認 Vercel 的 `SUPABASE_SERVICE_ROLE_KEY` 是 service_role（不是 anon） |
| `db_unreachable` | 連不上資料庫 | 確認 `SUPABASE_URL` 正確、專案未被暫停 |
| `db_query_failed` | 其他資料庫錯誤 | 訊息中會附原始錯誤 |

> 一般 5xx 只回「伺服器處理請求時發生錯誤」以避免洩漏內部細節；但資料庫結構類的問題
> 屬於使用者必須自己處理的狀況，因此會帶 `code`／`hint` 原樣回傳（`err.public = true`）。
> 前端一律用 `errText()`／`errDetail()` 轉成可讀文字——**不會再出現 `[object Object]`**。

---

## 十五、資料來源與授權

| 項目 | 來源 |
| --- | --- |
| 古樹清單（658 筆，名錄值） | `source-data/古樹.csv`，整理自澳門市政署《古樹名木保護名錄》 |
| **古樹逐株官方資料** | **澳門市政署「澳門自然網」古樹名木專頁 `https://www.iam.gov.mo/nature/c/tree`**，資料端點 `https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json`（658 筆，含逐株座標、樹齡、樹高、冠幅、**胸徑（厘米）**、**胸圍（厘米）**、健康狀況、分級、堂區、地點、形態描述、市政署樹木編號與唯一識別碼） |
| **古樹官方照片（658 張）** | 同前專頁，`https://www.iam.gov.mo/nature/Content/OldTreesOnline/<影像檔>` |
| 法規與制度 | 第 11/2013 號法律《文化遺產保護法》、澳門特別行政區公報 |
| 品種學名 | Wikidata / Wikipedia（現行接受名）；市政署網站學名以 `name_sci_official` 並列 |
| 相片 | 古樹照：澳門市政署；品種／地點照：Wikimedia Commons（各圖附作者與授權，多為 CC BY-SA 4.0 或公有領域） |
| 座標 | 市政署逐株座標（`geo_precision = 'official'`）；無法取得者才回退 OpenStreetMap Nominatim ＋ 人工校核 |
| 地圖圖磚 | © OpenStreetMap contributors |
| **官方觀測快照** | 本平台每日擷取時自行存檔（`data/observations/`）：官方只公布現行值、沒有歷史值，故由本站記錄「官方資料在何時變成什麼」，作為監測時間序列的來源；快照內容全部是官方值，未經修改 |

### 兩份官方資料的核對結果

《古樹名木保護名錄》整理之 `古樹.csv` 與市政署網站現行公布值，658 株中：

- **樹齡 1 株不同**（#619：名錄 155 年／市政署 115 年）、**健康狀況 4 株不同**（#548、#627、#638 等由「一般」改列「健康」）、**分級 1 株不同**（#1132 由三級改列不分級）。
- **本站的分級與健康狀況一律以市政署自然網「現行值」為準**（v0.11.0 起；統計、篩選、列印與名單全部同源），《名錄》原值保留在 `listing_grade`／`listing_health`，單株詳情的「資料核對」區塊會並列兩者，不隱藏差異。
- **樹齡也以市政署自然網「現行值」為準**（v0.11.2 起，與分級、健康狀況一致）：#619《名錄》155 年／市政署 115 年 → 顯示、統計、年齡篩選、優先保育評分與分析全部採 115 年，《名錄》原值保留在 `listing_age_years` 並在「資料核對」標明。樹高仍呈現《名錄》值（差異同樣標明）。
- **學名 14 個物種**出現版本差異（例：`Triadica sebifera` ←→ 市政署 `Sapium sebiferum`）：本站採現行接受名，市政署名以 `name_sci_official` 並列保存。
- **胸徑／胸圍一律採用市政署官方值**（658/658 皆有值），平台不自行由胸徑換算胸圍。
  官方這兩個欄位在**多主幹**古樹是「逗號並列的每支主幹量測值」（658 株中有 290 株如此），平台的做法是：
  取**胸徑最大那支**作為代表值、胸圍取同一支主幹的值（官方兩個清單逐支對應），並在 `stem_measures` 完整保留逐支數值，
  介面與列印卡片都會標示「N 支主幹，取最大胸徑那支」與逐支清單 —— 不平均、不估算、不換算。
- 官方欄位覆蓋率不一：形態描述與座標 658/658、胸徑與胸圍 658/658、官方照片 657/658、冠幅僅 67 株有值 —— 缺少處不補造數據，前端改顯示樹種相片或直接省略該列。

科普文章的每一篇都附有 `sources` 欄位列出參考來源。**古樹照片與資料著作權屬澳門市政署**，本站為非商業教學研究用途並逐一標示出處；相片版權歸原作者所有，使用時請保留標示的作者與授權資訊。

---

## 十六、監測時間序列

一株古樹的變化，只有「同一株、不同時間的兩次觀測」才說得出來。本站把三個有出處的來源接成一條序列：

| 來源 | 內容 | 時間點 |
| --- | --- | --- |
| `listing` | 《古樹名錄》CSV 的官方值 | 較早的官方版本（未載日期，視為最早） |
| `official` | 市政署自然網現行值，**逐次快照存檔**（`data/observations/`） | 每次官方名錄內容變更時存一份帶日期的快照 |
| `field` | 師生實地考察紀錄（`field_records`） | 觀察日期、觀察者、天氣、健康狀況、樹高／胸徑／冠幅、立地與病蟲害紀錄 |

每一株算出的東西：觀測點清單、逐次差異（胸徑／樹高／健康狀況／官方分級）、線性趨勢（每年變化量與 R²）、異常與複查提醒。

### 規則（全部可解釋，沒有黑箱）

| 判斷 | 門檻 | 等級 |
| --- | --- | --- |
| 胸徑較前次減少 | ≥ 0.5 公分 | 需確認（warn） |
| 樹高較前次減少 | ≥ 0.2 公尺 | 需確認（warn） |
| 健康狀況轉差且來源是實地考察 | 官方健康／一般／瀕危 的位階下降 | 需確認（warn） |
| 健康狀況轉差但來源是官方 | 同上 | 資訊（info）——官方資料更新，不是我們判定的異常 |
| 官方分級變動 | 例：三級 → 不分級 | 資訊（info） |
| 官方樹齡更新 | 例：#619 155 → 115 年 | 資訊（info）——官方資料更新 |
| 距上次觀測超過 730 天 | — | 提醒複查 |

- **缺值不做內插、不用平均值填補**：只比較「兩邊都有值」的欄位；缺值就顯示「—」。
- **不硬湊趨勢**：可量測的時間點不足兩個，或觀測跨距 < 30 天，就只顯示「無法擬合」並寫出原因（例如「只有官方兩個時間點且其中一個無日期」）。
- **官方變動 ≠ 異常**：官方分級或健康狀況改變屬「官方資料更新」，會列出但不列入「需確認」。

### 為什麼序列一開始就有一組可比對的官方時間點

官方網站只提供現行值，沒有歷史值。本站的做法是：

1. 《古樹名錄》CSV 視為**較早的官方版本**，作為第一個時間點；
2. 每日擷取偵測到官方名錄內容變更時，`scripts/snapshot-observations.mjs` 會存一份
   `data/observations/<日期>.json`（只存監測欄位：健康狀況、分級、樹齡、樹高、胸徑、胸圍、冠幅），
   並重建 `lib/official-history.js` 供前端與 API 使用；**內容沒變不重複存檔**（以內容雜湊判斷），
   所以不會出現一年 365 份一樣的快照。

因此目前 658 株中已有 **6 株**看得到真實的官方變動（`#1132` 分級三級→不分級，`#548`／`#627`／`#638`／`#641` 健康狀況一般→健康，`#619` 樹齡 155→115 年），
其餘株的序列會隨每日擷取與實地考察逐步累積——**這是設計上的必然，而不是資料缺漏**。

### 相關檔案

`lib/monitoring.js`（純函式：序列／差異／趨勢／異常）、`lib/routes/monitoring.js`（`GET /api/monitoring`）、
`public/js/monitoring.js`（監測分頁）、`scripts/snapshot-observations.mjs`（觀測快照產生器）、
`data/observations/`＋`lib/official-history.js`（快照資料）、`tests/monitoring.test.js`（18 項）。

---

## 十三、化學視角（作業要求 F）

作業第 3 點 F 要求「針對 A–D 選一點做化學視角分析補充（土壤酸鹼、礦物成分差異影響物種分佈；
市區水泥滲出物改變土壤化學環境；合適土壤化學條件對保育的影響）」。本站把它做成一個分頁，
而不是寫在報告裡的一段文字，讓每個數字都能回查。

### 資料從哪來（每一項都有出處）

| 內容 | 官方／文獻來源 |
| --- | --- |
| 六站 × 六污染物年平均濃度（2024、2025）與年平均標準（PM10 50、PM2.5 25、NO₂ 40 µg/m³） | 澳門環境保護局《澳門環境狀況報告2025》數據資料 1 |
| 2025 年各站空氣質量水平日數、2006–2025 歷年日數、2025-04-12～16 沙塵事件 | 地球物理暨氣象局《澳門空氣質量監測統計年度報告 2025》 |
| 降雨酸鹼度：1990–1999 年均 pH 4.44–4.86、硫酸根／硝酸根、1999 年最低 pH 3.1 | 《澳門環境狀況報告》2.1.2 空氣質量；陳錫僑〈澳門的酸雨〉（整理官方降雨監測） |
| 土壤與水泥機制（鋁毒、碳酸鹽緩衝、水泥氫氧化鈣與碳酸化、鋪面阻斷水氣） | 《澳門環境狀況報告2007》第五章；《土壤學報》2023；《環境工程技術學報》2021；《土壤科學》2025 |

### 誠實原則（這一頁最重要的部分）

1. **官方查不到的就寫「查不到」**：澳門 2000 年以後的官方公開降雨 pH 年值、官方逐點土壤理化數據，
   都找不到——因此頁面上直接寫明缺口，**不填任何自造數值、不用鄰近地區數字代替**。
2. **不換算、不內插、不平均**：數值一律照登官方公布值，只顯示到**小數第一位**（曾把 PM2.5 的 17.3 印成 17）。
3. **區域背景 ≠ 單株實測**：單株詳情顯示的是「該株所在區域官方監測站的年均值」，頁面上必須寫清楚。
4. **相關不等於因果**：區域空污背景與官方健康狀況只是「並列對照」，表格同時列出**各區平均樹齡**，
   讓讀者看見樹齡這個干擾因素，頁面明示不作因果結論。
5. **明列「本頁沒有的東西」**：沒有官方逐點土壤理化與礦物成分數據集、沒有實地採樣，
   因此不以數據推論物種分佈，只在科普文章中說明機制與文獻看法。

### 資料更新流程

```bash
# data/env_chem.json 是人工整理的官方數據節錄（每項附出處與網址）
npm run build:env      # → data/env-chem-data.js（附內容雜湊，頁面與 API 都會顯示）
npm run build:init     # schema.sql ＋ seed.sql → supabase/init.sql
node scripts/cdp-check.mjs "http://127.0.0.1:3463/#/chemistry" --wait "17.3"
```

`node scripts/gen-env-chem.mjs --check` 與 `node scripts/gen-init-sql.mjs --check` 會在 `npm test` 中執行，
確保「改了資料卻忘了重跑產生器」一定會紅燈。

### 相關檔案

`data/env_chem.json`（人工整理的官方數據，附出處）、`scripts/gen-env-chem.mjs`（產生器）、
`data/env-chem-data.js`（產生檔，含內容雜湊）、`lib/env-chem.js`（純函式：概況／各站矩陣／AQI／酸雨／機制／區域背景）、
`lib/routes/env-chem.js`（`GET /api/env-chem`）、`public/js/chemistry.js`（化學視角分頁）、
`public/js/map.js` 的「環境背景」區塊、科普第 12 篇〈化學視角：酸雨、土壤酸鹼與水泥如何影響澳門古樹〉、
`tests/env-chem.test.js`（16 項）。

---


## 授權

程式碼以 MIT 授權釋出。資料與相片之權利依其原始來源標示。
