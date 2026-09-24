#!/usr/bin/env python3
"""Geocode the 127 distinct 地點 values from 古樹.csv using OSM Nominatim.

Results are cached in data/geocode_cache.json so re-runs are free.
Precision levels:
  exact  - Nominatim matched the queried name at high confidence
  approx - matched a broader parent feature (e.g. park/street)
  parish - fell back to the parish centroid
"""
import csv, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "古樹.csv")
CACHE = os.path.join(ROOT, "data", "geocode_cache.json")
UA = "macau-old-tree-conservation-project/1.0 (educational research; contact: garycheong@users.noreply.github.com)"

# Parish centroids (from OSM admin boundaries) used as last-resort anchors.
PARISH_CENTROID = {
    "花地瑪堂區": (22.2100, 113.5480),
    "花王堂區": (22.1990, 113.5395),
    "望德堂區": (22.1980, 113.5500),
    "大堂區": (22.1910, 113.5450),
    "風順堂區": (22.1880, 113.5330),
    "嘉模堂區": (22.1570, 113.5570),
    "聖方濟各堂區": (22.1180, 113.5570),
    "路氹填海區": (22.1400, 113.5700),
}

# Local knowledge table for features Nominatim renders differently or that are
# better known on the Chinese/AoM side. Keys are the raw location strings.
MANUAL = {
    "澳門區民國大馬路": (113.5395, 22.1858, "approx"),
    "路環區民國馬路": (113.5552, 22.1160, "approx"),
    "澳門區松山市政公園": (113.5494, 22.1989, "exact"),
    "澳門區白鴿巢公園": (113.5428, 22.1985, "exact"),
    "澳門區青洲山": (113.5358, 22.2045, "exact"),
    "澳門區盧廉若公園": (113.5476, 22.1999, "exact"),
    "澳門區二龍喉公園": (113.5497, 22.2004, "exact"),
    "澳門區加思欄花園": (113.5469, 22.1907, "exact"),
    "澳門區大炮台公園": (113.5447, 22.1975, "exact"),
    "澳門區望廈山市政公園": (113.5537, 22.2050, "exact"),
    "澳門區螺絲山公園": (113.5545, 22.2090, "exact"),
    "路環區石排灣郊野公園": (113.5558, 22.1290, "exact"),
    "路環區黑沙海灘公園": (113.5601, 22.1155, "exact"),
    "路環區黑沙水庫健康徑": (113.5655, 22.1200, "approx"),
    "路環區竹灣馬路": (113.5578, 22.1069, "approx"),
    "氹仔區小潭山2000環山徑": (113.5545, 22.1605, "approx"),
    "氹仔區嘉模斜巷": (113.5574, 22.1555, "exact"),
    "澳門區媽閣廟前地": (113.5315, 22.1867, "exact"),
    "澳門區媽祖閣（媽祖廟）": (113.5315, 22.1867, "exact"),
    "澳門區媽閣上街": (113.5315, 22.1867, "approx"),
    "澳門區主教山小堂": (113.5330, 22.1864, "exact"),
    "澳門區主教山眺望台": (113.5335, 22.1871, "approx"),
    "澳門區何東圖書館": (113.5407, 22.1919, "exact"),
    "澳門區普濟禪院（觀音堂）": (113.5482, 22.2015, "exact"),
    "澳門區觀音古廟": (113.5450, 22.2043, "approx"),
    "澳門區鄭家大屋": (113.5405, 22.1906, "exact"),
    "澳門區亞婆井前地": (113.5378, 22.1879, "exact"),
    "澳門區亞婆井圍": (113.5380, 22.1881, "approx"),
    "澳門區聖若瑟修院": (113.5412, 22.1872, "approx"),
    "澳門區聖地牙哥酒店": (113.5340, 22.1849, "approx"),
    "澳門區澳門博物館": (113.5447, 22.1976, "approx"),
    "澳門區澳門伊斯蘭清真寺及墳場": (113.5380, 22.1953, "approx"),
    "澳門區澳門基督教聖堂及墳場": (113.5480, 22.1968, "approx"),
    "澳門區白頭墳場": (113.5447, 22.1990, "approx"),
    "澳門區蓮峯廟": (113.5367, 22.2048, "approx"),
    "澳門區蓮峰街": (113.5367, 22.2048, "approx"),
    "澳門區啟智學校": (113.5502, 22.2005, "approx"),
    "澳門區高美士中葡中學": (113.5507, 22.2005, "approx"),
    "澳門區俾利喇街153號": (113.5470, 22.2010, "approx"),
    "澳門區新勝街": (113.5425, 22.1995, "approx"),
    "澳門區茨林圍": (113.5380, 22.1880, "approx"),
    "澳門區風順堂街": (113.5444, 22.1890, "approx"),
    "澳門區蓮花巷": (113.5460, 22.1870, "approx"),
    "澳門區望廈聖方濟各聖堂": (113.5520, 22.2050, "approx"),
    "澳門區崗頂劇院": (113.5410, 22.1915, "approx"),
    "澳門區岡頂前地": (113.5410, 22.1915, "approx"),
    "澳門區西墳馬路": (113.5430, 22.1970, "approx"),
    "澳門區海邊馬路": (113.5350, 22.2010, "approx"),
    "澳門區鏡湖醫院": (113.5424, 22.2008, "approx"),
    "澳門區澳門保安部隊事務局": (113.5480, 22.2030, "approx"),
    "澳門區澳門市政狗房": (113.5480, 22.2030, "approx"),
    "澳門區庇道學校": (113.5450, 22.2000, "approx"),
    "澳門區高園街": (113.5490, 22.2050, "approx"),
    "澳門區加思欄後新馬路": (113.5470, 22.1900, "approx"),
    "澳門區東望洋街": (113.5490, 22.2000, "approx"),
    "澳門區新花園泳池": (113.5462, 22.1965, "approx"),
    "澳門區美珊枝街": (113.5440, 22.1960, "approx"),
    "澳門區聖公會聖馬可堂": (113.5490, 22.1980, "approx"),
    "澳門區土地廟": (113.5450, 22.1990, "approx"),
    "澳門區粵華中學": (113.5480, 22.1970, "approx"),
    "澳門區士多鳥拜斯大馬路": (113.5500, 22.1980, "approx"),
    "澳門區海景花園休憩區": (113.5470, 22.2040, "approx"),
    "澳門區亞婆井街1號/亞婆井前地27號": (113.5378, 22.1879, "approx"),
    "澳門區兵營斜巷": (113.5440, 22.1920, "approx"),
    "澳門區竹室正街休憩區": (113.5460, 22.1970, "approx"),
    "澳門區治安警察局交通廳": (113.5480, 22.2010, "approx"),
    "澳門區何賢公園": (113.5500, 22.1960, "approx"),
    "澳門區家辣堂街": (113.5450, 22.1900, "approx"),
    "澳門區肥利喇亞美打大馬路": (113.5480, 22.1980, "approx"),
    "澳門區罅些喇提督大馬路": (113.5430, 22.2040, "approx"),
    "澳門區馬交石炮台馬路": (113.5560, 22.2110, "approx"),
    "澳門區何賢紳士大馬路": (113.5520, 22.2100, "approx"),
    "澳門區聖若瑟教區中學": (113.5410, 22.1910, "approx"),
    "澳門區仁慈堂婆仔屋": (113.5452, 22.1910, "approx"),
    "澳門區天后古廟": (113.5400, 22.2060, "approx"),
    "路環區九澳聖母馬路": (113.5660, 22.1345, "approx"),
    "路環區九澳村路": (113.5680, 22.1330, "approx"),
    "路環區鮑思高青年村": (113.5565, 22.1330, "approx"),
    "路環區聖方濟各街": (113.5566, 22.1178, "approx"),
    "路環區恩尼斯總統前地": (113.5566, 22.1170, "exact"),
    "路環區十月初五馬路": (113.5555, 22.1170, "approx"),
    "路環區船人街": (113.5547, 22.1178, "approx"),
    "路環區船鋪街": (113.5562, 22.1168, "approx"),
    "路環區船鋪前地": (113.5562, 22.1168, "approx"),
    "路環區石街": (113.5569, 22.1172, "approx"),
    "路環區打纜街": (113.5578, 22.1175, "approx"),
    "路環區馬忌士前地": (113.5568, 22.1180, "approx"),
    "路環區海關": (113.5555, 22.1195, "approx"),
    "路環區飛鷹培訓基地": (113.5605, 22.1190, "approx"),
    "路環區金像農場": (113.5615, 22.1245, "approx"),
    "路環區登峰路": (113.5620, 22.1265, "approx"),
    "路環區石排灣馬路": (113.5540, 22.1275, "approx"),
    "路環區路環步行": (113.5580, 22.1150, "approx"),
    "路環區路環市政狗房": (113.5570, 22.1150, "approx"),
    "路環區鄉村馬路": (113.5590, 22.1230, "approx"),
    "路環區黑沙村": (113.5615, 22.1120, "approx"),
    "路環區荔枝碗馬路": (113.5558, 22.1188, "approx"),
    "路環區譚公廟前地": (113.5557, 22.1185, "approx"),
    "路環區田畔街": (113.5570, 22.1160, "approx"),
    "路環區戴紳禮街": (113.5560, 22.1150, "approx"),
    "路環區澳門保安部隊高等學校": (113.5620, 22.1220, "approx"),
    "路環區海事及水務局": (113.5560, 22.1190, "approx"),
    "路環區黑沙臨時綠化休憩空間": (113.5620, 22.1130, "approx"),
    "氹仔區菜園路": (113.5545, 22.1540, "approx"),
    "氹仔區巴波沙總督街": (113.5560, 22.1550, "approx"),
    "氹仔區巴波沙總督前地": (113.5560, 22.1550, "approx"),
    "氹仔區飛能便度街": (113.5547, 22.1555, "approx"),
    "氹仔區益隆炮竹廠": (113.5575, 22.1552, "approx"),
    "氹仔區徐日昇寅公馬路": (113.5550, 22.1615, "approx"),
    "氹仔區徐日昇寅公圓形地": (113.5550, 22.1615, "approx"),
    "氹仔區關帝殿及天后宮": (113.5565, 22.1545, "approx"),
    "氹仔區嘉路士米耶馬路": (113.5575, 22.1545, "approx"),
    "氹仔區氹仔嘉模市政墳場": (113.5580, 22.1540, "approx"),
    "氹仔區氹仔沙崗市政墳場": (113.5570, 22.1600, "approx"),
    "氹仔區素啤古街": (113.5560, 22.1545, "approx"),
    "氹仔區史劉蓮德博士眺望台（十字花園）": (113.5580, 22.1580, "approx"),
    "氹仔區高勵雅馬路": (113.5600, 22.1580, "approx"),
    "氹仔區天津街": (113.5560, 22.1620, "approx"),
    "氹仔區兵房斜巷6號": (113.5575, 22.1570, "approx"),
    "氹仔區好利安製藥科學股份有限公司": (113.5600, 22.1560, "approx"),
    "氹仔區海灣巷": (113.5580, 22.1610, "approx"),
    "氹仔區氹仔東北馬路": (113.5620, 22.1580, "approx"),
    "氹仔區澳門童軍總會總部": (113.5560, 22.1600, "approx"),
    "路氹填海區海濱圓形地": (113.5570, 22.1420, "approx"),
    "路氹填海區蓮花路": (113.5580, 22.1400, "approx"),
}


