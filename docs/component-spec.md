# FINN — COMPONENT AND LAYOUT SPEC
### How the Clarity dashboard is built. Components, layout rules, and what varies by scenario.
**September 2026 · v1 · companion to the education library, field spec and term registry**

---

## HOW TO USE THIS

Three documents govern the build and they do different jobs.

| Document | Governs |
|---|---|
| `education-library.md` | What is said. Locked copy. |
| `field-spec.md` | Whether it is said. Schema and trigger table. |
| `term-registry.md` | How words are handed over. |
| **This document** | **How it is arranged.** |

Reference implementation of every component: the published panel design. Where this document and the reference disagree, this document wins.

---

# PART ONE — THE GOVERNING RULE FOR LAYOUT

Three layers, three different rules:

- **What is said** — locked. Verbatim from the library.
- **Whether it is said** — deterministic. Trigger table, in code.
- **How it is arranged** — flexible, but only along the axes below.

> **Layout responds to the shape of the data, never to its magnitude.**

Cardinality, presence and completeness may drive layout. Size, quality and severity never may.

| Legitimate | Never |
|---|---|
| Two properties laid out differently from one | A high LVR getting a larger card |
| A tile with no insights laid out differently from one with three | A thin buffer tinted amber |
| Missing fields collapsing into a reference block | An "urgent" insight moved to the top |
| Density changing at different viewport widths | A progress meter, completion score, or total count of problems |

A high LVR rendered larger is an opinion about someone's finances expressed in pixels. It is harder to defend than words, because nobody wrote it down. That is why these rules are written down.

## The four axes of variance

**1 · Cardinality — how many of a thing**

| Count | Layout |
|---|---|
| 0 | Row reads `none recorded`. Tile still renders. |
| 1 | Single card. No aggregate row. |
| 2+ | Aggregate calc **plus** a repeating item card for each |

Applies to: `super.funds[]`, `debts.items[]`, `investments.properties[]`.

**2 · Completeness — how much was captured**

| State | Layout |
|---|---|
| All present | Full calc block |
| Partly missing | Calc renders. Absent fields collapse into the reference block with a count. |
| Nothing captured | Tile shows "still building". No calc, no insights. |

**3 · Insight count — how many fired**

| Count | Layout |
|---|---|
| 0 | Calm state. Figures, then the calm block. No step rail. |
| 1 | One gap card, **unnumbered**. Numbering a single item is absurd. |
| 2+ | Numbered step rail with connecting line |

**4 · Tile presence** — governed by the trigger table, not here.

## Locked versus flexible

| Locked | Flexible |
|---|---|
| The component set | Which components appear |
| All copy, verbatim | How many times a repeater repeats |
| Tile and insight order | Whether an aggregate row exists |
| Colour meanings — copper is the gap card, forest is primary, **no colour ever signals severity** | Whether the rail is numbered |
| The vocabulary rules | What collapses and what shows |
| No totals, no scores, no meters | Density by viewport |

---

# PART TWO — PRIMITIVES

## 2.1 Calc block

**The most important component in the product.** Shows arithmetic rather than answers. Someone who has never heard the word "equity" watches it get made.

Three-column grid: label · operator gutter · value. A rule line before the result. The result row in forest, one step larger.

```
Value, your estimate              $850,000
Loan balance                  −   $512,000
──────────────────────────────────────────
What you own of it            =   $338,000
```

**Rules**

- Operators are `−`, `+`, `÷`, `=`. The first row has an empty operator cell.
- Values are `tabular-nums`, right-aligned, always.
- The result label is a plain phrase, **never a term**. See 2.2.
- A missing value renders `none recorded` in muted weight, **never `$0`**.
- Nested calcs (item, then aggregate) use the same grammar indented one level.

**Use it wherever numbers relate to each other.** Equity, LVR, interest-charged-on, surplus, buffer months, super total, debts total, income total. If a figure is derived, show the derivation.

**Do not use it** for a flat list of unrelated fields. That is the reference block.

## 2.2 Handover line

Sits at the foot of a calc block, after a dashed rule. Hands over the name of the thing the calc just demonstrated.

> Lenders and brokers call this your **LVR**, for loan to value ratio. They change the terms they'll offer at certain levels of it.

**Rules**

- Plain thing first, name second. The calc result is never the term.
- The named term renders in forest, semibold.
- One handover per block, maximum. A block introducing two terms is a content error.
- Optionally carries one forward clause on why the number matters — describing how the industry behaves, never whether their number is good.

## 2.3 Term affordance

A term already handed over, used bare, with a dotted forest underline. Click reveals its glossary line and why-it-matters.

**Rules**

- A term is handed over **once per session**, on the tile the registry names. Everywhere after, it renders bare with the affordance.
- The popover shows `glossary` then `why`. Never the handover sentence.
- Implemented as a `<button>`, not a `<span>`. Keyboard reachable, Escape closes.
- Marked in the content file as `<term id="lvr">LVR</term>`. **The renderer never decides what to mark.**

