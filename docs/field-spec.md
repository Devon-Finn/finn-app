# FINN — FIELD SPEC AND TRIGGER TABLE
### The data the Clarity Session must capture, and the deterministic rules that decide what the dashboard shows.
**August 2026 · v1 · companion to Finn-Insight-Education-Library.md**

---

## How to use this document

Three audiences, one document.

- **Claude Code** builds the capture schema from Part 2, the trigger engine from Part 3, and the panels from Part 4.
- **Charlie** reviews Part 3 alongside the education copy. The trigger table is the rule governing conditional display, and conditional display is the thing that carries the advice risk.
- **Devon** uses Part 1 to see what the conversation has to start asking that it doesn't ask today.

**The governing chain, restated from the library:**

> The model turns conversation into data → code turns data into display → the locked library supplies the words.

The model never decides what the person sees. It fills fields. Everything downstream of the fields is deterministic.

---

# PART 1 — WHAT CHANGES FROM TODAY

## 1.1 What is captured now

As at this audit, `picture.domains` holds seven domains:

| Domain | Fields today |
|---|---|
| assets | `savings`, `home_value`, `shares_value` |
| buffer | `accessible_savings` |
| estate | `will`, `poa`, `guardianship`, `super_nomination` (booleans) |
| income | `salary_annual`, `partner_salary_annual`, `monthly_expenses` |
| liabilities | `mortgage_balance`, `mortgage_rate_percent`, `offset_balance`, `hecs_balance`, `expensive_debts[]` |
| protection | `life_cover_amount`, `tpd_amount`, `trauma_amount`, `income_protection`, `inside_super` |
| super | `funds[{fund, owner, balance}]`, `multiple_accounts`, `extra_contributions` |

Plus `picture.goals` holding `{notes, directions[]}` and `picture.completed_domains`.

**This supports Tiles 1 to 6 at a basic level. It does not support Tiles 7, 8 or 9 at all.**

## 1.2 The four silent breakages

These are worse than missing data, because the dashboard renders and the numbers are wrong.

**1 · No `has_offset` flag.**
`offset_balance: 0` cannot distinguish "no offset account" from "offset account sitting empty." That distinction decides whether insight 3.2 fires variant A or variant B, and variant B exists specifically because telling someone without an offset that they're missing out is credit assistance under the NCCP. **Highest priority field in this document.**

**2 · `monthly_expenses` does not declare whether it includes the mortgage.**
It feeds the surplus figure on Tile 2 and the months-of-cover figure on Tile 3. Ambiguous input means both are wrong and nothing surfaces the error. Must be captured as expenses *excluding* housing debt, with the mortgage repayment held separately.

**3 · Income is gross where surplus needs net.**
Salary minus expenses is not surplus. Either capture take-home pay directly or Finn is modelling tax, which breaks the moment HECS, salary sacrifice, or non-PAYG income is involved. Capture net.

**4 · Protection fields are inconsistently typed.**
`life_cover_amount: 400000` sits beside `tpd_amount: false` and `income_protection: true`. The panel needs amounts and the trigger needs held-or-not. Every cover type takes the same shape.

## 1.3 The three fields with no home, each blocking a routing rule

| Missing | Blocks |
|---|---|
| Hardship signal | The Tile 8 override that stops someone in trouble being routed to a broker |
| Investment property | Insight 7.1 cannot fire |
| Income structure (business, ABN, rental, entity) | Insight 9.1 cannot fire, and the Tile 9 total is wrong for anyone not purely PAYG |

## 1.4 Household context — still open

Ages, children and their ages, work intentions, horizon. Flagged in the previous session, still uncaptured. Two of the tiles reference it in copy (guardianship only matters with children; the safety net conversation turns on dependants), and it is what travels with every referral in the Advice-Ready Pack.

Included in Part 2 as a domain. The conversation design for it is still to be settled.

---

# PART 2 — TARGET FIELD SPEC

Conventions used throughout:

- `null` means **not yet asked**. `false` / `0` means **asked and answered in the negative**. The distinction matters: a tile must be able to say "none recorded" rather than implying a zero the person never confirmed.
- Money is a whole-dollar integer, never a string.
- Every domain carries `_confidence` so the panel can mark an estimate as an estimate.
- Anything derivable is derived at read time, never stored. Derived values are listed in Part 2.10 and must not appear in the capture schema.

