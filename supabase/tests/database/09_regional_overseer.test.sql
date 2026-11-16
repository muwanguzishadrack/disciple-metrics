-- Regional overseer (20261116000000): FOB-leader access across one region.
-- Seed: overseer@test.local (a..06) is assigned to Eastern (b..01), which holds
-- Alpha FOB (Alpha Central d..01, Alpha North d..02) and Bravo FOB (Bravo East
-- d..03, Moved Site d..06). Western holds Charlie FOB (Charlie West d..04,
-- archived Old Site d..05). Lock: e..00-02 locked, e..04/e..05 open.
begin;
select plan(24);

select is(
  (select description from roles where name = 'regional_overseer'),
  'Access to all FOBs and locations within their assigned region',
  'regional_overseer role exists'
);
select is(get_user_role('a0000000-0000-0000-0000-000000000006'), 'regional_overseer', 'seed overseer has the role');
select is(get_user_region_id('a0000000-0000-0000-0000-000000000006'), 'b0000000-0000-0000-0000-000000000001'::uuid,
          'get_user_region_id returns the assigned region');
select ok(is_regional_overseer('a0000000-0000-0000-0000-000000000006'), 'is_regional_overseer true for overseer');
select ok(not is_regional_overseer('a0000000-0000-0000-0000-000000000003'), 'is_regional_overseer false for fob_leader');

-- one scope per assignment
select throws_ok(
  $$ update user_assignments set fob_id = 'c0000000-0000-0000-0000-000000000001'
     where user_id = 'a0000000-0000-0000-0000-000000000006' $$,
  '23514', null, 'an assignment cannot have both a region and a FOB'
);

-- can_access_location and accessible_location_ids agree for every seed user
create temp table t_expected on commit drop as
select u.id as user_id, l.id as location_id
from auth.users u cross join locations l
where public.can_access_location(u.id, l.id);
grant select on t_expected to authenticated;

select set_eq(
  $$ select location_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000006' $$,
  $$ values ('d0000000-0000-0000-0000-000000000001'::uuid), ('d0000000-0000-0000-0000-000000000002'::uuid),
            ('d0000000-0000-0000-0000-000000000003'::uuid), ('d0000000-0000-0000-0000-000000000006'::uuid) $$,
  'can_access_location: overseer reaches exactly the Eastern locations'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';

select set_eq(
  $$ select accessible_location_ids() $$,
  $$ select location_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000006' $$,
  'accessible_location_ids matches can_access_location for the overseer'
);
select set_eq(
  $$ select id from locations $$,
  $$ select location_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000006' $$,
  'overseer reads the Eastern locations only'
);
select set_eq(
  $$ select name from fobs $$,
  $$ values ('Alpha FOB'), ('Bravo FOB') $$,
  'overseer reads the Eastern FOBs only'
);
select set_eq(
  $$ select distinct location_id from pga_entries $$,
  $$ select location_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000006' $$,
  'overseer reads entries for the Eastern locations only'
);
select set_eq(
  $$ select location_name from get_missing_pga_entries((select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000005')) $$,
  $$ values ('Alpha North') $$,
  'missing entries are scoped to the region (Charlie West is not listed)'
);

-- writes inside the region
select lives_ok(
  $$ update pga_entries set sv1 = 1
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000003' $$,
  'overseer can edit a recent entry in another FOB of the region'
);
select is(
  (select sv1 from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000003'),
  1, 'the edit was applied'
);
select lives_ok(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 4) $$,
  'overseer can add a missing entry in the region'
);
select throws_like(
  $$ update pga_entries set sv1 = 1
     where report_id = 'e0000000-0000-0000-0000-000000000000' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'PGA_ENTRY_LOCKED:%', 'overseer cannot edit a locked report'
);

-- nothing outside the region, no deletes, no location/team admin
select throws_ok(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 1) $$,
  '42501', null, 'overseer cannot add an entry outside the region'
);
select is_empty(
  $$ update pga_entries set sv1 = 1 where location_id = 'd0000000-0000-0000-0000-000000000004' returning id $$,
  'overseer cannot update entries outside the region'
);
select is_empty(
  $$ delete from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000005' returning id $$,
  'overseer cannot delete entries'
);
select is_empty(
  $$ delete from pga_reports returning id $$,
  'overseer cannot delete reports'
);
select is_empty(
  $$ update locations set archived_at = now() returning id $$,
  'overseer cannot archive or edit locations'
);
select is(
  (select count(*)::int from user_assignments), 1,
  'overseer reads only their own assignment'
);
select is_empty($$ select id from user_invitations $$, 'overseer cannot read invitations');

-- the fob_leader's scope is unchanged
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select set_eq(
  $$ select name from fobs $$,
  $$ values ('Alpha FOB') $$,
  'fob_leader still reads only their FOB'
);

select * from finish();
rollback;
