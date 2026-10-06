-- pga_change_log triggers + updated_by.
-- Users: admin a..01, manager a..02, leader (Alpha FOB) a..03, pastor (Alpha Central) a..04
-- Locations: Alpha Central d..01, Alpha North d..02 (both Alpha FOB)
-- Reports: e..04 = d0-7, e..05 = d0 (Alpha North has no entry in e..05)
begin;
select plan(24);

-- ---------------------------------------------------------------------------
-- INSERT by the FOB leader
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select lives_ok(
  $$ insert into pga_entries (id, report_id, location_id, sv1, created_by)
     values ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005',
             'd0000000-0000-0000-0000-000000000002', 11, 'a0000000-0000-0000-0000-000000000003') $$,
  'leader can insert an entry'
);

reset role;
select is(
  (select updated_by from pga_entries where id = 'f0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000003'::uuid, 'updated_by set on insert'
);

select results_eq(
  $$ select operation, changed_by, report_date, location_id, report_id, (new_data->>'sv1')::int, old_data is null
     from pga_change_log where table_name = 'pga_entries' and row_id = 'f0000000-0000-0000-0000-000000000001' $$,
  $$ values ('INSERT'::text, 'a0000000-0000-0000-0000-000000000003'::uuid,
             (select date from pga_reports where id = 'e0000000-0000-0000-0000-000000000005'),
             'd0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid, 11, true) $$,
  'INSERT logged with who/when/where'
);

-- ---------------------------------------------------------------------------
-- UPDATE by the FOB leader
-- ---------------------------------------------------------------------------
set local role authenticated;
select lives_ok(
  $$ update pga_entries set sv1 = 12, updated_at = now() where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'leader can update'
);
reset role;

select results_eq(
  $$ select operation, (old_data->>'sv1')::int, (new_data->>'sv1')::int, changed_by
     from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000001' and operation = 'UPDATE' $$,
  $$ values ('UPDATE'::text, 11, 12, 'a0000000-0000-0000-0000-000000000003'::uuid) $$,
  'UPDATE logged with old and new values'
);

-- ---------------------------------------------------------------------------
-- updated_by: a different user edits, then the system (auth.uid() null) edits
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update pga_entries set sv2 = 3 where id = 'f0000000-0000-0000-0000-000000000001';
reset role;
select is(
  (select updated_by from pga_entries where id = 'f0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000002'::uuid, 'updated_by follows the last editor (manager)'
);

set local request.jwt.claims to '';
update pga_entries set sv2 = 4 where id = 'f0000000-0000-0000-0000-000000000001';
select is(
  (select updated_by from pga_entries where id = 'f0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000002'::uuid, 'updated_by untouched when auth.uid() is null'
);
select is(
  (select changed_by from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000001' order by id desc limit 1),
  null::uuid, 'system change logged with changed_by null'
);

-- no-op update is not logged
select is(
  (select count(*)::int from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000001'),
  4, 'insert + 3 updates logged so far'
);
update pga_entries set sv2 = sv2 where id = 'f0000000-0000-0000-0000-000000000001' and false;
select is(
  (select count(*)::int from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000001'),
  4, 'statements touching no rows log nothing'
);

-- pga_reports: insert + updated_by
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into pga_reports (id, date, created_by)
values ('e1000000-0000-0000-0000-000000000001', '2030-01-06', 'a0000000-0000-0000-0000-000000000004');
reset role;
select is(
  (select updated_by from pga_reports where id = 'e1000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000004'::uuid, 'pga_reports.updated_by set on insert'
);
select results_eq(
  $$ select operation, report_id, report_date, location_id from pga_change_log
     where table_name = 'pga_reports' and row_id = 'e1000000-0000-0000-0000-000000000001' $$,
  $$ values ('INSERT'::text, 'e1000000-0000-0000-0000-000000000001'::uuid, '2030-01-06'::date, null::uuid) $$,
  'report INSERT logged'
);

-- ---------------------------------------------------------------------------
-- DELETE by admin
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ delete from pga_entries where id = 'f0000000-0000-0000-0000-000000000001' $$, 'admin deletes an entry'
);
reset role;
select results_eq(
  $$ select operation, changed_by, (old_data->>'id')::uuid, (old_data->>'sv1')::int, (old_data->>'salvations') is not null, new_data is null
     from pga_change_log where row_id = 'f0000000-0000-0000-0000-000000000001' and operation = 'DELETE' $$,
  $$ values ('DELETE'::text, 'a0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000001'::uuid, 12, true, true) $$,
  'DELETE logged with the full old row'
);

-- ---------------------------------------------------------------------------
-- Cascade: admin deletes report e..04 (5 entries)
-- ---------------------------------------------------------------------------
set local role authenticated;
select lives_ok(
  $$ delete from pga_reports where id = 'e0000000-0000-0000-0000-000000000004' $$, 'admin deletes a report'
);
reset role;
select is(
  (select count(*)::int from pga_change_log where table_name = 'pga_entries' and operation = 'DELETE'
     and report_id = 'e0000000-0000-0000-0000-000000000004'),
  5, 'every cascaded entry delete is logged'
);
select is(
  (select count(distinct changed_at)::int from pga_change_log
    where operation = 'DELETE' and report_id = 'e0000000-0000-0000-0000-000000000004'),
  1, 'report and cascaded entries share changed_at'
);
select is(
  (select count(*)::int from pga_change_log where operation = 'DELETE' and report_id = 'e0000000-0000-0000-0000-000000000004'
     and report_date is distinct from (old_data->>'date')::date and table_name = 'pga_reports'),
  0, 'report DELETE has its date'
);
select is(
  (select count(*)::int from pga_change_log where table_name = 'pga_entries' and operation = 'DELETE'
     and report_id = 'e0000000-0000-0000-0000-000000000004' and report_date is null),
  0, 'cascaded entry deletes have report_date back-filled'
);

-- ---------------------------------------------------------------------------
-- RLS / append-only
-- ---------------------------------------------------------------------------
set local role authenticated;
select ok((select count(*) from pga_change_log) > 0, 'admin can read the change log');

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from pga_change_log), 0, 'manager cannot read the change log');

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into pga_change_log (table_name, row_id, operation) values ('pga_entries', gen_random_uuid(), 'INSERT') $$,
  '42501', null, 'even admins cannot write the log directly'
);
select throws_ok(
  $$ truncate pga_change_log $$, '42501', null, 'authenticated cannot truncate the log'
);
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from pga_change_log $$, '42501', null, 'anon has no access to the log'
);

select * from finish();
rollback;
