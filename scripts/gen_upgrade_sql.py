#!/usr/bin/env python3
"""從 supabase/schema.sql 的 CREATE TABLE 產生「版本升級」段落，讓舊資料庫也能升級到目前欄位。

為什麼需要：`create table if not exists` 對「已存在的舊表」不會補欄位。使用者若在舊版
init.sql 執行過的資料庫上再貼一次新版 init.sql，seed 就會出現
「column "geo_precision" of relation "public.trees" does not exist」而整段交易回滾。
本段以 `add column if not exists` 逐欄補齊（保留型別與 default），可重複執行；
全新資料庫執行也無副作用。缺 default 會讓舊表升級後出現 NULL（例如 in_namelist），
因此 default 一定要帶上。
"""
import re
import pathlib

SCHEMA = pathlib.Path('supabase/schema.sql')
src = SCHEMA.read_text(encoding='utf-8')

blocks = re.findall(r'create table if not exists public\.(\w+)\s*\((.*?)\n\);', src, re.S)
assert blocks, '找不到任何 create table 區塊'

TYPE_RE = re.compile(
    r'^([a-z_][a-z0-9_]*)\s+'
    r'(double precision|timestamptz|numeric|integer|smallint|bigint|text|boolean|uuid|real|date)'
    r'(\[\])?'
    r'(?:\((\d+)(?:,\s*(\d+))?\))?'
)
CONSTRAINT_RE = re.compile(r'\s+(?:check\b|not\s+null\b|references\b|unique\b|primary\s+key\b)')

SKIP_COLS = {'id'}
tables = []
for table, body in blocks:
    cols = []
    for raw in body.split('\n'):
        line = raw.split('--')[0].strip().rstrip(',')
        if not line:
            continue
        m = TYPE_RE.match(line)
        if not m:
            continue
        name, base, arr, p1, p2 = m.group(1), m.group(2), m.group(3) or '', m.group(4), m.group(5)
        if name in SKIP_COLS:
            continue
        typ = base + (f'({p1},{p2})' if p2 else (f'({p1})' if p1 else '')) + arr
        rest = line[m.end():]
        piece = typ
        dm = re.search(r'\bdefault\s+(.+)$', rest)
        if dm:
            expr = dm.group(1)
            cut = CONSTRAINT_RE.search(expr)
            if cut:
                expr = expr[:cut.start()]
            expr = expr.strip()
            if expr:
                piece += f' default {expr}'
        rm = re.search(r'references\s+(public\.\w+\(\w+\))', rest)
        if rm:
            piece += f' references {rm.group(1)}'
        cols.append((name, piece))
    if cols:
        tables.append((table, cols))

# 限制條件的「允許值」直接從 schema.sql 的 `check (欄位 in (…))` 推導，
# 不再手抄一份清單——手抄的舊毛病是：新增允許值（例如 conservation_topics.category
# 多了「化學視角」）時忘了同步，於是舊資料庫升級後 seed 仍被 23514 擋住。
# FALLBACK 是「既有資料超出新允許值時要正規化成什麼」；沒列到的欄位取清單第一個值。
FALLBACK = {'geo_precision': "'approx'", 'grade': "'不分級'", 'health': "'一般'", 'category': "'管護技術'"}
checks = []
for table, body in blocks:
    for m in re.finditer(r'check\s*\(\s*(\w+)\s+in\s*\(([^)]+)\)', body, re.S):
        col, values = m.group(1), ' '.join(m.group(2).split())
        if not any(name == col for name, _ in next(c for t, c in tables if t == table)):
            continue
        checks.append((table, col, f'{col} in ({values})',
                       FALLBACK.get(col, values.split(',')[0].strip()), values))
