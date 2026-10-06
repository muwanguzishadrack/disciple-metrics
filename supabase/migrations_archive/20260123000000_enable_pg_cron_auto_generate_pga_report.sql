-- Enable pg_cron extension
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- Create function to auto-generate weekly PGA report
create or replace function public.auto_generate_weekly_pga_report()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  report_date date;
  existing_report_id uuid;
begin
  -- Use East Africa Time (UTC+3) for the report date
  report_date := (current_timestamp at time zone 'Africa/Nairobi')::date;

  -- Check if a report already exists for this date
  select id into existing_report_id
  from pga_reports
  where pga_reports.date = report_date;

  -- Only create if no report exists
  if existing_report_id is null then
    insert into pga_reports (date, created_by)
    values (report_date, null);
  end if;
end;
$$;

-- Schedule the cron job to run every Sunday at 00:00 UTC (3:00 AM EAT)
select cron.schedule(
  'auto-generate-weekly-pga-report',
  '0 0 * * 0',
  $$select public.auto_generate_weekly_pga_report();$$
);
