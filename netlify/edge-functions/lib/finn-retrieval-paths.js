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

   CODE EMITS THE ASKS, NOT THE MODEL (Devon, Sept 2026). The model emits
   a trigger token [ASK: <path_id>]; code intercepts it in the stream and
   substitutes the exact ask text assembled here, and writes the
   path_served rows for every field the path satisfies at the moment of
   substitution. The model never sees the ask copy, only the path ids and
   what each is for. An unrecognised path id in a trigger token is a
   fault, logged, and emits nothing. The earlier witness fragments and
   visible-text scanning are retired: code is the author, so witnessing
   is deterministic.

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
    satisfies: ["home.value_estimate", "home.value_source", "investments.properties[].value_estimate"],
  },
  loan_details: {
    name: "the loan, from the loan screen",
    where: "Open your banking app or internet banking and go to the loan account itself.",
    look_for: "One screen usually carries everything we need together: the balance owing, the interest rate, whether it is fixed or variable and any fixed expiry, the repayment amount and how often, the remaining term, whether an offset account is attached and what is sitting in it, and the minimum repayment. If a package fee applies it usually shows on the loan summary or the latest statement.",
    honest: "If a figure is not on the screen, say so and we will leave it open rather than filling it in.",
    offer: "Attach a screenshot or PDF of that screen here and I will read it, or read them to me one by one, exactly as they appear.",
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
    satisfies: ["investments.shares_value", "investments.managed_funds_value", "income.other[].amount_annual"],
  },
  payslip: {
    name: "the pay, from a payslip",
    where: "Have your most recent payslip in front of you, from your employer's payroll portal or wherever it lands in your email.",
    look_for: "Look for the gross pay and the net pay for the period, and the super section, which shows the employer contribution and any extra going in through salary sacrifice.",
    honest: "If pay varies period to period, say so, and we will use the figure that is actually typical rather than the best fortnight.",
    offer: "Attach the payslip here, a PDF or a photo both work, or read the figures to me exactly as they appear.",
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
    satisfies: ["income.other[].amount_annual", "income.other[].costs_annual", "investments.properties[].rent_monthly"],
  },
  business_income: {
    name: "the business and entity income, from the year-end figures",
    where: "Have the most recent tax return in front of you, or the accountant's year-end figures.",
    look_for: "Look for the business profit, any distributions from a trust, and any director fees, each as its own line rather than one combined figure.",
    honest: "Last year's figures are last year's. If this year looks different, say so and we will record the figure with that context.",
    offer: "Attach the relevant pages here, or read each line to me exactly as it appears.",
    satisfies: ["income.other[].amount_annual"],
  },
  bank_statement: {
    name: "the cash, from the accounts it sits in",
    where: "Open your banking app and go to each account where savings or spare cash sits.",
    look_for: "Look for the current balance of each account, and note whether any of them is an offset or is linked against a loan.",
    honest: "If money sits across several accounts, each one counts. A figure from memory is usually the balance from a while ago.",
    offer: "Attach a screenshot of the accounts here, or read me the balance of each account exactly as it appears.",
    satisfies: ["buffer.accessible_savings", "buffer.other_cash"],
  },
  living_costs: {
    name: "the spending, from a transaction export",
    where: "The fullest honest read of what goes out comes from a transaction export covering the last twelve months, and I can walk you through getting one from your bank.",
    look_for: "Once the file lands here, code does the arithmetic across the whole year, so one-off months do not distort the figure.",
    honest: "A guessed monthly figure is usually well under the real one, which is why the export is worth the two minutes.",
    offer: "Attach the file here when you have it, and I will read it straight away.",
    satisfies: ["expenses.living_monthly"],
  },
  hecs: {
    name: "the HECS balance, from myGov",
    where: "Log in to myGov and open the ATO section, then look for loan accounts.",
    look_for: "Look for the HELP or HECS account and its current balance.",
    honest: "The balance updates after each year's indexation and any repayments through tax, so the myGov figure is the current one.",
    offer: "Attach a screenshot of that page here, or read the balance to me exactly as it appears.",
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

/* The prompt reference section, appended at request time. The model gets
   the path ids and what each is for — never the ask copy. */
export function retrievalPromptSection() {
  const entries = Object.entries(RETRIEVAL_PATHS)
    .map(([id, p]) => "- [ASK: " + id + "] — " + p.name)
    .join("\n");
  return "\n\n═══ RETRIEVAL PATHS (code authors the asks) ═══\n\n" +
    "You decide WHAT to ask about next; code decides how the ask for a document-backed figure is worded. When you decide to ask for document-backed figures, emit the matching trigger token below on its own line, exactly as written, where the ask should appear in your reply. The system replaces the token with the full ask text before the person sees it, so never write retrieval instructions in your own words, never describe where a document lives or what to look for on it, and never guess a path id that is not on this list. Warmth around the token, before or after, is yours. Never offer to skip, defer or come back later alongside an ask; if the person declines, record the refusal in the [CAPTURE] block and move on without suggesting deferral yourself.\n" +
    "One visit covers everything its screen shows: each token's ask gathers every figure that source carries, so emit a token once and take everything it returns rather than sending the person back later.\n" +
    "Confidence after the visit: a file they attach and you read is \"document\". Figures they read off their screen and type to you are \"sighted\", never \"document\". Figures from memory stay \"stated\".\n\n" +
    "The tokens:\n" + entries;
}

/* ── the trigger token ──
   [ASK: path_id] — parsing and substitution are the SAME regex, so the
   waitUntil branch that writes path_served rows and the stream branch
   that substitutes text can never disagree about what was served. */
const ASK_TOKEN = /\[ASK:\s*([a-z_]+)\s*\]/g;

/* Path ids for every well-formed token in the text, in order, valid or
   not — the caller decides how to treat unknown ids. */
export function parseAskTokens(text) {
  const ids = [];
  for (const m of String(text || "").matchAll(ASK_TOKEN)) ids.push(m[1]);
  return ids;
}

/* Replace every token in a COMPLETE string with its ask text. Unknown
   path ids are a fault: logged by the caller via the returned list, and
   they emit nothing. Returns { text, served, unknown } where served is
   the deduplicated field ids of every valid path substituted. */
export function substituteAskTokens(text) {
  const served = new Set();
  const unknown = [];
  const out = String(text || "").replace(ASK_TOKEN, (whole, id) => {
    const ask = askFor(id);
    if (ask === null) { unknown.push(id); return ""; }
    for (const f of RETRIEVAL_PATHS[id].satisfies) served.add(f);
    return ask;
  });
  return { text: out, served: [...served], unknown };
}

/* ── startup invariant (Devon, Sept 2026): required implies a servable
   path. Any registry entry (or retrieval_by_type variant) marked
   required whose paths are missing or do not resolve here fails loudly
   at startup — a required field that cannot be served is a data bug that
   must not ship. */
export function assertRequiredServable(fieldRegistry, paths) {
  const failures = [];
  const check = (id, entry, variant) => {
    if (!entry || entry.retrieval !== "required") return;
    const where = variant ? `${id} (type ${variant})` : id;
    const p = entry.paths;
    if (!Array.isArray(p) || p.length === 0) {
      failures.push(`${where}: required with no path`);
      return;
    }
    for (const pathId of p) {
      if (!paths[pathId]) failures.push(`${where}: required with unresolvable path "${pathId}"`);
    }
  };
  for (const [id, entry] of Object.entries(fieldRegistry)) {
    if (entry.retrieval_by_type) {
      for (const [variant, v] of Object.entries(entry.retrieval_by_type)) {
        check(id, { ...entry, ...v }, variant);
      }
    } else {
      check(id, entry, null);
    }
  }
  if (failures.length) {
    throw new Error("required-implies-servable-path invariant violated:\n" + failures.join("\n"));
  }
}
