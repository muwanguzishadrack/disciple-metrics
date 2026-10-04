-- Existing views/RPCs/cron keep working and are byte-for-byte unchanged.
-- Seed: see supabase/seed.sql (reports e..00 = d0-35 ... e..05 = d0).
begin;
select plan(17);

-- 1. Definitions identical to production (hashes captured from prod 2026-10-04,
--    same expression as supabase/scripts/schema_fingerprint.sql).
select is(
  (select string_agg(p.proname || ':' || md5(pg_get_functiondef(p.oid)||'|'||coalesce(p.proacl::text,'')||'|'||pg_get_userbyid(p.proowner)), ',' order by p.proname)
     from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('auto_generate_weekly_pga_report','can_access_location','get_epga_detail',
                         'get_four_week_epga_detail','get_four_week_pga_detail','is_admin',
                         'is_admin_or_manager','is_fob_leader')),
  'auto_generate_weekly_pga_report:79e02ab2267e1ecc1b7ef37a04f57d16,'
  'can_access_location:5f64abdda9d5b6b5971d5a92533a522a,'
  'get_epga_detail:89a35492c4de3e2baed4b42954769318,'
  'get_four_week_epga_detail:a55434888ee6778543fe5d153c930868,'
  'get_four_week_pga_detail:ed6924f74029abd5208ae55fdcf27272,'
  'is_admin:902ee2f1a7cbc73b8a534675ac1bf929,'
  'is_admin_or_manager:e8d259a7a6b72b88409aab23e9fc0e11,'
  'is_fob_leader:451a1ca50252120ad4c70060357da2c6',
  'existing RPC/helper functions are unchanged vs prod'
);

select is(
  (select string_agg(c.relname || ':' || md5(pg_get_viewdef(c.oid, true)), ',' order by c.relname)
     from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'),
  'four_week_epga_summary:2dfdf12f3cae7bf8022b1c51cf6ddbeb,'
  'four_week_pga_summary:4c75e63533214ff9978c1fd291cea645,'
  'pga_report_summary:19ec8de0253b26b22fd64fcdde410cf6',
  'existing views are unchanged vs prod'
);

-- 2. Results as an admin
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select report_id, sv1, total, salvations, mechanics_training, epga_total
     from pga_report_summary order by date $$,
  $$ select r.id,
            coalesce(sum(e.sv1),0)::int,
            coalesce(sum(e.sv1+e.sv2+e.yxp+e.kids+e.local+e.hc1+e.hc2),0)::int,
            coalesce(sum(e.salvations),0)::int,
            coalesce(sum(e.mechanics_training),0)::int,
            coalesce(sum(e.sv1+e.sv2+e.yxp),0)::int
     from pga_reports r left join pga_entries e on e.report_id = r.id
     group by r.id, r.date order by r.date $$,
  'pga_report_summary sums match the raw entries'
);

select is(
  (select count(*)::int from pga_report_summary), 6, 'pga_report_summary has one row per report'
);

select is(
  (select wk4_total from four_week_pga_summary where report_id = 'e0000000-0000-0000-0000-000000000005'),
  (select total from pga_report_summary where report_id = 'e0000000-0000-0000-0000-000000000005'),
  'four_week_pga_summary wk4 = latest report total'
);

select is(
  (select wk1_total from four_week_pga_summary where report_id = 'e0000000-0000-0000-0000-000000000005'),
  (select total from pga_report_summary where report_id = 'e0000000-0000-0000-0000-000000000002'),
  'four_week_pga_summary wk1 = report three weeks earlier'
);

select is(
  (select wk4_total from four_week_epga_summary where report_id = 'e0000000-0000-0000-0000-000000000004'),
  (select epga_total from pga_report_summary where report_id = 'e0000000-0000-0000-0000-000000000004'),
  'four_week_epga_summary wk4 = epga total'
);

select is(
  (select count(*)::int from get_epga_detail((select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000005'))),
  3, 'get_epga_detail returns the 3 entries of the latest report'
);

select is(
  jsonb_array_length(get_four_week_pga_detail((select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000005')) -> 'dates'),
  4, 'get_four_week_pga_detail spans 4 report dates'
);

select is(
  jsonb_array_length(get_four_week_epga_detail((select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000005')) -> 'locations'),
  5, 'get_four_week_epga_detail lists the 5 locations with entries in the window'
);

-- 3. RLS still scopes the old RPCs for a pastor (Alpha Central only)
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::int from get_epga_detail((select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000005'))),
  1, 'pastor sees only their own location in get_epga_detail'
);

select is(
  (select sv1 from pga_report_summary where report_id = 'e0000000-0000-0000-0000-000000000005'),
  105, 'pastor summary only sums their own entry (sv1 = 100*1 + 5)'
);

-- 4. pg_cron job + function (runs as postgres, auth.uid() null)
reset role;
set local request.jwt.claims to '';

select is(
  (select command from cron.job where jobname = 'auto-generate-weekly-pga-report'),
  'select public.auto_generate_weekly_pga_report();',
  'cron job is scheduled'
);

select lives_ok($$ select public.auto_generate_weekly_pga_report() $$, 'cron function runs');
select lives_ok($$ select public.auto_generate_weekly_pga_report() $$, 'cron function is idempotent');

select is(
  (select count(*)::int from pga_reports where date = (current_timestamp at time zone 'Africa/Nairobi')::date),
  1, 'exactly one report exists for today after the cron function'
);

select ok(
  not exists (select 1 from pga_change_log where table_name = 'pga_reports' and operation = 'INSERT' and changed_by is not null
              and report_date = (current_timestamp at time zone 'Africa/Nairobi')::date),
  'cron-created report (if any) is logged with changed_by null'
);

select * from finish();
rollback;
