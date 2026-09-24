-- =============================================================================
-- 澳門古樹保育研究平台 — Supabase / PostgreSQL 資料庫綱要
-- Macau Heritage Tree Conservation Platform — schema
--
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上本檔全文 → Run
--          （或 psql "$SUPABASE_DB_URL" -f supabase/schema.sql）
-- 說明：本檔可重複執行（idempotent）。
-- =============================================================================

-- >>> 版本升級 開始（由 scripts/gen_upgrade_sql.py 產生，請勿手改）
-- ---------------------------------------------------------------------------
-- 版本升級：把「舊版 init.sql 建立過的資料庫」補齊到目前欄位（可重複執行）
--
-- 為什麼需要：create table if not exists 對已存在的舊表「不會」補欄位，於是在舊資料庫上
-- 再貼一次新版 init.sql 時，seed 會出現
--   「column "geo_precision" of relation "public.trees" does not exist」
-- 而整段交易回滾。以下逐欄 add column if not exists（含 default，避免升級後出現 NULL）。
--
-- 為什麼放在檔首：使用 alter table if exists，因此與 create table 的先後順序無關——
-- 全新資料庫執行時表還不存在，全部以 NOTICE 跳過；舊資料庫則就地補齊；
-- 重複執行時欄位已存在，同樣跳過。放在檔首也避免舊資料庫在後面的
-- comment on column／檢視表／RPC 就先失敗。
--
-- 限制條件（CHECK）：舊版的「允許值」可能與新版不同（例如 sites.geo_precision
-- 早期不含 'official'），只檢查限制條件是否存在並不足夠，因此一律先移除再重建，
-- 並先把超出新允許值的既有資料正規化，否則 seed 會撞
--   23514: new row for relation "sites" violates check constraint "sites_geo_precision_check"。
-- ---------------------------------------------------------------------------
-- parishes
alter table if exists public.parishes             add column if not exists code                 text;
alter table if exists public.parishes             add column if not exists name_zh              text;
alter table if exists public.parishes             add column if not exists name_pt              text;
alter table if exists public.parishes             add column if not exists area_km2             numeric(8,2);
alter table if exists public.parishes             add column if not exists centroid_lat         numeric(9,6);
alter table if exists public.parishes             add column if not exists centroid_lon         numeric(9,6);
alter table if exists public.parishes             add column if not exists note                 text;

-- species
alter table if exists public.species              add column if not exists name_zh              text;
alter table if exists public.species              add column if not exists name_sci             text;
alter table if exists public.species              add column if not exists wikidata_id          text;
alter table if exists public.species              add column if not exists photo_url            text;
alter table if exists public.species              add column if not exists photo_credit         text;
alter table if exists public.species              add column if not exists photo_license        text;
alter table if exists public.species              add column if not exists photo_page           text;
alter table if exists public.species              add column if not exists description          text;

-- sites
alter table if exists public.sites                add column if not exists name_zh              text;
alter table if exists public.sites                add column if not exists short_name           text;
alter table if exists public.sites                add column if not exists parish_code          text references public.parishes(code);
alter table if exists public.sites                add column if not exists lat                  numeric(9,6);
alter table if exists public.sites                add column if not exists lon                  numeric(9,6);
alter table if exists public.sites                add column if not exists geo_precision        text;
alter table if exists public.sites                add column if not exists geo_source           text;
alter table if exists public.sites                add column if not exists photo_url            text;
alter table if exists public.sites                add column if not exists photo_credit         text;
alter table if exists public.sites                add column if not exists photo_license        text;
alter table if exists public.sites                add column if not exists photo_page           text;

