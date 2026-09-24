/**
 * 實地考察：記錄表單 ＋ 紀錄清單 ＋ CSV 匯出。
 *
 * 「預留空間」的實作方式：
 *   1. 資料庫（Supabase）連線時 → 紀錄直接寫入 field_records 表，人人可見。
 *   2. 示範模式（未連線）→ API 回報 writable:false，改存本機 localStorage，
 *      並在畫面上明確標示「尚未寫入資料庫」，不讓使用者誤以為已上傳。
 *   3. 未來要接手機拍照上傳、GPS 自動定位、QR 掃描帶入樹號，介面已留位。
 */
import { api } from './api.js';
import { esc, num, errDetail, toast, downloadCsv } from './ui.js';

const LS_KEY = 'macau-heritage-trees.field-records.v1';
const HEALTHS = ['健康', '一般', '瀕危'];

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

const localRecord = (r) => ({ ...r, local_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, local: true });

function rowHtml(r) {
  const metrics = [
    r.height_m != null ? `高 ${num(r.height_m, 2)} m` : null,
    r.diameter_cm != null ? `胸徑 ${num(r.diameter_cm, 1)} cm` : null,
    r.crown_m != null ? `冠幅 ${num(r.crown_m, 1)} m` : null,
  ].filter(Boolean).join('・');
  return `
    <tr>
      <td class="mono tiny">${esc(r.tree_no || '—')}</td>
      <td class="nowrap">${esc(r.observed_on || '—')}</td>
      <td>${esc(r.observer || '')}</td>
      <td>${r.health ? `<span class="badge ${r.health === '健康' ? 'badge-good' : r.health === '一般' ? 'badge-fair' : 'badge-bad'}">${esc(r.health)}</span>` : '—'}</td>
      <td class="tiny">${esc(metrics || '—')}</td>
      <td class="tiny">${esc(r.site_note || '—')}${r.damage_note ? `<br><span class="muted">異常：${esc(r.damage_note)}</span>` : ''}</td>
      <td class="tiny">${r.local ? '<span class="badge badge-fair" title="僅存在這台裝置的瀏覽器">本機</span>' : '<span class="badge badge-good">資料庫</span>'}</td>
      <td>${r.local ? `<button class="btn btn-sm" data-del="${esc(r.local_id)}">刪除</button>` : ''}</td>
    </tr>`;
}

