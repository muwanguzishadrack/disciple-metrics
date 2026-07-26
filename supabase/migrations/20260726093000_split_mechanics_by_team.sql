-- Split the single Ministry-Impact "mechanics" total into seven serving teams:
--   GET, Worship Team, Media Team, Harvest Kids, Parking & Security, Facilities, Bussing.
--
-- `mechanics` is converted into a GENERATED column = sum of the seven parts (plus a
-- legacy bucket), so the DB guarantees total = the sum of its parts and existing
-- consumers (pga_report_summary, dashboard, reports) keep reading it unchanged.
--
-- Pre-split history has no team breakdown, so each old row's total is preserved in
-- `mechanics_legacy`, which is not exposed in any form. Reporting from today
-- (2026-07-26) onward fills only the seven team columns.

-- 1. Add the seven team columns + the legacy bucket (match existing int/default-0 convention)
alter table public.pga_entries
  add column mechanics_get              integer default 0,
  add column mechanics_worship          integer default 0,
  add column mechanics_media            integer default 0,
  add column mechanics_harvest_kids     integer default 0,
  add column mechanics_parking_security integer default 0,
  add column mechanics_facilities       integer default 0,
  add column mechanics_bussing          integer default 0,
  add column mechanics_legacy           integer default 0;

-- 2. Backfill: existing breakdown-unknown totals move to the legacy bucket so nothing is lost
update public.pga_entries
  set mechanics_legacy = coalesce(mechanics, 0);

-- 3. Drop dependent views (four-week views read from pga_report_summary)
drop view if exists public.four_week_pga_summary;
drop view if exists public.four_week_epga_summary;
drop view if exists public.pga_report_summary;

-- 4. Replace mechanics with a generated column = sum of the seven teams + legacy
alter table public.pga_entries drop column mechanics;
alter table public.pga_entries
  add column mechanics integer
  generated always as (
    coalesce(mechanics_get, 0)
    + coalesce(mechanics_worship, 0)
    + coalesce(mechanics_media, 0)
    + coalesce(mechanics_harvest_kids, 0)
    + coalesce(mechanics_parking_security, 0)
    + coalesce(mechanics_facilities, 0)
    + coalesce(mechanics_bussing, 0)
    + coalesce(mechanics_legacy, 0)
  ) stored;

-- 5. Recreate pga_report_summary (adds the seven team sums; mechanics now = generated total)
create view public.pga_report_summary
  with (security_invoker = true) as
 select r.id as report_id,
    r.date,
    r.created_at,
    coalesce(sum(e.sv1), 0::bigint)::integer as sv1,
    coalesce(sum(e.sv2), 0::bigint)::integer as sv2,
    coalesce(sum(e.yxp), 0::bigint)::integer as yxp,
    coalesce(sum(e.kids), 0::bigint)::integer as kids,
    coalesce(sum(e.local), 0::bigint)::integer as local,
    coalesce(sum(e.hc1), 0::bigint)::integer as hc1,
    coalesce(sum(e.hc2), 0::bigint)::integer as hc2,
    coalesce(sum(e.sv1 + e.sv2 + e.yxp + e.kids + e.local + e.hc1 + e.hc2), 0::bigint)::integer as total,
    coalesce(sum(e.salvations), 0::bigint)::integer as salvations,
    coalesce(sum(e.salvations_livestream), 0::bigint)::integer as salvations_livestream,
    coalesce(sum(e.salvations_inhouse), 0::bigint)::integer as salvations_inhouse,
    coalesce(sum(e.salvations_mc), 0::bigint)::integer as salvations_mc,
    coalesce(sum(e.salvations_other), 0::bigint)::integer as salvations_other,
    coalesce(sum(e.baptisms), 0::bigint)::integer as baptisms,
    coalesce(sum(e.mca), 0::bigint)::integer as mca,
    coalesce(sum(e.mechanics), 0::bigint)::integer as mechanics,
    coalesce(sum(e.mechanics_get), 0::bigint)::integer as mechanics_get,
    coalesce(sum(e.mechanics_worship), 0::bigint)::integer as mechanics_worship,
    coalesce(sum(e.mechanics_media), 0::bigint)::integer as mechanics_media,
    coalesce(sum(e.mechanics_harvest_kids), 0::bigint)::integer as mechanics_harvest_kids,
    coalesce(sum(e.mechanics_parking_security), 0::bigint)::integer as mechanics_parking_security,
    coalesce(sum(e.mechanics_facilities), 0::bigint)::integer as mechanics_facilities,
    coalesce(sum(e.mechanics_bussing), 0::bigint)::integer as mechanics_bussing,
    coalesce(sum(e.mechanics_legacy), 0::bigint)::integer as mechanics_legacy,
    coalesce(sum(e.sv1 + e.sv2 + e.yxp), 0::bigint)::integer as epga_total
   from pga_reports r
     left join pga_entries e on e.report_id = r.id
  group by r.id, r.date, r.created_at;

