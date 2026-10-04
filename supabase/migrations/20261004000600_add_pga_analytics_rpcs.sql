-- Analytics RPCs. All SECURITY INVOKER + STABLE: the caller's existing RLS
-- decides which entries/locations/fobs are visible, so a pastor only gets
-- their own location, a FOB leader only their FOB, admins/managers everything.
--
-- Grouping always uses the FROZEN pga_entries.fob_id / region_id snapshot
-- (never the location's current parent). Group display names are looked up
-- under the caller's RLS too; a name can be null when the caller cannot read
-- that fob (e.g. a FOB leader's location that used to belong to another FOB).
--
-- mechanics_training is included: it is still a live column written and shown
-- by the UI (hooks/use-pga.ts, dashboard and reports tables).
--
-- No locks on existing tables (functions only).

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- get_pga_period_totals
-- ---------------------------------------------------------------------------
create or replace function public.get_pga_period_totals(
  p_start date,
  p_end date,
  p_group_by text
)
returns table(
  group_id uuid,
  group_name text,
  fob_name text,
  region_name text,
  report_count integer,
  entry_count integer,
  sv1 bigint,
  sv2 bigint,
  yxp bigint,
  kids bigint,
  local bigint,
  hc1 bigint,
  hc2 bigint,
  mca bigint,
  baptisms bigint,
  salvations bigint,
  salvations_inhouse bigint,
  salvations_livestream_enc bigint,
  salvations_livestream_yxp bigint,
  salvations_mc bigint,
  salvations_other bigint,
  mechanics_get bigint,
  mechanics_worship bigint,
  mechanics_training bigint,
  mechanics bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_group_by is null or p_group_by not in ('location', 'fob', 'region', 'total') then
    raise exception using errcode = '22023',
      message = format('get_pga_period_totals: p_group_by must be location, fob, region or total (got %s)', coalesce(p_group_by, 'null'));
  end if;

  return query
  with e as (
    select
      en.*,
      r.date as report_date,
      case p_group_by
        when 'location' then en.location_id
        when 'fob' then en.fob_id
        when 'region' then en.region_id
      end as gid
    from pga_entries en
    join pga_reports r on r.id = en.report_id
    where r.date between p_start and p_end
  ),
  agg as (
    select
      e.gid,
      -- latest snapshot within the range, for display
      (array_agg(e.fob_id order by e.report_date desc))[1] as last_fob_id,
      (array_agg(e.region_id order by e.report_date desc))[1] as last_region_id,
      count(distinct e.report_id)::integer as report_count,
      count(*)::integer as entry_count,
      coalesce(sum(e.sv1), 0)::bigint as sv1,
      coalesce(sum(e.sv2), 0)::bigint as sv2,
      coalesce(sum(e.yxp), 0)::bigint as yxp,
      coalesce(sum(e.kids), 0)::bigint as kids,
      coalesce(sum(e.local), 0)::bigint as local,
      coalesce(sum(e.hc1), 0)::bigint as hc1,
      coalesce(sum(e.hc2), 0)::bigint as hc2,
      coalesce(sum(e.mca), 0)::bigint as mca,
      coalesce(sum(e.baptisms), 0)::bigint as baptisms,
      coalesce(sum(e.salvations), 0)::bigint as salvations,
      coalesce(sum(e.salvations_inhouse), 0)::bigint as salvations_inhouse,
      coalesce(sum(e.salvations_livestream_enc), 0)::bigint as salvations_livestream_enc,
      coalesce(sum(e.salvations_livestream_yxp), 0)::bigint as salvations_livestream_yxp,
      coalesce(sum(e.salvations_mc), 0)::bigint as salvations_mc,
      coalesce(sum(e.salvations_other), 0)::bigint as salvations_other,
      coalesce(sum(e.mechanics_get), 0)::bigint as mechanics_get,
      coalesce(sum(e.mechanics_worship), 0)::bigint as mechanics_worship,
      coalesce(sum(e.mechanics_training), 0)::bigint as mechanics_training,
      coalesce(sum(e.mechanics), 0)::bigint as mechanics
    from e
    group by e.gid
  )
  select
    a.gid,
    case p_group_by
      when 'location' then lo.name
      when 'fob' then f.name
      when 'region' then coalesce(rg.name, 'No region')
      else 'Total'
    end,
    case when p_group_by in ('location', 'fob') then f.name end,
    case when p_group_by <> 'total' then rg.name end,
    a.report_count, a.entry_count,
    a.sv1, a.sv2, a.yxp, a.kids, a.local, a.hc1, a.hc2, a.mca, a.baptisms,
    a.salvations, a.salvations_inhouse, a.salvations_livestream_enc,
    a.salvations_livestream_yxp, a.salvations_mc, a.salvations_other,
    a.mechanics_get, a.mechanics_worship, a.mechanics_training, a.mechanics
  from agg a
  left join locations lo on p_group_by = 'location' and lo.id = a.gid
  left join fobs f on f.id = a.last_fob_id
  left join regions rg on rg.id = a.last_region_id
  order by 2 nulls last, 1;

  -- 'total' always returns exactly one row, even for an empty range
  if p_group_by = 'total' and not found then
    return query select
      null::uuid, 'Total'::text, null::text, null::text, 0, 0,
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_pga_trend: one row per report date in [p_start, p_end], ascending.
-- Report dates with no matching (visible) entries are returned with zeros.
-- Optional filters use the frozen entry scope.
-- ---------------------------------------------------------------------------
create or replace function public.get_pga_trend(
  p_start date,
  p_end date,
  p_region_id uuid default null,
  p_fob_id uuid default null,
  p_location_id uuid default null
)
returns table(
  report_date date,
  entry_count integer,
  sv1 bigint,
  sv2 bigint,
  yxp bigint,
  kids bigint,
  local bigint,
  hc1 bigint,
  hc2 bigint,
  mca bigint,
  baptisms bigint,
  salvations bigint,
  salvations_inhouse bigint,
  salvations_livestream_enc bigint,
  salvations_livestream_yxp bigint,
  salvations_mc bigint,
  salvations_other bigint,
  mechanics_get bigint,
  mechanics_worship bigint,
  mechanics_training bigint,
  mechanics bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.date,
    count(e.id)::integer,
    coalesce(sum(e.sv1), 0)::bigint,
    coalesce(sum(e.sv2), 0)::bigint,
    coalesce(sum(e.yxp), 0)::bigint,
    coalesce(sum(e.kids), 0)::bigint,
    coalesce(sum(e.local), 0)::bigint,
    coalesce(sum(e.hc1), 0)::bigint,
    coalesce(sum(e.hc2), 0)::bigint,
    coalesce(sum(e.mca), 0)::bigint,
    coalesce(sum(e.baptisms), 0)::bigint,
    coalesce(sum(e.salvations), 0)::bigint,
    coalesce(sum(e.salvations_inhouse), 0)::bigint,
    coalesce(sum(e.salvations_livestream_enc), 0)::bigint,
    coalesce(sum(e.salvations_livestream_yxp), 0)::bigint,
    coalesce(sum(e.salvations_mc), 0)::bigint,
    coalesce(sum(e.salvations_other), 0)::bigint,
    coalesce(sum(e.mechanics_get), 0)::bigint,
    coalesce(sum(e.mechanics_worship), 0)::bigint,
    coalesce(sum(e.mechanics_training), 0)::bigint,
    coalesce(sum(e.mechanics), 0)::bigint
  from pga_reports r
  left join pga_entries e
    on e.report_id = r.id
   and (p_region_id is null or e.region_id = p_region_id)
   and (p_fob_id is null or e.fob_id = p_fob_id)
   and (p_location_id is null or e.location_id = p_location_id)
  where r.date between p_start and p_end
  group by r.date
  order by r.date;
$$;

-- ---------------------------------------------------------------------------
-- get_missing_pga_entries: active (non-archived) locations with no entry in
-- the report for p_report_date (all active locations if no such report).
-- FOB/region here are the location's CURRENT parents (there is no entry to
-- take a snapshot from).
-- ---------------------------------------------------------------------------
create or replace function public.get_missing_pga_entries(p_report_date date)
returns table(
  location_id uuid,
  location_name text,
  fob_id uuid,
  fob_name text,
  region_id uuid,
  region_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.fob_id,
    f.name,
    f.region_id,
    rg.name
  from locations l
  left join fobs f on f.id = l.fob_id
  left join regions rg on rg.id = f.region_id
  where l.archived_at is null
    and not exists (
      select 1
      from pga_entries e
      join pga_reports r on r.id = e.report_id
      where r.date = p_report_date
        and e.location_id = l.id
    )
  order by rg.name nulls last, f.name nulls last, l.name;
$$;

revoke all on function public.get_pga_period_totals(date, date, text) from public, anon;
revoke all on function public.get_pga_trend(date, date, uuid, uuid, uuid) from public, anon;
revoke all on function public.get_missing_pga_entries(date) from public, anon;

grant execute on function public.get_pga_period_totals(date, date, text) to authenticated, service_role;
grant execute on function public.get_pga_trend(date, date, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.get_missing_pga_entries(date) to authenticated, service_role;
