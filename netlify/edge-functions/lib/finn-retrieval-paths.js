/* Retrieval paths — DATA, not prompt (capture-conduct Part Two, build
   step 3) — and the templated asks assembled from them (build step 4).

   One entry per path id (the ids the field registry's `paths` arrays point
   at). Each path carries: where the document lives, what it is called in
   plain words, what to look for on it, what to be honest about, and the
   read-it-to-me offer. The model is handed this text and NEVER composes
   it: adding a bank, a broker or a valuation source is a data change
   reviewed once, not a prompt change hoped for every session.

   One visit, not three: a path declares every field it can satisfy
   (`satisfies`), so sending someone to their banking app retrieves
   balance, rate, type, offset linkage, offset balance and minimum
   repayment together. Finn asks once and reads the screen once.

   CODE-WITNESSED SERVING: `witness` is an exact sentence fragment that
   appears verbatim inside the assembled ask. After each reply streams,
   code scans the visible text for these fragments and writes a
   path_served capture_log row per satisfied field (servedFieldIds below).
   A refusal is only valid against a code-witnessed path_served row in the
   same session, so if the model paraphrases instead of delivering the
   templated ask, no serve is witnessed and the persistence gate keeps
   blocking below-floor writes. Paraphrase fails safe.

   The deferral is never offered alongside the help: no template contains
   it, so there is nothing to detect. Softeners are structurally absent
   for the same reason.

   Wording discipline matches finn-bank-exports.js: "usually", because
   interfaces drift; where the person's screen disagrees, Finn trusts
   their screen. Devon reviews and refreshes this file; first written
   2026-09-10. */

