-- Conduct linter reports (capture-conduct step 6, Devon 2026-09-11).
--
-- One row per linter run: a per-session report over capture_log, run
-- automatically when a session completes and on demand via
-- /api/conduct-report. Devon runs a walk and reads a report — he does
-- not find conduct breaches by eye.
--
-- The report jsonb carries check names, statuses (pass/fail/report) and
-- bounded detail excerpts from the raw visible stream, so it inherits
-- capture_log's sensitivity: service-role only, same 90-day retention
-- (privacy-policy item alongside the capture_log entries).

create table public.conduct_report (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  session_id uuid not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index conduct_report_household_session on public.conduct_report (household_id, session_id, created_at desc);

alter table public.conduct_report enable row level security;
-- No policies: service-role only. Members read reports through the
-- JWT-gated edge function, never directly.

grant select, insert, delete on public.conduct_report to service_role;

comment on table public.conduct_report is
  'Per-session conduct linter reports (capture-conduct Part Five). Sensitive; service-role only; purged after 90 days.';

select cron.schedule(
  'purge-conduct-report',
  '35 3 * * *',
  $$ delete from public.conduct_report where created_at < now() - interval '90 days' $$
);
