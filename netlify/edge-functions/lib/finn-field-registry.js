/* The field registry — docs/capture-conduct.md Part One.
   One entry per capturable field, keyed by field id. This is the single
   place capture conduct lives: the model decides what to ask about next;
   this data decides what evidence is acceptable and (from build step 4)
   how the ask is worded. A new field inherits all of it by existing.

   Keyed to the CURRENT v2 schema (field-spec Part 2) — the persistence
   gate can only enforce fields that exist at the write boundary. The
   capture-accuracy addendum's schema changes (debts purpose/borrower,
   income restructure, entities[]) are inputs per the architecture doc but
   that document is not yet in the repo; entries depending on them are
   marked pending_schema and are NOT enforced until the schema lands.

   Entry shape:
     label            plain words for the thing (used by templated asks)
     retrievable      true where a document exists in the real world.
                      A GATE, not a hint: such a field cannot be committed
                      below its confidence_floor unless a refusal record
                      exists against it (path offered, declined).
     evidence         document types that satisfy it
     paths            ids into the retrieval-path file (build step 3)
     accepts_upload   the upload settles it
     confidence_floor lowest _confidence the field may be committed at
                      without a refusal record: "document" | "stated" |
                      "estimated"
     range_permitted  carry the range, never flatten it
     softeners        "forbidden" | "permitted"
     requires         field ids that must be present (in the merged
                      picture) before this one may be written
     no_default       enum may never be written to a nearest-fit value
     feeds            derived figures that depend on it (finn-derived)
     never_asked      written from the model's read, not from asking
                      (flags.hardship) — the gate skips these

   Confidence order for the floor: estimated < stated < document.
   ("inferred" sits outside the order; only never_asked fields carry it.) */

export const CONFIDENCE_RANK = { estimated: 1, stated: 2, document: 3 };

