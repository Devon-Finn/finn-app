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

     home_equity          950000 − 540000 − 90000 split
                          (Devon, walk persona: lending
                          secured on the home is deducted
                          however it was recorded)           = 320000
     lvr_percent          (540000+90000) ÷ 950000 × 100      = 66.3
     surplus_monthly      (7100+5400) − 5200 − 3300
                          − (550+0 personal minimums; the
                          card cleared monthly adds nothing) = 3450
     buffer_months        24000 ÷ (5200+3300+550) — a buffer
                          covers what still has to be paid
                          when income stops                  = 2.7
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

export function runFixtureHousehold({ pipeline, registry, paths, linter, derive, evaluate, panels, library, plan, chat, browserDerive }) {
  const failures = [];
  let ran = 0;
  // COUNTED, never typed: total used to be a literal, so an assertion that
  // failed to land still reported PASS. ran is what actually executed.
  const t = (name, cond) => { ran++; if (!cond) failures.push(name); };
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
  t('home-equity-320000', der.home_equity === 320000);
  t('lvr-66.3', der.lvr_percent === 66.3);
  // 16 Sept 2026 tile review: the card cleared monthly no longer adds its
  // $48 minimum (its spending is already in living costs).
  t('surplus-3450', der.surplus_monthly === 3450);
  t('buffer-months-2.7', der.buffer_months === 2.7);
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
    // An invented field is reported as dropped, not as a lost fact.
    t('walk-no-lost-facts-invented-field-reported', lost.status === 'pass'
      && wr.checks.find(c => c.id === 'partial_writes').details.some(d => d.includes('not_a_field')));
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

  /* ── tile batch, 16 Sept 2026: where the money goes, and questions ── */
  {
    const D2 = JSON.parse(JSON.stringify(D));
    D2.expenses = { living_monthly: 5200, includes_housing: false, by_category: { travel: 100, groceries: 1400, other: 50 }, annual_bills_monthly: 400, annual_bills_note: 'car rego; council rates', coverage_months: 12, _confidence: 'document' };
    const der2 = derive(D2);
    const tr2 = evaluate(D2, { derived: der2 }).tiles.find(x => x.tile === 2);
    const html2 = panels.renderTile(2, D2, der2, tr2, library, {});
    const iG = html2.indexOf('Groceries'), iT = html2.indexOf('Travel and holidays');
    t('where-it-goes-fixed-order', iG > -1 && iT > iG && html2.includes('car rego and council rates'));
    t('where-it-goes-no-judgement', !/\b(high|low|too much|a lot|overspend)\b/i.test(html2.slice(html2.indexOf('Where it goes'), html2.indexOf('The rest of the income details'))));
    const html1 = panels.renderTile(1, D, der, evaluate(D, { derived: der }).tiles.find(x => x.tile === 1), library, {});
    t('every-tile-has-questions-to-ask', html1.includes('Questions to ask') && !html1.includes('Worth a conversation'));
    // Cover per person, nominations per fund (Devon, 17 Sept).
    const D5 = JSON.parse(JSON.stringify(D));
    D5.context = { ...(D5.context || {}), adults: 2, partner_name: 'Jess' };
    D5.protection = { covers: [
      { id: 'c1', owner: 'you', type: 'life', held: true, amount: 500000, inside_super: true },
      { id: 'c2', owner: 'you', type: 'trauma', held: false },
      { id: 'c3', owner: 'partner', type: 'life', held: false },
    ], _confidence: 'document' };
    D5.super = { ...(D5.super || {}), funds: (D5.super.funds || []).map((f, i) => i === 0
      ? { ...f, nomination: { in_place: true, binding: true, last_updated: '2021' } }
      : { ...f, nomination: { in_place: false } }) };
    const der5 = derive(D5);
    const ev5 = evaluate(D5, { derived: der5 });
    const html5 = panels.renderTile(5, D5, der5, ev5.tiles.find(x => x.tile === 5), library, {});
    // The matrix replaced the per-owner lists (Part D): the columns name the
    // people and the rows name the covers, so one person's gap is a cell
    // rather than a separate list.
    t('tile5-names-both-people-as-columns',
      /<th scope="col">You<\/th>/.test(html5) && /<th scope="col">Jess<\/th>/.test(html5));
    t('tile5-partner-gap-visible-as-a-cell',
      /class="fc-cell fc-none_held"/.test(html5) && /class="fc-word">none held</.test(html5));
    const pos5 = panels.fillPositionLine(library.insights.find(i => i.id === '5.1').position_line, D5, der5);
    t('tile5-position-line-names-both', typeof pos5 === 'string' && pos5.includes('you:') && pos5.includes('Jess:'));
    const html6 = panels.renderTile(6, D5, der5, ev5.tiles.find(x => x.tile === 6), library, {});
    t('tile6-nomination-per-fund', (html6.match(/Nomination on /g) || []).length === (D5.super.funds || []).length);

    /* ── the tile GRID: badge, pointer and headline (run 11: this code sat
       in app/clarity/index.html where no suite reached it, and tile 5 read
       "Still gathering" with every cover recorded) ── */
    const heads = {};
    for (let n = 1; n <= 9; n++) heads[n] = panels.tileHeadline(n, D5, der5);
    t('every-tile-has-a-headline', Object.values(heads).every(h => h && typeof h.metric === 'string' && h.metric.length > 0));
    t('tile5-headline-counts-each-person', /1 cover in place/.test(heads[5].metric) && heads[5].unit === 'across both of you');
    t('tile5-headline-names-who-has-none', /no cover recorded for Jess/.test(heads[5].facts));
    const D5b = JSON.parse(JSON.stringify(D5));
    D5b.protection.covers.push({ id: 'c4', owner: 'partner', type: 'tpd', held: true, amount: 200000, inside_super: true });
    const h5b = panels.tileHeadline(5, D5b, derive(D5b));
    t('tile5-headline-lists-both-when-both-hold', /you: life/.test(h5b.facts) && /Jess: TPD/.test(h5b.facts));
    /* ── the estate tile names its items, it never scores them (16 Oct) ──
       It used to sum the three documents together with one entry per super
       fund carrying a nomination, so three documents in place and three
       funds with nominations read "6 in place". Two different kinds of fact
       in one figure, and more accounts scoring higher. */
    const edoc = (v) => ({ in_place: v, last_updated: '10 years ago' });
    const efund = (name, v) => v === undefined ? { fund: name } : { fund: name, nomination: { in_place: v } };
    const walk6 = { estate: { will: edoc(true), poa: edoc(true), guardianship: edoc(true) },
      super: { funds: [efund('AustralianSuper', true), efund('Hostplus', true), efund('Rest', true)] } };
    const h6walk = panels.tileHeadline(6, walk6, {});
    // (a) no combined count anywhere in the headline.
    t('estate-headline-has-no-combined-count', !/\b6\b/.test(JSON.stringify(h6walk)) && !/\d+ in place/.test(JSON.stringify(h6walk)));
    t('estate-headline-has-no-denominator', !/ of (three|3) /.test(h6walk.metric) && !/\//.test(h6walk.metric));
    // (b) the documents line and the nominations line are separate.
    t('estate-documents-are-named-individually',
      /Will in place/.test(h6walk.metric) && /enduring power of attorney in place/.test(h6walk.metric) && /guardianship in place/.test(h6walk.metric));
    t('estate-nominations-are-a-separate-line',
      h6walk.facts === 'Super nominations: all three accounts have one' && !/nomination/i.test(h6walk.metric));
    // (c) held:false renders "not in place"; an absent field "not recorded".
    const h6partial = panels.tileHeadline(6, { estate: { will: edoc(true), poa: edoc(false) },
      super: { funds: [efund('A', true), efund('B', true), efund('C')] } }, {});
    t('estate-false-is-not-in-place-and-absent-is-not-recorded',
      /enduring power of attorney not in place/.test(h6partial.metric) && /guardianship not recorded/.test(h6partial.metric));
    t('estate-nominations-count-against-the-funds-in-the-picture',
      h6partial.facts === 'Super nominations: two of your three accounts have one');
    t('estate-nominations-none-recorded-when-no-fund-has-one',
      panels.tileHeadline(6, { estate: { will: edoc(true) }, super: { funds: [efund('A'), efund('B')] } }, {}).facts === 'Super nominations: none recorded');
    t('estate-nominations-singular-for-one-account',
      panels.tileHeadline(6, { estate: { will: edoc(true) }, super: { funds: [efund('A', true)] } }, {}).facts === 'Super nominations: your account has one');
    t('tile-headline-null-before-anything-said', panels.tileHeadline(5, {}, {}) === null && panels.tileHeadline(6, {}, {}) === null);
    // The badge reports the gathering, never the money.
    t('badge-complete-only-from-completed-domains',
      panels.badgeLabel(panels.tileComplete(5, { completed_domains: ['protection'] })) === 'Complete'
      && panels.badgeLabel(panels.tileComplete(5, { completed_domains: [] })) === 'Still gathering'
      && panels.tileComplete(1, { completed_domains: ['assets'] }) === false);
    t('question-pointer-wording', panels.questionPointer(0).text === 'Questions to ask'
      && panels.questionPointer(1).text === '1 question for your situation'
      && panels.questionPointer(3).text === '3 questions for your situation');
  }



  /* ── the household context header (built 15 Oct) ──
     The frame the tiles sit inside: facts from a template, no badge, no
     status, no routing, and silent about what is not known. */
  {
    const ch = panels.contextHeader(D, { ownerName: 'Sam', partnerName: 'Jess', library });
    t('context-header-renders-the-people', /Sam, 41/.test(ch) && /Jess, 39/.test(ch));
    t('context-header-carries-the-work-intent', /both continuing/i.test(ch));
    t('context-header-never-flags-anything',
      !/fp-badge|fp-route|questions to ask|not recorded|missing/i.test(ch));
    // Quiet about what is not known: this household recorded no children.
    t('context-header-silent-on-what-is-absent', !/child/i.test(ch));
    // An entirely absent context must not throw and must render nothing.
    t('context-header-survives-an-empty-picture', panels.contextHeader({}, { library }) === '');
    t('context-header-survives-no-arguments-at-all', panels.contextHeader() === '');
    // Every word comes from the library, like the position lines. Without
    // it there is no signed-off copy, so the header renders nothing.
    t('context-header-copy-comes-from-the-library', !!(library.context && library.context.clauses && library.context.clauses.two_people.template));
    t('context-header-renders-nothing-without-the-library', panels.contextHeader(D, { ownerName: 'Sam' }) === '');
    const kids = panels.contextHeader({ context: { adults: 2, owner_age: 42, partner_age: 40, children: [{ age: 9 }, { age: 6 }] } }, { library });
    t('context-header-lists-children-by-age', /Two children, 9 and 6\./.test(kids));
    const horizon = panels.contextHeader({ context: { owner_age: 51, horizon_years: 10 } }, { ownerName: 'Dana', library });
    // The partner's name IS a picture field, so it fills that slot (15 Oct:
    // the header said "your partner" while the picture held "Jess").
    const named = panels.contextHeader({ context: { adults: 2, owner_age: 42, partner_name: 'Jess', partner_age: 40 } }, { ownerName: 'Sam', library });
    t('context-header-uses-the-partner-name-from-the-picture', /Jess, 40/.test(named) && !/your partner/i.test(named));
    const unnamed = panels.contextHeader({ context: { adults: 2, owner_age: 42, partner_age: 40 } }, { ownerName: 'Sam', library });
    t('context-header-falls-back-to-your-partner', /your partner, 40/.test(unnamed));
    t('context-header-prefers-the-picture-over-an-opts-name',
      /Jess/.test(panels.contextHeader({ context: { adults: 2, partner_name: 'Jess' } }, { ownerName: 'Sam', partnerName: 'Robin', library })));
    // A household label is not a person, whatever field it arrives in.
    for (const label of ['test-household-c', 'The Soutars', 'Soutar Family Trust', 'Harbour Lane Pty Ltd']) {
      const bad = panels.contextHeader({ context: { owner_age: 42 } }, { ownerName: label, library });
      t('context-header-never-puts-a-household-label-in-a-person-slot: ' + label,
        !bad.includes(label) && !bad.includes(String(label).split(/\s+/)[0]) && /You, 42/.test(bad));
    }
    t('context-header-still-accepts-a-real-first-name',
      /Devon, 42/.test(panels.contextHeader({ context: { owner_age: 42 } }, { ownerName: 'Devon Soutar', library })));
    t('context-header-carries-the-horizon', /Dana, 51\./.test(horizon) && /next 10 years/.test(horizon));
  }


  /* ── a tile is not Complete over a figure it cannot compute (16 Oct) ──
     Production carried a Complete badge on "What's left over each month"
     while the body read "Still gathering": TILE_AREAS maps tile 2 to the
     INCOME area, but its figure needs expenses as well, and the household
     had given income and no spending. */
  {
    const incomeOnly = {
      context: { adults: 2, _confidence: 'stated' },
      income: { structure: 'paye', salary_net_monthly: 7100, partner_salary_net_monthly: 5400, _confidence: 'document' },
    };
    const picIncomeDone = { completed_domains: ['income'] };
    const derIncomeOnly = derive(incomeOnly);
    t('surplus-is-not-computable-without-expenses', derIncomeOnly.surplus_monthly === null);
    t('tile-2-has-no-headline-without-expenses', panels.tileHeadline(2, incomeOnly, derIncomeOnly) === null);
    t('tile-2-is-not-complete-over-a-figure-it-cannot-compute',
      panels.tileComplete(2, picIncomeDone, incomeOnly, derIncomeOnly) === false);
    t('the-badge-and-the-body-now-agree',
      panels.badgeLabel(panels.tileComplete(2, picIncomeDone, incomeOnly, derIncomeOnly)) === 'Still gathering');
    // With spending given, the same tile completes.
    const withSpend = { ...incomeOnly, expenses: { living_monthly: 5200, includes_housing: false, _confidence: 'document' },
      home: { owns_home: true, mortgage_balance: 540000, repayment_monthly: 3300, _confidence: 'document' } };
    const derWithSpend = derive(withSpend);
    t('tile-2-completes-once-the-figure-exists',
      derWithSpend.surplus_monthly !== null && panels.tileComplete(2, picIncomeDone, withSpend, derWithSpend) === true);
    // The fixture household, fully captured, keeps every badge it had.
    t('the-fixture-household-still-completes-its-covered-tiles',
      panels.tileComplete(2, P.picture ? P.picture : { completed_domains: ['income'] }, D, der) === true);
  }

  /* ── the derived figures reach the model (walk 4, 15 Oct) ──
     The defect: asked for an equity position, the model did its own
     arithmetic (home value minus mortgage) and missed the $60,000 split
     secured on the home, so the conversation contradicted the tile. The
     cure is that it never does arithmetic: derive() runs in the edge
     function and the finished figures go into the prompt to be quoted.
     These three checks hold that shut. */
  if (chat && typeof chat.__derivedPromptSectionForTests === "function") {
    const block = chat.__derivedPromptSectionForTests(D);
    // Relabelled 15 Oct: the person must never hear HOW a figure was made,
    // so the block no longer names the implementation.
    t('context-block-labels-the-figures-without-naming-the-machinery',
      /QUOTE THESE VERBATIM/.test(block) && /never work one out yourself/i.test(block)
      && !/\bcode\b/i.test(block.split("\n")[1] || ""));
    // The household's real figures, not arithmetic over the raw picture:
    // a home value of 950000 less a 540000 mortgage AND the 90000 split.
    t('context-block-carries-home-equity-320000', /equity in the home: 320000\b/.test(block));
    t('context-block-carries-lvr-66.3', /as a percentage of its value: 66\.3\b/.test(block));
    t('context-block-never-shows-the-naive-equity', !/equity in the home: 410000\b/.test(block));
    t('context-block-names-what-is-missing-rather-than-filling-it',
      /not yet derivable/.test(chat.__derivedPromptSectionForTests({})));
  }

  /* One implementation, two importers: the figures the edge function puts
     in the prompt and the figures the browser puts in the tiles come from
     the same derive(), so they cannot drift. */
  if (browserDerive) {
    const a = derive(D);
    const b = browserDerive(D);
    t('edge-and-browser-derive-are-the-same-function', derive === browserDerive);
    t('edge-and-browser-derive-agree-on-the-fixture', JSON.stringify(a) === JSON.stringify(b));
  }


  /* ── the v2 question set, and the one conditional question (15 Oct) ──
     34 questions across the nine tiles, down from 37. The conditional one
     is NOT an insight: it has no education blocks and never changes a
     tile's state, so these checks hold both its firing and its silence. */
  {
    const tiles = library.tiles || {};
    const generalCount = Object.keys(tiles).reduce((a, k) => a + (tiles[k].questions || []).length, 0);
    const insightCount = (library.insights || []).filter(i => typeof i.question === 'string').length;
    t('the-question-set-is-34-across-the-nine-tiles', generalCount + insightCount === 34);
    t('no-insight-lost-its-education-blocks', (library.insights || []).every(i =>
      i.blocks && ['why', 'turn_up', 'dont_realise', 'how_professional', 'nothing_to_prepare'].every(b => typeof i.blocks[b] === 'string' && i.blocks[b].length > 0)));
    // 2.2 and 8.1b carry NO paid referral by design (field-spec 3.3), so a
    // null route is correct for exactly those two and nothing else.
    const NO_REFERRAL = ['2.2', '8.1b'];
    t('every-insight-still-has-a-question-and-the-right-kind-of-route', (library.insights || []).every(i =>
      typeof i.question === 'string' && i.question.length > 0
      && (NO_REFERRAL.includes(i.id) ? !i.route_primary : typeof i.route_primary === 'string' && i.route_primary.length > 0)));

    // Routing changes.
    t('the-per-fund-nomination-question-goes-to-the-estate-lawyer',
      (tiles['4'].questions || []).some(q => /nomination on each fund/.test(q.q) && q.pro === 'estate_lawyer'));
    const i71 = (library.insights || []).find(i => i.id === '7.1');
    t('7.1-routes-to-the-mortgage-broker-alone',
      i71.route_primary === 'mortgage_broker' && (i71.route_also || []).length === 0);

    // The wording cut: Finn does not judge the balance.
    const i12 = (library.insights || []).find(i => i.id === '1.2');
    t('1.2-no-longer-says-while-it-is-empty', !/while it’s empty|while it's empty/.test(i12.question));

    // The three duplicate general questions are gone.
    t('tile-2-no-longer-restates-its-own-fired-question',
      !(tiles['2'].questions || []).some(q => /left over each month be doing for the things we want/.test(q.q)));
    t('tile-7-no-longer-restates-its-own-fired-question',
      !(tiles['7'].questions || []).some(q => /investments are spread still suit our timeframe/.test(q.q)));
    t('tile-9-no-longer-restates-its-own-fired-question',
      !(tiles['9'].questions || []).some(q => /income is earned set up sensibly for tax/.test(q.q)));

    /* The five v2 rewrites, pinned verbatim. These are the questions that
       sit closest to the advice line, so a silent drift in their wording
       matters more than anywhere else in the library. Devon's edit is
       complete; Charlie has not signed off. */
    const Q = (id) => ((library.insights || []).find(i => i.id === id) || {}).question;
    t('1.1-is-the-v2-wording',
      Q('1.1') === "I've been with my lender a while now. What would someone actually look at if they reviewed this loan, and what would they compare it against?");
    t('3.2a-is-the-v2-wording',
      Q('3.2a') === "How would our safety net work differently if it sat against the loan instead of in savings?");
    t('4.1-is-the-v2-wording',
      Q('4.1') === "If we brought our super together, what would we keep and what would we lose?");
    t('8.1a-is-the-v2-wording',
      Q('8.1a') === "If we moved these debts somewhere else, what would change about what they cost and how long they'd run?");
    t('8.1b-is-the-v2-wording',
      Q('8.1b') === "What are the different ways people work through several debts at once, and what decides which one suits?");
    // The rewrites did not disturb their routes: 8.1b carries no paid route.
    t('the-five-rewrites-kept-their-routes', ['1.1', '3.2a', '8.1a'].every(id =>
      (library.insights.find(i => i.id === id) || {}).route_primary === 'mortgage_broker')
      && (library.insights.find(i => i.id === '4.1') || {}).route_primary === 'financial_planner'
      && !(library.insights.find(i => i.id === '8.1b') || {}).route_primary);
    // The library's house style is the ASCII apostrophe, 288 of them and no
    // typographic ones; a smart quote here would be a silent inconsistency.
    t('no-typographic-apostrophes-crept-in',
      !(library.insights || []).some(i => /’/.test(i.question || ''))
      && !Object.values(library.tiles || {}).some(tl => (tl.questions || []).concat(tl.conditional_questions || []).some(q => /’/.test(q.q || ''))));
    t('the-meta-records-devons-edit-complete-and-charlie-outstanding',
      /DEVON'S EDIT IS COMPLETE AS OF 15 OCTOBER 2026/.test(library._meta.questions_status)
      && /CHARLIE'S SIGN-OFF IS STILL OUTSTANDING/.test(library._meta.questions_status));

    /* The conditional question: fires on an asymmetry, silent otherwise. */
    const cq = (d) => panels.conditionalQuestions(5, d, library).map(x => x.q);
    const cover = (owner, type, held) => ({ id: owner + '-' + type, owner, type, held, amount: null, inside_super: null });
    const ASYM = { context: { adults: 2 }, protection: { covers: [cover('you', 'income_protection', true), cover('partner', 'income_protection', false)] } };
    t('conditional-fires-where-one-holds-income-protection-and-the-other-does-not',
      cq(ASYM).length === 1 && /the one of us without that cover/.test(cq(ASYM)[0]));
    t('the-conditional-question-routes-to-the-financial-planner',
      panels.conditionalQuestions(5, ASYM, library)[0].pro === 'financial_planner');
    t('conditional-silent-where-both-hold-it',
      cq({ context: { adults: 2 }, protection: { covers: [cover('you', 'income_protection', true), cover('partner', 'income_protection', true)] } }).length === 0);
    t('conditional-silent-where-neither-holds-it',
      cq({ context: { adults: 2 }, protection: { covers: [cover('you', 'income_protection', false), cover('partner', 'income_protection', false)] } }).length === 0);
    t('conditional-silent-for-a-single-adult-household',
      cq({ context: { adults: 1 }, protection: { covers: [cover('you', 'income_protection', true), cover('partner', 'income_protection', false)] } }).length === 0);
    // An unanswered cover is an unknown, not an asymmetry.
    t('conditional-silent-where-the-others-cover-is-unanswered',
      cq({ context: { adults: 2 }, protection: { covers: [cover('you', 'income_protection', true)] } }).length === 0);
    // It is a question, never an insight: no education blocks, no tile state.
    t('the-conditional-question-is-not-an-insight',
      !(library.insights || []).some(i => /the one of us without that cover/.test(i.question || '')));
  }


  /* ── the two-layer dashboard: routing out of tiles, conversations below ──
     (16 Oct). Nine findings became three conversations. The order of the
     professional blocks is the part most likely to be got wrong, so it is
     asserted against the constant across fixtures with different insight
     sets, never against whatever happened to fire. */
  {
    const PRO_ORDER = ['mortgage_broker', 'financial_planner', 'accountant', 'estate_lawyer'];
    const NAME_TO_ID = {};
    for (const id of Object.keys(library.professionals)) NAME_TO_ID[library.professionals[id].name] = id;
    // The block order as actually rendered, read back out of the HTML.
    const blockOrder = (html) => (html.match(/<span class="pn">[^<]*<\/span>/g) || [])
      .map(s => s.replace(/<[^>]*>/g, '')).map(n => NAME_TO_ID[n] || n);
    const who = (domains, yearNow) => panels.renderWhoToSee(evaluate(domains, { yearNow: yearNow || 2026 }), library);

    // Three households with deliberately different insight sets.
    const fx1 = { context: { adults: 2, children: [], _confidence: 'stated' },
      income: { structure: 'paye', salary_net_monthly: 7100, _confidence: 'document' },
      expenses: { living_monthly: 3000, includes_housing: false, _confidence: 'document' },
      home: { owns_home: true, value_estimate: 950000, mortgage_balance: 540000, repayment_monthly: 3300, rate_percent: 6.1, rate_type: 'variable', lender: 'CBA', has_offset: true, offset_balance: 0, _confidence: 'document' },
      buffer: { accessible_savings: 24000, linked_to_loan: false, _confidence: 'document' } };
    const fx2 = { context: { adults: 1, children: [], _confidence: 'stated' },
      income: { structure: 'sole_trader', salary_net_monthly: 5000, business_income_annual: 90000, _confidence: 'document' },
      estate: { will: { in_place: false }, poa: { in_place: false }, _confidence: 'stated' } };
    const fx3 = { context: { adults: 2, children: [], _confidence: 'stated' },
      income: { structure: 'paye', salary_net_monthly: 4000, _confidence: 'document' },
      expenses: { living_monthly: 3800, includes_housing: true, _confidence: 'document' },
      debts: { items: [{ id: 'd1', type: 'credit_card', purpose: 'consumer', borrower: 'you', balance: 9000, minimum_monthly: 250 }], _confidence: 'stated' },
      flags: { hardship: true } };

    for (const [label, dom] of [['fx1', fx1], ['fx2', fx2], ['fx3', fx3]]) {
      const order = blockOrder(who(dom));
      const paid = order.filter(x => x !== 'financial_counsellor');
      const expected = PRO_ORDER.filter(id => paid.includes(id));
      t('conversation-blocks-render-in-the-fixed-constant-order: ' + label,
        JSON.stringify(paid) === JSON.stringify(expected));
      // The counsellor is outside the paid ordering and never before it.
      t('the-counsellor-when-present-renders-first: ' + label,
        !order.includes('financial_counsellor') || order[0] === 'financial_counsellor');
    }

    // Items inside a block run in ascending tile order.
    const h1 = who(fx1);
    const srcOrder = (h1.match(/<div class="psrc">[^<]*<\/div>/g) || []).map(s => s.replace(/<[^>]*>/g, ''));
    const titleToTile = {};
    for (const k of Object.keys(library.tiles)) titleToTile[library.tiles[k].title] = Number(k);
    const firstBlockTiles = srcOrder.map(s => titleToTile[s]).filter(n => !isNaN(n));
    t('items-within-a-block-run-in-ascending-tile-order',
      firstBlockTiles.length > 1 && firstBlockTiles.slice(0, 3).every((n, i, a) => i === 0 || a[i - 1] <= n));

    // Zero fired insights: no section at all. No heading, no message.
    const nothing = who({ context: { adults: 1, _confidence: 'stated' } });
    t('nothing-routing-renders-no-section-at-all', nothing === '');
    t('nothing-routing-renders-no-empty-state',
      !/fp-who|Nothing routes|fills in as your picture/i.test(nothing));

    // Tile 5 routes to the planner, and the insurance specialist is gone.
    t('tile-5-routes-to-the-financial-planner',
      library.insights.find(i => i.id === '5.1').route_primary === 'financial_planner');
    t('no-insurance-specialist-anywhere-in-the-library',
      !JSON.stringify(library).includes('insurance_specialist') && !library.professionals.insurance_specialist);
    t('no-insurance-specialist-in-any-rendered-output',
      [who(fx1), who(fx2), who(fx3)].every(h => !/insurance specialist/i.test(h)));

    // The 5.1 education must not claim the conversation costs nothing. That
    // was true of a risk specialist paid by the insurer; a planner handling
    // five items bills for the other four (Devon, 16 Oct).
    const hp51 = library.insights.find(i => i.id === '5.1').blocks.how_professional;
    t('the-5.1-education-makes-no-claim-that-the-conversation-costs-nothing',
      !/costs nothing|at no cost|free of charge|no charge/i.test(hp51)
      && /worth asking how the whole conversation is charged/.test(hp51));

    // The broker cost line renders once per block, not once per item.
    const brokerItems = (h1.match(/<div class="psrc">/g) || []).length;
    const paidByLender = (h1.match(/paid a commission by the lender/gi) || []).length;
    t('the-paid-by-the-lender-note-renders-once-per-block',
      brokerItems >= 3 && paidByLender === 1);
    t('one-action-per-block-not-one-per-item',
      (h1.match(/fc-action|actionZone/g) || []).length <= blockOrder(h1).length);

    // Hardship: the counsellor replaces the broker's debt items.
    const h3 = who(fx3);
    t('hardship-produces-a-financial-counsellor-block', /Financial counsellor/.test(h3));
    t('hardship-removes-the-debt-items-from-the-broker-block',
      !/Other debts/i.test((h3.split('Financial counsellor')[0] || '')));
    t('the-counsellor-block-is-the-first-block-in-the-output',
      blockOrder(h3)[0] === 'financial_counsellor');

    // No tile renders a route as an action.
    const tileHtml = panels.renderTile(1, D, der, ev.tiles.find(x => x.tile === 1), library, {});
    t('no-tile-detail-panel-contains-an-action-to-a-professional',
      !/fc-action/.test(tileHtml) && !/Find a mortgage broker/i.test(tileHtml));
    t('the-tile-chip-is-a-label-not-a-cost',
      !/usually free|usually no cost|Varies|Fixed price/i.test(tileHtml));
  }


  /* ── Part C and D: the tile detail panels (16 Oct) ──
     A chart where the thing is a QUANTITY, a state where the thing is a
     STATE. Tiles 1, 2, 4 and 7 chart; tiles 5 and 6 do not. */
  {
    const RAMP = ['var(--fc-fill-1)', 'var(--fc-fill-2)', 'var(--fc-fill-3)'];
    const panelFor = (n, dom, dr) => panels.renderTile(n, dom, dr, evaluate(dom, { derived: dr }).tiles.find(x => x.tile === n), library, {});
    const strip = (s) => s.replace(/<[^>]*>/g, ' ');
    const charted = [1, 2, 4, 7].map(n => ({ n, html: panelFor(n, D, der) }));

    t('every-chart-has-a-table-view', charted.every(function (c) {
      const charts = (c.html.match(/class="fc-chart"/g) || []).length;
      const tables = (c.html.match(/class="fc-dtable"/g) || []).length;
      const btns = (c.html.match(/class="fc-tbtn"/g) || []).length;
      return charts === 0 || (charts === tables && charts === btns);
    }));
    t('at-least-one-chart-actually-rendered', charted.some(function (c) { return /class="fc-chart"/.test(c.html); }));
    t('the-table-is-hidden-by-default-not-display-toggled', charted.every(function (c) {
      return !/class="fc-dtable"/.test(c.html) || /<table class="fc-dtable" id="[^"]+" hidden>/.test(c.html);
    }));
    t('the-toggle-carries-aria-expanded-and-aria-controls', charted.every(function (c) {
      return !/fc-tbtn/.test(c.html) || /aria-expanded="false" aria-controls="fc-tbl-/.test(c.html);
    }));
    t('every-chart-figure-appears-in-its-table', charted.every(function (c) {
      const bars = (c.html.match(/class="fc-bval">([^<]*)</g) || []).map(function (s) { return s.slice(s.indexOf('>') + 1, -1); });
      const segs = (c.html.match(/<b>([^<]*)<\/b><span>/g) || []).map(function (s) { return s.slice(3, s.indexOf('</b>')); });
      const cells = (c.html.match(/<td>([^<]*)</g) || []).map(function (s) { return s.slice(4, -1); });
      return bars.concat(segs).every(function (v) { return cells.indexOf(v) !== -1; });
    }));
    const allPanels = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return panelFor(n, D, der); }).join('');
    const fills = allPanels.match(/background:\s*var\(--fc-[a-z0-9-]+\)/g) || [];
    t('no-chart-uses-a-fill-outside-the-three-ramp-tokens', fills.length > 0 && fills.every(function (f) {
      return RAMP.some(function (r) { return f.indexOf(r) !== -1; });
    }));
    t('there-is-no-fourth-fill-token-anywhere', !/--fc-fill-4/.test(allPanels));
    t('steel-is-never-used-as-a-data-fill', !/background:\s*var\(--fc-steel\)/.test(allPanels));

    // Tile 2's categories render in the FIXED order. This fixture's fixed
    // order differs from its size order on purpose.
    const D2c = JSON.parse(JSON.stringify(D));
    D2c.expenses = { living_monthly: 5200, includes_housing: false, _confidence: 'document',
      by_category: { groceries: 400, eating_out: 1800, transport: 300, utilities: 1500, insurance: 200, health: 1000 } };
    const t2 = panelFor(2, D2c, derive(D2c));
    const labelOrder = (t2.match(/class="fc-blabel">([^<]*)</g) || []).map(function (s) { return s.slice(s.indexOf('>') + 1, -1); });
    const FIXED = ['Groceries', 'Eating out and takeaway', 'Car and transport', 'Power, water, phone and internet', 'Insurance', 'Health and medical'];
    const BY_SIZE = ['Eating out and takeaway', 'Power, water, phone and internet', 'Health and medical', 'Groceries', 'Car and transport', 'Insurance'];
    t('tile-2-categories-render-in-the-fixed-order', JSON.stringify(labelOrder.slice(0, 6)) === JSON.stringify(FIXED));
    t('tile-2-categories-are-NOT-sorted-by-amount', JSON.stringify(labelOrder.slice(0, 6)) !== JSON.stringify(BY_SIZE));
    t('tile-2-surplus-sits-below-a-rule-in-the-darkest-fill',
      /class="fc-brule"/.test(t2) && /background:var\(--fc-fill-1\)/.test(t2));
    t('tile-2-has-a-net-income-footer', /class="fc-bfoot"/.test(t2) && /Income in, each month/.test(t2));

    // Tile 1's stacked segments sum to the stated total.
    const t1 = panelFor(1, D, der);
    const segFigs = (t1.match(/<b>([^<]*)<\/b><span>/g) || []).map(function (s) {
      return Number(s.slice(3, s.indexOf('</b>')).replace(/[$,]/g, ''));
    });
    const tm = t1.match(/class="fc-total"><span>[^<]*<\/span><b>([^<]*)</);
    const totalFig = tm ? Number(tm[1].replace(/[$,]/g, '')) : null;
    t('tile-1-stacked-segments-sum-to-the-stated-total',
      segFigs.length === 3 && totalFig !== null && Math.abs(segFigs.reduce(function (a, b) { return a + b; }, 0) - totalFig) <= 1);
    t('tile-1-every-segment-carries-its-own-figure', segFigs.length === 3 && segFigs.every(function (v) { return !isNaN(v) && v > 0; }));
    t('tile-1-has-a-legend-naming-each-segment', (t1.match(/class="fc-lg"/g) || []).length >= 3);

    // More than three segments fold into "other" and LOG, rather than
    // reaching for a fourth fill. The schema has three kinds and a fourth
    // cannot arise from a household, so the component contract is
    // exercised directly rather than inventing an impossible household.
    const folded = window.finnComponents.stackedBar({
      money: function (v) { return '$' + v; }, totalLabel: 'Total',
      segments: [{ label: 'A', value: 100 }, { label: 'B', value: 80 }, { label: 'C', value: 60 }, { label: 'D', value: 40 }, { label: 'E', value: 20 }],
    });
    t('more-than-three-segments-fold-into-other',
      /Other/.test(folded) && (folded.match(/class="fc-seg"/g) || []).length === 3);
    t('the-fold-keeps-the-total-intact', folded.indexOf('$300') !== -1);
    t('the-fold-never-introduces-a-fourth-fill', !/--fc-fill-4/.test(folded));

    // Tile 5: all three states, each with a dot AND a word.
    const cov = function (owner, type, held, extra) {
      return Object.assign({ id: owner + type, owner: owner, type: type, held: held, amount: null, inside_super: null }, extra || {});
    };
    const D5c = { context: { adults: 2, partner_name: 'Jess', _confidence: 'stated' },
      protection: { covers: [
        cov('you', 'life', true, { amount: 500000, inside_super: true }),
        cov('you', 'tpd', false),
        cov('partner', 'life', false),
      ], _confidence: 'stated' } };
    const t5 = panelFor(5, D5c, derive(D5c));
    t('tile-5-renders-a-state-matrix-not-a-chart', /class="fc-matrix"/.test(t5) && !/class="fc-chart"/.test(t5));
    t('tile-5-all-three-states-render-distinctly',
      /fc-in_place/.test(t5) && /fc-none_held/.test(t5) && /fc-not_recorded/.test(t5));
    t('tile-5-every-state-carries-a-word-not-only-a-dot',
      /class="fc-word">in place</.test(t5) && /class="fc-word">none held</.test(t5) && /class="fc-word">not recorded</.test(t5));
    t('tile-5-none-held-and-not-recorded-are-different-strings',
      t5.indexOf('none held') !== -1 && t5.indexOf('not recorded') !== -1);
    t('tile-5-the-legend-explains-all-three-states',
      /class="fc-mlegend"/.test(t5) && /you told Finn it exists/.test(t5)
      && /you told Finn there is none/.test(t5) && /Finn has not asked yet/.test(t5));
    t('tile-5-states-each-cover-once-in-the-matrix', (t5.match(/<th scope="row">Life cover<\/th>/g) || []).length === 1);

    // No detail panel contains a grading word. The linter's OWN list,
    // exported rather than copied: a duplicated regex drifts, which is the
    // same failure as a declared test count.
    const APPRAISAL = linter.__appraisalForTests;
    t('the-appraisal-vocabulary-comes-from-the-linter-not-a-copy', APPRAISAL instanceof RegExp);
    t('no-tile-detail-panel-contains-a-grading-word',
      [1, 2, 3, 4, 5, 6, 7, 8, 9].every(function (n) { return !APPRAISAL.test(strip(panelFor(n, D, der))); }));

    // derive() now returns home_secured, and every figure the model reads
    // out loud carries a human label rather than its key name.
    const keys = chat.__derivedKeysForTests, labels = chat.__derivedLabelsForTests;
    const block = chat.__derivedPromptSectionForTests(D);
    t('home_secured-is-returned-by-derive', typeof der.home_secured === 'number');
    t('every-derived-figure-in-the-prompt-has-a-human-label',
      keys.every(function (k) { return typeof labels[k] === 'string' && labels[k].length > 0 && labels[k] !== k; }));
    t('the-derived-block-never-prints-a-raw-key-name',
      keys.every(function (k) { return block.indexOf('\n  ' + k + ':') === -1; }));
    t('the-derived-block-names-the-secured-lending-in-plain-words',
      block.indexOf('secured against the home:') !== -1 && block.indexOf('home_secured') === -1);
    t('the-derived-block-still-says-quote-these-and-never-derive',
      /QUOTE THESE VERBATIM/.test(block) && /never work one out yourself/.test(block));
  }

  return {
    pass: failures.length === 0,
    total: ran,
    declared: 251,
    failures,
    hand_computed: {
      home_equity: 320000, lvr_percent: 66.3, surplus_monthly: 3450, buffer_months: 2.7,
      super_total: 373000, income_total_annual: 270200, income_costs_annual: 18000,
      property_equity_commercial: 300000, property_equity_holiday: 310000,
      debts_total_personal: 107400, debts_total_company: 380000,
    },
    insights: EXPECTED_INSIGHTS,
  };
}
