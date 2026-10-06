-- Per-category summary of schema_fingerprint.sql (same CTE). Identical rows on
-- prod and local => schemas match. Read-only.
with items(category, key, val) as (
  select 'column', c.relname||'.'||a.attname,
         format_type(a.atttypid,a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin,d.adrelid),'')||'|'||a.attgenerated::text||'|'||a.attidentity::text||'|'||coalesce(col_description(c.oid,a.attnum),'')
  from pg_attribute a join pg_class c on c.oid=a.attrelid
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where c.relnamespace='public'::regnamespace and c.relkind in ('r','v') and a.attnum>0 and not a.attisdropped
  union all
  select 'relation', c.relname, c.relkind::text||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(c.relacl::text,'')||'|'||pg_get_userbyid(c.relowner)||'|'||coalesce(obj_description(c.oid,'pg_class'),'')
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','m','S','f','p')
  union all
  select 'constraint', conrelid::regclass::text||'.'||conname, contype::text||'|'||convalidated||'|'||pg_get_constraintdef(oid)
  from pg_constraint where connamespace='public'::regnamespace
  union all
  select 'index', indexrelid::regclass::text, pg_get_indexdef(indexrelid)
  from pg_index i join pg_class c on c.oid=i.indrelid where c.relnamespace='public'::regnamespace
  union all
  select 'policy', tablename||'.'||policyname, permissive||'|'||roles::text||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'')
  from pg_policies where schemaname='public'
  union all
  select 'function', p.oid::regprocedure::text, pg_get_functiondef(p.oid)||'|'||coalesce(p.proacl::text,'')||'|'||pg_get_userbyid(p.proowner)
  from pg_proc p where p.pronamespace='public'::regnamespace
  union all
  select 'view', c.relname, pg_get_viewdef(c.oid, true)
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='v'
  union all
  select 'trigger', n.nspname||'.'||c.relname||'.'||t.tgname, t.tgenabled::text||'|'||pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
  where not t.tgisinternal and (n.nspname='public' or p.pronamespace='public'::regnamespace)
  union all
  select 'cron', jobname, schedule||'|'||command||'|'||database||'|'||username||'|'||active from cron.job
  union all
  select 'extension', extname, extversion||'|'||extnamespace::regnamespace::text from pg_extension
)

select category, count(*), md5(string_agg(key||':'||md5(val), ',' order by key)) from items group by 1 order by 1;
