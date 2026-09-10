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

That single rule kills the entire class. A home value, a loan balance, an ETF balance can never again be silently guessed. If it happens, the write throws and it appears in a log, rather than appearing in a walk three weeks later.

**`softeners: forbidden`** stops being a detector that reports after the fact and becomes a property of a templated ask. The ask is assembled from the registry, so it cannot contain "roughly". There is nothing to detect because there is nothing to compose.

---

## PART TWO — RETRIEVAL PATHS AS DATA

One file, keyed by path id, the same shape as the existing bank-export file. Institution variants where they matter.

Each path carries: where the document lives, what it is called in plain words, what to look for on it, what to be honest about (a rates notice lags the market), and the screenshot offer.

**The model is handed the path text. It never composes it.** Adding a bank, a broker or a valuation source is a data change reviewed once, not a prompt change hoped for every session.

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
| Softener | A forbidden softener appears in an ask or a confirmation |
| Enum default | An enum written without its `requires` satisfied |
| Reconciliation | A declared producer with no income entry and no explicit zero |
| Path offered | A retrievable field asked without its path text present |
| Single visit | The same institution visited more than once in a session |
| Em-dash | Any em-dash in the visible stream |

Output is a report, not a log line. **Devon runs a walk and reads a report.** He does not find these by eye. The moment a check has a name, it stops being a discovery and becomes a regression.

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