-- trees
alter table if exists public.trees                add column if not exists tree_no              text;
alter table if exists public.trees                add column if not exists species_id           integer references public.species(id);
alter table if exists public.trees                add column if not exists site_id              integer references public.sites(id);
alter table if exists public.trees                add column if not exists parish_code          text references public.parishes(code);
alter table if exists public.trees                add column if not exists grade                text;
alter table if exists public.trees                add column if not exists age_years            integer;
alter table if exists public.trees                add column if not exists height_m             numeric(5,2);
alter table if exists public.trees                add column if not exists health               text;
alter table if exists public.trees                add column if not exists lat                  numeric(9,6);
alter table if exists public.trees                add column if not exists lon                  numeric(9,6);
alter table if exists public.trees                add column if not exists geo_precision        text;
alter table if exists public.trees                add column if not exists official_no          text;
alter table if exists public.trees                add column if not exists iam_tree_no          text;
alter table if exists public.trees                add column if not exists ref_id               uuid;
alter table if exists public.trees                add column if not exists crown_m              numeric(6,2);
alter table if exists public.trees                add column if not exists diameter_cm          numeric(7,2);
alter table if exists public.trees                add column if not exists girth_cm             numeric(7,2);
alter table if exists public.trees                add column if not exists stem_count           smallint;
alter table if exists public.trees                add column if not exists stem_measures        text;
alter table if exists public.trees                add column if not exists surround_m           numeric(8,2);
alter table if exists public.trees                add column if not exists official_description text;
alter table if exists public.trees                add column if not exists official_loc         text;
alter table if exists public.trees                add column if not exists photo_url            text;
alter table if exists public.trees                add column if not exists photo_source         text;
alter table if exists public.trees                add column if not exists photo_count          integer;
alter table if exists public.trees                add column if not exists official_age_years   integer;
alter table if exists public.trees                add column if not exists official_height_m    numeric(5,2);
alter table if exists public.trees                add column if not exists official_health      text;
alter table if exists public.trees                add column if not exists official_grade       text;
alter table if exists public.trees                add column if not exists in_namelist          boolean default true;
alter table if exists public.trees                add column if not exists updated_at           timestamptz default now();

-- routes
alter table if exists public.routes               add column if not exists code                 text;
alter table if exists public.routes               add column if not exists name_zh              text;
alter table if exists public.routes               add column if not exists summary              text;
alter table if exists public.routes               add column if not exists parish_codes         text[] default '{}';
alter table if exists public.routes               add column if not exists site_names           text[] default '{}';
alter table if exists public.routes               add column if not exists species_focus        text;
alter table if exists public.routes               add column if not exists max_stops            integer default 12;
alter table if exists public.routes               add column if not exists sort_order           integer default 0;
alter table if exists public.routes               add column if not exists tips                 text;

-- conservation_topics
alter table if exists public.conservation_topics  add column if not exists slug                 text;
alter table if exists public.conservation_topics  add column if not exists category             text;
alter table if exists public.conservation_topics  add column if not exists title                text;
alter table if exists public.conservation_topics  add column if not exists summary              text;
alter table if exists public.conservation_topics  add column if not exists body_md              text;
alter table if exists public.conservation_topics  add column if not exists sources              text[] default '{}';
alter table if exists public.conservation_topics  add column if not exists sort_order           integer default 0;

-- timeline_events
alter table if exists public.timeline_events      add column if not exists year                 integer;
alter table if exists public.timeline_events      add column if not exists event_date           text;
alter table if exists public.timeline_events      add column if not exists title                text;
alter table if exists public.timeline_events      add column if not exists detail               text;
alter table if exists public.timeline_events      add column if not exists source               text;

-- field_records
alter table if exists public.field_records        add column if not exists tree_no              text;
alter table if exists public.field_records        add column if not exists observed_on          date default current_date;
alter table if exists public.field_records        add column if not exists observer             text;
alter table if exists public.field_records        add column if not exists weather              text;
alter table if exists public.field_records        add column if not exists health               text;
alter table if exists public.field_records        add column if not exists height_m             numeric(5,2);
alter table if exists public.field_records        add column if not exists diameter_cm          numeric(7,2);
alter table if exists public.field_records        add column if not exists crown_m              numeric(5,2);
alter table if exists public.field_records        add column if not exists site_note            text;
alter table if exists public.field_records        add column if not exists damage_note          text;
alter table if exists public.field_records        add column if not exists photo_url            text;
alter table if exists public.field_records        add column if not exists lat                  numeric(9,6);
alter table if exists public.field_records        add column if not exists lon                  numeric(9,6);
alter table if exists public.field_records        add column if not exists created_at           timestamptz default now();

