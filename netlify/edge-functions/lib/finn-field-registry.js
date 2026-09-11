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
   depends on the item's source (type_key names the discriminator) — rental,
   investment and entity income are required; government and "other" have
   no document.

   Item-sibling requires: a require with no dot in it (e.g. "purpose" on
   debts.items[].type) must be present on the same array item, not in the
   merged picture. Enforced since the field-spec Part 2 schema fold.

   Confidence order for the floor:
   (missing) < estimated < stated < sighted < document.
   document means Finn read the artefact; sighted means the person was on
   the source and read it off. A sighted value satisfies a document floor
   only while no working upload path exists for that field — that
   capability flag lives HERE in code (UPLOAD_PATH_WORKS), not in the
   registry entries. */

export const CONFIDENCE_RANK = { estimated: 1, stated: 2, sighted: 3, document: 4 };

/* The upload capability flag (Devon, Sept 2026). Verified 2026-09-11: the
   clarity composer takes PDF / PNG / JPEG / WebP by button, paste and
   drag-and-drop, single file per turn, 8MB cap; clarity-chat sanitises
   the blocks and forwards them, read-and-discard. Upload therefore works
   for every document-backed field today, and sighted does NOT satisfy a
   document floor anywhere. If the capability breaks or narrows, flip
   this here and sighted starts satisfying document floors again — the
   registry entries never change for it. */
