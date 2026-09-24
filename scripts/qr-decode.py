#!/usr/bin/env python3
"""二維碼「真的掃得出來」驗證：解析我們產生／下載的 SVG，點陣化後用獨立解碼器解讀。

為什麼這樣做：
  tests/qr.test.js 驗證的是編碼矩陣的結構；這裡驗證的是**實際交付給使用者的產物**
  （public/js/qr.js 產生的 SVG，也就是列印與下載用的那個檔案）。
  流程：解析 SVG 的 viewBox 與 path 幾何 → 點陣化成 PNG → 交給 OpenCV
  （與本專案無關的實作）解碼 → 比對解出的文字是否等於原始網址。

  註：點陣化刻意不用無頭 Chrome —— 它對 file:// 的 SVG 截圖會間歇性卡住
  （實際踩到，每個檔要等逾時），而且「用自家瀏覽器畫」也不比直接解析向量圖幾何客觀。

安裝：pip install opencv-python-headless numpy
用法：python3 scripts/qr-decode.py .qr-check        （先用 node scripts/qr-roundtrip.mjs 產生）
"""
import json
import pathlib
import re
import sys

try:
    import cv2
    import numpy as np
except ImportError:
    print("需要 opencv-python-headless 與 numpy：pip install opencv-python-headless numpy", file=sys.stderr)
    sys.exit(2)

MODULE = re.compile(r"M(\d+) (\d+)h1v1h-1z")          # 每個深色模組一個正方形


def parse_svg(svg_text: str):
    """由 SVG 取出模組矩陣。回傳 (size, matrix)；matrix[y][x] 為 True 表示深色模組。"""
    box = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg_text)
    if not box:
        raise ValueError("SVG 缺少 viewBox")
    w, h = int(box.group(1)), int(box.group(2))
    if w != h:
        raise ValueError(f"viewBox 不是正方形：{w}x{h}")
    path = re.search(r'<path d="([^"]*)"', svg_text)
    if not path:
        raise ValueError("SVG 缺少資料路徑")
    matrix = np.zeros((h, w), dtype=bool)
    for x, y in MODULE.findall(path.group(1)):
        matrix[int(y)][int(x)] = True
    return w, matrix


def to_image(matrix: np.ndarray, scale: int = 8, border: int = 4) -> np.ndarray:
    """把模組矩陣放大成黑白圖片（白底黑模組），外圍再加白邊。"""
    img = np.where(matrix, 0, 255).astype(np.uint8)
    img = np.kron(img, np.ones((scale, scale), dtype=np.uint8))
    pad = border * scale
    return np.pad(img, pad, constant_values=255)


def main() -> int:
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".qr-check")
    cases = json.loads((out / "expected.json").read_text(encoding="utf-8"))
    detector = cv2.QRCodeDetector()                   # 獨立實作，非本專案程式碼
    ok = 0
    for case in cases:
        svg_path = pathlib.Path(case["svg"])
        if not svg_path.exists():
            print(f"✗ {case['name']}：找不到 SVG")
            continue
        svg_text = svg_path.read_text(encoding="utf-8")
        try:
            size, matrix = parse_svg(svg_text)
        except ValueError as err:
            print(f"✗ {case['name']}：{err}")
            continue

        # 靜區：最外圈不得有任何深色模組（掃描器需要白邊才對得到焦）
        if matrix[0].any() or matrix[-1].any() or matrix[:, 0].any() or matrix[:, -1].any():
            print(f"✗ {case['name']}：缺少靜區（quiet zone）")
            continue
        if (size - 17) % 4 != 0:
            print(f"✗ {case['name']}：模組數 {size} 不符合 21＋4k")
            continue

        png = out / f"{case['name']}.png"
        cv2.imwrite(str(png), to_image(matrix))
        text, _, _ = detector.detectAndDecode(cv2.imread(str(png)))
        text = (text or "").strip()
        if text == case["text"]:
            print(f"✔ {case['name']}：{size}×{size} 模組，解碼結果與原文相同")
            ok += 1
        else:
            print(f"✗ {case['name']}：解出 {text!r}，應為 {case['text']!r}")

    print(f"\n通過 {ok}／{len(cases)}")
    return 0 if ok == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