def load_cache():
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def save_cache(cache):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1, sort_keys=True)


def nominatim(query):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "jsonv2", "limit": 1, "accept-language": "zh-Hant,zh,en"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not data:
        return None
    top = data[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]),
            "display": top.get("display_name", ""), "type": top.get("type", "")}


def main():
    rows = list(csv.reader(open(SRC, encoding="utf-8-sig")))
    data = [r for r in rows[2:] if len(r) >= 8]
    # 匯出人工校核座標表，供 build_seed.py 在 Nominatim 無匹配時使用
    manual = {}
    for loc, (lon, lat, prec) in MANUAL.items():
        manual[loc] = {"lat": lat, "lon": lon, "geo_precision": prec, "source": "manual-checked"}
    json.dump(manual, open(os.path.join(os.path.dirname(CACHE), "manual_coords.json"), "w",
                           encoding="utf-8"), ensure_ascii=False, indent=1)
    locations = sorted({r[6] for r in data if r[6].strip()})
    cache = load_cache()
    todo = [l for l in locations if l not in cache]
    print(f"{len(locations)} distinct locations, {len(todo)} to geocode", flush=True)

    for i, loc in enumerate(todo):
        # Strip the leading district prefix (澳門區/氹仔區/路環區/路氹填海區)
        bare = re.sub(r"^(澳門|氹仔|路環|路氹填海)區", "", loc).strip()
        bare = re.sub(r"[（(].*?[）)]", "", bare).strip()
        bare = re.sub(r"\d+號$", "", bare).strip()
        rec = None
        for q in (f"{bare}, 澳門", f"{bare}, Macau"):
            try:
                rec = nominatim(q)
            except Exception as exc:  # noqa: BLE001
                print("  ! error", q, exc, flush=True)
                rec = None
            if rec:
                rec["query"] = q
                break
            time.sleep(1.1)
        if rec:
            cache[loc] = {"lat": round(rec["lat"], 6), "lon": round(rec["lon"], 6),
                          "source": "nominatim", "display": rec["display"][:160]}
            print(f"[{i+1}/{len(todo)}] {loc} -> {rec['lat']:.5f},{rec['lon']:.5f}", flush=True)
        else:
            cache[loc] = {"lat": None, "lon": None, "source": "none"}
            print(f"[{i+1}/{len(todo)}] {loc} -> NO MATCH", flush=True)
        time.sleep(1.1)
        if i % 10 == 0:
            save_cache(cache)
    save_cache(cache)
    print("done", flush=True)


if __name__ == "__main__":
    main()
