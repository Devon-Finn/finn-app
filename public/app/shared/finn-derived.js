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
    // Minimums on debt the household pays personally: entity-borrowed debt
    // is serviced inside the entity, and HECS comes out of pay before it
    // lands, so neither belongs in the personal surplus or the buffer.
    const personalMinimums = Array.isArray(debts.items)
      ? debts.items
          .filter(it => it && it.type !== 'hecs_help' && !['company', 'trust', 'smsf', 'partnership'].includes(it.borrower))
          .reduce((a, it) => a + (num(it && it.minimum_monthly) ?? 0), 0)
      : 0;
    function monthlyHousing() {
      if (exp.includes_housing === true) return 0;
      if (num(exp.housing_repayment_monthly) !== null) return exp.housing_repayment_monthly;
      if (home.owns_home === false || (num(home.mortgage_balance) !== null && home.mortgage_balance === 0)) return 0;
      return null;
    }
    let surplus_monthly = null;
    if (netMonthly !== null && num(exp.living_monthly) !== null) {
      const housing = monthlyHousing();
      if (housing !== null) {
        surplus_monthly = Math.round(netMonthly - exp.living_monthly - housing - personalMinimums);
      }
    }

    // buffer_months = accessible_savings ÷ (living_monthly +
    // housing_repayment_monthly + required debt minimums): a buffer covers
    // what still has to be paid when income stops, and the minimums keep
    // falling due.
    let buffer_months = null;
    if (num(buf.accessible_savings) !== null && num(exp.living_monthly) !== null) {
      const housing = monthlyHousing();
      if (housing !== null && (exp.living_monthly + housing + personalMinimums) > 0) {
        buffer_months = Math.round(buf.accessible_savings / (exp.living_monthly + housing + personalMinimums) * 10) / 10;
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
    // registry PRODUCERS). Producers link by stable item id. A rental
    // producer needs BOTH an income entry AND its costs (Devon, Sept
    // 2026): a gross-basis entry must carry costs_annual — a real figure,
    // or an explicit zero with a stated reason in costs_note; a
    // net-of-costs entry carries its costs inside. A property with gross
    // rent and no costs is unreconciled. rent_monthly of exactly 0 is the
    // explicit-zero producer (nothing to reconcile); rent_monthly alone
    // no longer satisfies.
    const rentalCostsOk = (o) => o.basis === 'net_of_costs'
      || (o.basis === 'gross' && num(o.costs_annual) !== null
          && (o.costs_annual > 0 || (typeof o.costs_note === 'string' && o.costs_note.length > 0)));
    const props = Array.isArray(inv.properties) ? inv.properties : [];
    const unlinkedRentals = other.filter(o =>
      (o.source === 'rental_residential' || o.source === 'rental_commercial') && !o.linked_asset_id);
    props.forEach((p, i) => {
      if (!p) return;
      const openId = (typeof p.id === 'string' && p.id) ? p.id : 'prop-' + (i + 1);
      if (num(p.rent_monthly) !== null && p.rent_monthly === 0) return; // explicit zero
      const linkedEntry = (typeof p.id === 'string' && p.id) ? other.find(o => o.linked_asset_id === p.id) : undefined;
      const soleEntry = (!linkedEntry && props.length === 1 && unlinkedRentals.length > 0) ? unlinkedRentals[0] : undefined;
      const entry = linkedEntry || soleEntry;
      if (!entry) { income_unreconciled.push(openId); return; }
      if ((entry.source === 'rental_residential' || entry.source === 'rental_commercial') && !rentalCostsOk(entry)) {
        income_unreconciled.push(openId + ':costs');
      }
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
    // The total never mixes bases SILENTLY: costs on gross entries are
    // summed separately, and the bases present in the total are named so
    // the panel states what is shown rather than netting anything itself.
    const knownCosts = other.map(o => o.costs_annual).filter(v => num(v) !== null);
    const income_costs_annual = knownCosts.length ? knownCosts.reduce((a, b) => a + b, 0) : null;
    const income_total_bases = [...new Set(other
      .filter(o => num(o.amount_annual) !== null && typeof o.basis === 'string')
      .map(o => o.basis))];

    // property_equity — per investment property: value_estimate minus the
    // loan against it. The loan lives ONCE: either on the property
    // (loan_balance) or as a debts item secured against it
    // (secured_against_asset_id), never both.
    const allDebtItems = Array.isArray(debts.items) ? debts.items.filter(it => it && typeof it === 'object') : [];
    const securedAgainst = {};
    for (const it of allDebtItems) {
      if (typeof it.secured_against_asset_id === 'string' && it.secured_against_asset_id && num(it.balance) !== null) {
        securedAgainst[it.secured_against_asset_id] = (securedAgainst[it.secured_against_asset_id] || 0) + it.balance;
      }
    }
    const property_equity = props.map(p => {
      if (!p || num(p.value_estimate) === null) return null;
      const own = num(p.loan_balance);
      const secured = (typeof p.id === 'string' && p.id && securedAgainst[p.id] !== undefined) ? securedAgainst[p.id] : null;
      const loan = own !== null ? own : secured;
      return loan !== null ? p.value_estimate - loan : null;
    });

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

    return { home_equity, lvr_percent, surplus_monthly, buffer_months, super_total, income_total_annual, income_costs_annual, income_total_bases, income_unreconciled, property_equity, debts_total, debts_total_by_entity };
  }

  window.finnDerived = { derive };
})();