## 2.1 `context` — NEW

```json
{
  "adults": 2,
  "children": [{ "age": 8 }, { "age": 11 }],
  "owner_age": 41,
  "partner_age": 39,
  "work_intent": "both continuing",
  "horizon_years": null,
  "_confidence": "stated"
}
```

| Field | Type | Notes |
|---|---|---|
| `adults` | int | 1 or 2 |
| `children` | array | Empty array means asked and none. `null` means not asked. |
| `owner_age`, `partner_age` | int / null | |
| `work_intent` | enum / null | `both continuing`, `one reducing`, `one stopping`, `unsure` |
| `horizon_years` | int / null | Optional, goal-adjacent |

Drives: guardianship relevance on Tile 6, dependants framing on Tile 3, and the context header that travels with every referral.

## 2.2 `income` — EXTENDED

```json
{
  "salary_gross_annual": 96000,
  "salary_net_monthly": 6100,
  "partner_salary_gross_annual": 58000,
  "partner_salary_net_monthly": 3820,
  "business_income_annual": null,
  "rental_income_annual": null,
  "other_income_annual": null,
  "structure": "paye",
  "entity": null,
  "employer_super_on": ["salary", "partner_salary"],
  "_confidence": "stated"
}
```

| Field | Type | Notes |
|---|---|---|
| `*_net_monthly` | int / null | **Required for the surplus calculation.** Ask for take-home pay, do not model tax. |
| `business_income_annual` | int / null | Sole trader, contracting, ABN work |
| `rental_income_annual` | int / null | Displayed on Tile 9, but **owned by Tile 7 for routing** |
| `structure` | enum | `paye`, `sole_trader`, `company`, `trust`, `mixed` |
| `entity` | object / null | `{ type, name }` where a company or trust exists |
| `employer_super_on` | array | Which income streams attract employer contributions. Drives the 9.1 super point. |

## 2.3 `expenses` — NEW, split out of `income`

```json
{
  "living_monthly": 4900,
  "includes_housing": false,
  "housing_repayment_monthly": 3100,
  "_confidence": "estimated"
}
```

`living_monthly` **excludes** all housing debt repayments. `includes_housing` is an explicit assertion rather than an assumption, so a legacy record can be identified and re-asked rather than silently miscalculated.

## 2.4 `home` — NEW, split out of `assets` and `liabilities`

```json
{
  "owns_home": true,
  "value_estimate": 850000,
  "value_source": "owner estimate",
  "mortgage_balance": 512000,
  "rate_percent": 6.05,
  "rate_type": "variable",
  "lender": "unknown",
  "with_lender_since": null,
  "repayment_monthly": 3100,
  "term_remaining_years": null,
  "has_offset": true,
  "offset_balance": 22000,
  "package_fee_annual": null,
  "_confidence": "stated"
}
```

**`has_offset` is mandatory and must be captured explicitly**, never inferred from `offset_balance`. It selects the 3.2 variant, and the variant is a legal boundary, not a cosmetic one.

`lender` and `with_lender_since` feed the 1.1 position line. Both may be null — the insight still fires, the position line degrades gracefully.

## 2.5 `buffer`

```json
{
  "accessible_savings": 21000,
  "where_held": "savings account",
  "linked_to_loan": false,
  "counts_credit_as_buffer": null,
  "_confidence": "stated"
}
```

`where_held` and `linked_to_loan` decide whether 3.2 fires at all. `counts_credit_as_buffer` is optional colour for the knowledge block; it does not gate anything.

## 2.6 `super`

```json
{
  "funds": [
    { "fund": "unknown", "owner": "you", "balance": 118000, "has_insurance": null },
    { "fund": "old job", "owner": "you", "balance": 41000, "has_insurance": null }
  ],
  "multiple_accounts": true,
  "extra_contributions": false,
  "_confidence": "stated"
}
```

`has_insurance` added per fund. The duplicate-cover half of the 4.1 knowledge block is materially stronger when Finn can see cover in more than one account, and it is unanswerable from a single global flag.

`multiple_accounts` is derivable from `funds`, but is kept as a stated field because the person may know they have several without being able to list them.

## 2.7 `protection` — RETYPED

