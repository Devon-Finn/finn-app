/* THE FIXTURE HOUSEHOLD — capture-conduct step 7.

   Scripted capture payloads driven through the REAL applyCapture chain
   (lib/finn-capture-pipeline.js), the real merge (lib/finn-merge.js), the
   real derive (finn-derived), the real trigger engine (finn-triggers) and
   the real conduct linter (lib/finn-conduct-linter.js).

   IT PROVES THE MACHINERY, NOT THE MODEL. Model conduct — whether the
   conversation actually emits the right tokens, blocks and refusals —
   stays the job of live probes against the branch deploy. A green run
   here is NEVER proof that the conversation behaves.

   Every asserted figure below is HAND-COMPUTED and written literally,
   never generated from the code under test:

     home_equity          950000 − 540000                    = 410000
     lvr_percent          540000 ÷ 950000 × 100              = 56.8
     surplus_monthly      (7100+5400) − 5200 − 3300
                          − (550+48+0 personal minimums)     = 3402
     buffer_months        24000 ÷ (5200+3300+598) — a buffer
                          covers what still has to be paid
                          when income stops                  = 2.6
     super_total          210000 + 145000 + 18000            = 373000
     income_total_annual  120000 + 85000
                          + (52000+4200+9000 other)          = 270200
                          bases stated, never mixed silently
     income_costs_annual  the commercial property's costs,
                          held separately, never netted      = 18000
     property_equity      commercial: 680000 − 380000 via
                          secured_against_asset_id           = 300000
                          holiday: 310000 − 0                = 310000
     debts_total          90000 + 2400 + 15000 (personal;
                          company 380000 and HECS excluded)  = 107400
     debts_total_by_entity  personal 107400 · company 380000

   Insights that fire (of the fourteen), fixed order:
     1.1 1.2 1.3 2.1 3.1 3.2a 4.1 5.1 6.1 7.1 7.2 9.1
   Not firing: 2.2, 3.2b, 8.1a, 8.1b, hardship. 8.1 fires only on
   consumer debt and none of these items is: the loan split is Tile 7's,
   a family loan is not a consumer type, the card is cleared monthly and
   the commercial loan is the company's.

   Run in the Browser pane: blob-import the pipeline, registry, paths,
   merge and linter libs plus finn-derived.js and finn-triggers.js (the
   last two attach to window), plus finn-components.js and finn-panels.js
   and the parsed finn-library.json, then call
     runFixtureHousehold({ pipeline, registry, paths, linter,
                           derive: window.finnDerived.derive,
                           evaluate: window.finnTriggers.evaluate,
                           panels: window.finnPanels, library })          */

const YEAR_NOW = 2026;

function makeSession(pipeline, pathsMod, sessionId, startPicture) {
  const rows = [];
  let picture = startPicture || { domains: {}, goals: {}, completed_domains: [], refusals: [], schema_version: 2 };
  let t = 0;
  const at = () => new Date(Date.parse('2026-09-11T02:00:00Z') + (t++) * 60000).toISOString();
  function reply(rawVisible, capture) {
    const created = at();
    // What clarity-chat's apply chain does with the raw reply: derive the
    // served fields from the [ASK:] tokens (same function, same regex).
    const askRes = pathsMod.substituteAskTokens(rawVisible);
    for (const f of askRes.served) {
      rows.push({ status: 'path_served', raw_text: null, capture: null, errors: null, field_id: f, created_at: created });
    }
    const servedFields = new Set(rows.filter(r => r.status === 'path_served').map(r => r.field_id));
    const raw = rawVisible + '\n[CAPTURE]' + JSON.stringify(capture);
    const sweepsServed = [...rawVisible.matchAll(/\[SWEEP:\s*([a-z_]+)\s*\]/g)].map(m => m[1]);
    const closeServed = rows.some(r => String(r.raw_text || '').includes('[FRAME: close]')) || rawVisible.includes('[FRAME: close]');
    const result = pipeline.applyCaptureCore({ picture, capture, sessionId, servedFields, sweepsServed, closeServed });
    if (result.status === 'applied') {
      picture = {
        ...picture,
        domains: result.domains,
        goals: result.goals,
        completed_domains: result.completedDomains,
        refusals: result.refusalsOut !== undefined ? result.refusalsOut : picture.refusals,
      };
      rows.push({ status: 'applied', raw_text: raw, capture, errors: result.errors && result.errors.length ? result.errors : null, field_id: null, created_at: created });
    } else {
      rows.push({ status: 'refused', raw_text: raw, capture, errors: result.errors, field_id: null, created_at: created });
    }
    return result;
  }
  // A reply that arrived with NO capture block, then recovered by the
  // re-extraction pass: the row is tagged the way clarity-chat tags it,
  // and the recovered capture goes through the same core.
  function replyWithoutCapture(rawVisible, reExtractedCapture) {
    const created = at();
    const servedFields = new Set(rows.filter(r => r.status === 'path_served').map(r => r.field_id));
    const result = pipeline.applyCaptureCore({ picture, capture: reExtractedCapture, sessionId, servedFields });
    const raw = '[REEXTRACTED after absent capture block]\n' + rawVisible;
    if (result.status === 'applied') {
      picture = {
        ...picture,
        domains: result.domains,
        goals: result.goals,
        completed_domains: result.completedDomains,
        refusals: result.refusalsOut !== undefined ? result.refusalsOut : picture.refusals,
      };
      rows.push({ status: 'applied', raw_text: raw, capture: reExtractedCapture, errors: null, field_id: null, created_at: created });
    } else {
      rows.push({ status: 'refused', raw_text: raw, capture: reExtractedCapture, errors: result.errors, field_id: null, created_at: created });
    }
    return result;
  }
  return { reply, replyWithoutCapture, rows: () => rows, picture: () => picture };
}