export const UPLOAD_PATH_WORKS = true;
export function uploadWorks(fieldId) {
  return UPLOAD_PATH_WORKS;
}

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
  "income.other[].source": { label: "what kind of income it is", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.other[].linked_asset_id": { label: "which asset or entity it comes from", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "income.other[].entity": { label: "whose hands it arrives in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.other[].basis": { label: "whether that figure is before or after costs", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.other[].amount_annual": { label: "what it brings in across a year", accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["income_total_annual"], type_key: "source",
    retrieval_by_type: {
      rental_residential: { retrieval: "required", evidence: ["lease", "agent_statement"], paths: ["rental_income"] },
      rental_commercial:  { retrieval: "required", evidence: ["lease", "agent_statement"], paths: ["rental_income"] },
      dividends:          { retrieval: "required", evidence: ["platform_statement", "holding_statement"], paths: ["investment_platform"] },
      distributions:      { retrieval: "required", evidence: ["platform_statement", "annual_tax_statement"], paths: ["investment_platform"] },
      trust_distribution: { retrieval: "required", evidence: ["distribution_statement", "tax_return"], paths: ["business_income"] },
      business_profit:    { retrieval: "required", evidence: ["bank_statements_12m", "tax_return"], paths: ["business_income"] },
      director_fee:       { retrieval: "required", evidence: ["payslip", "tax_return"], paths: ["business_income"] },
      government:         { retrieval: "none", confidence_floor: "stated" },
      other:              { retrieval: "none", confidence_floor: "stated" },
    } },
  "income.structure":     { label: "how the income is earned", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "income.entity":        { label: "any company or trust in the picture", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "income.employer_super_on": { label: "which pay has employer super on it", retrieval: "required", evidence: ["payslip"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },

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
  "home.has_offset":      { label: "whether the loan has an offset attached", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "home.offset_balance":  { label: "what's sitting in the offset", retrieval: "required", evidence: ["banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", requires: ["home.has_offset"] },
  "home.package_fee_annual": { label: "what the loan package charges a year", retrieval: "offered", evidence: ["loan_statement"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── buffer ── */
  "buffer.accessible_savings": { label: "the money you could reach quickly", retrieval: "required", evidence: ["banking_app", "bank_statement"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["buffer_months"] },
  "buffer.where_held":    { label: "where that money sits", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "buffer.linked_to_loan": { label: "whether it sits against the loan", retrieval: "required", evidence: ["banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "buffer.counts_credit_as_buffer": { label: "whether credit is being counted as the safety net", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "buffer.other_cash":    { label: "cash beyond the emergency buffer", retrieval: "required", evidence: ["banking_app", "bank_statement"], paths: ["bank_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "buffer.other_cash_where_held": { label: "where that cash sits", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },

  /* ── super ── */
  "super.funds[].fund":   { label: "which fund it's with", retrieval: "required", evidence: ["super_statement", "mygov"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "super.funds[].owner":  { label: "whose account it is", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "super.funds[].balance": { label: "the balance in that fund", retrieval: "required", evidence: ["super_statement", "mygov", "fund_app"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["super_total"] },
  "super.funds[].has_insurance": { label: "whether insurance sits inside it", retrieval: "required", evidence: ["super_statement", "fund_app"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "super.multiple_accounts": { label: "whether one of you holds more than one account", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "super.extra_contributions": { label: "whether extra is going in", retrieval: "required", evidence: ["payslip", "super_statement"], paths: ["payslip"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },

  /* ── protection ── */
  "protection.life.held": { label: "whether life cover is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.life.amount": { label: "what the life cover would pay", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.life.inside_super": { label: "whether it sits inside super", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.tpd.held":  { label: "whether TPD cover is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.tpd.amount": { label: "what the TPD cover would pay", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.tpd.inside_super": { label: "whether it sits inside super", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.income_protection.held": { label: "whether income protection is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.income_protection.amount": { label: "what it would pay a month", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.income_protection.inside_super": { label: "whether it sits inside super", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.trauma.held": { label: "whether trauma cover is held", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "protection.trauma.amount": { label: "what the trauma cover would pay", retrieval: "required", evidence: ["policy_schedule"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "protection.trauma.inside_super": { label: "whether it sits inside super", retrieval: "required", evidence: ["policy_schedule", "super_statement"], paths: ["policy_schedule"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },

  /* ── estate ── */
  "estate.will.in_place": { label: "whether a will is in place", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "estate.will.last_updated": { label: "when the will was last looked at", retrieval: "offered", evidence: ["will_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.poa.in_place":  { label: "whether an enduring power of attorney is in place", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "estate.poa.last_updated": { label: "when it was last looked at", retrieval: "offered", evidence: ["poa_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.guardianship.in_place": { label: "whether guardianship for the children is in place", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "estate.guardianship.last_updated": { label: "when it was last looked at", retrieval: "offered", evidence: ["guardianship_document"], paths: [], confidence_floor: "stated", softeners: "permitted" },
  "estate.super_nomination.in_place": { label: "whether a super nomination is in place", retrieval: "required", evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "estate.super_nomination.last_updated": { label: "when the nomination was made", retrieval: "required", evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "estate.super_nomination.binding": { label: "whether the nomination is binding", retrieval: "required", evidence: ["fund_portal", "super_statement"], paths: ["super_statement"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },

  /* ── investments ── */
  "investments.shares_value": { label: "what the shares and ETFs are worth", retrieval: "required", evidence: ["platform_app", "platform_statement"], paths: ["investment_platform"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.held_in":  { label: "whose name they're held in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "investments.managed_funds_value": { label: "what the managed funds are worth", retrieval: "required", evidence: ["platform_app", "platform_statement"], paths: ["investment_platform"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].value_estimate": { label: "what the property is worth", retrieval: "required", evidence: ["lender_valuation", "rates_notice", "portal_estimate", "appraisal"], paths: ["home_value"], accepts_upload: true, confidence_floor: "estimated", range_permitted: true, softeners: "forbidden", feeds: ["property_equity"] },
  "investments.properties[].loan_balance": { label: "what's owing against it", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["property_equity"] },
  "investments.properties[].rate_percent": { label: "the rate that loan is on", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].repayment_type": { label: "whether it's interest-only or principal and interest", retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].rent_monthly": { label: "the rent it brings in", retrieval: "required", evidence: ["lease", "agent_statement"], paths: ["rental_income"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "investments.properties[].held_in": { label: "whose name it's in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "investments.properties[].use": { label: "what the property is for", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },

  /* ── debts ──
     type carries item-sibling requires (no dot in the id): purpose and
     borrower must be present ON THE SAME ITEM before type commits.
     Enforced as of the field-spec Part 2 schema fold. */
  "debts.items[].type":   { label: "what kind of debt it is", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true, requires: ["purpose", "borrower"] },
  "debts.items[].purpose": { label: "what the money was used for", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  "debts.items[].borrower": { label: "whose name the borrowing is in", retrieval: "none", confidence_floor: "stated", softeners: "forbidden", no_default: true },
  /* security is required, served on the item's own loan path — except the
     four products that cannot carry security, which resolve to unsecured
     without any trip (code fills them in applyCapture), and family_loan,
     which has no institution screen: under the required-implies-servable-
     path invariant it is retrieval none, floor stated. */
  "debts.items[].security": { label: "what it's secured against", accepts_upload: true, confidence_floor: "document", softeners: "forbidden", no_default: true, type_key: "type",
    retrieval_by_type: {
      credit_card: { retrieval: "none", confidence_floor: "stated" },
      bnpl:        { retrieval: "none", confidence_floor: "stated" },
      hecs_help:   { retrieval: "none", confidence_floor: "stated" },
      tax_debt:    { retrieval: "none", confidence_floor: "stated" },
      home_loan:                { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      investment_property_loan: { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      loan_split:               { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      line_of_credit:           { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      commercial_loan:          { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      business_loan:            { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      equipment_finance:        { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      car_loan:                 { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      personal_loan:            { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
      family_loan:              { retrieval: "none", confidence_floor: "stated" },
      other:                    { retrieval: "required", evidence: ["loan_statement", "banking_app"], paths: ["loan_details"] },
    } },
  "debts.items[].is_split": { label: "whether it's a split of a larger loan", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "debts.items[].parent_loan_id": { label: "which loan it's a split of", retrieval: "none", confidence_floor: "stated", softeners: "forbidden" },
  "debts.items[].balance": { label: "what's owing on it", retrieval: "required", evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["debts_total"] },
  "debts.items[].rate_percent": { label: "the rate it charges", retrieval: "required", evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden" },
  "debts.items[].minimum_monthly": { label: "the minimum repayment", retrieval: "required", evidence: ["statement", "banking_app"], paths: ["loan_details"], accepts_upload: true, confidence_floor: "document", softeners: "forbidden", feeds: ["surplus_monthly"] },
  "debts.hecs_balance":   { label: "the HECS balance", retrieval: "offered", evidence: ["mygov", "ato_statement"], paths: ["hecs"], accepts_upload: true, confidence_floor: "stated", softeners: "forbidden" },

  /* ── flags (never asked; written from the model's read) ── */
  "flags.hardship":       { label: "hardship", retrieval: "none", confidence_floor: "estimated", softeners: "permitted", never_asked: true },
  "flags.hardship_signal": { label: "what prompted it", retrieval: "none", confidence_floor: "estimated", softeners: "permitted", never_asked: true },
};

/* ── declared producers (capture-conduct Part Four, build step 5) ──
   Cross-domain links live HERE, not in the conversation's memory. Before
   income_total_annual derives, the reconciliation pass walks every
   producer and asserts an income entry or an explicit zero with a reason;
   unmatched producers land in flags.income_unreconciled, the total is not
   presented as complete, and the panel names the open asset.

   The walk itself runs at derive time in public/app/shared/finn-derived.js
   (derived values are computed at read, never stored); this declaration is
   the authoritative list the linter checks that walk against. Producers
   link by stable item id where the producer is an array item; the entity
   and the holdings are single objects/scalars today and keep the fixed
   tokens "entity" and "holdings" until they become arrays. */
export const PRODUCERS = [
  { key: "investments.properties[]", produces: ["rental_residential", "rental_commercial"],
    zero_with_reason: "rent_monthly of 0 on the property" },
  { key: "income.entity", produces: ["business_profit", "trust_distribution", "director_fee"],
    link_token: "entity" },
  { key: "investments.holdings", produces: ["dividends", "distributions"],
    link_token: "holdings" },
  { key: "income.structure:sole_trader", produces: ["business_profit"] },
];

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
  const t = item && item[entry.type_key || "type"];
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
      // A sighted value satisfies a document floor only while no working
      // upload path exists for that field (the capability flag lives in
      // code, above — not in the registry).
      const sightedOk = conf === "sighted" && entry.confidence_floor === "document" && !uploadWorks(w.id);
      if (floor !== undefined && rank < floor && !sightedOk && !refuse.has(w.id)) {
        errors.push(`gate: ${w.id} committed at "${conf ?? "no confidence"}" below floor "${entry.confidence_floor}" with no valid refusal record`);
      }
    }
    for (const req of entry.requires || []) {
      if (!req.includes(".")) {
        // Item-sibling require: must be present on the same array item.
        const sib = w.item ? w.item[req] : undefined;
        if (sib === null || sib === undefined) {
          errors.push(`gate: ${w.id} written before required field ${req} is present on the item`);
        }
      } else if (!presentInMerged(mergedDomains, req)) {
        errors.push(`gate: ${w.id} written before required field ${req} is present`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
