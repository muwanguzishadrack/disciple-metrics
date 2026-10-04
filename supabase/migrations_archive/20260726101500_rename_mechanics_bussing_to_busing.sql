-- Correct the spelling of the Bussing mechanics team to "Busing".
--
-- Renaming the column rewrites the `mechanics` generated expression automatically,
-- but pga_report_summary aliases the column explicitly, so the three views have to
-- be dropped and recreated to pick up the new output name.
-- No data is affected: mechanics_bussing is 0 on every row at the time of this rename.

alter table public.pga_entries rename column mechanics_bussing to mechanics_busing;

drop view if exists public.four_week_pga_summary;
drop view if exists public.four_week_epga_summary;
drop view if exists public.pga_report_summary;

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
    coalesce(sum(e.mechanics_busing), 0::bigint)::integer as mechanics_busing,
    coalesce(sum(e.mechanics_legacy), 0::bigint)::integer as mechanics_legacy,
    coalesce(sum(e.sv1 + e.sv2 + e.yxp), 0::bigint)::integer as epga_total
   from pga_reports r
     left join pga_entries e on e.report_id = r.id
  group by r.id, r.date, r.created_at;

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

grant all on public.pga_report_summary     to anon, authenticated, service_role;
grant all on public.four_week_pga_summary   to anon, authenticated, service_role;
grant all on public.four_week_epga_summary  to anon, authenticated, service_role;
