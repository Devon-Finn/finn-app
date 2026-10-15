-- Refusal records for the persistence gate (docs/capture-conduct.md).
-- A retrievable field may not be committed below its confidence floor
-- unless a refusal record exists against that field id: the retrieval
-- path was offered, and the person declined. Records are per-household
-- and sticky (a declined path stays declined until the person later
-- provides the document, which simply writes at a higher confidence).
-- Shape: [{"field": "home.mortgage_balance", "at": iso}]

alter table public.picture
  add column refusals jsonb not null default '[]'::jsonb;

comment on column public.picture.refusals is
  'Field ids where the retrieval path was offered and declined (capture-conduct gate). [{field, at}]. Written service-role only, like the rest of the row.';