do $$ begin
  if to_regclass('public.sites') is not null then
    update public.sites set geo_precision = 'approx'
      where geo_precision is not null and geo_precision not in ('official','exact','approx','parish');
    alter table public.sites drop constraint if exists sites_geo_precision_check;
    alter table public.sites add constraint sites_geo_precision_check check (geo_precision in ('official','exact','approx','parish'));
  end if;
  if to_regclass('public.trees') is not null then
    update public.trees set grade = '不分級'
      where grade is not null and grade not in ('一級','二級','三級','不分級');
    alter table public.trees drop constraint if exists trees_grade_check;
    alter table public.trees add constraint trees_grade_check check (grade in ('一級','二級','三級','不分級'));
  end if;
  if to_regclass('public.trees') is not null then
    update public.trees set health = '一般'
      where health is not null and health not in ('健康','一般','瀕危');
    alter table public.trees drop constraint if exists trees_health_check;
    alter table public.trees add constraint trees_health_check check (health in ('健康','一般','瀕危'));
  end if;
end $$;

-- field_records 早期版本對 trees 設了外鍵，會讓重新初始化種子資料時
-- （truncate public.trees … cascade）連帶清空學生的實地考察紀錄，因此移除。
alter table if exists public.field_records drop constraint if exists field_records_tree_no_fkey;
-- <<< 版本升級 結束

-- ---------------------------------------------------------------------------
-- 1. 堂區 parishes
-- ---------------------------------------------------------------------------
create table if not exists public.parishes (
    code          text primary key,                -- 堂區代碼（中文名）
    name_zh       text not null,
    name_pt       text,
    area_km2      numeric(8,2),                    -- 面積（平方公里）
    centroid_lat  numeric(9,6),
    centroid_lon  numeric(9,6),
    note          text
);

comment on table public.parishes is '澳門堂區（七個堂區＋路氹填海區）';
comment on column public.parishes.area_km2 is '堂區面積（平方公里，統計暨普查局 2023 年數據）';

-- ---------------------------------------------------------------------------
-- 2. 樹種 species
-- ---------------------------------------------------------------------------
create table if not exists public.species (
    id            serial primary key,
    name_zh       text not null unique,            -- 中文品種名（來自古樹名錄）
    name_sci      text,                            -- 學名
    wikidata_id   text,
    photo_url     text,                            -- 相片（Wikimedia Commons，自由授權）
    photo_credit  text,
    photo_license text,
    photo_page    text,
    description   text
);

comment on table public.species is '古樹品種（含學名與自由授權相片）';

-- ---------------------------------------------------------------------------
-- 3. 地點 sites
-- ---------------------------------------------------------------------------
create table if not exists public.sites (
    id             serial primary key,
    name_zh        text not null unique,           -- 古樹名錄中的「地點」原文
    short_name     text,                           -- 去掉「澳門區／氹仔區／路環區」前綴
    parish_code    text references public.parishes(code),
    lat            numeric(9,6),
    lon            numeric(9,6),
    geo_precision  text check (geo_precision in ('official','exact','approx','parish')),
    geo_source     text,
    photo_url      text,
    photo_credit   text,
    photo_license  text,
    photo_page     text
);

comment on table public.sites is '古樹所在地點；座標優先採市政署逐株座標，其餘以 OSM Nominatim 地理編碼＋人工校核補齊';
comment on column public.sites.geo_precision is '座標精度：official 市政署逐株座標（取該地點任一株官方座標）／exact 精確匹配／approx 上級地物近似／parish 堂區中心回退';

-- ---------------------------------------------------------------------------
-- 4. 古樹 trees
-- ---------------------------------------------------------------------------
create table if not exists public.trees (
    id           serial primary key,
    tree_no      text not null unique,             -- 古樹編號
    species_id   integer references public.species(id),
    site_id      integer references public.sites(id),
    parish_code  text references public.parishes(code),
    grade        text not null check (grade in ('一級','二級','三級','不分級')),
    age_years    integer not null check (age_years > 0),
    height_m     numeric(5,2) not null check (height_m > 0),
    health       text not null check (health in ('健康','一般','瀕危')),
    lat          numeric(9,6),                     -- 冗餘自 sites，方便地圖查詢
    lon          numeric(9,6),
    geo_precision text,                            -- 座標來源精度：official／exact／approx／parish
    -- ── 市政署澳門自然網公開資料（逐株）─────────────────────────
    official_no        text,                       -- 官方古樹編號（與 tree_no 相同，保留以便對照）
    iam_tree_no        text,                       -- 市政署系統樹木編號（如 T0000471）
    ref_id             uuid,                       -- 市政署系統唯一識別碼
    crown_m            numeric(6,2),               -- 冠幅（公尺）
    diameter_cm        numeric(7,2),               -- 胸徑（公分；市政署官方值，多主幹取最大胸徑那支）
    girth_cm           numeric(7,2),               -- 胸圍（公分；市政署官方值，與 diameter_cm 同一支主幹）
    stem_count         smallint,                   -- 官方量測的主幹數（1＝單一主幹）
    stem_measures      text,                        -- 多主幹時的官方完整量測（胸徑／胸圍逐支列出）
    surround_m         numeric(8,2),               -- 樹木周邊範圍（公尺）
    official_description text,                     -- 官方形態描述
    official_loc       text,                       -- 官方地點描述
    photo_url          text,                       -- 官方照片（本地路徑）
    photo_source       text,                       -- 官方照片原始網址
    photo_count        integer,                    -- 官方照片張數
    official_age_years integer,                    -- 市政署現行樹齡（與《名錄》不一致時並列說明）
    official_height_m  numeric(5,2),               -- 市政署現行樹高
    official_health    text,                       -- 市政署現行健康狀況
    official_grade     text,                       -- 市政署現行分級
    in_namelist  boolean not null default true,    -- 是否載於《古樹名木保護名錄》
    updated_at   timestamptz not null default now()
);

