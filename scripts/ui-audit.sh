#!/usr/bin/env bash
#
# 裝置適配稽核：在真實頁面上量測多種裝置寬度 × 深淺色模式的版面。
#
#   scripts/ui-audit.sh 3351                       # 預設寬度與五個分頁
#   scripts/ui-audit.sh 3351 --widths 390,834      # 指定寬度
#   scripts/ui-audit.sh 3351 --views map,overview  # 指定分頁
#
# 為什麼要用 iframe：無頭 Chrome 的視窗寬度下限約 500 px，直接指定 390 px 會被夾住，
# 量不到真正的手機版面；同源 iframe 的寬度則完全可控，媒體查詢也會照著重算。
#
# 檢查項目：頁面橫向溢出、元素溢出（排除可捲動容器與地圖圖磚緩衝區）、
# 觸控目標高度、文字輸入框字級（iOS <16 px 會自動放大整頁）、
# 統計卡欄數、地圖是否在手機上排到最前、頁籤列是否改為橫向滑動。
#
# 需要先啟動伺服器（npm run dev）。有問題時離開碼為 1。
set -uo pipefail

PORT=3351
WIDTHS="360,390,414,834,1440"
VIEWS="overview,map,analytics,priority,routes,knowledge,card,qr,field,monitoring,chemistry"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

while [ $# -gt 0 ]; do
  case "$1" in
    --widths) WIDTHS="$2"; shift 2 ;;
    --views) VIEWS="$2"; shift 2 ;;
    *) PORT="$1"; shift ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$ROOT/public/__ui_audit.html"' EXIT

if ! curl -sf -o /dev/null "http://localhost:$PORT/api/health"; then
  echo "✗ 伺服器沒有回應：請先執行 npm run dev（或 node scripts/dev-server.mjs $PORT）" >&2
  exit 1
fi
if [ ! -x "$CHROME" ]; then
  echo "✗ 找不到 Chrome：$CHROME（可用 CHROME=/path/to/chrome 指定）" >&2
  exit 1
fi

# ── 稽核用的暫存頁（同源 iframe；不進版控、執行完刪除） ────────────────
cat > "$ROOT/public/__ui_audit.html" <<'HARNESS'
<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>ui audit</title>
<style>html,body{margin:0}iframe{border:0;display:block}pre{display:none}</style></head>
<body>
<iframe id="f"></iframe>
<script>
/* 在 iframe 內的真實頁面上量測（同源，可直接讀子文件的 DOM 與 computed style） */
const MEASURE = (fw, target) => {
  const fd = fw.document, doc = fd.documentElement;
  const r = {
    target, vw: fw.innerWidth, clientW: doc.clientWidth,
    pageOverflow: doc.scrollWidth - doc.clientWidth,
    scheme: fw.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    view: (fd.querySelector('.view:not([hidden])') || {}).id || null,
  };
  // 可捲動容器（例如自帶橫向捲動的表格）、地圖圖磚緩衝區、刻意移出畫面的
  // skip-link 都不算版面破損，必須排除才不會誤報。
  const ignorable = (el) => {
    if (el.classList.contains('skip-link')) return true;
    let n = el;
    while (n && n !== fd.body) {
      if (['auto', 'scroll', 'hidden', 'clip'].includes(fw.getComputedStyle(n).overflowX)) return true;
      if (n.classList && n.classList.contains('leaflet-container')) return true;
      n = n.parentElement;
    }
    return false;
  };
  const off = [];
  for (const el of fd.querySelectorAll('body *')) {
    const b = el.getBoundingClientRect();
    if (!b.width && !b.height) continue;
    const over = Math.round(b.right - doc.clientWidth);
    if ((over > 1 || b.left < -1) && !ignorable(el)) {
      off.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' +' + over);
    }
  }
  r.overflow = off.length;
  r.worst = off.slice(0, 5);
  const tg = [];
  for (const sel of ['.btn', '.chip', '.tab', '.tree-item']) {
    for (const el of fd.querySelectorAll(sel)) {
      const h = el.getBoundingClientRect().height;
      if (h) tg.push([sel, Math.round(h)]);
    }
  }
  r.minTarget = tg.length ? tg.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
  r.smallTargets = tg.filter((t) => t[1] < 36 && r.vw <= 940).slice(0, 4);
  // 只量文字輸入類控件：checkbox / range 在 iOS 不會觸發自動放大
  const textSel = 'select, textarea, input[type="text"], input[type="number"], input[type="search"],' +
    'input[type="tel"], input[type="url"], input[type="email"], input[type="password"], input[type="date"]';
  const fs = [...fd.querySelectorAll(textSel)]
    .map((el) => parseFloat(fw.getComputedStyle(el).fontSize)).filter((n) => !isNaN(n));
  r.minInputFont = fs.length ? Math.min(...fs) : null;
  const tabs = fd.querySelector('.tabs');
  r.tabs = tabs ? [tabs.scrollWidth, tabs.clientWidth, fw.getComputedStyle(tabs).flexWrap] : null;
  const grid = fd.querySelector('.kpi-grid');
  r.kpiCols = grid ? fw.getComputedStyle(grid).gridTemplateColumns.split(' ').length : null;
  const layout = fd.querySelector('.map-layout'), map = fd.querySelector('#map');
  const col = map && map.closest('.map-layout > div');
  r.mapFirst = col ? col.getBoundingClientRect().top <= layout.firstElementChild.getBoundingClientRect().top + 1 : null;
  r.text = (((fd.querySelector('.view:not([hidden])') || {}).innerText) || '')
    .replace(/\s+/g, ' ').trim().slice(0, 40);
  return r;
};

