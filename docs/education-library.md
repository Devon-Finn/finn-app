# FINN — INSIGHT EDUCATION LIBRARY (Tier 2 content)
### The locked, pre-written education for every insight, plus the build rules that govern how it is displayed.
**August 2026 · v2 · reviewed and signed off tile by tile with Devon · supersedes the July draft**

---

# PART ONE — THE RULES

## 1. The governing principle

**Finn states the mechanism. The person draws the conclusion. Finn never states the conclusion.**

This is sharper than "describe fully, grade never," which does not tell you where the line falls. Use this test on every sentence:

- **Describing how a product works** is factual information. Always allowed.
- **Stating what the person's own numbers are** is factual information. Always allowed.
- **Stating a direction of benefit for this person** is advice. Never allowed.

The reason the line sits here is that Finn holds the person's financial situation. Advice given to someone whose circumstances are known is personal advice, which requires the licence, the best interests duty and a statement of advice. General wording does not fix this, because **the trigger is part of the message** — showing an insight only when their data meets a condition is itself an opinion about their circumstances.

Worked example, the offset case:

- ❌ "Money in savings rather than your offset is a missed opportunity."
- ✅ "Every dollar in an offset reduces the balance your loan charges interest on, and you can still withdraw it whenever you want. A dollar in a savings account earns interest at whatever rate that account pays. Both keep the money available to you."

The reader reaches the same conclusion in about two seconds. Finn just never said it.

### Specific things Finn must never do

| Never | Why |
|---|---|
| State a benchmark their number is measured against ("most say six months") | The benchmark plus their number is a grade |
| Show a score with a denominator ("3 of 6 insurances in place") | The denominator is a target Finn has set |
| Name a return rate ("buffer and savings at 6% pa") | A performance representation about a financial product |
| Name a geared strategy (debt recycling, borrowing to invest) | Personal advice on a leveraged strategy, sharpest end of the regime |
| Suggest they apply for or change a credit contract | Credit assistance under the NCCP, a separate licence |
| Raise super contributions as a tax lever | Product advice on a financial product; leave the door for the planner |
| Compute a projection on their figures | Turns a fact about products into a forecast about them |
| Use red, warning icons, progress bars, or the word "shortfall" | Colour and iconography carry a verdict even when the copy does not |

### The rule extends to the conversation, not just the dashboard

Everything above controls what the *dashboard* says. The *conversation* is model-generated and unconstrained, so the same principle has to hold there or the architecture leaks.

**Warmth on the human. Neutrality on the money.**

Finn can be warm, attentive and human about the person and their life. "That's a big shift, going back part time when the youngest started school" is right, and it is what makes the session feel worth paying for.

Finn must not characterise their financial position while gathering. Lines like "so there's a bit of room each month", "that's a meaningful chunk of equity", or "your offset is doing quiet work against your interest" are appraisals. They are unlogged, unreviewable, model-generated opinions about a person's circumstances, formed live. Charlie cannot review them, they cannot be tested, and they are exactly what the deterministic trigger architecture exists to prevent.

During capture, Finn acknowledges, reflects the fact back, and moves on. The assessment lives in the locked library, on the dashboard, where it is fixed and reviewable.

### Finn does not accept not knowing. It converts it into finding out.

This is not a new rule. The locked USP is "when you don't know a number, Finn tells you exactly where to find it." That is the accompaniment promise and it is what separates a Clarity Session from a form. Five rules make it real.

**1 · Never pre-soften the ask.**
No "roughly", "approximately", "a ballpark", or "if you're not sure" before they have tried. Ask the real question. Soften only after they say they don't know.

- Wrong: "Do you know roughly how many years are left?"
- Right: "How many years are left on the loan?"

**2 · When they don't know, give the retrieval path and stay on it.**
Name the specific place, then offer to wait.

> "It'll be on your most recent super statement, or in the fund's app under a heading like Insurance or Cover. Have a look now if you can, I'll wait."

**3 · Offer to do the work. The upload is there for this.**
The input accepts a statement or a screenshot. Say so.

> "Or screenshot the page and drop it in here, and I'll pull the numbers out."

That single sentence is the product. Use it whenever a document would settle the question.

**4 · Never offer the deferral in the same breath as the help.**
"Or make a note to check later" alongside "we can do it now" means everyone takes the deferral. Deferral is the fallback after retrieval has actually been attempted and failed, never an option presented in parallel.

**5 · Never change subject on an unresolved field.**
One open thread at a time. Do not raise the next question in the same turn as an unresolved one. Finn moved from unknown super insurance straight to whose name the shares are in, inside one message, and the first question died there.

**Where it genuinely cannot be found**

Then and only then: capture what they can give, mark the domain _confidence as "estimated" rather than "stated", say plainly that it's an estimate and that the professional will confirm it, and return to it in the wrap-up pass as "still to confirm". A field that was deferred and never revisited is a failure of the session, not a property of the data.

**Tone**

None of this is pressure. It's help. "I'll wait" and "drop it in here and I'll read it" are warm. What isn't warm is asking someone for a number, watching them not have it, and moving on as though that was fine.

### Two regimes, not one

The AFSL question is not the only one. **Tiles 1, 3, 7 and 8 involve credit, which sits under the NCCP, not the Corporations Act.** Credit assistance has its own licence and its own referral exemption. Charlie needs to be briefed on both, or the review will come back clean on AFSL with an unexamined credit exposure underneath it.

## 2. The detail panel structure

Every tile's detail panel has three parts, in this order.

**A · Your position — the figures.**
Everything Finn captured for that tile, laid out plainly. Visual first, scannable, figures not findings. This is the most licence-free content in the product and probably the most valuable, because almost nobody has ever seen their whole position written down.

**B · What these products actually do — the mechanics.**
A short block of product mechanics that gives the figures meaning without grading them. This is where the implication lives.

**C · Worth a conversation — the insights.**
Stacked insight units, each ending in a route to a professional. May be zero, one, or several.

Between A and B the person arrives at the implication on their own. Finn never states it.

### Display rules for section A

- **Visual first.** The figure block reads at a glance before any prose.
- **Per-tile layouts.** A mortgage tile carries balance, rate, equity, offset, term. A protection tile carries cover types and amounts. They should not look the same.
- **List with status, never a score.** Show every item that exists in the category, with what they hold and what is not recorded. Two blank rows communicate everything a fraction would, without setting a target.
- **Bold is allowed. Colour is not.** Bolding "none recorded" makes a fact legible. Red, warning icons and progress bars deliver a verdict.
- **Display is broader than triggering.** A tile can show the full picture while its insight fires on a narrow condition. Describe fully, trigger narrowly.

### The position line

Each insight opens with two sentences before its education:

