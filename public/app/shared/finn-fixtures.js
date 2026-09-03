/* The eight trigger-engine fixtures — field-spec.md 3.6. Each asserts an
   EXACT expected insight set, plus the specific must-nots the table names.
   Run with finn-derived.js and finn-triggers.js loaded, via
   runFinnTriggerFixtures() -> { pass, total, failures: [] }.
   yearNow is pinned to 2026 so the will-age rule is deterministic. */
(function () {
  const YEAR = 2026;

  // Estate with everything in place and recent — 6.1 stays quiet.
  const estateQuiet = {
    will: { in_place: true, last_updated: '2024' },
    poa: { in_place: true, last_updated: '2024' },
    guardianship: { in_place: true, last_updated: '2024' },
    super_nomination: { in_place: true, last_updated: '2024', binding: true },
  };

  const FIXTURES = [
    {
      name: 'A — two PAYE salaries, renting, no debts, no kids',
      domains: {
        context: { adults: 2, children: [], owner_age: 31, partner_age: 30, work_intent: 'both continuing', _confidence: 'stated' },
        income: { salary_net_monthly: 5200, partner_salary_net_monthly: 4800, structure: 'paye', _confidence: 'stated' },
        expenses: { living_monthly: 6500, includes_housing: true, _confidence: 'stated' },
        home: { owns_home: false, _confidence: 'stated' },
        buffer: { accessible_savings: 22000, where_held: 'savings account', linked_to_loan: false, _confidence: 'stated' },
        super: { funds: [ { fund: 'Fund One', owner: 'you', balance: 80000, has_insurance: true }, { fund: 'Fund Two', owner: 'partner', balance: 76000, has_insurance: true } ], _confidence: 'stated' },
        protection: { life: { held: true, amount: 300000, inside_super: true }, tpd: { held: true, amount: 150000, inside_super: true }, income_protection: { held: false, amount: null, inside_super: null }, trauma: { held: false, amount: null, inside_super: null }, _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['2.1', '3.1', '5.1'],
      visibleTiles: [2, 3, 4, 5, 6, 9],
      mustNotFire: ['9.1', '4.1', '3.2a', '3.2b'],
    },
    {
      name: 'B — mortgage with offset, savings sitting outside it',
      domains: {
        income: { salary_net_monthly: 6800, partner_salary_net_monthly: 2900, structure: 'paye', _confidence: 'stated' },
        expenses: { living_monthly: 5200, includes_housing: false, housing_repayment_monthly: 2950, _confidence: 'stated' },
        home: { owns_home: true, value_estimate: 910000, mortgage_balance: 605000, rate_percent: 5.99, has_offset: true, offset_balance: 15000, _confidence: 'stated' },
        buffer: { accessible_savings: 30000, where_held: 'savings account', linked_to_loan: false, _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['1.1', '1.3', '2.1', '3.1', '3.2a'],
      mustNotFire: ['3.2b', '5.1', '1.2', '2.2'],
    },
    {
      name: 'C — mortgage, no offset, savings',
      domains: {
        income: { salary_net_monthly: 6800, partner_salary_net_monthly: 2900, structure: 'paye', _confidence: 'stated' },
        expenses: { living_monthly: 5200, includes_housing: false, housing_repayment_monthly: 2950, _confidence: 'stated' },
        home: { owns_home: true, value_estimate: 910000, mortgage_balance: 605000, rate_percent: 5.99, has_offset: false, _confidence: 'stated' },
        buffer: { accessible_savings: 30000, where_held: 'savings account', linked_to_loan: false, _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['1.1', '1.3', '2.1', '3.1', '3.2b'],
      mustNotFire: ['3.2a', '1.2', '5.1'],
    },
    {
      name: 'D — sole trader plus rental property plus shares',
      domains: {
        income: { structure: 'sole_trader', business_income_annual: 54000, rental_income_annual: 28080, _confidence: 'stated' },
        home: { owns_home: false, _confidence: 'stated' },
        investments: { properties: [ { value_estimate: 640000, loan_balance: 410000, rate_percent: 5.89, repayment_type: 'interest_only', rent_monthly: 2340, held_in: 'joint' } ], shares_value: 84200, held_in: 'one name', _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['7.1', '7.2', '9.1'],
      visibleTiles: [2, 3, 4, 5, 6, 7, 9],
    },
    {
      name: 'D-rent-only — rental property alone must NOT fire 9.1',
      domains: {
        income: { structure: 'paye', rental_income_annual: 28080, _confidence: 'stated' },
        home: { owns_home: false, _confidence: 'stated' },
        investments: { properties: [ { value_estimate: 640000, loan_balance: 410000, rate_percent: 5.89, repayment_type: 'interest_only', rent_monthly: 2340, held_in: 'joint' } ], _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['7.1'],
      mustNotFire: ['9.1', '7.2', '5.1'],
    },
    {
      name: 'E — consumer debts, no mortgage',
      domains: {
        home: { owns_home: false, _confidence: 'stated' },
        debts: { items: [ { type: 'credit_card', balance: 6200, rate_percent: 19.99, minimum_monthly: 124 }, { type: 'personal_loan', balance: 9800, rate_percent: 13.5, minimum_monthly: 410 } ], _confidence: 'stated' },
        flags: { hardship: false },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['8.1b'],
      mustNotFire: ['8.1a', 'hardship', '5.1'],
      visibleTiles: [2, 3, 4, 5, 6, 8, 9],
    },
    {
      name: 'F — consumer debts, hardship true',
      domains: {
        home: { owns_home: false, _confidence: 'stated' },
        debts: { items: [ { type: 'credit_card', balance: 6200, rate_percent: 19.99, minimum_monthly: 124 } ], _confidence: 'stated' },
        flags: { hardship: true, hardship_signal: 'missed two rent payments, collectors calling', _confidence: 'inferred' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['hardship'],
      mustNotFire: ['8.1a', '8.1b', '5.1'],
      expectHardship: true,
    },
    {
      name: 'G — trust holding investments',
      domains: {
        income: { structure: 'trust', entity: { type: 'trust', name: 'Family Trust' }, _confidence: 'stated' },
        home: { owns_home: false, _confidence: 'stated' },
        investments: { shares_value: 200000, held_in: 'trust', _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['7.2', '9.1'],
      expectFlags: { '7.2': { ownership_block_suppressed: true } },
    },
    {
      name: 'H — everything null beyond the minimum: ZERO insights',
      domains: { context: { adults: 2 } },
      expect: [],
      visibleTiles: [2, 3, 4, 5, 6, 9],
    },
    {
      name: '4.1-flag — multiple_accounts true with only one named fund',
      domains: {
        super: { funds: [ { fund: 'Fund One', owner: 'you', balance: 60000, has_insurance: null } ], multiple_accounts: true, _confidence: 'stated' },
      },
      expect: ['4.1'],
    },
    {
      name: '1.2-empty-offset — an offset holding nothing fires; a funded one never does',
      domains: {
        income: { salary_net_monthly: 6800, structure: 'paye', _confidence: 'stated' },
        expenses: { living_monthly: 4200, includes_housing: false, housing_repayment_monthly: 2100, _confidence: 'stated' },
        home: { owns_home: true, value_estimate: 700000, mortgage_balance: 420000, rate_percent: 6.1, has_offset: true, offset_balance: 0, package_fee_annual: 395, _confidence: 'stated' },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['1.1', '1.2', '1.3', '2.1', '3.1'],
      tileFlags: { 1: { lender_paid_note_once: true } },
    },
    {
      name: '2.2-nothing-left — computable zero-or-negative surplus fires 2.2, never 2.1',
      domains: {
        income: { salary_net_monthly: 5100, structure: 'paye', _confidence: 'stated' },
        expenses: { living_monthly: 4200, includes_housing: false, housing_repayment_monthly: 1300, _confidence: 'stated' },
        home: { owns_home: false, _confidence: 'stated' },
        debts: { items: [ { type: 'credit_card', balance: 4100, rate_percent: 20.99, minimum_monthly: 95 } ], _confidence: 'stated' },
        flags: { hardship: false },
        estate: { ...estateQuiet, _confidence: 'stated' },
      },
      expect: ['2.2', '3.1', '8.1b'],
      mustNotFire: ['2.1', '8.1a'],
    },
    {
      name: '5.1-reached — protection reached with a confirmed absence fires',
      domains: {
        protection: { life: { held: false, amount: null, inside_super: null }, tpd: { held: null, amount: null, inside_super: null }, income_protection: { held: null, amount: null, inside_super: null }, trauma: { held: null, amount: null, inside_super: null }, _confidence: 'stated' },
      },
      expect: ['5.1'],
    },
  ];

  function runFinnTriggerFixtures() {
    const failures = [];
    for (const fx of FIXTURES) {
      let result;
      try {
        result = window.finnTriggers.evaluate(fx.domains, { yearNow: YEAR });
      } catch (err) {
        failures.push(`${fx.name}: CRASHED — ${err && err.message}`);
        continue;
      }
      const got = result.insight_ids.slice().sort();
      const want = fx.expect.slice().sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        failures.push(`${fx.name}: expected [${want}] got [${got}]`);
      }
      for (const id of fx.mustNotFire || []) {
        if (result.insight_ids.includes(id)) failures.push(`${fx.name}: ${id} fired but must not`);
      }
      if (fx.visibleTiles) {
        const vis = result.tiles.filter(t => t.visible).map(t => t.tile);
        if (JSON.stringify(vis) !== JSON.stringify(fx.visibleTiles)) {
          failures.push(`${fx.name}: visible tiles expected [${fx.visibleTiles}] got [${vis}]`);
        }
      }
      if (fx.expectHardship && result.hardship !== true) failures.push(`${fx.name}: hardship flag not set`);
      for (const [id, flags] of Object.entries(fx.expectFlags || {})) {
        const ins = result.tiles.flatMap(t => t.insights).find(i => i.id === id);
        for (const [k, v] of Object.entries(flags)) {
          if (!ins || ins[k] !== v) failures.push(`${fx.name}: ${id}.${k} expected ${v} got ${ins && ins[k]}`);
        }
      }
      for (const [t, tflags] of Object.entries(fx.tileFlags || {})) {
        const tile = result.tiles.find(x => x.tile === Number(t));
        for (const [k, v] of Object.entries(tflags)) {
          if (!tile || tile[k] !== v) failures.push(`${fx.name}: tile ${t}.${k} expected ${v}`);
        }
      }
      // 3.4 construction assertion — never both offset variants.
      if (result.insight_ids.includes('3.2a') && result.insight_ids.includes('3.2b')) {
        failures.push(`${fx.name}: 3.2a and 3.2b both fired — exclusivity broken`);
      }
      // 2.1 and 2.2 are mutually exclusive, and neither fires on a null
      // surplus (field-spec 3.3 explicit non-trigger).
      if (result.insight_ids.includes('2.1') && result.insight_ids.includes('2.2')) {
        failures.push(`${fx.name}: 2.1 and 2.2 both fired — exclusivity broken`);
      }
    }
    return { pass: failures.length === 0, total: FIXTURES.length, failures };
  }

  window.runFinnTriggerFixtures = runFinnTriggerFixtures;
  window.FINN_TRIGGER_FIXTURES = FIXTURES;
})();
