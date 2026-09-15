# FINN — CAPTURE CONDUCT ARCHITECTURE
### The model runs the conversation. It does not author the asks.
**September 2026 · governs the capture layer · read before any further Clarity Session work**

---

## THE PROBLEM THIS SOLVES

Five findings came out of one end-to-end walk. Home value asked without a source. Mortgage details asked with no walkthrough. ETF balances asked as "roughly". Commercial debt captured as a personal loan. Commercial property income never swept into the income total.

They were treated as five fixes. They are one fault.

**Every other layer of Finn is data-driven and reviewable. Capture is not.** The model composes the ask live, so the conduct rules exist only in a prompt, and a prompt is a request, not a constraint. Every session is a fresh roll of the dice against every rule at once. Fixing the copy cannot hold because there is no copy. There is an improvisation.

This is also why Devon's walk is currently the only quality assurance the capture layer has. That is the most expensive testing available and the slowest feedback loop in the build.

**The rule that ends it: the model decides what to ask about next. Code decides how the ask is worded and what evidence is acceptable.**

---

## PART ONE — THE FIELD REGISTRY

One entry per capturable field, in one file, keyed by field id. This is the single place conduct lives. A new field inherits all of it by existing.

```
income.employment.net_monthly:
  label:          "what actually lands in your account"
  retrieval:      required              // a document exists in the real world
  evidence:       [payslip, bank_statement_credit]
  paths:          ["payslip"]           // ids into the retrieval file
  accepts_upload: true
  confidence_floor: document            // may not be committed below this
  softeners:      forbidden
  requires:       []
  feeds:          [income_total_annual]

home.value:
  retrieval:      required
  evidence:       [lender_valuation, rates_notice, portal_estimate, appraisal]
  paths:          ["home_value"]
  accepts_upload: true
  confidence_floor: estimated           // a portal estimate is honestly an estimate
  range_permitted: true                 // carry the range, never flatten it
  softeners:      forbidden
  feeds:          [home_equity, lvr_percent]

expenses.discretionary_monthly:
  retrieval:      none                  // genuinely a forward pattern
  confidence_floor: stated
  softeners:      permitted
```

**Retrieval is three-state, and it is a gate, not a hint.** Every field carries `retrieval: required | offered | none`. `required` serves the path and enforces the confidence floor: the field **cannot be written below its floor** unless a valid refusal record exists against it — the person was served the path, and declined. `offered` serves the path and accepts a stated answer with no refusal record. `none` means no document exists in the real world. The write fails otherwise. This is enforced at the persistence boundary, not in the prompt.

**The same-trip rule.** A field that sits on a document the person is already being sent to for a `required` field is itself `required`. `offered` is reserved for fields whose document exists but demands a separate trip.

**Sighted.** The confidence ladder is `document > sighted > stated > estimated > inferred`. `document` means Finn read the artefact. `sighted` means the person was on the source and read it off. A sighted value satisfies a document floor only while no working upload path exists for that field; the capability flag lives in code, not the registry. Where upload does work, the path text offers the upload and a typed answer from the screen is recorded as sighted, not document.

**Required implies a servable path.** Asserted as a startup check: any registry entry marked `required` with no resolvable path in the path file fails loudly. A required field that cannot be served is a data bug that must not ship.

**The capture block is mandatory.** The model emits `[CAPTURE]{}` on any turn with nothing to capture, so absence is always a fault and never ambiguous. On absence, code runs one targeted re-extraction pass over that single turn and applies the result through the normal gate. Both the absence and the outcome of the re-extraction are logged. The person's stated facts must not be left in the transcript only.

That single rule kills the entire class. A home value, a loan balance, an ETF balance can never again be silently guessed. If it happens, the write throws and it appears in a log, rather than appearing in a walk three weeks later.

**`softeners: forbidden`** stops being a detector that reports after the fact and becomes a property of a templated ask. The ask is assembled from the registry, so it cannot contain "roughly". There is nothing to detect because there is nothing to compose.

---

## PART TWO — RETRIEVAL PATHS AS DATA

One file, keyed by path id, the same shape as the existing bank-export file. Institution variants where they matter.

Each path carries: where the document lives, what it is called in plain words, what to look for on it, what to be honest about (a rates notice lags the market), and the screenshot offer.

