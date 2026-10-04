-- Data-quality CHECK constraints on pga_entries metrics.
--
-- Every metric must be >= 0 (NULL still allowed) and below a generous upper
-- bound, meant to catch typos (an extra zero or two), not to judge real values.
-- Bounds derived from production on 2026-10-04 (8,772 entries, 0 negatives):
--
--   column                     max   p99   p99.9  bound
--   sv1                       1639   278   1390   10000
--   sv2                        423   112    179    5000
--   yxp                        604   147    474    5000
--   kids                       742   176    677    5000
--   local                      155    60     92    2000
--   hc1                        117    42     68    2000
--   hc2                         70     8     35    1000
--   mca                       2864   640   2544   20000
--   baptisms                    40    12     24    1000
--   salvations_inhouse          59     5     35    2000
--   salvations_livestream_enc   34     5     14    1000
--   salvations_livestream_yxp   15     0      7    1000
--   salvations_mc              119     8     56    2000
--   salvations_other           355    28     86    5000
--   salvations (generated)     364    34    138   20000
--   mechanics_get              181    18    126    2000
--   mechanics_worship          274    26    154    2000
--   mechanics_training         639    48    365    5000
--   mechanics                 1070   140    658   10000
--
-- Constraints are added NOT VALID (brief ACCESS EXCLUSIVE, no scan) and then
-- VALIDATEd (SHARE UPDATE EXCLUSIVE: reads/writes continue) only when no row
-- violates them; otherwise a NOTICE lists the violators and the constraint
-- stays NOT VALID (still enforced for new writes). Violation = SQLSTATE 23514.

set lock_timeout = '5s';

do $$
declare
  v_bounds constant jsonb := '{
    "sv1": 10000, "sv2": 5000, "yxp": 5000, "kids": 5000, "local": 2000,
    "hc1": 2000, "hc2": 1000, "mca": 20000, "baptisms": 1000,
    "salvations_inhouse": 2000, "salvations_livestream_enc": 1000,
    "salvations_livestream_yxp": 1000, "salvations_mc": 2000,
    "salvations_other": 5000, "salvations": 20000,
    "mechanics_get": 2000, "mechanics_worship": 2000,
    "mechanics_training": 5000, "mechanics": 10000
  }';
  v_col text;
  v_max integer;
  v_name text;
  v_bad bigint;
begin
  for v_col, v_max in
    select key, value::text::integer from jsonb_each(v_bounds)
  loop
    v_name := format('pga_entries_%s_range', v_col);

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.pga_entries'::regclass and conname = v_name
    ) then
      execute format(
        'alter table public.pga_entries add constraint %I check (%I >= 0 and %I <= %s) not valid',
        v_name, v_col, v_col, v_max
      );
    end if;

    execute format(
      'select count(*) from public.pga_entries where not (%I >= 0 and %I <= %s)',
      v_col, v_col, v_max
    ) into v_bad;

    if v_bad = 0 then
      execute format('alter table public.pga_entries validate constraint %I', v_name);
    else
      raise notice '% left NOT VALID: % existing row(s) violate it (select id, % from pga_entries where not (% >= 0 and % <= %))',
        v_name, v_bad, v_col, v_col, v_col, v_max;
    end if;
  end loop;
end
$$;