export const RETRIEVAL_PATHS = {
  home_value: {
    name: "what the home is worth",
    where: "The quickest honest read is your lender's app or website, which usually shows their current estimate of the property, or your most recent council rates notice.",
    look_for: "Look for the estimated value or valuation figure. If it shows a range, keep the range, both ends matter.",
    honest: "A rates notice and most portal estimates lag the market, so the figure is a considered estimate rather than a sale price, and that is exactly how I will record it.",
    offer: "Attach a photo or screenshot of the estimate or notice here and I will read it, or read the figure to me exactly as it appears and tell me where it came from.",
    witness: "your most recent council rates notice",
    satisfies: ["home.value_estimate", "home.value_source", "investments.properties[].value_estimate"],
  },
  loan_details: {
    name: "the loan, from the loan screen",
    where: "Open your banking app or internet banking and go to the loan account itself.",
    look_for: "One screen usually carries everything we need together: the balance owing, the interest rate, whether it is fixed or variable and any fixed expiry, the repayment amount and how often, the remaining term, whether an offset account is attached and what is sitting in it, and the minimum repayment. If a package fee applies it usually shows on the loan summary or the latest statement.",
    honest: "If a figure is not on the screen, say so and we will leave it open rather than filling it in.",
    offer: "Attach a screenshot or PDF of that screen here and I will read it, or read them to me one by one, exactly as they appear.",
    witness: "go to the loan account itself",
    satisfies: [
      "home.mortgage_balance", "home.rate_percent", "home.rate_type", "home.lender",
      "home.repayment_monthly", "home.term_remaining_years", "home.has_offset",
      "home.offset_balance", "home.package_fee_annual", "buffer.linked_to_loan",
      "expenses.housing_repayment_monthly",
      "investments.properties[].loan_balance", "investments.properties[].rate_percent",
      "investments.properties[].repayment_type",
      "debts.items[].balance", "debts.items[].rate_percent", "debts.items[].minimum_monthly",
      "debts.items[].security",
    ],
  },
  investment_platform: {
    name: "the shares and funds, from the platform",
    where: "Log in to the platform or broker where the holdings sit, CommSec, Vanguard, Raiz, Stake, Selfwealth, whichever you use, and open the portfolio or holdings screen.",
    look_for: "Look for the total holdings value. For what the holdings paid you, the year's dividends or distributions usually sit under statements, reports or the annual tax statement.",
    honest: "Balances move day to day and that is fine, today's figure is the one we want. Payment-by-payment income adds up awkwardly, so the annual tax statement's total is the honest year figure.",
    offer: "Attach a screenshot of the portfolio screen or the statement here, or read the figures to me exactly as they appear.",
    witness: "open the portfolio or holdings screen",
    satisfies: ["investments.shares_value", "investments.managed_funds_value", "income.other[].amount_annual"],
  },
  payslip: {
    name: "the pay, from a payslip",
    where: "Have your most recent payslip in front of you, from your employer's payroll portal or wherever it lands in your email.",
    look_for: "Look for the gross pay and the net pay for the period, and the super section, which shows the employer contribution and any extra going in through salary sacrifice.",
    honest: "If pay varies period to period, say so, and we will use the figure that is actually typical rather than the best fortnight.",
    offer: "Attach the payslip here, a PDF or a photo both work, or read the figures to me exactly as they appear.",
    witness: "your most recent payslip in front of you",
    satisfies: [
      "income.salary_gross_annual", "income.salary_net_monthly",
      "income.partner_salary_gross_annual", "income.partner_salary_net_monthly",
      "income.employer_super_on", "super.extra_contributions",
    ],
  },
  super_statement: {
    name: "the super, from the fund itself",
    where: "Log in to your super fund's app or member portal, or have the latest annual statement in front of you. myGov also lists every account under the ATO section if you think there might be more than one.",
    look_for: "Look for the fund name, the current balance, whether insurance sits inside the account, and the beneficiary nomination: whether one is in place, whether it is binding or non-binding, and when it was made.",
    honest: "An annual statement's balance is at the statement date, not today. The portal shows the current figure.",
    offer: "Attach the statement or a screenshot of the portal here, or read them to me exactly as they appear, one account at a time.",
    witness: "app or member portal, or have the latest annual statement",
    satisfies: [
      "super.funds[].fund", "super.funds[].balance", "super.funds[].has_insurance",
      "estate.super_nomination.in_place", "estate.super_nomination.binding",
      "estate.super_nomination.last_updated",
    ],
  },
  policy_schedule: {
    name: "the cover, from the policy schedule",
    where: "The policy schedule is the page that lists each cover and its amount, from the insurer's portal or the document you were sent when the cover started. Where cover sits inside super, the fund's insurance page shows the same thing.",
    look_for: "Look for each cover type by name, life, TPD, income protection, trauma, the amount it would pay, and whether it is held inside super.",
    honest: "Cover through work or inside super is still cover, it just lives in a different place, and where it lives changes what happens to it if you change jobs or funds. That is why I ask where each one sits.",
    offer: "Attach the schedule here, or read each cover and amount to me exactly as it appears.",
    witness: "the page that lists each cover and its amount",
    satisfies: [
      "protection.life.amount", "protection.life.inside_super",
      "protection.tpd.amount", "protection.tpd.inside_super",
      "protection.income_protection.amount", "protection.income_protection.inside_super",
      "protection.trauma.amount", "protection.trauma.inside_super",
    ],
  },
  rental_income: {
    name: "the rent, from the lease or agent statement",
    where: "Have the lease in front of you, or the most recent statement from the managing agent.",
    look_for: "Look for the rent amount and how often it is charged. On an agent statement, look for the gross rent and the costs taken out as separate figures.",
    honest: "I record the gross rent and the costs separately, both as you give them, never netted together into one number.",
    offer: "Attach the statement or lease here, or read the figures to me exactly as they appear.",
    witness: "the most recent statement from the managing agent",
    satisfies: ["income.other[].amount_annual", "investments.properties[].rent_monthly"],
  },
  business_income: {
    name: "the business and entity income, from the year-end figures",
    where: "Have the most recent tax return in front of you, or the accountant's year-end figures.",
    look_for: "Look for the business profit, any distributions from a trust, and any director fees, each as its own line rather than one combined figure.",
    honest: "Last year's figures are last year's. If this year looks different, say so and we will record the figure with that context.",
    offer: "Attach the relevant pages here, or read each line to me exactly as it appears.",
    witness: "the most recent tax return in front of you",
    satisfies: ["income.other[].amount_annual"],
  },
  bank_statement: {
    name: "the cash, from the accounts it sits in",
    where: "Open your banking app and go to each account where savings or spare cash sits.",
    look_for: "Look for the current balance of each account, and note whether any of them is an offset or is linked against a loan.",
    honest: "If money sits across several accounts, each one counts. A figure from memory is usually the balance from a while ago.",
    offer: "Attach a screenshot of the accounts here, or read me the balance of each account exactly as it appears.",
    witness: "each account where savings or spare cash sits",
    satisfies: ["buffer.accessible_savings", "buffer.other_cash"],
  },
  living_costs: {
    name: "the spending, from a transaction export",
    where: "The fullest honest read of what goes out comes from a transaction export covering the last twelve months, and I can walk you through getting one from your bank.",
    look_for: "Once the file lands here, code does the arithmetic across the whole year, so one-off months do not distort the figure.",
    honest: "A guessed monthly figure is usually well under the real one, which is why the export is worth the two minutes.",
    offer: "Attach the file here when you have it, and I will read it straight away.",
    witness: "a transaction export covering the last twelve months",
    satisfies: ["expenses.living_monthly"],
  },
  hecs: {
    name: "the HECS balance, from myGov",
    where: "Log in to myGov and open the ATO section, then look for loan accounts.",
    look_for: "Look for the HELP or HECS account and its current balance.",
    honest: "The balance updates after each year's indexation and any repayments through tax, so the myGov figure is the current one.",
    offer: "Attach a screenshot of that page here, or read the balance to me exactly as it appears.",
    witness: "open the ATO section, then look for loan accounts",
    satisfies: ["debts.hecs_balance"],
  },
};

