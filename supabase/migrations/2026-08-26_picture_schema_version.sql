-- Field-spec Step 1: schema_version on picture (field-spec.md Part 2).
--
-- The domains JSONB is migrating from the 3a capture shape (v1) to the
-- Part 2 target shape (v2). Rows are upgraded LAZILY: the clarity-chat
-- edge function migrates a v1 row's stored domains to v2 on the first new
-- write and stamps schema_version = 2. No bulk backfill — schema_version
-- identifies legacy rows (there are 2, one incomplete).
--
-- v2 conventions (enforced by validation in clarity-chat):
--   * null = not yet asked; false/0 = asked and answered no. Strictly
--     distinct everywhere.
--   * Money is whole-dollar integer, never string.
--   * Derived values (equity, LVR, surplus, buffer months, totals) are
--     computed at read time and never stored.
--
-- NOT applied yet — awaiting Devon's approval.

alter table public.picture
  add column if not exists schema_version integer not null default 1;

-- Explicit for clarity: everything that exists today is the legacy shape.
update public.picture set schema_version = 1;

comment on column public.picture.schema_version is
  'Shape of the domains JSONB. 1 = legacy 3a capture shape. 2 = field-spec.md Part 2 target shape. Rows upgrade lazily on their first post-migration write via the clarity-chat edge function.';

-- Written by clarity-chat after every capture apply, success or refusal.
-- Member-readable via the existing RLS select policy so the session UI can
-- tell the person when a write was refused, instead of carrying on as
-- though it saved. Shape: { ok, at, errors? }.
alter table public.picture
  add column if not exists last_write_status jsonb;

comment on column public.picture.last_write_status is
  'Result of the most recent capture apply: {ok: bool, at: timestamptz, errors?: []}. Lets the session UI surface a refused write to the person. Never carries financial figures.';

-- Quarantine for refused writes: a payload that fails schema v2 validation
-- is held here in full, never dropped. Service-role only (contains raw
-- captured financial data). The alert signal is the greppable
-- "[Finn clarity] QUARANTINE" log line plus rows appearing in this table.
create table if not exists public.picture_quarantine (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  capture jsonb,
  merged_domains jsonb,
  errors jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.picture_quarantine enable row level security;
revoke all on public.picture_quarantine from anon, authenticated;
grant select, insert on public.picture_quarantine to service_role;

comment on table public.picture_quarantine is
  'Rejected picture writes (failed schema v2 validation), held in full so a refused write never means data loss. Sensitive. Service-role only; no client access of any kind. Reviewed by Devon; cleared manually once triaged.';