1. **What they have, as fact.** "You have life cover in place. You don't currently have income protection."
2. **One sentence of product mechanics.** "Life cover pays out if you die. Income protection replaces part of your income while you're unable to work. They cover different events, and holding one doesn't cover you for the other."

**Build constraint: the position line is a template with slots filled from fields. The API must never compose it freely.** The moment the model writes its own characterisation of their situation, the "fixed content on fixed rules" defence collapses.

## 3. How insights are selected

**Deterministic rules in code. Not model judgment.**

The chain is: **the model turns conversation into data → code turns data into display → this library supplies the words.** The model never decides what the person sees.

Why it cannot be the model's judgment:

- **Legal.** The display rule is the thing Charlie signs off. He can review a table of fourteen conditions. He cannot review a vibe.
- **Testability.** Fourteen triggers can be unit tested against sample households. A judgment cannot.
- **Consistency.** The same household must get the same dashboard on Tuesday as on Monday.
- **Support.** When someone asks why Finn told them about super, there must be a one-line answer.

The conversational read is not wasted, it moves upstream. "Sounds like my job's not secure" becomes `income_security: low`, a field. Then code reads the field.

**Two exceptions, both already in the architecture:**

1. **Distress routing** to a financial counsellor fires on judgment, in the conversation, not as a tile. Different risk profile, and it routes to free help.
2. **Goal-routing at layer three** is where soft signals legitimately shape which professional is prioritised. Goals are discovered, which is the conversational read doing its job in the place designed for it.

**Outstanding: the trigger rule table does not exist yet.** One row per insight — condition, fields read, variant selected, precedence. It is what Claude Code builds from and what Charlie reviews alongside this copy.

## 4. Tile architecture, as amended this session

**Seven core, two conditional.** Income structure is promoted from conditional to core — everyone sees how their income is made up, because total income is a psychologically important number most households have never seen in one place. The tile always shows; the insight only fires when there is something to route on.

| # | Tile | Status | Insights |
|---|---|---|---|
| 1 | Your home and mortgage | Core | 1.1, 1.2, 1.3 |
| 2 | What's left over each month | Core | 2.1 |
| 3 | Your safety net | Core | 3.1, 3.2 |
| 4 | Your super | Core | 4.1 |
| 5 | Protection | Core | 5.1 |
| 6 | Your will and estate | Core | 6.1 |
| 7 | Your investments | Conditional | 7.1, 7.2 |
| 8 | Your other debts | Conditional | 8.1 |
| 9 | How your income is made up | **Core** | 9.1 |

**Fourteen insights across nine tiles, sixteen entries with variants.**

### Ownership rules, so nobody is routed twice for one thing

- Rental income → **Tile 7**. The property owns it, and 7.1 owns the deductibility and land tax angle.
- Dividends and distributions from listed investments → **Tile 7**, owned by 7.2.
- Business income, contracting, ABN work → **Tile 9**.
- Insurance held inside super → **Tile 5** owns the conversation. Tile 4 carries it only as a handle-with-care flag on consolidation.
- **Precedence:** if a company or trust exists, Tile 9 owns the ownership question and 7.2's "whose name it's held in" block stands down.
- **Override:** where debts are causing genuine hardship, the financial counsellor route overrides every referral on Tile 8.

## 5. The insight template

Per insight, in order:

**Position line · Why this is worth a conversation · What a look at this can turn up · The part most people don't realise · How the professional works · There's nothing you need to know or prepare · → find action**

Two notes on the blocks that carry the weight:

**"The part most people don't realise" must carry knowledge, not cost reassurance.** In the July draft, nine of eleven degraded into "a first conversation is often free." That is the block someone paid $97 for. Cost reassurance is now one appended sentence, never the block itself.

**"There's nothing you need to know or prepare" must name the specific dread.** The beat only lands where the fear is particular to that conversation — heaviness on the safety net, shame on debts, not having decided anything on the estate. Generic versions blur. Cap "you just turn up" at once per session.

**Voice:** calm, warm, plain, a knowledgeable friend. Sentence case, capitals only for Finn, Clarity Session, Advice-Ready Pack. No em-dashes. No "you should," including at one remove. No "plain English." Never "no agenda." Watch for comma splices where an em-dash was removed; use a full stop.

---

# PART TWO — THE LIBRARY

# TILE 1 — YOUR HOME AND MORTGAGE

**Section A — your position**

```
Property value (your estimate)    $900,000
Loan balance                      $612,000
Equity                            $288,000
Rate                                 6.34%   variable
Lender                            [lender], since 2019
Repayment                         $3,890/month
Offset balance                      $8,400
Term remaining                    23 years
```

**Section B — how a home loan works**
Your equity is the part of the property you own outright, which is the value less what's still owing. The rate is what the loan costs you to carry, and on a variable rate it can move. An offset account reduces the balance interest is charged on by whatever is sitting in it, and the money stays available to you the whole time.

---

### 1.1 — Your rate and how the loan is set up → mortgage broker

**Why this is worth a conversation**
Your mortgage is almost certainly the biggest financial commitment you have, so small differences in the rate or the way the loan is set up add up to real money over the years it runs. Loans also quietly drift out of date. The rate that was competitive when you signed up, the features you're paying for, the structure you chose for a situation you were in years ago, none of it updates itself. A review is simply someone checking whether the loan still fits the life you're in now.

**What a look at this can turn up**
People often find their rate has crept above what's currently on offer, or that they're paying for features they don't use, or that the loan could be structured to suit them better. Sometimes everything's fine and they walk away reassured. Either way, they stop wondering.

**The part most people don't realise**
Lenders will often offer a sharper rate to a new customer than the one an existing customer is sitting on. Nobody rings to tell you, because there's no reason for them to. It's a large part of why a loan drifts without anything actually going wrong.

And the review itself costs nothing. A mortgage broker is paid by the lender, not by you, so the only thing you're risking is half an hour.

**How a mortgage broker actually works**
A broker looks across a lot of lenders at once, not just your current bank, so they can see how your loan compares to the whole market rather than one shelf of it. They handle the comparison, the paperwork, and the back-and-forth with lenders.

**There's nothing you need to know or prepare**
This is the bit people quietly dread, sitting across from someone and worrying they'll be asked something they can't answer. That doesn't happen here. Finn has already built your picture and can pass it straight to them, so you walk in with everything already understood. You don't need to have it all figured out, or know the right questions, or feel on top of it. That's Finn's job, and it's done. You just turn up.

→ *Find a mortgage broker*

---

### 1.2 — An offset account with nothing in it → mortgage broker

Fires on has_offset = true AND offset_balance = 0. Someone using their offset has no question to take anyone, and judging whether their balance is "enough" would be an evaluation.