```json
{
  "life":              { "held": true,  "amount": 400000, "inside_super": true },
  "tpd":               { "held": true,  "amount": null,   "inside_super": true },
  "income_protection": { "held": false, "amount": null,   "inside_super": null },
  "trauma":            { "held": false, "amount": null,   "inside_super": null },
  "_confidence": "stated"
}
```

Uniform shape across all four. `held: true, amount: null` is a real and common state — they know they have it, they don't know how much — and the panel must render it as "amount not known" rather than as absent.

## 2.8 `estate`

```json
{
  "will":             { "in_place": false, "last_updated": null },
  "poa":              { "in_place": false, "last_updated": null },
  "guardianship":     { "in_place": false, "last_updated": null },
  "super_nomination": { "in_place": false, "last_updated": null, "binding": null },
  "_confidence": "stated"
}
```

`last_updated` supports the "hasn't been looked at since before the kids" line in 6.1. `binding` supports the three-year lapse point.

## 2.9 `investments` and `debts` — NEW

```json
{
  "investments": {
    "shares_value": 30000,
    "held_in": "one name",
    "managed_funds_value": null,
    "properties": [
      {
        "value_estimate": 640000,
        "loan_balance": 410000,
        "rate_percent": 5.89,
        "repayment_type": "interest only",
        "rent_monthly": 2340,
        "held_in": "joint"
      }
    ],
    "_confidence": "estimated"
  },

  "debts": {
    "items": [
      { "type": "credit_card",   "balance": 6200,  "rate_percent": 19.99, "minimum_monthly": 124 },
      { "type": "personal_loan", "balance": 9800,  "rate_percent": 13.5,  "minimum_monthly": 410 },
      { "type": "car_loan",      "balance": 18400, "rate_percent": 8.9,   "minimum_monthly": 640 },
      { "type": "bnpl",          "balance": 1340,  "rate_percent": null,  "minimum_monthly": 310 }
    ],
    "hecs_balance": 0,
    "_confidence": "stated"
  }
}
```

`debts.items[]` replaces the untyped `expensive_debts[]`. `type` is an enum: `credit_card`, `personal_loan`, `car_loan`, `bnpl`, `tax_debt`, `other`. HECS is held separately and **never** included in the Tile 8 total — it behaves nothing like consumer debt and grouping it would misrepresent the position.

## 2.10 `flags` — NEW

```json
{
  "hardship": false,
  "hardship_signal": null,
  "_confidence": "inferred"
}
```

The one field on this page written from the model's read rather than a stated answer, and it is the exception the library already permits: distress routing fires on judgment because it routes to free help.

**`hardship: true` overrides every paid referral on Tile 8** and surfaces the financial counsellor route. Where it is set from inference rather than a direct statement, `hardship_signal` records what prompted it, so the decision is auditable after the fact.

## 2.11 Derived values — computed at read, never stored

| Value | Formula |
|---|---|
| `home_equity` | `home.value_estimate − home.mortgage_balance` |
| `lvr_percent` | `home.mortgage_balance ÷ home.value_estimate × 100` |
| `surplus_monthly` | `(all net monthly income) − expenses.living_monthly − expenses.housing_repayment_monthly − sum(debts.minimum_monthly)` |
| `buffer_months` | `buffer.accessible_savings ÷ (expenses.living_monthly + expenses.housing_repayment_monthly)` |
| `super_total` | `sum(super.funds[].balance)` |
| `income_total_annual` | `sum of all annual income fields` |
| `property_equity` | per property: `value_estimate − loan_balance` |
| `debts_total` | `sum(debts.items[].balance)`, excluding HECS |

Storing any of these guarantees they drift out of sync with their inputs.

---

# PART 3 — TRIGGER TABLE

**This is the document Charlie reviews alongside the copy.** Every row is a rule governing conditional display, and conditional display is what carries the advice risk.

## 3.1 Evaluation order

1. Evaluate `flags.hardship`. If true, apply the Tile 8 override before anything else.
2. Evaluate tile visibility.
3. Evaluate insight conditions within each visible tile.
4. Apply precedence rules (3.4).
5. Order the results (3.5).

Pure function. Same input, same output, every time. No model call anywhere in this path.

## 3.2 Tile visibility

