/* Tile detail panels — component-spec.md 4.1, rebuilt against the
   component library (Step 4). Panel order, fixed:

     figure hero → teaching calcs → reference block (collapsed)
     → section_b where present → insights

   Rules carried in code:
   - Layout responds to the SHAPE of the data, never its magnitude.
     Cardinality (0 / 1 / 2+) drives repeaters; completeness drives what
     collapses into the reference block; insight count drives rail vs bare
     card. Nothing here inspects whether a number is good.
   - Teaching calcs carry real headings in ink, as plain questions, never
     grey category labels. If a figure is derived, its derivation is shown.
   - Missing values render 'none recorded', never $0. Missing reference
     fields collapse behind a closed row with a count: three none-recorded
     rows in a prominent card read as product failure; the same three
     behind a closed row are a neutral fact.
   - section_b is absent on tiles 1 and 2 BY DESIGN (their calcs
     demonstrate the mechanic) and renders everywhere else.
   - Insights render as gap cards: a numbered step rail for 2+, one bare
     unnumbered card for 1. The calm state (0 insights) arrives in Step 5.
   - Term handovers at calc feet come from finnTerms.handoverFor (first
     encounter only, persisted per household); pass opts.terms. Copy-borne
     <term> wrappers are handled by the components' copy pipeline.

   Exposed as window.finnPanels:
     renderDashboard(domains, {yearNow, derived, triggers, library, terms})
     renderTile(tileNo, domains, derived, tileResult, library, opts) */
