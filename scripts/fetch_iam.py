#!/usr/bin/env python3
"""從澳門市政署「澳門自然網」古樹名木專頁取得官方資料與照片。

資料來源（皆為市政署公開資料）：
  * 古樹清單 JSON：https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json
    （該頁面前端 /nature/c/tree 實際呼叫的資料端點）
  * 每株古樹照片：https://www.iam.gov.mo/nature/Content/OldTreesOnline/<檔名>
    （頁面以 baseImg + "/Content" + image01 組出網址）

輸出：
  * data/iam_trees.json  官方古樹資料，以 oldTreeNo1（與 古樹.csv 的「古樹編號」相同）為鍵
  * data/iam_meta.json   來源、抓取時間、筆數與校驗值，供引用與後續比對
  * public/photos/trees/<編號>.jpg  每株一張官方照片縮圖（已存在者不重抓）

可重複執行：清單每次都重新抓（確認官方有無更新），圖片只補缺的。
"""
import json, os, ssl, subprocess, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
PHOTOS = os.path.join(ROOT, "public", "photos", "trees")

UA = "MacauHeritageTreeProject/1.0 (educational research; Macau secondary school project)"
LIST_URL = "https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json"
IMG_BASE = "https://www.iam.gov.mo/nature/Content"
PHOTO_MAX = 320      # 縮圖長邊像素（400×600 原圖 → 213×320，每張約 33 KB，658 張約 22 MB）
PHOTO_QUALITY = 65   # JPEG 品質