| Tile | Shows when |
|---|---|
| 1 · Home and mortgage | `home.owns_home = true` |
| 2 · What's left over | Always |
| 3 · Safety net | Always |
| 4 · Super | Always |
| 5 · Protection | Always |
| 6 · Will and estate | Always |
| 7 · Investments | `investments.shares_value > 0` OR `managed_funds_value > 0` OR `properties[]` non-empty |
| 8 · Other debts | `debts.items[]` non-empty |
| 9 · How your income is made up | Always |

A visible tile with no firing insight is a valid and intended state. It shows the figures and the mechanics and routes nowhere. Tile 9 for two PAYE earners is the canonical example, and it is doing its job.

## 3.3 Insight conditions

| # | Insight | Fires when | Reads | Route |
|---|---|---|---|---|
| 1.1 | Rate and loan setup | `home.owns_home` AND `mortgage_balance > 0` | `rate_percent`, `rate_type`, `lender`, `with_lender_since` | Mortgage broker |
| 1.2 | Offset account | `home.has_offset = true` | `offset_balance`, `mortgage_balance`, `package_fee_annual` | Mortgage broker |
| 1.3 | Equity | `home_equity > 0` | `home_equity`, `lvr_percent` | Broker / planner |
| 2.1 | Spare money | `surplus_monthly > 0` | `surplus_monthly` | Planner / accountant |
| 3.1 | How long it would last | Always, where `expenses` is present | `buffer_months`, `context.children`, `income.structure` | Planner |
| 3.2a | Where it sits — has offset | `has_offset = true` AND `buffer.linked_to_loan = false` AND `accessible_savings > 0` | `accessible_savings`, `offset_balance` | Mortgage broker |
| 3.2b | Where it sits — no offset | `owns_home = true` AND `has_offset = false` AND `accessible_savings > 0` | `accessible_savings` | Mortgage broker |
| 4.1 | More than one super account | `count(super.funds) > 1` for the same owner **OR** `super.multiple_accounts = true` | `funds[]`, `multiple_accounts`, `has_insurance` | Planner |
| 5.1 | Household cover | Any field in `protection` is non-null, i.e. the domain was actually reached | `protection.*`, `context`, `mortgage_balance` | Risk specialist / planner |
| 6.1 | Will and legal basics | Any of the four `in_place = false`, OR `will.last_updated` older than 5 years | `estate.*`, `context.children` | Estate lawyer |
| 7.1 | Investment property | `investments.properties[]` non-empty | property fields, `rental_income_annual` | Broker / planner / accountant |
| 7.2 | Investments and how they fit | `shares_value > 0` OR `managed_funds_value > 0` | `shares_value`, `held_in` | Planner |
| 8.1a | Other debts — has mortgage | `debts.items[]` non-empty AND `mortgage_balance > 0` AND NOT `hardship` | `debts.items[]` | Mortgage broker |
| 8.1b | Other debts — no mortgage | `debts.items[]` non-empty AND `mortgage_balance = 0` AND NOT `hardship` | `debts.items[]` | **No paid referral.** Education plus National Debt Helpline. |
| 9.1 | Income structure | `structure ≠ paye` OR `business_income_annual > 0` OR `entity ≠ null` | `structure`, `entity`, `employer_super_on` | Accountant |

### Explicit non-triggers

Recorded because a lawyer will ask, and because they are easy to reintroduce by accident:

- **9.1 does not fire on rental or dividend income alone.** Those belong to Tile 7. Tile 9 *displays* them; only structural complexity *routes*.
- **Nothing fires on `extra_contributions = false`.** Super contributions as a tax lever is product advice. Finn shows the income and leaves that door for the planner.
- **No insight fires on a comparison to a benchmark.** There are no benchmarks in this system.
- **No insight fires on portfolio composition.** Allocation is displayed as fact and never evaluated.
- **No insight fires on a domain that was never reached.** An all-null domain means the conversation didn't get there, not that the answer is no. Finn cannot say something is worth a conversation when it has no idea what the person holds. This is the `null` vs `false` convention applied to triggering, and it is why 5.1 conditions on the protection domain having been asked rather than firing always.

## 3.4 Precedence

