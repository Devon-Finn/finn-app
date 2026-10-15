-- Density (ledger layout, Devon 2026-09-11): section B collapses behind a
-- quiet "How this works" affordance, open by default only on a tile's
-- first visit, remembered per household. Nothing is ever collapsed or
-- expanded because of what the person's number is — only by whether
-- they have been here.

alter table public.household_ui_state
  add column section_b_seen jsonb not null default '{}'::jsonb;
