/* The field registry — docs/capture-conduct.md Part One, with Devon's
   corrections (Sept 2026). One entry per capturable field, keyed by field
   id: the single place capture conduct lives. The model decides what to
   ask about next; this data decides what evidence is acceptable and (from
   build step 4) how the ask is worded.

   retrieval, three-state (replaces the earlier boolean):
     "required"  the path is served and the confidence floor is enforced;
                 only a VALID refusal (code-witnessed path_served for the
                 field in the same session, then declined) goes below it
     "offered"   the path is served; a stated answer is accepted with no
                 refusal record
     "none"      no document exists in the real world

   Other entry fields: label, evidence, paths (retrieval-file ids),
   accepts_upload, confidence_floor, range_permitted, softeners, requires
   (must be present in the merged picture before this field commits),
   no_default (enum may never take a nearest-fit value), feeds (derived
   figures), never_asked (flags.*: written from the model's read).

   retrieval_by_type: for income.other[].amount_annual the retrieval state
   depends on the item's type — rental and investment and entity income are
   required; government and family support have no document.

   PENDING SCHEMA: debts.items[].type carries no_default with purpose and
   borrower requires from the capture-accuracy addendum; those fields do
   not exist in the v2 schema yet, so they are recorded as
   requires_pending_schema and not enforced.

   Confidence order for the floor: (missing) < estimated < stated < document. */

export const CONFIDENCE_RANK = { estimated: 1, stated: 2, document: 3 };

