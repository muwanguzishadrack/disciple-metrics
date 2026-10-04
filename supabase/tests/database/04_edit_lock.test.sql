-- Edit lock (default 14 days). Locked reports for any weekday: e..00 (d0-35),
-- e..01 (d0-28), e..02 (d0-21). Never locked: e..04 (d0-7), e..05 (d0).
-- (e..03 = d0-14 is locked except on Sundays, so it is not used here.)
begin;
select plan(28);

-- ---------------------------------------------------------------------------
-- settings + helper functions
-- ---------------------------------------------------------------------------
select is(get_pga_lock_days(), 14, 'default lock is 14 days');
select is(is_pga_report_locked((now() at time zone 'Africa/Nairobi')::date - 14), false, 'exactly N days old: still open');
select is(is_pga_report_locked((now() at time zone 'Africa/Nairobi')::date - 15), true, 'N+1 days old: locked');
select is(is_pga_report_locked((now() at time zone 'Africa/Nairobi')::date), false, 'today: open');

-- set up free slots as postgres (system, bypasses the lock)
delete from pga_entries
where (report_id = 'e0000000-0000-0000-0000-000000000000' and location_id = 'd0000000-0000-0000-0000-000000000002')
   or (report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- FOB leader (Alpha FOB)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_like(
  $$ update pga_entries set sv1 = 1
     where report_id = 'e0000000-0000-0000-0000-000000000000' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'PGA_ENTRY_LOCKED:%', 'leader cannot edit a locked report'
);
select throws_ok(
  $$ update pga_entries set sv1 = 1
     where report_id = 'e0000000-0000-0000-0000-000000000001' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'P0001', null, 'lock error uses SQLSTATE P0001'
);
select throws_like(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 1) $$,
  'PGA_ENTRY_LOCKED:%', 'leader cannot add an entry to a locked report'
);
select lives_ok(
  $$ update pga_entries set sv1 = 1
     where report_id = 'e0000000-0000-0000-0000-000000000004' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'leader can edit a recent report'
);
select lives_ok(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 1) $$,
  'leader can add an entry for a pastor to a recent report'
);
select throws_like(
  $$ update pga_entries set report_id = 'e0000000-0000-0000-0000-000000000002'
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'PGA_ENTRY_LOCKED:%', 'leader cannot move an entry into a locked report'
);

-- ---------------------------------------------------------------------------
-- Pastor (Alpha Central)
-- ---------------------------------------------------------------------------
-- (setup deletes run as postgres with no jwt = system)
reset role;
set local request.jwt.claims to '';
delete from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001';
delete from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000001' and location_id = 'd0000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
with d as (delete from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000004' returning 1)
select is(count(*)::int, 0, 'pastors still cannot delete entries (RLS unchanged)') from d;
select lives_ok(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 5) $$,
  'pastor can submit for the current report'
);
select throws_like(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 5) $$,
  'PGA_ENTRY_LOCKED:%', 'pastor cannot submit for a locked report'
);

-- ---------------------------------------------------------------------------
-- Manager (not admin) is locked too
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_like(
  $$ update pga_entries set sv1 = 2
     where report_id = 'e0000000-0000-0000-0000-000000000000' and location_id = 'd0000000-0000-0000-0000-000000000003' $$,
  'PGA_ENTRY_LOCKED:%', 'manager cannot edit a locked report'
);

-- ---------------------------------------------------------------------------
-- Admin, service role and system bypass
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ update pga_entries set sv1 = 3
     where report_id = 'e0000000-0000-0000-0000-000000000000' and location_id = 'd0000000-0000-0000-0000-000000000003' $$,
  'admin can edit a locked report'
);
select lives_ok(
  $$ insert into pga_entries (report_id, location_id, sv1)
     values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 5) $$,
  'admin can add to a locked report'
);
select lives_ok(
  $$ delete from pga_entries
     where report_id = 'e0000000-0000-0000-0000-000000000000' and location_id = 'd0000000-0000-0000-0000-000000000004' $$,
  'admin can delete from a locked report'
);
select lives_ok(
  $$ delete from pga_reports where id = 'e0000000-0000-0000-0000-000000000000' $$,
  'admin can delete a locked report (cascade)'
);

reset role;
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
select lives_ok(
  $$ update pga_entries set sv1 = 4
     where report_id = 'e0000000-0000-0000-0000-000000000001' and location_id = 'd0000000-0000-0000-0000-000000000003' $$,
  'service role (import script) bypasses the lock'
);
reset role;
set local request.jwt.claims to '';
select lives_ok(
  $$ update pga_entries set sv1 = 5
     where report_id = 'e0000000-0000-0000-0000-000000000001' and location_id = 'd0000000-0000-0000-0000-000000000003' $$,
  'postgres / cron bypasses the lock'
);

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select value from app_settings where key = 'pga_edit_lock_days'), '14'::jsonb, 'authenticated users can read settings');
update app_settings set value = '1000' where key = 'pga_edit_lock_days';
select is(get_pga_lock_days(), 14, 'non-admin update is silently filtered by RLS');
select throws_ok(
  $$ insert into app_settings (key, value) values ('x', '1') $$, '42501', null, 'non-admin cannot insert settings'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update app_settings set value = '60' where key = 'pga_edit_lock_days';
select is(get_pga_lock_days(), 60, 'admin can change the lock window');
select throws_ok(
  $$ update app_settings set value = '"abc"' where key = 'pga_edit_lock_days' $$, '23514', null,
  'lock days must be a positive integer'
);

reset role;
set local role anon;
select throws_ok($$ select * from app_settings $$, '42501', null, 'anon cannot read settings');

-- FK cascade (created_by -> SET NULL) into locked rows while a NON-admin uid is
-- in the session: the nested trigger depth lets it through.
reset role;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select lives_ok(
  $$ delete from auth.users where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'deleting a user cascades into locked entries without tripping the lock'
);
select is(
  (select count(*)::int from pga_entries where created_by is not null), 0,
  'created_by was nulled on all (incl. locked) entries'
);

select * from finish();
rollback;