export function runFixtureHousehold({ pipeline, registry, paths, linter, derive, evaluate, panels, library, plan }) {
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };
  const lint = (rows, picture) => linter.runConductLinter({
    rows, picture,
    registry: registry.FIELD_REGISTRY,
    paths: paths.RETRIEVAL_PATHS,
    confidenceRank: registry.CONFIDENCE_RANK,
    producers: registry.PRODUCERS,
    plan: plan ? plan.buildPlan : undefined,
  });

  /* ════════ the main session ════════ */
  const s = makeSession(pipeline, paths, 'fx-session-1');

  // T1 — household context, structure and the company.
  s.reply('Lovely to meet you both. Tell me about the household.', {
    domains: {
      context: { adults: 2, owner_age: 41, partner_age: 39, work_intent: 'both continuing', children: [], _confidence: 'stated' },
      income: { structure: 'paye', entity: { type: 'company', name: 'Harbour Lane Pty Ltd' }, _confidence: 'stated' },
    }, goals: {}, completed_domains: [], session_complete: false,
  });
  // T2 — the payslip ask (token: code authors the copy, serves the path).
  s.reply('The pay anchors everything, so let us start there. [ASK: payslip]', {});
  // T3 — payslips attached and read: document.
  s.reply('Both read, thank you.', {
    domains: { income: { salary_gross_annual: 120000, salary_net_monthly: 7100, partner_salary_gross_annual: 85000, partner_salary_net_monthly: 5400, employer_super_on: ['salary', 'partner_salary'], _confidence: 'document' } },
  });
  // T4 — the person gives the balance from memory before any source was
  // offered. STORE EVERY FIGURE (15 Sept): it commits, flagged to verify.
  const decline1 = s.reply('Understood.', {
    domains: { home: { owns_home: true, mortgage_balance: 540000, _confidence: 'stated' } },
  });
  t('memory-figure-stored', decline1.status === 'applied' && s.picture().domains.home.mortgage_balance === 540000);
  t('memory-figure-flagged-to-verify',
    s.picture().domains.flags.to_verify.some(e => e.field === 'home.mortgage_balance' && e.reason === 'below_floor' && e.confidence === 'stated'));
  // T5 — the loan path is served.
  s.reply('When you are ready, here is the way in. [ASK: loan_details]', {});
  // T6 — DECLINE 2, now witnessed: the same figure lands with the refusal.
  const decline2 = s.reply('No problem at all.', {
    domains: { home: { owns_home: true, mortgage_balance: 540000, _confidence: 'stated' } },
    refusals: ['home.mortgage_balance'],
  });
  t('decline-2-witnessed-applies', decline2.status === 'applied');
  t('declined-source-labelled',
    s.picture().domains.flags.to_verify.some(e => e.field === 'home.mortgage_balance' && e.reason === 'declined_source'));
  t('refusal-recorded-session-tagged',
    s.picture().refusals.some(r => r.field === 'home.mortgage_balance' && r.session_id === 'fx-session-1'));
  // T7 — the person relents and attaches the loan statement: whole home
  // domain at document, offset linked and holding nothing.
  const t7 = s.reply('Got it, and read.', {
    domains: { home: { owns_home: true, value_estimate: 950000, value_source: 'lender estimate and rates notice', mortgage_balance: 540000, rate_percent: 5.84, rate_type: 'fixed, expires June 2027', lender: 'CBA', repayment_monthly: 3300, term_remaining_years: 24, has_offset: true, offset_balance: 0, _confidence: 'document' } },
  });
  t('document-clears-the-flag',
    !s.picture().domains.flags.to_verify.some(e => e.field === 'home.mortgage_balance'));
  // T8/T9 — living costs via the export path, code did the sums.
  s.reply('The fullest read of the spending is the export. [ASK: living_costs]', {});
  s.reply('The file landed and the year is summed.', {
    domains: { expenses: { living_monthly: 5200, includes_housing: false, housing_repayment_monthly: 3300, _confidence: 'document' } },
  });
  // T10/T11 — the buffer, from the accounts it sits in.
  s.reply('Now the cash. [ASK: bank_statement]', {});
  s.reply('Both balances read.', {
    domains: { buffer: { accessible_savings: 24000, where_held: 'savings account', linked_to_loan: false, _confidence: 'document' } },
  });
  // T12 — estate basics, stated (their own trips; nomination comes with super).
  s.reply('Thank you for being straight about those.', {
    domains: { estate: { will: { in_place: true, last_updated: '2022' }, poa: { in_place: false }, guardianship: { in_place: 'na' }, _confidence: 'stated' } },
  });
  // T13/T14 — super, three accounts, one visit; the nomination read in the
  // same portal visit.
  s.reply('Super next, all three accounts in the one visit. [ASK: super_statement]', {});
  s.reply('All three read.', {
    domains: {
      super: { funds: [
        { fund: 'Aware Super', owner: 'you', balance: 210000, has_insurance: true },
        { fund: 'Rest', owner: 'partner', balance: 145000, has_insurance: false },
        { fund: 'Spaceship', owner: 'you', balance: 18000, has_insurance: false },
      ], multiple_accounts: true, _confidence: 'document' },
      estate: { super_nomination: { in_place: true, last_updated: '2023', binding: false }, _confidence: 'document' },
    },
  });
  const fundIdsAfterT14 = s.picture().domains.super.funds.map(f => f.id);
  t('fund-ids-assigned', fundIdsAfterT14.every(id => typeof id === 'string' && id.length > 0));
  // T15/T16 — the cover, from the schedule.
  s.reply('The cover, from the schedule itself. [ASK: policy_schedule]', {});
  s.reply('All four read.', {
    domains: { protection: {
      life: { held: true, amount: 500000, inside_super: true },
      tpd: { held: true, amount: 350000, inside_super: true },
      income_protection: { held: false, amount: null, inside_super: null },
      trauma: { held: false, amount: null, inside_super: null },
      _confidence: 'document' } },
  });
  // T17/T18 — both platforms and both properties, one sweep each.
  s.reply('Both platforms and the two properties in one sweep. [ASK: investment_platform] [ASK: home_value]', {});
  s.reply('Read across the set.', {
    domains: { investments: {
      shares_value: 61000, held_in: 'one name',
      properties: [
        // The commercial property, held in the company. Its borrowing is
        // the company loan in debts (borrower: company); rent arrives via
        // the linked income entry, so rent_monthly stays null here.
        { value_estimate: 680000, loan_balance: null, rate_percent: null, repayment_type: 'interest only', rent_monthly: null, held_in: 'company', use: 'investment' },
        // The holiday place: rent_monthly 0 is an EXPLICIT zero. The pair
        // holds the reconciliation distinction apart: null is open,
        // zero is answered.
        { value_estimate: 310000, loan_balance: 0, rate_percent: null, repayment_type: null, rent_monthly: 0, held_in: 'joint', use: 'holiday' },
      ], _confidence: 'document' } },
  });
  const propCommId = s.picture().domains.investments.properties[0].id;
  const propHolidayId = s.picture().domains.investments.properties[1].id;
  t('property-ids-assigned', typeof propCommId === 'string' && typeof propHolidayId === 'string' && propCommId !== propHolidayId);
  // T19 — the income those assets produce, linked BY ID (echoed from the
  // picture context, exactly as the model is instructed to).
  s.reply('Now the income those assets produce.', {
    domains: { income: { other: [
      // Gross rent AND its costs, from the same agent-statement visit:
      // a rental producer reconciles only when both are recorded.
      { source: 'rental_commercial', linked_asset_id: propCommId, entity: 'company', amount_annual: 52000, basis: 'gross', costs_annual: 18000 },
      { source: 'dividends', linked_asset_id: 'holdings', entity: 'personal', amount_annual: 4200, basis: 'gross' },
      { source: 'business_profit', linked_asset_id: 'entity', entity: 'company', amount_annual: 9000, basis: 'net_of_costs' },
    ], _confidence: 'document' } },
  });
  // T20 — a bnpl item appears (screenshot read: document)...
  s.reply('Small, and it counts.', {
    domains: { debts: { items: [
      { type: 'bnpl', purpose: 'personal', borrower: 'personal', balance: 800, rate_percent: null, minimum_monthly: 80 },
    ], _confidence: 'document' } },
  });
  const bnplId = s.picture().domains.debts.items[0].id;
  t('bnpl-security-auto-resolved', s.picture().domains.debts.items[0].security === 'unsecured');
  // T21 — ...and is closed next turn, while the family loan arrives. An
  // item deleted and another added mid-sequence: ids must survive.
  s.reply('Closed, and the family loan noted.', {
    domains: { debts: { items: [
      { id: bnplId, _remove: true },
      { type: 'family_loan', purpose: 'personal', borrower: 'personal', security: 'unsecured', is_split: false, parent_loan_id: null, balance: 15000, rate_percent: 0, minimum_monthly: 0 },
    ], _confidence: 'stated' } },
  });
  const familyId = s.picture().domains.debts.items.find(i => i.type === 'family_loan').id;
  t('bnpl-removed', !s.picture().domains.debts.items.some(i => i.id === bnplId));
  t('family-id-fresh-never-reused', typeof familyId === 'string' && familyId !== bnplId);
  // T22 — the rest of the borrowings, statements read: the split off the
  // home loan used to buy ETFs, the company's commercial loan, the card
  // paid in full monthly, and HECS held separately.
  s.reply('Statements read, every line.', {
    domains: { debts: { items: [
      { type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', security: 'property_home', is_split: true, parent_loan_id: 'home', balance: 90000, rate_percent: 5.84, minimum_monthly: 550 },
      // secured_against_asset_id names WHICH asset (the commercial
      // property, by id); the property's equity derives from this link,
      // so the loan's dollars live once, as the company's debts item.
      { type: 'commercial_loan', purpose: 'commercial_property', borrower: 'company', security: 'property_commercial', secured_against_asset_id: propCommId, is_split: false, parent_loan_id: null, balance: 380000, rate_percent: 6.9, minimum_monthly: 2185 },
      // The card is cleared every month: a captured fact, and under the
      // field-spec 3.3 exclusion it contributes nothing to 8.1a/8.1b.
      { type: 'credit_card', purpose: 'personal', borrower: 'personal', cleared_monthly: true, balance: 2400, rate_percent: 19.99, minimum_monthly: 48 },
    ], hecs_balance: 12400, _confidence: 'document' },
    }, completed_domains: ['income', 'assets', 'liabilities', 'buffer', 'protection', 'estate', 'super'],
  });

  const P = s.picture();
  const D = P.domains;
  t('family-id-survives-reordering',
    D.debts.items.find(i => i.type === 'family_loan') && D.debts.items.find(i => i.type === 'family_loan').id === familyId);
  t('fund-ids-stable-to-the-end',
    JSON.stringify(D.super.funds.map(f => f.id)) === JSON.stringify(fundIdsAfterT14));
  t('card-security-auto-resolved',
    D.debts.items.find(i => i.type === 'credit_card').security === 'unsecured');
  t('four-debt-items-final', D.debts.items.length === 4);
  t('no-turn-refused', s.rows().filter(r => r.status === 'refused').length === 0);

  /* ── the hand-computed figures ── */
  const der = derive(D);
  t('home-equity-410000', der.home_equity === 410000);
  t('lvr-56.8', der.lvr_percent === 56.8);
  t('surplus-3402', der.surplus_monthly === 3402);
  t('buffer-months-2.6', der.buffer_months === 2.6);
  t('super-total-373000', der.super_total === 373000);
  t('income-total-270200', der.income_total_annual === 270200);
  t('income-costs-18000-held-separately', der.income_costs_annual === 18000);
  t('income-bases-stated-not-silent',
    der.income_total_bases.includes('gross') && der.income_total_bases.includes('net_of_costs'));
  t('income-reconciled-clean', Array.isArray(der.income_unreconciled) && der.income_unreconciled.length === 0);
  t('property-equity-300000-and-310000',
    der.property_equity.length === 2 && der.property_equity[0] === 300000 && der.property_equity[1] === 310000);
  t('debts-total-personal-107400', der.debts_total === 107400);
  t('debts-by-entity',
    der.debts_total_by_entity.personal === 107400 && der.debts_total_by_entity.company === 380000 &&
    Object.keys(der.debts_total_by_entity).length === 2);

  /* ── the insights ── */
  // Hand-written, not generated: 8.1a is absent because no debt item here
  // is consumer debt (loan split, family loan, cleared-monthly card,
  // company-borrowed commercial loan), so the mortgage alone routes nothing.
  const EXPECTED_INSIGHTS = ['1.1', '1.2', '1.3', '2.1', '3.1', '3.2a', '4.1', '5.1', '6.1', '7.1', '7.2', '9.1'];
  const ev = evaluate(D, { yearNow: YEAR_NOW, derived: der });
  t('insights-exact', JSON.stringify(ev.insight_ids) === JSON.stringify(EXPECTED_INSIGHTS));
  t('no-hardship', ev.hardship === false);
  // A household whose only debt item is a cleared-monthly card fires
  // neither 8.1a nor 8.1b.
  const onlyClearedCard = {
    debts: { items: [{ id: 'cc1', type: 'credit_card', purpose: 'personal', borrower: 'personal', cleared_monthly: true, balance: 2400, rate_percent: 19.99, minimum_monthly: 48 }], _confidence: 'stated' },
  };
  const evNoMortgage = evaluate({ ...onlyClearedCard, home: { owns_home: false } }, { yearNow: YEAR_NOW });
  t('cleared-card-only-no-81b', !evNoMortgage.insight_ids.includes('8.1b') && !evNoMortgage.insight_ids.includes('8.1a'));
  const evWithMortgage = evaluate({ ...onlyClearedCard, home: { owns_home: true, mortgage_balance: 540000 } }, { yearNow: YEAR_NOW });
  t('cleared-card-only-no-81a', !evWithMortgage.insight_ids.includes('8.1a') && !evWithMortgage.insight_ids.includes('8.1b'));
  // Consumer-debt scope (Devon, 15 Sept 2026): 8.1 fires only on consumer
  // debt. "Fires neither" is checked with and without a mortgage.
  const evalDebts = (items, home) => evaluate({ home, debts: { items, _confidence: 'stated' } }, { yearNow: YEAR_NOW });
  const has81 = ev => ev.insight_ids.includes('8.1a') || ev.insight_ids.includes('8.1b');
  const mortgaged = { owns_home: true, mortgage_balance: 540000 };
  const renting = { owns_home: false };
  const personalLoan = [{ id: 'pl1', type: 'personal_loan', purpose: 'personal', borrower: 'personal', balance: 12000, rate_percent: 11.5, minimum_monthly: 390 }];
  const evPersonalLoan = evalDebts(personalLoan, mortgaged);
  t('personal-loan-held-personally-with-mortgage-fires-81a',
    evPersonalLoan.insight_ids.includes('8.1a') && !evPersonalLoan.insight_ids.includes('8.1b'));
  const splitOnly = [{ id: 'ls1', type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', security: 'property_home', is_split: true, parent_loan_id: 'home', balance: 90000, rate_percent: 5.84, minimum_monthly: 550 }];
  t('loan-split-alone-fires-neither', !has81(evalDebts(splitOnly, mortgaged)) && !has81(evalDebts(splitOnly, renting)));
  const companyLoan = [{ id: 'pl2', type: 'personal_loan', borrower: 'company', balance: 30000, rate_percent: 9.9, minimum_monthly: 640 }];
  t('company-borrower-personal-loan-fires-neither', !has81(evalDebts(companyLoan, mortgaged)) && !has81(evalDebts(companyLoan, renting)));
  // 4.1 fired on multiple_accounts alone, with no single owner holding two
  // funds, omits its position line rather than rendering "none recorded" in
  // both slots. The insight still fires and still renders on tile 4. Needs
  // panels + library; missing either fails the check, never skips it.
  {
    let ok = false;
    try {
      const flagOnly = { super: { funds: [
        { id: 'f1', fund: 'Fund One', owner: 'you', balance: 60000, has_insurance: null },
        { id: 'f2', fund: 'Fund Two', owner: 'partner', balance: 40000, has_insurance: null },
      ], multiple_accounts: true, _confidence: 'stated' } };
      const fDer = derive(flagOnly);
      const fEv = evaluate(flagOnly, { yearNow: YEAR_NOW, derived: fDer });
      const entry41 = library.insights.find(e => e.id === '4.1');
      const tileHtml = panels.renderTile(4, flagOnly, fDer, fEv.tiles.find(x => x.tile === 4), library);
      ok = fEv.insight_ids.includes('4.1')
        && panels.fillPositionLine(entry41.position_line, flagOnly, fDer) === null
        && tileHtml.includes(entry41.title)
        && !tileHtml.includes('none recorded none recorded')
        && !tileHtml.includes('none recorded holds');
    } catch (e) { ok = false; }
    t('4.1-no-single-owner-position-line-omitted', ok);
  }
  t('lender-note-once-on-tile-1', ev.tiles[0].lender_paid_note_once === true);
  t('ownership-block-stands-down',
    ev.tiles[6].insights.find(i => i.id === '7.2').ownership_block_suppressed === true);

  /* ── the linter over the whole session: twelve rows, all passing ── */
  const report = lint(s.rows(), P);
  t('linter-twentyone-rows', report.checks.length === 21);
  t('linter-zero-failures', report.summary.failures === 0);
  for (const c of report.checks) {
    t('linter-row-' + c.id + '-not-failing', c.status !== 'fail');
  }

  /* ════════ the no-capture-block turn (same household, next session) ════════ */
  const s2 = makeSession(pipeline, paths, 'fx-session-2', P);
  const rec = s2.replyWithoutCapture('A short reply that arrived with no capture block at all.', {
    domains: { context: { horizon_years: 10, _confidence: 'stated' } },
  });
  t('reextraction-applies-through-the-gate', rec.status === 'applied');
  t('reextracted-fact-not-left-in-transcript', s2.picture().domains.context.horizon_years === 10);
  const report2 = lint(s2.rows(), s2.picture());
  t('absence-fails-capture-block-row',
    report2.checks.find(c => c.id === 'capture_block').status === 'fail');
  t('absence-fails-nothing-else', report2.summary.failures === 1);

  /* ════════ the legacy variant ════════ */
  const legacy = makeSession(pipeline, paths, 'fx-legacy', {
    domains: { income: { salary_gross_annual: 96000, salary_net_monthly: 6100, rental_income_annual: 28080, other_income_annual: 6000, _confidence: 'stated' } },
    goals: {}, completed_domains: [], refusals: [], schema_version: 2,
  });
  const mig = legacy.reply('Welcome back.', {});
  t('legacy-migrates-cleanly', mig.status === 'applied');
  const L = legacy.picture().domains;
  t('legacy-scalars-swept-not-dropped',
    L.income._unmapped['income.rental_income_annual'] === 28080 &&
    L.income._unmapped['income.other_income_annual'] === 6000 &&
    !('rental_income_annual' in L.income) && !('other_income_annual' in L.income));
  t('legacy-surfaces-as-open-items',
    L.flags.income_unreconciled.includes('legacy:rental_income_annual') &&
    L.flags.income_unreconciled.includes('legacy:other_income_annual'));
  const lDer = derive(L);
  t('legacy-total-salary-only-and-incomplete',
    lDer.income_total_annual === 96000 && lDer.income_unreconciled.length >= 2);

  /* ════════ twelve negative fixtures — one per linter row ════════
     Each trips exactly its own check. A linter that only ever passes
     cannot be distinguished from one that never checks. The two report
     rows (8, 9) cannot fail by design, so their negatives assert the
     report carries content while nothing else fails. */
  const at0 = '2026-09-11T03:00:00.000Z';
  const applied = (raw, capture, created) => ({ status: 'applied', raw_text: raw, capture: capture || {}, errors: null, field_id: null, created_at: created || at0 });
  const servedRow = (field, created) => ({ status: 'path_served', raw_text: null, capture: null, errors: null, field_id: field, created_at: created || at0 });
  const emptyPic = { domains: {}, refusals: [] };
  const failsOnly = (name, report, checkId) => {
    const c = report.checks.find(x => x.id === checkId);
    t('neg-' + name + '-fires', c && c.status === 'fail');
    t('neg-' + name + '-and-nothing-else', report.summary.failures === 1);
  };

  failsOnly('lost-fact',
    lint([applied('Thanks.\n[CAPTURE]{}', { domains: { context: { owner_age: 42, _confidence: 'stated' } } })], emptyPic), 'lost_fact');
  failsOnly('acknowledged-not-captured',
    lint([applied('Got it, $71,500 in ETFs.\n[CAPTURE]{}', {})], emptyPic), 'acknowledged_not_captured');
  failsOnly('opening-frame',
    lint([applied("Hi there, I'm Finn. Tell me about your household.\n[CAPTURE]{}", {})], emptyPic), 'opening_frame');
  failsOnly('nudge-cap',
    lint([
      applied('Noted.\n[CAPTURE]{}', { deferrals: ['income.salary_net_monthly'] }),
      applied('Noted.\n[CAPTURE]{}', { deferrals: ['income.salary_net_monthly'] }),
      applied('Noted.\n[CAPTURE]{}', { deferrals: ['income.salary_net_monthly'] }),
    ], emptyPic), 'nudge_cap');
  failsOnly('premature-close',
    lint([applied("That's a genuinely complete picture to take to a professional.\n[CAPTURE]{}", {})], emptyPic), 'premature_close');
  failsOnly('refusal-validity',
    lint([applied('A reply.\n[CAPTURE]{}', { refusals: ['home.mortgage_balance'] })], emptyPic), 'refusal_validity');
  failsOnly('softener',
    lint([applied('What is the balance owing, roughly?\n[CAPTURE]{}')], emptyPic), 'softener');
  failsOnly('enum-default',
    lint([], { domains: { debts: { items: [{ id: 'x1', type: 'credit_card', balance: 2400, security: 'unsecured' }], _confidence: 'document' } }, refusals: [] }), 'enum_default');
  failsOnly('reconciliation',
    lint([], { domains: { investments: { properties: [{ id: 'p1', value_estimate: 640000 }], _confidence: 'stated' } }, refusals: [] }), 'reconciliation');
  failsOnly('path-served',
    lint([applied('A reply.\n[CAPTURE]{}', { domains: { home: { mortgage_balance: 512000, _confidence: 'sighted' } } })],
      { domains: { home: { mortgage_balance: 512000, _confidence: 'sighted' } }, refusals: [] }), 'path_served');
  failsOnly('single-visit',
    lint([
      servedRow('home.mortgage_balance', '2026-09-11T03:00:00.000Z'),
      servedRow('home.rate_percent', '2026-09-11T03:00:00.000Z'),
      servedRow('home.mortgage_balance', '2026-09-11T03:05:00.000Z'),
      servedRow('home.offset_balance', '2026-09-11T03:05:00.000Z'),
    ], emptyPic), 'single_visit');
  { // 8 — stated rate per offered field: a report with content, no failures.
    const r = lint([], { domains: { home: { lender: 'CBA', _confidence: 'stated' } }, refusals: [] });
    const c = r.checks.find(x => x.id === 'stated_rate_offered');
    t('neg-stated-rate-reports-content', c.status === 'report' && c.count > 0);
    t('neg-stated-rate-nothing-fails', r.summary.failures === 0);
  }
  { // 9 — fields resting on sighted: a report with content, no failures.
    const r = lint([], { domains: { buffer: { accessible_savings: 24000, _confidence: 'sighted' } }, refusals: [{ field: 'buffer.accessible_savings', session_id: 's' }] });
    const c = r.checks.find(x => x.id === 'sighted_resting');
    t('neg-sighted-reports-content', c.status === 'report' && c.count > 0);
    t('neg-sighted-nothing-fails', r.summary.failures === 0);
  }
  failsOnly('composed-ask',
    lint([applied('Please open your banking app and read me what it shows.\n[CAPTURE]{}')], emptyPic), 'composed_ask');
  failsOnly('capture-block',
    lint([applied('[REEXTRACTED after absent capture block]\nA reply.\n[CAPTURE]{}')], emptyPic), 'capture_block');
  failsOnly('em-dash',
    lint([applied('So — here we are.\n[CAPTURE]{}')], emptyPic), 'em_dash');

  /* ════════ the 15 Sept walk, replayed ════════
     Devon typed his figures; the old gate refused 18 of 54 turns and the
     picture ended almost empty. Replayed with the model's actual capture
     slips: stated figures, a split with only item-level confidence,
     completed_domains inside domains, and a fund list re-sent without ids. */
  {
    const w = makeSession(pipeline, paths, 'fx-walk-0915');
    w.reply('Thanks Sam.', { domains: { context: { adults: 2, owner_age: 42, partner_age: 40, children: [{ age: 9 }, { age: 6 }], _confidence: 'stated' } } });
    w.reply('[ASK: payslip]', { domains: { income: { structure: 'company', entity: { type: 'company' }, _confidence: 'stated' } } });
    w.reply('We will work with those.', { domains: { income: { salary_gross_annual: 118000, partner_salary_gross_annual: 72000, _confidence: 'stated' } }, refusals: ['income.salary_net_monthly', 'income.partner_salary_net_monthly'] });
    w.reply('The rent and costs.', { domains: { income: { other: [{ source: 'rental_commercial', linked_asset_id: null, entity: 'company', amount_annual: 42000, basis: 'gross', costs_annual: 6800 }], _confidence: 'stated' } } });
    w.reply('[ASK: loan_details]', { domains: { home: { owns_home: true, value_estimate: 850000, value_source: 'owner estimate', _confidence: 'estimated' } } });
    w.reply('That is clear.', { domains: { home: { mortgage_balance: 412000, rate_percent: 6.09, rate_type: 'variable', repayment_monthly: 2780, term_remaining_years: 22, has_offset: true, offset_balance: 38000, _confidence: 'stated' } } });
    w.reply('Thanks.', { domains: { debts: { items: [{ type: 'commercial_loan', purpose: 'commercial_property', borrower: 'company', security: 'property_commercial', balance: 380000, rate_percent: 6.9 }], _confidence: 'stated' } } });
    w.reply('Good.', { domains: { super: { funds: [{ fund: 'Australian Super', owner: 'you', balance: 186000 }], _confidence: 'stated' } } });
    w.reply('So two for you.', { domains: { super: { funds: [
      { fund: 'REST', owner: 'you', balance: 7400 }, { fund: 'Australian Super', owner: 'you', balance: 186000 }, { fund: 'Hostplus', owner: 'partner', balance: 121000 },
    ], multiple_accounts: true, _confidence: 'stated' } } });
    w.reply('And insurance.', { domains: { super: { funds: [{ fund: 'REST', owner: 'you', has_insurance: false }, { fund: 'Australian Super', owner: 'you', has_insurance: true }], _confidence: 'stated' } } });
    w.reply('The split.', { domains: { debts: { items: [{ type: 'loan_split', purpose: 'investment_shares', borrower: 'joint', security: 'property_home', is_split: true, balance: 60000, rate_percent: 6.24, _confidence: 'stated' }] } } });
    const slip = w.reply('Anything else?', { domains: { completed_domains: ['income'], investments: { shares_value: 71500, held_in: 'joint', _confidence: 'stated' }, home: { not_a_field: 1 } }, goals: {} });
    const WD = w.picture().domains;
    t('walk-no-turn-refused', w.rows().filter(r => r.status !== 'path_served').every(r => r.status === 'applied'));
    t('walk-salaries-kept', WD.income.salary_gross_annual === 118000 && WD.income.partner_salary_gross_annual === 72000);
    t('walk-rent-and-costs-kept', WD.income.other.length === 1 && WD.income.other[0].amount_annual === 42000 && WD.income.other[0].costs_annual === 6800);
    t('walk-mortgage-kept', WD.home.mortgage_balance === 412000 && WD.home.offset_balance === 38000 && WD.home.has_offset === true);
    t('walk-funds-not-duplicated', WD.super.funds.length === 3);
    t('walk-fund-insurance-landed-on-existing', WD.super.funds.find(f => f.fund === 'Australian Super').has_insurance === true && WD.super.funds.find(f => f.fund === 'Australian Super').balance === 186000);
    t('walk-both-loans-kept', WD.debts.items.length === 2 && WD.debts.items.some(i => i.type === 'loan_split' && i.balance === 60000));
    t('walk-slip-partial-not-whole', slip.status === 'applied' && slip.errors.some(e => e.includes('not_a_field')) && WD.investments.shares_value === 71500);
    t('walk-control-key-lifted', slip.anomalies.some(a => a.includes('completed_domains')));
    t('walk-typed-figures-flagged', ['income.salary_gross_annual', 'home.mortgage_balance', 'super.funds[].balance', 'investments.shares_value', 'debts.items[].balance']
      .every(f => WD.flags.to_verify.some(e => e.field === f)));
    t('walk-completion-code-derived', !w.picture().completed_domains.includes('income'));
    const wr = lint(w.rows(), w.picture());
    const lost = wr.checks.find(c => c.id === 'lost_fact');
    t('walk-lost-facts-only-the-bad-field', lost.status === 'fail' && lost.details.length === 1 && lost.details[0].includes('not_a_field'));
    const closeTry = w.reply('Here is everything.', { session_complete: true });
    t('walk-close-refused-with-open-items', closeTry.sessionCompleteRefused === true && closeTry.sessionComplete === false);
  }

  /* ════════ the 16 Sept stand-in run, replayed ════════ */
  {
    const r = makeSession(pipeline, paths, 'fx-standin-0916');
    r.reply('Thanks.', { domains: { super: { funds: [{ fund: 'AustralianSuper', owner: 'you', balance: 186000 }, { fund: 'REST', owner: 'you', balance: null }], _confidence: 'sighted' } } });
    // distributions emitted under investments: re-homed, not dropped
    const misplaced = r.reply('Got those.', { domains: { investments: { shares_value: 71500, held_in: 'joint', other: [{ source: 'distributions', entity: 'joint', basis: 'gross', amount_annual: 2140 }], _confidence: 'sighted' } } });
    t('standin-misplaced-field-rehomed', misplaced.errors.length === 0 && r.picture().domains.income.other.some(o => o.amount_annual === 2140));
    // _confidence at the root of domains applies to each domain
    r.reply('Noted.', { domains: { debts: { items: [{ type: 'commercial_loan', purpose: 'commercial_property', borrower: 'company', security: 'property_commercial', balance: 380000 }] }, _confidence: 'sighted' } });
    const tvl = r.picture().domains.flags.to_verify;
    t('standin-root-confidence-applied', tvl.some(e => e.field === 'debts.items[].balance' && e.confidence === 'sighted') && !tvl.some(e => e.confidence === 'unrecorded'));
    // a deferral naming the fund rather than its id resolves to the item
    r.reply('We can leave that.', { deferrals: ['super.funds[].balance#REST'] });
    const restId = r.picture().domains.super.funds.find(f => f.fund === 'REST').id;
    t('standin-deferral-by-name-resolves', r.picture().domains.flags.to_verify.some(e => e.field === 'super.funds[].balance' && e.item_id === restId && e.reason === 'deferred'));
    const rr = lint(r.rows(), r.picture());
    t('standin-no-lost-facts', rr.checks.find(c => c.id === 'lost_fact').status === 'pass');
  }
  failsOnly('composed-sweep',
    lint([applied('Any other assets worth knowing about?\n[CAPTURE]{}', {})], emptyPic), 'composed_sweep');
  failsOnly('appraisal',
    lint([applied('That is a reasonable working figure for now.\n[CAPTURE]{}', {})], emptyPic), 'appraisal');
  t('recorder-rows-skip-text-checks',
    lint([applied('[RECORDER]\n[CAPTURE]{"domains":{}}', {}), applied('A reply.\n[CAPTURE]{}', {})], emptyPic).summary.failures === 0);

  return {
    pass: failures.length === 0,
    total: 115,
    failures,
    hand_computed: {
      home_equity: 410000, lvr_percent: 56.8, surplus_monthly: 3402, buffer_months: 2.6,
      super_total: 373000, income_total_annual: 270200, income_costs_annual: 18000,
      property_equity_commercial: 300000, property_equity_holiday: 310000,
      debts_total_personal: 107400, debts_total_company: 380000,
    },
    insights: EXPECTED_INSIGHTS,
  };
}