export const FIELD_REGISTRY = {
  /* ── context ── */
  "context.adults":       { label: "who's in the household", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "context.children[].age": { label: "the kids' ages", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "context.owner_age":    { label: "your age", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "context.partner_age":  { label: "your partner's age", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "context.work_intent":  { label: "whether work is staying as it is", retrievable: false, confidence_floor: "stated", softeners: "permitted" },
  "context.horizon_years": { label: "the timeframe you think in", retrievable: false, confidence_floor: "stated", softeners: "permitted" },

  /* ── income ── */
  "income.salary_gross_annual": { label: "your salary before tax", retrievable: true, evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["income_total_annual"] },
  "income.salary_net_monthly": { label: "what actually lands in your account", retrievable: true, evidence: ["payslip", "bank_statement_credit"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["surplus_monthly"] },
  "income.partner_salary_gross_annual": { label: "your partner's salary before tax", retrievable: true, evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["income_total_annual"] },
  "income.partner_salary_net_monthly": { label: "what lands in your partner's account", retrievable: true, evidence: ["payslip", "bank_statement_credit"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["surplus_monthly"] },
  "income.business_income_annual": { label: "what the business brings in across a year", retrievable: true, evidence: ["bank_statements_12m", "tax_return"], paths: ["business_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["income.structure"], feeds: ["income_total_annual"] },
  "income.rental_income_annual": { label: "the rent that comes in across a year", retrievable: true, evidence: ["lease", "agent_statement", "bank_statement_credit"], paths: ["rental_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["income_total_annual"] },
  "income.other_income_annual": { label: "anything else landing regularly", retrievable: true, evidence: ["bank_statement_credit"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden", feeds: ["income_total_annual"] },
  "income.structure":     { label: "how the income is earned", retrievable: false, confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.entity":        { label: "any company or trust in the picture", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "income.employer_super_on": { label: "which pay has employer super on it", retrievable: true, evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── expenses ── */
  "expenses.living_monthly": { label: "what actually goes out in a month", retrievable: true, evidence: ["bank_statements_12m", "spending_summary"], paths: ["living_costs"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["expenses.includes_housing"], feeds: ["surplus_monthly", "buffer_months"] },
  "expenses.includes_housing": { label: "whether that figure includes the housing payment", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "expenses.housing_repayment_monthly": { label: "the housing payment each month", retrievable: true, evidence: ["loan_statement", "banking_app", "lease"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["surplus_monthly", "buffer_months"] },

  /* ── home ── */
  "home.owns_home":       { label: "whether you own the place you live in", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "home.value_estimate":  { label: "what the home is worth", retrievable: true, evidence: ["lender_valuation", "rates_notice", "portal_estimate", "appraisal"], paths: ["home_value"], accepts_upload: true, confidence_floor: "estimated", range_permitted: true, softeners: "forbidden", feeds: ["home_equity", "lvr_percent"] },
  "home.value_source":    { label: "where that value comes from", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "home.mortgage_balance": { label: "what's still owing on the loan", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["home_equity", "lvr_percent"] },
  "home.rate_percent":    { label: "the rate the loan is on", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.rate_type":       { label: "whether the rate is fixed or variable", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.lender":          { label: "who the loan is with", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "home.with_lender_since": { label: "how long you've been with them", retrievable: false, confidence_floor: "stated", softeners: "permitted" },
  "home.repayment_monthly": { label: "the loan repayment each month", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.term_remaining_years": { label: "how many years are left on the loan", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.has_offset":      { label: "whether the loan has an offset attached", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "home.offset_balance":  { label: "what's sitting in the offset", retrievable: true, evidence: ["banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["home.has_offset"] },
  "home.package_fee_annual": { label: "what the loan package charges a year", retrievable: true, evidence: ["loan_statement"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── buffer ── */
  "buffer.accessible_savings": { label: "the money you could reach quickly", retrievable: true, evidence: ["banking_app", "bank_statement"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["buffer_months"] },
  "buffer.where_held":    { label: "where that money sits", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "buffer.linked_to_loan": { label: "whether it sits against the loan", retrievable: true, evidence: ["banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "buffer.counts_credit_as_buffer": { label: "whether credit is being counted as the safety net", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "buffer.other_cash":    { label: "cash beyond the emergency buffer", retrievable: true, evidence: ["banking_app", "bank_statement"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "buffer.other_cash_where_held": { label: "where that cash sits", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },

  /* ── super ── */
  "super.funds[].fund":   { label: "which fund it's with", retrievable: true, evidence: ["super_statement", "mygov"], paths: ["super_statement"], confidence_floor: "stated", softeners: "forbidden" },
  "super.funds[].owner":  { label: "whose account it is", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "super.funds[].balance": { label: "the balance in that fund", retrievable: true, evidence: ["super_statement", "mygov", "fund_app"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["super_total"] },
  "super.funds[].has_insurance": { label: "whether insurance sits inside it", retrievable: true, evidence: ["super_statement", "fund_app"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "super.multiple_accounts": { label: "whether one of you holds more than one account", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "super.extra_contributions": { label: "whether extra is going in", retrievable: true, evidence: ["payslip", "super_statement"], paths: ["payslip"], confidence_floor: "stated", softeners: "forbidden" },

  /* ── protection ── */
  "protection.life.held": { label: "whether life cover is held", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "protection.life.amount": { label: "what the life cover would pay", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.life.inside_super": { label: "whether it sits inside super", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },
  "protection.tpd.held":  { label: "whether TPD cover is held", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "protection.tpd.amount": { label: "what the TPD cover would pay", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.tpd.inside_super": { label: "whether it sits inside super", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },
  "protection.income_protection.held": { label: "whether income protection is held", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "protection.income_protection.amount": { label: "what it would pay a month", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.income_protection.inside_super": { label: "whether it sits inside super", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },
  "protection.trauma.held": { label: "whether trauma cover is held", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "protection.trauma.amount": { label: "what the trauma cover would pay", retrievable: true, evidence: ["policy_schedule"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.trauma.inside_super": { label: "whether it sits inside super", retrievable: true, evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], confidence_floor: "stated", softeners: "forbidden" },

  /* ── estate ── */
  "estate.will.in_place": { label: "whether a will is in place", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "estate.will.last_updated": { label: "when the will was last looked at", retrievable: true, evidence: ["will_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.poa.in_place":  { label: "whether an enduring power of attorney is in place", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "estate.poa.last_updated": { label: "when it was last looked at", retrievable: false, confidence_floor: "stated", softeners: "permitted" },
  "estate.guardianship.in_place": { label: "whether guardianship for the children is in place", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "estate.guardianship.last_updated": { label: "when it was last looked at", retrievable: false, confidence_floor: "stated", softeners: "permitted" },
  "estate.super_nomination.in_place": { label: "whether a super nomination is in place", retrievable: true, evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], confidence_floor: "stated", softeners: "forbidden" },
  "estate.super_nomination.last_updated": { label: "when the nomination was made", retrievable: true, evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], confidence_floor: "stated", softeners: "permitted" },
  "estate.super_nomination.binding": { label: "whether the nomination is binding", retrievable: true, evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], confidence_floor: "stated", softeners: "forbidden" },

  /* ── investments ── */
  "investments.shares_value": { label: "what the shares and ETFs are worth", retrievable: true, evidence: ["platform_app", "platform_statement"], paths: ["investment_platform"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.held_in":  { label: "whose name they're held in", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "investments.managed_funds_value": { label: "what the managed funds are worth", retrievable: true, evidence: ["platform_app", "platform_statement"], paths: ["investment_platform"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].value_estimate": { label: "what the property is worth", retrievable: true, evidence: ["lender_valuation", "rates_notice", "portal_estimate", "appraisal"], paths: ["home_value"], accepts_upload: true, confidence_floor: "estimated", range_permitted: true, softeners: "forbidden", feeds: ["property_equity"] },
  "investments.properties[].loan_balance": { label: "what's owing against it", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["property_equity"] },
  "investments.properties[].rate_percent": { label: "the rate that loan is on", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].repayment_type": { label: "whether it's interest-only or principal and interest", retrievable: true, evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], confidence_floor: "stated", softeners: "forbidden" },
  "investments.properties[].rent_monthly": { label: "the rent it brings in", retrievable: true, evidence: ["lease", "agent_statement"], paths: ["rental_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].held_in": { label: "whose name it's in", retrievable: false, confidence_floor: "stated", softeners: "forbidden" },
  "investments.properties[].use": { label: "what the property is for", retrievable: false, confidence_floor: "stated", softeners: "forbidden", no_default: true },

  /* ── debts ── */
  "debts.items[].type":   { label: "what kind of debt it is", retrievable: false, confidence_floor: "stated", softeners: "forbidden", no_default: true, requires_pending_schema: ["purpose", "borrower"] },
  "debts.items[].balance": { label: "what's owing on it", retrievable: true, evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["debts_total"] },
  "debts.items[].rate_percent": { label: "the rate it charges", retrievable: true, evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "debts.items[].minimum_monthly": { label: "the minimum repayment", retrievable: true, evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["surplus_monthly"] },
  "debts.hecs_balance":   { label: "the HECS balance", retrievable: true, evidence: ["mygov", "ato_statement"], paths: ["hecs"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── flags (never asked; written from the model's read) ── */
  "flags.hardship":       { label: "hardship", retrievable: false, confidence_floor: "estimated", softeners: "permitted", never_asked: true },
  "flags.hardship_signal": { label: "what prompted it", retrievable: false, confidence_floor: "estimated", softeners: "permitted", never_asked: true },
};

/* ── the persistence gate (build step 2) — pure, testable ──
   Enforced at the write boundary, after the write-ahead raw insert and
   before the validated merge. Checks the fields WRITTEN THIS TURN:

   1. Confidence floor: a retrievable field may not be committed below its
      confidence_floor unless a refusal record exists against its field id
      (the retrieval path was offered, and declined). Without one, the
      write fails and logs.
   2. requires: a field may not be committed until every required field is
      present (non-null) in the merged picture. Not answered leaves the
      item open — it never resolves to a nearest-fit value.

   patchDomains: this turn's (translated) domains patch
   mergedDomains: base + patch, the would-be committed picture
   refusals: Set of field ids with standing refusal records
   → { ok, errors[] }                                                     */

function leafWrites(domains) {
  // → [{ id, value, domain }] for every non-null leaf written, using
  // registry-style ids ("home.value_estimate", "super.funds[].balance").
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
            out.push({ id: `${domainKey}.${k}[].${ik}`, value: iv, domain: domainKey });
          }
        }
      } else if (typeof v === "object") {
        for (const [ik, iv] of Object.entries(v)) {
          if (ik.startsWith("_") || iv === null || iv === undefined) continue;
          out.push({ id: `${domainKey}.${k}.${ik}`, value: iv, domain: domainKey });
        }
      } else {
        out.push({ id: `${domainKey}.${k}`, value: v, domain: domainKey });
      }
    }
  }
  return out;
}

function presentInMerged(merged, fieldId) {
  // "home.has_offset" / "expenses.includes_housing" / "income.structure":
  // present means a non-null value exists at that path (array fields:
  // present on at least one item).
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

export function persistenceGate(patchDomains, mergedDomains, refusals) {
  const errors = [];
  const refuse = refusals instanceof Set ? refusals : new Set(refusals || []);
  for (const w of leafWrites(patchDomains)) {
    const entry = FIELD_REGISTRY[w.id];
    if (!entry || entry.never_asked) continue;
    // 1. Confidence floor for retrievable fields. A missing _confidence
    //    ranks below everything — omitting it is never a way through.
    if (entry.retrievable) {
      const conf = (patchDomains[w.domain] || {})._confidence;
      const rank = CONFIDENCE_RANK[conf] ?? 0;
      const floor = CONFIDENCE_RANK[entry.confidence_floor];
      if (floor !== undefined && rank < floor && !refuse.has(w.id)) {
        errors.push(`gate: ${w.id} committed at "${conf ?? "no confidence"}" below floor "${entry.confidence_floor}" with no refusal record`);
      }
    }
    // 2. requires — every required field present in the merged picture.
    for (const req of entry.requires || []) {
      if (!presentInMerged(mergedDomains, req)) {
        errors.push(`gate: ${w.id} written before required field ${req} is present`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
