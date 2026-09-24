#!/usr/bin/env python3
"""第二輪：為每個品種挑選「真正的相片」。

第一輪由 Wikidata P18 取得主圖，但部分條目主圖是植物學插圖（Köhler / Bra… / Flora 等）。
本輪對每個品種收集多個 Commons 候選檔，按分數挑選最像實物相片的一張：
  * 含屬名 +3、含完整二名法 +2
  * .jpg/.jpeg +3；插圖字樣（Bra\\d、Köhler、Medizinal、Flora、plate、drawing…）-4
  * 含 tree/leaves/trunk/bark/fruit/flower/Macau/Hong Kong 等字樣 +1
同時修正少數中文俗名對應的學名（例如澳門名錄的「心葉榕」即「假菩提樹」Ficus rumphii）。
"""
import json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "species.json")
PHOTOS = os.path.join(ROOT, "public", "photos", "species")
UA = {"User-Agent": "MacauHeritageTreeProject/1.0 (educational research; contact: garycheong@users.noreply.github.com)"}
API = "https://commons.wikimedia.org/w/api.php"

ILLUSTRATION = re.compile(
    r"(bra\d|köhler|kohler|medizinal|illustration|flora|plate|drawing|sketch|blason|"
    r"icon|logo|map|diagram|herbier|herbarium|specimen|\.png$|\.svg$|\.tif)", re.I)
GOOD_WORDS = re.compile(r"(tree|leaves|leaf|trunk|bark|fruit|flower|habit|fruits|"
                        r"macau|macao|hong ?kong|hainan|bonsai|foliage|crown|branch)", re.I)


def api(url, tries=6):
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


def search_files(term, limit=12):
    url = (API + "?action=query&format=json&list=search&srnamespace=6"
           f"&srlimit={limit}&srsearch=" + urllib.parse.quote(term))
    try:
        return [h["title"] for h in api(url).get("query", {}).get("search", [])]
    except Exception as exc:  # noqa: BLE001
        print("  search failed", term, exc, flush=True)
        return []


def imageinfo(title, width=760):
    url = (API + "?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size"
           f"&iiurlwidth={width}&titles=" + urllib.parse.quote(title))
    for _, p in api(url)["query"]["pages"].items():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii or not ii.get("thumburl"):
            continue
        meta = ii.get("extmetadata", {})
        artist = (meta.get("Artist", {}).get("value", "") or "")
        artist = re.sub(r"<[^>]+>", "", artist).split("\n")[0].strip()[:70] or "Wikimedia Commons"
        return {
            "thumb": ii["thumburl"], "page": ii.get("descriptionurl"),
            "credit": artist, "license": meta.get("LicenseShortName", {}).get("value", "CC"),
            "width": ii.get("width"), "height": ii.get("height"),
        }
    return None


def score(title, sci):
    genus = (sci or "").split(" ")[0]
    s = 0
    if genus and genus.lower() in title.lower():
        s += 3
    if sci and sci.lower().replace(" ", "_") in title.lower().replace(" ", "_"):
        s += 2
    if re.search(r"\.(jpe?g)$", title, re.I):
        s += 3
    if ILLUSTRATION.search(title):
        s -= 4
    if GOOD_WORDS.search(title):
        s += 1
    return s


def download(url, dest):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
            blob = r.read()
        if len(blob) < 2500:
            return False
        open(dest, "wb").write(blob)
        return True
    except Exception as exc:  # noqa: BLE001
        print("  ! download", exc, flush=True)
        return False


def main():
    data = json.load(open(OUT, encoding="utf-8"))
    names = sorted(data.keys())
    os.makedirs(PHOTOS, exist_ok=True)
    changed = 0
    for i, name in enumerate(names):
        rec = data[name]
        sci = rec.get("scientific")
        if name == "心葉榕":                      # 澳門名錄用名 = 香港所稱「假菩提樹」
            sci = "Ficus rumphii"
            rec["scientific"] = sci
            rec["name_note"] = "澳門古樹名錄稱「心葉榕」；香港及內地一般稱「假菩提樹」，學名 Ficus rumphii。"
        if not sci:
            print(f"[{i+1}/{len(names)}] {name} 無學名，跳過", flush=True)
            continue

        current = rec.get("commons_file") or ""
        cur_score = score(current, sci)
        candidates = [c for c in search_files(f"{sci} filetype:bitmap", 12)]
        candidates += search_files(f"{sci}", 6)
        best = None
        for t in dict.fromkeys(candidates):
            sc = score(t, sci)
            if not best or sc > best[1]:
                best = (t, sc)
        if not best or best[1] <= cur_score:
            print(f"[{i+1}/{len(names)}] {name} 保留原圖（{cur_score}） {current}", flush=True)
            time.sleep(0.8)
            continue
        title, sc = best
        try:
            info = imageinfo(title)
        except Exception as exc:  # noqa: BLE001
            print(f"[{i+1}/{len(names)}] {name} imageinfo 失敗 {exc}", flush=True)
            time.sleep(2)
            continue
        if not info:
            continue
        local = os.path.join(PHOTOS, f"{i:02d}.jpg")
        if not download(info["thumb"], local):
            print(f"[{i+1}/{len(names)}] {name} 下載失敗，保留原圖", flush=True)
            time.sleep(1)
            continue
        rec.update({
            "commons_file": title, "photo_credit": info["credit"], "photo_license": info["license"],
            "photo_page": info["page"], "photo_local": f"photos/species/{i:02d}.jpg",
            "photo_remote": None, "is_illustration": False,
        })
        rec.pop("photo_remote", None)
        changed += 1
        print(f"[{i+1}/{len(names)}] {name} 換圖 {cur_score}→{sc}  {title}", flush=True)
        json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1.0)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"完成，更新 {changed} 個品種相片", flush=True)


if __name__ == "__main__":
    main()
