-- Retention policy for picture_quarantine (field-spec Step 2, fix 11).
-- The table holds raw financial payloads from refused writes; they exist
-- for triage, not archive. 90 days, then purged nightly via pg_cron.
--
-- NOT applied yet — awaiting Devon's approval.

create extension if not exists pg_cron;

select cron.schedule(
  'purge-picture-quarantine',
  '17 3 * * *', -- daily, 03:17 UTC
  $$ delete from public.picture_quarantine where created_at < now() - interval '90 days' $$
);

comment on table public.picture_quarantine is
  'Rejected picture writes (failed schema v2 validation), held in full so a refused write never means data loss. Sensitive. Service-role only; no client access of any kind. Reviewed by Devon; RETENTION: purged after 90 days by the pg_cron job purge-picture-quarantine.';
