#!/usr/bin/env python3
"""為每個古樹地點抓取一張「實地相片」。

來源：Wikimedia Commons 地理搜尋（geosearch，半徑 400 米、檔案命名空間），
只取自由授權圖片，並記錄作者與授權。輸出 data/site_photos.json ＋ public/photos/sites/。
"""
import json, os, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "site_photos.json")
PHOTOS = os.path.join(ROOT, "public", "photos", "sites")
UA = {"User-Agent": "MacauHeritageTreeProject/1.0 (educational research; contact: garycheong@users.noreply.github.com)"}
API = "https://commons.wikimedia.org/w/api.php"


def api(url, tries=5):
    delay = 4.0
    for attempt in range(tries):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read())
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print("  retry:", exc, flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 60)
    raise RuntimeError


def geosearch(lat, lon, radius=400, limit=8):
    url = (API + "?action=query&format=json&list=geosearch&gsnamespace=6"
           f"&gsradius={radius}&gslimit={limit}&gscoord={lat}|{lon}")
    return api(url).get("query", {}).get("geosearch", [])


def imageinfo(title, width=760):
    url = (API + "?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size"
           f"&iiurlwidth={width}&titles=" + urllib.parse.quote(title))
    pages = api(url)["query"]["pages"]
    for _, p in pages.items():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii or not ii.get("thumburl"):
            continue
        meta = ii.get("extmetadata", {})
        return {
            "photo_remote": ii["thumburl"],
            "photo_page": ii.get("descriptionurl"),
            "photo_credit": ((meta.get("Artist", {}).get("value", "") or "")
                             .replace("<", " <").split("<")[0].strip()[:80] or "Wikimedia Commons"),
            "photo_license": meta.get("LicenseShortName", {}).get("value", "CC"),
            "width": ii.get("width"), "height": ii.get("height"),
        }
    return None


def download(url, dest):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
            blob = r.read()
        if len(blob) < 2000:
            return False
        open(dest, "wb").write(blob)
        return True
    except Exception as exc:  # noqa: BLE001
        print("  ! download:", exc, flush=True)
        return False


def main():
    cache = json.load(open(os.path.join(DATA, "geocode_cache.json"), encoding="utf-8"))
    result = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    os.makedirs(PHOTOS, exist_ok=True)
    todo = [k for k, v in cache.items() if v.get("lat") and k not in result]
    print(f"{len(cache)} 地點，{len(todo)} 待處理", flush=True)

    for i, name in enumerate(sorted(todo), start=1):
        lat, lon = cache[name]["lat"], cache[name]["lon"]
        rec = {"photo_remote": None}
        try:
            hits = geosearch(lat, lon)
        except Exception as exc:  # noqa: BLE001
            print(f"[{i}/{len(todo)}] {name} geosearch 失敗 {exc}", flush=True)
            result[name] = rec
            json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            time.sleep(3)
            continue
        # 選最接近的一張（跳過地圖／圖示類檔案）
        for h in hits:
            t = h["title"]
            if any(bad in t.lower() for bad in ("map", "plan", "logo", "flag", "coat of arms", "icon")):
                continue
            try:
                info = imageinfo(t)
            except Exception:  # noqa: BLE001
                info = None
            if not info:
                continue
            rec.update(info)
            rec["distance_m"] = round(h.get("dist", 0))
            rec["source"] = "commons-geosearch"
            local = os.path.join(PHOTOS, f"{i:03d}.jpg")
            if download(info["photo_remote"], local):
                rec["photo_local"] = f"photos/sites/{i:03d}.jpg"
            rec["commons_title"] = t
            break
        result[name] = rec
        print(f"[{i}/{len(todo)}] {name} -> {rec.get('photo_local') or rec.get('photo_remote') or 'NONE'}"
              f" ({rec.get('distance_m','?')}m)", flush=True)
        json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1.0)
    print("site photos done:", len(result), flush=True)


if __name__ == "__main__":
    main()
