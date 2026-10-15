-- Write-ahead capture log (Devon's ruling, 2026-09-10).
--
-- The raw capture is persisted the INSTANT it arrives — awaited in the
-- request path, before the stream closes — then validated, merged and
-- committed as a second step. A raw insert can't fail validation, so a
-- capture can never silently vanish: if anything downstream breaks, the
-- turn is on disk and recoverable. This collapses two failure classes
-- into one path: validation failures (previously picture_quarantine) and
-- non-validation failures (previously invisible) both live here, and
-- last_write_status is honest about every outcome so the existing
-- refused-write notice covers both with no new UI.
--
-- status: received  -> raw landed, outcome pending. A received row older
--                      than a few minutes IS the recovery queue.
--          applied   -> validated, merged and committed to picture.
--          refused   -> failed schema v2 validation (the old quarantine).
--          failed    -> non-validation failure (write error, exception).
--
-- RETENTION (privacy-policy item — raw financial payloads):
--   applied           purged after 7 days (recoverability window only;
--                     the merged data lives in picture)
--   refused/failed/
--   stale received    purged after 90 days (triage window, matching the
--                     old quarantine rule)

create table public.capture_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  raw_text text,
  capture jsonb,
  merged_domains jsonb,
  status text not null default 'received'
    check (status in ('received', 'applied', 'refused', 'failed')),
  errors jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index capture_log_household_created on public.capture_log (household_id, created_at desc);
create index capture_log_status on public.capture_log (status) where status <> 'applied';

alter table public.capture_log enable row level security;
-- No policies: service-role only. Raw financial payloads never reach a
-- client session, not even the household's own.

grant select, insert, update, delete on public.capture_log to service_role;

comment on table public.capture_log is
  'Write-ahead log of every [CAPTURE] block: raw first, outcome second. Sensitive; service-role only. Retention: applied purged after 7 days, refused/failed/stale-received after 90 (both commitments belong in the privacy policy). Supersedes picture_quarantine.';

-- Migrate the quarantine evidence before dropping the table. The
-- context.structure domain-drift refusal from a live run is the only
-- field evidence of that failure shape.
insert into public.capture_log (household_id, capture, merged_domains, errors, status, created_at, resolved_at)
select household_id, capture, merged_domains, errors, 'refused', created_at, created_at
from public.picture_quarantine;

drop table public.picture_quarantine;

-- Retention jobs replace the quarantine purge.
select cron.unschedule('purge-picture-quarantine');

select cron.schedule(
  'purge-capture-log-applied',
  '23 3 * * *',
  $$ delete from public.capture_log where status = 'applied' and created_at < now() - interval '7 days' $$
);

select cron.schedule(
  'purge-capture-log-triage',
  '29 3 * * *',
  $$ delete from public.capture_log where status <> 'applied' and created_at < now() - interval '90 days' $$
);
