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
     income_total_annual, property_equity[], debts_total
   } */
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
        const minimums = Array.isArray(debts.items)
          ? debts.items.reduce((a, it) => a + (num(it && it.minimum_monthly) ?? 0), 0)
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

    // income_total_annual = sum of all annual income fields
    const income_total_annual = sumKnown([
      inc.salary_gross_annual, inc.partner_salary_gross_annual,
      inc.business_income_annual, inc.rental_income_annual, inc.other_income_annual
    ]);

    // property_equity — per investment property: value_estimate − loan_balance
    const property_equity = Array.isArray(inv.properties)
      ? inv.properties.map(p => (p && num(p.value_estimate) !== null && num(p.loan_balance) !== null)
          ? p.value_estimate - p.loan_balance : null)
      : [];

    // debts_total = sum(debts.items[].balance) — HECS excluded by design.
    const debts_total = Array.isArray(debts.items)
      ? sumKnown(debts.items.map(it => it && it.balance)) : null;

    return { home_equity, lvr_percent, surplus_monthly, buffer_months, super_total, income_total_annual, property_equity, debts_total };
  }

  window.finnDerived = { derive };
})();
