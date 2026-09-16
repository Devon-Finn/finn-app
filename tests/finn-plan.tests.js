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
        { id: 's1', fund: 'AustralianSuper', owner: 'you', balance: 186000, has_insurance: true },
        { id: 's2', fund: 'Hostplus', owner: 'partner', balance: 121000, has_insurance: false },
      ], extra_contributions: false, _confidence: 'document' },
      protection: {
        life: { held: true, amount: 750000, inside_super: true }, tpd: { held: true, amount: 500000, inside_super: true },
        income_protection: { held: false, amount: null, inside_super: null }, trauma: { held: false, amount: null, inside_super: null },
        _confidence: 'document',
      },
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
  for (const c of ['life', 'tpd', 'income_protection', 'trauma']) contra.domains.protection[c] = { held: false, amount: null, inside_super: null };
  t('inside-super-contradiction-is-open', buildPlan(contra.domains, contra.goals).missing.some(m => m.field === 'protection.inside_super_detail'));

  /* ── deferrals count as handled, with their nudge count shown ── */
  const def = fullHousehold();
  delete def.domains.income.salary_net_monthly;
  def.domains.flags.to_verify = [{ field: 'income.salary_net_monthly', item_id: null, confidence: null, floor: null, reason: 'deferred', nudges: 2 }];
  const dp = buildPlan(def.domains, def.goals);
  t('deferred-counts-as-handled', dp.covered.includes('income') && dp.deferred.some(d => d.field === 'income.salary_net_monthly' && d.nudges === 2));
  t('deferred-shows-in-notes', planPromptSection(dp).includes('nudges 2/2'));

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
  t('close-list-item-first', plan.closeListText(buildPlan((() => { const x = fullHousehold(); x.domains.flags.to_verify = [{ field: 'super.funds[].balance', item_id: 's2', confidence: 'stated', floor: 'document', reason: 'below_floor' }]; return x.domains; })(), F.goals)).includes('- Hostplus (partner): the balance in that fund. Noted as from memory'));

  return { pass: failures.length === 0, total: 59, failures };
}
