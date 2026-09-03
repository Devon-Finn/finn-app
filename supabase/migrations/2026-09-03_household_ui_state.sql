-- Household-scoped UI state — term-registry.md Part Four (corrected).
-- Handed-over terms persist against the HOUSEHOLD, not the browser session:
-- they learned the word, and it is not re-explained on the next visit or
-- the next device. Presentation state, not financial data, so members read
-- and write their own household's row directly (unlike picture, which
-- stays service-role-write-only).

create table public.household_ui_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  -- term id -> ISO timestamp of when the handover was first shown
  terms_handed jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_ui_state enable row level security;

create policy "members read own ui state" on public.household_ui_state
  for select using (household_id = public.current_household_id());
create policy "members insert own ui state" on public.household_ui_state
  for insert with check (household_id = public.current_household_id());
create policy "members update own ui state" on public.household_ui_state
  for update using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Explicit grants (RLS constrains rows; grants must still exist).
grant select, insert, update on public.household_ui_state to authenticated;
grant select, insert, update, delete on public.household_ui_state to service_role;

comment on table public.household_ui_state is
  'Per-household presentation state (term handovers). Member-writable under RLS; holds no financial data. terms_handed: {term_id: first-handed ISO timestamp}.';