export async function render(section, params = new URLSearchParams()) {
  const prefillTree = params.get('tree') || '';

  section.innerHTML = `
    <div class="page-head">
      <h1>實地考察</h1>
      <p>帶著手機或紙本走到樹下，把「現場看到的」記下來：樹況、立地環境、病蟲害與人為干擾。
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
          <label class="small">現場照片網址（規劃中：之後可直接上傳手機相片）
            <input type="url" name="photo_url" placeholder="https://…" maxlength="500">
          </label>
          <div class="row">
            <label class="small" style="flex:1">緯度（選填）
              <input type="number" name="lat" step="0.000001" placeholder="22.xxxxxx">
            </label>
            <label class="small" style="flex:1">經度（選填）
              <input type="number" name="lon" step="0.000001" placeholder="113.xxxxxx">
            </label>
          </div>
          <div class="row">
            <button type="submit" class="btn btn-primary" id="field-save">儲存紀錄</button>
            <button type="button" class="btn btn-sm" id="field-locate">用目前位置填入座標</button>
          </div>
          <p class="tiny muted" id="field-status"></p>
        </form>
      </div>

      <div class="card">
        <h2>現場要記錄什麼（檢查清單）</h2>
        <ul class="small">
          <li><strong>樹木本體</strong>：樹冠是否完整、有無枯梢枯枝、主幹裂縫或空洞、樹皮剝落、真菌子實體。</li>
          <li><strong>根部與立地</strong>：樹穴是否被鋪面封死、土壤是否壓實或積水、有無堆放物料、周邊是否施工。</li>
          <li><strong>人為干擾</strong>：刻字、攀爬、晾曬、綁掛物、香燭與焚燒痕跡。</li>
          <li><strong>生物</strong>：藤蔓纏繞、白蟻蟻路、昆蟲啃食痕、樹洞是否有鳥巢或蜂巢（勿靠近）。</li>
          <li><strong>環境數據</strong>：目測樹高與胸徑（離地 1.3 m 處周長 ÷ π 可得胸徑）。</li>
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
              <th>現場量測</th><th>觀察重點</th><th>儲存位置</th><th></th>
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
      <h2>預留空間：這一區接下來要放什麼</h2>
      <p class="tiny muted">以下是已經規劃好、但尚未實作的功能，先在此列出以免遺漏（詳見 Google Docs 的未來更新方向規劃）。</p>
      <ul class="small">
        <li><strong>手機拍照上傳</strong>：表單直接選相片 → 壓縮 → 存 Supabase Storage，紀錄就不用再貼外部網址。</li>
        <li><strong>GPS 自動定位</strong>：目前已可一鍵填入座標；下一步是記錄誤差半徑並自動比對最近的古樹，避免記錯編號。</li>
        <li><strong>QR 掃描帶入樹號</strong>：掃描樹上牌子的二維碼即自動填好古樹編號與樹種。</li>
        <li><strong>多人協作與審核</strong>：教師／巡查員帳號可覆核學生紀錄，保留修改歷程（需 Supabase Auth）。</li>
        <li><strong>與官方巡查比對</strong>：把考察紀錄的健康狀況與官方值並列，觀察時間趨勢。</li>
        <li><strong>列印版考察單</strong>：A4 一頁的紙本表單，供現場沒有網路時使用。</li>
      </ul>
    </div>`;

  const $ = (sel) => section.querySelector(sel);
  const rowsEl = $('#field-rows');
  const countEl = $('#field-count');
  const sourceEl = $('#field-source');
  const statusEl = $('#field-status');

  let serverRecords = [];
  let writable = false;
  let localList = loadLocal();

  // 從地圖帶來的古樹編號：順便顯示樹種與官方樹高，方便現場核對
  async function showTreeInfo(no) {
    const box = $('#f-tree-info');
    if (!no) { box.textContent = ''; return; }
    box.textContent = '讀取中…';
    try {
      const { tree } = await api.tree(no);
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
      : '<tr><td colspan="8" class="muted small">尚無紀錄。這一區就是留給實地考察的空間——走一趟，把第一筆記錄下來。</td></tr>';
    rowsEl.querySelectorAll('button[data-del]').forEach((b) => b.addEventListener('click', () => {
      localList = localList.filter((r) => r.local_id !== b.dataset.del);
      saveLocal(localList);
      renderRows();
      toast('已刪除本機紀錄');
    }));
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
           考察紀錄就會寫入 <code>field_records</code> 表（見 README）。</div>`;
      sourceEl.textContent = writable
        ? '紀錄來源：Supabase 資料庫（field_records 表）'
        : '紀錄來源：示範模式（未連接資料庫）＋ 這台裝置的瀏覽器暫存';
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

  $('#field-locate').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('此瀏覽器不支援定位'); return; }
    statusEl.textContent = '取得定位中…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        section.querySelector('input[name="lat"]').value = pos.coords.latitude.toFixed(6);
        section.querySelector('input[name="lon"]').value = pos.coords.longitude.toFixed(6);
        statusEl.textContent = `已填入座標（誤差約 ${Math.round(pos.coords.accuracy)} 公尺）`;
      },
      () => { statusEl.textContent = '無法取得定位（可能未授權或不在戶外），可手動輸入。'; },
    );
  });

  $('#field-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const body = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v).trim()]));
    if (!body.observer) { statusEl.textContent = '請先填寫記錄者。'; return; }
    if (!body.observed_on) body.observed_on = today();
    statusEl.textContent = '儲存中…';
    try {
      const res = await api.saveFieldRecord(body);
      if (res.stored && res.record) {
        serverRecords = [res.record, ...serverRecords];
        renderRows();
        e.target.reset();
        section.querySelector('input[name="observed_on"]').value = today();
        statusEl.textContent = '已寫入資料庫。';
        $('#f-tree-info').textContent = '';
        toast('考察紀錄已儲存');
        return;
      }
      throw Object.assign(new Error(res.note || '未寫入資料庫'), { demo: true });
    } catch (err) {
      // 示範模式或連線失敗：改存本機，並明確告知
      const rec = localRecord({ ...body, observed_on: body.observed_on || today() });
      localList = [rec, ...localList];
      const okLocal = saveLocal(localList);
      renderRows();
      e.target.reset();
      section.querySelector('input[name="observed_on"]').value = today();
      statusEl.textContent = okLocal
        ? `已暫存在本機瀏覽器（${err.demo ? '示範模式未連接資料庫' : esc(errDetail(err))}）。`
        : '無法寫入本機暫存，請確認瀏覽器未封鎖儲存空間。';
      toast(okLocal ? '已暫存於本機瀏覽器' : '儲存失敗');
    }
  });

  $('#field-csv').addEventListener('click', () => {
    const all = [...localList, ...serverRecords];
    if (!all.length) { toast('尚無紀錄可匯出'); return; }
    downloadCsv('古樹實地考察紀錄.csv', all.map((r) => ({
      古樹編號: r.tree_no || '', 觀察日期: r.observed_on || '', 記錄者: r.observer || '',
      天氣: r.weather || '', 健康狀況: r.health || '',
      樹高公尺: r.height_m ?? '', 胸徑公分: r.diameter_cm ?? '', 冠幅公尺: r.crown_m ?? '',
      立地環境: r.site_note || '', 病蟲害與損傷: r.damage_note || '',
      現場照片: r.photo_url || '', 緯度: r.lat ?? '', 經度: r.lon ?? '',
      儲存位置: r.local ? '本機瀏覽器' : 'Supabase 資料庫',
    })));
  });

  await loadServer();
  return { destroy: () => {} };
}
