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
    for (const r of summary.recurring) {
      const res = resolutions[r.id];
      if (res === "housing") { housingTotal += r.total; continue; }
      kept += r.total;
    }
    for (const o of summary.outliers.filter(o => !o.recurring)) {
      const res = resolutions[o.id];
      if (res === "housing") { housingTotal += o.amount; continue; }
      if (res === "internal_transfer") continue;
      kept += o.amount;
      if (res === "one_off") { oneOffTotal += o.amount; oneOffLabels.push(o.label); }
    }
    const months = summary.coverage.months;
    return {
      living_monthly: Math.round(kept / months),
      housing_monthly: housingTotal ? Math.round(housingTotal / months) : null,
      one_off_monthly: Math.round(oneOffTotal / months),
      one_off_labels: oneOffLabels,
      annual_equivalent: Math.round((kept / months) * 12),
      coverage_months: months,
      confidence: summary.coverage_short ? "estimated" : "document",
    };
  }

  window.finnTransactions = { applyResolutions };
})();
