/**
 * 實地考察：記錄表單 ＋ 紀錄清單 ＋ CSV 匯出。
 *
 * 「預留空間」的實作方式：
 *   1. 資料庫（Supabase）連線時 → 紀錄直接寫入 field_records 表，人人可見。
 *   2. 示範模式（未連線）→ API 回報 writable:false，改存本機 localStorage，
 *      並在畫面上明確標示「尚未寫入資料庫」，不讓使用者誤以為已上傳。
 *   3. v0.13.0 起：現場照片可在表單直接選（手機相機）→ 前端壓縮 → 上傳到
 *      Supabase Storage（bucket: field-photos）；示範模式則暫存在這台裝置並明示。
 *   4. 樹皮狀況與周邊環境已做成勾選欄位（v0.13.0），現場不用再靠文字描述硬撐。
 *
 * 【重要】BARK／SURROUND／COVERS 三份清單必須與 lib/repo.js 的
 * FIELD_BARK／FIELD_SURROUND／FIELD_CONCRETE_COVER 以及 supabase/schema.sql 的
 * CHECK 限制條件完全一致（tests/field.test.js 會比對三邊）。
 */
import { api } from './api.js';
import { esc, num, errDetail, toast, downloadCsv } from './ui.js';

const LS_KEY = 'macau-heritage-trees.field-records.v1';
const HEALTHS = ['健康', '一般', '瀕危'];

// 與 lib/repo.js 的 FIELD_BARK／FIELD_SURROUND／FIELD_CONCRETE_COVER 同步
const BARK = [
  ['剝落', '樹皮剝落（片狀或塊狀掉落）'],
  ['黴斑', '黴斑（黑／灰黴或藻類附著）'],
  ['白色鹽類結晶', '白色鹽類結晶（樹皮或樹穴表面結霜狀）'],
  ['無明顯異常', '以上皆無'],
];
const SURROUND = [
  ['鄰近馬路', '鄰近馬路（車流、廢氣、震動）'],
  ['鄰近建築物', '鄰近建築物（遮陰、施工、排水）'],
  ['排水口', '排水口（逕流集中、長期潮濕）'],
  ['水泥覆蓋', '水泥／鋪面覆蓋（樹穴被硬鋪面封住）'],
  ['裸露土壤', '裸露土壤（樹穴無覆蓋，易壓實）'],
  ['其他', '其他（寫在下方立地環境欄）'],
];
const COVERS = ['無', '少量（少於三分之一）', '約一半', '大部分（超過三分之二）', '幾乎全部覆蓋'];
const MAX_PHOTOS = 3;
const PHOTO_MAX_EDGE = 1280;

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveLocal(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// 空字串對數值欄位代表「沒有量」，不是 0。表單送出的空欄位是 ''，若直接存下來再顯示，
// 紀錄列就會出現「胸徑 0.0 cm」這種沒量也像有量的數字（實測發現）——一律先清洗成 null。
const NUM_FIELDS = ['height_m', 'diameter_cm', 'crown_m', 'lat', 'lon', 'gps_accuracy_m', 'gps_distance_m'];
const cleanNums = (r) => {
  const out = { ...r };
  for (const k of NUM_FIELDS) {
    if (out[k] === '' || out[k] === undefined) out[k] = null;
    else if (out[k] != null && Number.isFinite(Number(out[k]))) out[k] = Number(out[k]);
  }
  return out;
};
/** 有沒有真的量到值（'' 與 null 都算沒有） */
const hasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

const localRecord = (r) => ({ ...cleanNums(r), local_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, local: true });

const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * 把相片壓到適合上傳的大小：長邊上限 1280、JPEG 品質 0.72。
 * 目的不只是省流量——Vercel 的請求上限與 Supabase Storage 的檔案上限都很小，
 * 直接原圖上傳（手機一張 3–5 MB）就會失敗，所以一律在前端先壓。
 * 回傳 data URL（後端 /api/photo 只接受 data URL，並且會再驗尺寸與型別）。
 */
function compressImage(file, maxEdge = PHOTO_MAX_EDGE, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * scale));
      const h = Math.max(1, Math.round((img.height || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        reject(new Error('這個圖片無法轉存為 JPEG'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('瀏覽器讀不出這個圖片檔（iPhone 的 HEIC 請把相機格式設為「最相容」，或先轉成 JPEG）'));
    };
    img.src = url;
  });
}

