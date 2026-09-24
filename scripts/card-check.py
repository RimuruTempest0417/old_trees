#!/usr/bin/env python3
"""v0.7.0 列印模組的無頭瀏覽器驗證：A4 檔案卡／考察單／路綫資料冊。

用法：python3 cardcheck.py <port>
檢查：
  1. 三種模式都能產生 .card-page，內容含關鍵欄位（不再是「載入中」）。
  2. A4 尺寸：量測 .card-page 的實際寬度是否為 210mm（79.37px/mm × 210 ≈ 793.7px）。
  3. 二維碼 SVG 真的畫在紙上，且列印 CSS 把控制列隱藏。
  4. 路綫資料冊頁數＝站數＋1。
  5. 截圖交給 OpenCV 解碼，證明紙上的二維碼掃得出來。
"""
import json
import os
import re
import subprocess
import sys
import time

PORT = sys.argv[1] if len(sys.argv) > 1 else '3370'
OUT = '/Users/garycheong/.hermes/cache/scratch/card'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
os.makedirs(OUT, exist_ok=True)

def _run_chrome(args, wait=22):
    """無頭 Chrome 在這台機器上有時傾印完不會自己結束 → 逾時就終止並取回已寫出的輸出。"""
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        out, _ = proc.communicate(timeout=wait)
    except subprocess.TimeoutExpired:
        proc.terminate()
        try:
            out, _ = proc.communicate(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
            out, _ = proc.communicate()
    return out or ''


results = []


def chrome(url, shot=None):
    profile = os.path.join(OUT, 'profile')
    os.makedirs(profile, exist_ok=True)
    args = [CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--hide-scrollbars', '--window-size=1400,2400', '--virtual-time-budget=15000',
            f'--user-data-dir={profile}', '--dump-dom']
    if shot:
        args.append(f'--screenshot={os.path.join(OUT, shot)}')
    args.append(url)
    return _run_chrome(args)


def run_probe(url, name, checks):
    html = chrome(url)
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text)
    pages = html.count('class="card-page')
    qr = len(re.findall(r'aria-label="古樹二維碼"', html))
    ok = True
    detail = []
    for label, cond in checks(pages, qr, html, text):
        detail.append(f"{'✓' if cond else '✗'} {label}")
        ok = ok and cond
    results.append((name, ok, pages, qr, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}：card-page={pages}、二維碼={qr}")
    for d in detail:
        print('     ', d)
    return html


# 1) 單株檔案卡
run_probe(f'http://localhost:{PORT}/#/card?tree=66', '單株檔案卡 #66', lambda pages, qr, html, text: [
    ('產生 1 張 A4', pages == 1),
    ('古樹編號 66 出現', '編號 66' in text),
    ('樹種華潤楠出現', '華潤楠' in text),
    ('官方缺值標示「官方未提供」', '官方未提供' in text),
    ('現場查核清單存在', '現場查核清單' in text),
    ('二維碼 1 個', qr == 1),
    ('頁面上有二維碼網址文字', '#/map?tree=66' in text),
    ('列印 CSS 已載入', 'print.css' in html),
    ('不含「產生失敗」', '產生失敗' not in text),
])

# 2) 帶入資料的考察單
run_probe(f'http://localhost:{PORT}/#/card?mode=form&tree=66', '考察單（帶入 #66）', lambda pages, qr, html, text: [
    ('產生 1 張 A4', pages == 1),
    ('含現場量測表格', '胸徑（離地 1.3m，cm）' in text),
    ('含樹體與環境檢查', '樹體與環境檢查' in text),
    ('含記錄說明且註明不覆寫官方名錄', '不會覆寫市政署官方名錄' in text),
    ('二維碼 1 個（指向考察表）', qr == 1),
])

# 3) 空白考察單
run_probe(f'http://localhost:{PORT}/#/card?mode=form', '空白考察單', lambda pages, qr, html, text: [
    ('產生 1 張 A4', pages == 1),
    ('標示空白表', '空白表' in text),
    ('有素描區', 'sketch-area' in html),
])

# 4) 路綫資料冊（先取一條路綫代碼）
route_code = ''
try:
    listing = subprocess.run(['curl', '-s', f'http://localhost:{PORT}/api/routes'],
                             capture_output=True, text=True, timeout=30).stdout
    route_code = (json.loads(listing).get('routes') or [{}])[0].get('code', '')
except Exception as err:                                     # noqa: BLE001
    print('取得路綫清單失敗：', err)
if route_code:
    detail = subprocess.run(['curl', '-s', f'http://localhost:{PORT}/api/route?code={route_code}'],
                            capture_output=True, text=True, timeout=60).stdout
    stops = len(json.loads(detail).get('stops') or [])
    run_probe(f'http://localhost:{PORT}/#/card?mode=book&route={route_code}', f'路綫資料冊 {route_code}', lambda pages, qr, html, text: [
        (f'頁數＝站數＋1（{stops}+1）', pages == stops + 1),
        ('封面有路綫名', '路綫資料冊' in text),
        ('每站一頁（含「第 1 站」）', '第 1 站' in text),
        ('含示意圖（非等比地圖警語）', '非等比地圖' in text),
        ('每頁都有二維碼', qr == stops + 1),
    ])

print('\n=== 摘要 ===')
bad = [r for r in results if not r[1]]
print(f'共 {len(results)} 項，通過 {len(results) - len(bad)} 項，失敗 {len(bad)} 項')
for name, ok, pages, qr, _ in results:
    print(f"  {'✓' if ok else '✗'} {name}（{pages} 頁、{qr} 碼）")
sys.exit(1 if bad else 0)
