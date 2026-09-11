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

  /* ── sighted (Devon, Sept 2026): document > sighted > stated > estimated.
     Upload works today (UPLOAD_PATH_WORKS true), so sighted does NOT
     satisfy a document floor anywhere — it ranks below document and the
     gate fires. The satisfies-when-no-upload branch flips in code, not in
     the registry. ── */
  t('sighted-ranks-between-stated-and-document',
    mod.CONFIDENCE_RANK.sighted === 3 && mod.CONFIDENCE_RANK.document === 4 &&
    mod.CONFIDENCE_RANK.stated === 2 && mod.CONFIDENCE_RANK.estimated === 1);
  t('sighted-blocked-while-upload-works',
    persistenceGate({ home: { mortgage_balance: 512000, _confidence: 'sighted' } }, { home: { mortgage_balance: 512000 } }, new Set()).errors.length === 1);
  t('upload-capability-flag-lives-in-code',
    mod.UPLOAD_PATH_WORKS === true && typeof mod.uploadWorks === 'function');

  /* ── security required by type (Devon item 4): unsecurable products
     resolve without a trip; every real loan product needs the loan path. ── */
  t('security-credit-card-stated-passes',
    persistenceGate({ debts: { items: [{ type: 'credit_card', purpose: 'personal', borrower: 'personal', security: 'unsecured' }], _confidence: 'stated' } },
      { debts: {} }, new Set()).ok);
  t('security-car-loan-stated-blocked',
    persistenceGate({ debts: { items: [{ type: 'car_loan', purpose: 'vehicle', borrower: 'personal', security: 'vehicle', balance: 18400 }], _confidence: 'document' } },
      { debts: {} }, new Set()).ok
    && persistenceGate({ debts: { items: [{ type: 'car_loan', purpose: 'vehicle', borrower: 'personal', security: 'vehicle' }], _confidence: 'stated' } },
      { debts: {} }, new Set()).errors.join().includes('debts.items[].security'));
  t('security-unknown-type-strictest',
    persistenceGate({ debts: { items: [{ purpose: 'unknown', borrower: 'unknown', security: 'other' }], _confidence: 'stated' } },
      { debts: {} }, new Set()).errors.join().includes('debts.items[].security'));

  /* ── step 5: producers are declared in the registry, not remembered. ── */
  t('producers-declared',
    Array.isArray(mod.PRODUCERS) && mod.PRODUCERS.length === 4 &&
    mod.PRODUCERS.some(p => p.key === 'investments.properties[]') &&
    mod.PRODUCERS.some(p => p.key === 'income.entity') &&
    mod.PRODUCERS.some(p => p.key === 'investments.holdings') &&
    mod.PRODUCERS.some(p => p.key === 'income.structure:sole_trader'));

  return { pass: failures.length === 0, total: 41, failures };
}

/* ── capture-conduct steps 3-4: the retrieval path file and the
   templated asks. Run by blob-importing lib/finn-retrieval-paths.js
   alongside the registry and calling runPathTests(regMod, pathsMod). */
export function runPathTests(regMod, pathsMod) {
  const { FIELD_REGISTRY } = regMod;
  const { RETRIEVAL_PATHS, askFor, servedFieldIds } = pathsMod;
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };

  const pathIds = Object.keys(RETRIEVAL_PATHS);
  const entries = Object.entries(FIELD_REGISTRY);

  // Every path id the registry points at exists in the path file.
  const referenced = new Set();
  for (const [, e] of entries) for (const p of e.paths || []) referenced.add(p);
  t('every-registry-path-id-resolves',
    [...referenced].every(p => RETRIEVAL_PATHS[p]));

  // Every field a path claims to satisfy is a registered field.
  t('every-satisfies-field-registered',
    pathIds.every(id => RETRIEVAL_PATHS[id].satisfies.every(f => FIELD_REGISTRY[f])));

  // The witness fragment appears verbatim in the assembled ask — the
  // code-witnessing contract depends on it.
  t('every-witness-inside-its-ask',
    pathIds.every(id => askFor(id).includes(RETRIEVAL_PATHS[id].witness)));

  // Softeners are structurally absent: the ask is assembled from data, so
  // there is nothing to detect.
  const SOFTENERS = /\b(roughly|approximately|ballpark|a rough idea|if you know it)\b/i;
  t('no-softener-in-any-ask', pathIds.every(id => !SOFTENERS.test(askFor(id))));

  // No em-dash anywhere in ask text (visible-stream brand rule).
  t('no-emdash-in-any-ask', pathIds.every(id => !askFor(id).includes('—')));

  // The deferral is never offered: no template suggests skipping or
  // coming back later.
  const DEFERRAL = /\b(skip this|come back to (?:this|it) later|leave (?:this|it) for now|we can do this later)\b/i;
  t('no-deferral-in-any-ask', pathIds.every(id => !DEFERRAL.test(askFor(id))));

  // Witness detection: verbatim delivery is detected through streaming
  // whitespace and typographic apostrophes; a paraphrase is NOT.
  const loanAsk = askFor('loan_details');
  t('witness-detects-verbatim-ask',
    servedFieldIds('Warm words first. ' + loanAsk + ' And warm words after.')
      .includes('home.mortgage_balance'));
  t('witness-tolerates-wrapping',
    servedFieldIds(loanAsk.replace(/ /g, '\n')).includes('home.mortgage_balance'));
  t('witness-rejects-paraphrase',
    servedFieldIds('Could you open your banking app and check the loan balance for me?').length === 0);
  t('witness-serves-whole-visit',   // one visit satisfies every declared field
    (() => { const s = servedFieldIds(loanAsk);
      return ['home.rate_percent', 'home.has_offset', 'home.offset_balance', 'buffer.linked_to_loan']
        .every(f => s.includes(f)); })());

  return { pass: failures.length === 0, total: 10, failures };
}