/* ── build step 4: the templated ask, assembled from the path data ──
   The ask is the four path sentences in fixed order. It contains no
   softener because none is in the data, and no deferral because it is
   not a thing Finn says. */
export function askFor(pathId) {
  const p = RETRIEVAL_PATHS[pathId];
  if (!p) return null;
  return [p.where, p.look_for, p.honest, p.offer].join(" ");
}

/* The prompt reference section, appended at request time like the bank
   export paths. The rules travel with the data they govern. */
export function retrievalPromptSection() {
  const entries = Object.entries(RETRIEVAL_PATHS)
    .map(([id, p]) => "- " + p.name + ":\n  \"" + askFor(id) + "\"")
    .join("\n");
  return "\n\n═══ RETRIEVAL PATHS (templated asks — delivered VERBATIM) ═══\n\n" +
    "You decide WHAT to ask about next; these decide HOW the ask for a document-backed figure is worded. When you ask for any figure below, deliver the matching ask text word for word. You may add warmth around it (before or after, in your own voice), but the ask text itself is delivered exactly as written: never reworded, never shortened, never composed fresh. Never offer to skip, defer or come back later as part of the ask; if the person declines, record the refusal in the [CAPTURE] block and move on without suggesting deferral yourself.\n" +
    "One visit covers everything its screen shows: when you send someone to a screen, take every figure it carries in that same visit rather than sending them back later.\n" +
    "Confidence after the visit: a file they attach and you read is \"document\". Figures they read off their screen and type to you are \"sighted\", never \"document\". Figures from memory stay \"stated\".\n" +
    "Interfaces drift: where the person's screen disagrees with these steps, trust their screen and guide by concept.\n\n" +
    entries;
}

/* ── code-witnessed serving ──
   Scan the visible reply text (before any machine block) for each path's
   witness fragment; whitespace differences from streaming are tolerated.
   Returns the field ids to write path_served rows for. */
export function servedFieldIds(visibleText) {
  // Whitespace and typographic-apostrophe differences from streaming or
  // model normalisation are tolerated; anything more is a paraphrase and
  // deliberately does NOT witness a serve.
  const norm = String(visibleText || "").replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  const fields = new Set();
  for (const p of Object.values(RETRIEVAL_PATHS)) {
    if (norm.includes(p.witness)) for (const f of p.satisfies) fields.add(f);
  }
  return [...fields];
}