## 2.4 Proportion bar

Two segments, forest and accent-light, 2px gap, direct labels inside. Carries an `aria-label` stating both figures.

**Rules**

- Only for a genuine part-of-whole. Never for a value against a benchmark.
- Segment colours never change with the ratio.
- Used once per tile at most, in the hero.

## 2.5 Reference block

Collapsed `<details>` holding fields that are reference rather than insight. Summary line carries a count of what is missing.

> The rest of the loan details · 3 not recorded

**Why it matters:** three `none recorded` rows in a prominent card read as product failure. The same three behind a closed row read as a neutral fact. Missing data becomes honest instead of embarrassing.

## 2.6 Cost pill and line

Sets fee expectation. One per professional.

| Pill | Used for |
|---|---|
| `Usually free` | Mortgage broker, insurance specialist |
| `Varies` | Financial planner, mixed routes |
| `Fixed price` | Estate lawyer |
| `Free` | Financial counsellor |
| `Fee, often deductible` | Accountant |

Never states an amount. States how the professional is paid and who pays them.

---

# PART THREE — BLOCKS

## 3.1 Figure hero

Large number, plain caption, optional proportion bar. The caption is a sentence that ends in the Fraunces accent word.

> **$338,000**
> is the part of the property you own *outright*.
> This is what everyone means by your **equity**.

One per panel. The number is the single most meaningful figure on the tile.

## 3.2 Gap card

Extends the snapshot output's existing gap-card language: `#fdf6ee` background, 1.5px copper border, 5px copper left edge, 8px radius, copper heading. **Someone who did the free snapshot recognises the shape.**

Collapsed by default. Summary carries the insight headline, a one-line hook drawn from the position line, and a destination chip (`Mortgage broker · usually free`).

Body order: why · what a look turns up · **the knowledge block** · how the professional works · cost · promise · action.

**The knowledge block is the only place emphasis is spent.** White inset on the warm ground, forest heading. It is the block someone paid $97 for.

## 3.3 Step rail

Numbered forest markers, 44px, connected by a 2px rule, cards to the right. Collapses to 36px under 600px.

**Only when two or more insights fire.** One insight renders as a bare gap card with no marker.

**The numbers are enumeration, never ranking.** Order is fixed by tile and insight id. The moment anyone proposes ordering by relevance, it becomes a statement about what matters most in this person's situation, and it is a different product.

## 3.4 Promise block

On a tile panel: a white inset before the action.

> **There's nothing you need to prepare.** Finn sends your whole picture ahead, so you're not sitting there trying to explain a situation you've never had laid out before.

On the who-to-see view it is the banner instead, stated once. Never both.

## 3.5 Action zone

Forest button, 6px radius, inline SVG arrow. On a tile panel the vetting line sits beneath it. On the who-to-see view the vetting lives in the banner and the button stands alone.

## 3.6 Calm block

Accent-light panel. Renders when a tile has figures and zero insights.

Three parts:

1. **The statement.** "Nothing here routes to anyone."
2. **Why** — a property of the situation type, never a judgment of the person. *"When income comes from an employer, the tax is settled before it reaches you and super goes in on top automatically. There's no structure sitting underneath it to review."*
3. **What would change it** — a bulleted list of circumstances, then one line on why each matters.

**Never:** a tick, a green anything, "you're in good shape", "nothing to worry about", a completion state. Any of those is the overall verdict that is locked out, and a green tick says it louder than a sentence would.

**Part 3 is the subscription argument.** Finn has just told them the four things that would make this worth revisiting. That is a reason to keep a dashboard, arriving without a sales line.

**Content owed:** a calm block per tile. Only Tile 9 is written.

## 3.7 Repeating item card and aggregate

For arrays. Each item gets its own calc; an aggregate calc sits beneath.

```
Ferntree Gully                $640,000
  Loan against it           − $410,000
  ────────────────────────────────────
  Equity                     $230,000

Belgrave                      $520,000
  Loan against it           − $300,000
  ────────────────────────────────────
  Equity                     $220,000

  ────────────────────────────────────
Total value                 $1,160,000
Total lending               − $710,000
  ────────────────────────────────────
Total equity                  $450,000
```

**The insight fires once regardless of item count.** Three investment properties is one broker conversation, not three referrals.

## 3.8 Professional card

On the who-to-see view. Name, role line, count chip, the items, cost line, action.

Items show once under their primary professional. Secondary professionals are named inline beneath the item, never given a duplicate copy of it.

**A professional who only ever appears as a secondary gets no card.** A card with no items is worse than no card.

## 3.9 Trust banner

Forest, at the top of the who-to-see view. Two claims and the disclosure, together:

1. Whoever you see, you turn up understood.
2. Nobody buys their way onto this list — including that they pay Finn, said plainly and first.