| Rule | Effect |
|---|---|
| Hardship override | `flags.hardship = true` suppresses 8.1a and 8.1b and surfaces the financial counsellor route |
| Offset variant | 3.2a and 3.2b are mutually exclusive by construction; assert this in tests |
| Entity precedence | Where `income.entity ≠ null`, 7.2's ownership block stands down and Tile 9 owns the ownership question |
| Insurance-in-super | Tile 5 owns the conversation. Tile 4 references cover only as a consolidation caution, never as its own referral |
| Rental income | Displayed on Tile 9, routed from Tile 7 |
| Three-broker cap | Where 1.1, 1.2 and 1.3 all fire, the "paid by the lender" note renders once at tile level, not once per insight |

## 3.5 Ordering

Within a tile, insights render in numeric order. Tiles render in the fixed order 1 to 9, with conditional tiles appearing in place.

**Ordering is fixed, not scored.** A relevance ranking is a statement about what matters most in this person's situation, which is a judgment Finn does not make.

Goal-routing at layer three may promote a *professional* in the action list. It does not reorder tiles or insights.

## 3.6 Test households

Minimum fixtures for the trigger engine. Each asserts an exact expected insight set.

| Fixture | Shape | Asserts |
|---|---|---|
| A | Two PAYE salaries, renting, no debts, no kids | Tiles 2,3,4,5,6,9 visible. Tile 9 fires nothing. Tile 1 absent. |
| B | Mortgage with offset, savings sitting outside it | 1.1, 1.2, 1.3, 3.2a fire. 3.2b must not. |
| C | Mortgage, no offset, savings | 3.2b fires. 3.2a must not. 1.2 must not. |
| D | Sole trader plus rental property plus shares | 7.1, 7.2, 9.1 fire. 9.1 does not fire on the rent alone. |
| E | Consumer debts, no mortgage | 8.1b fires. 8.1a must not. No paid referral present. |
| F | Consumer debts, hardship true | Neither 8.1a nor 8.1b. Counsellor route present. |
| G | Trust holding investments | 7.2 ownership block suppressed. Tile 9 owns it. |
| H | Everything null beyond the minimum | Nothing crashes. Every tile renders "none recorded" rather than zeroes. |

Fixture H is the one that will actually catch bugs.

---

# PART 4 — CONTENT AS DATA

The library is a content file in the repo, never strings inside components. Editing copy must not require touching the build, and Charlie's review must map to a file.

```json
{
  "id": "3.2a",
  "tile": 3,
  "variant": "has_offset",
  "route": "mortgage_broker",
  "position_line": {
    "template": "Your safety net of {accessible_savings} is held in {where_held}, separately from your loan.",
    "fields": ["buffer.accessible_savings", "buffer.where_held"]
  },
  "blocks": {
    "why": "...",
    "turn_up": "...",
    "dont_realise": "...",
    "how_professional": "...",
    "nothing_to_prepare": "..."
  },
  "action_label": "Find a mortgage broker"
}
```

**Two hard constraints.**

`position_line` is a template with named field slots. The API fills slots. **It never composes the sentence.** The moment the model writes its own characterisation of the person's situation, the fixed-content-on-fixed-rules position collapses and everything in the library rests on the model behaving.

`blocks` are immutable at runtime. No summarisation, no rewriting for length, no tone adjustment. If a block is too long for a viewport, that is a layout problem.

---

# PART 5 — BUILD SEQUENCE

Each step is one Claude Code prompt. Do not combine them.

| # | Step | Done when |
|---|---|---|
| 1 | Migrate the capture schema to Part 2 | New domains exist; legacy records identifiable via `includes_housing` and the retyped protection shape |
| 2 | Extend the 3a system prompt to collect the new fields | Context, expenses split, `has_offset`, investment property, income structure, hardship signal all captured in conversation |
| 3 | Land the library as a content file per Part 4 | Fifteen entries plus the hardship override, no copy in components |
| 4 | Build the trigger engine as a pure function | All eight fixtures in 3.6 pass |
| 5 | Build the panel components, sections A/B/C | Renders fixture H without crashing or inventing zeroes |
| 6 | Wire it together and merge `clarity-3b` | End to end on all fixtures |

**Steps 1 and 2 are the gate.** Building panels against today's schema means rebuilding them within a month.

**Parallel, not blocking:** Charlie reviews Part 3 of this document alongside the library. Brief him on the NCCP as well as the AFSL — Tiles 1, 3, 7 and 8 involve credit, which is a separate regime with its own licence and its own referral exemption.

---

*Companion to Finn-Insight-Education-Library.md. Thirteen insights, nine tiles, one deterministic path from data to display.*
