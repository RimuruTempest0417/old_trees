# -*- coding: utf-8 -*-
"""數學科報告的統計計算核心（純標準庫，無 numpy／scipy）。

被 scripts/report-math.py 使用。獨立成一支模組，是為了讓「每一個公式」都有對應的函式，
報告裡的每個數字都指得出是哪一行算出來的。

所有分布函式（t、F、χ²、常態）都是自己實作的，理由與網站相同：
報告要能被檢查——每一步都寫得出公式，也要能與平台的 lib/analysis.js 互相對照。
"""
import math

# ── 分布函式 ────────────────────────────────────────────────
def _betacf(a, b, x, itmax=200, eps=3e-16, fpmin=1e-300):
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    if abs(d) < fpmin:
        d = fpmin
    d = 1.0 / d
    h = d
    for m in range(1, itmax + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < fpmin:
            d = fpmin
        c = 1.0 + aa / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < fpmin:
            d = fpmin
        c = 1.0 + aa / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        de = d * c
        h *= de
        if abs(de - 1.0) < eps:
            break
    return h


def betai(a, b, x):
    """正規化不完全貝他函數 I_x(a, b)"""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbeta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front = math.exp(lbeta + a * math.log(x) + b * math.log(1.0 - x))
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _betacf(a, b, x) / a
    return 1.0 - front * _betacf(b, a, 1.0 - x) / b


def t_two_sided_p(t, df):
    """雙尾 t 檢定的 p 值"""
    if df <= 0 or not math.isfinite(t):
        return float('nan')
    return betai(df / 2.0, 0.5, df / (df + t * t))


def f_p_value(F, df1, df2):
    """右尾 F 檢定的 p 值"""
    if F <= 0 or df1 <= 0 or df2 <= 0:
        return 1.0
    x = df2 / (df2 + df1 * F)
    return betai(df2 / 2.0, df1 / 2.0, x)


def _gser(a, x, itmax=500, eps=3e-16):
    ap, s, delta = a, 1.0 / a, 1.0 / a
    for _ in range(itmax):
        ap += 1.0
        delta *= x / ap
        s += delta
        if abs(delta) < abs(s) * eps:
            break
    return s * math.exp(-x + a * math.log(x) - math.lgamma(a))


def _gcf(a, x, itmax=500, eps=3e-16, fpmin=1e-300):
    b, c, d, h = x + 1.0 - a, 1.0 / fpmin, 1.0 / (x + 1.0 - a), 1.0 / (x + 1.0 - a)
    for i in range(1, itmax + 1):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < fpmin:
            d = fpmin
        c = b + an / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        de = d * c
        h *= de
        if abs(de - 1.0) < eps:
            break
    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h


def gammaq(a, x):
    """正規化上不完全伽瑪函數 Q(a, x)（χ² 右尾機率）"""
    if x < 0 or a <= 0:
        return float('nan')
    if x == 0:
        return 1.0
    if x < a + 1.0:
        return 1.0 - _gser(a, x)
    return _gcf(a, x)


def chi2_p_value(chi2, df):
    return gammaq(df / 2.0, chi2 / 2.0)


def normal_cdf(z):
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


# ── 敘述統計 ────────────────────────────────────────────────
def mean(xs):
    return sum(xs) / len(xs)


def variance(xs, sample=True):
    n = len(xs)
    if n < 2:
        return 0.0
    m = mean(xs)
    return sum((x - m) ** 2 for x in xs) / (n - 1 if sample else n)


def sd(xs, sample=True):
    return math.sqrt(variance(xs, sample))


def quantile(xs, q):
    """線性內插分位數（與平台的插值法一致）"""
    s = sorted(xs)
    if not s:
        return None
    pos = q * (len(s) - 1)
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def median(xs):
    return quantile(xs, 0.5)


def skewness(xs):
    n = len(xs)
    m, s = mean(xs), sd(xs, sample=False)
    if n < 3 or s == 0:
        return 0.0
    return (n / ((n - 1) * (n - 2))) * sum(((x - m) / s) ** 3 for x in xs)


def describe(xs, name):
    return {
        'name': name, 'n': len(xs), 'mean': mean(xs), 'median': median(xs),
        'sd': sd(xs), 'variance': variance(xs), 'min': min(xs), 'max': max(xs),
        'q1': quantile(xs, 0.25), 'q3': quantile(xs, 0.75),
        'cv': sd(xs) / mean(xs) if mean(xs) else None,
        'skew': skewness(xs),
    }


def pearson(xs, ys):
    n = len(xs)
    mx, my = mean(xs), mean(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return 0.0
    return sxy / math.sqrt(sxx * syy)


def _ranks(xs):
    """名次（同分取平均），Spearman 用"""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    ranks = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def spearman(xs, ys):
    return pearson(_ranks(xs), _ranks(ys))


def corr_test(xs, ys):
    """Pearson r 與其 t 檢定"""
    n = len(xs)
    r = pearson(xs, ys)
    if n <= 2 or abs(r) >= 1:
        return {'r': r, 'n': n, 't': float('inf') if abs(r) >= 1 else 0.0, 'df': n - 2, 'p': 0.0}
    t = r * math.sqrt((n - 2) / (1 - r * r))
    return {'r': r, 'n': n, 't': t, 'df': n - 2, 'p': t_two_sided_p(t, n - 2),
            'r2': r * r}


# ── 線性代數（正規方程用） ──────────────────────────────────
def solve(A, b):
    """高斯－喬登消去法解 A x = b；A 會被複製"""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[piv][col]) < 1e-12:
            raise ValueError('奇異矩陣（設計矩陣共線或樣本不足）')
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        M[col] = [v / pv for v in M[col]]
        for r in range(n):
            if r != col and M[r][col] != 0:
                factor = M[r][col]
                M[r] = [a - factor * c for a, c in zip(M[r], M[col])]
    return [M[i][n] for i in range(n)]


def regress(Xs, ys):
    """最小平方多元迴歸。Xs：每列是一個觀測的解釋變數（含常數項）。"""
    n, k = len(ys), len(Xs[0])
    XtX = [[sum(Xs[i][a] * Xs[i][b] for i in range(n)) for b in range(k)] for a in range(k)]
    Xty = [sum(Xs[i][a] * ys[i] for i in range(n)) for a in range(k)]
    beta = solve(XtX, Xty)
    pred = [sum(b * x for b, x in zip(beta, row)) for row in Xs]
    resid = [y - p for y, p in zip(ys, pred)]
    my = mean(ys)
    sse = sum(r * r for r in resid)
    sst = sum((y - my) ** 2 for y in ys)
    ssr = sst - sse
    df_res = n - k
    r2 = 1 - sse / sst if sst else 0.0
    r2adj = 1 - (1 - r2) * (n - 1) / df_res if df_res > 0 else None
    mse = sse / df_res if df_res > 0 else float('nan')
    F = (ssr / (k - 1)) / mse if df_res > 0 and mse > 0 else float('inf')
    return {
        'beta': beta, 'n': n, 'k': k, 'pred': pred, 'resid': resid,
        'sse': sse, 'ssr': ssr, 'sst': sst, 'df_res': df_res,
        'r2': r2, 'r2adj': r2adj, 'rmse': math.sqrt(mse) if mse == mse else None,
        'F': F, 'p': f_p_value(F, k - 1, df_res) if df_res > 0 else None,
    }


def fit_linear(xs, ys):
    out = regress([[1.0, x] for x in xs], ys)
    return {'a': out['beta'][0], 'b': out['beta'][1], **out}


def fit_quadratic(xs, ys):
    out = regress([[1.0, x, x * x] for x in xs], ys)
    return {'a': out['beta'][0], 'b': out['beta'][1], 'c': out['beta'][2], **out}


def fit_log(xs, ys):
    if any(x <= 0 for x in xs):
        return None
    out = regress([[1.0, math.log(x)] for x in xs], ys)
    return {'a': out['beta'][0], 'b': out['beta'][1], **out}


def fit_power(xs, ys):
    """y = a·x^b（對兩邊取對數後最小平方）"""
    if any(x <= 0 for x in xs) or any(y <= 0 for y in ys):
        return None
    out = regress([[1.0, math.log(x)] for x in xs], [math.log(y) for y in ys])
    a, b = math.exp(out['beta'][0]), out['beta'][1]
    pred = [a * x ** b for x in xs]
    resid = [y - p for y, p in zip(ys, pred)]
    my = mean(ys)
    sst = sum((y - my) ** 2 for y in ys)
    sse = sum(r * r for r in resid)
    n = len(ys)
    r2 = 1 - sse / sst if sst else 0.0
    return {'a': a, 'b': b, 'n': n, 'k': 2, 'pred': pred, 'resid': resid,
            'sse': sse, 'ssr': sst - sse, 'sst': sst, 'r2': r2,
            'r2adj': 1 - (1 - r2) * (n - 1) / (n - 2), 'rmse': math.sqrt(sse / (n - 2)),
            'F': ((sst - sse) / 1) / (sse / (n - 2)) if sse > 0 else float('inf'),
            'p': f_p_value(((sst - sse) / 1) / (sse / (n - 2)), 1, n - 2) if sse > 0 else 0.0}


def fit_exponential(xs, ys):
    """y = a·e^(b·x)：對 y 取對數後最小平方，再換回原尺度檢查 R²"""
    if any(y <= 0 for y in ys):
        return None
    out = regress([[1.0, x] for x in xs], [math.log(y) for y in ys])
    a, b = math.exp(out['beta'][0]), out['beta'][1]
    pred = [a * math.exp(b * x) for x in xs]
    my = mean(ys)
    sst = sum((y - my) ** 2 for y in ys)
    sse = sum((y - p) ** 2 for y, p in zip(ys, pred))
    n = len(ys)
    r2 = 1 - sse / sst if sst else 0.0
    return {'a': a, 'b': b, 'n': n, 'k': 2, 'pred': pred,
            'sse': sse, 'sst': sst, 'r2': r2,
            'r2adj': 1 - (1 - r2) * (n - 1) / (n - 2), 'rmse': math.sqrt(sse / (n - 2)),
            'F': ((sst - sse) / 1) / (sse / (n - 2)) if sse > 0 else float('inf'),
            'p': f_p_value(((sst - sse) / 1) / (sse / (n - 2)), 1, n - 2) if sse > 0 else 0.0}


def fit_saturating(xs, ys, k_lo=1e-4, k_hi=0.5, steps=4000):
    """y = A·(1 − e^(−k·x))：對 k 做網格搜尋，A 用最小平方解析解

    這個模型沒有閉式的正規方程（因為 k 在指數裡），所以固定 k 之後
    A = Σ[y·(1−e^(−k x))] / Σ[(1−e^(−k x))²] 是最佳 A；再對 k 掃描取 R² 最大者。
    平台用的是網格搜索＋Nelder–Mead，這裡刻意只用網格（步驟寫得出來、可手算檢查）。
    """
    best = None
    for i in range(steps + 1):
        k = k_lo * (k_hi / k_lo) ** (i / steps)
        f = [1 - math.exp(-k * x) for x in xs]
        den = sum(v * v for v in f)
        if den == 0:
            continue
        A = sum(y * v for y, v in zip(ys, f)) / den
        pred = [A * v for v in f]
        my = mean(ys)
        sst = sum((y - my) ** 2 for y in ys)
        sse = sum((y - p) ** 2 for y, p in zip(ys, pred))
        r2 = 1 - sse / sst if sst else 0.0
        if best is None or r2 > best['r2']:
            n = len(ys)
            best = {'A': A, 'k': k, 'n': n, 'k_params': 2, 'pred': pred, 'r2': r2, 'sse': sse,
                    'sst': sst, 'r2adj': 1 - (1 - r2) * (n - 1) / (n - 2),
                    'rmse': math.sqrt(sse / (n - 2))}
    if best:
        best['F'] = ((best['sst'] - best['sse']) / 1) / (best['sse'] / (best['n'] - 2))
        best['p'] = f_p_value(best['F'], 1, best['n'] - 2)
    return best


def anova(groups):
    """單因子變異數分析。groups：[(名稱, [數值...]), ...]"""
    groups = [(n, v) for n, v in groups if len(v) > 0]
    k = len(groups)
    allv = [x for _, v in groups for x in v]
    N = len(allv)
    gm = mean(allv)
    ssb = sum(len(v) * (mean(v) - gm) ** 2 for _, v in groups)
    ssw = sum(sum((x - mean(v)) ** 2 for x in v) for _, v in groups)
    dfb, dfw = k - 1, N - k
    msb, msw = ssb / dfb, ssw / dfw
    F = msb / msw if msw else float('inf')
    return {
        'k': k, 'n': N, 'dfBetween': dfb, 'dfWithin': dfw,
        'ssBetween': ssb, 'ssWithin': ssw, 'ssTotal': ssb + ssw,
        'msBetween': msb, 'msWithin': msw, 'F': F, 'p': f_p_value(F, dfb, dfw),
        'eta2': ssb / (ssb + ssw) if (ssb + ssw) else 0.0,
        'omega2': (ssb - dfb * msw) / (ssb + ssw + msw) if (ssb + ssw + msw) else 0.0,
        'groups': [{'name': n, 'n': len(v), 'mean': mean(v), 'sd': sd(v),
                    'median': median(v),
                    'ci95': 1.96 * sd(v) / math.sqrt(len(v))} for n, v in groups],
    }


def chi_square(matrix, rows, cols):
    """獨立性檢定：matrix[i][j] 為列 i、欄 j 的次數"""
    n = sum(sum(r) for r in matrix)
    rt = [sum(r) for r in matrix]
    ct = [sum(matrix[i][j] for i in range(len(matrix))) for j in range(len(cols))]
    chi2 = 0.0
    exp_min = float('inf')
    cells = []
    for i in range(len(rows)):
        for j in range(len(cols)):
            e = rt[i] * ct[j] / n
            exp_min = min(exp_min, e)
            o = matrix[i][j]
            chi2 += (o - e) ** 2 / e
            cells.append({'row': rows[i], 'col': cols[j], 'obs': o, 'exp': e,
                          'contrib': (o - e) ** 2 / e})
    df = (len(rows) - 1) * (len(cols) - 1)
    k = min(len(rows), len(cols))
    return {'chi2': chi2, 'df': df, 'p': chi2_p_value(chi2, df), 'n': n,
            'cramersV': math.sqrt(chi2 / (n * (k - 1))) if n and k > 1 else None,
            'minExpected': exp_min, 'cells': cells, 'rowTotals': rt, 'colTotals': ct,
            'rows': rows, 'cols': cols, 'matrix': matrix}
