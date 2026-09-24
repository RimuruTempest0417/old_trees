#!/usr/bin/env python3
"""Resolve every 品種 (tree species) to its Wikidata item, scientific name and a
freely-licensed Commons photo. Writes data/species.json + downloads thumbs."""
import csv, json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "古樹.csv")
OUT = os.path.join(ROOT, "data", "species.json")
PHOTOS = os.path.join(ROOT, "public", "photos", "species")
UA = {"User-Agent": "MacauHeritageTreeProject/1.0 (https://github.com/; educational research; contact: garycheong@users.noreply.github.com)",
      "Accept": "application/json"}

# Manual scientific-name overrides where the zh vernacular search is ambiguous.
OVERRIDE = {
    "心葉榕": "Ficus rumphii",
    "榕樹": "Ficus microcarpa",
    "高山榕": "Ficus altissima",
    "青果榕": "Ficus variegata",
    "樟樹": "Cinnamomum camphora",
    "海南蒲桃": "Syzygium hainanense",
    "洋蒲桃": "Syzygium samarangense",
    "龍眼": "Dimocarpus longan",
    "雞蛋花": "Plumeria rubra",
    "紅雞蛋花": "Plumeria rubra",
    "木棉": "Bombax ceiba",
    "羅漢松": "Podocarpus macrophyllus",
    "假柿木薑子": "Litsea monopetala",
    "翻白葉樹": "Pterospermum heterophyllum",
    "朴樹": "Celtis sinensis",
    "闊葉合歡": "Albizia lebbeck",
    "鳳凰木": "Delonix regia",
    "華潤楠": "Machilus chinensis",
    "假蘋婆": "Sterculia lanceolata",
    "蘋婆": "Sterculia monosperma",
    "桑": "Morus alba",
    "楊桃": "Averrhoa carambola",
    "菠蘿蜜": "Artocarpus heterophyllus",
    "九里香": "Murraya paniculata",
    "芒果": "Mangifera indica",
    "無患子": "Sapindus mukorossi",
    "水翁": "Syzygium nervosum",
    "石栗": "Aleurites moluccanus",
    "白蘭": "Michelia alba",
    "山杜英": "Elaeocarpus sylvestris",
    "石斑木": "Rhaphiolepis indica",
    "翅子樹": "Pterospermum acerifolium",
    "烏桕": "Triadica sebifera",
    "馬尾松": "Pinus massoniana",
    "鐵刀木": "Senna siamea",
    "荔枝": "Litchi chinensis",
    "破布木": "Cordia dichotoma",
    "榔榆": "Ulmus parvifolia",
    "紫薇": "Lagerstroemia indica",
    "赤桉": "Eucalyptus camaldulensis",
    "山烏桕": "Triadica cochinchinensis",
    "橄欖": "Canarium album",
    "黃蘭": "Michelia champaca",
    "紅膠木": "Lophostemon confertus",
    "鐵冬青": "Ilex rotunda",
    "銀柴": "Aporosa dioica",
    "土蜜樹": "Bridelia tomentosa",
    "桂木": "Artocarpus nitidus",
    "餘甘子": "Phyllanthus emblica",
    "潺槁樹": "Litsea glutinosa",
    "鴨腳木": "Schefflera octophylla",
    "米仔蘭": "Aglaia odorata",
    "人面子": "Dracontomelon duperreanum",
    "人心果": "Manilkara zapota",
    "白桂木": "Artocarpus hypargyreus",
    "黃槿": "Talipariti tiliaceum",
    "鐵冬青 ": "Ilex rotunda",
}


def api(url, tries=6):
    delay = 5.0
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            return json.loads(urllib.request.urlopen(req, timeout=40).read())
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503, 500, 502, 504) and attempt < tries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 90)
                continue
            raise
        except Exception:
            if attempt < tries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 90)
                continue
            raise
    raise RuntimeError("unreachable")


def wikidata_search(name):
    url = ("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json"
           "&language=zh&uselang=zh&type=item&limit=5&search=" + urllib.parse.quote(name))
    for hit in api(url).get("search", []):
        desc = (hit.get("description") or "")
        if any(k in desc for k in ("植物", "樹", "属", "種", "plant", "tree", "species", "genus")):
            return hit["id"], hit.get("label", name), desc
    hits = api(url).get("search", [])
    return (hits[0]["id"], hits[0].get("label", name), hits[0].get("description", "")) if hits else (None, None, None)