-- 6. Recreate four_week_pga_summary (verbatim original logic)
create view public.four_week_pga_summary
  with (security_invoker = true) as
 with numbered as (
         select pga_report_summary.report_id,
            pga_report_summary.date,
            pga_report_summary.total,
            row_number() over (order by pga_report_summary.date desc) as rn
           from pga_report_summary
        )
 select cur.report_id,
    cur.date,
    max(case when prev.rn = (cur.rn + 3) then prev.total else null::integer end) as wk1_total,
    max(case when prev.rn = (cur.rn + 3) then prev.date else null::date end) as wk1_date,
    max(case when prev.rn = (cur.rn + 2) then prev.total else null::integer end) as wk2_total,
    max(case when prev.rn = (cur.rn + 2) then prev.date else null::date end) as wk2_date,
    max(case when prev.rn = (cur.rn + 1) then prev.total else null::integer end) as wk3_total,
    max(case when prev.rn = (cur.rn + 1) then prev.date else null::date end) as wk3_date,
    cur.total as wk4_total,
    cur.date as wk4_date,
    round((coalesce(max(case when prev.rn = (cur.rn + 3) then prev.total else null::integer end), 0)
         + coalesce(max(case when prev.rn = (cur.rn + 2) then prev.total else null::integer end), 0)
         + coalesce(max(case when prev.rn = (cur.rn + 1) then prev.total else null::integer end), 0)
         + cur.total)::numeric
      / (case when max(case when prev.rn = (cur.rn + 3) then 1 else null::integer end) is not null then 1 else 0 end
       + case when max(case when prev.rn = (cur.rn + 2) then 1 else null::integer end) is not null then 1 else 0 end
       + case when max(case when prev.rn = (cur.rn + 1) then 1 else null::integer end) is not null then 1 else 0 end
       + 1)::numeric)::integer as average
   from numbered cur
     left join numbered prev on prev.rn >= (cur.rn + 1) and prev.rn <= (cur.rn + 3)
  group by cur.report_id, cur.date, cur.total, cur.rn
  order by cur.date desc;

-- 7. Recreate four_week_epga_summary (verbatim original logic)
create view public.four_week_epga_summary
  with (security_invoker = true) as
 with numbered as (
         select pga_report_summary.report_id,
            pga_report_summary.date,
            pga_report_summary.epga_total,
            row_number() over (order by pga_report_summary.date desc) as rn
           from pga_report_summary
        )
 select cur.report_id,
    cur.date,
    max(case when prev.rn = (cur.rn + 3) then prev.epga_total else null::integer end) as wk1_total,
    max(case when prev.rn = (cur.rn + 3) then prev.date else null::date end) as wk1_date,
    max(case when prev.rn = (cur.rn + 2) then prev.epga_total else null::integer end) as wk2_total,
    max(case when prev.rn = (cur.rn + 2) then prev.date else null::date end) as wk2_date,
    max(case when prev.rn = (cur.rn + 1) then prev.epga_total else null::integer end) as wk3_total,
    max(case when prev.rn = (cur.rn + 1) then prev.date else null::date end) as wk3_date,
    cur.epga_total as wk4_total,
    cur.date as wk4_date,
    round((coalesce(max(case when prev.rn = (cur.rn + 3) then prev.epga_total else null::integer end), 0)
         + coalesce(max(case when prev.rn = (cur.rn + 2) then prev.epga_total else null::integer end), 0)
         + coalesce(max(case when prev.rn = (cur.rn + 1) then prev.epga_total else null::integer end), 0)
         + cur.epga_total)::numeric
      / (case when max(case when prev.rn = (cur.rn + 3) then 1 else null::integer end) is not null then 1 else 0 end
       + case when max(case when prev.rn = (cur.rn + 2) then 1 else null::integer end) is not null then 1 else 0 end
       + case when max(case when prev.rn = (cur.rn + 1) then 1 else null::integer end) is not null then 1 else 0 end
       + 1)::numeric)::integer as average
   from numbered cur
     left join numbered prev on prev.rn >= (cur.rn + 1) and prev.rn <= (cur.rn + 3)
  group by cur.report_id, cur.date, cur.epga_total, cur.rn
  order by cur.date desc;

-- 8. Restore grants (match existing anon/authenticated/service_role access)
grant all on public.pga_report_summary     to anon, authenticated, service_role;
grant all on public.four_week_pga_summary   to anon, authenticated, service_role;
grant all on public.four_week_epga_summary  to anon, authenticated, service_role;