**Position line**
You have an offset account attached to your loan, with nothing currently sitting in it.

**Why this is worth a conversation**
An offset account is one of the most useful features a home loan can have, and it only does anything when there's money in it. Every dollar in an offset comes off the balance your loan charges interest on, while staying completely available to you. An empty one does none of that, and it usually isn't free.

**What a look at this can turn up**
Sometimes the account was set up at settlement and never used, because nobody explained what it was for. Sometimes the money that would sit in it is somewhere else entirely. Either way it's a short conversation, and it's the kind of thing a broker sorts out in one call.

**The part most people don't realise**
An offset usually comes as part of a package the loan charges you for, often a few hundred dollars a year. That fee is charged whether the account is working hard or sitting empty. Most people never think of an offset as something with a price on it, which is how an unused one goes years without anyone noticing.

**How a mortgage broker helps here**
A broker can tell you what your particular package costs, what the offset is actually attached to, and how your accounts could sit around the loan. This is routine work for them.

**There's nothing you need to know or prepare**
You don't need to understand offsets before you go, that's the whole point of the conversation. Finn passes on how your accounts currently sit, and they explain the rest in ordinary terms. No homework.

→ Find a mortgage broker

---

### 1.3 — Your equity and what it could be used for → mortgage broker / financial planner

**Why this is worth a conversation**
Equity is the part of your home you actually own, and it grows every time you make a repayment and every time the place is worth more. For most households it's the largest asset they have, and it sits there doing nothing visible. What a lot of people never find out is that equity can be used. It's the starting point for a number of things people do to build their position over time, and it's one of the more established areas of financial advice in Australia. Whether any of it suits you is a completely separate question, and it's the one worth putting to someone.

**What a look at this can turn up**
This is an area where the honest answer is that it depends enormously. Using equity means taking on more debt against your home, so it lifts both what you might build and what you're exposed to if things don't go to plan. For some households that trade-off is right. For plenty of others it isn't. Which one you are depends on your income and how secure it is, what else you're carrying, and what you actually want. That isn't something to settle from an article.

**The part most people don't realise**
Equity on paper and equity a lender will actually work with are two different numbers. Lenders look at how much you'd still be borrowing against the property, and there are thresholds where the terms change, including whether lenders mortgage insurance comes into it. Where you sit against those thresholds matters more than the raw figure, and it isn't something you can read off a valuation.

**How the professionals work**
A mortgage broker can tell you what a lender would actually consider and on what terms. A financial planner is the one who helps you think about whether using it serves what you're trying to do, and what it would mean if things went differently. Anything that involves borrowing in order to invest is a planner's conversation rather than a broker's, and it's worth knowing which one you're having.

**There's nothing you need to know or prepare**
You don't need to know what any of the options are called, or to have decided anything. Plenty of people have this conversation purely to find out what their position allows and what it would actually mean. Finn passes on the whole picture, so it starts from something real.

→ *Find the right professional*

> **Build note.** "Paying the mortgage down faster" is a goal, not an insight. If it surfaces in conversation it belongs in goal-routing at layer three, not as a fourth stacked insight here. Three broker insights on one tile is the outer limit.

---

# TILE 2 — WHAT'S LEFT OVER EACH MONTH

**Section A — your position**

```
Take-home pay, both of you       $9,920/month
Living costs                     $4,900/month
Housing repayment                $3,890/month
Minimum payments, other debts    $1,484/month

What's left over                  -$354/month
```

**Section B — how this figure is worked out**
What's left over is what remains once everything that has to be paid has been paid. The figure here starts from take-home pay rather than gross, then takes off your living costs, your housing repayment, and the minimum payments on any other debts you carry. It doesn't account for the irregular things, the car registration or the school costs that land a few times a year, so the real figure across a full year is usually a little lower.

---

### 2.1 — What your spare money could be doing → financial planner / accountant

**Why this is worth a conversation**
Most people have never seen this number. Not because it's hard to work out, but because nobody ever sits down and does it. Whatever is genuinely left over after everything is paid is the part of your finances with the most room in it, because it's the only money that isn't already promised to something. What it ends up doing, over the years it builds up, quietly decides a lot.

**What a look at this can turn up**
This is the one part of a household's money where the conversation is about possibility rather than repair. Spare money can go to plenty of places. More into super. Investments held outside super. Something set aside for the kids. Paying the mortgage down faster. A first investment property. Sometimes it's a holiday people had assumed was out of reach and it turns out isn't. Which of those is worth doing depends entirely on what you actually want, and that is the conversation.

**The part most people don't realise**
Spare money that stays in the account it landed in tends to get spent. Not on anything memorable, it just goes. That isn't a discipline problem, it's that money sitting next to your spending money behaves like spending money. The households that build something out of their surplus are almost always the ones where it moves somewhere separate automatically, before they see it.

On cost, a first conversation with a planner is usually about seeing whether it's a fit, so you find out what ongoing help would run to before committing to anything.

**How the professional works**
A financial planner helps you work out what your spare money could be working toward, based on what matters to you rather than a standard plan. An accountant comes into it where tax or the way your income is structured does. A first conversation is usually about understanding your situation, not signing you up to anything.

**There's nothing you need to know or prepare**
You don't need a goal figured out, or a plan, or the right words for what you want. Working out what you actually want is a large part of what this conversation is for. Finn has already built the picture and passes it on, so you can turn up unsure, which is completely normal, and still get somewhere useful.

→ *Find a financial planner*

---

### 2.2 — When there's nothing left over → no paid referral

*Fires when surplus is zero or negative and computable. Never fires where surplus is null, which means the inputs were ambiguous rather than the money being tight.*

**Position line**
On these figures, what goes out each month is a little more than what comes in.

**The figure is a snapshot, not a verdict**
This number is built from what you told Finn about a typical month. It doesn't know about the quiet months, or the ones where the car registration and the school costs land together. Most households come out differently across a full year than they do in any single month, so the useful thing here is the shape of it rather than the precision.

**Where the gap usually comes from**
For most households it isn't one big thing. It's that the regular costs have crept up over a few years while the income hasn't, or that direct debits set up at different times have quietly accumulated. Debts with high minimum payments do it faster than anything else, because those minimums come out before anything is left.

**What people do about it**
Only two things move this number, what comes in and what goes out, and neither is a small thing to change. What tends to help first is seeing every regular payment in one place, because the ones people find are almost always the ones they'd forgotten they were still paying for.

**There's no referral here, and that's deliberate**
Finn doesn't have anyone on its list for this one. Planners don't generally take on work at this scale and the fee would be larger than the problem, and we won't point you at the businesses that advertise debt help. So instead of a referral, that's what's worth knowing.