def get(url, tries=4, binary=False):
    """先試 urllib；若因本機缺少 CA 憑證而 SSL 失敗，改用系統 curl。

    （macOS 上以 python.org 安裝的 Python 常沒有憑證鏈，會出現
      CERTIFICATE_VERIFY_FAILED；curl 使用系統鑰匙圈，兩者都能用時以 urllib 為主。）
    """
    last = None
    for attempt in range(1, tries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read()
            return raw if binary else raw.decode("utf-8")
        except (urllib.error.URLError, OSError) as e:
            last = e
            # urllib 會把 SSL 錯誤包進 URLError.reason，需一併判斷
            ssl_problem = isinstance(e, ssl.SSLError) or isinstance(getattr(e, "reason", None), ssl.SSLError)
            if ssl_problem:
                try:
                    out = subprocess.run(["curl", "-sSL", "--max-time", "60", "-A", UA, url],
                                         check=True, capture_output=True)
                    return out.stdout if binary else out.stdout.decode("utf-8")
                except (subprocess.CalledProcessError, FileNotFoundError) as ce:
                    last = ce
        time.sleep(min(2 ** attempt, 12))
    raise RuntimeError(f"下載失敗 {url}：{last}")


def shrink(path):
    """用 macOS 內建 sips 縮圖；失敗時保留原圖。"""
    try:
        subprocess.run(
            ["sips", "-Z", str(PHOTO_MAX), "-s", "format", "jpeg",
             "-s", "formatOptions", str(PHOTO_QUALITY), path],
            check=True, capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(PHOTOS, exist_ok=True)
    only_meta = "--no-images" in sys.argv

    print(f"抓取官方清單：{LIST_URL}")
    payload = json.loads(get(LIST_URL))
    records = payload.get("data") or []
    if not records:
        raise SystemExit("官方清單為空，中止（避免覆蓋既有資料）")
    print(f"取得 {len(records)} 筆古樹紀錄")

    # 正規化：數字欄位轉數字，空字串轉 None，保留原始照片路徑
    trees = {}
    for r in records:
        no = (r.get("oldTreeNo1") or "").strip()
        if not no:
            continue
        def fnum(v):
            if v in (None, "", "0"):
                return None
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
        images = [r.get(f"image{i:02d}") for i in range(1, 10)]
        images = [i for i in images if i]
        trees[no] = {
            "official_no": no,
            "official_no2": (r.get("oldTreeNo2") or "").strip() or None,
            "iam_tree_no": (r.get("treeNo") or "").strip() or None,
            "ref_id": r.get("treeRefId"),
            "species_zh": (r.get("treeTypeName") or "").strip() or None,
            "species_sci": (r.get("treeType") or "").strip() or None,
            "lat": fnum(r.get("lat")),
            "lon": fnum(r.get("lng")),
            "grid_x": fnum(r.get("X")),
            "grid_y": fnum(r.get("Y")),
            "age_years": fnum(r.get("treeAge")),
            "height_m": fnum(r.get("treeHeight")),
            "crown_m": fnum(r.get("treeCrown")),
            "diameter_cm": fnum(r.get("treeDiameter")),
            "surround_m": fnum(r.get("treeSurround")),
            "grade": (r.get("classification") or "").strip() or None,
            "health": (r.get("health") or "").strip() or None,
            "parish": (r.get("region") or "").strip() or None,
            "loc": (r.get("treeLoc") or "").strip() or None,
            "description": (r.get("description") or "").strip() or None,
            "image_path": images[0] if images else None,
            "image_count": len(images),
        }

    out = os.path.join(DATA, "iam_trees.json")
    json.dump(trees, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    print(f"已寫入 {out}（{len(trees)} 筆）")

    # ── 照片 ───────────────────────────────────────────────
    if only_meta:
        print("--no-images：跳過照片下載")
    elif "--recompress" in sys.argv:
        files = sorted(f for f in os.listdir(PHOTOS) if f.endswith(".jpg"))
        before = sum(os.path.getsize(os.path.join(PHOTOS, f)) for f in files)
        for f in files:
            shrink(os.path.join(PHOTOS, f))
        after = sum(os.path.getsize(os.path.join(PHOTOS, f)) for f in files)
        print(f"--recompress：重新壓縮 {len(files)} 張，"
              f"{before / 1048576:.1f} MB → {after / 1048576:.1f} MB")
    else:
        todo = [(no, t) for no, t in sorted(trees.items())
                if t["image_path"] and not os.path.exists(os.path.join(PHOTOS, f"{no}.jpg"))]
        print(f"照片：已有 {len(trees) - len(todo)} 張，待抓 {len(todo)} 張")
        ok = fail = 0
        for idx, (no, t) in enumerate(todo, 1):
            dest = os.path.join(PHOTOS, f"{no}.jpg")
            try:
                blob = get(IMG_BASE + t["image_path"], binary=True)
                with open(dest, "wb") as fh:
                    fh.write(blob)
                shrink(dest)
                ok += 1
            except Exception as e:                      # noqa: BLE001
                print(f"  ! {no} 失敗：{e}")
                fail += 1
                if os.path.exists(dest):
                    os.remove(dest)
            if idx % 50 == 0 or idx == len(todo):
                print(f"  進度 {idx}/{len(todo)}（成功 {ok}、失敗 {fail}）")
                time.sleep(0.4)

    have = sorted(os.path.splitext(f)[0] for f in os.listdir(PHOTOS) if f.endswith(".jpg"))
    total_bytes = sum(os.path.getsize(os.path.join(PHOTOS, f)) for f in os.listdir(PHOTOS)
                      if f.endswith(".jpg"))
    meta = {
        "source_name": "澳門特別行政區政府市政署 澳門自然網 — 古樹名木",
        "source_page": "https://www.iam.gov.mo/nature/c/tree",
        "list_endpoint": LIST_URL,
        "photo_base": IMG_BASE,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "record_count": len(trees),
        "photo_count": len(have),
        "photo_bytes": total_bytes,
        "photo_max_px": PHOTO_MAX,
        "license_note": "資料與照片著作權屬澳門市政署；本平台為非商業教學研究用途並標示出處。",
    }
    json.dump(meta, open(os.path.join(DATA, "iam_meta.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"照片完成：{len(have)} 張、{total_bytes / 1048576:.1f} MB")
    print(json.dumps(meta, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
