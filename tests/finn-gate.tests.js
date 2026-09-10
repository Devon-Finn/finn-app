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

  /* ── retrieval_by_type: income.other[] ── */
  t('other-government-stated-passes',
    persistenceGate({ income: { other: [{ type: 'government', label: 'FTB', amount_annual: 8000 }], structure: 'paye', _confidence: 'stated' } },
      { income: { structure: 'paye' } }, new Set()).ok);
  t('other-dividends-stated-blocked',
    persistenceGate({ income: { other: [{ type: 'dividends', label: 'VAS', amount_annual: 3000 }], _confidence: 'stated' } },
      { income: {} }, new Set()).errors.join().includes('income.other[].amount_annual'));
  t('other-unknown-type-strictest',
    persistenceGate({ income: { other: [{ amount_annual: 3000 }], _confidence: 'stated' } },
      { income: {} }, new Set()).errors.join().includes('income.other[].amount_annual'));
  t('other-dividends-document-passes',
    persistenceGate({ income: { other: [{ type: 'dividends', label: 'VAS', amount_annual: 3000 }], _confidence: 'document' } },
      { income: {} }, new Set()).ok);

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
    ['type', 'balance', 'rate_percent', 'minimum_monthly'].every(f => FIELD_REGISTRY['debts.items[].' + f]));

  return { pass: failures.length === 0, total: 23, failures };
}