**If it's causing real stress**
Financial counsellors are free, they're on your side entirely, and you don't have to be in crisis to call one. The National Debt Helpline is 1800 007 007. There's no cost and no catch. It's there if you want it.

> **Build note.** No action button. No professional card on the who-to-see view. The counsellor is named as available, never prescribed. Tone is the whole risk here: someone tight but coping should not feel diagnosed.


> **Build note.** The list of options in block two is safe because it is long and unranked. If it is ever ordered or trimmed to two or three, it starts to read as a suggestion. Keep it flat.

---

# TILE 3 — YOUR SAFETY NET

**Section A — your position**

```
Accessible savings                $14,200
Monthly living costs               $7,900
Cover                            1.8 months
Where it sits                     savings account, not linked to the loan
```

The months figure is arithmetic on their own data, so it is pure fact. It hits harder than any benchmark would, and it lets the planner supply the target.

**Section B — what this figure counts**
Your safety net is money you could reach quickly, without selling anything or asking anyone's permission. The months figure is that amount divided by what a month of your life costs, so it's expressed as time rather than dollars. It counts only money you already hold. Credit you could draw on isn't included, because that belongs to a lender rather than to you.

---

### 3.1 — How long your safety net would last → financial planner

**Why this is worth a conversation**
If your income stopped tomorrow, through illness, redundancy, or something nobody plans for, your safety net is what you'd live on until things settled. The useful way to think about it isn't a dollar figure, it's time. How many months of your actual living costs could you cover without earning anything. That's the difference between a rough patch and a real problem, and most people have never once worked it out.

**What a look at this can turn up**
There's no correct answer here, because it isn't really a maths question. It's a question about how much certainty you want. Someone with secure work, no dependants and a partner still earning is in a different position from a sole earner with a mortgage and three kids. What's enough for you depends on what your life costs and how much runway lets you sleep. That's the conversation, and it's a short one.

**The part most people don't realise**
Plenty of people are quietly counting something as their emergency fund that isn't really theirs. An unused credit card limit, or money they could redraw from the mortgage. Both of those belong to the lender, and both can be reduced or withdrawn without much notice. Lenders also tend to reassess when someone's circumstances change, which is the same moment you were relying on it. A safety net is money you already hold and can reach on your own.

On cost, a first conversation with a planner is usually about seeing whether it's a fit before anything ongoing is involved.

**How the professional works**
A financial planner helps you land on a number that suits your situation, and if there's a way to go, how to build towards it over time without pulling everything else apart. A first conversation is about understanding your situation, not selling you something.

**There's nothing you need to know or prepare**
This is one of those things people avoid because facing it feels heavy. It doesn't have to be. Finn has already worked out where you stand, and can pass that straight on, so you're not sitting there trying to explain a situation you've never had laid out before. You just turn up, already understood.

→ *Find a financial planner*

---

### 3.2 — Where your safety net sits → mortgage broker

**Variant A — has a mortgage with an offset, buffer money sitting outside it**

**Why this is worth a conversation**
A safety net has to stay reachable, which is why most people keep it in a savings account. That's the instinct everyone's taught. What far fewer people are told is that if you have a mortgage with an offset, money sitting in the offset stays exactly as reachable as it is in savings. You can get at it the same day. It isn't locked away, it isn't invested, and it doesn't stop being your emergency fund.

**What a look at this can turn up**
The two accounts do different things with the same money. Every dollar in an offset reduces the balance your loan charges interest on, for as long as it sits there. A dollar in a savings account earns interest at whatever rate that account pays. Both keep the money available to you. Which one is doing more comes down to the rate on your loan against the rate on the account.

**The part most people don't realise**
There's a tax difference almost nobody hears about. Interest you earn in a savings account is income, so it's taxed at your marginal rate and you only keep part of it. Interest an offset saves you isn't income at all, so there's no tax on it. The two aren't really comparable on their headline rates, before you even compare the rates themselves.

**How a mortgage broker helps here**
A broker can walk you through how your particular offset works, how much can sit in it, and how your accounts can be arranged so your safety net stays entirely available. This is routine work for them.

**There's nothing you need to know or prepare**
You don't need to understand any of this beforehand, that's what the conversation is for. Finn passes on where your money currently sits, and they explain the rest in ordinary terms. No homework.

→ *Find a mortgage broker*

**Variant B — has a mortgage, no offset**

Shorter, and it hands the whole question over. Suggesting a person would be better off with a different loan is credit assistance, so Finn states only that the question exists.

> An offset is a loan feature rather than a separate product. Some home loans come with one, some don't, and some charge for it as part of a package. Whether your loan has one available, and what it would mean on your particular loan, is a question for a broker. It costs nothing to ask, because they're paid by the lender.

---

# TILE 4 — YOUR SUPER

**Section A — your position**

```
Your super
  Fund not identified           $118,000    insurance inside: not known
  Old job                        $41,000    insurance inside: not known

Partner's super
  Employer default               $55,000    insurance inside: not known

Total                           $214,000
Extra contributions             none recorded
```

**Section B — how super accounts work**
Super is money held for you until retirement, in one account or several. Each account charges its own fees, taken out of the balance rather than billed to you, so they're easy not to notice. Accounts can also hold insurance inside them, with the premiums coming out of the balance the same way.

---

### 4.1 — More than one super account → financial planner

**Why this is worth a conversation**
When super is spread across more than one account, each account usually charges its own set of fees, and over the decades super runs, paying two or three sets instead of one quietly adds up. Bringing accounts together is something a lot of people mean to get to and never do, partly because it's not obvious how, and partly because there's a catch worth knowing about first.

**What a look at this can turn up**
Each account charges its own fees, so holding three means paying three sets rather than one. Over the length of a working life that difference is real money. People also often turn up an account they'd lost track of entirely, since every super account in your name is tied to your tax file number and visible in one place through myGov, along with any super the ATO is holding from accounts that went inactive.

**The part most people don't realise**
Super accounts often have insurance sitting inside them, and with more than one account you can end up paying for the same cover twice. That matters most with income protection, because it generally only ever pays up to a set share of your income no matter how many policies you hold. Two premiums, one payout.

It runs the other way too. Closing an account to consolidate can cancel cover you didn't know you had, sometimes cover that would be hard or costly to replace. Between those two, checking what's inside each account before anything moves is the single reason this is worth a short conversation rather than a form you fill in blind.

**How the professional works**
A financial planner can look at what's in each account, including any cover held inside them, and help you bring things together without costing you something you didn't know you had. A first conversation is usually about understanding what you've got.

**There's nothing you need to know or prepare**
You don't need to know which account has what, or whether you've got insurance inside your super, that's exactly what they work out. Finn passes on what you've gathered, and the rest is their job. You just turn up.

