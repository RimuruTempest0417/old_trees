#!/usr/bin/env python3
"""離線 PWA 的真實驗證：把伺服器關掉，看頁面還開不開得起來。

與單元測試不同，這裡是「真的斷線」：
  1. 啟動 dev server，用固定的瀏覽器 profile 開一次頁面（service worker 安裝＋預載）。
  2. 再開一次（讓 service worker 接管頁面）。
  3. **把 dev server 砍掉**，同一個 profile 再開一次。
  4. 檢查頁面內容是否仍完整（不是瀏覽器的離線錯誤頁），且狀態顯示為離線。

用法：python3 scripts/pwa-check.py [port]
離開碼：0 全部通過；1 有失敗
"""
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time

PORT = sys.argv[1] if len(sys.argv) > 1 else '3390'
ROOT = '/Users/garycheong/Documents/hermes/old_trees/macau-heritage-trees'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT = '/Users/garycheong/.hermes/cache/scratch/pwa'
os.makedirs(OUT, exist_ok=True)

fails = []


def check(name, cond, extra=''):
    print(('  ✔ ' if cond else '  ✘ ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond:
        fails.append(name)


def attr(html, name):
    m = re.search(rf'{name}="([^"]*)"', html or '')
    return m.group(1) if m else None


def chrome(url, shot=None, wait=45):
    """這台機器的無頭 Chrome 傾印後不會自己結束 → 輪詢輸出再砍。

    注意：--screenshot 與 --dump-dom 同時給時，Chrome 會在第一次繪製就輸出 DOM，
    此時離線偵測（非同步）還沒完成，會誤判為「還在線上」。因此需要判定狀態時，
    一律用不含 --screenshot 的傾印，截圖另外跑一次。
    """
    profile = os.path.join(OUT, 'profile')
    os.makedirs(profile, exist_ok=True)
    args = [CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--hide-scrollbars', '--window-size=1400,1600', '--virtual-time-budget=12000',
            f'--user-data-dir={profile}', '--dump-dom']
    if shot:
        args.append(f'--screenshot={os.path.join(OUT, shot)}')
    args.append(url)
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        out, _ = proc.communicate(timeout=wait)
    except subprocess.TimeoutExpired:
        proc.terminate()
        try:
            out, _ = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            out, _ = proc.communicate()
    return out or ''


def text_of(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html))


server = subprocess.Popen(['node', 'scripts/dev-server.mjs', PORT], cwd=ROOT,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# 等伺服器起來
for _ in range(30):
    probe = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                            f'http://127.0.0.1:{PORT}/api/health'], capture_output=True, text=True)
    if probe.stdout.strip() == '200':
        break
    time.sleep(1)
print(f'dev server：http://127.0.0.1:{PORT}')

try:
    # 用乾淨的 profile，確保是「第一次安裝」的流程
    shutil.rmtree(os.path.join(OUT, 'profile'), ignore_errors=True)

    print('1) 第一次開啟（安裝 service worker 並預載介面）')
    first = chrome(f'http://127.0.0.1:{PORT}/index.html#/overview', shot='1-online.png')
    check('線上開啟正常', '澳門古樹保育研究平台' in text_of(first))
    check('service worker 狀態已寫進 DOM', attr(first, 'data-pwa') is not None, '找不到 data-pwa 屬性')
    check('狀態為 pending 或 ready（已註冊）', attr(first, 'data-pwa') in ('ready', 'pending'), attr(first, 'data-pwa'))
    check('頁首出現離線狀態徽章', 'id="pwa-chip"' in first)

    print('2) 第二次開啟（service worker 接管頁面）')
    second = chrome(f'http://127.0.0.1:{PORT}/index.html#/overview')
    check('已被 service worker 接管', attr(second, 'data-pwa') == 'ready', attr(second, 'data-pwa'))
    check('顯示「離線可用」', '離線可用' in text_of(second))

    # 離線前先逛幾個分頁，讓資料與模組進入快取
    print('3) 先瀏覽幾個分頁（讓資料進快取）')
    for view in ('map', 'routes'):
        chrome(f'http://127.0.0.1:{PORT}/index.html#/{view}')
    print('   已瀏覽 map／routes')

    print('4) 關掉 dev server，模擬完全斷網')
    server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
    down = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                           f'http://127.0.0.1:{PORT}/api/health'], capture_output=True, text=True)
    check('伺服器真的關了', down.stdout.strip() in ('000', ''), f'仍回應 {down.stdout.strip()}')
    time.sleep(2)   # 讓剛才的 keep-alive 連線確實斷乾淨，否則第一次請求可能還在等逾時

    print('5) 離線狀態下重新開啟首頁')
    offline = chrome(f'http://127.0.0.1:{PORT}/index.html#/overview')               # 傾印（拿來判定）
    # 離線偵測本身是非同步的（要等 health 探針失敗）。剛斷線時第一次載入可能還在偵測中，
    # 因此再載入一次為準；兩次的 DOM 都存檔，方便事後核對。
    if attr(offline, 'data-pwa-net') != 'down':
        with open(os.path.join(OUT, 'offline-dump-1.html'), 'w', encoding='utf-8') as fh:
            fh.write(offline)
        print('   （第一次載入時偵測尚未完成，重新載入一次確認）')
        offline = chrome(f'http://127.0.0.1:{PORT}/index.html#/overview')
    with open(os.path.join(OUT, 'offline-dump.html'), 'w', encoding='utf-8') as fh:
        fh.write(offline)
    print('   離線 DOM：', {k: attr(offline, k) for k in
                          ('data-pwa', 'data-pwa-net', 'data-pwa-online', 'data-pwa-cached')})
    t = text_of(offline)
    check('頁面仍開得起來（不是瀏覽器的離線錯誤頁）', '澳門古樹保育研究平台' in t, '看不到平台名稱')
    check('不是 Chrome 的錯誤頁', 'ERR_CONNECTION_REFUSED' not in offline and 'ERR_INTERNET_DISCONNECTED' not in offline)
    check('KPI 內容有渲染出來（資料來自快取）', '古樹總株數' in t or '658' in t, '看不到統計數字')
    check('狀態顯示為離線（連不上伺服器時也要看得出來）',
          '離線模式' in t or attr(offline, 'data-pwa-online') == 'no', attr(offline, 'data-pwa-online'))
    check('離線時出現可讀的橫幅說明', '快取' in t, '看不到快取說明')
    check('徽章不是「離線可用」（避免誤導）', '離線可用' not in t, '伺服器已關但仍顯示離線可用')
    # 截圖放在最後：此時離線狀態已穩定，截出來的畫面才忠實
    chrome(f'http://127.0.0.1:{PORT}/index.html#/overview', shot='2-offline.png')

    print('6) 離線狀態下開啟先前逛過的分頁（#/map）')
    chrome(f'http://127.0.0.1:{PORT}/index.html#/map', shot='3-offline-map.png')
    offline_map = chrome(f'http://127.0.0.1:{PORT}/index.html#/map')
    tm = text_of(offline_map)
    check('地圖分頁仍可開啟（模組已在快取）', '地圖查詢' in tm or '古樹編號' in tm, '地圖分頁內容缺失')
    check('地圖分頁沒有整套錯誤畫面', '載入「地圖查詢」時發生錯誤' not in tm)
finally:
    if server.poll() is None:
        server.terminate()
        try:
            server.wait(timeout=8)
        except subprocess.TimeoutExpired:
            server.kill()

print()
print('截圖：', OUT)
print(f'結果：{"全部通過" if not fails else f"失敗 {len(fails)} 項：{fails}"}')
sys.exit(1 if fails else 0)
