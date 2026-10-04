-- Analytics RPCs (security invoker -> RLS scoped).
-- Seed: 29 entries over 6 reports; Moved Site (d..06) entries in e..00-e..02
-- are frozen to Alpha FOB although the location is in Bravo FOB now.
begin;
select plan(24);

-- expected values computed as postgres (no RLS)
create temp table t_dates on commit drop as
select min(date) as d_first, max(date) as d0 from pga_reports;
grant select on t_dates to authenticated, anon;

create temp table t_expected on commit drop as
select
  (select count(*) from pga_entries)::int as all_entries,
  (select sum(sv1) from pga_entries)::bigint as all_sv1,
  (select sum(salvations) from pga_entries)::bigint as all_salvations,
  (select sum(mechanics_training) from pga_entries)::bigint as all_mech_trn,
  (select sum(sv1) from pga_entries where fob_id = 'c0000000-0000-0000-0000-000000000001')::bigint as alpha_frozen_sv1,
  (select sum(sv1) from pga_entries where location_id = 'd0000000-0000-0000-0000-000000000001')::bigint as l1_sv1;
grant select on t_expected to authenticated, anon;

-- ---------------------------------------------------------------------------
-- admin
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select group_name, report_count, entry_count, sv1, salvations, mechanics_training
     from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'total') $$,
  $$ select 'Total'::text, 6, all_entries, all_sv1, all_salvations, all_mech_trn from t_expected $$,
  'total = raw sums'
);
select is(
  (select count(*)::int from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'location')),
  6, 'one row per location with entries (incl. archived Old Site)'
);
select results_eq(
  $$ select group_name, fob_name, region_name from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'location')
     where group_id = 'd0000000-0000-0000-0000-000000000006' $$,
  $$ values ('Moved Site'::text, 'Bravo FOB'::text, 'Eastern'::text) $$,
  'location row shows the latest frozen FOB'
);
select is(
  (select sv1 from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'fob')
    where group_id = 'c0000000-0000-0000-0000-000000000001'),
  (select alpha_frozen_sv1 from t_expected),
  'fob grouping uses the frozen entry fob_id'
);
select is(
  (select region_name from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'fob')
    where group_id = 'c0000000-0000-0000-0000-000000000003'),
  'Western', 'fob row carries its region'
);
select is(
  (select sum(sv1)::bigint from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'region')),
  (select all_sv1 from t_expected), 'region rows add up to the total'
);
select is(
  (select sum(entry_count)::int from get_pga_period_totals((select d0 from t_dates), (select d0 from t_dates), 'location')),
  3, 'inclusive single-day range'
);
select results_eq(
  $$ select group_name, entry_count, sv1 from get_pga_period_totals('1990-01-01', '1990-02-01', 'total') $$,
  $$ values ('Total'::text, 0, 0::bigint) $$,
  'total returns one zero row for an empty range'
);
select throws_ok(
  $$ select * from get_pga_period_totals('2020-01-01', '2030-01-01', 'country') $$,
  '22023', null, 'invalid p_group_by rejected'
);

select results_eq(
  $$ select report_date, entry_count from get_pga_trend((select d_first from t_dates), (select d0 from t_dates)) $$,
  $$ select r.date, count(e.id)::int from pga_reports r left join pga_entries e on e.report_id = r.id group by r.date order by r.date $$,
  'trend: one row per report date, ascending'
);
select results_eq(
  $$ select report_date, sv1 from get_pga_trend((select d_first from t_dates), (select d0 from t_dates), p_fob_id => 'c0000000-0000-0000-0000-000000000001') $$,
  $$ select r.date, coalesce(sum(e.sv1), 0)::bigint from pga_reports r
     left join pga_entries e on e.report_id = r.id and e.fob_id = 'c0000000-0000-0000-0000-000000000001'
     group by r.date order by r.date $$,
  'trend filtered by frozen fob'
);
select is(
  (select sum(entry_count)::int from get_pga_trend((select d_first from t_dates), (select d0 from t_dates), p_region_id => 'b0000000-0000-0000-0000-000000000002')),
  (select count(*)::int from pga_entries where region_id = 'b0000000-0000-0000-0000-000000000002'),
  'trend filtered by region'
);

select results_eq(
  $$ select location_name, fob_name, region_name from get_missing_pga_entries((select d0 from t_dates)) $$,
  $$ values ('Alpha North'::text, 'Alpha FOB'::text, 'Eastern'::text), ('Charlie West', 'Charlie FOB', 'Western') $$,
  'missing entries for the latest report (archived Old Site excluded)'
);
select is(
  (select count(*)::int from get_missing_pga_entries((select d0 from t_dates) + 7)),
  5, 'no report yet -> every active location is missing'
);

-- manager sees the same as admin
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select entry_count from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'total')),
  (select all_entries from t_expected), 'manager sees all entries'
);

-- ---------------------------------------------------------------------------
-- FOB leader (Alpha FOB): RLS = locations currently in Alpha FOB
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select entry_count from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'total')),
  11, 'leader totals only cover Alpha Central + Alpha North'
);
select results_eq(
  $$ select location_name from get_missing_pga_entries((select d0 from t_dates)) $$,
  $$ values ('Alpha North'::text) $$,
  'leader only sees their own missing locations'
);

-- ---------------------------------------------------------------------------
-- pastor (Alpha Central)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select results_eq(
  $$ select entry_count, sv1 from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'total') $$,
  $$ select 6, l1_sv1 from t_expected $$,
  'pastor totals only cover their own location'
);
select results_eq(
  $$ select group_name from get_pga_period_totals((select d_first from t_dates), (select d0 from t_dates), 'location') $$,
  $$ values ('Alpha Central'::text) $$,
  'pastor location grouping has one row'
);
select is(
  (select max(entry_count)::int from get_pga_trend((select d_first from t_dates), (select d0 from t_dates))),
  1, 'pastor trend counts at most their own entry per week'
);
select is(
  (select count(*)::int from get_missing_pga_entries((select d0 from t_dates))), 0,
  'pastor has submitted for the latest report'
);
select is(
  (select count(*)::int from get_missing_pga_entries((select d0 from t_dates) + 7)), 1,
  'pastor only sees their own location as missing'
);

-- ---------------------------------------------------------------------------
-- anon has no access
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select * from get_pga_period_totals('2020-01-01', '2030-01-01', 'total') $$, '42501', null, 'anon cannot call analytics'
);
select throws_ok(
  $$ select * from get_missing_pga_entries('2020-01-01') $$, '42501', null, 'anon cannot call missing entries'
);

select * from finish();
rollback;