→ *Find a financial planner*

> **Build notes.** The "lower cost setup is available" line from the July draft is removed. It was a stated benefit of consolidating, attached to their account count. The fee arithmetic delivers the same information without the verdict.
>
> Insurance detail belongs to Tile 5. Here it appears only as a handle-with-care flag.
>
> The myGov line gives away something the person could act on without a referral. Kept deliberately — the honesty is what makes the rest credible, and the careful part still needs the planner.

---

# TILE 5 — PROTECTION

**Section A — your position**

```
Life cover                $500,000    inside super (AustralianSuper)
TPD cover                 $150,000    inside super (AustralianSuper)
Income protection         none recorded
Trauma cover              none recorded

Premiums for the cover you hold are deducted from your super balance
Household: two adults, two children aged 8 and 11, one income of $142,000
Mortgage outstanding: $612,000
```

**Section B — what that cover does**
Life cover pays a lump sum if you die. Total and permanent disability cover pays if you're permanently unable to work again. Income protection is a different thing again, it replaces part of your income month to month while you're unable to work, and stops when you go back. They're three separate events, and holding cover for one doesn't cover you for the others.

---

### 5.1 — The cover that protects your household → risk specialist / financial planner

**Why this is worth a conversation**
Protection is the cover that steps in if something serious happens, if you couldn't work for a long stretch, or if you weren't around anymore. For a household with a mortgage and people who depend on that income, it's what stands between a hard situation and a much harder one. It's also one of the most commonly skipped corners of a household's finances, not because people don't care, but because it's uncomfortable to think about and easy to leave for another day.

**What a look at this can turn up**
Most people have some cover already and have never looked at what it actually does. Whether it pays a lump sum or a monthly amount. How long it keeps paying. How long you'd be waiting before it started. What would need to be true for a claim to be accepted. Those details are the entire product, and knowing them rather than assuming them is the point of the conversation.

**The part most people don't realise**
A lot of Australians have cover inside their super without ever choosing it, and there are two things worth knowing about that kind of default cover.

The first is that it isn't sized to your household. It doesn't know you have a mortgage, or three kids, or that you're the only one earning. The amount is set by the fund, not by your situation.

The second is that it can switch off. If no contributions go into a super account for long enough, the insurance inside it can be cancelled automatically, and people generally find out long after it happened.

There's also a cost that's easy to miss. Premiums for cover held in super come out of your super balance, so it isn't free, it's just paid from somewhere you never look.

**How the professional works**
A risk specialist or financial planner works out what cover you actually hold, what it would pay and when, and where the gaps sit for a household like yours. They're generally paid by the insurer rather than by you, so understanding what you've got usually costs nothing. A first conversation is about your situation, not pressure.

**There's nothing you need to know or prepare**
This is a heavy one to sit with, which is exactly why people avoid it for years. You don't need to have thought it through, or know what cover you have, or have the answers. Finn has laid out where you stand, and can pass it on, so the conversation starts from something real instead of a blank and daunting page.

→ *Find an insurance specialist*

> **Build note.** "Financial catastrophe" and "a gap that would matter a great deal at the worst possible moment" are both removed. Fear-selling is off-brand for a product built on calm, and the second phrasing edged toward characterising their exposure.

---

# TILE 6 — YOUR WILL AND ESTATE

**Section A — your position**

```
Will                              in place, last updated 2014
Enduring power of attorney        none recorded
Guardianship for the children     none recorded
Super death benefit nomination    none recorded

Household: two children, aged 8 and 11
```

**Section B — what each of these does**
A will directs what happens to what you own. An enduring power of attorney lets someone you choose make decisions on your behalf if you're unable to, while you're still alive, which a will doesn't cover. Guardianship names who would raise your children. A super nomination directs your super, which is dealt with separately from your will.

---

### 6.1 — Your will and the legal basics → estate planning lawyer

**Why this is worth a conversation**
This is the paperwork that decides what happens to your money, your home, and, if you have children, who looks after them, if something happened to you. A will, an enduring power of attorney, guardianship for the kids, and the nomination on your super. Almost everyone means to get these sorted. Most haven't, and most underestimate how much simpler it is than they fear.

**What a look at this can turn up**
For a lot of households, some or all of this isn't in place, or hasn't been looked at in years, since before the kids or a house move or something else that would change what you'd want. Where there's no will at all, the law has a fixed formula for who gets what, set by the state, and it doesn't know anything about your family. Getting this sorted tends to bring a particular kind of relief, because it's been sitting quietly on the conscience for a long time.

**The part most people don't realise**
Your super usually isn't covered by your will. It's directed by a nomination made on the super account itself, and if there's no valid nomination in place, the fund's trustee decides where it goes under its own rules. Not your will, not your family.

There's a second half to it that catches even the organised. Most nominations expire after three years unless the fund offers a non-lapsing one. Plenty of people who did the right thing at some point are sitting on a nomination that quietly stopped being valid, and nothing tells you when that happens.

**How the professional works**
An estate planning lawyer prepares these documents so they actually do what you intend. For a straightforward situation it's often quicker and more affordable than people expect, because they do this every day.

**There's nothing you need to know or prepare**
You don't need to have decided anything, or understand the legal side, or have your affairs "in order" before you go, sorting it out is the whole point of the appointment. Finn passes on your picture, and they guide the rest.

→ *Find an estate planning lawyer*

> **Routing decision.** Direct to the estate lawyer, not via a planner. The lawyer charges the same either way, so a planner in between adds a fee rather than removing one. The estate trigger is also the highest-intent referral in the product, and inserting a step at the moment someone is finally motivated will lose most of them. Above all, routing through the leg that pays would breach the independence principle.
>
> Expect a smaller referral fee here than on a broker leg, and accept it. Not every referral has to earn. This is likely the strongest word-of-mouth generator in the set.

---

# TILE 7 — YOUR INVESTMENTS *(conditional)*

**Section A — your position**

```
Investment property           $640,000    estimated value
  Loan against it             $410,000    5.89%, interest only
  Equity                      $230,000
  Rent                        $2,340/month

Shares and ETFs                $84,200    held in one name
Managed funds                 none recorded
```

**Section B — how these work**
An investment property has its own value, its own loan and its own equity, in the same way your home does. The rent it earns is income, and the interest on its loan is treated differently at tax time from the interest on the loan for the home you live in. For shares and funds, what they earn is taxed at the marginal rate of whoever the asset is held by, so whose name is on it changes what it costs.

---

### 7.1 — Your investment property → mortgage broker / financial planner / accountant

**Why this is worth a conversation**
An investment property comes with its own loan, its own equity, and its own tax picture, and each of those is worth keeping current in the same way your home loan is. The rate and structure on an investment loan can drift out of date just like any other, and the tax side has its own moving parts.

