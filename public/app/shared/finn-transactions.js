/* Resolution arithmetic for the CSV living-costs path — CODE does the
   arithmetic, the model does the judgment (Devon's spec §7). The server
   summarised the raw rows; the person classified the outliers in
   conversation; this applies those classifications deterministically and
   the model never does the division.

   One-offs STAY IN the spend (Devon's ruling): every household has
   unusual spending every year, just a different unusual thing each time,
   and stripping them out is systematically flattering. Only housing and
   internal transfers are removed. The categories still matter — they
   decide what Finn can honestly say about the figure's composition.

   resolutions: { id: "recurring_annual" | "one_off" | "housing" |
                       "internal_transfer" }

   Exposed as window.finnTransactions.applyResolutions(summary, resolutions). */
(function () {
  function applyResolutions(summary, resolutions) {
    const unresolved = summary.outliers.filter(o => !resolutions[o.id]);
    if (unresolved.length) return { error: "unresolved", ids: unresolved.map(o => o.id) };
    let kept = summary.base_debits;
    let housingTotal = 0;
    let oneOffTotal = 0;
    const oneOffLabels = [];
    // Where the money goes (16 Sept 2026): the same rows, by category.
    // Housing and internal transfers leave the categories exactly as they
    // leave the total, so the categories always add up to the figure.
    const cats = Object.assign({}, summary.base_by_category || {});
    const addCat = (k, v) => { const key = k || 'other'; cats[key] = (cats[key] || 0) + v; };
    let annualTotal = (summary.annual_bills && summary.annual_bills.total) || 0;
    const annualLabels = ((summary.annual_bills && summary.annual_bills.labels) || []).slice();
    for (const r of summary.recurring) {
      const res = resolutions[r.id];
      if (res === "housing") { housingTotal += r.total; continue; }
      kept += r.total;
      addCat(r.category, r.total);
    }
    for (const o of summary.outliers.filter(o => !o.recurring)) {
      const res = resolutions[o.id];
      if (res === "housing") { housingTotal += o.amount; continue; }
      if (res === "internal_transfer") continue;
      kept += o.amount;
      addCat(o.category, o.amount);
      if (res === "one_off") { oneOffTotal += o.amount; oneOffLabels.push(o.label); }
      if (res === "recurring_annual") {
        annualTotal += o.amount;
        const term = o.annual_term || 'other yearly bills';
        if (annualLabels.length < 5 && !annualLabels.includes(term)) annualLabels.push(term);
      }
    }
    const months = summary.coverage.months;
    const byCategory = {};
    for (const [k, v] of Object.entries(cats)) byCategory[k] = Math.round(v / months);
    return {
      living_monthly: Math.round(kept / months),
      housing_monthly: housingTotal ? Math.round(housingTotal / months) : null,
      one_off_monthly: Math.round(oneOffTotal / months),
      one_off_labels: oneOffLabels,
      annual_equivalent: Math.round((kept / months) * 12),
      coverage_months: months,
      by_category: byCategory,
      annual_bills_monthly: Math.round(annualTotal / months),
      annual_bills_labels: annualLabels,
      confidence: summary.coverage_short ? "estimated" : "document",
    };
  }

  if (typeof window !== 'undefined') window.finnTransactions = { applyResolutions };
  if (typeof globalThis !== 'undefined') globalThis.__finnApplyResolutions = applyResolutions;
})();
