-- Code-witnessed refusals (capture-conduct correction 1) and session
-- scoping (correction 2).
--
-- path_served: written by CODE when retrieval path text is served for a
-- field id. A refusal record is valid only where a matching path_served
-- exists for that field in that session; a refusal without one is invalid
-- and the gate still fires. path_served will not fire until step 4's
-- templated asks exist — until then no refusal is valid, by design.
--
-- session_id: client-generated per conversation. Refusals are sticky
-- within a session and expire outside it: the gate only honours a refusal
-- from the current session, so a later session re-offers the path.

alter table public.capture_log
  add column session_id uuid,
  add column field_id text;

alter table public.capture_log drop constraint capture_log_status_check;
alter table public.capture_log add constraint capture_log_status_check
  check (status in ('received', 'applied', 'refused', 'failed', 'path_served'));

create index capture_log_path_served on public.capture_log (household_id, session_id, field_id)
  where status = 'path_served';

comment on column public.capture_log.session_id is
  'Client conversation id; scopes path_served events and refusal validity to one session.';
comment on column public.capture_log.field_id is
  'Registry field id, set on path_served rows only.';