**What a look at this can turn up**
People often find the loan on an investment property hasn't been reviewed in years, or that there are tax questions they've never had properly answered. Seeing the property, its loan, and its equity laid out alongside everything else is often the first time it all sits in one place.

**The part most people don't realise**
The interest on a loan for an investment property is generally deductible against the income the property earns. The interest on the loan for the home you live in isn't. That's why two loans that look identical on a statement aren't really the same kind of debt, and it's the reason the two get treated very differently at tax time.

The other one that catches Victorian investors is land tax. The home you live in is generally exempt. An investment property generally isn't, and the thresholds have moved in recent years, so people who bought a while ago have found themselves paying something they never used to.

**How the professionals work**
A mortgage broker handles the loan and how it's structured. A financial planner helps with how the property fits your bigger picture and goals. An accountant handles the tax side. Which one you start with depends on what you're weighing up, and Finn points you to the right one.

**There's nothing you need to know or prepare**
You don't need to have the numbers at your fingertips or understand the tax rules. Finn has it all captured, and passes it on, so whoever you see starts from a full picture, not a standing start.

→ *Find the right professional*

---

### 7.2 — Your investments and how they fit → financial planner

**Why this is worth a conversation**
Once you've built up investments outside your home and super, the useful question stops being what you own and becomes whether the way it's put together still suits what you're trying to do. How it's spread across different types of assets. How much risk sits in it. How it lines up with your timeframe and with what's already in your super. Whether it's doing what you expected it to. Those are the questions a financial planner is for, and most people have never had them properly asked.

**What a look at this can turn up**
Seeing everything you hold, and how it's spread, laid out in one place is clarifying on its own. Most people have never actually seen it that way. It's also common for the mix to have drifted from what it started as, simply because some things grew faster than others. That's just what happens over time, and it's one of the things a review looks at.

**The part most people don't realise**
Whose name an investment is held in changes what it costs you. Earnings are taxed at the marginal rate of whoever owns the asset, so the same portfolio can produce quite different after-tax outcomes in one person's name, in both names, or held some other way. Ownership is usually decided in the first ten minutes of opening an account and rarely looked at again.

There's a practical one too. Every purchase, sale and reinvested dividend needs a record kept for tax, going back to when you bought. People who've had a portfolio for a decade are often reconstructing it from old emails when they finally come to sell.

**How the professional works**
A financial planner looks at what you hold alongside your goals, your timeframe, and the rest of your picture, and helps you think about how it all fits together. A first conversation is about understanding your situation, not moving your money around.

**There's nothing you need to know or prepare**
You don't need to justify what you hold or know whether it's "right", that's not what this is. Finn has laid out exactly what you've got and how it's spread, and passes that on, so the conversation starts from a clear and complete picture.

→ *Find a financial planner*

> **Build notes.** Allocation and holdings shown as fact is clarity, and permitted under the locked architecture. Grading them is not. Both remain intact here.
>
> **Do not compute performance.** A return figure invites a benchmark, and a benchmark is a grade. It also needs cost base and purchase dates Finn will not hold reliably, and a wrong number is worse than no number. Performance is named as part of what a review covers, and left to the planner.
>
> If a company or trust exists, the ownership block stands down in favour of Tile 9.

---

# TILE 8 — YOUR OTHER DEBTS *(conditional)*

**Section A — your position**

```
Credit card              $6,200     19.99%    minimum $124/month
Personal loan            $9,800     13.50%    $410/month
Car loan                $18,400      8.90%    $640/month
Buy now pay later        $1,340         —     $310/month

Total                   $35,740              $1,484/month
```

**Section B — how these work**
The minimum repayment on a credit card is calculated as a small percentage of the balance, which means most of an early payment goes to interest rather than the debt. It's why a balance at 20% moves slowly even when the minimum is met every month.

---

### 8.1 — Your other debts

**Routing splits three ways.**

| Situation | Route |
|---|---|
| Genuine hardship | Financial counsellor, overriding everything below |
| Has a mortgage | Mortgage broker |
| No mortgage | Financial counsellor, or education only. No paid referral. |

---

**Why this is worth a conversation**
Debts like credit cards, buy-now-pay-later, car loans, and personal loans work very differently from a mortgage, they usually carry much higher interest, and they're often the debt that quietly does the most damage to a household's month. Because they build up in bits and pieces, it's easy to lose track of the whole picture, which is often the first useful thing to see clearly.

**What a look at this can turn up**
Seeing these in one place, rather than scattered across four statements, is often a relief in itself. Bringing them together or restructuring them is a common way through, and it's a conversation worth having properly rather than acting on an ad.

**The part most people don't realise**
Rolling shorter debts into the mortgage almost always lowers what you pay each month, because the same amount gets spread over twenty or thirty years instead of three or five. Lower monthly cost and lower total cost are not the same thing. A debt of $30,000 moved onto a thirty year loan at a lower rate can cost more in total interest than clearing it over four years at a higher one. It's the time that does the damage, not just the rate.

The part that catches people is what happens afterwards. Once the debt sits inside the mortgage there's no separate balance to look at and no separate payment to make, so the pressure to clear it quietly disappears and it rides along for the full term. The households where consolidating works well are almost always the ones who keep paying what they were paying before, so the debt still goes in a few years rather than thirty.

There's a second change worth knowing. Debts like a credit card or a personal loan are unsecured. Rolled into the mortgage, they become secured against your home. That doesn't make it the wrong move, plenty of households do it deliberately and it works. It does mean the consequences of a bad year are different afterwards, and it's the part that tends not to get explained.

**How the professional works**
A mortgage broker can look at whether consolidating or restructuring makes sense for your situation. It's someone helping you find a way forward, not judging how you got here. People who do this all day have seen every version of it. The broker conversation is usually free to you.

**There's nothing you need to know or prepare**
This is one people avoid out of a bit of shame, and there's genuinely no need. Finn has it laid out plainly, and passes it on, so you don't have to explain or account for anything, you just turn up and get help finding the way forward.

→ *Find a mortgage broker*

---

**Where there is no mortgage — education, no paid referral**

There is no good paid professional for consumer debt in Australia when there's no mortgage in the picture. Planners won't take it, the fee is larger than the problem, and the gap is where debt management firms and Part IX operators live. Finn says so, and gives the person what they can actually use.

**The two ways people work through debts like these**
One is to put everything spare against the debt charging the highest rate, and work down. That costs the least in interest. The other is to clear the smallest balance first, regardless of rate, so the number of debts drops quickly. That costs a bit more but people are more likely to stick with it. Both are well established, and which suits you has more to do with how you're wired than with the maths.

