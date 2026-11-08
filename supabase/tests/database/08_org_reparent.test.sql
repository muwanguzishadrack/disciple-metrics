-- Re-parenting (as done by 20261108000000): a FOB moves to a new region and a
-- location moves to a new FOB. Existing entries keep their frozen fob/region
-- snapshot; entries filed afterwards are stamped with the new scope.
-- Seed: Alpha FOB (Eastern) holds Alpha Central (d..01) and Alpha North (d..02);
-- Alpha North has no entry in the newest report (e..05).
begin;
select plan(7);

create temp table t_before on commit drop as
select id, fob_id, region_id, updated_at from pga_entries;

insert into regions (id, name) values ('b0000000-0000-0000-0000-0000000000aa', 'Northern Test');
insert into fobs (id, name, region_id)
values ('c0000000-0000-0000-0000-0000000000aa', 'Kibibi Test', 'b0000000-0000-0000-0000-000000000001');

update fobs set region_id = 'b0000000-0000-0000-0000-0000000000aa'
where id = 'c0000000-0000-0000-0000-000000000001';
update locations set fob_id = 'c0000000-0000-0000-0000-0000000000aa'
where id = 'd0000000-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from pga_entries e join t_before b using (id)
   where (e.fob_id, e.region_id, e.updated_at) is distinct from (b.fob_id, b.region_id, b.updated_at)),
  0, 'no existing entry changes when FOBs and locations are re-parented'
);
select is(
  (select count(*)::int from pga_entries
   where location_id = 'd0000000-0000-0000-0000-000000000002'
     and fob_id = 'c0000000-0000-0000-0000-000000000001'
     and region_id = 'b0000000-0000-0000-0000-000000000001'),
  5, 'moved location keeps its 5 past entries under Alpha FOB / Eastern'
);

insert into pga_entries (report_id, location_id, sv1)
values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 1);

select results_eq(
  $$ select fob_id, region_id from pga_entries
     where report_id = 'e0000000-0000-0000-0000-000000000005'
       and location_id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ values ('c0000000-0000-0000-0000-0000000000aa'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid) $$,
  'new entry for the moved location is stamped with the new FOB and its region'
);

insert into pga_entries (report_id, location_id, sv1)
values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 1);
select is(
  (select region_id from pga_entries
   where report_id = 'e0000000-0000-0000-0000-000000000005'
     and location_id = 'd0000000-0000-0000-0000-000000000004'),
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'unaffected FOBs keep stamping their own region'
);

-- Re-stamp step for the cutover report (same statement shape as the migration)
update pga_entries e
set fob_id = l.fob_id, region_id = f.region_id
from locations l join fobs f on f.id = l.fob_id, pga_reports r
where l.id = e.location_id and r.id = e.report_id
  and r.id = 'e0000000-0000-0000-0000-000000000005'
  and (e.fob_id, e.region_id) is distinct from (l.fob_id, f.region_id);

select is(
  (select region_id from pga_entries
   where report_id = 'e0000000-0000-0000-0000-000000000005'
     and location_id = 'd0000000-0000-0000-0000-000000000001'),
  'b0000000-0000-0000-0000-0000000000aa'::uuid,
  're-stamp moves cutover-report entries of a re-parented FOB to the new region'
);
select is(
  (select count(*)::int from pga_entries e join t_before b using (id)
   join pga_reports r on r.id = e.report_id
   where r.id <> 'e0000000-0000-0000-0000-000000000005'
     and (e.fob_id, e.region_id, e.updated_at) is distinct from (b.fob_id, b.region_id, b.updated_at)),
  0, 're-stamp leaves earlier reports untouched'
);

-- Region totals still add up to the grand total (nothing dropped or doubled)
select is(
  (select sum(sv1)::bigint from get_pga_period_totals(
     (select min(date) from pga_reports), (select max(date) from pga_reports), 'region')),
  (select sum(sv1)::bigint from pga_entries),
  'region rows add up to the total after re-parenting'
);

select * from finish();
rollback;