/* ── stable asset ids and id-aware merge (lib/finn-merge.js) ──
   Run by blob-importing lib/finn-merge.js and calling
   runMergeTests(mergeMod). */
export function runMergeTests(mod) {
  const { assignAssetIds, mergeDomainsById, migratePositionalLinks, resolveSecurity } = mod;
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };

  // Ids are assigned at first write and existing ids are never touched.
  const withIds = assignAssetIds({ super: { funds: [{ fund: 'Aware', balance: 80000 }, { id: 'keep1234', fund: 'Rest' }] } });
  t('id-assigned-at-first-write',
    typeof withIds.super.funds[0].id === 'string' && withIds.super.funds[0].id.length > 0);
  t('existing-id-untouched', withIds.super.funds[1].id === 'keep1234');
  t('ids-are-random-not-positional',
    assignAssetIds({ debts: { items: [{ type: 'other' }] } }).debts.items[0].id !==
    assignAssetIds({ debts: { items: [{ type: 'other' }] } }).debts.items[0].id);

  // Merge by id: an echoed id updates in place, an id-less item appends,
  // unmentioned items are retained.
  const base = { debts: { items: [{ id: 'a1', type: 'credit_card', balance: 6200 }, { id: 'b2', type: 'car_loan', balance: 18400 }], _confidence: 'stated' } };
  const merged = mergeDomainsById(base, { debts: { items: [{ id: 'a1', balance: 5100 }, { type: 'personal_loan', balance: 9800 }], _confidence: 'stated' } });
  t('merge-by-id-updates-in-place',
    merged.debts.items.find(x => x.id === 'a1').balance === 5100 &&
    merged.debts.items.find(x => x.id === 'a1').type === 'credit_card');
  t('merge-retains-unmentioned-items',
    merged.debts.items.some(x => x.id === 'b2' && x.balance === 18400));
  t('merge-appends-idless-items',
    merged.debts.items.length === 3 && merged.debts.items.some(x => x.type === 'personal_loan'));
  t('scalar-arrays-still-replace',
    mergeDomainsById({ income: { employer_super_on: ['salary', 'partner_salary'] } },
      { income: { employer_super_on: ['salary'] } }).income.employer_super_on.length === 1);

  // Positional link migration: prop-1 with exactly one property is the
  // only unambiguous mapping; everything else clears, never remapped.
  const oneProp = migratePositionalLinks(assignAssetIds({
    investments: { properties: [{ value_estimate: 640000 }] },
    income: { other: [{ source: 'rental_residential', linked_asset_id: 'prop-1', amount_annual: 28080 }] },
  }));
  t('positional-link-unambiguous-carries',
    oneProp.income.other[0].linked_asset_id === oneProp.investments.properties[0].id);
  const twoProps = migratePositionalLinks(assignAssetIds({
    investments: { properties: [{ value_estimate: 640000 }, { value_estimate: 480000 }] },
    income: { other: [{ source: 'rental_residential', linked_asset_id: 'prop-2', amount_annual: 28080 }] },
  }));
  t('positional-link-ambiguous-clears-never-guesses',
    twoProps.income.other[0].linked_asset_id === null);

  // Security resolves to unsecured, code-side, for the four products that
  // cannot carry security — and only for them, and never over an answer.
  const sec = resolveSecurity({ debts: { items: [
    { id: 'c1', type: 'credit_card' }, { id: 'h1', type: 'hecs_help' },
    { id: 'v1', type: 'car_loan' }, { id: 'x1', type: 'bnpl', security: 'other' },
  ] } });
  t('security-resolves-unsecurable',
    sec.debts.items[0].security === 'unsecured' && sec.debts.items[1].security === 'unsecured');
  t('security-never-resolves-real-loans', sec.debts.items[2].security === undefined);
  t('security-never-overwrites-an-answer', sec.debts.items[3].security === 'other');

  return { pass: failures.length === 0, total: 12, failures };
}
