/* Persistence-gate unit suite — capture-conduct steps 1-2 with Devon's
   corrections. Run by blob-importing lib/finn-field-registry.js (e.g. from
   GitHub raw in a browser) and calling runGateTests(mod).

   The refusal-validity contract lives in clarity-chat and is replicated
   here as documented behaviour: a claimed refusal is VALID only where a
   code-written path_served event exists for that field id in the SAME
   session; refusals from earlier sessions have expired. The pure gate
   receives only the valid set. */

export function runGateTests(mod) {
  const { FIELD_REGISTRY, persistenceGate } = mod;
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };

  // Replicates clarity-chat's validity computation, per the contract.
  const validSet = (claimed, servedThisSession) =>
    new Set(claimed.filter(f => servedThisSession.has(f)));

  /* ── the original floor/requires cases, under three-state retrieval ── */
  t('required-stated-blocked',
    persistenceGate({ home: { mortgage_balance: 512000, _confidence: 'stated' } }, { home: { mortgage_balance: 512000 } }, new Set()).errors.length === 1);
  t('required-document-passes',
    persistenceGate({ home: { mortgage_balance: 512000, _confidence: 'document' } }, { home: {} }, new Set()).ok);
  t('floor-estimated-passes-estimated',
    persistenceGate({ home: { value_estimate: 900000, _confidence: 'estimated' } }, { home: {} }, new Set()).ok);
  t('missing-confidence-blocked',
    persistenceGate({ home: { mortgage_balance: 512000 } }, { home: { mortgage_balance: 512000 } }, new Set()).errors.length === 1);
  t('offered-stated-passes-no-record',   // offered accepts a stated answer, no refusal needed
    persistenceGate({ home: { lender: 'CBA', _confidence: 'stated' } }, { home: {} }, new Set()).ok);
  t('none-passes',
    persistenceGate({ context: { owner_age: 41, _confidence: 'stated' } }, { context: {} }, new Set()).ok);
  t('requires-offset-blocked',
    persistenceGate({ home: { offset_balance: 0, _confidence: 'document' } }, { home: { offset_balance: 0 } }, new Set()).errors.join().includes('home.has_offset'));
  t('requires-satisfied-from-base',
    persistenceGate({ home: { offset_balance: 0, _confidence: 'document' } }, { home: { offset_balance: 0, has_offset: true } }, new Set()).ok);
  t('requires-living-includes-housing',
    persistenceGate({ expenses: { living_monthly: 5000, _confidence: 'document' } }, { expenses: { living_monthly: 5000 } }, new Set()).errors.length === 1);
  t('requires-same-patch-ok',
    persistenceGate({ expenses: { living_monthly: 5000, includes_housing: false, _confidence: 'document' } }, { expenses: { living_monthly: 5000, includes_housing: false } }, new Set()).ok);
  t('array-field-blocked',
    persistenceGate({ super: { funds: [{ balance: 80000 }], _confidence: 'stated' } }, { super: { funds: [{ balance: 80000 }] } }, new Set()).errors.join().includes('super.funds[].balance'));
  t('never-asked-skipped',
    persistenceGate({ flags: { hardship: true, _confidence: 'inferred' } }, { flags: { hardship: true } }, new Set()).ok);

  /* ── retrieval_by_type: income.other[] (source-keyed since the Part 2 fold) ── */
  t('other-government-stated-passes',
    persistenceGate({ income: { other: [{ source: 'government', entity: 'personal', amount_annual: 8000 }], structure: 'paye', _confidence: 'stated' } },
      { income: { structure: 'paye' } }, new Set()).ok);
  t('other-dividends-stated-blocked',
    persistenceGate({ income: { other: [{ source: 'dividends', linked_asset_id: 'holdings', amount_annual: 3000 }], _confidence: 'stated' } },
      { income: {} }, new Set()).errors.join().includes('income.other[].amount_annual'));
  t('other-unknown-source-strictest',
    persistenceGate({ income: { other: [{ amount_annual: 3000 }], _confidence: 'stated' } },
      { income: {} }, new Set()).errors.join().includes('income.other[].amount_annual'));
  t('other-dividends-document-passes',
    persistenceGate({ income: { other: [{ source: 'dividends', linked_asset_id: 'holdings', amount_annual: 3000 }], _confidence: 'document' } },
      { income: {} }, new Set()).ok);
  t('other-director-fee-stated-blocked',
    persistenceGate({ income: { other: [{ source: 'director_fee', entity: 'company', amount_annual: 20000 }], _confidence: 'stated' } },
      { income: {} }, new Set()).errors.join().includes('income.other[].amount_annual'));
  t('other-other-source-stated-passes',
    persistenceGate({ income: { other: [{ source: 'other', entity: 'personal', amount_annual: 5000 }], _confidence: 'stated' } },
      { income: {} }, new Set()).ok);

  /* ── debts.items[].type requires [purpose, borrower] — ENFORCED, item-sibling ── */
  t('debt-type-without-purpose-blocked',
    persistenceGate({ debts: { items: [{ type: 'personal_loan', balance: 9800 }], _confidence: 'document' } },
      { debts: { items: [{ type: 'personal_loan', balance: 9800 }] } }, new Set()).errors.join().includes('purpose'));
  t('debt-type-with-purpose-borrower-passes',
    persistenceGate({ debts: { items: [{ type: 'personal_loan', purpose: 'vehicle', borrower: 'personal', balance: 9800 }], _confidence: 'document' } },
      { debts: {} }, new Set()).ok);
  t('debt-type-unknown-values-pass',   // "unknown" is a legitimate, reachable value
    persistenceGate({ debts: { items: [{ type: 'other', purpose: 'unknown', borrower: 'unknown', balance: 500 }], _confidence: 'document' } },
      { debts: {} }, new Set()).ok);
  t('debt-purpose-not-in-merged-only',  // sibling requires check the ITEM, not the merged picture
    persistenceGate({ debts: { items: [{ type: 'loan_split', balance: 80000 }], _confidence: 'document' } },
      { debts: { items: [{ type: 'home_loan', purpose: 'owner_occupied', borrower: 'joint' }] } }, new Set()).errors.join().includes('borrower'));

  /* ── correction 6: the forced-refusal fixture ──
     A scripted session where the person declines a required field twice. */
  const SESSION = 's-1';
  const served = new Set();          // path_served events, code-written
  const claimed = [];                // refusals the model records
  // Turn 1: the person declines before any path text was served (the model
  // jumped ahead). Refusal claimed, but NOT code-witnessed → invalid →
  // the gate still fires.
  claimed.push('home.mortgage_balance');
  let g1 = persistenceGate(
    { home: { mortgage_balance: 512000, _confidence: 'stated' } },
    { home: { mortgage_balance: 512000 } },
    validSet(claimed, served));
  t('decline-1-unwitnessed-still-fires', g1.errors.length === 1);
  // Code serves the path (step 4 behaviour), the person declines again.
  served.add('home.mortgage_balance');
  let g2 = persistenceGate(
    { home: { mortgage_balance: 512000, _confidence: 'stated' } },
    { home: { mortgage_balance: 512000 } },
    validSet(claimed, served));
  t('decline-2-witnessed-passes', g2.ok);
  // Same session, later turn: the refusal stays valid (sticky in-session).
  let g3 = persistenceGate(
    { home: { mortgage_balance: 515000, _confidence: 'stated' } },
    { home: { mortgage_balance: 515000 } },
    validSet(claimed, served));
  t('same-session-sticky', g3.ok);
  // A LATER session: path_served events are per-session, so the served set
  // is empty again — the refusal has expired and the gate fires until the
  // path is served and declined afresh.
  const servedNextSession = new Set();
  let g4 = persistenceGate(
    { home: { mortgage_balance: 512000, _confidence: 'stated' } },
    { home: { mortgage_balance: 512000 } },
    validSet(claimed, servedNextSession));
  t('next-session-expired-fires', g4.errors.length === 1);

  /* ── registry shape assertions ── */
  const entries = Object.entries(FIELD_REGISTRY);
  t('all-entries-have-retrieval-state',
    entries.every(([id, e]) => e.retrieval_by_type || ['required', 'offered', 'none'].includes(e.retrieval)));
  t('no-required-with-stated-floor-noop',
    entries.filter(([, e]) => e.retrieval === 'required').every(([, e]) => e.confidence_floor !== 'stated'));
  t('debts-item-subfields-individually-registered',
    ['type', 'purpose', 'borrower', 'security', 'is_split', 'parent_loan_id', 'balance', 'rate_percent', 'minimum_monthly']
      .every(f => FIELD_REGISTRY['debts.items[].' + f]));
  t('income-other-subfields-new-shape',
    ['source', 'linked_asset_id', 'entity', 'basis', 'amount_annual'].every(f => FIELD_REGISTRY['income.other[].' + f])
    && !FIELD_REGISTRY['income.other[].type'] && !FIELD_REGISTRY['income.other[].label']);
  t('legacy-income-scalars-deregistered',
    !FIELD_REGISTRY['income.business_income_annual'] && !FIELD_REGISTRY['income.rental_income_annual']);
  // The same-trip promotions (Devon, Sept 2026): all required, all floored
  // at document.
  const PROMOTED = [
    'protection.life.inside_super', 'protection.tpd.inside_super',
    'protection.trauma.inside_super', 'protection.income_protection.inside_super',
    'estate.super_nomination.in_place', 'estate.super_nomination.binding',
    'estate.super_nomination.last_updated', 'home.has_offset', 'buffer.linked_to_loan',
    'super.funds[].fund', 'super.extra_contributions', 'income.employer_super_on',
    'investments.properties[].repayment_type',
  ];
  t('same-trip-promotions-required-document',
    PROMOTED.every(id => FIELD_REGISTRY[id] && FIELD_REGISTRY[id].retrieval === 'required' && FIELD_REGISTRY[id].confidence_floor === 'document'));
  // The separate-trip fields stay offered.
  const STAY_OFFERED = ['home.package_fee_annual', 'debts.hecs_balance',
    'estate.will.last_updated', 'estate.poa.last_updated', 'estate.guardianship.last_updated'];
  t('separate-trip-fields-stay-offered',
    STAY_OFFERED.every(id => FIELD_REGISTRY[id] && FIELD_REGISTRY[id].retrieval === 'offered'));
  t('debt-type-requires-enforced-not-pending',
    (() => { const e = FIELD_REGISTRY['debts.items[].type'];
      return !e.requires_pending_schema && Array.isArray(e.requires) &&
        e.requires.includes('purpose') && e.requires.includes('borrower'); })());

  return { pass: failures.length === 0, total: 34, failures };
}
