-- =============================================================================
-- LOCAL DEVELOPMENT / TEST SEED (applied by `supabase db reset`, never on prod)
-- =============================================================================
-- Small, deterministic data set used by supabase/tests. Report dates are
-- relative to "today" in Africa/Nairobi so the edit-lock tests stay valid:
--   d0 = most recent Sunday (<= today), reports on d0-35, -28, -21, -14, -7, d0.
--
-- Test users (local stack only; password for all of them: password123):
--   admin@test.local    admin
--   manager@test.local  manager
--   leader@test.local   fob_leader  (Alpha FOB)
--   pastor@test.local   pastor      (Alpha Central)
--   pastor2@test.local  pastor      (Bravo East)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Auth users (handle_new_user creates the profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'admin@test.local'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'manager@test.local'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'leader@test.local'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'pastor@test.local'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'pastor2@test.local')
) as u(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@test.local';

-- ---------------------------------------------------------------------------
-- Org structure
-- ---------------------------------------------------------------------------
insert into public.regions (id, name) values
  ('b0000000-0000-0000-0000-000000000001', 'Eastern'),
  ('b0000000-0000-0000-0000-000000000002', 'Western');

insert into public.fobs (id, name, region_id, archived_at) values
  ('c0000000-0000-0000-0000-000000000001', 'Alpha FOB',   'b0000000-0000-0000-0000-000000000001', null),
  ('c0000000-0000-0000-0000-000000000002', 'Bravo FOB',   'b0000000-0000-0000-0000-000000000001', null),
  ('c0000000-0000-0000-0000-000000000003', 'Charlie FOB', 'b0000000-0000-0000-0000-000000000002', null),
  ('c0000000-0000-0000-0000-000000000004', 'Retired FOB', 'b0000000-0000-0000-0000-000000000002', now());

insert into public.locations (id, fob_id, name, pastor, archived_at) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Alpha Central', 'Pastor A', null),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Alpha North',   'Pastor B', null),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'Bravo East',    'Pastor C', null),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'Charlie West',  'Pastor D', null),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', 'Old Site',      'Pastor E', now()),
  -- Moved Site: belongs to Bravo FOB now, but its older entries are frozen to Alpha FOB
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Moved Site',    'Pastor F', null);

insert into public.user_assignments (user_id, role_id, fob_id, location_id)
select u.id, r.id, u.fob_id, u.location_id
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'admin',      null::uuid, null::uuid),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'manager',    null, null),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'fob_leader', 'c0000000-0000-0000-0000-000000000001'::uuid, null),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'pastor',     null, 'd0000000-0000-0000-0000-000000000001'::uuid),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'pastor',     null, 'd0000000-0000-0000-0000-000000000003'::uuid)
) as u(id, role_name, fob_id, location_id)
join public.roles r on r.name = u.role_name;

-- ---------------------------------------------------------------------------
-- Reports and entries
--   report k = 0..5 (0 = oldest, d0-35; 5 = newest, d0); report ids e0..0k
--   entry metrics for (report k, location n): sv1 = 100*n + k, others derived
-- ---------------------------------------------------------------------------
with d as (
  select ((now() at time zone 'Africa/Nairobi')::date
          - extract(dow from (now() at time zone 'Africa/Nairobi')::date)::int) as d0
)
insert into public.pga_reports (id, date, created_by)
select ('e0000000-0000-0000-0000-00000000000' || k)::uuid,
       d.d0 - (5 - k) * 7,
       'a0000000-0000-0000-0000-000000000001'
from d, generate_series(0, 5) k;

insert into public.pga_entries (
  report_id, location_id, created_by,
  sv1, sv2, yxp, kids, local, hc1, hc2, mca, baptisms,
  salvations_inhouse, salvations_livestream_enc, salvations_livestream_yxp, salvations_mc, salvations_other,
  mechanics_get, mechanics_worship, mechanics_training, mechanics
)
select
  ('e0000000-0000-0000-0000-00000000000' || k)::uuid,
  ('d0000000-0000-0000-0000-00000000000' || n)::uuid,
  'a0000000-0000-0000-0000-000000000001',
  100 * n + k, 50 * n + k, 20 * n + k, 30 * n + k, 5 * n + k, 3 * n + k, n + k, 200 * n + k, k,
  n, 1, 0, k, 2,
  n, 2 * n, 3 * n, 10 * n
from generate_series(0, 5) k
cross join (values (1), (2), (3), (4), (6)) as loc(n)
-- the newest report (d0) is still being filled: Alpha North (2) and Charlie West (4) are missing
where not (k = 5 and n in (2, 4));

-- Old Site (archived) only reported in the oldest report
insert into public.pga_entries (report_id, location_id, created_by, sv1, sv2, yxp)
values ('e0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000001', 7, 7, 7);

-- Freeze history: Moved Site's entries in reports 0..2 were filed under Alpha FOB
-- (an UPDATE of fob_id does not re-stamp; only location_id changes do).
update public.pga_entries
   set fob_id = 'c0000000-0000-0000-0000-000000000001',
       region_id = 'b0000000-0000-0000-0000-000000000001'
 where location_id = 'd0000000-0000-0000-0000-000000000006'
   and report_id in ('e0000000-0000-0000-0000-000000000000',
                     'e0000000-0000-0000-0000-000000000001',
                     'e0000000-0000-0000-0000-000000000002');

-- Start every reset with an empty history
truncate public.pga_change_log restart identity;
