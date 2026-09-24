# 澳門古樹保育研究平台 · Macau Heritage Tree Conservation Platform

以《古樹保育研究(1).docx》所列題目為綱，把 **658 株澳門古樹名木**整理成一個可查詢、可分析、可導覽的資料庫網站。

- **資料庫**：Supabase（PostgreSQL 15+）
- **部署**：Vercel Serverless Functions（`/api/*`）＋ 靜態前端（`public/`）
- **前端**：原生 ES Modules、Leaflet（地圖）、Chart.js（圖表）、KaTeX ＋ marked（科普文章）
- **原始資料**：`source-data/古樹.csv`（658 筆）、**澳門市政署「澳門自然網」古樹名木專頁（658 筆逐株資料與官方照片）**、《古樹保育研究(1).docx》（需求文件）

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
11. [資料來源與授權](#十一資料來源與授權)

---

## 一、線上功能

網站分為六個分頁：

| 分頁 | 內容 |
| --- | --- |
| **總覽** | 關鍵指標、**各堂區古樹數目分佈圖**、品種排行、健康狀況與分級結構、最老 10 株、瀕危關注名單、**古樹名目分區表**、原始資料 CSV 下載 |
| **地圖查詢** | 658 株古樹地圖（叢集標記、顏色代表健康狀況）；以堂區／品種／分級／健康／樹齡區間／關鍵字篩選；地圖任意點擊設定中心做**半徑搜尋**；點擊標記看單株詳情（含相片、同地點鄰居），並可直接為該株新增實地考察紀錄 |
| **路綫推薦** | 5 條精選路綫（列表顯示站數、距離、步行時間），或以堂區／品種／主題即時生成自訂路綫；地圖繪製路徑與編號站點，並提供 Google Maps 導航連結 |
| **數據分析** | 描述統計、5 個數學模型擬合比較（線性／對數／冪律／飽和指數／含品種啞變數迴歸）、ANOVA、卡方檢定、存續預測曲線、可下載的分析資料 CSV；**每張分析圖皆附一段「小結」說明** |
| **實地考察** | 現場記錄表單（古樹編號、觀察日期、記錄者、天氣、健康狀況、樹高／胸徑／冠幅、立地環境、病蟲害與損傷、照片、座標一鍵定位）、紀錄清單與 CSV 匯出、現場檢查清單與安全提醒；紀錄存於 `field_records` 表，官方名錄不會被覆寫 |
| **保育科普** | 11 篇繁體中文專題文章（含 KaTeX 數學式）、立法時間線、每篇附參考來源 |

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
Vercel Serverless Functions（api/*.js，Node.js 20+）
   │  lib/repo.js  資料存取層（雙驅動）
   ├──► Supabase PostgreSQL ── 正式模式
   │      （supabase-js ＋ service_role，僅在伺服器端）
   └──► data/snapshot.json ── 示範模式（未設環境變數時）
```

- **無 SQLite**：資料庫只有 Supabase（PostgreSQL）一種；`data/snapshot.json` 是同源唯讀快照，讓專案在沒有資料庫連線時仍可完整展示，並非替代資料庫。
- **前端零依賴外部 CDN**：Leaflet、Chart.js、marked、KaTeX 全部置於 `public/vendor/`。

### 目錄結構

```
macau-heritage-trees/
├── api/                    Serverless Functions（12 個端點）
│   ├── _lib/               共用中介層
│   └── tree/[tree_no].js   動態路由
├── lib/                    analysis.js｜geo.js｜repo.js｜http.js
├── public/                 前端（index.html、css/、js/、photos/、vendor/）
│   └── photos/trees/       658 張古樹官方照片（市政署，縮圖）
├── supabase/
│   ├── schema.sql          資料表、檢視表、RPC、RLS（可直接貼進 Supabase SQL Editor）
│   ├── seed.sql            658 筆古樹（含官方座標／照片／描述）＋ 品種 ＋ 地點 ＋ 文章 ＋ 時間線
│   └── init.sql            schema.sql ＋ seed.sql 合併檔（一鍵初始化）
├── data/                   建置產物（snapshot.json、iam_trees.json、conservation.json、species.json…）
├── scripts/                資料處理（Python：fetch_iam／geocode／content／build_seed）＋ 開發伺服器＋驗證腳本（Node）
├── source-data/            原始 CSV 與 docx
└── tests/                  6 組測試（統計／SQL／API／安全／機密／官方資料）
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

| 端點 | 說明 |
| --- | --- |
| `GET /api/health` | 健康檢查：資料來源、古樹筆數 |
| `GET /api/meta` | 詮釋資料：堂區、品種、篩選選項、API 清單 |
| `GET /api/overview` | 總覽統計（KPI、健康分佈、分級、亮點） |
| `GET /api/parishes` | 各堂區統計（分區表） |
| `GET /api/trees` | 古樹清單；參數 `parish, species, grade, health, min_age, max_age, q, sort, limit, offset` |
| `GET /api/tree/:tree_no` | 單株詳情＋同地點鄰居（編號須符合 `[0-9A-Za-z_-]{1,24}`） |
| `GET /api/species` | 品種清單與統計 |
| `GET /api/stats` | 完整統計分析（模型、ANOVA、卡方、預測） |
| `GET /api/routes` | 精選路綫清單 |
| `GET /api/route` | 路綫計算；`code=<精選路綫>` 或 `parish/species/theme/max_stops` 自訂 |
| `GET /api/conservation` | 科普文章清單；`slug=<文章>` 取全文 |
| `GET /api/timeline` | 立法與名錄時間線 |
| `GET /api/field-records` | 實地考察紀錄清單；`limit` 可選（上限 500）；回傳 `writable` 旗標說明是否已連接資料庫 |
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

另外，樹齡與**分級**的相關性很高（$r = 0.637$），這是合理的：分級本身即以樹齡為主要依據（一級 ≥ 300 年、二級 ≥ 200 年、三級 ≥ 100 年）。

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
- `functions.maxDuration: 30` 秒
- 相片與 vendor 資源長快取標頭

GitHub 倉庫推送後，Vercel 亦會自動部署每次 commit。

---

## 十、測試與驗證

```bash
npm run check          # node --check：對所有 JS 檔執行語法檢查
npm test               # 8 組測試，共 102 項
npm run verify         # check ＋ test
```

| 測試檔 | 內容 | 項數 |
| --- | --- | --- |
| `tests/analysis.test.js` | 統計函式單元測試（相關係數、迴歸、F 分佈、卡方分佈） | 18 |
| `tests/sql.test.js` | **以 PGlite（PostgreSQL 16 WASM）實跑 `schema.sql` ＋ `seed.sql` ＋ `init.sql`**，驗證檢視表、RPC、RLS 政策與一鍵初始化檔 | 22 |
| `tests/api.test.js` | 啟動真實伺服器打 12 個端點，對照 CSV 直接計算的結果，檢查內部一致性 | 12 |
| `tests/api-security.test.js` | API 安全測試（見下） | 12 |
| `tests/secrets.test.js` | 機密掃描：掃描所有 git 追蹤檔案，出現 JWT 形式金鑰、真實 Supabase 網址或未忽略的 `.env` 即失敗 | 3 |
| `tests/iam.test.js` | 市政署官方資料整合：658 筆對上、座標全部 official、照片檔存在不破圖、官方欄位已進快照與 seed.sql | 8 |
| `tests/ui.test.js` | 裝置適配（viewport／theme-color／深色模式／手機斷點／觸控目標／輸入框 16 px／列印樣式），並守住**表格內插陣列必須 `join`**（否則會出現一整排逗號）、圖表小結數量與模態框層級 | 17 |
| `tests/field.test.js` | 實地考察：API 清單與新增、輸入驗證（必填、健康值、數值範圍、長度截斷）、`schema.sql`／`init.sql` 含 `field_records`、前端分頁與地圖入口串接 | 10 |

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

`scripts/ui-audit.sh <port>` 是**裝置適配稽核**：在 360／390／414／834／1440 px 與深淺色共 50 組組合下，量測頁面橫向溢出、元素溢出、觸控目標高度、文字輸入框字級、統計卡欄數、地圖是否排到最前、頁籤是否改為橫向滑動。因為無頭 Chrome 的視窗寬度下限約 500 px，量測在**同源 iframe** 內進行（寬度才真正可控）：

```bash
node scripts/dev-server.mjs 3351 &
bash scripts/ui-audit.sh 3351          # 有問題時離開碼為 1
```

---

## 十一、資料來源與授權

| 項目 | 來源 |
| --- | --- |
| 古樹清單（658 筆，名錄值） | `source-data/古樹.csv`，整理自澳門市政署《古樹名木保護名錄》 |
| **古樹逐株官方資料** | **澳門市政署「澳門自然網」古樹名木專頁 `https://www.iam.gov.mo/nature/c/tree`**，資料端點 `https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json`（658 筆，含逐株座標、樹齡、樹高、冠幅、胸徑、周邊範圍、健康狀況、分級、堂區、地點、形態描述、市政署樹木編號與唯一識別碼） |
| **古樹官方照片（658 張）** | 同前專頁，`https://www.iam.gov.mo/nature/Content/OldTreesOnline/<影像檔>` |
| 法規與制度 | 第 11/2013 號法律《文化遺產保護法》、澳門特別行政區公報 |
| 品種學名 | Wikidata / Wikipedia（現行接受名）；市政署網站學名以 `name_sci_official` 並列 |
| 相片 | 古樹照：澳門市政署；品種／地點照：Wikimedia Commons（各圖附作者與授權，多為 CC BY-SA 4.0 或公有領域） |
| 座標 | 市政署逐株座標（`geo_precision = 'official'`）；無法取得者才回退 OpenStreetMap Nominatim ＋ 人工校核 |
| 地圖圖磚 | © OpenStreetMap contributors |

### 兩份官方資料的核對結果

《古樹名木保護名錄》整理之 `古樹.csv` 與市政署網站現行公布值，658 株中：

- **樹齡 1 株不同**（#619：名錄 155 年／市政署 115 年）、**健康狀況 4 株不同**（#548、#627、#638 等由「一般」改列「健康」）、**分級 1 株不同**（#1132 由三級改列不分級）。
- 本站統計一律以 `古樹.csv` 為準，單株詳情頁在兩者不一致時以「資料核對」區塊並列市政署現行值，不隱藏差異。
- **學名 14 個物種**出現版本差異（例：`Triadica sebifera` ←→ 市政署 `Sapium sebiferum`）：本站採現行接受名，市政署名以 `name_sci_official` 並列保存。
- 官方欄位覆蓋率不一：形態描述與座標 658/658、官方照片 657/658、冠幅僅 67 株有值 —— 缺少處不補造數據，前端改顯示樹種相片或直接省略該列。

科普文章的每一篇都附有 `sources` 欄位列出參考來源。**古樹照片與資料著作權屬澳門市政署**，本站為非商業教學研究用途並逐一標示出處；相片版權歸原作者所有，使用時請保留標示的作者與授權資訊。

---

## 授權

程式碼以 MIT 授權釋出。資料與相片之權利依其原始來源標示。