(function () {
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const arr = v => Array.isArray(v) ? v : [];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isPlaceholder = s => typeof s === 'string' && s.startsWith('[Not provided');

  // Negative values render as "-$354" (tile 2's calc can legitimately show
  // a negative left-over; display is broader than triggering).
  const money = v => num(v) !== null
    ? (Math.round(v) < 0 ? '-$' + Math.abs(Math.round(v)).toLocaleString('en-AU') : '$' + Math.round(v).toLocaleString('en-AU'))
    : null;
  const rate = v => num(v) !== null ? v + '%' : null;
  const text = v => (typeof v === 'string' && v.trim()) ? v.trim() : null;

  const C = () => window.finnComponents;

  /* ── shared fragments ── */

  function calcSection(heading, rows, handoverHtml) {
    return '<div class="fp-teach"><h4 class="fp-calchead">' + esc(heading) + '</h4>' +
      C().calcBlock(rows) + (handoverHtml || '') + '</div>';
  }

  // List-with-status (tiles 5 and 6 positions, odd reference rows): related
  // fields with states, never a score. Distinct from a calc (no arithmetic)
  // and from the reference block (this is the tile's core position).
  function statusList(rows) {
    return '<div class="fp-status">' + rows.map(r =>
      '<div class="fp-row"><span class="fp-label">' + esc(r[0]) + '</span><span class="fp-value">' +
      (r[1] === null || r[1] === undefined ? '<strong>none recorded</strong>' : esc(r[1])) + '</span></div>'
    ).join('') + '</div>';
  }

  function coverDisplay(cover) {
    if (!cover || typeof cover !== 'object' || cover.held === null || cover.held === undefined) return null;
    if (cover.held === false) return 'none held';
    let s = num(cover.amount) !== null ? money(cover.amount) : 'held, amount not recorded';
    if (cover.inside_super === true) s += ' · inside super';
    return s;
  }

  function estateDisplay(doc) {
    if (!doc || typeof doc !== 'object' || doc.in_place === null || doc.in_place === undefined) return null;
    if (doc.in_place === false) return 'not in place';
    if (doc.in_place === 'unsure') return 'unsure';
    if (doc.in_place === 'na') return 'not applicable';
    let s = 'in place';
    if (text(doc.last_updated)) s += ', last updated ' + text(doc.last_updated);
    return s;
  }

  const STRUCTURE_LABELS = {
    paye: 'salary (PAYE)', sole_trader: 'sole trader income', company: 'income through a company',
    trust: 'income through a trust', mixed: 'a mix of salary and self-employed income',
  };

  /* Reference block builder: fields render with their values where known;
     the summary carries the count of what is missing. */
  function refBlock(label, fields) {
    const missing = fields.filter(f => f[1] === null || f[1] === undefined).length;
    const rows = fields.map(f => ({ label: f[0], op: '', value: f[1] ?? '', missing: f[1] === null || f[1] === undefined }));
    return C().referenceBlock(label, missing, C().calcBlock(rows));
  }

  /* ── position-line slot resolution (unchanged semantics: any unresolved
        slot omits the line; the renderer never composes) ── */
  function slotValues(domains, derived) {
    const d = domains || {};
    const home = d.home || {}, inc = d.income || {}, buf = d.buffer || {};
    const sup = d.super || {}, inv = d.investments || {}, debts = d.debts || {};
    const prot = d.protection || {}, est = d.estate || {};
    const der = derived || {};
    const ownerCounts = {};
    for (const f of arr(sup.funds)) {
      if (f && typeof f.owner === 'string' && f.owner) ownerCounts[f.owner] = (ownerCounts[f.owner] || 0) + 1;
    }
    const multiOwner = Object.entries(ownerCounts).find(([, n]) => n > 1) || null;
    const firstProp = arr(inv.properties)[0] || null;
    const invParts = [inv.shares_value, inv.managed_funds_value].filter(v => num(v) !== null);
    return {
      rate_percent: num(home.rate_percent),
      rate_type: text(home.rate_type) && esc(text(home.rate_type)),
      lender: text(home.lender) && esc(text(home.lender)),
      with_lender_since: text(home.with_lender_since) ? esc(text(home.with_lender_since)) : (num(home.with_lender_since) !== null ? String(home.with_lender_since) : null),
      offset_balance: money(home.offset_balance),
      mortgage_balance: money(home.mortgage_balance),
      home_equity: money(der.home_equity),
      lvr_percent: num(der.lvr_percent),
      surplus_monthly: money(der.surplus_monthly),
      buffer_months: num(der.buffer_months),
      accessible_savings: money(buf.accessible_savings),
      where_held: text(buf.where_held) && esc(text(buf.where_held)),
      owner_display: multiOwner ? (multiOwner[0] === 'you' ? 'You' : esc(multiOwner[0])) : null,
      fund_count_display: multiOwner ? String(multiOwner[1]) : null,
      life_display: coverDisplay(prot.life) ?? undefined,
      ip_display: coverDisplay(prot.income_protection) ?? undefined,
      tpd_display: coverDisplay(prot.tpd) ?? undefined,
      trauma_display: coverDisplay(prot.trauma) ?? undefined,
      will_display: estateDisplay(est.will) ?? undefined,
      poa_display: estateDisplay(est.poa) ?? undefined,
      guardianship_display: estateDisplay(est.guardianship) ?? undefined,
      nomination_display: estateDisplay(est.super_nomination) ?? undefined,
      property_value: firstProp ? money(firstProp.value_estimate) : null,
      property_loan: firstProp ? money(firstProp.loan_balance) : null,
      rental_income_annual: money(inc.rental_income_annual),
      investments_total_display: invParts.length ? money(invParts.reduce((a, b) => a + b, 0)) : null,
      held_in: text(inv.held_in) && esc(text(inv.held_in)),
      debts_total: money(der.debts_total),
      debt_count_display: arr(debts.items).length > 0 ? String(debts.items.length) : null,
      structure_display: (function () {
        const base = inc.structure != null ? STRUCTURE_LABELS[inc.structure] || esc(inc.structure) : null;
        if (base === null) return null;
        return inc.entity && inc.entity.type ? base + ', with a ' + esc(inc.entity.type) + ' in the picture' : base;
      })(),
    };
  }

  function fillPositionLine(pl, domains, derived) {
    if (!pl || !pl.template) return null;
    const values = slotValues(domains, derived);
    let ok = true;
    const out = pl.template.replace(/\{(\w+)\}/g, (_, name) => {
      let v = values[name];
      if (name.endsWith('_display') && v === undefined) { ok = false; return ''; }
      if (name.endsWith('_display') && v === null) v = 'none recorded';
      if (v === null || v === undefined) { ok = false; return ''; }
      return String(v);
    });
    return ok ? out : null;
  }

  /* ══════════ per-tile position sections: hero, teaching calcs,
       repeaters, reference block ══════════ */

  function tilePosition(tileNo, d, der, terms) {
    const home = d.home || {}, inc = d.income || {}, exp = d.expenses || {};
    const buf = d.buffer || {}, sup = d.super || {}, inv = d.investments || {};
    const debts = d.debts || {}, prot = d.protection || {}, est = d.estate || {};
    const ctx = d.context || {};
    const hand = id => (terms && terms.handoverFor) ? terms.handoverFor(id) : '';
    let html = '';

    if (tileNo === 1) {
      if (money(der.home_equity)) {
        const bar = C().proportionBar(
          { label: 'Owed ' + money(home.mortgage_balance), value: home.mortgage_balance },
          { label: 'Yours ' + money(der.home_equity), value: der.home_equity },
          'Loan ' + money(home.mortgage_balance) + ' against equity ' + money(der.home_equity));
        html += C().figureHero(money(der.home_equity), 'is the part of the property you own', 'outright.', bar);
      } else if (money(home.value_estimate)) {
        html += C().figureHero(money(home.value_estimate), 'is what the home is worth, on your', 'estimate.');
      }
      html += calcSection('What you own of it', [
        { label: 'Value, your estimate', op: '', value: money(home.value_estimate), missing: money(home.value_estimate) === null },
        { label: 'Loan balance', op: '−', value: money(home.mortgage_balance), missing: money(home.mortgage_balance) === null },
        { label: 'What you own of it', op: '=', value: money(der.home_equity), missing: money(der.home_equity) === null, result: true },
      ], hand('equity'));
      html += calcSection('How much of the place is borrowed', [
        { label: 'What you still owe', op: '', value: money(home.mortgage_balance), missing: money(home.mortgage_balance) === null },
        { label: 'What the property is worth', op: '÷', value: money(home.value_estimate), missing: money(home.value_estimate) === null },
        { label: 'How much of the place is borrowed', op: '=', value: rate(der.lvr_percent), missing: rate(der.lvr_percent) === null, result: true },
      ], hand('lvr'));
      if (home.has_offset === true) {
        const chargedOn = (num(home.mortgage_balance) !== null && num(home.offset_balance) !== null)
          ? money(home.mortgage_balance - home.offset_balance) : null;
        html += calcSection('What interest is charged on', [
          { label: 'Loan balance', op: '', value: money(home.mortgage_balance), missing: money(home.mortgage_balance) === null },
          { label: 'In your offset', op: '−', value: money(home.offset_balance), missing: money(home.offset_balance) === null },
          { label: 'What interest is charged on', op: '=', value: chargedOn, missing: chargedOn === null, result: true },
        ], hand('offset'));
      }
      html += refBlock('The rest of the loan details', [
        ['Rate', rate(home.rate_percent)],
        ['Rate type', text(home.rate_type)],
        ['Lender', text(home.lender) ? text(home.lender) + (text(home.with_lender_since) ? ', since ' + text(home.with_lender_since) : '') : null],
        ['Repayment', money(home.repayment_monthly) ? money(home.repayment_monthly) + '/month' : null],
        ['Term remaining', num(home.term_remaining_years) !== null ? home.term_remaining_years + ' years' : null],
        ['Package fee', money(home.package_fee_annual) ? money(home.package_fee_annual) + '/year' : null],
      ]);
    }

    else if (tileNo === 2) {
      if (money(der.surplus_monthly)) {
        html += C().figureHero(money(der.surplus_monthly), 'is what’s left over in a typical', 'month.');
      }
      const takeHomeKnown = [inc.salary_net_monthly, inc.partner_salary_net_monthly].filter(v => num(v) !== null);
      const takeHome = takeHomeKnown.length ? takeHomeKnown.reduce((a, b) => a + b, 0) : null;
      const mins = arr(debts.items).map(it => num(it && it.minimum_monthly)).filter(v => v !== null);
      const rows = [
        { label: 'Take-home pay, both of you', op: '', value: money(takeHome), missing: takeHome === null },
        { label: 'Living costs', op: '−', value: money(exp.living_monthly) ? money(exp.living_monthly) + (exp.includes_housing === true ? ' · includes housing' : '') : null, missing: money(exp.living_monthly) === null },
      ];
      if (exp.includes_housing !== true) {
        rows.push({ label: 'Housing repayment', op: '−', value: money(exp.housing_repayment_monthly), missing: money(exp.housing_repayment_monthly) === null });
      }
      if (mins.length) rows.push({ label: 'Minimum payments, other debts', op: '−', value: money(mins.reduce((a, b) => a + b, 0)) });
      rows.push({ label: 'What’s left over', op: '=', value: money(der.surplus_monthly), missing: money(der.surplus_monthly) === null, result: true });
      html += calcSection('What’s left over each month', rows, hand('take_home_pay'));
      html += refBlock('The rest of the income details', [
        ['Salary, before tax', money(inc.salary_gross_annual) ? money(inc.salary_gross_annual) + '/year' : null],
        ['Partner salary, before tax', money(inc.partner_salary_gross_annual) ? money(inc.partner_salary_gross_annual) + '/year' : null],
      ]);
    }

    else if (tileNo === 3) {
      if (num(der.buffer_months) !== null) {
        html += C().figureHero(der.buffer_months + (der.buffer_months === 1 ? ' month' : ' months'), 'is how long your safety net would', 'last.');
      } else if (money(buf.accessible_savings)) {
        html += C().figureHero(money(buf.accessible_savings), 'is the money you could reach', 'quickly.');
      }
      const housing = exp.includes_housing === true ? 0 : num(exp.housing_repayment_monthly);
      const monthCost = (num(exp.living_monthly) !== null && housing !== null) ? exp.living_monthly + housing : null;
      html += calcSection('How long it would last', [
        { label: 'Accessible savings', op: '', value: money(buf.accessible_savings), missing: money(buf.accessible_savings) === null },
        { label: 'What a month costs', op: '÷', value: money(monthCost), missing: monthCost === null },
        { label: 'How long it would last', op: '=', value: num(der.buffer_months) !== null ? der.buffer_months + ' months' : null, missing: num(der.buffer_months) === null, result: true },
      ]);
      html += refBlock('The rest of the safety net details', [
        ['Where it sits', text(buf.where_held)],
        ['Linked against the loan', buf.linked_to_loan === true ? 'yes' : buf.linked_to_loan === false ? 'no' : null],
        ['Other cash', money(buf.other_cash) ? money(buf.other_cash) + (text(buf.other_cash_where_held) ? ' · ' + text(buf.other_cash_where_held) : '') : null],
      ]);
    }

    else if (tileNo === 4) {
      if (money(der.super_total)) {
        html += C().figureHero(money(der.super_total), 'is in super across the', 'household.');
      }
      const funds = arr(sup.funds);
      if (funds.length) {
        const items = funds.map((f, i) => ({
          title: (text(f && f.fund) && f.fund !== 'unknown' ? f.fund : 'Fund ' + (i + 1)) +
            (text(f && f.owner) ? ' · ' + (String(f.owner).toLowerCase() === 'you' ? 'yours' : String(f.owner).toLowerCase() === 'partner' ? 'partner’s' : f.owner) : ''),
          rows: [
            { label: 'Balance', op: '', value: money(f && f.balance), missing: money(f && f.balance) === null },
            { label: 'Insurance inside', op: '', value: f && f.has_insurance === true ? 'yes' : f && f.has_insurance === false ? 'no' : null, missing: !(f && typeof f.has_insurance === 'boolean') },
          ],
        }));
        html += '<div class="fp-teach"><h4 class="fp-calchead">What’s in super</h4>' +
          C().repeatingItems(items, [
            { label: 'Total across accounts', op: '=', value: money(der.super_total), missing: money(der.super_total) === null, result: true },
          ]) + '</div>';
      } else if (sup.multiple_accounts === true) {
        html += statusList([['Super accounts', 'more than one account mentioned, details not yet gathered']]);
      } else {
        html += statusList([['Super accounts', null]]);
      }
      html += refBlock('The rest of the super details', [
        ['Extra contributions', sup.extra_contributions === true ? 'yes' : sup.extra_contributions === false ? 'no' : null],
      ]);
    }

    else if (tileNo === 5) {
      html += '<div class="fp-teach"><h4 class="fp-calchead">The cover you hold</h4>' + statusList([
        ['Life cover', coverDisplay(prot.life)],
        ['TPD cover', coverDisplay(prot.tpd)],
        ['Income protection', coverDisplay(prot.income_protection)],
        ['Trauma cover', coverDisplay(prot.trauma)],
      ]) + '</div>';
      const kids = arr(ctx.children);
      const hh = [];
      if (num(ctx.adults) !== null) hh.push(ctx.adults + (ctx.adults === 1 ? ' adult' : ' adults'));
      if (kids.length) hh.push(kids.length + (kids.length === 1 ? ' child' : ' children') + (kids.every(c => c && num(c.age) !== null) ? ' aged ' + kids.map(c => c.age).join(' and ') : ''));
      html += refBlock('The household this protects', [
        ['Household', hh.length ? hh.join(', ') : null],
        ['Mortgage outstanding', home.owns_home === false ? 'no mortgage' : money(home.mortgage_balance)],
      ]);
    }

    else if (tileNo === 6) {
      html += '<div class="fp-teach"><h4 class="fp-calchead">The paperwork, as it stands</h4>' + statusList([
        ['Will', estateDisplay(est.will)],
        ['Enduring power of attorney', estateDisplay(est.poa)],
        ['Guardianship for the children', estateDisplay(est.guardianship)],
        ['Super death benefit nomination', (function () {
          const base = estateDisplay(est.super_nomination);
          if (base === null) return null;
          const n = est.super_nomination;
          return n && n.in_place === true && typeof n.binding === 'boolean' ? base + (n.binding ? ' · binding' : ' · non-binding') : base;
        })()],
      ]) + '</div>';
      const kids = arr(ctx.children);
      html += refBlock('The household this covers', [
        ['Children', kids.length ? kids.length + (kids.length === 1 ? ' child' : ' children') + (kids.every(c => c && num(c.age) !== null) ? ', aged ' + kids.map(c => c.age).join(' and ') : '') : null],
      ]);
    }

    else if (tileNo === 7) {
      const props = arr(inv.properties);
      const invParts = [inv.shares_value, inv.managed_funds_value].filter(v => num(v) !== null);
      const propEquityKnown = (der.property_equity || []).filter(v => num(v) !== null);
      if (propEquityKnown.length) {
        html += C().figureHero(money(propEquityKnown.reduce((a, b) => a + b, 0)), 'is the equity across your investment', props.length === 1 ? 'property.' : 'properties.');
      } else if (invParts.length) {
        html += C().figureHero(money(invParts.reduce((a, b) => a + b, 0)), 'is held in shares and', 'funds.');
      }
      if (props.length) {
        const items = props.map((p, i) => ({
          title: text(p && p.held_in) ? 'Investment property' + (props.length > 1 ? ' ' + (i + 1) : '') + ' · held in ' + p.held_in : 'Investment property' + (props.length > 1 ? ' ' + (i + 1) : ''),
          rows: [
            { label: 'Value, your estimate', op: '', value: money(p && p.value_estimate), missing: money(p && p.value_estimate) === null },
            { label: 'Loan against it', op: '−', value: money(p && p.loan_balance), missing: money(p && p.loan_balance) === null },
            { label: 'Equity', op: '=', value: num(der.property_equity && der.property_equity[i]) !== null ? money(der.property_equity[i]) : null, missing: num(der.property_equity && der.property_equity[i]) === null, result: true },
          ],
        }));
        const aggRows = props.length > 1 ? [
          { label: 'Total value', op: '', value: money(props.map(p => num(p && p.value_estimate)).filter(v => v !== null).reduce((a, b) => a + b, 0)) },
          { label: 'Total lending', op: '−', value: money(props.map(p => num(p && p.loan_balance)).filter(v => v !== null).reduce((a, b) => a + b, 0)) },
          { label: 'Total equity', op: '=', value: propEquityKnown.length ? money(propEquityKnown.reduce((a, b) => a + b, 0)) : null, missing: !propEquityKnown.length, result: true },
        ] : [];
        html += '<div class="fp-teach"><h4 class="fp-calchead">What each property is worth to you</h4>' + C().repeatingItems(items, aggRows) + '</div>';
      }
      html += '<div class="fp-teach"><h4 class="fp-calchead">Held outside property</h4>' + statusList([
        ['Shares and ETFs', money(inv.shares_value) ? money(inv.shares_value) + (text(inv.held_in) ? ' · held in ' + text(inv.held_in) : '') : null],
        ['Managed funds', money(inv.managed_funds_value)],
      ]) + '</div>';
      html += refBlock('The rest of the property details', props.length ? props.flatMap((p, i) => [
        ['Rate' + (props.length > 1 ? ', property ' + (i + 1) : ''), rate(p && p.rate_percent)],
        ['Repayment type' + (props.length > 1 ? ', property ' + (i + 1) : ''), text(p && p.repayment_type) ? String(p.repayment_type).replace('_', ' ') : null],
        ['Rent' + (props.length > 1 ? ', property ' + (i + 1) : ''), money(p && p.rent_monthly) ? money(p.rent_monthly) + '/month' : null],
        ['Use' + (props.length > 1 ? ', property ' + (i + 1) : ''), text(p && p.use)],
      ]) : [['Investment properties', null]]);
    }

    else if (tileNo === 8) {
      if (money(der.debts_total)) {
        html += C().figureHero(money(der.debts_total), 'is owed outside the', 'mortgage.');
      }
      const items = arr(debts.items);
      const TYPE_LABELS = { credit_card: 'Credit card', personal_loan: 'Personal loan', car_loan: 'Car loan', bnpl: 'Buy now pay later', tax_debt: 'Tax debt', other: 'Other debt' };
      if (items.length) {
        const cards = items.map(it => ({
          title: TYPE_LABELS[it && it.type] || 'Debt',
          rows: [
            { label: 'Balance', op: '', value: money(it && it.balance), missing: money(it && it.balance) === null },
            { label: 'Rate', op: '', value: rate(it && it.rate_percent), missing: rate(it && it.rate_percent) === null },
            { label: 'Minimum repayment', op: '', value: money(it && it.minimum_monthly) ? money(it.minimum_monthly) + '/month' : null, missing: money(it && it.minimum_monthly) === null },
          ],
        }));
        html += '<div class="fp-teach"><h4 class="fp-calchead">What each one is costing</h4>' + C().repeatingItems(cards, [
          { label: 'Total owing', op: '=', value: money(der.debts_total), missing: money(der.debts_total) === null, result: true },
        ]) + '</div>';
      }
      html += refBlock('Held separately', [
        ['HECS', money(debts.hecs_balance)],
      ]);
    }

    else if (tileNo === 9) {
      if (money(der.income_total_annual)) {
        html += C().figureHero(money(der.income_total_annual), 'is what comes in across the household each', 'year.');
      }
      const annualKnown = [inc.salary_gross_annual, inc.partner_salary_gross_annual, inc.business_income_annual, inc.rental_income_annual, inc.other_income_annual].some(v => num(v) !== null);
      if (annualKnown) {
        const rows = [];
        if (num(inc.salary_gross_annual) !== null) rows.push({ label: 'Salary', op: rows.length ? '+' : '', value: money(inc.salary_gross_annual) });
        if (num(inc.partner_salary_gross_annual) !== null) rows.push({ label: 'Partner salary', op: rows.length ? '+' : '', value: money(inc.partner_salary_gross_annual) });
        if (num(inc.business_income_annual) !== null) rows.push({ label: 'Business income', op: rows.length ? '+' : '', value: money(inc.business_income_annual) });
        if (num(inc.rental_income_annual) !== null) rows.push({ label: 'Rental income', op: rows.length ? '+' : '', value: money(inc.rental_income_annual) });
        if (num(inc.other_income_annual) !== null) rows.push({ label: 'Other income', op: rows.length ? '+' : '', value: money(inc.other_income_annual) });
        rows.push({ label: 'Across the year', op: '=', value: money(der.income_total_annual), missing: money(der.income_total_annual) === null, result: true });
        html += calcSection('How the income is made up', rows);
      } else {
        html += '<div class="fp-teach"><h4 class="fp-calchead">How the income is made up</h4>' + statusList([
          ['Take-home pay', money(inc.salary_net_monthly) ? money(inc.salary_net_monthly) + '/month' : null],
          ['Partner take-home', money(inc.partner_salary_net_monthly) ? money(inc.partner_salary_net_monthly) + '/month' : null],
        ]) + '</div>';
      }
      html += refBlock('How it’s set up', [
        ['Structure', inc.structure != null ? (STRUCTURE_LABELS[inc.structure] || inc.structure) : null],
        ['Company or trust', inc.entity && inc.entity.type ? (inc.entity.type + (text(inc.entity.name) ? ': ' + inc.entity.name : '')) : null],
        ['Employer super', arr(inc.employer_super_on).length ? 'paid on ' + inc.employer_super_on.join(', ') : null],
      ]);
    }

    return html;
  }

  /* ══════════ insights as gap cards ══════════ */

  function gapCardFor(insight, entry, domains, derived, library, costHtml) {
    const pos = fillPositionLine(entry.position_line, domains, derived);
    let body = '';
    if (entry.intro && !isPlaceholder(entry.intro)) body += '<p class="fp-intro">' + esc(entry.intro) + '</p>';

    const HEADINGS = {
      why: 'Why this is worth a conversation',
      turn_up: 'What a look at this can turn up',
      dont_realise: "The part most people don't realise",
      how_professional: 'How the professional works',
    };
    const ORDER = ['why', 'turn_up', 'dont_realise', 'how_professional'];
    for (const key of ORDER) {
      let block = entry.blocks && entry.blocks[key];
      if (!block || isPlaceholder(block)) continue;
      if (insight.ownership_block_suppressed && entry.ownership_block && entry.ownership_block.block === key) {
        const paras = block.split('\n\n');
        paras.splice(entry.ownership_block.paragraph, 1);
        if (!paras.length) continue;
        block = paras.join('\n\n');
      }
      if (entry.block_style === 'single') {
        body += C().eduBlock(null, block);
      } else if (entry.block_style === 'inline_headings') {
        // The copy carries its own headings: first line is the heading.
        const ix = block.indexOf('\n\n');
        body += ix > 0 ? C().eduBlock(block.slice(0, ix), block.slice(ix + 2), key === 'dont_realise')
                       : C().eduBlock(null, block);
      } else {
        body += C().eduBlock(HEADINGS[key], block, key === 'dont_realise');
      }
    }
    // Cost (ruling, reconciled spec 3.2): once per professional per tile,
    // on the first card routing to them — first-encounter logic, like term
    // handovers. The chip keeps the pill on every card.
    if (costHtml) body += '<div class="fp-teach fp-cost">' + costHtml + '</div>';
    const promise = entry.blocks && entry.blocks.nothing_to_prepare;
    if (promise && !isPlaceholder(promise) && entry.block_style !== 'single') {
      if (entry.block_style === 'inline_headings') {
        const ix = promise.indexOf('\n\n');
        body += ix > 0 ? C().eduBlock(promise.slice(0, ix), promise.slice(ix + 2)) : C().eduBlock(null, promise);
      } else {
        body += '<div class="fp-teach">' + C().promiseBlock(C().renderCopy(promise)) + '</div>';
      }
    }
    if (entry.action_label && !entry.no_referral) {
      body += C().actionZone(entry.action_label,
        "Finn is paid by the professionals on our list. What they can't do is buy their way onto it. We meet everyone first, and if we wouldn't send our own family to them, they're not there.");
    }

    const pro = entry.route_primary && library.professionals && library.professionals[entry.route_primary];
    return C().gapCard({
      id: entry.id,
      headline: entry.title || '',
      hook: pos || '',
      chip: pro ? pro.name + ' · ' + pro.cost_pill.toLowerCase() : '',
      bodyHtml: body,
    });
  }

  function insightsSection(tileResult, domains, derived, library) {
    if (!tileResult || !tileResult.insights.length) return ''; // calm state arrives in Step 5
    const all = [].concat(arr(library && library.insights), arr(library && library.overrides));
    const costShown = new Set(); // once per professional per TILE
    const cards = tileResult.insights
      .map(ins => {
        const entry = all.find(e => e.id === ins.id);
        if (!entry) return '';
        let costHtml = '';
        const pro = entry.route_primary && !entry.no_referral && library.professionals && library.professionals[entry.route_primary];
        if (pro && !costShown.has(entry.route_primary)) {
          costShown.add(entry.route_primary);
          costHtml = C().costPill(pro.cost_pill) + ' ' + C().costLine(pro.cost_line);
        }
        return gapCardFor(ins, entry, domains, derived, library, costHtml);
      })
      .filter(Boolean);
    return '<div class="fp-section fp-insights"><h4 class="fp-calchead">Worth a conversation</h4>' +
      C().stepRail(cards) + '</div>';
  }

  /* ══════════ who to see — component-spec 4.3 ══════════
     A second tab at dashboard level, peer to the tile grid. Professional
     order is fixed by first appearance across tiles 1 to 9, NEVER sorted
     by count. An insight appears once, under its route_primary, with
     route_also named inline beneath the item, never duplicated. A
     professional who only ever appears as a secondary gets no card.
     no_referral insights (2.2, 8.1b) appear on no card at all. No total
     anywhere: per-professional counts are facts, a grand total is a
     verdict on the whole position. */

  function renderWhoToSee(triggersResult, library) {
    const all = [].concat(arr(library && library.insights), arr(library && library.overrides));
    const pros = (library && library.professionals) || {};

    // Fired entries in fixed tile/insight order.
    const fired = [];
    for (const t of arr(triggersResult && triggersResult.tiles)) {
      if (!t.visible) continue;
      for (const ins of t.insights) {
        const entry = all.find(e => e.id === ins.id);
        if (entry) fired.push(entry);
      }
    }

    // Group under route_primary; order = first appearance.
    const order = [];
    const byPro = {};
    for (const entry of fired) {
      if (entry.no_referral || !entry.route_primary) continue;
      if (!byPro[entry.route_primary]) { byPro[entry.route_primary] = []; order.push(entry.route_primary); }
      byPro[entry.route_primary].push(entry);
    }

    // Trust banner: the disclosure first, then vetting, then the promise —
    // all verbatim library-adjacent copy from the education library.
    let html = '<div class="fc fp-who">';
    html += C().trustBanner(
      "<b>Finn is paid by the professionals on our list.</b> What they can't do is buy their way onto it. We meet everyone first, and if we wouldn't send our own family to them, they're not there. " +
      "There's nothing you need to prepare. Finn sends your whole picture ahead, so you're not sitting there trying to explain a situation you've never had laid out before. " +
      '<span class="steel">Whoever you see, you turn up understood.</span>');

    if (!order.length) {
      html += '<div class="fp-who-empty">Nothing routes to a professional yet. This view fills in as your picture builds.</div>';
    }
    for (const proId of order) {
      const pro = pros[proId];
      if (!pro) continue;
      const entries = byPro[proId];
      const itemsHtml = entries.map(entry => {
        const alsoNames = arr(entry.route_also).map(id => pros[id] && pros[id].name).filter(Boolean);
        return C().professionalItem(entry.title || entry.id, alsoNames);
      }).join('');
      const action = entries.find(e => e.action_label);
      html += C().professionalCard({
        name: pro.name,
        role: pro.role,
        count: entries.length,
        itemsHtml,
        cost_pill: pro.cost_pill,
        cost_line: pro.cost_line,
        actionHtml: action ? C().actionZone(action.action_label) : '',
      });
    }

    // How this works — the full referral disclosure, verbatim
    // (education-library Part Four).
    html += '<div class="fp-section fp-howworks"><h4 class="fp-calchead">How this works</h4>' +
      "<p>When you connect with someone through Finn, that professional usually pays Finn. It's fair you know that before you click anything.</p>" +
      "<p>What that payment doesn't do is decide who's on the list. Nobody buys their way onto it, and nobody moves up it by paying more. People get on the list because they're good at what they do, because they're straight with people, and because they understand households like yours rather than only chasing the big end of town. We meet them first, and we keep an eye on how people find them afterwards.</p>" +
      "<p>The test is simple. If we wouldn't send our own family to them, they don't go on the list.</p>" +
      '</div>';

    html += '</div>';
    return html;
  }

  /* ══════════ assembly — component-spec 4.1 order ══════════ */

  function renderTile(tileNo, domains, derived, tileResult, library, opts) {
    const o = opts || {};
    const tileMeta = library && library.tiles && library.tiles[String(tileNo)];
    const title = tileMeta ? tileMeta.title : 'Tile ' + tileNo;
    let html = '<article class="fc fp-tile" data-tile="' + tileNo + '"><h3>' + esc(title) + '</h3>';
    html += tilePosition(tileNo, domains || {}, derived || {}, o.terms);
    // section_b: absent on tiles 1 and 2 by design; renders where present.
    if (tileMeta && tileMeta.section_b && !isPlaceholder(tileMeta.section_b)) {
      html += '<div class="fp-section fp-b"><h4 class="fp-calchead">What these products actually do</h4><p>' + esc(tileMeta.section_b) + '</p></div>';
    }
    html += insightsSection(tileResult, domains, derived, library);
    html += '</article>';
    return html;
  }

  function renderDashboard(domains, opts) {
    const o = opts || {};
    const derived = o.derived || (window.finnDerived ? window.finnDerived.derive(domains) : {});
    const triggers = o.triggers || (window.finnTriggers ? window.finnTriggers.evaluate(domains, { yearNow: o.yearNow, derived }) : { tiles: [] });
    let html = '<div class="fp-dashboard">';
    for (const t of triggers.tiles) {
      if (!t.visible) continue;
      html += renderTile(t.tile, domains, derived, t, o.library, o);
    }
    html += '</div>';
    return html;
  }

  window.finnPanels = { renderDashboard, renderTile, renderWhoToSee, fillPositionLine, slotValues };
})();