**Code emits the asks, not the model.** The model emits a trigger token `[ASK: <path_id>]`. Code intercepts it in the stream and substitutes the exact path text from the path file, and writes the path_served rows for every field that path satisfies at the moment of substitution. Code is the author, so witnessing is deterministic. An unrecognised path id in a trigger token is a fault, logged, and emits nothing. The model needs the path ids and what each is for, not the copy. Adding a bank, a broker or a valuation source is a data change reviewed once, not a prompt change hoped for every session.

**One visit, not three.** A path declares every field it can satisfy. Sending someone to their banking app retrieves balance, rate, type, fixed expiry, offset linkage, offset balance, redraw and minimum repayment together. Finn asks once and reads the screen once.

**The deferral is never offered alongside the help.** The registry has no field for it, because it is not a thing Finn says. If the person defers, Finn records the refusal and moves on. Finn does not suggest it.

---

## PART THREE — CLASSIFICATION CANNOT GUESS

Every enum field declares the questions that must be answered before it can be committed.

```
debts.items[].type:
  requires: [purpose, borrower]
  no_default: true
```

`personal_loan` stopped being a dumping ground the moment `purpose` existed. But an enum with a plausible-looking fallback will always attract one, so the structural rule is: **an enum field with `no_default` cannot be written until its `requires` are answered.** Not answered means the item stays open and visible as open. It does not mean a guess.

`unknown` remains a legitimate, reachable value. What is forbidden is a *specific wrong* value chosen because it was the nearest available.

---

## PART FOUR — COMPLETENESS IS DERIVED, NOT REMEMBERED

Cross-domain links are declared in the registry, not left to the conversation to remember.

```
investments.properties[]:
  produces: income.other[rental_residential | rental_commercial]
entities[]:
  produces: income.other[business_profit | trust_distribution | director_fee]
investments.holdings[]:
  produces: income.other[dividends | distributions]
```

Before any total is derived, code walks every declared producer and asserts either an income entry or an explicit zero with a reason. Anything unmatched lands in `flags.income_unreconciled` and the total is not presented as complete. The panel names the open asset instead of quietly omitting it.

This generalises past income. Any figure derived from a set must assert the set is closed before it is shown as a total.

---

## PART FIVE — THE CONDUCT LINTER

A post-session pass over `capture_log`, run automatically at the end of every session and reported per test household.

It checks:

| Check | Fails when |
|---|---|
| Confidence floor | A retrievable field committed below floor with no refusal record |
| Refusal validity | A refusal claimed with no code-witnessed path_served row in the session |
| Softener | A forbidden softener appears in an ask or a confirmation |
| Enum default | An enum written without its `requires` satisfied |
| Reconciliation | A declared producer with no income entry and no explicit zero |
| Path served | A retrievable field asked without its path text present |
| Single visit | The same institution visited more than once in a session |
| Stated rate per offered field | (report) how often each `offered` field rests on stated rather than a source |
| Fields resting on sighted | (report) every field currently resting on `sighted` |
| Composed ask | An ask for a registered field authored fresh instead of triggered by its token |
| Capture block | A reply with no capture block |
| Em-dash | Any em-dash in the visible stream |

Output is a per-session report, not log lines. **Devon runs a walk and reads a report.** He does not find these by eye. The moment a check has a name, it stops being a discovery and becomes a regression.

---

## PART SIX — THE FIXTURE HOUSEHOLD

Every finding ever reported becomes a permanent fixture. One synthetic household carrying all of them at once:

owner-occupied home with an offset holding nothing · a loan split used to buy ETFs · a commercial property, positively geared, held in a company · a commercial loan · three super accounts, one with insurance inside it · an ETF portfolio across two platforms · a fixed loan expiring inside twelve months · one credit card paid in full monthly · a HECS balance.

It runs against the deployed branch before any merge. If a past finding can recur, it fails here rather than in a walk.

---

## WHAT THE MODEL STILL DECIDES

This is not a scripted questionnaire, and the value of the Clarity Session is that it does not feel like one.

The model still decides: what to ask about next and in what order, how to follow where the person actually goes, when to stay on something and when to let it rest, how to be warm, when to acknowledge that something is hard, and when distress means routing to a financial counsellor rather than continuing.

What the model no longer decides: the words used to ask for a fact, whether a retrieval path is offered, what evidence is good enough, which enum a thing belongs to, and whether a set is complete.

