#!/usr/bin/env python3
"""把 古樹.csv ＋ 地理編碼結果 ＋ 物種資料 ＋ 科普內容，整合成：
  * supabase/seed.sql   —— 可直接在 Supabase SQL Editor 執行的資料匯入腳本
  * data/snapshot.json  —— 扁平化資料快照（本地示範模式與測試使用）
並印出資料品質檢查報告。
"""
import csv, json, math, os, re, statistics
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
    iam = load("iam_trees.json", {}) or {}
    iam_meta = load("iam_meta.json", {}) or {}

    rows = list(csv.reader(open(SRC, encoding="utf-8-sig")))
    raw = [r for r in rows[2:] if len(r) >= 8]

    # ---- 正規化 -------------------------------------------------------------
    sites, species, trees = {}, {}, []
    warnings = []
    value_diffs = defaultdict(list)   # 《名錄》值 vs 市政署官方值 的差異（資料品質報告用）
    sci_versions = {}                 # 學名版本差異：現行接受名 vs 市政署名（舊組合／亞種）

    for i, r in enumerate(raw):
        grade, age, no, sp, height, health, place, parish = (x.strip() for x in r[:8])
        age = int(float(age))
        height = float(height)
        bare = re.sub(r"^(澳門|氹仔|路環|路氹填海)區", "", place).strip()
        bare = re.sub(r"[（(].*?[）)]", "", bare).strip()

        official = iam.get(no) or {}

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

        # 官方座標優先：市政署逐株座標屬實測成果，取代本研究的地理編碼近似值
        if official.get("lat") and official.get("lon"):
            lat, lon = official["lat"], official["lon"]
            prec, src = "official", "iam"

        sites.setdefault(place, {
            "name_zh": place, "short_name": bare, "parish_code": parish,
            "lat": lat, "lon": lon, "geo_precision": prec, "geo_source": src,
        })
        s = sites[place]
        # 地點座標取第一株有座標者；官方座標一律優先覆蓋較粗略的來源
        if lat is not None and (s["lat"] is None or (src == "iam" and s["geo_source"] != "iam")):
            s.update(lat=lat, lon=lon, geo_precision=prec, geo_source=src)

        # 學名：以本研究查證之現行接受名為主；市政署名若為舊組合／亞種，並列不覆蓋
        meta = dict(species_meta.get(sp) or {"name": sp})
        if official.get("species_sci"):
            if not meta.get("scientific"):
                meta["scientific"] = official["species_sci"]
                meta["scientific_source"] = "iam"
            elif meta["scientific"].lower() != official["species_sci"].lower():
                meta["name_sci_official"] = official["species_sci"]
                sci_versions.setdefault(sp, (meta["scientific"], official["species_sci"]))
        if not meta.get("scientific"):
            warnings.append(f"物種未對應學名: {sp}")
        if official.get("description") and not meta.get("wikidata_desc"):
            meta["wikidata_desc"] = official["description"]
            meta["description_source"] = "iam"
        species[sp] = meta

        # CSV 與官方數值若不一致，記錄下來（仍以官方為主，CSV 為輔）
        for field, label, mine in (("age_years", "樹齡", age), ("height_m", "樹高", height),
                                   ("grade", "分級", grade), ("health", "健康", health)):
            theirs = official.get(field)
            if theirs is None:
                continue
            try:                      # 數值欄位以數值比較，避免 515 與 515.0 被當成不一致
                same = abs(float(theirs) - float(mine)) < 0.05
            except (TypeError, ValueError):
                same = str(theirs) == str(mine)
            if not same:
                value_diffs[label].append((no, mine, theirs))

        trees.append({
            "tree_no": no, "grade": grade, "age_years": age, "height_m": height,
            "health": health, "species": sp, "site": place, "parish": parish,
            # ── 市政署官方欄位 ──
            "official_no": official.get("official_no"),
            "iam_tree_no": official.get("iam_tree_no"),
            "ref_id": official.get("ref_id"),
            "crown_m": official.get("crown_m"),
            "diameter_cm": official.get("diameter_cm"),
            "girth_cm": official.get("girth_cm"),
            "stem_count": official.get("stem_count"),
            "stem_measures": official.get("stem_measures"),
            "official_description": official.get("description"),
            "official_loc": official.get("loc"),
            # 市政署現行值：與《名錄》不一致時，前端會並列說明
            "official_age_years": official.get("age_years"),
            "official_height_m": official.get("height_m"),
            "official_health": official.get("health"),
            "official_grade": official.get("grade"),
            "photo_url": (f"/photos/trees/{no}.jpg"
                          if official.get("image_path") and official.get("photo_ok") is not False
                          else None),
            "photo_source": ("https://www.iam.gov.mo/nature/Content" + official["image_path"]
                             if official.get("image_path") and official.get("photo_ok") is not False
                             else None),
            "photo_count": official.get("image_count"),
        })

    # 座標：以官方逐株座標為主，只把「落在同一點」的樹做確定性微小偏移，避免地圖標記完全重疊
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
        seen = {}
        for t in group:
            if t.get("lat") is None or t.get("lon") is None:
                if s["lat"] is None:
                    t["lat"] = t["lon"] = None
                    t["geo_precision"] = None
                    continue
                t["lat"], t["lon"] = s["lat"], s["lon"]
            if t.get("geo_precision") is None:
                t["geo_precision"] = s["geo_precision"]
            key = (round(t["lat"], 6), round(t["lon"], 6))
            k = seen.get(key, 0)
            seen[key] = k + 1
            if k:
                # 同一座標的第 2 株起，以黃金角小半徑散開（約 8–40 公尺）
                ang = k * 2.399963
                rad = 8 + 8 * k
                dlat = (rad * math.cos(ang)) / 111320
                dlon = (rad * math.sin(ang)) / (111320 * math.cos(math.radians(t["lat"])))
                t["lat"] = round(t["lat"] + dlat, 6)
                t["lon"] = round(t["lon"] + dlon, 6)

    # ---- 組 SQL ------------------------------------------------------------
    L = []
    L.append("-- 由 scripts/build_seed.py 自動產生，請勿手動編輯。")
    L.append("-- 匯入順序：堂區 → 物種 → 地點 → 古樹 → 路綫 → 科普 → 時間線")
    L.append("begin;")
    L.append("truncate table public.trees, public.sites, public.species, public.parishes,"
             " public.routes, public.conservation_topics, public.timeline_events restart identity cascade;")
    L.append("")
    # ---- 限制條件自我修復 -------------------------------------------------
    # 舊版資料庫的 CHECK「允許值」可能過時（例如 sites.geo_precision 早期不含 'official'），
    # 此時下方 insert 會撞 23514。若使用者只執行 seed 這一段（在 SQL Editor 中選取後按 Run
    # 只會執行選取範圍），上面的 schema 升級段落不會被執行，因此在這裡再做一次最保險：
    # 此刻資料表剛被 truncate、沒有任何資料，重建限制條件最安全、也不需要正規化。
    L.extend([
        "-- ---------------------------------------------------------------------------",
        "-- 限制條件自我修復：移除舊版（允許值過時）的 CHECK 後重建，避免 23514",
        "--   23514: new row for relation \"sites\" violates check constraint \"sites_geo_precision_check\"",
        "-- 資料表剛被 truncate，重建最安全；重複執行亦無副作用。",
        "-- ---------------------------------------------------------------------------",
        "do $$",
        "declare",
        "    r record;",
        "begin",
        "    for r in",
        "        select c.conname, c.conrelid::regclass as tbl",
        "        from pg_constraint c",
        "        join pg_class t on t.oid = c.conrelid",
        "        join pg_namespace n on n.oid = t.relnamespace",
        "        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)",
        "        where c.contype = 'c' and n.nspname = 'public'",
        "          and t.relname in ('sites', 'trees')",
        "          and a.attname in ('geo_precision', 'grade', 'health')",
        "    loop",
        "        execute format('alter table %s drop constraint %I', r.tbl, r.conname);",
        "    end loop;",
        "end $$;",
        "alter table public.sites drop constraint if exists sites_geo_precision_check;",
        "alter table public.sites add constraint sites_geo_precision_check",
        "  check (geo_precision in ('official','exact','approx','parish'));",
        "alter table public.trees drop constraint if exists trees_grade_check;",
        "alter table public.trees add constraint trees_grade_check check (grade in ('一級','二級','三級','不分級'));",
        "alter table public.trees drop constraint if exists trees_health_check;",
        "alter table public.trees add constraint trees_health_check check (health in ('健康','一般','瀕危'));",
        "",
    ])

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
    TREE_COLS = ("tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon,"
                 "geo_precision,official_no,iam_tree_no,ref_id,crown_m,diameter_cm,girth_cm,"
                 "stem_count,stem_measures,surround_m,"
                 "official_description,official_loc,photo_url,photo_source,photo_count,"
                 "official_age_years,official_height_m,official_health,official_grade")
    chunk = []

    def tree_row(t):
        return "(" + ",".join([
            q(t["tree_no"]), str(sp_ids[t["species"]]), str(site_ids[t["site"]]), q(t["parish"]),
            q(t["grade"]), str(t["age_years"]), str(t["height_m"]), q(t["health"]),
            str(t["lat"]) if t.get("lat") is not None else "NULL",
            str(t["lon"]) if t.get("lon") is not None else "NULL",
            q(t.get("geo_precision")), q(t.get("official_no")), q(t.get("iam_tree_no")),
            q(t.get("ref_id")),
            str(t["crown_m"]) if t.get("crown_m") is not None else "NULL",
            str(t["diameter_cm"]) if t.get("diameter_cm") is not None else "NULL",
            str(t["girth_cm"]) if t.get("girth_cm") is not None else "NULL",
            str(int(t["stem_count"])) if t.get("stem_count") is not None else "NULL",
            q(t.get("stem_measures")),
            str(t["surround_m"]) if t.get("surround_m") is not None else "NULL",
            q(t.get("official_description")), q(t.get("official_loc")),
            q(t.get("photo_url")), q(t.get("photo_source")),
            str(t["photo_count"]) if t.get("photo_count") is not None else "NULL",
            str(int(t["official_age_years"])) if t.get("official_age_years") is not None else "NULL",
            str(t["official_height_m"]) if t.get("official_height_m") is not None else "NULL",
            q(t.get("official_health")), q(t.get("official_grade")),
        ]) + ")"

    for t in trees:
        chunk.append(tree_row(t))
        if len(chunk) == 100:
            L.append(f"insert into public.trees ({TREE_COLS}) values\n" + ",\n".join(chunk) + ";")
            chunk = []
    if chunk:
        L.append(f"insert into public.trees ({TREE_COLS}) values\n" + ",\n".join(chunk) + ";")
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
            "name_sci_official": m.get("name_sci_official"),
            "wikidata_id": m.get("wikidata"),
            "description": m.get("wikidata_desc"),
            "description_source": m.get("description_source"),
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
        "official": {
            "source_name": iam_meta.get("source_name", "澳門市政署 澳門自然網"),
            "source_page": iam_meta.get("source_page", "https://www.iam.gov.mo/nature/c/tree"),
            "list_endpoint": iam_meta.get("list_endpoint"),
            "fetched_at": iam_meta.get("fetched_at"),
            "record_count": len(iam),
            "photo_count": iam_meta.get("photo_count"),
            "license_note": iam_meta.get("license_note"),
        },
        "generated_from": "古樹.csv（澳門市政署《古樹名木保護名錄》整理）＋ 市政署澳門自然網古樹名木公開資料",
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
    print(f"官方資料覆蓋  : 座標 {sum(1 for t in trees if t.get('official_no'))}/{len(trees)}、"
          f"照片 {sum(1 for t in trees if t.get('photo_url'))}、"
          f"描述 {sum(1 for t in trees if t.get('official_description'))}、"
          f"冠幅 {sum(1 for t in trees if t.get('crown_m') is not None)}、"
          f"胸徑 {sum(1 for t in trees if t.get('diameter_cm') is not None)}、"
          f"胸圍 {sum(1 for t in trees if t.get('girth_cm') is not None)}、"
          f"多主幹 {sum(1 for t in trees if (t.get('stem_count') or 1) > 1)}")
    print("品種 Top5     :", Counter(t["species"] for t in trees).most_common(5))
    print("堂區分佈      :", dict(Counter(t["parish"] for t in trees).most_common()))
    print("sql 位元組    :", os.path.getsize(os.path.join(ROOT, "supabase", "seed.sql")))
    print("snapshot 位元組:", os.path.getsize(os.path.join(DATA, "snapshot.json")))
    if sci_versions:
        print(f"學名版本差異  : {len(sci_versions)} 種（本研究採現行接受名，市政署用舊組合或亞種名）")
        for sp, (mine, theirs) in list(sci_versions.items())[:5]:
            print(f"  {sp}：{mine} ←→ 市政署 {theirs}")
    if value_diffs:
        print("名錄 vs 官方差異:", {k: len(v) for k, v in sorted(value_diffs.items())})
        for label, rows_ in sorted(value_diffs.items()):
            ex = "、".join(f"#{n} {a}→{b}" for n, a, b in rows_[:3])
            print(f"  {label} 例：{ex}（共 {len(rows_)} 株）")
    if warnings:
        print(f"警告 {len(set(warnings))} 類：")
        for w in sorted(set(warnings))[:20]:
            print("   -", w)
    print("=" * 64)


if __name__ == "__main__":
    main()
