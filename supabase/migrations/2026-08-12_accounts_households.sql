-- Step 2: accounts — households, members, access (locked data model).
--
-- An account is a HOUSEHOLD, not a person. A household has one or two
-- members (owner + optional partner) who each log in (Supabase Auth) and
-- share one picture/access/subscription. Accounts are created ONLY after
-- payment (pay-first model) by the create-account edge function using the
-- service role; there is no client-side signup path.
--
-- Security model:
--   * RLS ON for all three tables.
--   * The core privacy boundary: a logged-in member can read only their OWN
--     household's rows. Enforced via public.current_household_id(), a
--     SECURITY DEFINER helper that looks up the caller's household without
--     re-triggering RLS on members (avoids policy recursion).
--   * anon: no access at all. authenticated: select own household's rows,
--     plus narrow updates (household display_name/account_type; own member
--     display_name/two_factor_enabled). All inserts/deletes and all writes
--     to access happen through the service role only.
--
-- Run in the Supabase SQL editor for project bednxobrkxibidufgsot
-- (applied via MCP migration on 2026-08-12).

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  account_type text not null default 'individual'
    check (account_type in ('family', 'individual')),
  display_name text not null,
  created_at timestamptz not null default now(),
  -- Carry-over foundation: the anonymous snapshot this account came from.
  origin_snapshot_id uuid references public.snapshot_sessions (id) on delete set null
);

create table if not exists public.members (
  -- Same id as the Supabase Auth user — one auth user = one member.
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'owner'
    check (role in ('owner', 'partner')),
  -- Schema support only in step 2: 2FA is prompted later (first login /
  -- first sensitive data), never forced at account creation.
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists members_household_id_idx on public.members (household_id);

create table if not exists public.access (
  household_id uuid primary key references public.households (id) on delete cascade,
  depth text not null
    check (depth in ('demo', 'clarity', 'subscription', 'lapsed_read_only')),
  clarity_purchased_at timestamptz,
  clarity_completed_at timestamptz,
  access_until timestamptz,
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'cancelled')),
  subscription_renews_at timestamptz
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.access enable row level security;

-- The caller's household id, bypassing RLS on members (security definer) so
-- policies can reference it without recursing. Returns null for anon.
create or replace function public.current_household_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select household_id from public.members where id = auth.uid()
$$;

revoke all on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated;

-- households: members see and may rename their own household. No client
-- insert/delete (service role only).
drop policy if exists households_select_own on public.households;
create policy households_select_own on public.households
  for select to authenticated
  using (id = public.current_household_id());

drop policy if exists households_update_own on public.households;
create policy households_update_own on public.households
  for update to authenticated
  using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- members: a member sees everyone in their household (owner + partner) but
-- may update only their own row. No client insert/delete.
drop policy if exists members_select_household on public.members;
create policy members_select_household on public.members
  for select to authenticated
  using (household_id = public.current_household_id());

drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and household_id = public.current_household_id());

-- access: read-only for members; only payment machinery (service role)
-- writes access rows.
drop policy if exists access_select_own on public.access;
create policy access_select_own on public.access
  for select to authenticated
  using (household_id = public.current_household_id());

-- ── Grants (RLS constrains rows; grants constrain columns/verbs) ────────────

revoke all on public.households from anon;
revoke all on public.members from anon;
revoke all on public.access from anon;

grant select on public.households to authenticated;
grant update (display_name, account_type) on public.households to authenticated;
grant select on public.members to authenticated;
grant update (display_name, two_factor_enabled) on public.members to authenticated;
grant select on public.access to authenticated;

grant select, insert, update, delete on public.households to service_role;
grant select, insert, update, delete on public.members to service_role;
grant select, insert, update, delete on public.access to service_role;

-- ── Comments (document the security model, step-1 style) ────────────────────

comment on table public.households is
  'One account = one household (pay-first: households exist only after payment). Created by the create-account edge function (service role). RLS: members read/rename only their own household; no client insert/delete. origin_snapshot_id links back to the anonymous snapshot the account came from.';

comment on table public.members is
  'People who can log in. id = Supabase Auth user id. One or two per household (owner/partner). RLS: members see only their household''s members and update only their own row. Created by the create-account edge function (service role). two_factor_enabled is schema support; 2FA is prompted post-signup, never at account creation.';

comment on table public.access is
  'What a household can reach (depth) and its purchase/subscription state. RLS: read-only to the household''s members; written ONLY by payment machinery via service role. depth=clarity is set at account creation in the pay-first flow.';