comment on table public.trees is '古樹名木個體清單（名稱、分級、樹齡、樹高、健康：澳門市政署《古樹名木保護名錄》整理之古樹.csv；座標、冠幅、胸徑、描述、照片：市政署澳門自然網古樹名木公開資料 https://www.iam.gov.mo/nature/c/tree）';
comment on column public.trees.grade is '古樹分級：一級 ≥500 年／二級 300–499 年／三級 100–299 年／不分級（名木）';
comment on column public.trees.geo_precision is '座標精度：official＝市政署逐株座標；exact／approx＝Nominatim 地理編碼；parish＝回退堂區中心';
comment on column public.trees.photo_url is '官方照片本地路徑；原始檔位於市政署網站（見 photo_source），非商業教學用途並標示出處';

create index if not exists idx_trees_parish  on public.trees (parish_code);
create index if not exists idx_trees_species on public.trees (species_id);
create index if not exists idx_trees_site    on public.trees (site_id);
create index if not exists idx_trees_health  on public.trees (health);
create index if not exists idx_trees_grade   on public.trees (grade);
create index if not exists idx_trees_age     on public.trees (age_years);
create index if not exists idx_trees_geo     on public.trees (lat, lon);

-- ---------------------------------------------------------------------------
-- 5. 路綫推薦 routes / route_sites
-- ---------------------------------------------------------------------------
create table if not exists public.routes (
    id           serial primary key,
    code         text not null unique,
    name_zh      text not null,
    summary      text,
    parish_codes text[] not null default '{}',     -- 涵蓋堂區
    site_names   text[] not null default '{}',     -- 候選地點（正規表示式不可用，精確比對）
    species_focus text,
    max_stops    integer not null default 12,
    sort_order   integer not null default 0,
    tips         text
);

comment on table public.routes is '精選路綫推薦；實際停靠次序由 /api/route 以最近鄰＋2-opt 即時計算';

-- ---------------------------------------------------------------------------
-- 6. 保育科普 conservation_topics（含立法時間線、常見問題）
-- ---------------------------------------------------------------------------
create table if not exists public.conservation_topics (
    id         serial primary key,
    slug       text not null unique,
    category   text not null check (category in ('為何保育','分佈與歷史','立法與制度','管護技術','數學與數據','居民與社區','常見問題')),
    title      text not null,
    summary    text,
    body_md    text not null,
    sources    text[] not null default '{}',
    sort_order integer not null default 0
);

create table if not exists public.timeline_events (
    id         serial primary key,
    year       integer not null,
    event_date text,
    title      text not null,
    detail     text,
    source     text
);

comment on table public.conservation_topics is '保育科普文章（繁體中文），由 /api/conservation 提供';
comment on table public.timeline_events is '澳門古樹保護立法與名錄時間線';

