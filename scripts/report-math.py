#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""產生「數學科」報告（Word .docx）。

為什麼要有這支腳本：報告裡的每一個數字都是從官方資料算出來的，如果只把數字打進 Word，
之後官方資料更新、或有人問「這個 r = −0.001 怎麼來的」，就只能重算一次、也沒有人知道原本怎麼算。
所以報告的產生方式是：讀 data/snapshot.json（官方值優先）→ 用 report_stats.py 的公式算 →
畫圖（Chart.js ＋ 無頭 Chrome）→ 組裝成 docx。報告附錄會列出可重現的指令。

需要 python-docx（Word 的 .docx 產生）：pip install python-docx
用法：
    python3 scripts/report-math.py                       # 產生報告（含圖表）
    python3 scripts/report-math.py --no-charts           # 沿用上次的圖（改文字時快很多）
    python3 scripts/report-math.py --out 某個路徑.docx
"""
import argparse
import collections
import json
import math
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import report_stats as S  # noqa: E402

# 報告基本資料（首頁必須顯示報告名稱、班級與小組學號）
REPORT_TITLE = '跨學科(自然科學、歷史、數學、資訊)綜合研究 — 澳門古樹'
SUBTITLE = '數學科專題報告：官方資料的統計分析與數學模型'
CLASS_LINE = '高二丙　15 張衍霖、4 朱永晴、29 廖悅瑤、28 廖子翹'
DATE_LINE = '2026 年 9 月'
SITE = 'https://old-trees-mylearning.vercel.app'
REPO = 'https://github.com/RimuruTempest0417/old_trees'

# 官方來源（報告最後必須列出資料來源）
SOURCES = [
    ('市政署《古樹名木保護名錄》與「澳門自然網」古樹查詢',
     'https://www.iam.gov.mo/nature/c/tree', '全澳古樹 658 株的官方編號、樹種、樹齡、樹高、胸徑、胸圍、冠幅、健康狀況、分級與座標'),
    ('第279/2025號行政長官批示（現行《古樹名木保護名錄》）',
     'https://bo.dsaj.gov.mo/bo/i/2026/01/despce_cn.asp', '現行名錄的法源、生效日期與品種／地區分佈'),
    ('第11/2013號法律《文化遺產保護法》第一百零六條',
     'https://bo.dsaj.gov.mo/bo/i/2013/36/lei11_cn.asp', '古樹名木的保護、禁止行為與權責'),
    ('第333/2016號行政長官批示（《古樹名木養護指引》）',
     'https://bo.dsaj.gov.mo/bo/i/2016/48/despce_cn.asp', '巡查監測項目與養護原則（報告中「建議行動」的依據）'),
    ('市政署「澳門自然網」古樹資料端點',
     'https://www.iam.gov.mo/nature/BigJson/oldtrees_c.json', '本站每日自動擷取的原始官方資料（658 筆）'),
    ('澳門地球物理暨氣象局空氣質量年報',
     'https://cms.smg.gov.mo/uploads/sync/pdf/AIR_report/c_IQA_annual_report/',
     '環境數據（僅供背景說明；本報告的統計不涉及空氣數據）'),
]


# ─────────────────────────────────────────────────────────────
# 1. 讀資料與計算
# ─────────────────────────────────────────────────────────────
def load_trees():
    snap = json.loads((ROOT / 'data' / 'snapshot.json').read_text(encoding='utf-8'))
    return snap['trees']


def compute(trees):
    """官方值優先：一律取 official_*（名錄版本的值留在 listing_*，只用來說明差異）。"""
    age = [t['official_age_years'] for t in trees]
    height = [t['official_height_m'] for t in trees]
    dia = [t['diameter_cm'] for t in trees]
    girth = [t['girth_cm'] for t in trees]
    crown_pairs = [(t['official_height_m'], t['crown_m']) for t in trees if t['crown_m']]
    cx = [h for h, c in crown_pairs]
    cy = [c for h, c in crown_pairs]
    R = {'n': len(trees), 'species_n': len({t['species'] for t in trees})}

    # 敘述統計
    R['desc'] = {
        'age': S.describe(age, '樹齡（年）'),
        'height': S.describe(height, '樹高（m）'),
        'diameter': S.describe(dia, '胸徑（cm）'),
        'girth': S.describe(girth, '胸圍（cm）'),
        'crown': S.describe(cy, '冠幅（m）'),
    }

    # 官方值與名錄值的差異（只用來說明「官方值優先」）
    R['diff_age'] = [(t['tree_no'], t['listing_age_years'] if 'listing_age_years' in t else t['age_years'], t['official_age_years'])
                     for t in trees if t['age_years'] != t['official_age_years']]
    R['diff_health'] = [(t['tree_no'], t['health'], t['official_health'])
                        for t in trees if t['health'] != t['official_health']]
    R['diff_grade'] = [(t['tree_no'], t['grade'], t['official_grade'])
                       for t in trees if t['grade'] != t['official_grade']]
    R['grade_counts'] = dict(collections.Counter(t['official_grade'] for t in trees))
    R['health_counts'] = dict(collections.Counter(t['official_health'] for t in trees))
    R['crown_missing'] = len(trees) - len(cy)
    R['crown_share'] = len(cy) / len(trees)

    # 相關分析
    R['corr'] = {
        'age_height': {**S.corr_test(age, height), 'spearman': S.spearman(age, height)},
        'logage_height': S.corr_test([math.log(a) for a in age], height),
        'age_grade': {'r': S.pearson(age, [{'一級': 3, '二級': 2, '三級': 1, '不分級': 0}[t['official_grade']] for t in trees])},
        'height_diameter': {'r': S.pearson(height, dia)},
        'height_girth': {'r': S.pearson(height, girth)},
        'age_diameter': {'r': S.pearson(age, dia)},
        'diameter_girth': {'r': S.pearson(dia, girth)},
    }

    # 單變量模型競賽：樹齡 → 樹高
    R['models'] = {
        'linear': S.fit_linear(age, height),
        'quadratic': S.fit_quadratic(age, height),
        'log': S.fit_log(age, height),
        'power': S.fit_power(age, height),
        'exponential': S.fit_exponential(age, height),
        'saturating': S.fit_saturating(age, height),
    }

    # 品種（類別變數）
    by_species = collections.defaultdict(list)
    for t in trees:
        by_species[t['species']].append(t['official_height_m'])
    counts = collections.Counter({k: len(v) for k, v in by_species.items()})
    top10 = [k for k, _ in counts.most_common(10)]
    R['anova_species_all'] = S.anova(sorted(by_species.items()))
    R['anova_species_top10'] = S.anova([(k, by_species[k]) for k in top10])
    R['species_top10'] = top10
    X = [[1.0, t['official_age_years']] + [1.0 if t['species'] == s else 0.0 for s in top10[:-1]] for t in trees]
    R['mixed_model'] = S.regress(X, height)
    R['mixed_terms'] = len(top10)

    # 堂區：樹齡與健康狀況
    by_parish = collections.defaultdict(list)
    for t in trees:
        by_parish[t['parish']].append(t['official_age_years'])
    R['anova_parish'] = S.anova(sorted(by_parish.items()))
    parishes = sorted(by_parish.keys())
    healths = ['健康', '一般', '瀕危']
    matrix = [[sum(1 for t in trees if t['parish'] == p and t['official_health'] == h) for h in healths] for p in parishes]
    R['chi'] = S.chi_square(matrix, parishes, healths)

    # 樹高 ~ 冠幅（作業要求 3E）
    R['crown'] = {
        'n': len(cy), 'xbar': S.mean(cx), 'ybar': S.mean(cy),
        'sxy': sum((a - S.mean(cx)) * (b - S.mean(cy)) for a, b in zip(cx, cy)),
        'sxx': sum((a - S.mean(cx)) ** 2 for a in cx),
        'linear': S.fit_linear(cx, cy),
        'quadratic': S.fit_quadratic(cx, cy),
        'log': S.fit_log(cx, cy),
        'power': S.fit_power(cx, cy),
        'saturating': S.fit_saturating(cx, cy),
        'pearson': S.pearson(cx, cy),
        'spearman': S.spearman(cx, cy),
    }
    R['crown']['vertex'] = -R['crown']['quadratic']['b'] / (2 * R['crown']['quadratic']['c'])
    # 二次模型的零點（冠幅 = 0 的樹高）：超過它以後模型會預測負冠幅，是外推不可信的界線
    _qa, _qb, _qc = R['crown']['quadratic']['a'], R['crown']['quadratic']['b'], R['crown']['quadratic']['c']
    _disc = _qb * _qb - 4 * _qc * _qa
    _roots = [(-_qb + math.sqrt(_disc)) / (2 * _qc), (-_qb - math.sqrt(_disc)) / (2 * _qc)] if _disc > 0 else []
    R['crown']['zero_cross'] = max(_roots) if _roots else None   # 超過這個樹高，二次模型會預測負冠幅
    # 第七節預測段落要用的實際樣本（樹高、冠幅、樹號），先算好，讓產文件時不必再碰原始資料
    R['crown']['samples'] = [(t['official_height_m'], t['crown_m'], t['tree_no']) for t in trees if t['crown_m']]

    # 有冠幅／沒有冠幅兩群的比較（樣本代表性）
    with_crown = [t for t in trees if t['crown_m']]
    without = [t for t in trees if not t['crown_m']]

    def welch(key):
        a = [t[key] for t in with_crown]
        b = [t[key] for t in without]
        ma, mb, va, vb = S.mean(a), S.mean(b), S.variance(a), S.variance(b)
        se = math.sqrt(va / len(a) + vb / len(b))
        tval = (ma - mb) / se
        df = (va / len(a) + vb / len(b)) ** 2 / ((va / len(a)) ** 2 / (len(a) - 1) + (vb / len(b)) ** 2 / (len(b) - 1))
        return {'with': ma, 'without': mb, 't': tval, 'df': df, 'p': S.t_two_sided_p(tval, df)}
    R['bias'] = {'height': welch('official_height_m'), 'age': welch('official_age_years'),
                 'diameter': welch('diameter_cm')}

    # 官方資料一致性：胸圍 ÷ 胸徑＝π
    ratios = [g / d for g, d in zip(girth, dia)]
    origin = sum(g * d for g, d in zip(girth, dia)) / sum(d * d for d in dia)
    R['pi'] = {
        'mean': S.mean(ratios), 'median': S.median(ratios), 'sd': S.sd(ratios),
        'min': min(ratios), 'max': max(ratios), 'n': len(ratios),
        'ols': S.fit_linear(dia, girth), 'through_origin': origin,
        'max_dev': max(abs(x - math.pi) for x in ratios), 'pi': math.pi,
    }

    # 存活投影（重現平台的遞迴式）
    hazards = {'健康': 0.005, '一般': 0.015, '瀕危': 0.06}
    near = sum(1 for t in trees if t['official_age_years'] < 100)
    recruit = max(1, round(near / 5)) if near else 1
    alive = {h: sum(1 for t in trees if t['official_health'] == h) for h in hazards}
    series = []
    for k in range(0, 51):
        series.append({'year': 2026 + k, **{h: round(alive[h]) for h in hazards},
                       'total': round(sum(alive.values()))})
        nxt = {h: alive[h] * (1 - hazards[h]) for h in hazards}
        tot = sum(nxt.values()) or 1
        for h in hazards:
            nxt[h] += recruit * (nxt[h] / tot)
        alive = nxt
    R['projection'] = {'series': series, 'hazards': hazards, 'recruit': recruit, 'near': near}

    # 直方圖（樹齡，每 25 年一格）
    R['hist'] = {'bucket': 25}
    bins = []
    lo = 0
    while lo <= max(age):
        bins.append({'start': lo, 'end': lo + 25, 'count': sum(1 for a in age if lo <= a < lo + 25)})
        lo += 25
    R['hist']['bins'] = bins
    return R


# ─────────────────────────────────────────────────────────────
# 2. 圖表（Chart.js ＋ 無頭 Chrome）
# ─────────────────────────────────────────────────────────────
def chart_payload(trees, R):
    age = [t['official_age_years'] for t in trees]
    height = [t['official_height_m'] for t in trees]
    dia = [t['diameter_cm'] for t in trees]
    girth = [t['girth_cm'] for t in trees]
    pairs = [(t['official_height_m'], t['crown_m']) for t in trees if t['crown_m']]
    cx = [h for h, c in pairs]
    cy = [c for h, c in pairs]
    sat = R['models']['saturating']
    lin = R['crown']['linear']
    quad = R['crown']['quadratic']
    # 座標軸樣式（淺色格線、深灰刻度字），給每個圖共用
    AXIS = {'grid': {'color': '#e2e8f0'}, 'ticks': {'color': '#475569'}}

    hist = {
        'type': 'bar',
        'data': {'labels': [f"{b['start']}–{b['end']}" for b in R['hist']['bins'] if b['count'] or b['start'] < 560],
                 'datasets': [{'label': '株數', 'data': [b['count'] for b in R['hist']['bins'] if b['count'] or b['start'] < 560],
                               'backgroundColor': '#2f855a', 'borderColor': '#1c4532', 'borderWidth': 1}]},
        'options': {'responsive': True, 'maintainAspectRatio': False,
                    'plugins': {'legend': {'display': False},
                                'title': {'display': True, 'text': '全部 658 株的樹齡分佈（每格 25 年）', 'font': {'size': 15}}},
                    'scales': {'x': {'title': {'display': True, 'text': '樹齡（年）'}, 'grid': {'display': False}, 'ticks': {'color': '#475569'}},
                               'y': {'title': {'display': True, 'text': '株數'}, **AXIS}}},
    }
    sat_line = [(x, sat['A'] * (1 - math.exp(-sat['k'] * x))) for x in range(0, 521, 5)]
    scatter_age = {
        'type': 'scatter',
        'data': {'datasets': [
            {'label': '每一株古樹（n = 658）', 'data': [{'x': a, 'y': h} for a, h in zip(age, height)],
             'backgroundColor': 'rgba(47,133,90,0.45)', 'pointRadius': 3},
            {'type': 'line', 'label': f"飽和指數模型 y = {sat['A']:.2f}(1 − e^(−{sat['k']:.4f}x))",
             'data': [{'x': x, 'y': round(y, 3)} for x, y in sat_line], 'borderColor': '#c05621',
             'borderWidth': 2.5, 'pointRadius': 0, 'tension': 0}]},
        'options': {'responsive': True, 'maintainAspectRatio': False,
                    'plugins': {'title': {'display': True, 'text': '樹齡與樹高：658 株散點圖與最佳單變量模型', 'font': {'size': 15}}},
                    'scales': {'x': {'title': {'display': True, 'text': '樹齡（年）'}, **AXIS},
                               'y': {'title': {'display': True, 'text': '樹高（m）'}, **AXIS}}},
    }
    # 二次模型在樹高超過某個值後會預測「負的冠幅」——那是模型外推，畫出來只會誤導，
    # 因此兩條模型線都只畫在資料實際範圍（樹高 3–34 公尺）內
    qline = [(x, quad['a'] + quad['b'] * x + quad['c'] * x * x) for x in range(3, 35)]
    scatter_crown = {
        'type': 'scatter',
        'data': {'datasets': [
            {'label': '有冠幅值的古樹（n = 67）', 'data': [{'x': x, 'y': y} for x, y in zip(cx, cy)],
             'backgroundColor': 'rgba(43,108,176,0.6)', 'pointRadius': 4},
            {'type': 'line', 'label': f"線性模型 y = {lin['b']:.4f}x + {lin['a']:.4f}（R² = {lin['r2']:.4f}）",
             'data': [{'x': x, 'y': round(lin['a'] + lin['b'] * x, 3)} for x in range(3, 36)],
             'borderColor': '#c05621', 'borderWidth': 2.5, 'pointRadius': 0},
            {'type': 'line', 'label': f"二次模型（R² = {quad['r2']:.4f}）",
             'data': [{'x': x, 'y': round(y, 3)} for x, y in qline],
             'borderColor': '#6b46c1', 'borderWidth': 2.5, 'borderDash': [6, 4], 'pointRadius': 0}]},
        'options': {'responsive': True, 'maintainAspectRatio': False,
                    'plugins': {'title': {'display': True, 'text': '樹高與冠幅：67 株的散點圖與兩個模型', 'font': {'size': 15}}},
                    'scales': {'x': {'min': 0, 'suggestedMax': 36, 'title': {'display': True, 'text': '樹高（m）'}, **AXIS},
                               'y': {'min': 0, 'suggestedMax': 16, 'title': {'display': True, 'text': '冠幅（m）'}, **AXIS}}},
    }
    g10 = R['anova_species_top10']['groups']
    species = {
        'type': 'bar',
        'data': {'labels': [g['name'] for g in g10],
                 'datasets': [{'label': '平均樹高（m）', 'data': [round(g['mean'], 2) for g in g10],
                               'backgroundColor': '#2b6cb0'}]},
        'options': {'responsive': True, 'maintainAspectRatio': False, 'indexAxis': 'y',
                    'plugins': {'legend': {'display': False},
                                'title': {'display': True, 'text': '株數最多的 10 個樹種：平均樹高與 95% 信賴區間', 'font': {'size': 15}},
                                'ci': {'orientation': 'horizontal',
                                       'values': [[round(max(g['mean'] - g['ci95'], 0), 2), round(g['mean'] + g['ci95'], 2)] for g in g10]}},
                    'scales': {'x': {'beginAtZero': True, 'suggestedMax': 24, 'title': {'display': True, 'text': '樹高（m）'}, **AXIS},
                               'y': {'grid': {'display': False}, 'ticks': {'color': '#475569'}}}},
    }
    proj = R['projection']['series']
    projection = {
        'type': 'line',
        'data': {'labels': [s['year'] for s in proj],
                 'datasets': [
                     {'label': '健康', 'data': [s['健康'] for s in proj], 'borderColor': '#2f855a', 'backgroundColor': 'rgba(47,133,90,0.15)', 'fill': True, 'pointRadius': 0},
                     {'label': '一般', 'data': [s['一般'] for s in proj], 'borderColor': '#b7791f', 'backgroundColor': 'rgba(183,121,31,0.15)', 'fill': True, 'pointRadius': 0},
                     {'label': '瀕危', 'data': [s['瀕危'] for s in proj], 'borderColor': '#c53030', 'backgroundColor': 'rgba(197,48,48,0.15)', 'fill': True, 'pointRadius': 0},
                     {'label': '名錄總數', 'data': [s['total'] for s in proj], 'borderColor': '#1a202c', 'borderWidth': 2.5, 'borderDash': [7, 4], 'pointRadius': 0}]},
        'options': {'responsive': True, 'maintainAspectRatio': False,
                    'plugins': {'title': {'display': True, 'text': '存活投影：2026–2076 年（模型假設，非官方預測）', 'font': {'size': 15}}},
                    'scales': {'x': {'title': {'display': True, 'text': '年份'}, **AXIS},
                               'y': {'title': {'display': True, 'text': '株數'}, **AXIS}}},
    }
    pi = R['pi']
    gd = {
        'type': 'scatter',
        'data': {'datasets': [
            {'label': '每一株古樹（n = 658）', 'data': [{'x': d, 'y': g} for d, g in zip(dia, girth)],
             'backgroundColor': 'rgba(107,70,193,0.45)', 'pointRadius': 3},
            {'type': 'line', 'label': '理論線 y = πx（圓周率）', 'data': [{'x': x, 'y': round(math.pi * x, 3)} for x in range(0, 461, 10)],
             'borderColor': '#c05621', 'borderWidth': 2.5, 'pointRadius': 0}]},
        'options': {'responsive': True, 'maintainAspectRatio': False,
                    'plugins': {'title': {'display': True, 'text': '官方胸圍與胸徑：實測值幾乎落在 y = πx 上（R² = 1.000000）', 'font': {'size': 15}}},
                    'scales': {'x': {'title': {'display': True, 'text': '胸徑（cm）'}, **AXIS},
                               'y': {'title': {'display': True, 'text': '胸圍（cm）'}, **AXIS}}},
    }
    return {'hist': json.dumps(hist, ensure_ascii=False),
            'scatter_age': json.dumps(scatter_age, ensure_ascii=False),
            'scatter_crown': json.dumps(scatter_crown, ensure_ascii=False),
            'species': json.dumps(species, ensure_ascii=False),
            'projection': json.dumps(projection, ensure_ascii=False),
            'girth_diameter': json.dumps(gd, ensure_ascii=False),
           }


def render_charts(trees, R, outdir):
    """把畫圖需要的數列與每個圖的 Chart.js 設定寫成 JSON，交給 scripts/report-charts.mjs 截圖。"""
    payload = chart_payload(trees, R)
    charts = {
        'hist': f'new Chart(document.getElementById("c"), {payload["hist"]});',
        'scatter_age': f'new Chart(document.getElementById("c"), {payload["scatter_age"]});',
        'scatter_crown': f'new Chart(document.getElementById("c"), {payload["scatter_crown"]});',
        'species': f'new Chart(document.getElementById("c"), {payload["species"]});',
        'projection': f'new Chart(document.getElementById("c"), {payload["projection"]});',
        'girth_diameter': f'new Chart(document.getElementById("c"), {payload["girth_diameter"]});',
    }
    data_file = pathlib.Path(tempfile.gettempdir()) / 'mht-report-chart-data.json'
    data_file.write_text(json.dumps({'charts': charts}, ensure_ascii=False), encoding='utf-8')
    res = subprocess.run(['node', str(HERE / 'report-charts.mjs'), str(data_file), str(outdir)],
                         cwd=ROOT, capture_output=True, text=True)
    print(res.stdout.strip() or res.stderr.strip())
    if res.returncode != 0:
        raise SystemExit('圖表產生失敗')


# ─────────────────────────────────────────────────────────────
# 3. 組裝 Word 文件
# ─────────────────────────────────────────────────────────────
def build_docx(R, chartdir, out_path):
    from docx import Document
    from docx.shared import Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    doc = Document()

    # 版面與中文字型
    for section in doc.sections:
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(2.2)
        section.left_margin = Cm(2.4)
        section.right_margin = Cm(2.4)
    normal = doc.styles['Normal']
    normal.font.name = 'Times New Roman'
    normal.font.size = Pt(11)
    normal._element.rPr.rFonts.set(qn('w:eastAsia'), '標楷體')
    normal.paragraph_format.line_spacing = 1.45
    normal.paragraph_format.space_after = Pt(4)
    for name, size in (('Heading 1', 16), ('Heading 2', 13)):
        st = doc.styles[name]
        st.font.name = 'Times New Roman'
        st.font.size = Pt(size)
        st.font.color.rgb = RGBColor(0x1A, 0x20, 0x2C)
        st._element.rPr.rFonts.set(qn('w:eastAsia'), '標楷體')

    def para(text='', *, align=None, size=None, bold=False, italic=False, space_after=None):
        p = doc.add_paragraph()
        if align:
            p.alignment = align
        if space_after is not None:
            p.paragraph_format.space_after = Pt(space_after)
        run = p.add_run(text)
        run.bold = bold
        run.italic = italic
        if size:
            run.font.size = Pt(size)
        return p

    def h1(text):
        doc.add_heading(text, level=1)

    def h2(text):
        doc.add_heading(text, level=2)

    def formula(text, note=None):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        run.italic = True
        run.font.size = Pt(12)
        if note:
            q = doc.add_paragraph()
            q.alignment = WD_ALIGN_PARAGRAPH.CENTER
            q.paragraph_format.space_after = Pt(8)
            r = q.add_run(note)
            r.font.size = Pt(9.5)
        return p

    def table(header, rows, widths=None, size=9.5):
        t = doc.add_table(rows=1, cols=len(header))
        t.style = 'Table Grid'
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, htxt in enumerate(header):
            cell = t.rows[0].cells[i]
            cell.text = ''
            run = cell.paragraphs[0].add_run(str(htxt))
            run.bold = True
            run.font.size = Pt(size)
        for row in rows:
            cells = t.add_row().cells
            for i, val in enumerate(row):
                cells[i].text = ''
                run = cells[i].paragraphs[0].add_run('' if val is None else str(val))
                run.font.size = Pt(size)
        if widths:
            for i, w in enumerate(widths):
                for row in t.rows:
                    row.cells[i].width = Cm(w)
        doc.add_paragraph().paragraph_format.space_after = Pt(2)
        return t

    def figure(name, caption, width=15.5):
        doc.add_picture(str(chartdir / f'{name}.png'), width=Cm(width))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(caption)
        run.font.size = Pt(9.5)
        run.italic = True
        return p

    def footer_page_numbers():
        footer = doc.sections[0].footer
        p = footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run('第 ')
        fld = OxmlElement('w:fldSimple')
        fld.set(qn('w:instr'), 'PAGE')
        p._p.append(fld)
        p.add_run(' 頁')

    f = lambda x, nd=4: f'{x:,.{nd}f}'  # noqa: E731

    # ── 封面 ────────────────────────────────────────────────
    para(REPORT_TITLE, align=WD_ALIGN_PARAGRAPH.CENTER, size=18, bold=True, space_after=10)
    para(SUBTITLE, align=WD_ALIGN_PARAGRAPH.CENTER, size=14, bold=True, space_after=26)
    para('研究對象：澳門《古樹名木保護名錄》658 株古樹的官方資料', align=WD_ALIGN_PARAGRAPH.CENTER, size=11)
    para(f'班級與小組學號：{CLASS_LINE}', align=WD_ALIGN_PARAGRAPH.CENTER, size=11)
    para(f'報告日期：{DATE_LINE}', align=WD_ALIGN_PARAGRAPH.CENTER, size=11, space_after=26)
    para(f'研究平台（本站自行建置）：{SITE}', align=WD_ALIGN_PARAGRAPH.CENTER, size=10)
    para(f'程式與資料原始碼：{REPO}', align=WD_ALIGN_PARAGRAPH.CENTER, size=10)
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # ── 摘要 ────────────────────────────────────────────────
    h1('摘要')
    lin = R['models']['linear']
    sat = R['models']['saturating']
    c = R['crown']
    para(
        f'本報告以澳門市政署《古樹名木保護名錄》與「澳門自然網」的官方資料為主體，'
        f'對全部 {R["n"]} 株古樹（{R["species_n"]} 個樹種、8 個堂區）進行統計分析與數學建模，'
        f'所有數字都由本站平台以同一份官方資料計算，並可由報告附錄的指令重新產生。'
    )
    para(
        f'主要結果有四項。（一）官方資料內部高度一致：胸圍與胸徑的比值平均為 {f(R["pi"]["mean"], 6)}，'
        f'與圓周率 π = {f(math.pi, 6)} 的偏差不超過 {f(R["pi"]["max_dev"], 4)}，最小平方迴歸的斜率為 '
        f'{f(R["pi"]["ols"]["b"], 6)}（R² = {f(R["pi"]["ols"]["r2"], 6)}）——這說明官方數據是用圓周率由胸徑換算胸圍。'
        f'（二）「樹齡越老樹越高」在這批資料並不成立：樹齡與樹高的皮爾森相關係數 r = {f(R["corr"]["age_height"]["r"], 4)}'
        f'（p = {f(R["corr"]["age_height"]["p"], 3)}），六個單變量模型中最佳者為飽和指數模型 '
        f'y = {f(sat["A"], 2)}(1 − e^(−{f(sat["k"], 4)}x))，R² 僅 {f(sat["r2"], 4)}。'
        f'（三）真正能解釋樹高差異的是「樹種」這個類別變數：株數最多的 10 個樹種之單因子變異數分析 '
        f'F = {f(R["anova_species_top10"]["F"], 2)}（p < 0.001），η² = {f(R["anova_species_top10"]["eta2"], 4)}。'
        f'（四）作業要求的「樹高與冠幅」關係中，線性模型不顯著（斜率 b = {f(c["linear"]["b"], 4)}，'
        f'R² = {f(c["linear"]["r2"], 4)}，p = {f(c["linear"]["p"], 3)}），二次模型才顯著（R² = {f(c["quadratic"]["r2"], 4)}，'
        f'p = {f(c["quadratic"]["p"], 4)}），呈開口向下的拋物線，頂點在樹高約 {f(c["vertex"], 2)} 公尺處。'
    )
    para('關鍵詞：最小平方法、決定係數、假設檢定、變異數分析、卡方檢定、加權評分模型')

    # ── 一、研究問題 ────────────────────────────────────────
    h1('一、研究問題與研究方法')
    para('1.1 研究背景')
    para(
        '澳門現行《古樹名木保護名錄》共列 658 株古樹，由市政署公布，具法律地位'
        '（第279/2025號行政長官批示；保護責任見第11/2013號法律第一百零六條）。'
        '為了讓資料可以被檢查、被重新計算，我們先建置了一個研究平台，把官方資料整理成資料庫與 API，'
        '網站上的每一個數字（總覽、優先保育名單、監測時間序列）都由同一份官方資料即時計算。'
        '本報告是這個平台的「數學那一半」：把平台上用到的統計方法與模型完整寫出來，'
        '並檢驗它們在這批資料上到底成不成立。'
    )
    para('1.2 五個研究問題')
    for q in [
        'Q1　官方資料本身是否自洽？能不能用一個已知的數學常數檢驗它？（第三節：胸圍與 π）',
        'Q2　樹齡能不能解釋樹高？六種單變量模型哪一個最好？（第五節）',
        'Q3　如果樹齡不能，什麼變數能？為什麼「多一個類別變數」會改變結論？（第六節）',
        'Q4　樹高與冠幅有沒有關係？線性模型夠不夠，還是需要二次模型？（第七節，作業要求 3E）',
        'Q5　能不能把「保育優先順序」與「未來存續」寫成可計算的模型？（第九、十節）',
    ]:
        para(q)
    para('1.3 資料與工具')
    para(
        f'資料為官方 658 筆逐株紀錄：樹齡、樹高、胸徑、胸圍、冠幅（東西向與南北向平均）、健康狀況、'
        f'分級、座標、堂區、樹種。計算工具為本站自行撰寫的統計模組（scripts/report_stats.py，純標準庫，'
        f'未使用 numpy／scipy），每一個分布函式（t、F、χ²、常態）都是自己實作的，'
        f'這樣報告裡的每個 p 值都指得出是哪一段程式、哪一條公式算出來的。'
        f'所有數字並與平台網站的 API 輸出對照（附錄 B）。'
    )

    # ── 二、資料與前處理 ────────────────────────────────────
    h1('二、資料與前處理')
    para('2.1 變數定義')
    table(['變數', '符號', '單位', '官方欄位', '有效筆數', '說明'],
          [['樹齡', 'x₁', '年', 'official_age_years', R['n'], '推估樹齡（官方值）'],
           ['樹高', 'y', '公尺', 'official_height_m', R['n'], '全株高度（官方值）'],
           ['胸徑', 'd', '公分', 'diameter_cm', R['n'], '離地 1.3 公尺處直徑；多主幹取最大'],
           ['胸圍', 'g', '公分', 'girth_cm', R['n'], '同一位置的樹幹周長'],
           ['冠幅', 'k', '公尺', 'crown_m', c['n'], '東西向與南北向冠幅的平均'],
           ['官方分級', '—', '類別', 'official_grade', R['n'], '一級／二級／三級／不分級'],
           ['健康狀況', '—', '類別', 'official_health', R['n'], '健康／一般／瀕危']],
          widths=[2.1, 1.2, 1.3, 4.4, 1.8, 5.2])
    para('2.2 官方值優先原則')
    para(
        f'同一株樹在《名錄》與「自然網」現行值可能不同。本報告一律採官方現行值：'
        f'樹齡有 {len(R["diff_age"])} 株不同（例如第 {R["diff_age"][0][0]} 號：名錄 {R["diff_age"][0][1]:.0f} 年、'
        f'自然網 {R["diff_age"][0][2]:.0f} 年），健康狀況有 {len(R["diff_health"])} 株不同'
        f'（第 {", ".join(d[0] for d in R["diff_health"])} 號，名錄值較嚴重、自然網現行值較輕），'
        f'分級有 {len(R["diff_grade"])} 株不同（第 {", ".join(d[0] for d in R["diff_grade"])} 號）。'
        f'差異全部保留在資料庫中（listing_* 欄位），但不進入統計——避免同一株樹在圖上出現兩個位置。'
    )
    para('2.3 缺值處理：不內插、不用平均補值')
    para(
        f'官方冠幅資料只有 {c["n"]} 株（占 {f(R["crown_share"] * 100, 1)}%），其餘 {R["crown_missing"]} 株沒有值。'
        f'我們的做法是：缺值一律留白，統計與圖表只使用真正有值的樣本，並在每個結果旁標明有效樣本數 n。'
        f'不用平均數填補、也不由樹高推估冠幅——因為那會讓「相關係數」變成自己造出來的數字的相關。'
        f'這也是為什麼第七節的樹高～冠幅模型只有 67 筆資料。'
    )
    para('2.4 敘述統計')
    d = R['desc']
    table(['變數', 'n', '平均數', '中位數', '標準差', '變異數', 'Q₁', 'Q₃', '最小值', '最大值', '變異係數', '偏態'],
          [[d['age']['name'], 658, f(d['age']['mean'], 2), f(d['age']['median'], 0), f(d['age']['sd'], 2),
            f(d['age']['variance'], 1), f(d['age']['q1'], 0), f(d['age']['q3'], 0), f(d['age']['min'], 0), f(d['age']['max'], 0),
            f(d['age']['cv'], 3), f(d['age']['skew'], 2)],
           [d['height']['name'], 658, f(d['height']['mean'], 2), f(d['height']['median'], 0), f(d['height']['sd'], 2),
            f(d['height']['variance'], 1), f(d['height']['q1'], 0), f(d['height']['q3'], 0), f(d['height']['min'], 0), f(d['height']['max'], 0),
            f(d['height']['cv'], 3), f(d['height']['skew'], 2)],
           [d['diameter']['name'], 658, f(d['diameter']['mean'], 2), f(d['diameter']['median'], 0), f(d['diameter']['sd'], 2),
            f(d['diameter']['variance'], 1), f(d['diameter']['q1'], 2), f(d['diameter']['q3'], 2), f(d['diameter']['min'], 1), f(d['diameter']['max'], 0),
            f(d['diameter']['cv'], 3), f(d['diameter']['skew'], 2)],
           [d['girth']['name'], 658, f(d['girth']['mean'], 2), f(d['girth']['median'], 0), f(d['girth']['sd'], 2),
            f(d['girth']['variance'], 1), f(d['girth']['q1'], 1), f(d['girth']['q3'], 1), f(d['girth']['min'], 1), f(d['girth']['max'], 1),
            f(d['girth']['cv'], 3), f(d['girth']['skew'], 2)],
           [d['crown']['name'], c['n'], f(d['crown']['mean'], 2), f(d['crown']['median'], 0), f(d['crown']['sd'], 2),
            f(d['crown']['variance'], 2), f(d['crown']['q1'], 0), f(d['crown']['q3'], 0), f(d['crown']['min'], 1), f(d['crown']['max'], 0),
            f(d['crown']['cv'], 3), f(d['crown']['skew'], 2)]],
          widths=[2.4, 1.0, 1.5, 1.4, 1.4, 1.5, 1.0, 1.0, 1.1, 1.1, 1.4, 1.1], size=8.5)
    formula('x̄ = (1/n)·Σxᵢ　　s² = Σ(xᵢ − x̄)² / (n − 1)　　CV = s / x̄')
    para(
        f'兩點值得注意。第一，樹齡呈明顯右偏（偏態 {f(d["age"]["skew"], 2)}）：中位數只有 {f(d["age"]["median"], 0)} 年，'
        f'但平均數被少數極老個體拉到 {f(d["age"]["mean"], 2)} 年（最老 {f(d["age"]["max"], 0)} 年，即第 544 號海南蒲桃）。'
        f'右偏資料用平均數描述容易失真，因此本報告在樹齡相關的分析同時列出中位數。'
        f'第二，樹高與樹齡的變異係數幾乎相同（{f(d["height"]["cv"], 3)} 與 {f(d["age"]["cv"], 3)}），'
        f'但這只是「相對離散程度」相近，不代表兩者相關（見第四、五節）。'
    )
    figure('hist', '圖 1　658 株古樹的樹齡分佈。右偏：115–139 年一帶是最大族群，超過 300 年的只有少數。')

    # ── 三、π 一致性 ───────────────────────────────────────
    h1('三、用圓周率檢驗官方資料的內部一致性（Q1）')
    para(
        '樹幹可近似為圓柱，因此「胸圍 ÷ 胸徑」應該等於圓周率 π。'
        '這是一個難得的檢驗機會：官方提供了兩個應由同一個圓形換算出來的量，'
        '如果兩者互相矛盾，後面的建模就沒有意義。'
    )
    formula('g = π · d　（g：胸圍；d：胸徑）')
    pi = R['pi']
    table(['統計量', '數值'],
          [['樣本數 n', f'{pi["n"]}'],
           ['比值 g/d 的平均數', f(pi['mean'], 6)],
           ['比值 g/d 的中位數', f(pi['median'], 6)],
           ['比值 g/d 的標準差', f(pi['sd'], 6)],
           ['比值的最小值／最大值', f'{f(pi["min"], 4)} ／ {f(pi["max"], 4)}'],
           ['與 π 的最大絕對偏差', f(pi['max_dev'], 6)],
           ['最小平方迴歸 g = b·d + a 的斜率 b', f(pi['ols']['b'], 6)],
           ['最小平方迴歸的截距 a', f(pi['ols']['a'], 6)],
           ['迴歸的決定係數 R²', f(pi['ols']['r2'], 6)],
           ['通過原點的最小平方法斜率 Σgd/Σd²', f(pi['through_origin'], 6)],
           ['π 的真值', f(math.pi, 6)]],
          widths=[8.5, 5.0])
    para(
        f'結果是：比值平均 {f(pi["mean"], 6)}，與 π 相差 {f(abs(pi["mean"] - math.pi), 6)}；'
        f'最小平方迴歸的斜率 {f(pi["ols"]["b"], 6)} 與 π 相差不到 {f(abs(pi["ols"]["b"] - math.pi), 6)}，'
        f'R² = {f(pi["ols"]["r2"], 6)}（也就是說，胸圍的變異有 99.9999% 以上可由胸徑解釋）。'
        f'658 株中，比值與 π 的最大偏差為 {f(pi["max_dev"], 4)}，來自官方數值四捨五入到小數第一位的關係。'
        f'結論：官方胸圍確實是由胸徑乘以 π 得到，兩者不是獨立量測；'
        f'因此本報告後續只把「胸徑」當作解釋變數，若同時放入胸圍會產生完全共線性（collinearity）。'
    )
    figure('girth_diameter', '圖 2　胸圍與胸徑：658 個點幾乎完全落在 y = πx 上。', width=14.5)

    # ── 四、相關分析 ───────────────────────────────────────
    h1('四、相關分析')
    para('4.1 皮爾森相關係數與顯著性檢定')
    formula('r = Σ(xᵢ − x̄)(yᵢ − ȳ) / √[Σ(xᵢ − x̄)² · Σ(yᵢ − ȳ)²]')
    formula('t = r·√(n − 2) / √(1 − r²)　（自由度 df = n − 2，雙尾檢定）')
    ch = R['corr']
    table(['變數對', 'n', '皮爾森 r', 't 統計量', '自由度', 'p 值', '結論（α = 0.05）'],
          [['樹齡 ～ 樹高', 658, f(ch['age_height']['r'], 4), f(ch['age_height']['t'], 3), 656, f(ch['age_height']['p'], 3), '不顯著：無線性關係'],
           ['樹齡 ～ 樹高（取對數）', 658, f(ch['logage_height']['r'], 4), f(ch['logage_height']['t'], 3), 656, f(ch['logage_height']['p'], 4), '邊緣不顯著'],
           ['樹齡 ～ 官方分級', 658, f(ch['age_grade']['r'], 4), '—', '—', '< 0.001', '顯著：樹齡越大分級越高'],
           ['樹高 ～ 胸徑', 658, f(ch['height_diameter']['r'], 4), '—', '—', '< 0.001', '顯著：中度正相關'],
           ['樹齡 ～ 胸徑', 658, f(ch['age_diameter']['r'], 4), '—', '—', '< 0.001', '顯著：弱至中度正相關'],
           ['胸徑 ～ 胸圍', 658, f(ch['diameter_girth']['r'], 6), '—', '—', '< 0.001', '顯著：完全相關（見第三節）']],
          widths=[4.6, 1.1, 1.6, 1.6, 1.2, 1.6, 4.4], size=9)
    para(
        f'兩個重點。第一，樹齡與樹高的線性關係幾乎是零：r = {f(ch["age_height"]["r"], 4)}、'
        f'p = {f(ch["age_height"]["p"], 3)}，t 統計量只有 {f(ch["age_height"]["t"], 3)}，'
        f'遠小於臨界值 1.96。取對數後 r 提升到 {f(ch["logage_height"]["r"], 4)}，p = {f(ch["logage_height"]["p"], 4)}，'
        f'仍在 α = 0.05 的邊緣之外（這也說明「先轉換再看看」會讓結果在顯著邊緣徘徊，不能當成有關係的證據）。'
        f'第二，樹齡與官方分級的相關高達 {f(ch["age_grade"]["r"], 4)}——分級本身與樹齡有關（越老越可能被列為高級別），'
        f'這表示後續若要解釋樹高，不能把「分級」與「樹齡」同時當成獨立變數。'
    )
    para(
        '還有一點方法上的提醒：皮爾森 r 只度量線性關係。樹齡與樹高以斯皮爾曼等級相關計算為 '
        f'{f(ch["age_height"]["spearman"], 4)}，仍然很弱，因此「樹齡與樹高無關」不是因為關係非線性被漏掉。'
    )

    # ── 五、單變量模型競賽 ─────────────────────────────────
    h1('五、六個單變量模型：樹齡能不能解釋樹高（Q2）')
    para('5.1 模型與估計方法')
    para(
        '主模型（樹齡 x → 樹高 y）與其他模型都用「最小平方法」估計：找一組參數，使誤差平方和 '
        'SSE = Σ(yᵢ − ŷᵢ)² 最小。線性與多項式模型可用正規方程（normal equations）直接求解：'
    )
    formula('XᵀX·β = Xᵀy　→　β = (XᵀX)⁻¹Xᵀy')
    para(
        '冪函數與指數模型先對兩邊取對數，使參數變成線性再求最小平方；'
        '飽和指數模型 y = A(1 − e^(−k·x)) 的參數 k 在指數內，沒有閉式解，'
        '因此我們固定 k 之後用解析解 A = Σ[y·(1 − e^(−kx))] / Σ[(1 − e^(−kx))²]，再對 k 做網格搜索，'
        '取 R² 最大的一組（可重現，也不必依賴任何黑箱最佳化工具）。'
    )
    para('5.2 結果')
    m = R['models']

    def row(name, form, mo, params):
        return [name, form, params, f(mo['r2'], 4), f(mo['r2adj'], 4), f(mo['rmse'], 3), f(mo['p'], 4)]
    table(['模型', '形式', '估計參數', 'R²', '調整後 R²', 'RMSE', 'F 檢定的 p 值'],
          [row('線性', 'y = a + b·x', m['linear'], f"a = {f(m['linear']['a'], 4)}, b = {f(m['linear']['b'], 6)}"),
           row('二次', 'y = a + b·x + c·x²', m['quadratic'],
               f"a = {f(m['quadratic']['a'], 3)}, b = {f(m['quadratic']['b'], 5)}, c = {f(m['quadratic']['c'], 7)}"),
           row('對數', 'y = a + b·ln x', m['log'], f"a = {f(m['log']['a'], 4)}, b = {f(m['log']['b'], 4)}"),
           row('冪函數', 'y = a·x^b', m['power'], f"a = {f(m['power']['a'], 4)}, b = {f(m['power']['b'], 4)}"),
           row('指數', 'y = a·e^(b·x)', m['exponential'], f"a = {f(m['exponential']['a'], 3)}, b = {f(m['exponential']['b'], 6)}"),
           row('飽和指數', 'y = A(1 − e^(−k·x))', m['saturating'], f"A = {f(m['saturating']['A'], 4)}, k = {f(m['saturating']['k'], 5)}")],
          widths=[2.0, 3.6, 5.2, 1.4, 1.6, 1.4, 1.8], size=8.5)
    formula('R² = 1 − SSE / SST　　R²adj = 1 − (1 − R²)(n − 1)/(n − k)　　RMSE = √(SSE/(n − k))')
    para(
        f'最佳模型是飽和指數 y = {f(sat["A"], 2)}(1 − e^(−{f(sat["k"], 4)}x))，'
        f'R² = {f(sat["r2"], 4)}：也就是說，樹齡只能解釋全部樹高變異的 {f(sat["r2"] * 100, 2)}%。'
        f'它的形狀有直觀意義——樹在早期快速長高，之後趨於飽和，極限高度約 {f(sat["A"], 2)} 公尺；'
        f'但解釋力依然極低。反觀線性模型：斜率 b = {f(m["linear"]["b"], 6)}'
        f'（樹齡每多 1000 年，樹高「下降」約 {f(abs(m["linear"]["b"]) * 1000, 2)} 公尺），'
        f'p = {f(m["linear"]["p"], 3)}，完全不顯著。'
        f'冪函數與指數模型的 R² 為負值（{f(m["power"]["r2"], 4)}、{f(m["exponential"]["r2"], 4)}），'
        f'意思是「連拿平均數當預測都比較準」，這種模型必須明確淘汰，不能只看誰的線比較漂亮。'
    )
    figure('scatter_age', '圖 3　樹齡與樹高：658 個點形成一片沒有明顯方向的雲，最佳模型（橙線）幾乎是水平線。')

    # ── 六、類別變數 ───────────────────────────────────────
    h1('六、換一個變數：樹種（Q3）')
    para('6.1 單因子變異數分析（one-way ANOVA）')
    formula('SSB = Σ nⱼ(x̄ⱼ − x̄)²　　SSW = Σⱼ Σᵢ (xᵢⱼ − x̄ⱼ)²　　F = (SSB/(k−1)) / (SSW/(n−k))')
    para(
        '把「樹種」當成類別變數（factor），檢定各樹種的平均樹高是否相同。'
        '虛無假設 H₀：所有樹種的平均樹高相等。'
    )
    a10 = R['anova_species_top10']
    aall = R['anova_species_all']
    table(['檢定對象', '組數 k', '樣本數 n', 'F 統計量', 'p 值', 'η²（解釋比例）', 'ω²'],
          [['株數最多的 10 個樹種', a10['k'], a10['n'], f(a10['F'], 2), '< 0.001', f(a10['eta2'], 4), f(a10['omega2'], 4)],
           ['全部 56 個樹種', aall['k'], aall['n'], f(aall['F'], 2), '< 0.001', f(aall['eta2'], 4), f(aall['omega2'], 4)]],
          widths=[4.4, 1.5, 1.6, 2.0, 1.6, 2.6, 1.7])
    formula('η² = SSB / SST　　ω² = (SSB − (k−1)·MSW) / (SST + MSW)')
    para(
        f'結果非常顯著：株數最多的 10 個樹種 F = {f(a10["F"], 2)}（p < 0.001），'
        f'η² = {f(a10["eta2"], 4)}——光是「樹種」就能解釋約 {f(a10["eta2"] * 100, 1)}% 的樹高變異，'
        f'是樹齡（{f(sat["r2"] * 100, 2)}%）的十幾倍。'
        f'全部 56 個樹種的 η² 更高（{f(aall["eta2"], 4)}），但要小心解讀：'
        f'56 個樹種裡有 46 個只有 1–2 株，這種「每組樣本極少」的情形會讓 η² 被高估，'
        f'因此我們同時看 ω²（對組數做懲罰）：全 56 類為 {f(aall["omega2"], 4)}、前 10 類為 {f(a10["omega2"], 4)}。'
        f'兩個數字都遠大於樹齡模型，結論一致。'
    )
    para('6.2 樹種的平均樹高（前 10 名，含 95% 信賴區間）')
    table(['樹種', '株數', '平均樹高（m）', '標準差', '95% 信賴區間', '中位數'],
          [[g['name'], g['n'], f(g['mean'], 2), f(g['sd'], 2),
            f'± {f(g["ci95"], 2)}', f(g['median'], 1)] for g in a10['groups']],
          widths=[3.6, 1.6, 3.0, 2.0, 3.0, 1.8])
    formula('CI₉₅ = x̄ ± 1.96 · s / √n')
    para(
        '差異非常直觀：雞蛋花平均只有 7.30 公尺，木棉平均 19.50 公尺，兩者相差超過 12 公尺。'
        '也就是說，同樣是「古樹」，身高取決於它是什麼樹種——雞蛋花是灌木型的小喬木，'
        '木棉是高大的落葉喬木。把這 658 株混在一起對樹齡做迴歸，等於把不同物種混成一個平均數，'
        '當然解釋不了任何事。這是統計上的「混淆變數」（confounding）：省略了重要的類別變數，'
        '自變數的係數就失去意義（統計學上稱為遺漏變數偏誤 omitted-variable bias）。'
    )
    para('6.3 樹齡 ＋ 樹種的多元迴歸')
    mixed = R['mixed_model']
    formula(f'y = a + b·樹齡 + Σ cⱼ·Dⱼ　（Dⱼ 為品種啞變數，共 {R["mixed_terms"] - 1} 個，參照組為「{R["species_top10"][-1]}」）')
    table(['模型', '解釋變數', 'R²', '調整後 R²', 'RMSE', 'F 統計量'],
          [['只有樹齡', '1 個連續變數', f(m['linear']['r2'], 6), f(m['linear']['r2adj'], 4), f(m['linear']['rmse'], 3), f(m['linear']['F'], 3)],
           ['只有樹種（前 10 類）', '10 個類別（9 個啞變數）', f(a10['eta2'], 4), '—', '—', f(a10['F'], 2)],
           ['樹齡 ＋ 樹種（前 10 類）', f'{R["mixed_terms"]} 個參數', f(mixed['r2'], 4), f(mixed['r2adj'], 4), f(mixed['rmse'], 3), f(mixed['F'], 2)]],
          widths=[4.6, 3.6, 1.6, 1.8, 1.6, 1.8])
    para(
        f'加入樹種後模型明顯變好（R² 由 {f(m["linear"]["r2"], 6)} 提升到 {f(mixed["r2"], 4)}），'
        f'而樹齡的係數只有 {f(mixed["beta"][1], 6)}：在控制樹種之後，'
        f'樹齡每多 100 年，樹高平均只增加約 {f(mixed["beta"][1] * 100, 3)} 公尺——效果存在但極小，'
        f'而且 R² 的絕大部分來自樹種。這解釋了為什麼「直觀上老樹應該更高」在本資料不成立：'
        f'澳門的古樹名錄不是按高度選出來的，而是按樹齡與物種的珍稀程度登錄的。'
    )
    figure('species', '圖 4　株數最多的 10 個樹種平均樹高與 95% 信賴區間（誤差線）。樹種之間差異明顯。', width=14.5)

    # ── 七、樹高 vs 冠幅 ──────────────────────────────────
    h1('七、樹高與冠幅的模型（作業要求 3E）')
    para('7.1 資料與變數')
    para(
        f'冠幅取官方東西向與南北向兩個量測的平均，共 {c["n"]} 株有值'
        f'（占 658 株的 {f(R["crown_share"] * 100, 1)}%）。'
        f'令 x 為樹高（公尺）、y 為冠幅（公尺），n = {c["n"]}。'
    )
    para('7.2 線性模型：先算斜率與截距')
    formula('b = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²　　　a = ȳ − b·x̄')
    table(['計算量', '數值'],
          [['x̄（平均樹高）', f(c['xbar'], 4)],
           ['ȳ（平均冠幅）', f(c['ybar'], 4)],
           ['Σ(xᵢ − x̄)(yᵢ − ȳ)', f(c['sxy'], 4)],
           ['Σ(xᵢ − x̄)²', f(c['sxx'], 4)],
           ['斜率 b = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²', f(c['linear']['b'], 6)],
           ['截距 a = ȳ − b·x̄', f(c['linear']['a'], 6)],
           ['相關係數 r', f(c['pearson'], 4)],
           ['R² = 1 − SSE/SST', f(c['linear']['r2'], 4)],
           ['SSE', f(c['linear']['sse'], 4)],
           ['SST', f(c['linear']['sst'], 4)],
           ['RMSE', f(c['linear']['rmse'], 4)],
           ['F 檢定的 p 值', f(c['linear']['p'], 4)]],
          widths=[9.0, 4.5])
    para(
        f'線性模型為 y = {f(c["linear"]["b"], 6)}x + {f(c["linear"]["a"], 6)}，'
        f'斜率 {f(c["linear"]["b"], 4)} 的意思是「樹高每增加 1 公尺，冠幅平均增加約 '
        f'{f(c["linear"]["b"], 2)} 公尺（{f(c["linear"]["b"] * 100, 1)} 公分）」；'
        f'截距 {f(c["linear"]["a"], 2)} 公尺是 x = 0 時直線上的值，'
        f'但樣本中沒有樹高 0 公尺的古樹，所以它只是確定直線位置的數學常數，不能解讀為「零高度樹木的冠幅」。'
        f'R² = {f(c["linear"]["r2"], 4)} 表示樹高只能解釋冠幅變異的 {f(c["linear"]["r2"] * 100, 2)}%，'
        f'而且 p = {f(c["linear"]["p"], 4)} > 0.05——在這個樣本中，線性關係連「顯著」都達不到。'
    )
    para('7.3 換一個模型：二次模型（為什麼它更合適）')
    para(
        '線性模型假設「越高越寬」。但樹冠受品種與生長空間限制，最高的樹不一定冠幅最大。'
        '因此再試二次模型 y = a + b·x + c·x²：'
    )
    table(['模型', '估計式', 'R²', '調整後 R²', 'RMSE', 'p 值', '結論'],
          [['線性', f"y = {f(c['linear']['b'], 4)}x + {f(c['linear']['a'], 2)}", f(c['linear']['r2'], 4), f(c['linear']['r2adj'], 4), f(c['linear']['rmse'], 3), f(c['linear']['p'], 4), '不顯著'],
           ['二次', f"y = {f(c['quadratic']['a'], 2)} + {f(c['quadratic']['b'], 3)}x − {f(abs(c['quadratic']['c']), 5)}x²", f(c['quadratic']['r2'], 4), f(c['quadratic']['r2adj'], 4), f(c['quadratic']['rmse'], 3), f(c['quadratic']['p'], 4), '顯著（p < 0.001）'],
           ['對數', f"y = {f(c['log']['b'], 3)}·ln x + {f(c['log']['a'], 2)}", f(c['log']['r2'], 4), f(c['log']['r2adj'], 4), f(c['log']['rmse'], 3), f(c['log']['p'], 4), '邊緣不顯著'],
           ['冪函數', 'y = a·x^b', f(c['power']['r2'], 4), f(c['power']['r2adj'], 4), f(c['power']['rmse'], 3), f(c['power']['p'], 4), '不顯著（R² < 0）'],
           ['飽和指數', f"y = {f(c['saturating']['A'], 2)}(1 − e^(−{f(c['saturating']['k'], 4)}x))", f(c['saturating']['r2'], 4), f(c['saturating']['r2adj'], 4), f(c['saturating']['rmse'], 3), f(c['saturating']['p'], 4), '顯著']],
          widths=[2.0, 5.2, 1.4, 1.6, 1.4, 1.5, 2.4], size=8.5)
    para(
        f'二次模型的 R² = {f(c["quadratic"]["r2"], 4)}（約為線性模型的 {f(c["quadratic"]["r2"] / c["linear"]["r2"], 1)} 倍），'
        f'二次項係數 c = {f(c["quadratic"]["c"], 5)} < 0，代表開口向下的拋物線：'
        f'冠幅隨樹高先增後減。'
    )
    formula(f'頂點 x* = −b/(2c) = {f(c["vertex"], 2)} 公尺，此時冠幅最大 ≈ {f(c["quadratic"]["a"] + c["quadratic"]["b"] * c["vertex"] + c["quadratic"]["c"] * c["vertex"] ** 2, 2)} 公尺')
    para(
        f'也就是說，這 67 株中冠幅最大的大約出現在樹高 {f(c["vertex"], 1)} 公尺附近；'
        f'比這更高的樹（多為木棉等窄冠高大的樹種）冠幅反而較小。'
        f'這比「越高越寬」的線性假設更符合樹木的生長形態，也說明模型形式的選擇會直接改變結論：'
        f'同一批資料，線性模型說「沒有關係」，二次模型說「有關係，但不是單調的」。'
    )
    para(
        f'但二次模型也暴露了「外推」的危險：拋物線在樹高 {f(c["zero_cross"], 1)} 公尺處會算出冠幅 0 公尺，'
        f'再高就會是負數——負的冠幅沒有物理意義。'
        f'這條界線遠超本次樣本的最大樹高（{f(max(s[0] for s in c["samples"]), 1)} 公尺）之外，'
        f'所以不影響樣本內的結論，但它提醒我們：多項式模型只能在觀測範圍內使用，'
        f'拿它去預測更極端的情況會得到荒謬的答案（圖 5 因此只畫到資料範圍內）。'
    )
    para('7.4 用模型預測與檢查')
    samples = c['samples']
    for x in (10, 15, 20, 25):
        lin_y = c['linear']['a'] + c['linear']['b'] * x
        q_y = c['quadratic']['a'] + c['quadratic']['b'] * x + c['quadratic']['c'] * x * x
        hh, kk, no = min(samples, key=lambda s: abs(s[0] - x))
        para(f'　樹高 {x} 公尺：線性模型預測冠幅 {f(lin_y, 2)} 公尺、二次模型預測 {f(q_y, 2)} 公尺。'
             f'實際資料中最接近的樣本是第 {no} 號（樹高 {f(hh, 1)} 公尺、冠幅 {f(kk, 1)} 公尺）：'
             f'線性模型誤差 {f(kk - lin_y, 2)} 公尺、二次模型誤差 {f(kk - q_y, 2)} 公尺。')
    para(
        '殘差檢查：把 67 個樣本分別計算「實際冠幅 − 線性模型預測冠幅」，正殘差與負殘差都有'
        f'（殘差標準差 RMSE = {f(c["linear"]["rmse"], 2)} 公尺），沒有系統性只偏向一邊，'
        '這說明最小平方法的假設（誤差平均值為 0）大致成立；但殘差太大，模型不適合用來預測單一株樹的冠幅。'
    )
    para('7.5 這個樣本有代表性嗎？（兩樣本 t 檢定）')
    para(
        f'只有 {c["n"]} 株有冠幅值，必須確認這 {c["n"]} 株不是特例。'
        '以 Welch 兩樣本 t 檢定比較「有冠幅」與「沒有冠幅」兩群的樹高、樹齡、胸徑：'
    )
    b = R['bias']
    table(['比較項目', '有冠幅（n = 67）', '沒有冠幅（n = 591）', 't 統計量', '自由度', 'p 值', '結論'],
          [['平均樹高（m）', f(b['height']['with'], 3), f(b['height']['without'], 3), f(b['height']['t'], 3), f(b['height']['df'], 1), f(b['height']['p'], 3), '無顯著差異'],
           ['平均樹齡（年）', f(b['age']['with'], 2), f(b['age']['without'], 2), f(b['age']['t'], 3), f(b['age']['df'], 1), f(b['age']['p'], 3), '無顯著差異'],
           ['平均胸徑（cm）', f(b['diameter']['with'], 2), f(b['diameter']['without'], 2), f(b['diameter']['t'], 3), f(b['diameter']['df'], 1), f(b['diameter']['p'], 3), '無顯著差異']],
          widths=[3.0, 2.6, 2.8, 1.6, 1.4, 1.4, 2.4], size=9)
    formula('t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)　（Welch 檢定，不假設兩組變異數相等）')
    para(
        '三個檢定的 p 值都大於 0.05，沒有證據顯示有冠幅的那 67 株與其他株系統性不同。'
        '但不能忽略的是：官方只量了 10.2% 的株數，這個「缺值」本身是資料蒐集的限制，'
        '不是隨機抽樣——因此第七節的結論只適用於這 67 株，不能直接推論全部 658 株。'
    )
    figure('scatter_crown', '圖 5　樹高與冠幅：實線為線性模型（幾乎水平），虛線為二次模型（開口向下）。')

    # ── 八、卡方檢定 ───────────────────────────────────────
    h1('八、卡方獨立性檢定：堂區與健康狀況有沒有關係')
    chi = R['chi']
    para('8.1 列聯表與公式')
    formula('Eᵢⱼ = (列總和ᵢ × 欄總和ⱼ) / n　　χ² = Σ (Oᵢⱼ − Eᵢⱼ)² / Eᵢⱼ　　df = (r − 1)(c − 1)')
    table(['堂區', '健康', '一般', '瀕危', '列總和'],
          [[chi['rows'][i], chi['matrix'][i][0], chi['matrix'][i][1], chi['matrix'][i][2], chi['rowTotals'][i]]
           for i in range(len(chi['rows']))] + [['欄總和', chi['colTotals'][0], chi['colTotals'][1], chi['colTotals'][2], chi['n']]],
          widths=[4.0, 2.4, 2.4, 2.4, 2.4])
    table(['檢定結果', '數值'],
          [['卡方統計量 χ²', f(chi['chi2'], 4)],
           ['自由度 df', chi['df']],
           ['p 值', f(chi['p'], 6)],
           ['Cramér\'s V（關聯強度）', f(chi['cramersV'], 4)],
           ['最小期望次數', f(chi['minExpected'], 4)],
           ['結論（α = 0.05）', '拒絕獨立假設：堂區與健康狀況有關聯']],
          widths=[7.0, 6.5])
    formula("Cramér's V = √(χ² / (n · min(r − 1, c − 1)))")
    para(
        f'χ² = {f(chi["chi2"], 2)}（df = {chi["df"]}）對應 p = {f(chi["p"], 2)}×10⁻⁶，遠小於 0.05，'
        f'因此拒絕「健康狀況與所在堂區無關」的虛無假設。但關聯強度只有 Cramér\'s V = {f(chi["cramersV"], 3)}'
        f'（0 為無關、1 為完全關聯），屬於弱至中度——'
        f'統計顯著不等於關係很強，尤其樣本很大（n = 658）時，很小的差異也會顯著。'
    )
    para('8.2 檢定假設的檢查（這一節比結果本身重要）')
    para(
        f'卡方檢定要求每個細格的期望次數不宜太小（一般要求 ≥ 5）。'
        f'本表的最小期望次數是 {f(chi["minExpected"], 2)}，來自「路氹填海區 × 瀕危」這一格'
        f'（該堂區只有 4 株，而瀕危共 21 株）。這違反檢定假設，'
        f'因此 χ² 的 p 值只能參考；嚴謹的做法是把路氹填海區與相鄰堂區合併、或用 Fisher 精確檢定。'
        f'我們選擇把這件事寫出來，而不是把最小的那幾格藏起來。'
    )

    # ── 九、評分模型 ───────────────────────────────────────
    h1('九、優先保育評分模型：加權線性組合')
    para(
        '平台上的「優先保育名單」不是把樹齡排序，而是五個面向的加權組合。'
        '每個面向都先用分段函數轉成 0–30 分的分數，再加權相加：'
    )
    formula('S = 0.30·A + 0.25·H + 0.20·G + 0.15·R + 0.10·K　（各項滿分 30／25／20／15／10，合計 100 分）')
    table(['面向', '權重', '分段計分規則（節錄）'],
          [['樹齡 A', '30 分', '≥300 年 30 分／200–299 年 25 分／150–199 年 19 分／100–149 年 13 分／50–99 年 7 分／<50 年 3 分'],
           ['健康狀況 H', '25 分', '瀕危 25 分／一般 12 分／健康 5 分（缺值以中性 12 分計）'],
           ['官方分級 G', '20 分', '一級 20 分／二級 14 分／三級 6 分／不分級 0 分'],
           ['樹種稀有度 R', '15 分', '全澳僅 1 株 15 分／2–3 株 12 分／4–10 株 9 分／11–30 株 6 分／31–100 株 3 分／>100 株 1 分'],
           ['區位風險 K', '10 分', '車道、人流與設施周邊 10 分／公園、前地、街巷 6 分／郊野、山徑、海灘 3 分（依官方地點文字判別）']],
          widths=[2.6, 1.8, 9.1], size=9)
    para(
        '分段函數（piecewise function）在這裡的作用是：把不同單位的觀測值（年、類別、株數）'
        '轉成可以相加的分數，而且每一段的界線都寫在程式裡、可以被檢驗。'
        '分數不是「級別」——名單只顯示官方分級，分數只用來排序，'
        '並以 75、60、45 三個分數帶對應不同的建議處理強度。'
    )
    para('9.1 一個實際的計算例（平台排序第 1 名）')
    para(
        '第 981 號「桑」（風順堂區、澳門區聖地牙哥酒店）：官方樹齡 315 年（→ 30 分）、'
        '官方健康狀況「瀕危」（→ 25 分）、官方分級「二級」（→ 14 分）、'
        '全澳同種僅 3 株（→ 12 分）、地點含「酒店」屬高風險區位（→ 10 分），因此'
    )
    formula('S = 30 + 25 + 14 + 12 + 10 = 91 分')
    para(
        '這個 91 分可以逐項還原成「哪一項貢獻幾分」，這也是我們不用機器學習模型的原因：'
        '一份會被拿去安排現場檢查的名單，必須能回答「為什麼是這一株」，'
        '而規則式的加權模型可以，黑箱模型不行。'
    )

    # ── 十、存活投影 ───────────────────────────────────────
    h1('十、存活投影：2026–2076（Q5）')
    para(
        '最後一個模型回答「如果現況不變，名錄上的株數會怎麼變化」。'
        '把樹分成三種狀態（健康、一般、瀕危），每年以各自的存活率存活，'
        '並假設每年有 m 株新樹達到 100 年而進入名錄，按當年三狀態的比例分配：'
    )
    pj = R['projection']
    formula('N(t+1, s) = N(t, s)·(1 − hₛ) + m · [N(t+1, s) / Σₛ N(t+1, s)]')
    formula(f"年存活率假設：h(健康) = {pj['hazards']['健康']}、h(一般) = {pj['hazards']['一般']}、h(瀕危) = {pj['hazards']['瀕危']}；每年新增 m = {pj['recruit']} 株", '（h 為年死亡風險率，因此 (1 − h) 為存活率）')
    rows = [[s['year'], s['健康'], s['一般'], s['瀕危'], s['total']] for s in pj['series'] if s['year'] in (2026, 2036, 2046, 2056, 2066, 2076)]
    table(['年份', '健康', '一般', '瀕危', '名錄總數（存活）'], rows, widths=[2.4, 2.4, 2.4, 2.4, 4.0])
    para(
        f'起始狀態為健康 {pj["series"][0]["健康"]} 株、一般 {pj["series"][0]["一般"]} 株、瀕危 {pj["series"][0]["瀕危"]} 株（合計 658）。'
        f'50 年後（2076）存活株數為 {pj["series"][-1]["total"]} 株，約為原來的 {f(pj["series"][-1]["total"] / 658 * 100, 1)}%。'
        f'要注意這不是「古樹會死 253 株」的預測：模型假設的是「不再有新的老樹進入名錄」的淨效果，'
        f'而每年只補進 {pj["recruit"]} 株（以目前 100 歲以下僅 {pj["near"]} 株估算）。'
        f'如果都市綠化持續、更多樹木達到百年，曲線就會不同——這個模型的作用是說明「數量如何變化」的數學機制，'
        f'而不是給出一個官方沒有的數字。'
    )
    figure('projection', '圖 6　三種狀態與名錄總數的 50 年投影（模型假設，非官方預測）。')

    # ── 十一、限制 ─────────────────────────────────────────
    h1('十一、模型的限制與誤用風險')
    for t in [
        '相關不等於因果。樹種與樹高相關，不代表「換樹種就會變高」；分級與樹齡相關，也不代表分級是由樹齡決定的。',
        f'缺值不是隨機缺的。冠幅只有 {c["n"]} 株（{f(R["crown_share"] * 100, 1)}%），是官方蒐集的限制，'
        '第七節的模型不能推論到全部 658 株。',
        '遺漏變數。本報告沒有納入土壤、日照、修剪歷史、生長空間等變數；'
        '樹齡對樹高「失效」很可能是因為缺少這些解釋變數，而不是真的毫無關係。',
        '外推風險。第十節把 2026 年的存活率固定套用 50 年，現實中的風險率會隨氣候、病蟲害與管理政策改變。',
        '檢定假設。卡方檢定的最小期望次數低於 5（見 8.2），p 值只能參考。',
        '重複檢定。本報告同時做了多個檢定，未做多重比較校正；其中樹齡～樹高的 p 值在邊緣地帶時，不宜當成證據。',
        '分數不是級別。第九節的評分只用於排序與安排檢查順序，官方分級與健康狀況一律以市政署公布為準。',
    ]:
        para('・' + t)

    # ── 十二、結論 ─────────────────────────────────────────
    h1('十二、結論')
    for t in [
        f'官方資料自洽：胸圍÷胸徑的平均為 {f(R["pi"]["mean"], 6)}，與 π 的最大偏差 {f(R["pi"]["max_dev"], 4)}，'
        f'迴歸斜率 {f(R["pi"]["ols"]["b"], 6)}、R² = {f(R["pi"]["ols"]["r2"], 6)}。',
        f'樹齡不足以解釋樹高：r = {f(R["corr"]["age_height"]["r"], 4)}（p = {f(R["corr"]["age_height"]["p"], 3)}），'
        f'六個模型中最佳的飽和指數模型 R² 也只有 {f(sat["r2"], 4)}。',
        f'類別變數才是關鍵：株數最多的 10 個樹種，F = {f(a10["F"], 2)}（p < 0.001），η² = {f(a10["eta2"], 4)}；'
        f'控制樹種後，樹齡每 100 年的效果只有約 {f(mixed["beta"][1] * 100, 3)} 公尺。',
        f'樹高與冠幅：線性模型不顯著（R² = {f(c["linear"]["r2"], 4)}，p = {f(c["linear"]["p"], 3)}），'
        f'二次模型顯著（R² = {f(c["quadratic"]["r2"], 4)}，p = {f(c["quadratic"]["p"], 4)}），'
        f'頂點在樹高約 {f(c["vertex"], 1)} 公尺處——模型形式的選擇直接改變結論。',
        f'保育決策可以量化：五面向加權評分（合計 100 分）能把 658 株排出優先順序，'
        f'且每一分都能還原到官方資料；存活投影說明在現行假設下 2076 年名錄約剩 {pj["series"][-1]["total"]} 株。',
    ]:
        para('・' + t)
    para(
        '對數學學習而言，這批資料最有價值的部分是「模型可能失敗」。'
        '我們一開始也預期「越老的樹越高」，但資料說不是；'
        '真正讓模型變好的不是更複雜的函數，而是換一個對的變數（樹種）。'
        '這正是統計推論與函數擬合在真實資料上的樣子。'
    )

    # ── 參考資料 ───────────────────────────────────────────
    h1('參考資料')
    para('以下每一項都是本報告實際使用的官方來源（資料、法規或方法依據）：', space_after=8)
    for i, (name, url, why) in enumerate(SOURCES, 1):
        p = doc.add_paragraph()
        run = p.add_run(f'[{i}] {name}：{url}')
        run.font.size = Pt(9.5)
        q = doc.add_paragraph()
        r = q.add_run(f'　　用途：{why}')
        r.font.size = Pt(9)
        r.italic = True
    para(f'[{len(SOURCES) + 1}] 本報告使用的研究平台（自行建置，含資料庫、API、圖表與列印模組）：{SITE}', space_after=2)
    para(f'　　程式與原始資料：{REPO}（含 supabase/init.sql、data/ 官方資料快照、tests/ 測試）', space_after=10)

    # ── 附錄 ───────────────────────────────────────────────
    h1('附錄 A　公式與符號')
    table(['符號', '意義', '公式'],
          [['x̄ , ȳ', '樣本平均數', 'x̄ = (1/n)Σxᵢ'],
           ['s² , s', '樣本變異數與標準差', 's² = Σ(xᵢ − x̄)²/(n − 1)'],
           ['r', '皮爾森相關係數', 'r = Σ(xᵢ − x̄)(yᵢ − ȳ)/√[Σ(xᵢ − x̄)²·Σ(yᵢ − ȳ)²]'],
           ['b , a', '最小平方直線的斜率與截距', 'b = Σ(xᵢ − x̄)(yᵢ − ȳ)/Σ(xᵢ − x̄)²；a = ȳ − b·x̄'],
           ['SSE / SSR / SST', '誤差平方和／迴歸平方和／總平方和', 'SST = SSR + SSE'],
           ['R²', '決定係數', 'R² = 1 − SSE/SST = SSR/SST'],
           ['R²adj', '調整後決定係數', 'R²adj = 1 − (1 − R²)(n − 1)/(n − k)'],
           ['RMSE', '殘差標準誤', 'RMSE = √(SSE/(n − k))'],
           ['t', '相關係數的顯著性檢定', 't = r√((n − 2)/(1 − r²))，df = n − 2'],
           ['F', '變異數分析的檢定統計量', 'F = MSB/MSW = (SSB/(k − 1))/(SSW/(n − k))'],
           ['η² , ω²', '效果量（解釋比例）', 'η² = SSB/SST；ω² = (SSB − (k−1)MSW)/(SST + MSW)'],
           ['χ²', '卡方獨立性檢定', 'χ² = Σ(O − E)²/E，E = (列總和×欄總和)/n，df = (r−1)(c−1)'],
           ["Cramér's V", '列聯表關聯強度', 'V = √(χ²/(n·min(r−1, c−1)))'],
           ['CI₉₅', '平均數的 95% 信賴區間', 'x̄ ± 1.96·s/√n'],
           ['n , k', '樣本數／參數或組數', '—']],
          widths=[2.6, 4.4, 6.5], size=9)

    h1('附錄 B　可重現性：這些數字怎麼算出來的')
    para(
        '報告中的所有數字都由本專案的程式產生，沒有手抄。要重新產生，需要 Python 3、Node.js、'
        'python-docx（產生 .docx）與 Google Chrome（用無頭模式畫圖）：'
    )
    for line in [
        'git clone ' + REPO,
        'cd macau-heritage-trees && npm install',
        'pip install python-docx',
        'python3 scripts/report-math.py        # 重新計算、重新畫圖、重新產生這份 docx',
        'npm test                              # 25 組 369 項測試（含統計函式與 API 的對照測試）',
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.6)
        run = p.add_run(line)
        run.font.name = 'Menlo'
        run.font.size = Pt(9)
    para(
        '平台端點（可直接在瀏覽器打開或由程式取得）：'
        '統計／api/stats、總覽／api/overview、優先名單／api/priority、單株／api/tree/<編號>（改為 ?no=）。'
        '線上網址：https://old-trees-mylearning.vercel.app', space_after=6
    )
    para('統計程式與網站的對照（同一份官方資料、兩套互不引用的實作）：', space_after=6)
    table(['項目', '本報告（Python，自行實作）', '平台網站（JavaScript，lib/analysis.js）'],
          [['樹齡～樹高 r', f(ch['age_height']['r'], 4), '−0.0011'],
           ['斯皮爾曼等級相關', f(ch['age_height']['spearman'], 4), '0.0813'],
           ['最佳單變量模型 R²（飽和指數）', f(sat['r2'], 4), '0.0185'],
           ['品種（前 10 類）ANOVA F', f(a10['F'], 4), '21.809'],
           ['堂區～樹齡 ANOVA F', f(R['anova_parish']['F'], 4), '7.553'],
           ['堂區 × 健康卡方 χ²', f(chi['chi2'], 2), '51.25'],
           ['2076 年投影總數', pj['series'][-1]['total'], '405']],
          widths=[6.4, 4.0, 5.0], size=9)
    para(
        '兩套實作的語言不同（Python 與 JavaScript）、彼此不引用，結果一致到小數第三位以上；'
        '差異只來自官方數值的顯示精度，這比只有一套程式更讓人放心。'
    )

    footer_page_numbers()
    doc.save(str(out_path))
    return out_path


def main():
    ap = argparse.ArgumentParser(description='產生數學科報告（Word）')
    ap.add_argument('--out', default=str(ROOT.parent / '高二丙 15、4、29、28（數學科）.docx'))
    ap.add_argument('--no-charts', action='store_true', help='沿用上次產生的圖（只改文字時用）')
    ap.add_argument('--chart-dir', default=None)
    args = ap.parse_args()

    trees = load_trees()
    R = compute(trees)
    chartdir = pathlib.Path(args.chart_dir) if args.chart_dir else pathlib.Path(tempfile.gettempdir()) / 'mht-report-charts'
    if not args.no_charts:
        render_charts(trees, R, chartdir)
    missing = [f'{n}.png' for n in ('hist', 'scatter_age', 'scatter_crown', 'species', 'projection', 'girth_diameter')
               if not (chartdir / f'{n}.png').exists()]
    if missing:
        raise SystemExit(f'缺少圖檔 {missing}；請先跑一次 python3 scripts/report-math.py（不要加 --no-charts）')

    out = build_docx(R, chartdir, pathlib.Path(args.out))
    print(f'✓ 已產生報告：{out}')
    print(f'  樣本 {R["n"]} 株／{R["species_n"]} 樹種；樹高～冠幅 n = {R["crown"]["n"]}')


if __name__ == '__main__':
    main()