**Hardship is a right, not a favour**
Every credit provider in Australia is legally required to consider a hardship request. You can ask for a payment pause, a reduced payment, or more time, and they have to respond. It doesn't cost anything, and it's a formal process rather than a negotiation you have to win. A lot of people don't know it exists, or assume it's only for people in serious trouble.

**Balance transfers, and the part that catches people**
A balance transfer moves a card balance to a new card at a low or nil rate for a set period. What tends to catch people is what happens at the end, when the rate reverts, and that new purchases on the card generally aren't covered by the offer. They work well for people who clear the balance inside the period and poorly for people who don't.

**And a free option worth knowing about**
Financial counsellors are free, they're on your side entirely, and you don't have to be in crisis to call one. The National Debt Helpline is 1800 007 007. There's no cost and no catch.

> **Conflict note, to be kept honest permanently.** In the has-a-mortgage case, Finn earns a fee from a broker on a transaction Finn has just cautioned against. The warning is what resolves that conflict. It stays as written, including the day someone points out that softening it would lift conversion.
>
> **The referral never to take.** Debt management firms and Part IX debt agreement operators will find this gap and will offer well for it.

---

# TILE 9 — HOW YOUR INCOME IS MADE UP *(core — everyone sees this tile)*

**Section A — your position**

```
Salary                          $92,000     PAYG, tax withheld by employer
Business income                 $54,000     sole trader
Rental income                   $28,080     investment property

Total                          $174,080

Structure                       sole trader, no company or trust recorded
Employer super                  paid on the salary portion only
```

The tile shows for everyone, because the total is a number most households have never seen in one place, and seeing it is worth something regardless of whether anything routes from it. Two PAYG salaries and nothing else produces a clean tile and no referral.

**Section B — how these are treated differently**
Income from an employer has tax taken out before it reaches you, and the employer pays super on top of it. Income you earn for yourself arrives whole, with the tax on it settled later, and no super attached unless you arrange it yourself. The total here is annual and before tax, so it won't match what actually lands in your account each month.

---

### 9.1 — How your income is set up → accountant

*Fires on structural complexity only: business income, contracting or ABN work, a trust or company. Not on rent or dividends, which belong to Tile 7.*

**Why this is worth a conversation**
When some of your income comes from something other than a regular salary, a business, side work, an investment, or a trust, how it's all structured starts to matter for tax in a way it simply doesn't for a straightforward wage. It's an area where the right setup can make a genuine difference, and where a lot of people are running on an arrangement they set up years ago, or never deliberately set up at all.

**What a look at this can turn up**
An accountant often spots questions worth asking about how income like yours is handled, things that aren't obvious unless you do this for a living. Sometimes it's already fine. Either way you stop wondering whether you're missing something.

**The part most people don't realise**
When income comes from somewhere other than an employer, no tax is withheld along the way. The first year that happens, the bill arrives all at once. What catches people is the year after, because once the ATO has seen it, you're generally moved onto quarterly instalments, and it's common to be paying last year's bill and this year's instalments across the same few months. It isn't extra tax, it's the timing catching up. It's also the single most common reason people with income like yours get caught short.

The other one is super. When you're employed, someone else is putting money into your super whether you think about it or not. On income you earn for yourself, nobody is, unless you do it deliberately. Years of self-employed income can pass with very little going in, and it doesn't show up anywhere until you look.

**How the professional works**
An accountant looks at where your income comes from and how it's structured, and helps with tax, deductions, and whether the setup still suits your situation. A first conversation is about understanding what you've got.

On cost, accounting fees are generally deductible, so part of it comes back. What an accountant charges varies a lot, and a first conversation is usually about understanding what you've got before anything is agreed.

**There's nothing you need to know or prepare**
You don't need to understand the tax side or have anything organised, that's what they're for. Finn passes on how your income is made up, and they take it from there.

→ *Find an accountant*

> **Build note.** For two PAYG earners with no other income there is very little an accountant can do, and no referral fires. The main lever in that situation is super contributions, which is a planner conversation driven by goals. **Finn must not raise it.** Super is a financial product and pointing a PAYG earner toward contributions as a tax lever is product advice. Finn shows the income; the planner opens that door.

---

# PART THREE — NON-TILE ROUTES

## Distress → financial counsellor (free)

Handled in the conversation, not as a tile. Fires on judgment, which is one of the two permitted exceptions to deterministic triggering.

> If money is genuinely tight right now, and it's causing real stress, the most useful person is a financial counsellor. They're free, they're on your side entirely, and they help people work through exactly this. You can reach the National Debt Helpline on 1800 007 007. There's no cost and no catch, and it's a good place to start.

## Property strategist → pull only, never push

Property strategists and buyers' agents sit in the least regulated corner of Australian financial services. Direct property is not a financial product, so no AFSL applies, which is precisely why the category attracts spruikers. One bad property referral would do more damage to Finn than every other referral combined.

**Four conditions:**

1. Never appears as a suggested action on any tile. It exists only if the person asks for it.
2. Same vetting standard, applied harder. If nobody meets it, the honest answer is that Finn doesn't have anyone on the list for that yet. The refusal is itself a trust signal.
3. Never added because someone offered to pay. This is the category where the largest referral fees in the country get offered, and it is exactly what the independence principle exists for.
4. The request triggers education before it triggers a name.

**The education, which is the real value here:**

> **Before you speak to anyone about property**
> This is one area worth understanding before you start, because it's the least regulated corner of the industry. Anyone can call themselves a property strategist or a property investment adviser. There's no licence behind those titles the way there is for a financial planner or a mortgage broker.
>
> The thing to work out is who's paying them. A buyer's agent you pay a fee to is working for you, and in most states holds a real estate licence. A strategist whose service is free to you is generally being paid a commission by whoever is selling the property, often a developer, which means the properties you get shown are the ones that pay. Both arrangements exist and both are legal. They're just very different, and the difference is rarely volunteered.
>
> Ask directly, early: who pays you, how much, and does it change depending on which property I buy.

**v1 position:** investment property routes to accountant, broker and planner. No property strategist on the list.

---

# PART FOUR — REFERRAL DISCLOSURE AND VETTING

The referral exemption requires disclosure of any benefit Finn receives. This copy sits near every find-a-professional action, and it is a trust asset rather than a compliance chore.

**Full version**

> **How this works**
>
> When you connect with someone through Finn, that professional usually pays Finn. It's fair you know that before you click anything.
>
> What that payment doesn't do is decide who's on the list. Nobody buys their way onto it, and nobody moves up it by paying more. People get on the list because they're good at what they do, because they're straight with people, and because they understand households like yours rather than only chasing the big end of town. We meet them first, and we keep an eye on how people find them afterwards.
>
> The test is simple. If we wouldn't send our own family to them, they don't go on the list.

