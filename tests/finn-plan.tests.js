/* The guide model — plan, coverage, closing and the code-emitted copy.
   (Finn-Guide-Model-Discovery-Design-Sept2026.)

   Run with the plan, pipeline and tokens libs:
     runPlanTests({ plan, pipeline, tokens }) */

// A household with every area answered, used as the "full" base.
function fullHousehold() {
  return {
    domains: {
      context: { adults: 2, owner_age: 42, partner_age: 40, children: [{ id: 'k1', age: 9 }, { id: 'k2', age: 6 }], _confidence: 'stated' },
      income: {
        structure: 'company', entity: { type: 'company', name: 'Kestrel Holdings Pty Ltd' },
        salary_gross_annual: 118000, salary_net_monthly: 7280, partner_salary_gross_annual: 72000, partner_salary_net_monthly: 4710,
        employer_super_on: ['salary', 'partner_salary'],
        other: [
          { id: 'i1', source: 'rental_commercial', linked_asset_id: 'p1', entity: 'company', amount_annual: 42000, basis: 'gross', costs_annual: 6800 },
          { id: 'i2', source: 'dividends', linked_asset_id: 'holdings', entity: 'joint', amount_annual: 2100, basis: 'gross' },
          { id: 'i3', source: 'business_profit', linked_asset_id: 'entity', entity: 'company', amount_annual: 8980, basis: 'net_of_costs' },
        ],
        _confidence: 'document',
      },
      expenses: { living_monthly: 6500, includes_housing: false, _confidence: 'document' },
      home: { owns_home: true, value_estimate: 820000, value_source: 'lender valuation', mortgage_balance: 412000, rate_percent: 6.09, rate_type: 'variable', lender: 'CBA', repayment_monthly: 2780, term_remaining_years: 22, has_offset: true, offset_balance: 38000, _confidence: 'document' },
      buffer: { accessible_savings: 38000, where_held: 'offset', linked_to_loan: true, _confidence: 'document' },
      super: { funds: [
        { id: 's1', fund: 'AustralianSuper', owner: 'you', balance: 186000, has_insurance: true, nomination: { in_place: true, binding: true, last_updated: '2021' } },
        { id: 's2', fund: 'Hostplus', owner: 'partner', balance: 121000, has_insurance: false, nomination: { in_place: true, binding: false, last_updated: '2016' } },
      ], extra_contributions: false, _confidence: 'document' },
      protection: { covers: [
        { id: 'cv1', owner: 'you', type: 'life', held: true, amount: 750000, inside_super: true },
        { id: 'cv2', owner: 'you', type: 'tpd', held: true, amount: 500000, inside_super: true },
        { id: 'cv3', owner: 'you', type: 'income_protection', held: false },
        { id: 'cv4', owner: 'you', type: 'trauma', held: false },
        { id: 'cv5', owner: 'partner', type: 'life', held: true, amount: 200000, inside_super: true },
        { id: 'cv6', owner: 'partner', type: 'tpd', held: true, amount: 200000, inside_super: true },
        { id: 'cv7', owner: 'partner', type: 'income_protection', held: true, amount: 4500, inside_super: true },
        { id: 'cv8', owner: 'partner', type: 'trauma', held: false },
      ], _confidence: 'document' },
      estate: { will: { in_place: true, last_updated: '2017' }, poa: { in_place: false }, guardianship: { in_place: true }, super_nomination: { in_place: false }, _confidence: 'stated' },
      investments: { shares_value: 71500, held_in: 'joint', properties: [
        { id: 'p1', value_estimate: 640000, loan_balance: null, held_in: 'company', use: 'investment' },
      ], _confidence: 'document' },
      debts: { items: [
        { id: 'd1', type: 'commercial_loan', purpose: 'commercial_property', borrower: 'company', security: 'property_commercial', secured_against_asset_id: 'p1', balance: 380000, rate_percent: 6.9, minimum_monthly: 2185 },
        { id: 'd2', type: 'credit_card', purpose: 'personal', borrower: 'personal', security: 'unsecured', cleared_monthly: true, balance: 2300 },
      ], hecs_balance: 9400, _confidence: 'document' },
      flags: { sweeps_asked: ['other_income', 'other_assets', 'other_debts', 'other_super'], to_verify: [] },
    },
    goals: { directions: ['independence-leaning'] },
  };
}

function scaleNumbers(v, k) {
  if (typeof v === 'number') return v === 0 ? 0 : v * k;
  if (Array.isArray(v)) return v.map(x => scaleNumbers(x, k));
  // Counts (adults, the ledger's nudges) are cardinality, not magnitude.
  if (v && typeof v === 'object') { const o = {}; for (const [a, b] of Object.entries(v)) o[a] = (a === 'flags' || a === 'adults') ? b : scaleNumbers(b, k); return o; }
  return v;
}

