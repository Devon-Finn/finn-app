# Running the suites

Eight suites, one entry point each way. **The number to trust is `counted`.**

| Suite | Function | Lives in |
|---|---|---|
| gate | `runGateTests` | `finn-gate.tests.js` |
| paths | `runPathTests` | `finn-gate.tests.js` |
| linter | `runLinterTests` | `finn-gate.tests.js` |
| merge | `runMergeTests` | `finn-gate.tests.js` |
| fixture household | `runFixtureHousehold` | `finn-fixture-household.tests.js` |
| trigger fixtures | `runFinnTriggerFixtures` | `../public/app/shared/finn-fixtures.js` |
| plan | `runPlanTests` | `finn-plan.tests.js` |
| stream | `runStreamTests` | `finn-stream.tests.js` |

## With node

```
node tests/run-suites.mjs
```

Exits non-zero on any failure or any count mismatch.

**Devon's machine has no node, npm or deno installed.** This runner is for
whoever can execute it — CI, or any other machine. It has not been executed
on the machine it was written on; the counted totals recorded below came
from the browser fallback.

## Without node

`run-suites.html` does the same work in a browser. It needs a static server,
because the suites are ES modules and module imports are blocked on
`file://`:

```
# any static server rooted at the repo
python3 -m http.server 8000      # then open /tests/run-suites.html
```

Results land in `window.__FINN_RESULTS__` as well as on the page, so a
headless driver can read them without scraping.

## counted, declared, expected

- **counted** — assertions that actually ran. Each suite's `t()` increments a
  counter and returns it as `total`.
- **declared** — the literal the suite still carries, as a tripwire for
  assertions that are silently **deleted**, which counting alone cannot see.
- **expected** — the runner's own figure.

Every suite used to return only a hardcoded `total`. On 15 Oct a batch of
assertions failed to insert and the run still reported `155/155 PASS`,
because the literal was echoed back rather than counted. Counting then
showed five of eight declared totals had been wrong for weeks — in both
directions, netting to within one of each other, which is precisely how a
declared number hides a defect.

**When counted and declared disagree, that is a finding.** Work out what the
missing assertions were meant to cover and either write them or lower the
literal and say which. Never pad to the declared number, and never edit
`expected` to turn a red run green.