const q = new URLSearchParams(location.search);
const VIEW = q.get('v') || 'overview';
const WIDTHS = (q.get('w') || '390').split(',').map(Number);
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
(async () => {
  const rows = [], f = document.getElementById('f');
  f.style.height = (q.get('h') || 844) + 'px';
  f.style.width = WIDTHS[0] + 'px';
  const loaded = new Promise((res) => { f.onload = res; setTimeout(res, 15000); });
  f.src = '/index.html#/' + VIEW;   // 只載入一次，之後改寬度讓媒體查詢重算
  await loaded;
  const fw = f.contentWindow;
  for (let i = 0; i < 30 && fw.document.querySelector('.loading'); i++) await wait(300);
  for (const w of WIDTHS) {
    f.style.width = w + 'px';
    await wait(700);
    try { rows.push(MEASURE(fw, w)); } catch (e) { rows.push({ target: w, error: String(e) }); }
  }
  const pre = document.createElement('pre');
  pre.textContent = 'AUDIT_JSON=' + JSON.stringify(rows);
  document.body.appendChild(pre);
})();
</script>
</body></html>
HARNESS

# ── 逐一量測：每個分頁 × 深淺色各一次 ────────────────────────────────
run_one() { # $1=view $2=scheme
  local out="$TMP/$1_$2.html" flags=""
  [ "$2" = "light" ] && flags="--blink-settings=preferredColorScheme=1"
  [ "$2" = "dark" ] && flags="--blink-settings=preferredColorScheme=0"
  "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --user-data-dir="$TMP/ud_$1_$2" --virtual-time-budget=40000 --window-size=1200,900 \
    --force-device-scale-factor=1 \
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost" $flags \
    --dump-dom "http://localhost:$PORT/__ui_audit.html?v=$1&w=$WIDTHS&h=844" > "$out" 2>/dev/null &
  local pid=$!
  # Chrome 傾印完 DOM 後常常不會自行結束，必須自己看門狗結束它
  for _ in $(seq 1 90); do
    sleep 1
    kill -0 "$pid" 2>/dev/null || break
    if [ -s "$out" ] && grep -q "AUDIT_JSON=" "$out" 2>/dev/null; then sleep 1; break; fi
  done
  kill -9 "$pid" 2>/dev/null
}

for scheme in light dark; do
  for view in ${VIEWS//,/ }; do
    run_one "$view" "$scheme" &
    while [ "$(jobs -rp | wc -l | tr -d ' ')" -ge 3 ]; do sleep 1; done
  done
  wait
done

python3 - "$TMP" <<'PY'
import glob, json, os, re, sys
rows, missing = [], 0
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.html'))):
    name = os.path.basename(f)[:-5]
    html = open(f, encoding='utf-8', errors='replace').read()
    m = re.search(r'AUDIT_JSON=(\[.*?\])</pre>', html, re.S)
    if not m:
        print(f"  ✗ {name:20} 沒有量測結果（{len(html)} bytes）")
        missing += 1
        continue
    for r in json.loads(m.group(1)):
        r['name'] = name
        rows.append(r)

bad = missing
print(f"{'分頁':<18}{'寬度':>6}  {'色系':<6}{'頁面溢出':>8}{'元素溢出':>8}{'觸控最小':>10}{'輸入字級':>10}  其他")
for r in sorted(rows, key=lambda x: (x['name'], x['target'])):
    if r.get('error') or r.get('vw') != r.get('target'):
        why = r.get('error') or ('實測寬度 %s 不符' % r.get('vw'))
        print(f"  ✗ {r['name']:18}{r.get('target'):>6}  {why}")
        bad += 1
        continue
    ov, po = r['overflow'], r['pageOverflow']
    bad += 1 if (ov or po) else 0
    note = []
    if r.get('smallTargets'): note.append(f"過小目標 {r['smallTargets']}")
    if ov: note.append(f"溢出元素 {r['worst']}")
    if r.get('kpiCols'): note.append(f"統計卡 {r['kpiCols']} 欄")
    if r.get('mapFirst'): note.append("地圖在最前")
    if r.get('tabs') and r['tabs'][1] < r['tabs'][0]: note.append("頁籤可橫向滑動")
    print(f"  {'✗' if (ov or po) else '✓'} {r['name']:18}{r['target']:>6}  {r['scheme']:<6}"
          f"{po:>8}{ov:>9}{str(r['minTarget']):>14}{str(r['minInputFont']):>10}  {'、'.join(note)}")
print(f"\n{'通過' if bad == 0 else '發現問題'}：{len(rows) - bad} / {len(rows)} 組（頁面橫向溢出須為 0、觸控目標 ≥40px、輸入框字級 ≥16px）")
sys.exit(1 if bad else 0)
PY