def entity(qid):
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    return api(url)["entities"][qid]


def claim_value(ent, prop, lang=None):
    for c in ent.get("claims", {}).get(prop, []):
        try:
            dv = c["mainsnak"]["datavalue"]["value"]
        except KeyError:
            continue
        if lang:
            if isinstance(dv, dict) and dv.get("language") == lang:
                return dv["text"]
        elif isinstance(dv, str):
            return dv
    return None


def commons_image_url(filename, width=720):
    fn = filename.replace(" ", "_")
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           f"&iiprop=url|extmetadata&iiurlwidth={width}&titles=" + urllib.parse.quote("File:" + fn))
    pages = api(url)["query"]["pages"]
    for _, p in pages.items():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii:
            return None
        meta = ii.get("extmetadata", {})
        return {
            "thumb": ii.get("thumburl") or ii.get("url"),
            "page": ii.get("descriptionurl"),
            "artist": (meta.get("Artist", {}).get("value", "") or "").replace("<", " <").split("<")[0].strip()[:80]
                      or "Wikimedia Commons",
            "license": meta.get("LicenseShortName", {}).get("value", "CC"),
        }
    return None


def download(url, dest):
    if not url:
        return False
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=45) as r:
            blob = r.read()
        if len(blob) < 1200:
            return False
        with open(dest, "wb") as fh:
            fh.write(blob)
        return True
    except Exception as exc:  # noqa: BLE001
        print("  ! download failed", url, exc, flush=True)
        return False


def main():
    rows = list(csv.reader(open(SRC, encoding="utf-8-sig")))
    data = [r for r in rows[2:] if len(r) >= 8]
    names = sorted({r[3].strip() for r in data if r[3].strip()})
    os.makedirs(PHOTOS, exist_ok=True)
    result = {}
    if os.path.exists(OUT):
        result = json.load(open(OUT, encoding="utf-8"))

    for i, name in enumerate(names):
        if name in result and result[name].get("photo_local"):
            continue
        try:
            rec = process(name, i)
        except Exception as exc:  # noqa: BLE001
            print(f"[{i+1}/{len(names)}] {name} -> ERROR {exc}", flush=True)
            result.setdefault(name, {"name": name, "error": str(exc)[:120]})
            json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            time.sleep(3)
            continue
        result[name] = rec
        print(f"[{i+1}/{len(names)}] {name} -> {rec.get('scientific')} | {rec.get('photo_local') or rec.get('photo_remote')}", flush=True)
        json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1.2)
    print("species done:", len(result), flush=True)


def process(name, i):
    rec = {"name": name}
    sci = OVERRIDE.get(name)
    qid = label = desc = None
    img = None
    try:
        qid, label, desc = wikidata_search(name)
        if qid:
            ent = entity(qid)
            if not sci:
                sci = claim_value(ent, "P225")
            img = claim_value(ent, "P18")
    except Exception as exc:  # noqa: BLE001
        print("  ! wikidata failed", name, exc, flush=True)
    if not img:
        try:
            surl = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search"
                    "&srnamespace=6&srlimit=1&srsearch=" + urllib.parse.quote(f"{sci or name} filetype:bitmap"))
            hits = api(surl)["query"]["search"]
            img = hits[0]["title"].split(":", 1)[1] if hits else None
        except Exception:  # noqa: BLE001
            img = None
    rec.update({"scientific": sci, "wikidata": qid, "wikidata_label": label,
                "wikidata_desc": desc, "commons_file": img})
    if img:
        try:
            info = commons_image_url(img)
        except Exception:  # noqa: BLE001
            info = None
        if info:
            rec["photo_credit"] = info["artist"]
            rec["photo_license"] = info["license"]
            rec["photo_page"] = info["page"]
            local = os.path.join(PHOTOS, f"{i:02d}.jpg")
            ok = download(info["thumb"], local)
            rec["photo_local"] = f"photos/species/{i:02d}.jpg" if ok else None
            if not ok:
                rec["photo_remote"] = info["thumb"]
    return rec


if __name__ == "__main__":
    main()
