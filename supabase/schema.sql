-- =============================================================================
-- 澳門古樹保育研究平台 — Supabase / PostgreSQL 資料庫綱要
-- Macau Heritage Tree Conservation Platform — schema
--
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上本檔全文 → Run
--          （或 psql "$SUPABASE_DB_URL" -f supabase/schema.sql）
-- 說明：本檔可重複執行（idempotent）。
-- =============================================================================

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
    geo_precision  text check (geo_precision in ('exact','approx','parish')),
    geo_source     text,
    photo_url      text,
    photo_credit   text,
    photo_license  text,
    photo_page     text
);

comment on table public.sites is '古樹所在地點；座標由 OSM Nominatim 地理編碼＋人工校核補齊';
comment on column public.sites.geo_precision is '座標精度：exact 精確匹配／approx 上級地物近似／parish 堂區中心回退';

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
    in_namelist  boolean not null default true,    -- 是否載於《古樹名木保護名錄》
    updated_at   timestamptz not null default now()
);

comment on table public.trees is '古樹名木個體清單（資料來源：澳門市政署《古樹名木保護名錄》整理之古樹.csv）';
comment on column public.trees.grade is '古樹分級：一級 ≥500 年／二級 300–499 年／三級 100–299 年／不分級（名木）';

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
-- ---------------------------------------------------------------------------
create or replace view public.v_trees as
select t.id, t.tree_no, t.grade, t.age_years, t.height_m, t.health,
       t.lat, t.lon, t.in_namelist,
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
    species_photo_credit text, site text, site_short text, parish text, geo_precision text
) language sql stable as $$
    select t.id, t.tree_no, t.grade, t.age_years, t.height_m, t.health,
           t.lat, t.lon, s.name_zh, s.name_sci, s.photo_url, s.photo_credit,
           st.name_zh, st.short_name, p.code, st.geo_precision
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
-- 9. Row Level Security：匿名（anon）只讀，寫入交由 service_role
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

do $$
declare tbl text;
begin
    foreach tbl in array array['parishes','species','sites','trees','routes','conservation_topics','timeline_events']
    loop
        execute format('drop policy if exists %I on public.%I', tbl || '_anon_read', tbl);
        execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                       tbl || '_anon_read', tbl);
    end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
