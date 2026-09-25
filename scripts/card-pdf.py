#!/usr/bin/env python3
"""用無頭 Chrome 把列印分頁輸出成真正的 PDF，驗證 A4 分頁與內容（不是「看起來可以印」）。

用法：python3 cardpdf.py <port> [輸出目錄]
檢查：頁數是否符合預期、文字是否抽得出來、每頁是否都是 A4（595×842 pt）。
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata

PORT = sys.argv[1] if len(sys.argv) > 1 else '3370'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/Users/garycheong/.hermes/cache/scratch/card'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
os.makedirs(OUT, exist_ok=True)


def print_pdf(url, path, wait_ms=16000):
    # 每次都清掉 profile：Chrome 會快取舊的 JS，導致「改了樣式、PDF 卻是舊版」的假失敗
    profile = os.path.join(OUT, 'profile-pdf')
    shutil.rmtree(profile, ignore_errors=True)
    os.makedirs(profile, exist_ok=True)
    args = [CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            f'--user-data-dir={profile}', f'--virtual-time-budget={wait_ms}',
            '--no-pdf-header-footer', f'--print-to-pdf={path}', url]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        proc.communicate(timeout=45)
    except subprocess.TimeoutExpired:
        proc.terminate()
        try:
            proc.communicate(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
    # Chrome 寫檔後才結束；給它一點時間落地
    for _ in range(20):
        if os.path.exists(path) and os.path.getsize(path) > 1024:
            return True
        time.sleep(0.5)
    return os.path.exists(path)


def pdf_pages(path):
    """以 pypdf 讀頁數與文字（感興趣的關鍵字）。"""
    from pypdf import PdfReader
    reader = PdfReader(path)
    pages = []
    for page in reader.pages:
        box = page.mediabox
        pages.append({'w': round(float(box.width), 1), 'h': round(float(box.height), 1),
                      'text': (page.extract_text() or '')})
    return pages


cases = [('card-66', f'http://localhost:{PORT}/#/card?tree=66', 1)]
route_code = ''
try:
    listing = subprocess.run(['curl', '-s', f'http://localhost:{PORT}/api/routes'],
                             capture_output=True, text=True, timeout=30).stdout
    route_code = (json.loads(listing).get('routes') or [{}])[0].get('code', '')
except Exception as err:                                     # noqa: BLE001
    print('取得路綫失敗：', err)
if route_code:
    detail = subprocess.run(['curl', '-s', f'http://localhost:{PORT}/api/route?code={route_code}'],
                            capture_output=True, text=True, timeout=60).stdout
    stops = len(json.loads(detail).get('stops') or [])
    cases.append((f'book-{route_code}', f'http://localhost:{PORT}/#/card?mode=book&route={route_code}', stops + 1))
cases.append(('form-66', f'http://localhost:{PORT}/#/card?mode=form&tree=66', 1))
# 優先保育名單：方法頁 1 頁 ＋ 每頁 26 列（與 public/js/card.js 的 PRIORITY_PAGE_ROWS 一致）
PRIO_ROWS_PER_PAGE = 40
PRIO_LIMIT = 50
cases.append(('prio-50', f'http://localhost:{PORT}/#/card?mode=priority&limit={PRIO_LIMIT}',
              2 + -(-PRIO_LIMIT // PRIO_ROWS_PER_PAGE)))

fails = []
for name, url, expect in cases:
    path = os.path.join(OUT, f'{name}.pdf')
    if not print_pdf(url, path):
        fails.append(f'{name}：沒產生 PDF')
        print(f'✗ {name}：沒有產生 PDF')
        continue
    pages = pdf_pages(path)
    sizes = {(p['w'], p['h']) for p in pages}
    a4 = all(abs(p['w'] - 595.28) < 1.5 and abs(p['h'] - 841.89) < 1.5 for p in pages)
    size_mb = os.path.getsize(path) / 1024
    ok = len(pages) == expect and a4
    # PDF 文字抽取的兩個坑（都不是內容錯誤）：
    #   1. 中文常逐字定位 → 抽出「官 方 未 提 供」（中間插入空白）
    #   2. Chrome 子集字型會把部分中文字對應到康熙部首／連字（方→⽅、高→⾼、fi→ﬁ）
    # → 用 NFKC 正規化並去掉空白後再比對關鍵字。
    joined = unicodedata.normalize('NFKC', re.sub(r'\s+', '', ' '.join(p['text'] for p in pages)))
    key = {'card-66': ['古樹檔案卡', '華潤楠', '官方未提供'],
           'form-66': ['實地考察紀錄單', '現場量測'],
           'book': ['路綫資料冊', '非等比地圖'],
           'prio': ['澳門古樹優先保育名單', '評分方法', '使用限制', '非官方文件']}
    if name.startswith('card'):
        want = key['card-66']
    elif name.startswith('form'):
        want = key['form-66']
    elif name.startswith('prio'):
        want = key['prio']
    else:
        want = key['book']
    missing = [w for w in want if w not in joined]
    if missing:
        ok = False
    print(f"{'✓' if ok else '✗'} {name}：{len(pages)} 頁（預期 {expect}）、A4={a4}、{size_mb:.0f} KB、尺寸={sorted(sizes)}")
    print(f"     用紙尺寸(pt)：{pages[0]['w']}×{pages[0]['h']}　文字長度：{len(joined)}")
    if missing:
        print(f'     缺少關鍵字：{missing}')
        fails.append(f'{name}：缺少 {missing}')
    # 第一頁開頭文字片段，方便肉眼確認
    print(f"     第 1 頁開頭：{re.sub(chr(10), ' | ', pages[0]['text'][:120])}")

print('\n=== 摘要 ===')
print('全部通過' if not fails else f'有 {len(fails)} 項失敗：{fails}')
sys.exit(1 if fails else 0)