export const FIELD_REGISTRY = {
  /* ── context ── */
  "context.adults":       { label: "who's in the household", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "context.children[].age": { label: "the kids' ages", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "context.owner_age":    { label: "your age", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "context.partner_age":  { label: "your partner's age", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "context.work_intent":  { label: "whether work is staying as it is", retrieval: "none", confidence_floor: "stated", softeners: "permitted" },
  "context.horizon_years": { label: "the timeframe you think in", retrieval: "none", confidence_floor: "stated", softeners: "permitted" },

  /* ── income ── */
  "income.salary_gross_annual": { label: "your salary before tax", retrieval: "required", evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["income_total_annual"] },
  "income.salary_net_monthly": { label: "what actually lands in your account", retrieval: "required", evidence: ["payslip", "bank_statement_credit"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["surplus_monthly"] },
  "income.partner_salary_gross_annual": { label: "your partner's salary before tax", retrieval: "required", evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["income_total_annual"] },
  "income.partner_salary_net_monthly": { label: "what lands in your partner's account", retrieval: "required", evidence: ["payslip", "bank_statement_credit"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["surplus_monthly"] },
  "income.business_income_annual": { label: "what the business brings in across a year", retrieval: "required", evidence: ["bank_statements_12m", "tax_return"], paths: ["business_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["income_total_annual"] },
  "income.rental_income_annual": { label: "the rent that comes in across a year", retrieval: "required", evidence: ["lease", "agent_statement", "bank_statement_credit"], paths: ["rental_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["income_total_annual"] },
  "income.other[].type":  { label: "what kind of income it is", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.other[].label": { label: "what it is, in their words", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "income.other[].amount_annual": { label: "what it brings in across a year", accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["income_total_annual"],
    retrieval_by_type: {
      rental_residential: { retrieval: "required", evidence: ["lease", "agent_statement"], paths: ["rental_income"] },
      rental_commercial:  { retrieval: "required", evidence: ["lease", "agent_statement"], paths: ["rental_income"] },
      dividends:          { retrieval: "required", evidence: ["platform_statement", "holding_statement"], paths: ["investment_platform"] },
      distributions:      { retrieval: "required", evidence: ["platform_statement", "annual_tax_statement"], paths: ["investment_platform"] },
      trust_distribution: { retrieval: "required", evidence: ["distribution_statement", "tax_return"], paths: ["business_income"] },
      business_profit:    { retrieval: "required", evidence: ["bank_statements_12m", "tax_return"], paths: ["business_income"] },
      government:         { retrieval: "none", confidence_floor: "stated" },
      family_support:     { retrieval: "none", confidence_floor: "stated" },
    } },
  "income.structure":     { label: "how the income is earned", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.entity":        { label: "any company or trust in the picture", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "income.employer_super_on": { label: "which pay has employer super on it", retrieval: "offered", evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── expenses ── */
  "expenses.living_monthly": { label: "what actually goes out in a month", retrieval: "required", evidence: ["bank_statements_12m", "spending_summary"], paths: ["living_costs"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["expenses.includes_housing"], feeds: ["surplus_monthly", "buffer_months"] },
  "expenses.includes_housing": { label: "whether that figure includes the housing payment", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "expenses.housing_repayment_monthly": { label: "the housing payment each month", retrieval: "required", evidence: ["loan_statement", "banking_app", "lease"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["surplus_monthly", "buffer_months"] },

  /* ── home ── */
  "home.owns_home":       { label: "whether you own the place you live in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "home.value_estimate":  { label: "what the home is worth", retrieval: "required", evidence: ["lender_valuation", "rates_notice", "portal_estimate", "appraisal"], paths: ["home_value"], accepts_upload: true, confidence_floor: "estimated", range_permitted: true, softeners: "forbidden", feeds: ["home_equity", "lvr_percent"] },
  "home.value_source":    { label: "where that value comes from", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "home.mortgage_balance": { label: "what's still owing on the loan", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["home_equity", "lvr_percent"] },
  "home.rate_percent":    { label: "the rate the loan is on", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.rate_type":       { label: "whether the rate is fixed or variable", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.lender":          { label: "who the loan is with", retrieval: "offered", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "home.with_lender_since": { label: "how long you've been with them", retrieval: "none", confidence_floor: "stated", softeners: "permitted" },
  "home.repayment_monthly": { label: "the loan repayment each month", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.term_remaining_years": { label: "how many years are left on the loan", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.has_offset":      { label: "whether the loan has an offset attached", retrieval: "offered", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "home.offset_balance":  { label: "what's sitting in the offset", retrieval: "required", evidence: ["banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["home.has_offset"] },
  "home.package_fee_annual": { label: "what the loan package charges a year", retrieval: "offered", evidence: ["loan_statement"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── buffer ── */
  "buffer.accessible_savings": { label: "the money you could reach quickly", retrieval: "required", evidence: ["banking_app", "bank_statement"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["buffer_months"] },
  "buffer.where_held":    { label: "where that money sits", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "buffer.linked_to_loan": { label: "whether it sits against the loan", retrieval: "offered", evidence: ["banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "buffer.counts_credit_as_buffer": { label: "whether credit is being counted as the safety net", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "buffer.other_cash":    { label: "cash beyond the emergency buffer", retrieval: "required", evidence: ["banking_app", "bank_statement"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "buffer.other_cash_where_held": { label: "where that cash sits", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },

  /* ── super ── */
  "super.funds[].fund":   { label: "which fund it's with", retrieval: "offered", evidence: ["super_statement", "mygov"], paths: ["super_statement"], confidence_floor: "stated", softeners: "forbidden" },
  "super.funds[].owner":  { label: "whose account it is", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "super.funds[].balance": { label: "the balance in that fund", retrieval: "required", evidence: ["super_statement", "mygov", "fund_app"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["super_total"] },
  "super.funds[].has_insurance": { label: "whether insurance sits inside it", retrieval: "required", evidence: ["super_statement", "fund_app"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "super.multiple_accounts": { label: "whether one of you holds more than one account", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "super.extra_contributions": { label: "whether extra is going in", retrieval: "offered", evidence: ["payslip", "super_statement"], paths: ["payslip"], confidence_floor: "stated", softeners: "forbidden" },

  /* ── protection ── */
  "protection.life.held": { label: "whether life cover is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.life.amount": { label: "what the life cover would pay", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.life.inside_super": { label: "whether it sits inside super", retrieval: "offered", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },
  "protection.tpd.held":  { label: "whether TPD cover is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.tpd.amount": { label: "what the TPD cover would pay", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.tpd.inside_super": { label: "whether it sits inside super", retrieval: "offered", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },
  "protection.income_protection.held": { label: "whether income protection is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.income_protection.amount": { label: "what it would pay a month", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.income_protection.inside_super": { label: "whether it sits inside super", retrieval: "offered", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },
  "protection.trauma.held": { label: "whether trauma cover is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.trauma.amount": { label: "what the trauma cover would pay", retrieval: "required", evidence: ["policy_schedule"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.trauma.inside_super": { label: "whether it sits inside super", retrieval: "offered", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },

  /* ── estate ── */
  "estate.will.in_place": { label: "whether a will is in place", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "estate.will.last_updated": { label: "when the will was last looked at", retrieval: "offered", evidence: ["will_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.poa.in_place":  { label: "whether an enduring power of attorney is in place", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "estate.poa.last_updated": { label: "when it was last looked at", retrieval: "offered", evidence: ["poa_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.guardianship.in_place": { label: "whether guardianship for the children is in place", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "estate.guardianship.last_updated": { label: "when it was last looked at", retrieval: "offered", evidence: ["guardianship_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.super_nomination.in_place": { label: "whether a super nomination is in place", retrieval: "offered", evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], confidence_floor: "stated", softeners: "forbidden" },
  "estate.super_nomination.last_updated": { label: "when the nomination was made", retrieval: "offered", evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], confidence_floor: "stated", softeners: "permitted" },
  "estate.super_nomination.binding": { label: "whether the nomination is binding", retrieval: "offered", evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], confidence_floor: "stated", softeners: "forbidden" },

  /* ── investments ── */
  "investments.shares_value": { label: "what the shares and ETFs are worth", retrieval: "required", evidence: ["platform_app", "platform_statement"], paths: ["investment_platform"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.held_in":  { label: "whose name they're held in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "investments.managed_funds_value": { label: "what the managed funds are worth", retrieval: "required", evidence: ["platform_app", "platform_statement"], paths: ["investment_platform"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].value_estimate": { label: "what the property is worth", retrieval: "required", evidence: ["lender_valuation", "rates_notice", "portal_estimate", "appraisal"], paths: ["home_value"], accepts_upload: true, confidence_floor: "estimated", range_permitted: true, softeners: "forbidden", feeds: ["property_equity"] },
  "investments.properties[].loan_balance": { label: "what's owing against it", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["property_equity"] },
  "investments.properties[].rate_percent": { label: "the rate that loan is on", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].repayment_type": { label: "whether it's interest-only or principal and interest", retrieval: "offered", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "investments.properties[].rent_monthly": { label: "the rent it brings in", retrieval: "required", evidence: ["lease", "agent_statement"], paths: ["rental_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].held_in": { label: "whose name it's in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "investments.properties[].use": { label: "what the property is for", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },

  /* ── debts ── */
  "debts.items[].type":   { label: "what kind of debt it is", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true, requires_pending_schema: ["purpose", "borrower"] },
  "debts.items[].balance": { label: "what's owing on it", retrieval: "required", evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["debts_total"] },
  "debts.items[].rate_percent": { label: "the rate it charges", retrieval: "required", evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "debts.items[].minimum_monthly": { label: "the minimum repayment", retrieval: "required", evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["surplus_monthly"] },
  "debts.hecs_balance":   { label: "the HECS balance", retrieval: "offered", evidence: ["mygov", "ato_statement"], paths: ["hecs"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── flags (never asked; written from the model's read) ── */
  "flags.hardship":       { label: "hardship", retrieval: "none", confidence_floor: "estimated", softeners: "permitted", never_asked: true },
  "flags.hardship_signal": { label: "what prompted it", retrieval: "none", confidence_floor: "estimated", softeners: "permitted", never_asked: true },
};

/* ── the persistence gate (build step 2, with corrections 1-3) ──
   Runs in the request path, after the write-ahead raw insert and before
   the validated merge commits. Pure: the CALLER computes which refusals
   are VALID (a refusal is valid only where a code-written path_served
   event exists for that field id in the SAME session; refusals from
   earlier sessions have expired). Until step 4's templated asks write
   path_served events, no refusal is valid — correct and intended.

   1. retrieval "required": may not commit below confidence_floor without
      a valid refusal. "offered"/"none": no floor enforcement.
   2. requires: every required field present in the merged picture.
   A missing _confidence ranks below everything. */

function resolveEntry(entry, item) {
  if (!entry || !entry.retrieval_by_type) return entry;
  const t = item && item.type;
  const byType = t && entry.retrieval_by_type[t];
  return byType ? { ...entry, ...byType } : { ...entry, retrieval: "required" }; // unknown type: strictest
}

function leafWrites(domains) {
  const out = [];
  for (const [domainKey, domainVal] of Object.entries(domains || {})) {
    if (!domainVal || typeof domainVal !== "object") continue;
    for (const [k, v] of Object.entries(domainVal)) {
      if (k.startsWith("_") || v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (!item || typeof item !== "object") continue;
          for (const [ik, iv] of Object.entries(item)) {
            if (ik.startsWith("_") || iv === null || iv === undefined) continue;
            out.push({ id: `${domainKey}.${k}[].${ik}`, domain: domainKey, item });
          }
        }
      } else if (typeof v === "object") {
        for (const [ik, iv] of Object.entries(v)) {
          if (ik.startsWith("_") || iv === null || iv === undefined) continue;
          out.push({ id: `${domainKey}.${k}.${ik}`, domain: domainKey });
        }
      } else {
        out.push({ id: `${domainKey}.${k}`, domain: domainKey });
      }
    }
  }
  return out;
}

function presentInMerged(merged, fieldId) {
  const parts = fieldId.split(".");
  let node = merged || {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.endsWith("[]")) {
      const arr = node[p.slice(0, -2)];
      if (!Array.isArray(arr) || !arr.length) return false;
      const rest = parts.slice(i + 1).join(".");
      return arr.some(item => rest ? presentInMerged(item, rest) : true);
    }
    node = node ? node[p] : undefined;
    if (node === null || node === undefined) return false;
  }
  return true;
}

export function persistenceGate(patchDomains, mergedDomains, validRefusals) {
  const errors = [];
  const refuse = validRefusals instanceof Set ? validRefusals : new Set(validRefusals || []);
  for (const w of leafWrites(patchDomains)) {
    const entry = resolveEntry(FIELD_REGISTRY[w.id], w.item);
    if (!entry || entry.never_asked) continue;
    if (entry.retrieval === "required") {
      const conf = (patchDomains[w.domain] || {})._confidence;
      const rank = CONFIDENCE_RANK[conf] ?? 0;
      const floor = CONFIDENCE_RANK[entry.confidence_floor];
      if (floor !== undefined && rank < floor && !refuse.has(w.id)) {
        errors.push(`gate: ${w.id} committed at "${conf ?? "no confidence"}" below floor "${entry.confidence_floor}" with no valid refusal record`);
      }
    }
    for (const req of entry.requires || []) {
      if (!presentInMerged(mergedDomains, req)) {
        errors.push(`gate: ${w.id} written before required field ${req} is present`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
