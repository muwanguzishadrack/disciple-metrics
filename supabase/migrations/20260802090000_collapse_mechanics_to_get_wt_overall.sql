-- Collapse the mechanics entry to three hand-entered figures: GET, WT and Overall Mechanics.
--
-- The seven-team split (2026-07-26) lasted one report date. It is replaced by two named
-- call-outs (GET, WT) plus an Overall figure that is entered directly and is NOT derived
-- from them: Overall counts everyone serving, GET and WT are simply the two teams worth
-- naming. Nothing in the system computes a mechanics total any more.
--
-- Consequences:
--   * `mechanics` stops being GENERATED and becomes a plain editable column. Its current
--     value is carried over verbatim, so every historical figure is preserved.
--   * `mechanics_legacy` is folded into `mechanics` and dropped -- with Overall entered
--     directly, the legacy bucket IS the overall for pre-split rows, so the "Unspec."
--     column it backed no longer has a reason to exist.
--   * The five retired teams (media, harvest kids, parking & security, facilities, busing)
--     are dropped. Their 1,780 on 2026-07-26 stays inside that date's Overall; only the
--     per-team breakdown for that single date is lost.
--
-- `mechanics_training` is untouched: it was never part of the total.

-- 1. Stage the new plain column and carry over the generated value
alter table public.pga_entries
  add column mechanics_overall integer default 0;

update public.pga_entries
  set mechanics_overall = coalesce(mechanics, 0);

-- 2. Drop dependent views (four-week views read from pga_report_summary)
drop view if exists public.four_week_pga_summary;
drop view if exists public.four_week_epga_summary;
drop view if exists public.pga_report_summary;

-- 3. Swap the generated column out for the plain one
alter table public.pga_entries drop column mechanics;
alter table public.pga_entries rename column mechanics_overall to mechanics;

-- 4. Retire the five teams that are no longer captured, plus the legacy bucket
alter table public.pga_entries
  drop column mechanics_media,
  drop column mechanics_harvest_kids,
  drop column mechanics_parking_security,
  drop column mechanics_facilities,
  drop column mechanics_busing,
  drop column mechanics_legacy;

-- 5. Recreate pga_report_summary (mechanics is now a plain sum of entered figures)
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
    coalesce(sum(e.salvations_livestream_enc), 0::bigint)::integer as salvations_livestream_enc,
    coalesce(sum(e.salvations_livestream_yxp), 0::bigint)::integer as salvations_livestream_yxp,
    coalesce(sum(e.salvations_inhouse), 0::bigint)::integer as salvations_inhouse,
    coalesce(sum(e.salvations_mc), 0::bigint)::integer as salvations_mc,
    coalesce(sum(e.salvations_other), 0::bigint)::integer as salvations_other,
    coalesce(sum(e.baptisms), 0::bigint)::integer as baptisms,
    coalesce(sum(e.mca), 0::bigint)::integer as mca,
    coalesce(sum(e.mechanics), 0::bigint)::integer as mechanics,
    coalesce(sum(e.mechanics_get), 0::bigint)::integer as mechanics_get,
    coalesce(sum(e.mechanics_worship), 0::bigint)::integer as mechanics_worship,
    coalesce(sum(e.mechanics_training), 0::bigint)::integer as mechanics_training,
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