-- ---------------------------------------------------------------------------
-- 7. 檢視表 views — 供分析與圖表使用
--    （舊資料庫相容：先刪再建，見下方說明）
-- ---------------------------------------------------------------------------
-- 為什麼要先 drop：CREATE OR REPLACE VIEW 只能「在既有欄位後面追加」，無法改變
-- 既有欄位的位置或名稱。舊版 v_trees 的第 10 欄是 species，新版同一位置是
-- tree_geo_precision，於是舊資料庫重跑本檔時 PostgreSQL 直接報
--   42P16: cannot change name of view column "species" to "tree_geo_precision"
-- （HINT 建議用 ALTER VIEW RENAME COLUMN，但檢視表本來就是本檔產生的一次性物件，
--  整體重建最乾淨）。cascade 會一併刪掉相依檢視，下面再全部重新建立。
-- 同理，函式若回傳型別改變，CREATE OR REPLACE FUNCTION 會報 42P13，因此一併刪除。
drop view if exists public.v_trees         cascade;
drop view if exists public.v_parish_stats  cascade;
drop view if exists public.v_species_stats cascade;

do $$
declare r record;
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

create or replace view public.v_trees as
select t.id, t.tree_no, t.grade, t.age_years, t.height_m, t.health,
       t.lat, t.lon, t.in_namelist,
       t.geo_precision as tree_geo_precision,
       t.official_no, t.iam_tree_no, t.ref_id, t.crown_m, t.diameter_cm, t.girth_cm,
       t.stem_count, t.stem_measures, t.surround_m,
       t.official_description, t.official_loc, t.photo_url as tree_photo,
       t.photo_source as tree_photo_source, t.photo_count,
       t.official_age_years, t.official_height_m, t.official_health, t.official_grade,
       s.name_zh as species, s.name_sci, s.photo_url as species_photo,
       s.photo_credit as species_photo_credit,
       st.name_zh as site, st.short_name as site_short, st.geo_precision,
       st.photo_url as site_photo,
       p.code as parish, p.area_km2
from public.trees t
         left join public.species s on s.id = t.species_id
         left join public.sites   st on st.id = t.site_id
         left join public.parishes p on p.code = t.parish_code;

create or replace view public.v_parish_stats as
select p.code as parish, p.name_pt, p.area_km2,
       count(t.id)::int                                              as tree_count,
       count(t.id) filter (where t.grade = '一級')::int               as grade1,
       count(t.id) filter (where t.grade = '二級')::int               as grade2,
       count(t.id) filter (where t.grade = '三級')::int               as grade3,
       count(t.id) filter (where t.grade = '不分級')::int             as grade_other,
       count(t.id) filter (where t.health = '健康')::int              as health_good,
       count(t.id) filter (where t.health = '一般')::int              as health_fair,
       count(t.id) filter (where t.health = '瀕危')::int              as health_endangered,
       coalesce(round(avg(t.age_years), 1), 0)                       as avg_age,
       coalesce(max(t.age_years), 0)                                 as max_age,
       coalesce(round(avg(t.height_m), 2), 0)                        as avg_height,
       count(distinct t.site_id)::int                                 as site_count,
       count(distinct t.species_id)::int                              as species_count,
       case when p.area_km2 > 0
            then round(count(t.id) / p.area_km2, 1) end               as density_per_km2
from public.parishes p
         left join public.trees t on t.parish_code = p.code
group by p.code, p.name_pt, p.area_km2;

create or replace view public.v_species_stats as
select s.id, s.name_zh as species, s.name_sci, s.photo_url, s.photo_credit, s.photo_license,
       count(t.id)::int                                 as tree_count,
       round(avg(t.age_years), 1)                       as avg_age,
       max(t.age_years)                                 as max_age,
       round(avg(t.height_m), 2)                        as avg_height,
       round(stddev_samp(t.height_m), 2)                as sd_height,
       round(stddev_samp(t.age_years), 1)               as sd_age,
       count(t.id) filter (where t.health = '瀕危')::int as endangered,
       count(distinct t.parish_code)::int               as parish_count
from public.species s
         left join public.trees t on t.species_id = s.id
group by s.id, s.name_zh, s.name_sci, s.photo_url, s.photo_credit, s.photo_license;

-- ---------------------------------------------------------------------------
-- 8. RPC 函數 — 供前端／Serverless Functions 呼叫
-- ---------------------------------------------------------------------------