const chip = (text, cls = 'badge-fair') => `<span class="badge ${cls}">${esc(text)}</span>`;

function barkHtml(r) {
  const list = Array.isArray(r.bark_conditions) ? r.bark_conditions : [];
  if (!list.length) return '—';
  return list.map((b) => chip(b, b === '無明顯異常' ? 'badge-good' : b === '剝落' ? 'badge-bad' : 'badge-fair')).join(' ');
}

function surroundHtml(r) {
  const list = Array.isArray(r.surround_items) ? r.surround_items : [];
  const parts = list.map((s) => chip(s, s === '裸露土壤' ? 'badge-good' : 'badge-fair'));
  if (r.concrete_cover) parts.push(`<span class="tiny muted">水泥覆蓋：${esc(r.concrete_cover)}</span>`);
  return parts.length ? parts.join(' ') : '—';
}

function photosHtml(r) {
  const urls = Array.isArray(r.photo_urls) ? r.photo_urls.filter(Boolean) : [];
  const out = urls.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="開啟第 ${i + 1} 張照片">
      <img class="field-thumb" src="${esc(u)}" alt="現場照片 ${i + 1}" loading="lazy"></a>`);
  if (r.photo_url) {
    out.push(`<a class="tiny" href="${esc(r.photo_url)}" target="_blank" rel="noopener">外部連結</a>`);
  }
  return out.length ? `<div class="field-thumbs">${out.join('')}</div>` : '—';
}

// ── GPS 誤差半徑比對（v0.15.0）────────────────────────────────
// 官方逐株座標是比對基準，而手機定位自己帶著誤差半徑：只看距離，在室內或樹蔭下
// （精度可能 ±80 公尺）就會給出假的「位置相符」。因此判定同時看距離與精度。
// 這裡的門檻與規則必須和 lib/geo.js 的 GPS_MATCH_RADIUS_M／GPS_ACCURACY_LIMIT_M／gpsVerdict() 一致，
// tests/gps.test.js 會逐項比對兩個檔案（前端不能直接 import 後端的 lib/，這是刻意的複製）。
const GPS_RADIUS_M = 30;
const GPS_ACCURACY_LIMIT_M = 50;

/** 兩點球面距離（公尺），與 lib/geo.js 的 haversine 同式 */
function haversineM(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 回傳 { status, distance_m, accuracy_m, radius_m, message }；status 為 ok／far／weak／unknown */
function gpsVerdict({ treeLat = null, treeLon = null, lat = null, lon = null, accuracy = null }) {
  const acc = Number.isFinite(Number(accuracy)) && accuracy !== null && accuracy !== ''
    ? Math.round(Number(accuracy)) : null;
  const base = { distance_m: null, accuracy_m: acc, radius_m: GPS_RADIUS_M };
  if (treeLat == null || treeLon == null) {
    return { ...base, status: 'unknown', message: '官方資料沒有這一株的座標，無法比對位置。' };
  }
  if (lat == null || lon == null) {
    return { ...base, status: 'unknown', message: '還沒有現場座標——按「用目前位置比對樹木位置」或手動輸入。' };
  }
  const distance = Math.round(haversineM(treeLat, treeLon, lat, lon));
  const accNote = acc != null ? `（定位精度約 ±${acc} 公尺）` : '';
  if (acc != null && acc > GPS_ACCURACY_LIMIT_M) {
    return { ...base, status: 'weak', distance_m: distance,
      message: `定位精度約 ±${acc} 公尺，比 ±${GPS_ACCURACY_LIMIT_M} 公尺差，與官方座標相距 ${distance} 公尺僅供參考——請走到空曠處再測一次。` };
  }
  if (distance <= GPS_RADIUS_M) {
    return { ...base, status: 'ok', distance_m: distance,
      message: `與官方座標相距 ${distance} 公尺，在 ${GPS_RADIUS_M} 公尺比對半徑內——位置相符${accNote}。` };
  }
  return { ...base, status: 'far', distance_m: distance,
    message: `與官方座標相距 ${distance} 公尺，超出 ${GPS_RADIUS_M} 公尺比對半徑——可能不是這一株，請核對樹號與現場立牌。` };
}

const GPS_TONE = { ok: 'tone-good', far: 'tone-danger', weak: 'tone-warn', unknown: 'muted' };

/** 紀錄列裡的「位置比對」欄：只顯示已記錄的距離與精度，不對缺失值補數字 */
function gpsCellHtml(r) {
  const d = hasNum(r.gps_distance_m) ? Number(r.gps_distance_m) : null;
  const a = hasNum(r.gps_accuracy_m) ? Number(r.gps_accuracy_m) : null;
  if (d === null && a === null) return '—';
  const parts = [];
  if (d !== null) parts.push(`距 ${num(d, 0)} m`);
  if (a !== null) parts.push(`±${num(a, 0)} m`);
  const tone = d !== null && d <= GPS_RADIUS_M ? 'tone-good' : (d !== null ? 'tone-warn' : 'muted');
  return `<span class="${tone}" title="與官方座標的距離／手機定位精度">${esc(parts.join('／'))}</span>`;
}

function rowHtml(r) {
  const metrics = [
    hasNum(r.height_m) ? `高 ${num(r.height_m, 2)} m` : null,
    hasNum(r.diameter_cm) ? `胸徑 ${num(r.diameter_cm, 1)} cm` : null,
    hasNum(r.crown_m) ? `冠幅 ${num(r.crown_m, 1)} m` : null,
  ].filter(Boolean).join('・');
  return `
    <tr>
      <td class="mono tiny">${esc(r.tree_no || '—')}</td>
      <td class="nowrap">${esc(r.observed_on || '—')}</td>
      <td>${esc(r.observer || '')}</td>
      <td>${r.health ? `<span class="badge ${r.health === '健康' ? 'badge-good' : r.health === '一般' ? 'badge-fair' : 'badge-bad'}">${esc(r.health)}</span>` : '—'}</td>
      <td class="tiny">${barkHtml(r)}</td>
      <td class="tiny">${surroundHtml(r)}</td>
      <td class="tiny">${esc(metrics || '—')}</td>
      <td class="tiny nowrap">${gpsCellHtml(r)}</td>
      <td class="tiny">${esc(r.site_note || '—')}${r.damage_note ? `<br><span class="muted">異常：${esc(r.damage_note)}</span>` : ''}</td>
      <td>${photosHtml(r)}</td>
      <td class="tiny">${r.local ? '<span class="badge badge-fair" title="僅存在這台裝置的瀏覽器">本機</span>' : '<span class="badge badge-good">資料庫</span>'}</td>
      <td>${r.local ? `<button class="btn btn-sm" data-del="${esc(r.local_id)}">刪除</button>` : ''}</td>
    </tr>`;
}

export async function render(section, params = new URLSearchParams()) {
  const prefillTree = params.get('tree') || '';

  section.innerHTML = `
    <div class="page-head">
      <h1>實地考察</h1>
      <p>帶著手機或紙本走到樹下，把「現場看到的」記下來：樹況、立地環境、病蟲害與人為干擾，並拍下環境特徵照片。
      這裡是本站為實地考察預留的空間——官方名錄的資料不會被覆寫，考察紀錄另存於 <code>field_records</code> 表。</p>
    </div>
    <div id="field-notice"></div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h2>新增一筆考察紀錄</h2>
        <form id="field-form" class="stack" autocomplete="off">
          <label class="small">古樹編號（可留空，記錄名錄外個體）
            <input type="text" name="tree_no" id="f-tree" value="${esc(prefillTree)}" placeholder="例如 1060" inputmode="numeric">
          </label>
          <div id="f-tree-info" class="tiny muted"></div>
          <div class="row">
            <label class="small" style="flex:1">觀察日期
              <input type="date" name="observed_on" value="${today()}">
            </label>
            <label class="small" style="flex:1">天氣
              <input type="text" name="weather" placeholder="晴／陰／雨後" maxlength="20">
            </label>
          </div>
          <label class="small">記錄者（班級＋座號或姓名）
            <input type="text" name="observer" placeholder="例如 高三甲 12 號" maxlength="60" required>
          </label>
          <label class="small">健康狀況（現場判斷）
            <select name="health">
              <option value="">— 未判斷 —</option>
              ${HEALTHS.map((h) => `<option value="${h}">${h}</option>`).join('')}
            </select>
          </label>

          <fieldset class="check-field">
            <legend class="small">樹皮狀況（可多選）</legend>
            <div class="check-grid">
              ${BARK.map(([val, label]) => `<label class="check-item">
                <input type="checkbox" name="bark_conditions" value="${esc(val)}">
                <span>${esc(label)}</span>
              </label>`).join('')}
            </div>
          </fieldset>

          <fieldset class="check-field">
            <legend class="small">周邊環境（可多選）</legend>
            <div class="check-grid">
              ${SURROUND.map(([val, label]) => `<label class="check-item">
                <input type="checkbox" name="surround_items" value="${esc(val)}">
                <span>${esc(label)}</span>
              </label>`).join('')}
            </div>
            <label class="small" style="margin-top:.4rem">樹穴水泥覆蓋範圍
              <select name="concrete_cover">
                <option value="">— 未判斷 —</option>
                ${COVERS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
              </select>
            </label>
          </fieldset>

          <div class="row">
            <label class="small" style="flex:1">樹高（公尺）
              <input type="number" name="height_m" step="0.1" min="0" max="100" placeholder="目測或測距">
            </label>
            <label class="small" style="flex:1">胸徑（公分）
              <input type="number" name="diameter_cm" step="0.1" min="0" max="1000" placeholder="離地 1.3 m">
            </label>
            <label class="small" style="flex:1">冠幅（公尺）
              <input type="number" name="crown_m" step="0.1" min="0" max="100" placeholder="約略值">
            </label>
          </div>
          <label class="small">立地環境（樹穴、鋪面、積水、周邊工程…）
            <textarea name="site_note" rows="2" maxlength="600"></textarea>
          </label>
          <label class="small">病蟲害／人為損傷（枯枝、樹皮剝落、刻字、堆物…）
            <textarea name="damage_note" rows="2" maxlength="600"></textarea>
          </label>

          <label class="small">現場照片（最多 ${MAX_PHOTOS} 張；手機可直接拍照，會先壓縮再上傳）
            <input type="file" id="f-photos" accept="image/*" capture="environment" multiple>
          </label>
          <div id="f-photo-preview" class="field-thumbs" aria-live="polite"></div>
          <p class="tiny muted" id="f-photo-note">照片請拍到能反映環境特徵的部位：樹皮異常處、樹穴鋪面與水泥覆蓋範圍、鄰近馬路／建築物／排水口（保持距離拍攝，勿踩踏樹根）。</p>

          <label class="small">外部照片網址（選填，例如已上傳到相簿或雲端硬碟）
            <input type="url" name="photo_url" placeholder="https://…" maxlength="500">
          </label>
          <div class="row">
            <label class="small" style="flex:1">緯度（現場）
              <input type="number" name="lat" id="f-lat" step="0.000001" placeholder="22.xxxxxx">
            </label>
            <label class="small" style="flex:1">經度（現場）
              <input type="number" name="lon" id="f-lon" step="0.000001" placeholder="113.xxxxxx">
            </label>
          </div>
          <input type="hidden" name="gps_accuracy_m" id="f-gps-acc">
          <input type="hidden" name="gps_distance_m" id="f-gps-dist">
          <div class="row">
            <button type="submit" class="btn btn-primary" id="field-save">儲存紀錄</button>
            <button type="button" class="btn btn-sm" id="field-locate">用目前位置比對樹木位置</button>
          </div>
          <p class="tiny muted" id="field-gps">還沒有現場座標——按「用目前位置比對樹木位置」，或手動輸入緯度／經度。</p>
          <p class="tiny muted" id="field-status"></p>
        </form>
      </div>

      <div class="card">
        <h2>現場要記錄什麼（檢查清單）</h2>
        <ul class="small">
          <li><strong>樹皮狀況</strong>：剝落（片狀或塊狀掉落）、黴斑（黑／灰黴或藻類附著）、
            白色鹽類結晶（鹽霜狀，常出現在水泥鋪面旁）——表單已做成勾選欄，直接勾。</li>
          <li><strong>周邊環境</strong>：鄰近馬路、建築物、排水口、樹穴水泥覆蓋範圍、裸露土壤 ——同樣是勾選欄；
            水泥覆蓋範圍另分「無／少量／約一半／大部分／幾乎全部」五級。</li>
          <li><strong>樹木本體</strong>：樹冠是否完整、有無枯梢枯枝、主幹裂縫或空洞、真菌子實體。</li>
          <li><strong>根部與立地</strong>：樹穴是否被鋪面封死、土壤是否壓實或積水、有無堆放物料、周邊是否施工。</li>
          <li><strong>人為干擾</strong>：刻字、攀爬、晾曬、綁掛物、香燭與焚燒痕跡。</li>
          <li><strong>生物</strong>：藤蔓纏繞、白蟻蟻路、昆蟲啃食痕、樹洞是否有鳥巢或蜂巢（勿靠近）。</li>
          <li><strong>環境數據</strong>：目測樹高與胸徑（離地 1.3 m 處周長 ÷ π 可得胸徑）；座標可一鍵填入。</li>
          <li><strong>照片</strong>：至少一張能同時看到樹幹與周邊環境的全景，其餘拍異常部位特寫。</li>
        </ul>
        <h3>安全與禮儀</h3>
        <ul class="small">
          <li>不攀爬、不踩踏樹根區、不刻字、不採果、不移動或移除任何現場物件。</li>
          <li>拍照用長焦或保持距離；枯枝下方不要停留。</li>
          <li>遇到颱風前後、雷雨或封閉區域，改日再訪。</li>
          <li>發現立即危險（大裂縫、樹幹傾斜、根部裸露）請通報市政署，不要自行處理。</li>
        </ul>
        <div class="notice notice-info small" style="margin-top:.6rem">
          巡視頻率參考：市政署對<strong>健康</strong>古樹每年至少巡查兩次、<strong>一般</strong>者每季一次、
          <strong>瀕危</strong>者每月一次並視情況加密。實地考察可與此節奏對齊。
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>已記錄的考察（<span id="field-count">0</span> 筆）</h2>
      <p class="tiny muted" id="field-source"></p>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>古樹編號</th><th>觀察日期</th><th>記錄者</th><th>健康狀況</th>
              <th>樹皮狀況</th><th>周邊環境</th><th>現場量測</th><th>觀察重點</th>
              <th>位置比對</th>
        <th>照片</th><th>儲存位置</th><th></th>
            </tr>
          </thead>
          <tbody id="field-rows"></tbody>
        </table>
      </div>
      <div class="row" style="margin-top:.7rem">
        <button class="btn btn-sm" id="field-csv">匯出考察紀錄 CSV</button>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <h2>還在規劃中</h2>
      <ul class="small">
        <li><strong>多人協作與審核</strong>：教師／巡查員帳號可覆核學生紀錄，保留修改歷程（需 Supabase Auth）。</li>
      </ul>
    </div>`;

  const $ = (sel) => section.querySelector(sel);
  const rowsEl = $('#field-rows');
  const countEl = $('#field-count');
  const sourceEl = $('#field-source');
  const statusEl = $('#field-status');
  const photoNoteEl = $('#f-photo-note');
  const PHOTO_TIP = photoNoteEl.textContent;

  let serverRecords = [];
  let writable = false;
  let localList = loadLocal();
  let pending = [];        // 待上傳照片：{ name, dataUrl, bytes }
  let currentTree = null;  // 由古樹編號查到的官方資料（含 lat／lon），作為位置比對基準

  /** 依目前的現場座標與官方座標重算位置比對，並把距離寫進表單（v0.15.0） */
  function refreshGps() {
    const el = $('#field-gps');
    const latEl = section.querySelector('#f-lat'), lonEl = section.querySelector('#f-lon');
    const lat = latEl.value === '' ? null : Number(latEl.value);
    const lon = lonEl.value === '' ? null : Number(lonEl.value);
    const accRaw = $('#f-gps-acc').value;
    const v = gpsVerdict({
      treeLat: currentTree ? currentTree.lat : null,
      treeLon: currentTree ? currentTree.lon : null,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      accuracy: accRaw === '' ? null : accRaw,
    });
    el.className = `tiny ${GPS_TONE[v.status] || 'muted'}`;
    el.textContent = v.distance_m != null ? `${v.message}〔比對半徑 ${v.radius_m} 公尺〕` : v.message;
    $('#f-gps-dist').value = v.distance_m == null ? '' : String(v.distance_m);
    return v;
  }

  // 從地圖帶來的古樹編號：順便顯示樹種與官方樹高，方便現場核對
  async function showTreeInfo(no) {
    const box = $('#f-tree-info');
    if (!no) { box.textContent = ''; return; }
    box.textContent = '讀取中…';
    try {
      const { tree } = await api.tree(no);
      currentTree = tree;                       // 官方座標 → 位置比對的基準（v0.15.0）
      refreshGps();
      box.innerHTML = `比對：<strong>${esc(tree.species)}</strong>・官方樹齡 ${num(tree.age_years)} 年・樹高 ${num(tree.height_m, 2)} m・${esc(tree.site || '')}`;
    } catch {
      box.innerHTML = '<span class="muted">查無此古樹編號（仍可記錄為名錄外個體）。</span>';
    }
  }

  function renderRows() {
    const all = [...localList, ...serverRecords];
    countEl.textContent = num(all.length);
    rowsEl.innerHTML = all.length
      ? all.map(rowHtml).join('')
      : '<tr><td colspan="12" class="muted small">尚無紀錄。這一區就是留給實地考察的空間——走一趟，把第一筆記錄下來。</td></tr>';
    rowsEl.querySelectorAll('button[data-del]').forEach((b) => b.addEventListener('click', () => {
      localList = localList.filter((r) => r.local_id !== b.dataset.del);
      saveLocal(localList);
      renderRows();
      toast('已刪除本機紀錄');
    }));
  }

  function renderPhotos() {
    const box = $('#f-photo-preview');
    box.innerHTML = pending.map((p, i) => `
      <span class="field-thumb-wrap">
        <img class="field-thumb" src="${esc(p.dataUrl)}" alt="${esc(p.name)}">
        <button type="button" class="btn btn-sm" data-photo-del="${i}" title="移除這張照片">✕</button>
        <span class="tiny muted">${fmtBytes(p.bytes)}</span>
      </span>`).join('');
    box.querySelectorAll('button[data-photo-del]').forEach((b) => b.addEventListener('click', () => {
      pending.splice(Number(b.dataset.photoDel), 1);
      renderPhotos();
    }));
    const total = pending.reduce((s, p) => s + p.bytes, 0);
    photoNoteEl.textContent = pending.length
      ? `${PHOTO_TIP}（已選 ${pending.length} 張，合計約 ${fmtBytes(total)}）`
      : PHOTO_TIP;
  }

  async function loadServer() {
    try {
      const res = await api.fieldRecords();
      serverRecords = res.records || [];
      writable = !!res.writable;
      $('#field-notice').innerHTML = writable
        ? ''
        : `<div class="notice"><strong>尚未連接資料庫：</strong>${esc(res.note || '')}
           於部署環境設定資料庫連線的環境變數後（見 README〈部署〉一節），
           考察紀錄就會寫入 <code>field_records</code> 表（含照片上傳到 Storage）。</div>`;
      sourceEl.textContent = writable
        ? '紀錄來源：Supabase 資料庫（field_records 表）；照片存於 Storage 的 field-photos bucket'
        : '紀錄來源：示範模式（未連接資料庫）＋ 這台裝置的瀏覽器暫存（照片也只留在這台裝置）';
    } catch (err) {
      serverRecords = [];
      writable = false;
      $('#field-notice').innerHTML = `<div class="notice"><strong>讀取紀錄失敗：</strong>${esc(errDetail(err))}</div>`;
      sourceEl.textContent = '無法連線 API，僅顯示本機暫存紀錄。';
    }
    renderRows();
  }

  $('#f-tree').addEventListener('change', (e) => showTreeInfo(e.target.value.trim()));
  if (prefillTree) showTreeInfo(prefillTree);

  $('#f-photos').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    for (const file of files) {
      if (pending.length >= MAX_PHOTOS) { toast(`最多 ${MAX_PHOTOS} 張照片`); break; }
      if (!file.type.startsWith('image/')) { photoNoteEl.textContent = `「${file.name}」不是圖片檔，已略過。`; continue; }
      photoNoteEl.textContent = `壓縮「${file.name}」中…`;
      try {
        const dataUrl = await compressImage(file);
        const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
        pending.push({ name: file.name || '現場照片.jpg', dataUrl, bytes });
        renderPhotos();
      } catch (err) {
        photoNoteEl.textContent = errDetail(err);
      }
    }
    renderPhotos();
  });

  // 用目前位置比對官方座標（v0.15.0）：填入座標、記下定位精度、算出與官方座標的距離
  $('#field-locate').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('此瀏覽器不支援定位'); return; }
    const el = $('#field-gps');
    el.className = 'tiny muted';
    el.textContent = '取得定位中…（走到空曠處、避開樹蔭與建築物，精度會比較好）';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        section.querySelector('#f-lat').value = pos.coords.latitude.toFixed(6);
        section.querySelector('#f-lon').value = pos.coords.longitude.toFixed(6);
        $('#f-gps-acc').value = String(Math.round(pos.coords.accuracy));
        refreshGps();
      },
      () => {
        el.className = 'tiny tone-warn';
        el.textContent = '無法取得定位（可能未授權或不在戶外），可手動輸入緯度／經度；精度欄留空。';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
  ['#f-lat', '#f-lon'].forEach((sel) => $(sel).addEventListener('input', refreshGps));

  async function uploadPending(treeNo) {
    const paths = [];
    const localPhotos = [];
    let warn = '';
    for (const ph of pending) {
      try {
        const up = await api.uploadPhoto({ data_url: ph.dataUrl, tree_no: treeNo || null });
        if (up && up.stored && up.path) paths.push(up.path);
        else { localPhotos.push(ph.dataUrl); warn = warn || (up && up.note) || ''; }
      } catch (err) {
        localPhotos.push(ph.dataUrl);
        warn = warn || errDetail(err);
      }
    }
    return { paths, localPhotos, warn };
  }

  $('#field-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.target;
    const fd = new FormData(formEl);
    const body = {};
    for (const [k, v] of fd.entries()) {
      if (k === 'bark_conditions' || k === 'surround_items') continue;   // 勾選清單另外處理
      body[k] = String(v).trim();
    }
    body.bark_conditions = fd.getAll('bark_conditions').map(String);
    body.surround_items = fd.getAll('surround_items').map(String);
    if (!body.observer) { statusEl.textContent = '請先填寫記錄者。'; return; }
    if (!body.observed_on) body.observed_on = today();
    if (body.bark_conditions.includes('無明顯異常') && body.bark_conditions.length > 1) {
      body.bark_conditions = body.bark_conditions.filter((b) => b !== '無明顯異常');
    }

    const saveBtn = $('#field-save');
    saveBtn.disabled = true;
    try {
      let photos = { paths: [], localPhotos: [], warn: '' };
      if (pending.length) {
        statusEl.textContent = `上傳 ${pending.length} 張照片…`;
        photos = await uploadPending(body.tree_no);
        body.photo_paths = photos.paths;
      }
      statusEl.textContent = '儲存中…';
      let res;
      try {
        res = await api.saveFieldRecord(body);
      } catch (err) {
        throw Object.assign(err, { localPhotos: photos.localPhotos, photoWarn: photos.warn });
      }
      if (res.stored && res.record) {
        serverRecords = [res.record, ...serverRecords];
        localList = localList.concat([]);  // 保留本機清單不動
        const notUploaded = photos.localPhotos.length + (photos.warn ? 1 : 0);
        statusEl.textContent = notUploaded
          ? `已寫入資料庫；但 ${photos.localPhotos.length} 張照片未上傳（${photos.warn || '示範模式'}），只留在這台裝置。`
          : '已寫入資料庫。';
        formEl.reset();
        section.querySelector('input[name="observed_on"]').value = today();
        $('#f-tree-info').textContent = '';
        pending = [];
        renderPhotos();
        renderRows();
        toast('考察紀錄已儲存');
        return;
      }
      throw Object.assign(new Error(res.note || '未寫入資料庫'), { demo: true, localPhotos: photos.localPhotos, photoWarn: photos.warn });
    } catch (err) {
      // 示範模式或連線失敗：改存本機，並明確告知
      const rec = localRecord({
        ...body,
        observed_on: body.observed_on || today(),
        photo_urls: err.localPhotos || [],
      });
      localList = [rec, ...localList];
      let okLocal = saveLocal(localList);
      if (!okLocal && rec.photo_urls.length) {
        // 瀏覽器暫存空間不足：先放棄照片、留住紀錄文字，並講清楚
        rec.photo_urls = [];
        okLocal = saveLocal(localList);
        statusEl.textContent = '本機暫存空間不足，照片沒有存進瀏覽器（紀錄文字已存，建議先匯出 CSV）。';
      } else {
        statusEl.textContent = okLocal
          ? `已暫存在本機瀏覽器（${err.demo ? '示範模式未連接資料庫' : esc(errDetail(err))}${rec.photo_urls.length ? `；${rec.photo_urls.length} 張照片只留在這台裝置` : ''}）。`
          : '無法寫入本機暫存，請確認瀏覽器未封鎖儲存空間。';
      }
      formEl.reset();
      section.querySelector('input[name="observed_on"]').value = today();
      pending = [];
      renderPhotos();
      renderRows();
      toast(okLocal ? '已暫存於本機瀏覽器' : '儲存失敗');
    } finally {
      saveBtn.disabled = false;
    }
  });

  $('#field-csv').addEventListener('click', () => {
    const all = [...localList, ...serverRecords];
    if (!all.length) { toast('尚無紀錄可匯出'); return; }
    downloadCsv('古樹實地考察紀錄.csv', all.map((r) => ({
      古樹編號: r.tree_no || '', 觀察日期: r.observed_on || '', 記錄者: r.observer || '',
      天氣: r.weather || '', 健康狀況: r.health || '',
      樹皮狀況: (Array.isArray(r.bark_conditions) ? r.bark_conditions : []).join('、'),
      周邊環境: (Array.isArray(r.surround_items) ? r.surround_items : []).join('、'),
      水泥覆蓋範圍: r.concrete_cover || '',
      樹高公尺: r.height_m ?? '', 胸徑公分: r.diameter_cm ?? '', 冠幅公尺: r.crown_m ?? '',
      立地環境: r.site_note || '', 病蟲害與損傷: r.damage_note || '',
      照片張數: (Array.isArray(r.photo_urls) ? r.photo_urls.length : 0) + (r.photo_url ? 1 : 0),
      照片網址: [ ...(Array.isArray(r.photo_urls) ? r.photo_urls : []), r.photo_url || '' ].filter(Boolean).join(' '),
      緯度: r.lat ?? '', 經度: r.lon ?? '',
      定位精度公尺: r.gps_accuracy_m ?? '', 與官方座標距離公尺: r.gps_distance_m ?? '',
      儲存位置: r.local ? '本機瀏覽器' : 'Supabase 資料庫',
    })));
  });

  renderPhotos();
  await loadServer();
  return { destroy: () => {} };
}