**The disclosure belongs inside the trust claim, not hidden below it.** Saying it yourself, first, is what makes the next sentence believable. This is the one legitimate use of steel on forest.

---

# PART FOUR — THE THREE VIEWS

## 4.1 Tile detail panel

```
Top bar · back, tile name, status flag
Figure hero (+ proportion bar)
Calc blocks — the ones that teach, full width where earned
Reference block — collapsed
[Section B — only where no calc carries the mechanics]
Insights — step rail if 2+, bare card if 1, calm block if 0
```

**Section B is absent only where a calc block demonstrates the same mechanic.** On Tile 1 the calcs show equity, LVR and what an offset does; repeating it in prose was the text bloat. On Tile 2 the calc shows how the surplus figure is derived, which is what its Section B said.

**Everywhere else it survives**, because the mechanic is about what a product does rather than how numbers relate — how credit card minimums work on Tile 8, that super fees come out of the balance on Tile 4, the deductibility asymmetry on Tile 7, employer versus self-employed treatment on Tile 9, what a buffer counts on Tile 3, and the product mechanics on Protection and Estate.

**Absent by design: Tiles 1 and 2 only.**

## 4.2 Calm state

Same panel, `calm block` in place of the insight stack. Status flag is neutral grey `Nothing flagged`, never forest, never a tick.

## 4.3 Who to see

```
Tabs · Your picture | Who to see
Trust banner
Professional cards, fixed order
How someone gets on the list
```

**A second tab at dashboard level, peer to the tile grid.** Not a stage at the end — a lens on the same data, and they will come back to it. It is also the natural home for the referral flow and the Advice-Ready Pack, both currently homeless.

**Professional order is fixed by first appearance across tiles 1 to 9.** Broker, planner, insurance specialist, estate lawyer, accountant. **Never sorted by count.**

**No total anywhere.** Per-professional counts are facts. A grand total of things-to-sort is a verdict on their whole position, which is the one thing locked out.

---

# PART FIVE — WHAT THE BUILD NEEDS THAT DOES NOT EXIST

## 5.1 Schema additions

| Domain | Add | Why |
|---|---|---|
| `investments.properties[]` | `use`: `investment` \| `holiday` \| `other` | A holiday house is neither the home they live in nor an investment. Nowhere to go today. |
| `buffer` | `other_cash`, `other_cash_where_held` | Cash beyond the emergency buffer has no home since `assets.savings` went to `_unmapped`. 3.2a currently sees a third of the situation. |

## 5.2 Library additions

| Field | Why |
|---|---|
| `route_primary`, `route_also[]` | Replaces `route`. Fixed property of the insight, never derived from the person. |
| `section_b` becomes optional | Absent on Tiles 1 and 2 only, where a calc demonstrates the same mechanic. Present everywhere else. |
| `calm` block per tile | The why and the what-would-change-it. Currently written for Tile 9 only. |
| `cost` per professional | Six written. Lives on the professional, not the insight. |

## 5.3 Trigger changes

| Insight | Change |
|---|---|
| 1.2 | Fires on `has_offset = true` **AND** `offset_balance = 0`. Someone using their offset has no question to take anyone; judging whether their balance is "enough" would be an evaluation. Package-fee knowledge moves into 1.1. |
| 3.2a | Broaden from `buffer.accessible_savings` to all cash held outside the offset. A dollar outside an offset behaves the same whatever it is earmarked for. |
| 5.1 | Already applied — fires only where the protection domain was reached. |
| 4.1 | Already applied — also fires on `multiple_accounts = true`. |

## 5.4 Content owed

- Calm blocks for eight tiles
- 1.2 rewritten for the empty-offset case
- Section B trimmed where calcs carry it
- Cost lines already drafted, need placing on professionals

---

# PART SIX — BUILD SEQUENCE

Each step is one Claude Code prompt.

| # | Step | Done when |
|---|---|---|
| 1 | Schema additions per 5.1, library fields per 5.2 | Validator accepts the new shapes; existing rows unaffected |
| 2 | Component library — primitives and blocks as reusable pieces | Every component in Parts Two and Three exists once, used everywhere |
| 3 | Term registry as data + the affordance | Terms marked in copy render with the popover; one handover per session per term |
| 4 | Rebuild the tile panel against the components | Tile 1 matches the reference; the other eight render from the same pieces |
| 5 | Calm state | Fires on zero insights; fixture H and a PAYE household both render correctly |
| 6 | Who-to-see view and the second tab | Fixed order, no totals, items appear once under their primary |
| 7 | Trigger changes per 5.3, fixtures updated | All fixtures green, plus new ones for the 1.2 and 3.2a changes |

Steps 1 to 3 are the foundation. Steps 4 to 6 are cheap once they exist and expensive without them.

---

*Layout responds to the shape of the data, never to its magnitude. Everything else follows from that.*