-- 統計總覽
create or replace function public.rpc_overview()
returns jsonb language sql stable as $$
with base as (select * from public.trees),
     agg as (
         select count(*)::int                                     as tree_count,
                count(distinct species_id)::int                    as species_count,
                count(distinct site_id)::int                       as site_count,
                count(distinct parish_code)::int                   as parish_count,
                max(age_years)::int                                as max_age,
                round(avg(age_years), 1)                           as avg_age,
                round(avg(height_m), 2)                            as avg_height,
                count(*) filter (where health = '瀕危')::int        as endangered,
                count(*) filter (where health = '一般')::int        as fair,
                count(*) filter (where health = '健康')::int        as good,
                count(*) filter (where grade = '一級')::int         as grade1,
                count(*) filter (where grade = '二級')::int         as grade2,
                count(*) filter (where grade = '三級')::int         as grade3,
                count(*) filter (where grade = '不分級')::int       as grade_other,
                round(100.0 * count(*) filter (where health <> '健康') / greatest(count(*),1), 1) as attention_pct
         from base)
select to_jsonb(agg) from agg;
$$;

-- 各堂區古樹數目分佈（任務 1：各堂區古樹數目分佈圖）
create or replace function public.rpc_parishes()
returns setof public.v_parish_stats language sql stable as $$
    select * from public.v_parish_stats order by tree_count desc;
$$;

-- 品種排行榜
create or replace function public.rpc_species_ranking(p_limit int default 15)
returns setof public.v_species_stats language sql stable as $$
    select * from public.v_species_stats
    where tree_count > 0
    order by tree_count desc, avg_age desc
    limit greatest(p_limit, 1);
$$;

-- 樹齡分佈直方圖
create or replace function public.rpc_age_histogram(p_bucket int default 50)
returns table (bucket_start int, bucket_end int, tree_count int) language sql stable as $$
    select (age_years / greatest(p_bucket,1)) * greatest(p_bucket,1) as bucket_start,
           (age_years / greatest(p_bucket,1)) * greatest(p_bucket,1) + greatest(p_bucket,1) as bucket_end,
           count(*)::int
    from public.trees
    group by 1, 2
    order by 1;
$$;

-- 樹齡／樹高原始資料點（供數學模型擬合）
create or replace function public.rpc_scatter()
returns table (tree_no text, age_years int, height_m numeric, species text, parish text, health text)
language sql stable as $$
    select t.tree_no, t.age_years, t.height_m, s.name_zh, t.parish_code, t.health
    from public.trees t
             left join public.species s on s.id = t.species_id
    order by t.age_years;
$$;

