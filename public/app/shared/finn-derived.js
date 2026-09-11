/* Derived values over the v2 picture.domains shape — field-spec.md Part 2.11.
   Computed at READ time, never stored: storing any of these guarantees they
   drift out of sync with their inputs.

   Conventions honoured throughout:
   - null means "not yet asked"; a derivation whose required inputs are null
     returns null, never 0 — a tile must say "none recorded" rather than
     implying a zero the person never confirmed.
   - HECS is held separately and NEVER included in debts_total.

   Exposed as window.finnDerived.derive(domains) -> {
     home_equity, lvr_percent, surplus_monthly, buffer_months, super_total,
     income_total_annual, income_unreconciled[], property_equity[],
     debts_total, debts_total_by_entity{}
   }
   income_unreconciled non-empty means the income total is NOT complete:
   the panel names the open producer rather than showing a total that
   omits it. */
(function () {
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;

  function sumKnown(values) {
    const known = values.filter(v => num(v) !== null);
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
  }

  function derive(domains) {
    const d = domains || {};
    const home = d.home || {};
    const inc = d.income || {};
    const exp = d.expenses || {};
    const buf = d.buffer || {};
    const sup = d.super || {};
    const inv = d.investments || {};
    const debts = d.debts || {};

    // home_equity = home.value_estimate − home.mortgage_balance
    const home_equity = (num(home.value_estimate) !== null && num(home.mortgage_balance) !== null)
      ? home.value_estimate - home.mortgage_balance : null;

    // lvr_percent = mortgage_balance ÷ value_estimate × 100
    const lvr_percent = (num(home.mortgage_balance) !== null && num(home.value_estimate) !== null && home.value_estimate > 0)
      ? Math.round(home.mortgage_balance / home.value_estimate * 1000) / 10 : null;

    // surplus_monthly = (all net monthly income) − living_monthly
    //                   − housing_repayment_monthly − sum(debts minimums)
    // Net monthly income uses the *_net_monthly fields only (the spec
    // captures take-home directly rather than modelling tax). Housing
    // repayment counts as 0 when expenses.includes_housing is true (it is
    // already inside living_monthly) and when the household owns no home.
    const netMonthly = sumKnown([inc.salary_net_monthly, inc.partner_salary_net_monthly]);
    let surplus_monthly = null;
    if (netMonthly !== null && num(exp.living_monthly) !== null) {
      let housing = null;
      if (exp.includes_housing === true) housing = 0;
      else if (num(exp.housing_repayment_monthly) !== null) housing = exp.housing_repayment_monthly;
      else if (home.owns_home === false || (num(home.mortgage_balance) !== null && home.mortgage_balance === 0)) housing = 0;
      if (housing !== null) {
        // Minimums on debt the household pays personally: entity-borrowed
        // debt is serviced inside the entity, and HECS comes out of pay
        // before it lands, so neither belongs in the personal surplus.
        const minimums = Array.isArray(debts.items)
          ? debts.items
              .filter(it => it && it.type !== 'hecs_help' && !['company', 'trust', 'smsf', 'partnership'].includes(it.borrower))
              .reduce((a, it) => a + (num(it.minimum_monthly) ?? 0), 0)
          : 0;
        surplus_monthly = Math.round(netMonthly - exp.living_monthly - housing - minimums);
      }
    }

    // buffer_months = accessible_savings ÷ (living_monthly + housing_repayment_monthly)
    let buffer_months = null;
    if (num(buf.accessible_savings) !== null && num(exp.living_monthly) !== null) {
      let housing = null;
      if (exp.includes_housing === true) housing = 0;
      else if (num(exp.housing_repayment_monthly) !== null) housing = exp.housing_repayment_monthly;
      else if (home.owns_home === false || (num(home.mortgage_balance) !== null && home.mortgage_balance === 0)) housing = 0;
      if (housing !== null && (exp.living_monthly + housing) > 0) {
        buffer_months = Math.round(buf.accessible_savings / (exp.living_monthly + housing) * 10) / 10;
      }
    }

    // super_total = sum(super.funds[].balance)
    const super_total = Array.isArray(sup.funds)
      ? sumKnown(sup.funds.map(f => f && f.balance)) : null;

    // ── THE RECONCILIATION PASS (field-spec Part 2, Sept 2026 fold) ──
    // Before income_total_annual derives, walk every declared producer and
    // assert an income entry or an explicit zero with a reason. Unmatched
    // producers land in income_unreconciled and the total is not presented
    // as complete — the panel names the open asset rather than showing a
    // total that omits it.
    // Normalise: an un-migrated item still keyed by the old `type` reads as
    // its 1:1 source (family_support is "other" by definition of the new enum).
    const other = (Array.isArray(inc.other) ? inc.other.filter(o => o && typeof o === 'object') : [])
      .map(o => o.source ? o : Object.assign({}, o, { source: o.type === 'family_support' ? 'other' : o.type }));
    const income_unreconciled = [];
    // Anything the migration parked (legacy scalars, un-typeable items)
    // stays open until re-captured — never silently excluded.
    const storedOpen = (d.flags && Array.isArray(d.flags.income_unreconciled)) ? d.flags.income_unreconciled : [];
    for (const id of storedOpen) income_unreconciled.push(id);
    // A stored row the server hasn't migrated yet may still carry the old
    // scalars. They no longer sum (they can't be typed without guessing),
    // so they surface as open items here too — excluded loudly, never
    // silently.
    if (num(inc.business_income_annual) !== null && !income_unreconciled.includes('legacy:business_income_annual')) {
      income_unreconciled.push('legacy:business_income_annual');
    }
    if (num(inc.rental_income_annual) !== null && !income_unreconciled.includes('legacy:rental_income_annual')) {
      income_unreconciled.push('legacy:rental_income_annual');
    }
    // Producer: every investment property (capture-conduct Part Four /
    // registry PRODUCERS). Producers link by stable item id. Satisfied by
    // an income entry linked to the property's id, an UNAMBIGUOUS unlinked
    // match (exactly one property and an unlinked rental entry — the same
    // no-guess principle as the positional-link migration), or the
    // property's own rent_monthly as a known number (0 is an explicit
    // zero, null is not-yet-asked).
    const props = Array.isArray(inv.properties) ? inv.properties : [];
    const unlinkedRentals = other.filter(o =>
      (o.source === 'rental_residential' || o.source === 'rental_commercial') && !o.linked_asset_id);
    props.forEach((p, i) => {
      if (!p) return;
      const openId = (typeof p.id === 'string' && p.id) ? p.id : 'prop-' + (i + 1);
      const linked = (typeof p.id === 'string' && p.id) && other.some(o => o.linked_asset_id === p.id);
      const soleUnambiguous = props.length === 1 && unlinkedRentals.length > 0;
      const ownRent = num(p.rent_monthly) !== null;
      if (!linked && !soleUnambiguous && !ownRent) income_unreconciled.push(openId);
    });
    // Producer: the company or trust. Satisfied by any entity-flavoured
    // income entry or an explicit link.
    if (inc.entity && typeof inc.entity === 'object' && inc.entity.type) {
      const entitySat = other.some(o => o.linked_asset_id === 'entity' ||
        ['trust_distribution', 'business_profit', 'director_fee'].includes(o.source));
      if (!entitySat) income_unreconciled.push('entity');
    }
    // Producer: the share/ETF/fund holdings. Satisfied by a dividends or
    // distributions entry or an explicit link (amount 0 is an explicit zero).
    if ((num(inv.shares_value) !== null && inv.shares_value > 0) ||
        (num(inv.managed_funds_value) !== null && inv.managed_funds_value > 0)) {
      const holdSat = other.some(o => o.linked_asset_id === 'holdings' ||
        ['dividends', 'distributions'].includes(o.source));
      if (!holdSat) income_unreconciled.push('holdings');
    }
    // Producer: a business run as a sole trader. (Company/trust businesses
    // are the entity producer above.)
    if (inc.structure === 'sole_trader') {
      if (!other.some(o => o.source === 'business_profit')) income_unreconciled.push('business');
    }
    const otherAnnual = other.length ? sumKnown(other.map(o => o.amount_annual)) : null;
    const income_total_annual = sumKnown([
      inc.salary_gross_annual, inc.partner_salary_gross_annual, otherAnnual
    ]);

    // property_equity — per investment property: value_estimate − loan_balance
    const property_equity = Array.isArray(inv.properties)
      ? inv.properties.map(p => (p && num(p.value_estimate) !== null && num(p.loan_balance) !== null)
          ? p.value_estimate - p.loan_balance : null)
      : [];

    // debts totals derive PER ENTITY (field-spec Part 2): borrowing known
    // to sit inside a company, trust, smsf or partnership is never summed
    // into the personal total. The personal total takes personal, joint and
    // not-yet-classified items (excluding known-entity debt is the rule;
    // vanishing a debt whose borrower hasn't been asked yet would hide it).
    // HECS excluded by design — both the separate balance and hecs_help items.
    const items = Array.isArray(debts.items) ? debts.items.filter(it => it && it.type !== 'hecs_help') : [];
    const ENTITY_BORROWERS = ['company', 'trust', 'smsf', 'partnership'];
    const personalItems = items.filter(it => !ENTITY_BORROWERS.includes(it.borrower));
    const debts_total = items.length ? sumKnown(personalItems.map(it => it.balance)) : null;
    const debts_total_by_entity = {};
    for (const it of items) {
      const b = ENTITY_BORROWERS.includes(it.borrower) ? it.borrower : 'personal';
      if (num(it.balance) !== null) debts_total_by_entity[b] = (debts_total_by_entity[b] || 0) + it.balance;
    }

    return { home_equity, lvr_percent, surplus_monthly, buffer_months, super_total, income_total_annual, income_unreconciled, property_equity, debts_total, debts_total_by_entity };
  }

  window.finnDerived = { derive };
})();