assert checks, '沒有從 schema.sql 推導出任何 CHECK 限制條件'
# 舊版資料庫的限制條件「允許值」可能與新版不同（例：sites.geo_precision 早期不含 'official'），
# 只判斷「限制條件是否存在」是不夠的——必須先移除再重建，否則 seed 會撞
#   23514: new row for relation "sites" violates check constraint "sites_geo_precision_check"。
# 重建前先把超出新允許值的既有資料正規化，否則 add constraint 會驗證失敗。
# to_regclass 守衛讓本段在「全新資料庫（表還沒建）」時直接跳過。
check_sql = ['do $$ begin']
for table, col, expr, fallback, values in checks:
    cname = f'{table}_{col}_check'
    check_sql.append(f"""  if to_regclass('public.{table}') is not null then
    update public.{table} set {col} = {fallback}
      where {col} is not null and {col} not in ({values});
    alter table public.{table} drop constraint if exists {cname};
    alter table public.{table} add constraint {cname} check ({expr});
  end if;""")
check_sql.append('end $$;')

# 其他必要的一次性調整（同樣可重複執行）
check_sql.append('')
check_sql.append('-- field_records 早期版本對 trees 設了外鍵，會讓重新初始化種子資料時')
check_sql.append('-- （truncate public.trees … cascade）連帶清空學生的實地考察紀錄，因此移除。')
check_sql.append('alter table if exists public.field_records '
                 'drop constraint if exists field_records_tree_no_fkey;')

body_lines = []
for table, cols in tables:
    body_lines.append('-- ' + table)
    for name, piece in cols:
        body_lines.append(f'alter table if exists public.{table:<20} add column if not exists {name:<20} {piece};')
    body_lines.append('')

section = (
    '-- >>> 版本升級 開始（由 scripts/gen_upgrade_sql.py 產生，請勿手改）\n'
    '-- ---------------------------------------------------------------------------\n'
    '-- 版本升級：把「舊版 init.sql 建立過的資料庫」補齊到目前欄位（可重複執行）\n'
    '--\n'
    '-- 為什麼需要：create table if not exists 對已存在的舊表「不會」補欄位，於是在舊資料庫上\n'
    '-- 再貼一次新版 init.sql 時，seed 會出現\n'
    '--   「column "geo_precision" of relation "public.trees" does not exist」\n'
    '-- 而整段交易回滾。以下逐欄 add column if not exists（含 default，避免升級後出現 NULL）。\n'
    '--\n'
    '-- 為什麼放在檔首：使用 alter table if exists，因此與 create table 的先後順序無關——\n'
    '-- 全新資料庫執行時表還不存在，全部以 NOTICE 跳過；舊資料庫則就地補齊；\n'
    '-- 重複執行時欄位已存在，同樣跳過。放在檔首也避免舊資料庫在後面的\n'
    '-- comment on column／檢視表／RPC 就先失敗。\n'
    '--\n'
    '-- 限制條件（CHECK）：舊版的「允許值」可能與新版不同（例如 sites.geo_precision\n'
    '-- 早期不含 \'official\'），只檢查限制條件是否存在並不足夠，因此一律先移除再重建，\n'
    '-- 並先把超出新允許值的既有資料正規化，否則 seed 會撞\n'
    '--   23514: new row for relation "sites" violates check constraint "sites_geo_precision_check"。\n'
    '-- ---------------------------------------------------------------------------\n'
    + '\n'.join(body_lines).rstrip() + '\n\n'
    + '\n'.join(check_sql) + '\n'
    + '-- <<< 版本升級 結束\n\n'
)

# 先移除舊的升級段落（以標記界定，精準且幂等）
start_marker = '-- >>> 版本升級 開始'
end_marker = '-- <<< 版本升級 結束'
if start_marker in src:
    s = src.index(start_marker)
    e = src.index(end_marker, s) + len(end_marker)
    src = src[:s].rstrip('\n') + '\n\n' + src[e:].lstrip('\n')

# 插在檔首說明之後、第一個 create table 之前
anchor = re.search(r'^-- ={10,}\n(?:.*\n)*?-- ={10,}\n', src, re.M)
assert anchor, '找不到檔首說明區塊'
src = src[:anchor.end()] + '\n' + section + src[anchor.end():].lstrip('\n')
SCHEMA.write_text(src, encoding='utf-8')

n_cols = sum(len(c) for _, c in tables)
print(f'升級段落：{len(tables)} 張表、{n_cols} 個欄位、{len(checks)} 個 CHECK')
print('含 default 的欄位：',
      [f'{t}.{n}' for t, cols in tables for n, p in cols if 'default' in p])
