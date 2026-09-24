#!/usr/bin/env python3
"""把 古樹.csv ＋ 地理編碼結果 ＋ 物種資料 ＋ 科普內容，整合成：
  * supabase/seed.sql   —— 可直接在 Supabase SQL Editor 執行的資料匯入腳本
  * data/snapshot.json  —— 扁平化資料快照（本地示範模式與測試使用）
並印出資料品質檢查報告。
"""
import csv, json, os, re, statistics
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def find_source():
    for cand in (
        os.path.join(os.path.dirname(ROOT), "古樹.csv"),   # 原始工作資料夾
        os.path.join(ROOT, "source-data", "古樹.csv"),      # 已複製進專案
        os.path.join(ROOT, "古樹.csv"),
    ):
        if os.path.exists(cand):
            return cand
    raise SystemExit("找不到 古樹.csv")


SRC = find_source()


def load(name, default=None):
    path = os.path.join(DATA, name)
    if os.path.exists(path):
        return json.load(open(path, encoding="utf-8"))
    return default


def q(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    s = str(value).replace("'", "''")
    return "'" + s + "'"


def qarr(values):
    if not values:
        return "'{}'"
    return "ARRAY[" + ", ".join(q(v) for v in values) + "]::text[]"


def main():
    geocache = load("geocode_cache.json", {})
    manual_coords = load("manual_coords.json", {})
    species_meta = load("species.json", {})
    site_photos = load("site_photos.json", {})
    parishes = load("parishes.json")
    routes = load("routes.json")
    topics = load("conservation.json")
    timeline = load("timeline.json")

    rows = list(csv.reader(open(SRC, encoding="utf-8-sig")))
    raw = [r for r in rows[2:] if len(r) >= 8]

    # ---- 正規化 -------------------------------------------------------------
    sites, species, trees = {}, {}, []
    warnings = []

    for i, r in enumerate(raw):
        grade, age, no, sp, height, health, place, parish = (x.strip() for x in r[:8])
        age = int(float(age))
        height = float(height)
        bare = re.sub(r"^(澳門|氹仔|路環|路氹填海)區", "", place).strip()
        bare = re.sub(r"[（(].*?[）)]", "", bare).strip()

        geo = geocache.get(place) or {}
        manual = manual_coords.get(place) or {}
        lat, lon, prec, src = geo.get("lat"), geo.get("lon"), None, None
        if lat is not None:
            prec, src = "exact", "nominatim"
            disp = (geo.get("display") or "").lower()
            # Nominatim 只回傳城市／堂區層級者，視為粗略匹配
            if "macau" == disp.strip() or "澳門" == disp.strip():
                prec = "approx"
        elif manual.get("lat") is not None:
            lat, lon = manual["lat"], manual["lon"]
            prec, src = manual.get("geo_precision", "approx"), "manual-checked"
        sites.setdefault(place, {
            "name_zh": place, "short_name": bare, "parish_code": parish,
            "lat": lat, "lon": lon, "geo_precision": prec, "geo_source": src,
        })
        s = sites[place]
        if s["lat"] is None and lat is not None:
            s.update(lat=lat, lon=lon, geo_precision=prec, geo_source=src)

        if sp not in species_meta or not species_meta[sp].get("scientific"):
            warnings.append(f"物種未對應學名: {sp}")
        species.setdefault(sp, species_meta.get(sp, {"name": sp}))
        trees.append({"tree_no": no, "grade": grade, "age_years": age, "height_m": height,
                      "health": health, "species": sp, "site": place, "parish": parish})

    # 座位標記：同地點多株樹，座標加上確定性微小偏移，令地圖可辨識（避免完全重疊）
    by_site = defaultdict(list)
    for t in trees:
        by_site[t["site"]].append(t)
    for site_name, group in by_site.items():
        s = sites[site_name]
        if s["lat"] is None:
            # 最後回退：堂區中心點
            p = next((x for x in parishes if x["code"] == s["parish_code"]), None)
            if p:
                s.update(lat=p["centroid_lat"], lon=p["centroid_lon"],
                         geo_precision="parish", geo_source="parish-centroid")
                warnings.append(f"地點無法定位，回退堂區中心: {site_name}")
        group.sort(key=lambda t: (-t["age_years"], t["tree_no"]))
        n = len(group)
        for j, t in enumerate(group):
            if s["lat"] is None:
                t["lat"] = t["lon"] = None
                continue
            if n == 1:
                t["lat"], t["lon"] = s["lat"], s["lon"]
            else:
                # 黃金角螺旋散佈，半徑 15–95 米
                ang = j * 2.399963
                rad = 15 + 80 * (j / max(n - 1, 1))
                dlat = (rad * __import__("math").cos(ang)) / 111320
                dlon = (rad * __import__("math").sin(ang)) / (111320 * __import__("math").cos(
                    __import__("math").radians(s["lat"])))
                t["lat"] = round(s["lat"] + dlat, 6)
                t["lon"] = round(s["lon"] + dlon, 6)
            t["geo_precision"] = s["geo_precision"]

    # ---- 組 SQL ------------------------------------------------------------
    L = []
    L.append("-- 由 scripts/build_seed.py 自動產生，請勿手動編輯。")
    L.append("-- 匯入順序：堂區 → 物種 → 地點 → 古樹 → 路綫 → 科普 → 時間線")
    L.append("begin;")
    L.append("truncate table public.trees, public.sites, public.species, public.parishes,"
             " public.routes, public.conservation_topics, public.timeline_events restart identity cascade;")
    L.append("")

    L.append("-- 堂區")
    for p in parishes:
        L.append("insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ("
                 f"{q(p['code'])},{q(p['name_zh'])},{q(p['name_pt'])},{p['area_km2']},"
                 f"{p['centroid_lat']},{p['centroid_lon']},{q(p['note'])});")
    L.append("")

    L.append("-- 物種")
    sp_ids = {}
    for i, (name, meta) in enumerate(sorted(species.items()), start=1):
        sp_ids[name] = i
        L.append("insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,"
                 "photo_license,photo_page,description) values ("
                 f"{i},{q(name)},{q(meta.get('scientific'))},{q(meta.get('wikidata'))},"
                 f"{q(meta.get('photo_local') and '/' + meta['photo_local'] or meta.get('photo_remote'))},"
                 f"{q(meta.get('photo_credit'))},{q(meta.get('photo_license'))},{q(meta.get('photo_page'))},"
                 f"{q(meta.get('wikidata_desc'))});")
    L.append("")

    L.append("-- 地點")
    site_ids = {}
    for i, (name, s) in enumerate(sorted(sites.items()), start=1):
        site_ids[name] = i
        ph = site_photos.get(name) or {}
        L.append("insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,"
                 "geo_source,photo_url,photo_credit,photo_license,photo_page) values ("
                 f"{i},{q(name)},{q(s['short_name'])},{q(s['parish_code'])},"
                 f"{s['lat'] if s['lat'] is not None else 'NULL'},"
                 f"{s['lon'] if s['lon'] is not None else 'NULL'},"
                 f"{q(s['geo_precision'])},{q(s['geo_source'])},"
                 f"{q(ph.get('photo_local') and '/' + ph['photo_local'] or ph.get('photo_remote'))},"
                 f"{q(ph.get('photo_credit'))},{q(ph.get('photo_license'))},{q(ph.get('photo_page'))});")
    L.append("")

    L.append("-- 古樹")
    chunk = []
    for t in trees:
        chunk.append("(" + ",".join([
            q(t["tree_no"]), str(sp_ids[t["species"]]), str(site_ids[t["site"]]), q(t["parish"]),
            q(t["grade"]), str(t["age_years"]), str(t["height_m"]), q(t["health"]),
            str(t["lat"]) if t.get("lat") is not None else "NULL",
            str(t["lon"]) if t.get("lon") is not None else "NULL",
        ]) + ")")
        if len(chunk) == 100:
            L.append("insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,"
                     "height_m,health,lat,lon) values\n" + ",\n".join(chunk) + ";")
            chunk = []
    if chunk:
        L.append("insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,"
                 "height_m,health,lat,lon) values\n" + ",\n".join(chunk) + ";")
    L.append("")

    L.append("-- 路綫")
    for r in routes:
        L.append("insert into public.routes (code,name_zh,summary,parish_codes,site_names,species_focus,"
                 "max_stops,sort_order,tips) values ("
                 f"{q(r['code'])},{q(r['name_zh'])},{q(r['summary'])},{qarr(r['parish_codes'])},"
                 f"{qarr(r['site_names'])},{q(r['species_focus'])},{r['max_stops']},{r['sort_order']},{q(r['tips'])});")
    L.append("")

    L.append("-- 保育科普")
    for t in topics:
        L.append("insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ("
                 f"{q(t['slug'])},{q(t['category'])},{q(t['title'])},{q(t['summary'])},{q(t['body_md'])},"
                 f"{qarr(t['sources'])},{t['sort_order']});")
    L.append("")

    L.append("-- 立法時間線")
    for e in timeline:
        L.append("insert into public.timeline_events (year,event_date,title,detail,source) values ("
                 f"{e['year']},{q(e['event_date'])},{q(e['title'])},{q(e['detail'])},{q(e['source'])});")
    L.append("")
    L.append("-- 重設序列，確保後續 insert 不會撞號")
    for tbl in ("species", "sites", "trees", "routes", "conservation_topics", "timeline_events"):
        L.append(f"select setval(pg_get_serial_sequence('public.{tbl}','id'),"
                 f" coalesce((select max(id) from public.{tbl}), 1));")
    L.append("commit;")

    os.makedirs(os.path.join(ROOT, "supabase"), exist_ok=True)
    with open(os.path.join(ROOT, "supabase", "seed.sql"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")

    # ---- 快照（示範模式／測試用）-------------------------------------------
    def media(meta):
        """把 photo_local / photo_remote 正規化為統一的 photo_url"""
        if not meta:
            return {}
        return {
            "photo_url": ("/" + meta["photo_local"]) if meta.get("photo_local") else meta.get("photo_remote"),
            "photo_credit": meta.get("photo_credit"),
            "photo_license": meta.get("photo_license"),
            "photo_page": meta.get("photo_page"),
        }

    snapshot_species = []
    for name, m in sorted(species.items()):
        snapshot_species.append({
            "name_zh": name,
            "name_sci": m.get("scientific"),
            "wikidata_id": m.get("wikidata"),
            "description": m.get("wikidata_desc"),
            **media(m),
        })

    snapshot_sites = []
    for name, s in sorted(sites.items()):
        snapshot_sites.append({
            "name_zh": name, "short_name": s["short_name"], "parish_code": s["parish_code"],
            "lat": s["lat"], "lon": s["lon"],
            "geo_precision": s["geo_precision"], "geo_source": s["geo_source"],
            **media(site_photos.get(name)),
        })

    snapshot = {
        "trees": [{**t, "site_short": sites[t["site"]]["short_name"]} for t in trees],
        "sites": snapshot_sites,
        "species": snapshot_species,
        "parishes": parishes,
        "routes": routes,
        "conservation": topics,
        "timeline": timeline,
        "generated_from": "古樹.csv（澳門市政署《古樹名木保護名錄》整理）",
    }
    with open(os.path.join(DATA, "snapshot.json"), "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, ensure_ascii=False)
    # 同時輸出 .js 版本，讓 Serverless Function 能以靜態 import 打包（示範模式用）
    with open(os.path.join(DATA, "snapshot.js"), "w", encoding="utf-8") as fh:
        fh.write("/* 由 scripts/build_seed.py 自動產生；與 supabase/seed.sql 同源。 */\n")
        fh.write("export default ")
        json.dump(snapshot, fh, ensure_ascii=False)
        fh.write(";\n")

    # ---- 品質報告 ----------------------------------------------------------
    ages = [t["age_years"] for t in trees]
    heights = [t["height_m"] for t in trees]
    print("=" * 64)
    print(f"古樹紀錄      : {len(trees)}")
    print(f"地點          : {len(sites)}")
    print(f"物種          : {len(species)}")
    print(f"堂區          : {len(parishes)}")
    print(f"樹齡  min/med/max : {min(ages)}/{statistics.median(ages)}/{max(ages)}")
    print(f"樹高  min/med/max : {min(heights)}/{statistics.median(heights)}/{max(heights)}")
    print(f"座標缺失      : {sum(1 for t in trees if t.get('lat') is None)}")
    print("精度分佈      :", dict(Counter(t.get("geo_precision") for t in trees)))
    print("品種 Top5     :", Counter(t["species"] for t in trees).most_common(5))
    print("堂區分佈      :", dict(Counter(t["parish"] for t in trees).most_common()))
    print("sql 位元組    :", os.path.getsize(os.path.join(ROOT, "supabase", "seed.sql")))
    print("snapshot 位元組:", os.path.getsize(os.path.join(DATA, "snapshot.json")))
    if warnings:
        print(f"警告 {len(set(warnings))} 類：")
        for w in sorted(set(warnings))[:20]:
            print("   -", w)
    print("=" * 64)


if __name__ == "__main__":
    main()
