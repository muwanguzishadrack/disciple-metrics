-- FOB split and location closure (as done by 20261122000000): a new FOB takes
-- over some locations of an existing FOB in the same region, and one location
-- is archived. Existing entries keep their frozen snapshot; entries filed
-- afterwards are stamped with the new FOB.
-- Seed: Alpha FOB (Eastern) holds Alpha Central (d..01) and Alpha North (d..02);
-- Alpha North has no entry in the newest report (e..05).
begin;
select plan(6);

create temp table t_before on commit drop as
select id, fob_id, region_id, updated_at from pga_entries;

insert into fobs (id, name, region_id)
values ('c0000000-0000-0000-0000-0000000000bb', 'Downtown Test', 'b0000000-0000-0000-0000-000000000001');

update locations set fob_id = 'c0000000-0000-0000-0000-0000000000bb'
where id = 'd0000000-0000-0000-0000-000000000002';
update locations set archived_at = now()
where id = 'd0000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from pga_entries e join t_before b using (id)
   where (e.fob_id, e.region_id, e.updated_at) is distinct from (b.fob_id, b.region_id, b.updated_at)),
  0, 'splitting a FOB and archiving a location changes no existing entry'
);
select is(
  (select count(*)::int from pga_entries
   where location_id = 'd0000000-0000-0000-0000-000000000002'
     and fob_id = 'c0000000-0000-0000-0000-000000000001'),
  5, 'moved location keeps its past entries under the original FOB'
);
select is(
  (select count(*)::int from pga_entries
   where location_id = 'd0000000-0000-0000-0000-000000000001'),
  (select count(*)::int from t_before b join pga_entries e using (id)
   where e.location_id = 'd0000000-0000-0000-0000-000000000001'),
  'archived location keeps all its history'
);

insert into pga_entries (report_id, location_id, sv1)
values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 1);
select results_eq(
  $$ select fob_id, region_id from pga_entries
     where report_id = 'e0000000-0000-0000-0000-000000000005'
       and location_id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ values ('c0000000-0000-0000-0000-0000000000bb'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid) $$,
  'new entry for the moved location is stamped with the new FOB, same region'
);

-- Re-stamp step for the cutover report (same statement shape as the migration)
update pga_entries e
set fob_id = l.fob_id, region_id = f.region_id
from locations l join fobs f on f.id = l.fob_id, pga_reports r
where l.id = e.location_id and r.id = e.report_id
  and r.id = 'e0000000-0000-0000-0000-000000000005'
  and (e.fob_id, e.region_id) is distinct from (l.fob_id, f.region_id);

select is(
  (select count(*)::int from pga_entries e join t_before b using (id)
   join pga_reports r on r.id = e.report_id
   where r.id <> 'e0000000-0000-0000-0000-000000000005'
     and (e.fob_id, e.region_id, e.updated_at) is distinct from (b.fob_id, b.region_id, b.updated_at)),
  0, 're-stamp leaves earlier reports untouched'
);
select is(
  (select sum(sv1)::bigint from get_pga_period_totals(
     (select min(date) from pga_reports), (select max(date) from pga_reports), 'region')),
  (select sum(sv1)::bigint from pga_entries),
  'region rows add up to the total after the split'
);

select * from finish();
rollback;