-- 地圖查詢（支援堂區、品種、分級、健康、樹齡區間、關鍵字、外接矩形、半徑）
create or replace function public.rpc_find_trees(
    p_parish   text    default null,
    p_species  text    default null,
    p_grade    text    default null,
    p_health   text    default null,
    p_min_age  int     default null,
    p_max_age  int     default null,
    p_keyword  text    default null,
    p_min_lat  numeric default null,
    p_max_lat  numeric default null,
    p_min_lon  numeric default null,
    p_max_lon  numeric default null,
    p_lat      numeric default null,
    p_lon      numeric default null,
    p_radius_m int     default null,
    p_limit    int     default 500,
    p_offset   int     default 0
)
returns table (
    id int, tree_no text, grade text, age_years int, height_m numeric, health text,
    lat numeric, lon numeric, species text, name_sci text, species_photo text,
    species_photo_credit text, site text, site_short text, parish text, geo_precision text,
    crown_m numeric, diameter_cm numeric, surround_m numeric, official_description text,
    official_loc text, tree_photo text, tree_photo_source text, iam_tree_no text,
    official_age_years int, official_height_m numeric, official_health text, official_grade text
) language sql stable as $$
    select t.id, t.tree_no, t.grade, t.age_years, t.height_m, t.health,
           t.lat, t.lon, s.name_zh, s.name_sci, s.photo_url, s.photo_credit,
           st.name_zh, st.short_name, p.code, t.geo_precision,
           t.crown_m, t.diameter_cm, t.surround_m, t.official_description,
           t.official_loc, t.photo_url, t.photo_source, t.iam_tree_no,
           t.official_age_years, t.official_height_m, t.official_health, t.official_grade
    from public.trees t
             left join public.species s on s.id = t.species_id
             left join public.sites   st on st.id = t.site_id
             left join public.parishes p on p.code = t.parish_code
    where (p_parish  is null or t.parish_code = p_parish)
      and (p_species is null or s.name_zh = p_species)
      and (p_grade   is null or t.grade = p_grade)
      and (p_health  is null or t.health = p_health)
      and (p_min_age is null or t.age_years >= p_min_age)
      and (p_max_age is null or t.age_years <= p_max_age)
      and (p_keyword is null or s.name_zh ilike '%' || p_keyword || '%'
                            or st.name_zh ilike '%' || p_keyword || '%'
                            or t.tree_no = p_keyword)
      and (p_min_lat is null or t.lat >= p_min_lat)
      and (p_max_lat is null or t.lat <= p_max_lat)
      and (p_min_lon is null or t.lon >= p_min_lon)
      and (p_max_lon is null or t.lon <= p_max_lon)
      and (p_radius_m is null or p_lat is null or p_lon is null
           or 111320 * sqrt(power(t.lat - p_lat, 2)
                            + power((t.lon - p_lon) * cos(radians(p_lat)), 2)) <= p_radius_m)
    order by t.age_years desc, t.tree_no
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- 9. 實地考察紀錄 field_records
--    這是刻意預留給「實地考察」的空間：學生走訪現場後逐株記錄，
--    與官方名錄的資料分開存放，不混入 trees 表（官方資料不被覆寫）。
-- ---------------------------------------------------------------------------
create table if not exists public.field_records (
    id             uuid primary key default gen_random_uuid(),
    -- 軟性參照：刻意「不」設外鍵。seed.sql 會 `truncate public.trees … cascade`，
    -- 若這裡有外鍵，PostgreSQL 會連帶把實地考察紀錄一起清空（已實測）。
    -- 為了讓重新初始化種子資料不會弄丟學生的考察紀錄，tree_no 只做文字比對。
    tree_no        text,
    observed_on    date not null default current_date,   -- 觀察日期
    observer       text not null,                        -- 記錄者（班級／座號／姓名）
    weather        text,                                 -- 天氣
    health         text check (health in ('健康', '一般', '瀕危')),
    height_m       numeric(5,2),                          -- 目測／實測樹高（公尺）
    diameter_cm    numeric(7,2),                          -- 胸徑（公分）
    crown_m        numeric(5,2),                          -- 冠幅（公尺）
    site_note      text,                                  -- 立地環境（樹穴、鋪面、積水…）
    damage_note    text,                                  -- 病蟲害、枯枝、人為損傷
    photo_url      text,                                  -- 現場照片網址
    lat            numeric(9,6),
    lon            numeric(9,6),
    created_at     timestamptz not null default now(),
    constraint field_records_observer_len check (char_length(observer) between 1 and 60),
    constraint field_records_note_len     check (coalesce(char_length(site_note), 0) <= 600
                                              and coalesce(char_length(damage_note), 0) <= 600)
);
comment on table public.field_records is '實地考察紀錄（學生／公眾現場觀察，與官方名錄分開存放）';
comment on column public.field_records.tree_no is '對應古樹編號；允許留空以記錄「疑似古樹」或名錄外個體';

create index if not exists idx_field_records_observed on public.field_records (observed_on desc, created_at desc);
create index if not exists idx_field_records_tree on public.field_records (tree_no);

-- ---------------------------------------------------------------------------
-- 10. Row Level Security：匿名（anon）只讀，寫入交由 service_role
-- ---------------------------------------------------------------------------
-- Supabase 已內建 anon / authenticated 角色；此處的守衛讓本檔亦可在
-- 一般 PostgreSQL（含測試用 PGlite）上直接執行。
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
    end if;
end $$;

alter table public.parishes            enable row level security;
alter table public.species             enable row level security;
alter table public.sites               enable row level security;
alter table public.trees               enable row level security;
alter table public.routes              enable row level security;
alter table public.conservation_topics enable row level security;
alter table public.timeline_events     enable row level security;
alter table public.field_records       enable row level security;

do $$
declare tbl text;
begin
    foreach tbl in array array['parishes','species','sites','trees','routes','conservation_topics','timeline_events','field_records']
    loop
        execute format('drop policy if exists %I on public.%I', tbl || '_anon_read', tbl);
        execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                       tbl || '_anon_read', tbl);
    end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- 實地考察紀錄的寫入一律經由 Serverless Function（使用 service_role），
-- 因此不開放 anon 直接 insert／update／delete；日後若改為前端直寫，
-- 應改以 Supabase Auth 登入 + 具 auth.uid() 的政策取代，而非放寬 anon。

