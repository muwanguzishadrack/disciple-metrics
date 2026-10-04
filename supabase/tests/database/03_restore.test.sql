-- Recoverable deletes: restore_pga_entry / restore_pga_report and the listing RPCs.
-- Moved Site (d..06) is in Bravo FOB now, but its entries in reports e..00..e..02
-- are frozen to Alpha FOB (c..01) / Eastern (b..01).
begin;
select plan(36);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Single entry: Moved Site in report e..01 (frozen to Alpha FOB)
-- ---------------------------------------------------------------------------
create temp table t_orig on commit drop as
select * from pga_entries
where report_id = 'e0000000-0000-0000-0000-000000000001' and location_id = 'd0000000-0000-0000-0000-000000000006';

select is((select fob_id from t_orig), 'c0000000-0000-0000-0000-000000000001'::uuid, 'precondition: frozen to Alpha FOB');

delete from pga_entries where id = (select id from t_orig);

select is(
  (select count(*)::int from get_deleted_pga_entries() where entry_id = (select id from t_orig)),
  1, 'deleted entry is listed'
);
select is(
  (select report_exists from get_deleted_pga_entries() where entry_id = (select id from t_orig)),
  true, 'report_exists = true'
);
select is(
  (select location_name from get_deleted_pga_entries() where entry_id = (select id from t_orig)),
  'Moved Site', 'location_name resolved'
);
select is(
  (select deleted_by_name from get_deleted_pga_entries() where entry_id = (select id from t_orig)),
  'admin@test.local', 'deleted_by_name resolved'
);

-- non-admins are refused
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select restore_pga_entry((select max(id) from pga_change_log)) $$,
  '42501', null, 'manager cannot restore an entry'
);
select throws_ok($$ select restore_pga_report(gen_random_uuid()) $$, '42501', null, 'manager cannot restore a report');
select throws_ok($$ select * from get_deleted_pga_entries() $$, '42501', null, 'manager cannot list deleted entries');
select throws_ok($$ select * from get_deleted_pga_reports() $$, '42501', null, 'manager cannot list deleted reports');
select throws_ok($$ select * from get_pga_change_log() $$, '42501', null, 'manager cannot read the change log RPC');
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$ select * from get_pga_change_log() $$, '42501', null, 'pastor cannot read the change log RPC');
reset role;
set local role anon;
select throws_ok($$ select * from get_pga_change_log() $$, '42501', null, 'anon cannot execute the change log RPC');
reset role;

-- admin restores
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  restore_pga_entry((select log_id from get_deleted_pga_entries() where entry_id = (select id from t_orig))),
  (select id from t_orig), 'restore_pga_entry returns the original id'
);

select results_eq(
  $$ select id, report_id, location_id, fob_id, region_id, created_by, created_at, sv1, salvations, mechanics_training
     from pga_entries where id = (select id from t_orig) $$,
  $$ select id, report_id, location_id, fob_id, region_id, created_by, created_at, sv1, salvations, mechanics_training
     from t_orig $$,
  'restored row matches the original, incl. frozen fob/region snapshot'
);

select is(
  (select operation from pga_change_log where row_id = (select id from t_orig) order by id desc limit 1),
  'RESTORE', 'restore is logged as RESTORE'
);
select is(
  (select count(*)::int from get_deleted_pga_entries() where entry_id = (select id from t_orig)),
  0, 'restored entry is no longer listed as deleted'
);
select throws_like(
  $$ select restore_pga_entry((select max(id) from pga_change_log where row_id = (select id from t_orig) and operation = 'DELETE')) $$,
  'PGA_RESTORE_ALREADY_EXISTS%', 'cannot restore twice'
);
select throws_like(
  $$ select restore_pga_entry((select max(id) from pga_change_log where operation = 'RESTORE')) $$,
  'PGA_RESTORE_NOT_FOUND%', 'non-DELETE log rows are rejected'
);