export function runPlanTests({ plan, pipeline, tokens }) {
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };
  const { buildPlan, planPromptSection, AREAS } = plan;

  /* ── an empty picture: shape first, nothing covered, no closing ── */
  const empty = buildPlan({}, {});
  t('empty-is-shape-phase', empty.phase === 'shape');
  t('empty-nothing-covered', empty.covered.length === 0);
  t('empty-cannot-close', empty.can_close === false);
  t('empty-four-sweeps-pending', ['other_income', 'other_assets', 'other_debts', 'other_super'].every(x => empty.sweeps_pending.includes(x)));

  /* ── the full household: every area covered, closing available ── */
  const F = fullHousehold();
  const full = buildPlan(F.domains, F.goals);
  t('full-all-areas-covered', AREAS.every(a => full.covered.includes(a)));
  t('full-can-close', full.can_close === true);
  t('full-trips-phase', full.phase === 'trips');

  /* ── sweeps gate coverage ── */
  const noSweep = fullHousehold();
  noSweep.domains.flags.sweeps_asked = ['other_income', 'other_debts', 'other_super'];
  const ns = buildPlan(noSweep.domains, noSweep.goals);
  t('unasked-sweep-blocks-area', !ns.covered.includes('assets') && ns.areas.assets.sweeps_pending.includes('other_assets'));
  t('unasked-sweep-blocks-close', ns.can_close === false);

  /* ── shape opens branches: a company means company income is needed ── */
  const noEnt = fullHousehold();
  noEnt.domains.income.other = noEnt.domains.income.other.filter(o => o.source !== 'business_profit');
  const ne = buildPlan(noEnt.domains, noEnt.goals);
  t('company-opens-entity-income', ne.missing.some(m => m.field === 'income.other.entity'));
  t('property-needs-its-loan-or-link', (() => {
    const x = fullHousehold(); x.domains.debts.items = x.domains.debts.items.filter(i => i.id !== 'd1');
    return buildPlan(x.domains, x.goals).missing.some(m => m.field === 'investments.properties[].loan' && m.item_id === 'p1');
  })());
  t('each-fund-needs-insurance-answer', (() => {
    const x = fullHousehold(); delete x.domains.super.funds[1].has_insurance;
    return buildPlan(x.domains, x.goals).missing.some(m => m.field === 'super.funds[].has_insurance' && m.item_id === 's2');
  })());
  t('uncleared-card-needs-rate-and-minimum', (() => {
    const x = fullHousehold(); x.domains.debts.items[1].cleared_monthly = false;
    const p = buildPlan(x.domains, x.goals);
    return p.missing.some(m => m.field === 'debts.items[].rate_percent' && m.item_id === 'd2')
      && p.missing.some(m => m.field === 'debts.items[].minimum_monthly' && m.item_id === 'd2');
  })());

  /* ── insurance inside super contradicted by "none held" ── */
  const contra = fullHousehold();
  contra.domains.protection = { covers: contra.domains.protection.covers.map(c => ({ ...c, held: false, amount: null, inside_super: null })), _confidence: 'document' };
  t('inside-super-contradiction-is-open', buildPlan(contra.domains, contra.goals).missing.some(m => m.field === 'protection.inside_super_detail'));

  /* ── deferrals count as handled, with their nudge count shown ── */
  const def = fullHousehold();
  delete def.domains.income.salary_net_monthly;
  def.domains.flags.to_verify = [{ field: 'income.salary_net_monthly', item_id: null, confidence: null, floor: null, reason: 'deferred', nudges: 2 }];
  const dp = buildPlan(def.domains, def.goals);
  t('deferred-counts-as-handled', dp.covered.includes('income') && dp.deferred.some(d => d.field === 'income.salary_net_monthly' && d.nudges === 2));
  // Two nudges: the notes now tell the model it is CLOSED rather than
  // leaving code to cut a third ask (decision of 24 Sept).
  t('deferred-shows-in-notes', /CLOSED, do not ask about these again/.test(planPromptSection(dp)));

  /* ── stored but unverified counts as handled, listed by source ── */
  const tv = fullHousehold();
  tv.domains.flags.to_verify = [{ field: 'home.mortgage_balance', item_id: null, confidence: 'stated', floor: 'document', reason: 'below_floor' }];
  const tp = buildPlan(tv.domains, tv.goals);
  t('to-verify-is-handled', tp.covered.includes('liabilities') && tp.to_verify.some(x => x.field === 'home.mortgage_balance'));
  t('to-verify-grouped-by-source', tp.trips.some(tr => tr.id === 'loan_details' && tr.items.some(i => i.status === 'to verify')));

  /* ── THE GUARDRAIL: shape, never magnitude ── */
  for (const k of [10, 0.1, 37]) {
    for (const base of [fullHousehold(), def, contra, noEnt]) {
      const a = buildPlan(base.domains, base.goals);
      const b = buildPlan(scaleNumbers(base.domains, k), base.goals);
      const shape = p => JSON.stringify({ covered: p.covered, missing: p.missing, deferred: p.deferred, to_verify: p.to_verify, sweeps: p.sweeps_pending, close: p.can_close, phase: p.phase });
      if (shape(a) !== shape(b)) { failures.push('magnitude-changed-plan-x' + k); break; }
    }
  }
  t('notes-carry-no-figures', (() => {
    const txt = planPromptSection(buildPlan(tv.domains, tv.goals));
    return !/412000|412,000|820000|186000|71500/.test(txt);
  })());
  t('notes-refuse-close-when-open', planPromptSection(empty).includes('Closing is NOT available'));
  t('notes-offer-close-when-covered', planPromptSection(full).includes('emit [FRAME: close]'));

  /* ── the pipeline: completion is code's decision ── */
  const P = { domains: F.domains, goals: F.goals, completed_domains: [], refusals: [], schema_version: 2 };
  const noFrame = pipeline.applyCaptureCore({ picture: P, capture: { session_complete: true }, sessionId: 's', servedFields: new Set(), sweepsServed: [], closeServed: false });
  t('complete-refused-without-close-frame', noFrame.sessionComplete === false && noFrame.sessionCompleteRefused === true);
  const withFrame = pipeline.applyCaptureCore({ picture: P, capture: { session_complete: true }, sessionId: 's', servedFields: new Set(), sweepsServed: [], closeServed: true });
  t('complete-allowed-when-covered-and-closed', withFrame.sessionComplete === true && withFrame.completedDomains.length === 8);
  const E = { domains: {}, goals: {}, completed_domains: [], refusals: [], schema_version: 2 };
  const early = pipeline.applyCaptureCore({ picture: E, capture: { completed_domains: ['income', 'assets'], session_complete: true }, sessionId: 's', servedFields: new Set(), sweepsServed: [], closeServed: true });
  t('claimed-areas-ignored', early.completedDomains.length === 0 && early.sessionComplete === false);
  const sw = pipeline.applyCaptureCore({ picture: E, capture: {}, sessionId: 's', servedFields: new Set(), sweepsServed: ['other_assets', 'not_a_sweep'] });
  t('sweeps-recorded-by-code', sw.domains.flags.sweeps_asked.length === 1 && sw.domains.flags.sweeps_asked[0] === 'other_assets');
  const modelFlags = pipeline.applyCaptureCore({ picture: E, capture: { domains: { flags: { sweeps_asked: ['other_debts'], to_verify: [] } } }, sessionId: 's', servedFields: new Set() });
  t('model-cannot-write-code-flags', !(modelFlags.domains.flags && (modelFlags.domains.flags.sweeps_asked || []).includes('other_debts')));

  /* ── deferrals through the pipeline, with item ids ── */
  const d1 = pipeline.applyCaptureCore({ picture: P, capture: { deferrals: ['super.funds[].balance#s2'] }, sessionId: 's', servedFields: new Set() });
  const e1 = d1.domains.flags.to_verify.find(e => e.field === 'super.funds[].balance' && e.item_id === 's2');
  t('deferral-on-stored-item-becomes-declined-source', e1 && e1.reason === 'declined_source' && e1.nudges === 1);
  const P2 = { ...P, domains: JSON.parse(JSON.stringify(F.domains)) };
  delete P2.domains.income.salary_net_monthly;
  const d2 = pipeline.applyCaptureCore({ picture: P2, capture: { deferrals: ['income.salary_net_monthly'] }, sessionId: 's', servedFields: new Set() });
  const P3 = { ...P2, domains: d2.domains };
  const d3 = pipeline.applyCaptureCore({ picture: P3, capture: { deferrals: ['income.salary_net_monthly'] }, sessionId: 's', servedFields: new Set() });
  const e3 = d3.domains.flags.to_verify.find(e => e.field === 'income.salary_net_monthly');
  t('second-deferral-counts-two', e3 && e3.reason === 'deferred' && e3.nudges === 2);
  const d4 = pipeline.applyCaptureCore({ picture: { ...P3, domains: d3.domains }, capture: { domains: { income: { salary_net_monthly: 7280, _confidence: 'document' } } }, sessionId: 's', servedFields: new Set() });
  t('answered-deferral-clears', !d4.domains.flags.to_verify.some(e => e.field === 'income.salary_net_monthly'));

  /* ── the code-emitted copy ── */
  const { substituteTokens, isTokenPrefix, FRAMES, NUDGES } = tokens;
  const open = substituteTokens('[FRAME: open]');
  t('frame-open-substitutes', open.text === FRAMES.open && open.frames[0] === 'open');
  t('frame-open-asks-the-household', FRAMES.open.endsWith("Who's in your household, and what does work look like at the moment?"));
  t('frame-open-no-rough-figures-line', !/rough figures/i.test(FRAMES.open));
  const allCopy = [FRAMES.open, FRAMES.close, NUDGES.first, NUDGES.accept, ...Object.values(plan.SWEEPS).map(x => x.text)];
  t('copy-no-em-dash', allCopy.every(c => !c.includes('—')));
  t('copy-no-friend-no-simple', allCopy.every(c => !/\b(friend|simple)\b/i.test(c)));
  t('copy-never-calls-it-complete', allCopy.every(c => !/\b(complete|well done)\b/i.test(c)));
  const sw2 = substituteTokens('Next. [SWEEP: other_debts] [NUDGE: first] [ASK: loan_details]');
  t('tokens-record-sweep-nudge-and-serve', sw2.sweeps[0] === 'other_debts' && sw2.nudges[0] === 'first' && sw2.served.includes('home.mortgage_balance'));
  t('unknown-token-emits-nothing', (() => { const r = substituteTokens('A [SWEEP: nope] B'); return r.text === 'A  B' && r.unknown.length === 1; })());
  t('token-prefix-holds-partials', isTokenPrefix('[SW') && isTokenPrefix('[SWEEP: other_') && isTokenPrefix('[N') && isTokenPrefix('[FRAME:'));
  t('token-prefix-ignores-machine-markers', !isTokenPrefix('[C') && !isTokenPrefix('[CAPTURE') && !isTokenPrefix('[R'));

  /* ── stand-in run 2 fixes ── */
  const sig = fullHousehold();
  sig.domains.flags.to_verify = [{ field: 'home.mortgage_balance', item_id: null, confidence: 'sighted', floor: 'document', reason: 'below_floor' }];
  t('sighted-not-raised-again', buildPlan(sig.domains, sig.goals).to_verify.length === 0);
  const entDef = fullHousehold();
  entDef.domains.income.other = [entDef.domains.income.other[0], entDef.domains.income.other[1], { id: 'i9', source: 'distributions', entity: 'company' }];
  entDef.domains.flags.to_verify = [{ field: 'income.other[].amount_annual', item_id: 'i9', reason: 'deferred', nudges: 1 }];
  const ed = buildPlan(entDef.domains, entDef.goals);
  t('put-off-company-income-covers-entity', ed.covered.includes('income') && ed.deferred.some(d => d.field === 'income.other.entity'));
  t('close-list-written-by-code', plan.closeListText(ed).includes('Not gathered yet') && !plan.closeListText(ed).includes('—'));
  t('notes-next-move-close', planPromptSection(full).includes('NEXT MOVE: close'));
  t('notes-next-move-missing-item', (() => {
    const x = fullHousehold(); delete x.domains.investments.properties[0].use;
    const txt = planPromptSection(buildPlan(x.domains, x.goals));
    return txt.includes('NEXT MOVE: gather') && txt.includes('investments.properties[].use#p1');
  })());
  const E2 = { domains: {}, goals: {}, completed_domains: [], refusals: [], schema_version: 2 };
  const hecs = pipeline.applyCaptureCore({ picture: E2, capture: { domains: { debts: { items: [{ type: 'hecs_help', purpose: 'education', borrower: 'personal', balance: 9000 }], _confidence: 'estimated' } } }, sessionId: 's', servedFields: new Set() });
  t('hecs-item-folded', hecs.domains.debts.hecs_balance === 9000 && !(hecs.domains.debts.items || []).length);
  const nomPic = { ...E2, domains: { estate: { super_nomination: { in_place: true, binding: true, last_updated: '2021' }, _confidence: 'sighted' } } };
  const nom = pipeline.applyCaptureCore({ picture: nomPic, capture: { domains: { estate: { super_nomination: { in_place: false }, _confidence: 'sighted' } } }, sessionId: 's', servedFields: new Set() });
  t('nomination-not-switched-off', nom.domains.estate.super_nomination.in_place === true && nom.domains.estate.super_nomination.binding === true);
  const cardPic = { ...E2, domains: { debts: { items: [{ id: 'c1', type: 'credit_card', purpose: 'unknown', borrower: 'joint' }], _confidence: 'stated' } } };
  const card = pipeline.applyCaptureCore({ picture: cardPic, capture: { domains: { debts: { items: [{ type: 'credit_card', purpose: 'personal', borrower: 'joint', balance: 2300 }], _confidence: 'sighted' } } }, sessionId: 's', servedFields: new Set() });
  t('unknown-is-wildcard-no-duplicate-card', card.domains.debts.items.length === 1 && card.domains.debts.items[0].balance === 2300 && card.domains.debts.items[0].purpose === 'personal');
  const owner = pipeline.applyCaptureCore({ picture: E2, capture: { domains: { home: { owns_home: true, value_estimate: 850000, value_source: 'owner estimate', _confidence: 'estimated' } } }, sessionId: 's', servedFields: new Set() });
  t('owner-guess-home-value-to-verify', owner.domains.flags.to_verify.some(e => e.field === 'home.value_estimate' && e.confidence === 'estimated'));

  /* ── stand-in run 3 fixes ── */
  const pay = pipeline.applyCaptureCore({ picture: E2, capture: { domains: { income: { structure: 'paye', salary_net_fortnightly: 3360, partner_salary_gross_fortnightly: 2769, _confidence: 'sighted' } } }, sessionId: 's', servedFields: new Set() });
  t('fortnightly-net-converted-by-code', pay.domains.income.salary_net_monthly === 7280);
  t('fortnightly-gross-converted-by-code', pay.domains.income.partner_salary_gross_annual === 71994);
  const nulPic = { ...E2, domains: { income: { salary_net_monthly: 7280, _confidence: 'sighted' }, super: { funds: [{ id: 'r1', fund: 'REST', balance: 7400 }], _confidence: 'sighted' } } };
  const nul = pipeline.applyCaptureCore({ picture: nulPic, capture: { domains: { income: { salary_net_monthly: null }, super: { funds: [{ id: 'r1', balance: null }] } } }, sessionId: 's', servedFields: new Set() });
  t('null-never-erases-scalar', nul.domains.income.salary_net_monthly === 7280);
  t('null-never-erases-item-field', nul.domains.super.funds[0].balance === 7400);
  const linkPic = { ...E2, domains: { investments: { properties: [{ id: 'w1', held_in: 'company', value_estimate: 640000 }], _confidence: 'sighted' } } };
  const link = pipeline.applyCaptureCore({ picture: linkPic, capture: { domains: { debts: { items: [{ type: 'commercial_loan', purpose: 'commercial_property', borrower: 'company', security: 'property_commercial', balance: 380000 }], _confidence: 'sighted' } } }, sessionId: 's', servedFields: new Set() });
  t('property-loan-auto-linked', link.domains.debts.items[0].secured_against_asset_id === 'w1');
  t('close-list-item-first', plan.closeListText(buildPlan((() => { const x = fullHousehold(); x.domains.flags.to_verify = [{ field: 'super.funds[].balance', item_id: 's2', confidence: 'stated', floor: 'document', reason: 'below_floor' }]; return x.domains; })(), F.goals)).includes('- Hostplus (partner): the balance in that fund. Noted from memory'));


  /* ── stand-in run 4 fixes ── */
  // A company-profit put-off under an improvised id still covers income.
  const r4a = pipeline.applyCaptureCore({ picture: { ...E2, domains: (() => { const x = fullHousehold().domains; x.income.other = x.income.other.slice(0, 2); return x; })() }, capture: { domains: {}, deferrals: ['income.entity.profit'] }, sessionId: 's', servedFields: new Set() });
  t('improvised-entity-deferral-covers-income', r4a.plan.covered.includes('income') && r4a.plan.deferred.some(d => d.field === 'income.other.entity'));
  // A property with linked rent gets its use.
  const r4b = pipeline.applyCaptureCore({ picture: { ...E2, domains: { investments: { properties: [{ id: 'w1', held_in: 'company', value_estimate: 640000 }], _confidence: 'sighted' } } }, capture: { domains: { income: { other: [{ source: 'rental_commercial', entity: 'company', linked_asset_id: 'w1', amount_annual: 42000 }], _confidence: 'sighted' } } }, sessionId: 's', servedFields: new Set() });
  t('rented-property-use-inferred', r4b.domains.investments.properties[0].use === 'investment');
  // Goals accumulate.
  const r4c = pipeline.applyCaptureCore({ picture: { ...E2, goals: { directions: ['a', 'b', 'c'], notes: 'Work optional by 60.' } }, capture: { domains: {}, goals: { directions: ['d'], notes: 'Means being able to stop.' } }, sessionId: 's', servedFields: new Set() });
  t('goal-directions-accumulate', ['a', 'b', 'c', 'd'].every(x => r4c.goals.directions.includes(x)));
  t('goal-notes-accumulate', r4c.goals.notes.includes('Work optional by 60') && r4c.goals.notes.includes('able to stop'));
  // A remembered share value reaches the close; yes/no details and
  // conversation-only items do not.
  const r4d = fullHousehold();
  r4d.domains.flags.to_verify = [
    { field: 'investments.shares_value', item_id: null, confidence: 'estimated', floor: 'document', reason: 'below_floor' },
    { field: 'protection.life.inside_super', item_id: null, confidence: 'stated', floor: 'document', reason: 'below_floor' },
    { field: 'home.value_source', item_id: null, confidence: 'estimated', floor: 'stated', reason: 'below_floor' },
  ];
  const r4dl = plan.closeListText(buildPlan(r4d.domains, r4d.goals));
  t('close-lists-remembered-share-value', r4dl.includes('Noted as an estimate') && r4dl.split('\n').length === 1);


  /* ── stand-in run 5 fixes ── */
  const r5a = pipeline.applyCaptureCore({ picture: { ...E2, domains: { debts: { items: [{ id: 'd1', type: 'loan_split', purpose: 'investment_shares', borrower: 'personal', security: 'property_home', is_split: true, parent_loan_id: 'home' }], _confidence: 'stated' } } }, capture: { domains: { debts: { items: [{ type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', security: 'property_home', is_split: true, parent_loan_id: 'home', balance: 60000 }], _confidence: 'sighted' } } }, sessionId: 's', servedFields: new Set() });
  t('household-loan-not-duplicated-on-holder-wording', r5a.domains.debts.items.length === 1 && r5a.domains.debts.items[0].balance === 60000);
  const r5b = pipeline.applyCaptureCore({ picture: { ...E2, domains: { debts: { items: [{ id: 'd1', type: 'commercial_loan', purpose: 'commercial_property', borrower: 'company', security: 'property_commercial' }], _confidence: 'stated' } } }, capture: { domains: { debts: { items: [{ type: 'commercial_loan', purpose: 'commercial_property', borrower: 'joint', security: 'property_commercial', balance: 1 }], _confidence: 'stated' } } }, sessionId: 's', servedFields: new Set() });
  t('entity-loan-never-merged-with-household-loan', r5b.domains.debts.items.length === 2);
  const r5c = pipeline.applyCaptureCore({ picture: { ...E2, goals: { notes: 'Want work to be optional by around 60. Want kids provided for if something happens.' } }, capture: { domains: {}, goals: { notes: 'Want work optional by around 60, not a hard stop. Want kids provided for if something happens to either parent.' } }, sessionId: 's', servedFields: new Set() });
  t('goal-notes-rereading-not-doubled', (r5c.goals.notes.match(/optional/g) || []).length === 1);
  t('plan-exposes-sweeps-asked', buildPlan({ flags: { sweeps_asked: ['other_assets'] } }, {}).sweeps_asked.includes('other_assets'));
  const r5d = pipeline.applyCaptureCore({ picture: E2, capture: { domains: { home: { owns_home: true, with_lender_since: 2019, _confidence: 'stated' } } }, sessionId: 's', servedFields: new Set() });
  t('number-in-text-field-kept', r5d.domains.home.with_lender_since === '2019');
  t('sweep-served-once', tokens.substituteTokens('[SWEEP: other_assets]', { sweepsAsked: ['other_assets'] }).text === '');


  /* ── tile batch, 16 Sept 2026 ── */
  const tb = pipeline.applyCaptureCore({ picture: E2, capture: { domains: {
    expenses: { living_monthly: 6441, includes_housing: false, by_category: { groceries: 1500, transport: 700, not_a_category: 5 }, annual_bills_monthly: 781, coverage_months: 11.8, source: 'bank_export', _confidence: 'document' },
    home: { owns_home: true, value_estimate: 850000, value_low: 790000, value_high: 905000, value_source: 'realestate.com.au estimate', _confidence: 'stated' },
  } }, sessionId: 's', servedFields: new Set() });
  t('spending-categories-stored', tb.domains.expenses.by_category.groceries === 1500 && tb.domains.expenses.coverage_months === 11.8);
  t('unknown-spending-category-dropped', !('not_a_category' in tb.domains.expenses.by_category));
  t('home-value-range-stored', tb.domains.home.value_low === 790000 && tb.domains.home.value_high === 905000);
  const cat = pipeline.__categorise;
  t('categorise-merchants', cat('WOOLWORTHS 3353 TRARALGON') === 'groceries' && cat('UBER *EATS') === 'eating_out'
    && cat('RACV CAR INSURANCE') === 'insurance' && cat('VICROADS REGO RENEWAL') === 'transport' && cat('SOMETHING PTY LTD') === 'other');


  /* ── stand-in run 6 ── */
  let kids = pipeline.applyCaptureCore({ picture: E2, capture: { domains: { context: { adults: 2, children: [{}, {}] } } }, sessionId: 's', servedFields: new Set() });
  kids = pipeline.applyCaptureCore({ picture: { ...E2, domains: kids.domains }, capture: { domains: { context: { children: [{}, {}] } } }, sessionId: 's', servedFields: new Set() });
  kids = pipeline.applyCaptureCore({ picture: { ...E2, domains: kids.domains }, capture: { domains: { context: { children: [{ age: 9 }, { age: 6 }] } } }, sessionId: 's', servedFields: new Set() });
  kids = pipeline.applyCaptureCore({ picture: { ...E2, domains: kids.domains }, capture: { domains: { context: { children: [{ age: 9 }, { age: 6 }] } } }, sessionId: 's', servedFields: new Set() });
  t('children-never-multiply', kids.domains.context.children.length === 2 && kids.domains.context.children.map(c => c.age).sort().join() === '6,9');
  const junk = pipeline.applyCaptureCore({ picture: E2, capture: { domains: { debts: { items: [{ type: 'credit_card', borrower: 'unknown', security: 'unsecured' }], _confidence: 'stated' } } }, sessionId: 's', servedFields: new Set() });
  t('typeless-new-debt-not-kept', !(junk.domains.debts && junk.domains.debts.items && junk.domains.debts.items.length));

  /* ── live walk 8 ── */
  const ap = (pic, cap) => { const r = pipeline.applyCaptureCore({ picture: pic, capture: cap, sessionId: 's', servedFields: new Set() }); return { domains: r.domains, goals: r.goals, completed_domains: [], refusals: [] }; };
  let W = { domains: {}, goals: {}, completed_domains: [], refusals: [] };
  W = ap(W, { domains: { debts: { items: [{ type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', is_split: true, parent_loan_id: 'home' }] } } });
  W = ap(W, { domains: { debts: { items: [{ id: 'madeup01', type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', is_split: true, parent_loan_id: 'home', balance: 60000, rate_percent: 6.24 }] } } });
  W = ap(W, { domains: { debts: { items: [{ type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', is_split: true, parent_loan_id: 'home', balance: 60000, minimum_monthly: 312 }] } } });
  const splits = W.domains.debts.items.filter(i => i.type === 'loan_split');
  t('invented-id-lands-on-stored-split', splits.length === 1 && splits[0].balance === 60000 && splits[0].minimum_monthly === 312);
  let S = { domains: {}, goals: {}, completed_domains: [], refusals: [] };
  S = ap(S, { domains: { super: { funds: [{ fund: 'REST', owner: 'you' }, { owner: 'partner' }] } } });
  S = ap(S, { domains: { super: { funds: [{ fund: 'unknown', owner: 'partner' }] } } });
  S = ap(S, { domains: { super: { funds: [{ fund: 'Hostplus', owner: 'partner', balance: 121000 }] } } });
  const pf = S.domains.super.funds.filter(x => x.owner === 'partner');
  t('nameless-partner-fund-filled-not-duplicated', pf.length === 1 && pf[0].fund === 'Hostplus' && S.domains.super.funds.length === 2);

  // Run 10: the home loan as a debt item, and HECS as a "home_loan" for study.
  let H = { domains: { home: { owns_home: true } }, goals: {}, completed_domains: [], refusals: [] };
  H = ap(H, { domains: { debts: { items: [
    { type: 'home_loan', purpose: 'owner_occupied', borrower: 'joint', security: 'property_home', balance: 412000, rate_percent: 6.09, minimum_monthly: 2780 },
    { type: 'home_loan', purpose: 'education', borrower: 'personal' },
    { type: 'credit_card', purpose: 'personal', borrower: 'personal', balance: 2300 },
  ] } } });
  t('home-loan-item-folded-into-home', H.domains.home.mortgage_balance === 412000 && H.domains.home.repayment_monthly === 2780 && !H.domains.debts.items.some(i => i.type === 'home_loan'));
  t('study-item-without-balance-dropped', H.domains.debts.items.length === 1 && H.domains.debts.items[0].type === 'credit_card');

  // Subscription: a new valuation without a range clears the old range.
  let V = { domains: { home: { owns_home: true, value_estimate: 845000, value_low: 790000, value_high: 905000 } }, goals: {}, completed_domains: [], refusals: [] };
  const V1 = ap(V, { domains: { home: { value_estimate: 880000, value_source: 'realestate.com.au estimate' } } });
  t('new-value-clears-stale-range', V1.domains.home.value_estimate === 880000 && V1.domains.home.value_low == null && V1.domains.home.value_high == null);
  const V2 = ap(V, { domains: { home: { value_estimate: 880000, value_low: 830000, value_high: 940000 } } });
  t('new-value-with-range-keeps-new-range', V2.domains.home.value_low === 830000 && V2.domains.home.value_high === 940000);
  const V3 = ap(V, { domains: { home: { value_source: 'realestate.com.au estimate' } } });
  t('unchanged-value-keeps-range', V3.domains.home.value_low === 790000);

  // Subscription: a new balance given as a home-loan item updates the home.
  let U = { domains: { home: { owns_home: true, mortgage_balance: 412000, repayment_monthly: 2780, rate_percent: 6.09 } }, goals: {}, completed_domains: [], refusals: [] };
  U = ap(U, { domains: { debts: { items: [{ type: 'home_loan', purpose: 'owner_occupied', borrower: 'joint', balance: 398000, rate_percent: 5.89 }] } } });
  t('updated-home-loan-overwrites-home', U.domains.home.mortgage_balance === 398000 && U.domains.home.rate_percent === 5.89 && U.domains.home.repayment_monthly === 2780);

  // Run 10: a new card balance arrived with an invented minimum (2% of it).
  const apU = (pic, cap, txt) => { const r = pipeline.applyCaptureCore({ picture: pic, capture: cap, sessionId: 's', servedFields: new Set(), userText: txt }); return { domains: r.domains, goals: r.goals, completed_domains: [], refusals: [], anomalies: r.anomalies }; };
  const cardBase = () => ({ domains: { debts: { items: [{ id: 'cc1', type: 'credit_card', purpose: 'personal', borrower: 'personal', balance: 2300, rate_percent: 20.99, minimum_monthly: 46 }] } }, goals: {}, completed_domains: [], refusals: [] });
  const C1 = apU(cardBase(), { domains: { debts: { items: [{ id: 'cc1', balance: 2100, minimum_monthly: 42 }] } } }, "the card balance is $2,100 now, I checked the app");
  const c1 = C1.domains.debts.items[0];
  t('stated-figure-updates-invented-one-does-not', c1.balance === 2100 && c1.minimum_monthly === 46);
  const C2 = apU(cardBase(), { domains: { debts: { items: [{ id: 'cc1', balance: 2100, minimum_monthly: 42 }] } } }, "balance is 2,100 and the minimum is 42 now");
  t('both-stated-figures-update', C2.domains.debts.items[0].minimum_monthly === 42);
  const C3 = apU(cardBase(), { domains: { debts: { items: [{ id: 'cc1', balance: 2100, minimum_monthly: 42 }] } } }, "here's the statement");
  t('no-figures-in-the-words-leaves-the-turn-alone', C3.domains.debts.items[0].minimum_monthly === 42);

  /* ── cover per person, nominations per fund (Devon, 17 Sept) ── */
  const noPartnerCover = fullHousehold();
  noPartnerCover.domains.protection.covers = noPartnerCover.domains.protection.covers.filter(c => c.owner === 'you');
  const npc = buildPlan(noPartnerCover.domains, noPartnerCover.goals);
  t('partner-cover-is-its-own-question', npc.missing.some(m => m.field === 'protection.covers[].held' && /life cover \(partner\)/.test(m.label)));
  t('partner-cover-gap-blocks-close', npc.can_close === false);
  const named = fullHousehold();
  named.domains.context.partner_name = 'Jess';
  named.domains.protection.covers = named.domains.protection.covers.filter(c => c.owner === 'you');
  t('partner-name-used-in-labels', buildPlan(named.domains, named.goals).missing.some(m => /life cover \(Jess\)/.test(m.label)));
  const oneNom = fullHousehold();
  delete oneNom.domains.super.funds[1].nomination;
  const on = buildPlan(oneNom.domains, oneNom.goals);
  t('each-fund-needs-its-own-nomination', on.missing.some(m => m.field === 'super.funds[].nomination.in_place' && m.item_id === 's2'));
  t('other-fund-nomination-not-re-asked', !on.missing.some(m => m.field === 'super.funds[].nomination.in_place' && m.item_id === 's1'));

  // Old-shape replies still land: cover as the person's own, a nomination on
  // the one fund in the picture.
  const L1 = ap({ domains: { context: { adults: 2 } }, goals: {}, completed_domains: [], refusals: [] },
    { domains: { protection: { life: { held: true, amount: 750000, inside_super: true } } } });
  const lc = L1.domains.protection.covers || [];
  t('legacy-cover-folded-into-covers', lc.length === 1 && lc[0].type === 'life' && lc[0].owner === 'you' && lc[0].amount === 750000 && !L1.domains.protection.life);
  const L2 = ap({ domains: { super: { funds: [{ id: 'f1', fund: 'Hostplus', owner: 'partner' }] } }, goals: {}, completed_domains: [], refusals: [] },
    { domains: { estate: { super_nomination: { in_place: true, binding: false, last_updated: '2016' } } } });
  t('legacy-nomination-lands-on-the-one-fund', L2.domains.super.funds[0].nomination.binding === false && !(L2.domains.estate && L2.domains.estate.super_nomination));
  const L3 = ap({ domains: { super: { funds: [{ id: 'f1', fund: 'Hostplus', owner: 'partner' }, { id: 'f2', fund: 'REST', owner: 'you' }] } }, goals: {}, completed_domains: [], refusals: [] },
    { domains: { estate: { super_nomination: { in_place: true } } } });
  t('legacy-nomination-with-two-funds-not-guessed', !L3.domains.super.funds.some(f => f.nomination));
  const P1 = ap({ domains: { context: { adults: 2 }, protection: { covers: [{ id: 'x1', owner: 'you', type: 'life', held: true, amount: 750000 }] } }, goals: {}, completed_domains: [], refusals: [] },
    { domains: { protection: { covers: [{ owner: 'partner', type: 'life', held: true, amount: 200000 }] } } });
  t('each-person-keeps-their-own-cover', P1.domains.protection.covers.length === 2
    && P1.domains.protection.covers.find(c => c.owner === 'you').amount === 750000
    && P1.domains.protection.covers.find(c => c.owner === 'partner').amount === 200000);

  // Run 11: covers arrived with "id": null, so nothing matched and each
  // turn stored a second copy.
  let N = { domains: { context: { adults: 2 } }, goals: {}, completed_domains: [], refusals: [] };
  N = ap(N, { domains: { protection: { covers: [{ id: null, owner: 'you', type: 'life', held: true, amount: 750000 }] } } });
  t('null-id-gets-a-real-id', typeof N.domains.protection.covers[0].id === 'string' && N.domains.protection.covers[0].id.length > 0);
  N = ap(N, { domains: { protection: { covers: [{ id: null, owner: 'you', type: 'life', held: true, amount: 750000, inside_super: true }] } } });
  t('same-cover-again-does-not-duplicate', N.domains.protection.covers.length === 1 && N.domains.protection.covers[0].inside_super === true);
  const dupes = ap({ domains: { context: { adults: 2 }, protection: { covers: [
    { id: 'a', owner: 'you', type: 'life', held: true, amount: 750000 },
    { id: 'b', owner: 'you', type: 'life', held: true, amount: 750000, inside_super: true },
  ] } }, goals: {}, completed_domains: [], refusals: [] }, { domains: { context: { adults: 2 } } });
  t('stored-duplicate-covers-collapse', dupes.domains.protection.covers.length === 1 && dupes.domains.protection.covers[0].inside_super === true);

  // Walk 2, 24 Sept: "work-optional-at-60" and "work-optional-by-60" both
  // landed, and "kids-supported" beside "kids-support-uni-or-first-home".
  let G = { domains: {}, goals: { directions: ['work-optional-at-60', 'kids-protected'] }, completed_domains: [], refusals: [] };
  const gr = pipeline.applyCaptureCore({ picture: G, capture: { goals: { directions: ['work-optional-by-60', 'kids-support-uni-or-first-home', 'kids-protected'] } }, sessionId: 's', servedFields: new Set() });
  t('near-duplicate-directions-collapse', gr.goals.directions.length === 3
    && gr.goals.directions.filter(d => d.startsWith('work-optional')).length === 1
    && gr.goals.directions.includes('kids-protected'));

  return { pass: failures.length === 0, total: 100, failures };
}
