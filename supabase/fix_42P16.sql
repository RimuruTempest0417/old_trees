-- ===========================================================================
-- 修復 42P16：cannot change name of view column "species" to "tree_geo_precision"
-- ===========================================================================
--
-- 什麼時候用這個檔：
--   在「已經跑過舊版 init.sql」的資料庫上重跑新版時，PostgreSQL 可能出現
--       ERROR: 42P16: cannot change name of view column "species" to "tree_geo_precision"
--       HINT:  Use ALTER VIEW ... RENAME COLUMN ... to change name of view column instead.
--
-- 原因：
--   CREATE OR REPLACE VIEW 只能「在既有欄位後面追加」，不能改變既有欄位的位置或名稱。
--   舊版 v_trees 的第 10 欄是 species，新版同一位置是 tree_geo_precision，位置對不上就報錯。
--   （同理，函式回傳型別改變時 CREATE OR REPLACE FUNCTION 會報 42P13。）
--
-- 這個檔做什麼：
--   只刪除本專案自己產生的檢視表與資料庫函式，讓後續的 create or replace 能乾淨重建。
--   不含任何 create／insert，不會動到資料，也不會清掉實地考察紀錄（field_records）。
--
-- 使用順序（兩種都可以）：
--   A. 直接重跑最新的 supabase/init.sql —— 它已經內含這段修復，一份就夠。
--   B. 先跑本檔，再跑 supabase/init.sql（本檔只是把問題範圍縮小，方便除錯）。
-- ===========================================================================

-- 1. 刪除檢視表（cascade 會一併刪掉相依的檢視表，後面 init.sql 會全部重建）
drop view if exists public.v_trees         cascade;
drop view if exists public.v_parish_stats  cascade;
drop view if exists public.v_species_stats cascade;

-- 2. 刪除本專案的資料庫函式（回傳型別若變動，create or replace 會失敗，因此先刪）
do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('rpc_overview', 'rpc_parishes', 'rpc_species_ranking',
                            'rpc_age_histogram', 'rpc_scatter', 'rpc_find_trees')
    loop
        execute format('drop function if exists %s cascade', r.sig);
    end loop;
end $$;

-- 3. 確認結果（應為 0 筆）
select count(*) as remaining_views
from information_schema.views
where table_schema = 'public' and table_name like 'v\_%';
