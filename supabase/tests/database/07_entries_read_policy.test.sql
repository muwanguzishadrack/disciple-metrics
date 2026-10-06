-- The set-based pga_entries SELECT policy (20261007000100) must show each
-- user exactly the rows can_access_location() allows.
begin;
select plan(9);

-- expected rows per seed user, computed as postgres (no RLS) with the old rule
create temp table t_expected on commit drop as
select u.id as user_id, e.id as entry_id
from auth.users u
cross join pga_entries e
where public.can_access_location(u.id, e.location_id);
grant select on t_expected to authenticated, anon;

select is(
  (select count(*)::int from t_expected where user_id = 'a0000000-0000-0000-0000-000000000001'),
  (select count(*)::int from pga_entries),
  'sanity: admin may see every entry'
);

set local role authenticated;

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select set_eq(
  $$ select id from pga_entries $$,
  $$ select entry_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'admin sees the same entries as can_access_location'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select set_eq(
  $$ select id from pga_entries $$,
  $$ select entry_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'manager sees the same entries as can_access_location'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select set_eq(
  $$ select id from pga_entries $$,
  $$ select entry_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000003' $$,
  'fob_leader sees the same entries as can_access_location'
);
select ok(
  (select count(*) from pga_entries) < (select count(*) from t_expected where user_id = 'a0000000-0000-0000-0000-000000000001'),
  'fob_leader does not see everything'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select set_eq(
  $$ select id from pga_entries $$,
  $$ select entry_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000004' $$,
  'pastor sees the same entries as can_access_location'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select set_eq(
  $$ select id from pga_entries $$,
  $$ select entry_id from t_expected where user_id = 'a0000000-0000-0000-0000-000000000005' $$,
  'second pastor sees the same entries as can_access_location'
);

-- a signed-in user with no assignment sees nothing
set local request.jwt.claims to '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';
select is((select count(*)::int from pga_entries), 0, 'user without an assignment sees no entries');

-- anon cannot call the helper
reset role;
set local role anon;
select throws_ok(
  $$ select public.accessible_location_ids() $$,
  '42501', null, 'anon cannot execute accessible_location_ids()'
);

select * from finish();
rollback;