-- normal inserts are still stamped from the CURRENT parent (unchanged behaviour)
insert into pga_entries (id, report_id, location_id, sv1)
values ('f0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 1);
delete from pga_entries where id = 'f0000000-0000-0000-0000-000000000009';
select is(
  (select (old_data->>'fob_id')::uuid from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000009' and operation = 'DELETE'),
  'c0000000-0000-0000-0000-000000000001'::uuid, 'normal insert still stamps fob_id from the location'
);

-- slot taken
insert into pga_entries (report_id, location_id, sv1)
values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 2);
select throws_like(
  $$ select restore_pga_entry((select id from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000009' and operation = 'DELETE')) $$,
  'PGA_RESTORE_SLOT_TAKEN%', 'restore refuses an occupied (report, location) slot'
);

-- ---------------------------------------------------------------------------
-- Whole report: e..02 (d0-21). First delete Charlie West individually, then the report.
-- ---------------------------------------------------------------------------
create temp table t_rep_entries on commit drop as
select * from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000002';

delete from pga_entries
where report_id = 'e0000000-0000-0000-0000-000000000002' and location_id = 'd0000000-0000-0000-0000-000000000004';
delete from pga_reports where id = 'e0000000-0000-0000-0000-000000000002';

select results_eq(
  $$ select report_id, report_date, deleted_by, deleted_by_name, entry_count from get_deleted_pga_reports() $$,
  $$ values ('e0000000-0000-0000-0000-000000000002'::uuid,
             (select (old_data->>'date')::date from pga_change_log where table_name = 'pga_reports' and operation = 'DELETE'),
             'a0000000-0000-0000-0000-000000000001'::uuid, 'admin@test.local', 4) $$,
  'deleted report listed with the 4 entries deleted with it'
);
select is(
  (select count(*)::int from get_deleted_pga_entries() where report_id = 'e0000000-0000-0000-0000-000000000002'),
  1, 'cascaded entries are NOT listed individually; the earlier single delete is'
);
select is(
  (select report_exists from get_deleted_pga_entries() where report_id = 'e0000000-0000-0000-0000-000000000002'),
  false, 'individually deleted entry shows report_exists = false'
);
select throws_like(
  $$ select restore_pga_entry((select log_id from get_deleted_pga_entries() where report_id = 'e0000000-0000-0000-0000-000000000002')) $$,
  'PGA_RESTORE_REPORT_MISSING%', 'entry restore asks to restore the report first'
);

select is(restore_pga_report('e0000000-0000-0000-0000-000000000002'), 4, 'restore_pga_report restores 4 entries');
select is(
  (select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000002'),
  (select (old_data->>'date')::date from pga_change_log where table_name = 'pga_reports' and operation = 'DELETE'),
  'report restored with its original id and date'
);
select results_eq(
  $$ select id, location_id, fob_id, region_id, created_at, sv1 from pga_entries
     where report_id = 'e0000000-0000-0000-0000-000000000002' order by id $$,
  $$ select id, location_id, fob_id, region_id, created_at, sv1 from t_rep_entries
     where location_id <> 'd0000000-0000-0000-0000-000000000004' order by id $$,
  'entries restored with original ids and frozen scope'
);
select is(
  (select count(*)::int from pga_change_log where operation = 'RESTORE' and report_id = 'e0000000-0000-0000-0000-000000000002'),
  5, 'report + 4 entries logged as RESTORE'
);
select is((select count(*)::int from get_deleted_pga_reports()), 0, 'restored report no longer listed');
select is(
  (select report_exists from get_deleted_pga_entries() where report_id = 'e0000000-0000-0000-0000-000000000002'),
  true, 'the individually deleted entry is now restorable'
);
select lives_ok(
  $$ select restore_pga_entry((select log_id from get_deleted_pga_entries() where report_id = 'e0000000-0000-0000-0000-000000000002')) $$,
  'restore the individually deleted entry afterwards'
);
select is(
  (select count(*)::int from pga_entries where report_id = 'e0000000-0000-0000-0000-000000000002'), 5, 'report complete again'
);
select throws_like(
  $$ select restore_pga_report('e0000000-0000-0000-0000-000000000002') $$,
  'PGA_RESTORE_ALREADY_EXISTS%', 'cannot restore an existing report'
);

-- date taken by a new report
delete from pga_reports where id = 'e0000000-0000-0000-0000-000000000001';
insert into pga_reports (date) select (old_data->>'date')::date from pga_change_log
  where table_name = 'pga_reports' and row_id = 'e0000000-0000-0000-0000-000000000001' and operation = 'DELETE';
select throws_like(
  $$ select restore_pga_report('e0000000-0000-0000-0000-000000000001') $$,
  'PGA_RESTORE_DATE_TAKEN%', 'restore refuses when another report has the date'
);

-- change log RPC
select ok(
  (select count(*) from get_pga_change_log(p_limit => 5)) = 5
  and (select total_count from get_pga_change_log(p_limit => 5) limit 1) = (select count(*) from pga_change_log),
  'get_pga_change_log pages and reports total_count'
);
select is(
  (select count(*)::int from get_pga_change_log(p_location_id => 'd0000000-0000-0000-0000-000000000006', p_limit => 1000)),
  (select count(*)::int from pga_change_log where location_id = 'd0000000-0000-0000-0000-000000000006'),
  'get_pga_change_log filters by location'
);

select * from finish();
rollback;
