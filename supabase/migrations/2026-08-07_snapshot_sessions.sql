-- Snapshot sessions — the anonymous demo-mode snapshot at /app/snapshot
-- (Build brief step 1). One row per visitor session; answers saved as they go.
--
-- Security model: RLS is ENABLED with NO policies. Clients (anon key) can
-- never read or write this table directly — all access goes through the
-- snapshot-session edge function, which uses the service_role key (bypasses
-- RLS). This deliberately differs from public.snapshots, where anon SELECT
-- powers the shareable result page. Sessions hold emails, so nothing here
-- should ever be client-readable.
--
-- Run this in the Supabase SQL editor for project bednxobrkxibidufgsot.

create table if not exists public.snapshot_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  email text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  source text,
  -- Reserved for a later step (accounts/households). Unused in step 1.
  household_id uuid
);

alter table public.snapshot_sessions enable row level security;

-- The edge function (service_role) needs table privileges; RLS alone doesn't
-- grant them. Mirrors the fix applied to public.snapshots earlier. Anon gets
-- nothing on purpose — sessions hold emails and are never client-readable.
grant select, insert, update on public.snapshot_sessions to service_role;

comment on table public.snapshot_sessions is
  'Anonymous demo-mode snapshot sessions (/app/snapshot). Answers saved as they go; email attached at completion. RLS locked with no policies: all access via the snapshot-session edge function (service role only) — holds emails, never client-readable.';
