-- Step 3a: the picture table — one row per household, holding the real
-- figures captured during the Clarity Session conversation (Layer 1).
--
-- domains: structured JSON per collection domain (income, assets,
--   liabilities, buffer, protection, estate, super) — the raw inputs 3b
--   derives insights from (equity, surplus, cover months, ...).
-- goals: discovered goals held loosely (directions, not hard values).
-- completed_domains: JSON array of domain keys covered or deliberately
--   skipped, powering "X of 8 areas built" progress.
--
-- Security model (sensitive financial data — strictest posture yet):
--   * RLS ON. Members can SELECT their own household's picture only
--     (powers the progress pane and, later, the 3b dashboard).
--   * NO client writes at all: every write goes through the clarity-chat
--     edge function (service role), which extracts figures server-side
--     from the conversation. anon has nothing.
--
-- Applied via MCP migration on 2026-08-14.

create table if not exists public.picture (
  household_id uuid primary key references public.households (id) on delete cascade,
  domains jsonb not null default '{}'::jsonb,
  goals jsonb not null default '{}'::jsonb,
  completed_domains jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.picture enable row level security;

drop policy if exists picture_select_own on public.picture;
create policy picture_select_own on public.picture
  for select to authenticated
  using (household_id = public.current_household_id());

revoke all on public.picture from anon;
grant select on public.picture to authenticated;
grant select, insert, update, delete on public.picture to service_role;

comment on table public.picture is
  'The household''s real financial picture, captured by the Clarity Session conversation (build 3a). Sensitive. RLS: members read only their own household''s row; ALL writes happen server-side via the clarity-chat edge function (service role) — no client write path exists.';
