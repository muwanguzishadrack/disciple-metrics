-- CHECK constraints pga_entries_<column>_range
begin;
select plan(9);

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.pga_entries'::regclass and conname like 'pga\_entries\_%\_range' and contype = 'c'),
  19, 'one range constraint per metric column (incl. generated salvations)'
);
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.pga_entries'::regclass and conname like 'pga\_entries\_%\_range' and not convalidated),
  0, 'all range constraints are validated'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$ update pga_entries set sv1 = -1
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'negative value rejected'
);
select throws_ok(
  $$ update pga_entries set sv1 = 10001
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'sv1 above 10000 rejected'
);
select throws_ok(
  $$ update pga_entries set baptisms = 1001
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'baptisms above 1000 rejected'
);
select lives_ok(
  $$ update pga_entries set sv1 = 10000, mca = 20000, mechanics = 10000, salvations_other = 5000
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'values at the upper bound are accepted'
);
select lives_ok(
  $$ update pga_entries set kids = null
     where report_id = 'e0000000-0000-0000-0000-000000000005' and location_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'NULL is still allowed'
);
select throws_ok(
  $$ insert into pga_entries (report_id, location_id, mechanics_training)
     values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 50000) $$,
  '23514', null, 'insert with an extra zero rejected'
);
select throws_like(
  $$ insert into pga_entries (report_id, location_id, mechanics_training)
     values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', -5) $$,
  '%pga_entries_mechanics_training_range%', 'error names the violated constraint'
);

select * from finish();
rollback;
