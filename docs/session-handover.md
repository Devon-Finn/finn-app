# SESSION HANDOVER
**Updated 2026-09-11 · branch `clarity-3b` (mirrored to `accounts` for its branch deploy) · read this cold before any further build**

## Where the capture-conduct build stands

The seven-step sequence from `capture-conduct.md`:

| Step | What | Status |
|---|---|---|
| 1 | Field registry (`lib/finn-field-registry.js`) | **Built** |
| 2 | Persistence gate at the write boundary | **Built** |
| 3 | Retrieval paths as data (`lib/finn-retrieval-paths.js`) | **Built** |
| 4 | Asks authored by code — `[ASK: path_id]` token substitution, deterministic path_served witnessing | **Built** |
| 5 | Reconciliation pass at derive time (producers declared in the registry, walk in `finn-derived.js`) | **Built** |
| 6 | Conduct linter (`lib/finn-conduct-linter.js`, `conduct_report` table, `/api/conduct-report`) | **Built** |
| 7 | Fixture household | **Not started** |

Also in since the sequence began: five-state confidence (`document > sighted > stated > estimated > inferred`, upload-capability flag in code), stable asset ids with id-aware merge (`lib/finn-merge.js`), mandatory capture block with targeted re-extraction on absence, and the required-implies-servable-path startup invariant.

## Current state

- **Commit:** `c5a5976` on `clarity-3b`, pushed and mirrored to `accounts`; deploy verified by `public/build-marker.txt`.
- **Tests:** 83 green from pushed bytes — gate 41, paths 13, linter 17, merge 12 (`tests/finn-gate.tests.js`, blob-imported from GitHub raw and run in the Browser pane).
- Probe fixture is household C only (`test-household-c@meetfinn.com.au`); reset it blank after every probe. Households A and B are never probed.

## What remains before the merge

1. **Step 7, the fixture household:** one synthetic household carrying every finding ever reported at once (capture-conduct Part Six — empty offset, loan split used to buy ETFs, commercial property positively geared in a company, commercial loan, three super accounts one with insurance inside, ETFs across two platforms, fixed loan expiring inside twelve months, credit card paid in full monthly, a HECS balance). It runs against the deployed branch before any merge.
2. **The ledger layout** from the capture-accuracy addendum: independent of the conduct work and unaffected by it. The addendum document was never received — it needs Devon's document before anything is built.

**Devon's walk comes after both, and the walk gates the merge.** `clarity-3b` does not merge to master without his explicit go-ahead.