**Short version, sitting under a referral action**

> Finn is paid by the professionals on our list. What they can't do is buy their way onto it. We meet everyone first, and if we wouldn't send our own family to them, they're not there.

**This copy is a promise, and under Australian Consumer Law an unkept promise is misleading conduct.** A real vetting process has to exist behind it, with a record. Worth doing regardless: it makes the claim true, it gives Charlie something concrete supporting the referral exemption position, and it is what stops the list degrading the first time someone offers a bigger cut.

**Vetting standard to be written, covering at least:** licence and registration verified; no adverse regulatory history; a household-scale test rather than high-net-worth-only service; a conversation before anyone goes on; and a stated basis for removal.

---

# PART FIVE — OUTSTANDING

**Documents that do not exist yet**

1. **Trigger rule table.** One row per insight: condition, fields read, variant selected, precedence. Built from, and reviewed by Charlie alongside this copy.
2. **Vetting standard.** Per Part Four.
3. **Household context layer.** Flagged in the previous session and still open: the conversation opening that gathers ages, kids, work intentions and horizon, and the dashboard context header that frames the tiles and travels with every referral.

**The question for Charlie**

Not "can Finn give insights." Precisely this:

> Does factual product information, displayed conditionally on the basis of captured personal financial data, constitute personal advice under s766B?

If the answer is no provided no conclusion is stated, build exactly what is in this document. If the conditional display is itself the opinion, the fix is showing every tile to everyone and letting the numbers differ, which is a build decision worth knowing before the 3c rebuild rather than after.

**Also brief him on the NCCP.** Tiles 1, 3, 7 and 8 involve credit, which is a separate regime with its own licence and its own referral exemption.

**Still open in UX:** referral flow, tier-gating model.

---

---

# PART SIX — PROFESSIONALS AND CALM BLOCKS

## 6.1 Professionals registry

Cost belongs to the professional, not the insight, so it renders once on the who-to-see view rather than repeating under every insight. `role` is the one-line description on the professional card.

### mortgage_broker
- **role** — Looks across a lot of lenders at once rather than one, and handles the comparison and the paperwork.
- **cost_pill** — Usually free
- **cost_line** — Most brokers charge you nothing. They're paid a commission by the lender when a loan settles. A few charge a fee in complex situations, and they have to tell you before you start.

### financial_planner
- **role** — Helps you work out what you're aiming at and how the pieces fit together, based on what matters to you.
- **cost_pill** — Varies
- **cost_line** — Usually a first conversation at no cost to see whether it's a fit. If you go ahead there's a fee for the written advice, and often an ongoing fee if you keep them on. The amounts vary a lot, and they tell you before anything is agreed.

### insurance_specialist
- **role** — Works out what cover you actually hold, what it would pay and when, and where the gaps sit for a household like yours.
- **cost_pill** — Usually free
- **cost_line** — Generally paid a commission by the insurer rather than a fee by you. Some charge a fee instead, and will say so upfront.

### estate_lawyer
- **role** — Prepares the documents that decide what happens to what you own, and who looks after the children, so they actually do what you intend.
- **cost_pill** — Fixed price
- **cost_line** — Usually a set price for a will and the related documents, quoted before they start. For a straightforward situation it's often less than people expect.

### accountant
- **role** — Looks at where your income comes from and how it's structured, and handles the tax that follows from it.
- **cost_pill** — Fee, often deductible
- **cost_line** — A fee for the work, often a set price for a return and hourly for advice. Accounting fees are generally deductible, so part of it comes back.

### financial_counsellor
- **role** — Free, independent help for people having trouble with debt. Not a salesperson and not a lender.
- **cost_pill** — Free
- **cost_line** — Free, always. They're on your side entirely, and you don't have to be in crisis to call one.

---

## 6.2 Calm blocks

Structure per tile: `statement`, `why`, `what_would_change[]`, `closing`.

**Never** a tick, a green anything, "you're in good shape", or a completion state. The `why` describes a property of the situation type, never a judgment of the person.

### Which tiles can actually go calm

Only four. Tiles 2, 3, 5, 7 and 8 can never go calm and need no copy — the renderer should never expect a block for them.

- 2 — 2.1 fires on positive surplus, 2.2 on zero or negative. Every computable surplus routes somewhere. A null surplus is "still building", not calm.
- 3 — 3.1 fires wherever expenses were captured.
- 5 — 5.1 fires wherever the protection domain was reached.
- 7 and 8 — conditional tiles. If the tile shows, holdings or debts exist, so something fires. Hardship on Tile 8 substitutes the counsellor route rather than emptying it.

### Tile 1 — home and mortgage

- **statement** — Nothing here routes to anyone.
- **why** — With no loan against the place there's no rate to review, no structure to look at and no lender in the picture. A home owned outright is the simplest position this tile can hold.
- **what_would_change**
  - Borrowing against the property for any reason
  - Buying somewhere else while keeping this one
  - Using what you own of it to fund something
- **closing** — Any of those brings a lender back into the picture, and that's when a broker becomes useful again.

### Tile 4 — your super

- **statement** — Nothing here routes to anyone.
- **why** — One account each. Fees come out of one balance rather than several, and there's no second account quietly holding cover you'd forgotten about. That's the simplest way super can sit.
- **what_would_change**
  - Changing jobs, where a new employer opens their default fund
  - Starting to work for yourself
  - Turning up an old account you'd lost track of
- **closing** — Super accounts open far more easily than they close. A new job with a new default fund is how most people end up with two without ever deciding to.

### Tile 6 — your will and estate

- **statement** — Nothing here routes to anyone.
- **why** — A will, an enduring power of attorney, guardianship and a super nomination, all in place and none of them old enough to have drifted from what you'd want. That's the full set.
- **what_would_change**
  - A child arriving
  - A separation, or a new relationship
  - Buying or selling a property
  - Your super nomination reaching three years old
- **closing** — The nomination is the one with a clock on it. Most expire after three years unless the fund offers a non-lapsing one, and nothing tells you when that happens.

### Tile 9 — how your income is made up

- **statement** — Nothing here routes to anyone.
- **why** — When income comes from an employer, the tax is settled before it reaches you and super goes in on top automatically. There's no structure sitting underneath it to review, so there's no conversation to have.
- **what_would_change**
  - Contracting or work under an ABN
  - A business, however small
  - Rent from a property
  - Money paid through a trust or a company
- **closing** — Each of those brings tax you settle yourself rather than an employer settling it, and super nobody pays for you unless you arrange it. That's when this becomes an accountant's conversation.

---

*Fourteen insights across nine tiles. Reviewed and signed off tile by tile, August 2026.*