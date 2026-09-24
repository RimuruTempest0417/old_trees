-- ===========================================================================
-- 修復 23514：check constraint「sites_geo_precision_check」允許值過時
--   版本：v0.6.5-fix23514
-- ===========================================================================
--
-- 什麼時候用：
--   執行 init.sql／seed.sql 時出現
--     ERROR: 23514: new row for relation "sites" violates check constraint
--            "sites_geo_precision_check"
--     DETAIL: Failing row contains (…, official, iam, …)
--
-- 原因：
--   舊版資料庫的 CHECK「允許值」是 ('exact','approx','parish')，不含 'official'
--   （市政署逐株座標）。新版的 seed 會寫入 'official'，就被舊限制條件擋下來。
--
-- 這個檔做什麼：
--   ① 顯示目前 sites／trees 上的限制條件（診斷）
--   ② 移除任何涉及 geo_precision／grade／health 的 CHECK（不論名稱）
--   ③ 重建為新版定義
--   ④ 再顯示一次結果
--   不會動到任何資料列。
--
-- 用法：整份貼上 → 先按 Ctrl/Cmd+A 全選 → Run（只選取一部分時，SQL Editor 只會執行選取範圍）
-- ===========================================================================

-- ① 版本與時間（若這裡顯示的版本不是 v0.6.5-fix23514，代表貼到了舊檔案）
select 'v0.6.5-fix23514' as script_version, now() as ran_at;

-- ② 診斷：目前有哪些 CHECK 限制條件
select t.relname as table_name,
       c.conname  as constraint_name,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where c.contype = 'c'
  and n.nspname = 'public'
  and t.relname in ('sites', 'trees')
order by t.relname, c.conname;

-- ③ 移除任何涉及這三個欄位、允許值可能過時的 CHECK（依實際名稱，不論叫什麼）
do $$
declare
    r record;
begin
    for r in
        select c.conname, c.conrelid::regclass as tbl
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
        where c.contype = 'c' and n.nspname = 'public'
          and t.relname in ('sites', 'trees')
          and a.attname in ('geo_precision', 'grade', 'health')
    loop
        execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    end loop;
end $$;

-- ④ 重建為新版定義
alter table public.sites drop constraint if exists sites_geo_precision_check;
alter table public.sites add constraint sites_geo_precision_check
  check (geo_precision in ('official','exact','approx','parish'));

alter table public.trees drop constraint if exists trees_grade_check;
alter table public.trees add constraint trees_grade_check
  check (grade in ('一級','二級','三級','不分級'));

alter table public.trees drop constraint if exists trees_health_check;
alter table public.trees add constraint trees_health_check
  check (health in ('健康','一般','瀕危'));

-- ⑤ 確認結果：應只看到上面三個限制條件，且 sites 那條要包含 official
select t.relname as table_name,
       c.conname  as constraint_name,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where c.contype = 'c'
  and n.nspname = 'public'
  and t.relname in ('sites', 'trees')
order by t.relname, c.conname;