**Warmth on the human. Neutrality on the money. Now with the second half enforced rather than requested.**

---

## SEQUENCE

1. Field registry, with `retrieval`, `confidence_floor`, `softeners`, `requires`, `feeds`.
2. Persistence gate. The floor and the `requires` enforced at the write boundary. **This is the piece that makes everything else structural rather than aspirational.**
3. Retrieval path file, with home value, loan details and investment platforms as the first three entries alongside the existing bank exports.
4. Templated asks assembled from the registry.
5. Reconciliation pass at derive time.
6. Conduct linter.
7. Fixture household.

Steps 1 and 2 are the whole point. Everything after them is content that inherits the guarantee.

---

## STATUS

Raised September 2026 after Devon's walk of `clarity-3b` produced five findings of one class. Supersedes Part One of the capture-accuracy addendum, which described the three retrieval fixes as separate items. The debt and income schema changes in that document stand and are inputs here. The ledger layout in it is independent and unaffected.

*Capture was the last place in Finn where a rule lived only in a prompt. It doesn't any more.*

---

## PART SEVEN — STORE EVERY FIGURE, AND THE GUIDE MODEL (15 September 2026)

Devon's walk of household C lost almost every figure he typed. 18 of 54 turns were refused whole because a typed figure sat below a `document` floor with no refusal record. The heads-up notice fired each time and asked him to repeat himself, and questions repeated because the model never learned the first answer was gone. Deferred items were never re-raised, assets were never swept, and Finn called the picture complete. **Devon's decision: store every figure, flag it to verify.** This part supersedes "the database refuses to store a guess" wherever it appears above.

### The floor is a verification status, not a write barrier

Nothing the person gives is lost. Every figure is stored with how it was given (`document`, `sighted`, `stated`, `estimated`). A figure below its floor goes into `flags.to_verify` (reason `below_floor`, or `declined_source` when the person turned down the source). The plan re-raises it, the close walks it, and the professional sees it as unverified. A figure at or above its floor clears its entry. Array items may carry their own `_confidence`.

Only one thing is refused: an enum written without its item-sibling requires (`debts.items[].type` before `purpose` and `borrower`). Only that leaf is refused. Dotted requires flag `needs:<field>` and never block. Unknown fields and domains drop individually. **A turn is never refused whole.** A partial write is logged with its errors; the next turn's working notes tell Finn what didn't save, and Finn re-asks in its own words. The page notice appears only when a whole turn could not be saved, and it never asks the person to repeat themselves.

Saves read the picture fresh and write conditionally on `updated_at`, retrying on conflict, so a quick reply can't overwrite the previous turn. A new turn waits briefly for the previous save to land. An id-less re-send of an existing item adopts that item's id by natural key (fund name and owner, debt type and borrower, and so on) instead of appending a duplicate.

### The guide model (lib/finn-plan.js)

Every turn, code builds the **information plan** from the picture: the household's shape, each area's required fields (missing, to verify, put off), the sweeps not yet asked, and the open items grouped by source. The model receives it as FINN'S WORKING NOTES. **Code decides coverage.** The model's `completed_domains` is advisory. `session_complete` is refused unless every area is covered and `[FRAME: close]` has been served this session.

The plan is driven by the shape of the household, never by magnitude. This is tested: scaling every figure leaves the plan unchanged, and the notes carry no figures.

### Code-emitted copy (lib/finn-tokens.js)

| Token | Copy |
|---|---|
| `[ASK: id]` | retrieval asks (unchanged) |
| `[SWEEP: other_income / other_assets / other_debts / other_super]` | the "anything else?" questions; an area is not covered until its sweep is asked |
| `[FRAME: open]` | the preframe. A fresh session never reaches the model; code streams it. |
| `[FRAME: close]` | opens the close's walk of open items |
| `[NUDGE: first]` / `[NUDGE: accept]` | the skip protocol, capped at two nudges per item |

`deferrals` in the capture block records what the person put off (`field` or `field#item_id`), with a nudge count in the ledger.

### New conduct checks

Lost facts (the headline metric), acknowledged but not captured, opening preframe, nudge cap and premature close all fail. To verify, coverage and dropped fields are reports. The confidence-floor check is now a report of the to-verify ledger.
