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

  // Cover is stored per person (Devon, 17 Sept). These read protection
  // .covers[], falling back to the four legacy objects for older rows.
  const COVER_TYPES = ['life', 'tpd', 'income_protection', 'trauma'];
  const COVER_WORDS = { life: 'life', tpd: 'TPD', income_protection: 'income protection', trauma: 'trauma' };
  const personWord = (owner, ctx) => owner === 'partner'
    ? (text(ctx && ctx.partner_name) ? esc(text(ctx.partner_name)) : 'your partner') : 'you';
  function coverFor(prot, owner, type) {
    const list = Array.isArray(prot && prot.covers) ? prot.covers.filter(c => c && typeof c === 'object') : [];
    const hit = list.find(c => c.type === type && (c.owner || 'you') === owner);
    if (hit) return hit;
    return owner === 'you' && prot && typeof prot[type] === 'object' ? prot[type] : null;
  }
  function coverOwners(prot, ctx) {
    const list = Array.isArray(prot && prot.covers) ? prot.covers.filter(c => c && typeof c === 'object') : [];
    const seen = new Set(list.map(c => c.owner || 'you'));
    if (num(ctx && ctx.adults) !== null && ctx.adults >= 2) seen.add('you').add('partner');
    if (!seen.size) seen.add('you');
    return ['you', 'partner'].filter(o => seen.has(o));
  }
  function coverSummary(prot, ctx) {
    const parts = coverOwners(prot, ctx).map(owner => {
      const held = COVER_TYPES.map(t => [t, coverFor(prot, owner, t)])
        .filter(([, c]) => c && c.held !== null && c.held !== undefined);
      if (!held.length) return personWord(owner, ctx) + ': none recorded';
      const words = held.map(([t, c]) => c.held === false ? 'no ' + COVER_WORDS[t]
        : COVER_WORDS[t] + ' ' + (num(c.amount) !== null ? money(c.amount) : 'held, amount not recorded') + (c.inside_super === true ? ' inside super' : ''));
      return personWord(owner, ctx) + ': ' + words.join(', ');
    });
    return parts.length ? parts.join('; ') : null;
  }
  function fundNominations(sup) {
    return arr(sup && sup.funds).filter(f => f && typeof f === 'object')
      .map(f => [esc(text(f.fund) || 'a super account') + (f.owner ? ' (' + esc(text(f.owner)) + ')' : ''), f.nomination]);
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

  const INCOME_SOURCE_LABELS = {
    rental_residential: 'Rental income', rental_commercial: 'Commercial rent',
    dividends: 'Dividends', distributions: 'Distributions',
    trust_distribution: 'Trust distributions', business_profit: 'Business income',
    director_fee: 'Director fees', government: 'Government payments', other: 'Other income',
  };

  // Plain-words name for an open reconciliation item (derived.income_unreconciled).
  // Ids are stable asset ids; "prop-N" appears only for rows the server has
  // not yet migrated to ids.
  function openItemLabel(id, domains) {
    const d = domains || {};
    const props = (d.investments && Array.isArray(d.investments.properties)) ? d.investments.properties : [];
    if (/:costs$/.test(id)) {
      const baseId = id.slice(0, -6);
      const ix = props.findIndex(p => p && p.id === baseId);
      const name = ix !== -1 && props.length > 1 ? 'investment property ' + (ix + 1) : 'the investment property';
      return 'costs on ' + name + ' not recorded yet, the rent shown is before costs';
    }
    const byId = props.findIndex(p => p && p.id === id);
    if (byId !== -1) {
      return (props.length > 1 ? 'investment property ' + (byId + 1) : 'the investment property') + ', no rent recorded against it yet';
    }
    if (/^prop-(\d+)$/.test(id)) {
      const n = Number(id.slice(5));
      return (props.length > 1 ? 'investment property ' + n : 'the investment property') + ', no rent recorded against it yet';
    }
    if (id === 'entity') {
      const e = d.income && d.income.entity;
      const name = e && typeof e === 'object' && e.name ? e.name : (e && e.type ? 'the ' + e.type : 'the company or trust');
      return name + ', nothing recorded coming out of it yet';
    }
    if (id === 'holdings') return 'the share portfolio, no dividends or distributions recorded yet';
    if (id === 'business') return 'the business, no business income recorded yet';
    if (id.indexOf('legacy:') === 0) return 'an earlier figure (' + id.slice(7).replace(/_/g, ' ') + ') that needs re-capturing';
    return id;
  }

  /* Whether a tile's domain was actually reached in conversation: any
     substantive (non-underscore) leaf is non-null. Shared by the grid
     badges and the panel's calm-versus-building decision. */
  const TILE_DOMAINS = { 1: ['home'], 2: ['income', 'expenses'], 3: ['buffer'], 4: ['super'], 5: ['protection'], 6: ['estate'], 7: ['investments'], 8: ['debts'], 9: ['income'] };
  function anyLeaf(o) {
    if (o === null || o === undefined) return false;
    if (Array.isArray(o)) return o.some(anyLeaf);
    if (typeof o === 'object') {
      return Object.entries(o).some(([k, v]) => !k.startsWith('_') && anyLeaf(v));
    }
    return true;
  }
  function tileReached(tileNo, d) {
    return (TILE_DOMAINS[tileNo] || []).some(k => anyLeaf((d || {})[k]));
  }

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
      // Carries the verb, so the template reads for "you" and a name alike.
      // With no single owner holding two funds (4.1 fired on
      // multiple_accounts alone) both are undefined, not null: the line is
      // omitted rather than rendering "none recorded" twice. 4.1 still fires.
      owner_display: multiOwner ? (multiOwner[0] === 'you' ? 'You hold' : esc(multiOwner[0]) + ' holds') : undefined,
      fund_count_display: multiOwner ? String(multiOwner[1]) : undefined,
      cover_display: coverSummary(prot, d.context || {}) ?? undefined,
      life_display: coverDisplay(coverFor(prot, 'you', 'life')) ?? undefined,
      ip_display: coverDisplay(coverFor(prot, 'you', 'income_protection')) ?? undefined,
      tpd_display: coverDisplay(coverFor(prot, 'you', 'tpd')) ?? undefined,
      trauma_display: coverDisplay(coverFor(prot, 'you', 'trauma')) ?? undefined,
      will_display: estateDisplay(est.will) ?? undefined,
      poa_display: estateDisplay(est.poa) ?? undefined,
      guardianship_display: estateDisplay(est.guardianship) ?? undefined,
      nomination_display: (function () {
        const noms = fundNominations(sup).filter(([, n]) => estateDisplay(n) !== null);
        if (noms.length) return noms.map(([label, n]) => label + ': ' + estateDisplay(n) + (n && n.in_place === true && typeof n.binding === 'boolean' ? (n.binding ? ', binding' : ', non-binding') : '')).join('; ');
        return estateDisplay(est.super_nomination) ?? undefined;
      })(),
      property_value: firstProp ? money(firstProp.value_estimate) : null,
      property_loan: firstProp ? money(firstProp.loan_balance) : null,
      rental_income_annual: (function () {
        // Rental income now lives in typed income.other[] entries; the old
        // scalar is read only from not-yet-migrated rows.
        const rentals = (Array.isArray(inc.other) ? inc.other : [])
          .filter(o => o && ['rental_residential', 'rental_commercial'].includes(o.source || o.type))
          .map(o => o.amount_annual).filter(v => num(v) !== null);
        if (rentals.length) return money(rentals.reduce((a, b) => a + b, 0));
        return money(inc.rental_income_annual);
      })(),
      investments_total_display: invParts.length ? money(invParts.reduce((a, b) => a + b, 0)) : null,
      held_in: text(inv.held_in) && esc(text(inv.held_in)),
      debts_total: money(der.debts_total),
      // Counts exactly the items debts_total sums (entity borrowing and
      // HECS excluded), so the sentence's two numbers describe one set.
      // Carries the noun: "1 item" / "N items".
      debt_count_display: (function () {
        const n = arr(debts.items).filter(it => it && it.type !== 'hecs_help' &&
          !['company', 'trust', 'smsf', 'partnership'].includes(it.borrower)).length;
        return n > 0 ? (n === 1 ? '1 item' : n + ' items') : null;
      })(),
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
    // Confidence renders in the label, never as a badge or a colour
    // (component-spec 2.1): a figure captured as "estimated" carries it in
    // its own label; document and stated carry nothing, the unremarkable
    // case. Applies to captured figures, not derived results.
    // Per-field where the ledger knows (16 Sept 2026: a remembered home
    // value was marking every loan figure "your estimate"); the domain's
    // confidence only when there is no ledger at all.
    const ledger = d.flags && Array.isArray(d.flags.to_verify) ? d.flags.to_verify : null;
    const confField = (dom, field, label) => {
      if (ledger) return ledger.some(e => e && e.field === field && !e.item_id && e.confidence === 'estimated') ? label + ', your estimate' : label;
      return dom && dom._confidence === 'estimated' ? label + ', your estimate' : label;
    };
    const conf = (dom, label, field) => field ? confField(dom, field, label)
      : (ledger ? label : (dom && dom._confidence === 'estimated' ? label + ', your estimate' : label));
    let html = '';

    if (tileNo === 1) {
      // The range display below still needs the total lending secured on
      // the home. derive() owns home_secured; this is the sum of it and the
      // mortgage, not a new derivation.
      // securedOther is derive()'s home_secured: lending on the home that is
      // not the mortgage itself (a split, a second loan).
      const securedOther = num(der.home_secured) !== null && der.home_secured > 0 ? der.home_secured : null;
      const securedAll = (num(home.mortgage_balance) !== null && num(der.home_secured) !== null)
        ? home.mortgage_balance + der.home_secured : null;
      // CHART LEADS (Part C). Home value split into equity, the mortgage,
      // and anything else secured against the home. The third segment comes
      // from derive()'s home_secured: the panel never works a figure out.
      if (money(home.value_estimate) && money(der.home_equity)) {
        html += C().stackedBar({
          money: money,
          segments: [
            { label: 'Equity, the part you own', value: der.home_equity, display: money(der.home_equity) },
            { label: 'Mortgage', value: home.mortgage_balance, display: money(home.mortgage_balance) },
            { label: 'Other lending secured on the home', value: der.home_secured, display: money(der.home_secured) },
          ],
          totalLabel: 'What the home is worth',
          totalDisplay: money(home.value_estimate),
        });
      } else if (money(home.value_estimate)) {
        html += C().figureHero(money(home.value_estimate), 'is what the home is worth, on your', 'estimate.');
      }
      // The estimate's range, where one was given (Devon, 16 Sept 2026):
      // the value and the equity are estimates, and the range says how wide.
      if (money(home.value_low) && money(home.value_high)) {
        const eqLo = securedAll !== null ? money(home.value_low - securedAll) : null;
        const eqHi = securedAll !== null ? money(home.value_high - securedAll) : null;
        const src = text(home.value_source);
        html += '<p class="fp-range">' + (src && /estimate/i.test(src) ? 'The ' + esc(src) : 'The estimate' + (src ? ' (' + esc(src) + ')' : '')) +
          ' ranges from ' + money(home.value_low) + ' to ' + money(home.value_high) + '.' +
          (eqLo && eqHi ? ' On that range, what you own of it sits between ' + eqLo + ' and ' + eqHi + '.' : '') + '</p>';
      }
      const otherRow = securedOther ? [{ label: 'Other lending secured on the home, such as a split', op: '−', value: money(securedOther) }] : [];
      html += calcSection('What you own of it', [
        { label: conf(home, 'Value', 'home.value_estimate') + (text(home.value_source) ? ', ' + text(home.value_source) : ''), op: '', value: money(home.value_estimate), missing: money(home.value_estimate) === null },
        { label: conf(home, 'Loan balance', 'home.mortgage_balance'), op: '−', value: money(home.mortgage_balance), missing: money(home.mortgage_balance) === null },
        ...otherRow,
        { label: 'What you own of it', op: '=', value: money(der.home_equity), missing: money(der.home_equity) === null, result: true },
      ], hand('equity'));
      html += calcSection('How much of the place is borrowed', [
        { label: conf(home, 'What you still owe', 'home.mortgage_balance') + (securedOther ? ', including other lending on the home' : ''), op: '', value: money(securedAll !== null && securedOther ? securedAll : home.mortgage_balance), missing: money(home.mortgage_balance) === null },
        { label: conf(home, 'What the property is worth', 'home.value_estimate'), op: '÷', value: money(home.value_estimate), missing: money(home.value_estimate) === null },
        { label: 'How much of the place is borrowed', op: '=', value: rate(der.lvr_percent), missing: rate(der.lvr_percent) === null, result: true },
      ], hand('lvr'));
      if (home.has_offset === true) {
        const chargedOn = (num(home.mortgage_balance) !== null && num(home.offset_balance) !== null)
          ? money(home.mortgage_balance - home.offset_balance) : null;
        html += calcSection('What interest is charged on', [
          { label: conf(home, 'Loan balance', 'home.mortgage_balance'), op: '', value: money(home.mortgage_balance), missing: money(home.mortgage_balance) === null },
          { label: conf(home, 'In your offset', 'home.offset_balance'), op: '−', value: money(home.offset_balance), missing: money(home.offset_balance) === null },
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
      const minsTotal = num(der.personal_minimums_monthly);
      const rows = [
        { label: conf(inc, 'Take-home pay, both of you', 'income.salary_net_monthly'), op: '', value: money(takeHome), missing: takeHome === null },
        { label: conf(exp, 'Living costs', 'expenses.living_monthly'), op: '−', value: money(exp.living_monthly) ? money(exp.living_monthly) + (exp.includes_housing === true ? ' · includes housing' : '') : null, missing: money(exp.living_monthly) === null },
      ];
      if (exp.includes_housing !== true) {
        rows.push({ label: 'Housing repayment', op: '−', value: money(der.housing_monthly), missing: money(der.housing_monthly) === null });
      }
      if (minsTotal) rows.push({ label: 'Minimum payments, other personal debts', op: '−', value: money(minsTotal) });
      rows.push({ label: 'What’s left over', op: '=', value: money(der.surplus_monthly), missing: money(der.surplus_monthly) === null, result: true });
      html += calcSection('What’s left over each month', rows, hand('take_home_pay'));
      html += whereItGoes(exp, der, inc);
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
      const housing = num(der.housing_monthly);
      const monthCost = (num(exp.living_monthly) !== null && housing !== null) ? exp.living_monthly + housing + (num(der.personal_minimums_monthly) || 0) : null;
      html += calcSection('How long it would last', [
        { label: conf(buf, 'Accessible savings', 'buffer.accessible_savings'), op: '', value: money(buf.accessible_savings), missing: money(buf.accessible_savings) === null },
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
      const funds = arr(sup.funds);
      // CHART LEADS (Part C): one bar per account, grouped by member with
      // the member named above their group. Fixed order within each member,
      // and the member groups in a fixed order.
      const OWNER_ORDER = ['you', 'partner'];
      const fundsByOwner = OWNER_ORDER
        .map(function (ow) {
          return {
            heading: ow === 'you' ? 'Your accounts'
              : (text(ctx.partner_name) ? text(ctx.partner_name) + "'s accounts" : "Your partner's accounts"),
            rows: funds.filter(function (f) { return (f.owner || 'you') === ow && num(f.balance) !== null; })
              .map(function (f) { return { label: text(f.fund) || 'a super account', value: f.balance, display: money(f.balance) }; }),
          };
        })
        .filter(function (g) { return g.rows.length; });
      if (fundsByOwner.length) {
        html += C().barRows({
          groups: fundsByOwner,
          footer: money(der.super_total) ? { label: 'Total across the household', display: money(der.super_total) } : null,
        });
      }
      // Panel switch: at two or more items the groups lead, so no hero.
      if (funds.length < 2 && money(der.super_total)) {
        html += C().figureHero(money(der.super_total), 'is in super across the', 'household.');
      }
      // Panel switch (ledger, Sept 2026): one item renders exactly as
      // approved; two or more render as an item group of rows closed by a
      // subtotal. Cardinality drives the layout. Magnitude never does.
      if (funds.length >= 2) {
        const rows = funds.map((f, i) => C().itemRow({
          name: text(f && f.fund) && f.fund !== 'unknown' ? f.fund : 'Fund ' + (i + 1),
          line: text(f && f.owner)
            ? (String(f.owner).toLowerCase() === 'you' ? 'your account'
              : String(f.owner).toLowerCase() === 'partner' ? 'your partner’s account'
              : f.owner + '’s account')
            : null,
          figures: [{ label: conf(sup, 'Balance'), value: money(f && f.balance), missing: money(f && f.balance) === null }],
          chip: f && f.has_insurance === true ? 'Insurance inside' : null,
        }));
        html += '<div class="fp-teach"><h4 class="fp-calchead">What’s in super</h4>' +
          C().itemGroup('Super accounts', rows, [
            { label: 'Across the accounts', op: '=', value: money(der.super_total), missing: money(der.super_total) === null },
          ]) + '</div>';
      } else if (funds.length === 1) {
        const f = funds[0];
        html += '<div class="fp-teach"><h4 class="fp-calchead">What’s in super</h4>' +
          C().repeatingItems([{
            title: (text(f && f.fund) && f.fund !== 'unknown' ? f.fund : 'Fund 1') +
              (text(f && f.owner) ? ' · ' + (String(f.owner).toLowerCase() === 'you' ? 'yours' : String(f.owner).toLowerCase() === 'partner' ? 'partner’s' : f.owner) : ''),
            rows: [
              { label: conf(sup, 'Balance'), op: '', value: money(f && f.balance), missing: money(f && f.balance) === null },
              { label: 'Insurance inside', op: '', value: f && f.has_insurance === true ? 'yes' : f && f.has_insurance === false ? 'no' : null, missing: !(f && typeof f.has_insurance === 'boolean') },
            ],
          }], []) + '</div>';
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
      /* THE MATRIX REPLACES THE PER-OWNER LISTS (Part D, 16 Oct). Same
         information, better shape: rows are cover types, columns are the
         people, and a fourth column says where the cover sits. Keeping both
         would state every cover twice.

         THREE STATES, EACH WITH A DOT AND A WORD:
           in place     held === true   the household said it exists
           none held    held === false  the household said there is none
           not recorded null/absent     Finn never asked
         "None held" is a fact about the household; "not recorded" is a fact
         about the conversation. A blank cell for the third would have Finn
         imply something it was never told. */
      const COVER_ROWS = [['life', 'Life cover'], ['tpd', 'TPD cover'],
        ['income_protection', 'Income protection'], ['trauma', 'Trauma cover']];
      const owners = coverOwners(prot, ctx);
      const stateOf = function (c) {
        if (!c || typeof c !== 'object' || c.held === null || c.held === undefined) return 'not_recorded';
        return c.held === true ? 'in_place' : (c.held === false ? 'none_held' : 'not_recorded');
      };
      const whereOf = function (type) {
        const held = owners.map(function (ow) { return coverFor(prot, ow, type); })
          .filter(function (c) { return c && c.held === true; });
        if (!held.length) return 'not recorded';
        const inside = held.filter(function (c) { return c.inside_super === true; }).length;
        const outside = held.filter(function (c) { return c.inside_super === false; }).length;
        if (inside && !outside) return 'inside super';
        if (outside && !inside) return 'outside super';
        if (inside && outside) return 'some inside super, some outside';
        return 'not recorded';
      };
      html += '<div class="fp-teach"><h4 class="fp-calchead">The cover this household holds</h4>' +
        C().stateMatrix({
          colLabels: owners.map(function (ow) {
            return ow === 'you' ? 'You' : (text(ctx.partner_name) || 'Your partner');
          }),
          whereLabel: 'Where it sits',
          rows: COVER_ROWS.map(function (pair) {
            const type = pair[0];
            return {
              label: pair[1],
              where: whereOf(type),
              cells: owners.map(function (ow) {
                const c = coverFor(prot, ow, type);
                return { state: stateOf(c), note: (c && c.held === true && money(c.amount)) ? money(c.amount) : '' };
              }),
            };
          }),
        }) + '</div>';
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
      ].concat((function () {
        const nomRow = n => {
          const base = estateDisplay(n);
          if (base === null) return null;
          return n && n.in_place === true && typeof n.binding === 'boolean' ? base + (n.binding ? ' · binding' : ' · non-binding') : base;
        };
        const noms = fundNominations(sup);
        // One row per fund (Devon, 17 Sept): a nomination belongs to a fund.
        if (noms.length) return noms.map(([label, n]) => ['Nomination on ' + label, nomRow(n)]);
        return [['Super death benefit nomination', nomRow(est.super_nomination)]];
      })())) + '</div>';
      const kids = arr(ctx.children);
      html += refBlock('The household this covers', [
        ['Children', kids.length ? kids.length + (kids.length === 1 ? ' child' : ' children') + (kids.every(c => c && num(c.age) !== null) ? ', aged ' + kids.map(c => c.age).join(' and ') : '') : null],
      ]);
    }

    else if (tileNo === 7) {
      const props = arr(inv.properties);
      const invParts = [inv.shares_value, inv.managed_funds_value].filter(v => num(v) !== null);
      const propEquityKnown = (der.property_equity || []).filter(v => num(v) !== null);
      /* CHART LEADS (Part C): the portfolio total split by holding type.
         The schema carries exactly three kinds (property equity, shares,
         managed funds), so a fourth cannot arise from a household today.
         stackedBar folds and logs if one ever does, rather than reaching
         for a fourth fill: there isn't one by design. */
      const portfolio = [
        { label: props.length === 1 ? 'Equity in the investment property' : 'Equity in the investment properties',
          value: propEquityKnown.reduce(function (a, b) { return a + b; }, 0) },
        { label: 'Shares and ETFs', value: num(inv.shares_value) },
        { label: 'Managed funds', value: num(inv.managed_funds_value) },
      ].filter(function (s) { return num(s.value) !== null && s.value > 0; })
       .map(function (s) { return { label: s.label, value: s.value, display: money(s.value) }; });
      if (portfolio.length > 1) {
        html += C().stackedBar({ money: money, segments: portfolio, totalLabel: 'The portfolio, all together' });
      } else if (props.length >= 2) {
        // Panel switch: at two or more properties the groups lead, so no hero.
      } else if (propEquityKnown.length) {
        html += C().figureHero(money(propEquityKnown.reduce((a, b) => a + b, 0)), 'is the equity across your investment', props.length === 1 ? 'property.' : 'properties.');
      } else if (invParts.length) {
        html += C().figureHero(money(invParts.reduce((a, b) => a + b, 0)), 'is held in shares and', 'funds.');
      }
      // The loan against a property lives once: on the property, or as a
      // debts item secured against it. Read it back from the derived
      // equity so both homes for the figure display identically.
      const loanAgainst = (p, i) => {
        if (num(p && p.loan_balance) !== null) return p.loan_balance;
        const eq = num(der.property_equity && der.property_equity[i]);
        const v = num(p && p.value_estimate);
        return (eq !== null && v !== null) ? v - eq : null;
      };
      const USE_LINES = { investment: 'an investment property', holiday: 'a holiday place', other: 'held for another purpose' };
      // Panel switch (ledger): one property renders exactly as approved;
      // two or more render as rows in a group, closed by a subtotal, then
      // the calc block operating on that subtotal.
      if (props.length >= 2) {
        const rows = props.map((p, i) => C().itemRow({
          name: 'Investment property ' + (i + 1),
          line: [USE_LINES[p && p.use] || null, text(p && p.held_in) ? (String(p.held_in).toLowerCase() === 'joint' ? 'held jointly' : 'held in ' + p.held_in) : null].filter(Boolean).join(', ') || null,
          figures: [
            { label: conf(inv, 'Value'), value: money(p && p.value_estimate), missing: money(p && p.value_estimate) === null },
            { label: 'Loan against it', value: money(loanAgainst(p, i)), missing: money(loanAgainst(p, i)) === null },
          ],
          chip: text(p && p.repayment_type) ? String(p.repayment_type).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : null,
        }));
        const totVal = props.map(p => num(p && p.value_estimate)).filter(v => v !== null);
        const totLend = props.map((p, i) => num(loanAgainst(p, i))).filter(v => v !== null);
        html += '<div class="fp-teach"><h4 class="fp-calchead">What each property is worth to you</h4>' +
          C().itemGroup('Investment properties', rows, [
            { label: 'Total value', op: '=', value: totVal.length ? money(totVal.reduce((a, b) => a + b, 0)) : null, missing: !totVal.length },
          ]) +
          C().calcBlock([
            { label: 'Total value', op: '', value: totVal.length ? money(totVal.reduce((a, b) => a + b, 0)) : null, missing: !totVal.length },
            { label: 'Total lending', op: '−', value: totLend.length ? money(totLend.reduce((a, b) => a + b, 0)) : null, missing: !totLend.length },
            { label: 'Total equity', op: '=', value: propEquityKnown.length ? money(propEquityKnown.reduce((a, b) => a + b, 0)) : null, missing: !propEquityKnown.length, result: true },
          ]) + '</div>';
      } else if (props.length === 1) {
        const p = props[0];
        html += '<div class="fp-teach"><h4 class="fp-calchead">What the property is worth to you</h4>' + C().repeatingItems([{
          title: text(p && p.held_in) ? 'Investment property · held in ' + p.held_in : 'Investment property',
          rows: [
            { label: conf(inv, 'Value'), op: '', value: money(p && p.value_estimate), missing: money(p && p.value_estimate) === null },
            { label: 'Loan against it', op: '−', value: money(loanAgainst(p, 0)), missing: money(loanAgainst(p, 0)) === null },
            { label: 'Equity', op: '=', value: num(der.property_equity && der.property_equity[0]) !== null ? money(der.property_equity[0]) : null, missing: num(der.property_equity && der.property_equity[0]) === null, result: true },
          ],
        }], []) + '</div>';
      }
      html += '<div class="fp-teach"><h4 class="fp-calchead">Held outside property</h4>' + statusList([
        [conf(inv, 'Shares and ETFs', 'investments.shares_value'), money(inv.shares_value) ? money(inv.shares_value) + (text(inv.held_in) ? ' · held in ' + text(inv.held_in) : '') : null],
        [conf(inv, 'Managed funds', 'investments.managed_funds_value'), money(inv.managed_funds_value)],
      ]) + '</div>';
      html += refBlock('The rest of the property details', props.length ? props.flatMap((p, i) => [
        ['Rate' + (props.length > 1 ? ', property ' + (i + 1) : ''), rate(p && p.rate_percent)],
        ['Repayment type' + (props.length > 1 ? ', property ' + (i + 1) : ''), text(p && p.repayment_type) ? String(p.repayment_type).replace('_', ' ') : null],
        ['Rent' + (props.length > 1 ? ', property ' + (i + 1) : ''), money(p && p.rent_monthly) ? money(p.rent_monthly) + '/month' : null],
        ['Use' + (props.length > 1 ? ', property ' + (i + 1) : ''), text(p && p.use)],
      ]) : [['Investment properties', null]]);
    }

    else if (tileNo === 8) {
      const items = arr(debts.items);
      // Panel switch: at two or more items the groups lead, so no hero.
      if (items.length < 2 && money(der.debts_total)) {
        html += C().figureHero(money(der.debts_total), 'is owed outside the', 'mortgage.');
      }
      const TYPE_LABELS = {
        home_loan: 'Home loan', investment_property_loan: 'Investment property loan', loan_split: 'Loan split',
        line_of_credit: 'Line of credit', commercial_loan: 'Commercial loan', business_loan: 'Business loan',
        equipment_finance: 'Equipment finance', car_loan: 'Car loan', personal_loan: 'Personal loan',
        credit_card: 'Credit card', bnpl: 'Buy now pay later', hecs_help: 'HECS', tax_debt: 'Tax debt',
        family_loan: 'Family loan', other: 'Other debt',
      };
      const PURPOSE_LINES = {
        owner_occupied: 'the loan on the home', investment_property: 'used for an investment property',
        commercial_property: 'used for a commercial property', investment_shares: 'used to buy shares',
        business_operating: 'used in the business', vehicle: 'used for the car', personal: 'personal spending',
        education: 'used for education', tax: 'a tax debt', mixed: 'mixed use', unknown: 'use not yet recorded',
      };
      const ENTITY_GROUP_LABELS = { company: 'In the company', trust: 'In the trust', smsf: 'In the SMSF', partnership: 'In the partnership' };
      const debtChip = it => it && it.type === 'credit_card' && it.cleared_monthly === true ? 'Cleared monthly'
        : it && it.is_split === true ? 'Split of the home loan' : null;
      const debtRow = it => C().itemRow({
        name: TYPE_LABELS[it && it.type] || 'Debt',
        line: PURPOSE_LINES[it && it.purpose] || null,
        figures: [
          { label: conf(debts, 'Balance'), value: money(it && it.balance), missing: money(it && it.balance) === null },
          { label: 'Rate', value: rate(it && it.rate_percent), missing: rate(it && it.rate_percent) === null },
        ],
        chip: debtChip(it),
      });
      // Panel switch (ledger): one item renders exactly as approved; two
      // or more render as groups of rows — personal and joint borrowing
      // apart from borrowing inside an entity — each closed by its
      // subtotal in the calc grammar.
      if (items.length >= 2) {
        const ENTITY_B = ['company', 'trust', 'smsf', 'partnership'];
        const personal = items.filter(it => it && !ENTITY_B.includes(it.borrower));
        if (personal.length) {
          html += '<div class="fp-teach"><h4 class="fp-calchead">What each one is costing</h4>' +
            C().itemGroup('Yours and joint', personal.map(debtRow), [
              { label: 'Owing, yours and joint', op: '=', value: money(der.debts_total), missing: money(der.debts_total) === null },
            ]) + '</div>';
        }
        for (const eb of ENTITY_B) {
          const group = items.filter(it => it && it.borrower === eb);
          if (!group.length) continue;
          const ebTotal = der.debts_total_by_entity && num(der.debts_total_by_entity[eb]) !== null ? der.debts_total_by_entity[eb] : null;
          html += '<div class="fp-teach">' + C().itemGroup(ENTITY_GROUP_LABELS[eb], group.map(debtRow), [
            { label: 'Owing, ' + ENTITY_GROUP_LABELS[eb].toLowerCase(), op: '=', value: money(ebTotal), missing: money(ebTotal) === null },
          ]) + '</div>';
        }
      } else if (items.length === 1) {
        const it = items[0];
        html += '<div class="fp-teach"><h4 class="fp-calchead">What it is costing</h4>' + C().repeatingItems([{
          title: TYPE_LABELS[it && it.type] || 'Debt',
          rows: [
            { label: conf(debts, 'Balance'), op: '', value: money(it && it.balance), missing: money(it && it.balance) === null },
            { label: 'Rate', op: '', value: rate(it && it.rate_percent), missing: rate(it && it.rate_percent) === null },
            { label: 'Minimum repayment', op: '', value: money(it && it.minimum_monthly) ? money(it.minimum_monthly) + '/month' : null, missing: money(it && it.minimum_monthly) === null },
          ],
        }], []) + '</div>';
      }
      html += refBlock('Held separately', [
        [conf(debts, 'HECS', 'debts.hecs_balance'), money(debts.hecs_balance)],
      ]);
    }

    else if (tileNo === 9) {
      const openItems = arr(der.income_unreconciled);
      if (money(der.income_total_annual) && !openItems.length) {
        html += C().figureHero(money(der.income_total_annual), 'is what comes in across the household each', 'year.');
      }
      const annualKnown = [inc.salary_gross_annual, inc.partner_salary_gross_annual].some(v => num(v) !== null)
        || arr(inc.other).some(o => num(o && o.amount_annual) !== null);
      if (annualKnown) {
        const rows = [];
        if (num(inc.salary_gross_annual) !== null) rows.push({ label: conf(inc, 'Salary'), op: rows.length ? '+' : '', value: money(inc.salary_gross_annual) });
        if (num(inc.partner_salary_gross_annual) !== null) rows.push({ label: conf(inc, 'Partner salary'), op: rows.length ? '+' : '', value: money(inc.partner_salary_gross_annual) });
        for (const o of arr(inc.other)) {
          if (num(o && o.amount_annual) === null) continue;
          const src = o.source || o.type;
          let label = INCOME_SOURCE_LABELS[src] || text(o.label) || String(src || 'Other income').replace(/_/g, ' ');
          // basis renders in the label, never netted silently
          if (o.basis === 'gross') label += ', before costs';
          else if (o.basis === 'net_of_costs') label += ', after costs';
          rows.push({ label: conf(inc, label), op: rows.length ? '+' : '', value: money(o.amount_annual) });
        }
        const totalIncomplete = openItems.length > 0;
        // The total never mixes bases silently: where a gross figure is in
        // the sum, the total says so, and recorded costs render separately,
        // never netted into it.
        const grossInTotal = arr(der.income_total_bases).includes('gross');
        const totalLabel = totalIncomplete ? 'Recorded so far'
          : grossInTotal ? 'Across the year, before costs where marked' : 'Across the year';
        rows.push({ label: totalLabel, op: '=', value: money(der.income_total_annual), missing: money(der.income_total_annual) === null, result: true });
        html += calcSection('How the income is made up', rows);
        if (money(der.income_costs_annual)) {
          html += '<div class="fp-teach"><p class="fp-intro">Costs recorded against those figures: ' + money(der.income_costs_annual) + ' a year, held separately, not netted into the total.</p></div>';
        }
        // The reconciliation pass names what's still open: the total is
        // never presented as complete while a producer has no income entry
        // and no explicit zero against it.
        if (totalIncomplete) {
          html += '<div class="fp-teach"><p class="fp-intro">This isn’t the full picture yet. Still open: ' +
            openItems.map(id => esc(openItemLabel(id, domains))).join('; ') + '.</p></div>';
        }
      } else {
        html += '<div class="fp-teach"><h4 class="fp-calchead">How the income is made up</h4>' + statusList([
          [conf(inc, 'Take-home pay'), money(inc.salary_net_monthly) ? money(inc.salary_net_monthly) + '/month' : null],
          [conf(inc, 'Partner take-home'), money(inc.partner_salary_net_monthly) ? money(inc.partner_salary_net_monthly) + '/month' : null],
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

  /* ══════════ conditional questions (15 Oct 2026) ══════════
     A tile question that shows only when the household's own shape raises
     it. The COPY lives in the library like every other question; only the
     CONDITION lives here, keyed by name, so a new one is a library entry
     plus a predicate and never new prose in code.

     Deliberately NOT an insight: an insight carries the full education
     template (why / what a look can turn up / what most people don't
     realise / how the professional works / nothing to prepare), and that is
     customer-facing copy nobody has signed off. A conditional question is
     one line the person takes to a professional, which is exactly what the
     questions block already is. */
  const QUESTION_CONDITIONS = {
    // Exactly one of the two people holds a given cover type. Silent on a
    // single-adult household (there is no "the other one"), and silent on a
    // type neither of them holds (that is 5.1's territory, not this).
    cover_held_by_one_person_only: (domains) => {
      const d = domains || {};
      const ctx = d.context || {};
      const prot = d.protection || {};
      if (num(ctx.adults) !== null && num(ctx.adults) < 2) return false;
      const bothPresent = num(ctx.adults) !== null ? num(ctx.adults) > 1 : coverOwners(prot, ctx).length > 1;
      if (!bothPresent) return false;
      return COVER_TYPES.some(type => {
        const mine = coverFor(prot, 'you', type);
        const theirs = coverFor(prot, 'partner', type);
        const held = c => !!(c && c.held === true);
        // One holds it, the other has been ASKED and does not: an unanswered
        // cover is not an asymmetry, it is an unknown.
        const answered = c => !!(c && typeof c.held === 'boolean');
        return (held(mine) && answered(theirs) && !held(theirs))
            || (held(theirs) && answered(mine) && !held(mine));
      });
    },
  };

  function conditionalQuestions(tileNo, domains, library) {
    const tileMeta = library && library.tiles && library.tiles[String(tileNo)];
    return arr(tileMeta && tileMeta.conditional_questions)
      .filter(x => x && typeof x.q === 'string')
      .filter(x => {
        const cond = QUESTION_CONDITIONS[x.when];
        if (!cond) {
          console.error('[Finn panels] conditional question on tile ' + tileNo + ' names an unknown condition "' + x.when + '"; it will never show.');
          return false;
        }
        return cond(domains);
      });
  }

  /* ══════════ questions (Devon, 16 Sept 2026) ══════════
     Every tile carries questions worth taking to a professional; a tile
     whose figures raise one for this household carries that one too, on
     its card. They are the person's questions to ask, never Finn's view.
     Copy lives in the library (draft until Devon and Charlie sign it off). */
  function questionsSection(tileNo, library, domains) {
    const tileMeta = library && library.tiles && library.tiles[String(tileNo)];
    const qs = arr(tileMeta && tileMeta.questions).filter(x => x && typeof x.q === 'string')
      .concat(conditionalQuestions(tileNo, domains, library));
    if (!qs.length) return '';
    const pros = (library && library.professionals) || {};
    return '<div class="fp-section fp-questions"><h4 class="fp-calchead">Questions to ask</h4><ul class="fp-qlist">' +
      qs.map(x => '<li><span class="fp-qtext">' + esc(x.q) + '</span>' +
        (pros[x.pro] ? '<span class="fp-qpro">' + esc(pros[x.pro].name) + '</span>' : '') + '</li>').join('') +
      '</ul></div>';
  }

  /* ══════════ where the money goes (tile 2) ══════════
     Categories from a bank export, in a FIXED order (never sorted by size,
     never labelled high or low). Each row is a share of the same total. */
  const SPEND_LABELS = [
    ['groceries', 'Groceries'], ['eating_out', 'Eating out and takeaway'], ['transport', 'Car and transport'],
    ['utilities', 'Power, water, phone and internet'], ['insurance', 'Insurance'], ['health', 'Health and medical'],
    ['kids_education', 'Kids, school and childcare'], ['home_costs', 'Rates, strata and home upkeep'],
    ['shopping', 'Shopping and household'], ['leisure', 'Subscriptions, fitness and leisure'],
    ['travel', 'Travel and holidays'], ['other', 'Everything else'],
  ];
  const listWords = xs => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  /* Tile 2's spending rows ARE Component 2 (absorbed 16 Oct, not replaced:
     finishing the existing component beats building a parallel one). The
     fill moved from --fc-steel, which is reserved for labels on forest and
     is not a data fill, to --fc-fill-2. The surplus row and the net-income
     footer are new; the FIXED category order is unchanged and is the point. */
  function whereItGoes(exp, der, inc) {
    const cats = exp && exp.by_category && typeof exp.by_category === 'object' ? exp.by_category : null;
    if (!cats) {
      if (money(exp && exp.living_monthly)) {
        return '<div class="fp-section fp-where"><h4 class="fp-calchead">Where it goes</h4>' +
          '<p class="fp-range">This figure was given as a total, so there is no breakdown yet. Twelve months of transactions from your accounts and cards would show where it goes.</p></div>';
      }
      return '';
    }
    // SPEND_LABELS order, never sorted by amount.
    const rows = SPEND_LABELS.filter(([k]) => num(cats[k]) !== null && cats[k] > 0)
      .map(([k, label]) => ({ label, value: cats[k], display: money(cats[k]) + '/month' }));
    if (!rows.length) return '';
    const d = der || {};
    const netIn = [ (inc || {}).salary_net_monthly, (inc || {}).partner_salary_net_monthly ]
      .filter(v => num(v) !== null).reduce((a, b) => a + b, 0);
    const chart = C().barRows({
      groups: [{ rows }],
      rule: num(d.surplus_monthly) !== null
        ? { label: "What's left over", value: Math.max(d.surplus_monthly, 0), display: money(d.surplus_monthly) + '/month' }
        : null,
      footer: netIn > 0 ? { label: 'Income in, each month', display: money(netIn) } : null,
    });
    let html = '<div class="fp-section fp-where"><h4 class="fp-calchead">Where it goes</h4>' + chart;
    const notes = [];
    if (num(exp.annual_bills_monthly) !== null && exp.annual_bills_monthly > 0) {
      const named = text(exp.annual_bills_note) ? text(exp.annual_bills_note).split('; ').filter(x => x && x !== 'other yearly bills').slice(0, 3) : [];
      notes.push('About ' + money(exp.annual_bills_monthly) + ' a month of this is once-a-year bills' +
        (named.length ? ' such as ' + esc(listWords(named)) : '') + ', spread across the year.');
    }
    if (num(exp.one_off_monthly) !== null && exp.one_off_monthly > 0) {
      notes.push('About ' + money(exp.one_off_monthly) + ' a month of it was one-off spending. It stays in, because every year has something like it.');
    }
    if (num(exp.coverage_months) !== null) {
      notes.push(exp.coverage_months < 11
        ? 'Built from ' + exp.coverage_months + ' months of transactions, so some once-a-year costs may not be in it yet.'
        : 'Built from ' + Math.round(exp.coverage_months) + ' months of transactions across your accounts and cards.');
    }
    if (notes.length) html += '<p class="fp-range">' + notes.join(' ') + '</p>';
    return html + '</div>';
  }

  /* ══════════ insights as gap cards ══════════ */

  function gapCardFor(insight, entry, domains, derived, library, costHtml) {
    const pos = fillPositionLine(entry.position_line, domains, derived);
    let body = '';
    // The personal question leads the card; the insight's own title then
    // introduces the explanation underneath.
    if (entry.question && entry.title) body += '<p class="fp-intro">' + esc(entry.title) + '</p>';
    if (entry.intro && !isPlaceholder(entry.intro)) body += '<p class="fp-intro">' + esc(entry.intro) + '</p>';

    const HEADINGS = {
      why: 'Why this question matters',
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

    // PART A (16 Oct): NO ROUTE AS AN ACTION INSIDE A TILE. The tile shows
    // figures; the conversation layer below does the routing. An action here
    // produced one referral per insight, so a household with nine findings
    // got nine buttons. The action, the cost pill and the cost line now live
    // once per professional block in renderWhoToSee, not once per item.
    const pro = entry.route_primary && library.professionals && library.professionals[entry.route_primary];
    return C().gapCard({
      id: entry.id,
      headline: entry.question || entry.title || '',
      hook: pos || '',
      // A LABEL, NOT A LINK: the professional's name alone, so the person can
      // see which conversation below this tile feeds. No cost here; cost is
      // said once per block rather than twice.
      chip: pro ? pro.name : '',
      bodyHtml: body,
    });
  }

  /* The calm state (component-spec 4.2, education-library 6.2): renders in
     place of the insight stack when a tile has figures and zero insights.
     Only tiles 1, 4, 6 and 9 can go calm and carry a block; the other five
     can never go calm, so no block is expected for them. Never a tick,
     never green — the component enforces the palette. */
  function calmSection(tileNo, tileResult, domains, library) {
    if (!tileResult || tileResult.insights.length) return '';
    if (!tileReached(tileNo, domains)) return ''; // still building, not calm
    const tileMeta = library && library.tiles && library.tiles[String(tileNo)];
    if (!tileMeta || !tileMeta.calm) return '';
    const html = C().calmBlock(tileMeta.calm);
    return html ? '<div class="fp-section fp-calmwrap">' + html + '</div>' : '';
  }

  function insightsSection(tileResult, domains, derived, library) {
    if (!tileResult || !tileResult.insights.length) return '';
    const all = [].concat(arr(library && library.insights), arr(library && library.overrides));
    // PART A: no cost pill and no cost line inside a tile. Both now render
    // once per professional block in the conversation layer, so cost is
    // stated once rather than on every tile that happens to route there.
    const cards = tileResult.insights
      .map(ins => {
        const entry = all.find(e => e.id === ins.id);
        if (!entry) return '';
        return gapCardFor(ins, entry, domains, derived, library, '');
      })
      .filter(Boolean);
    return '<div class="fp-section fp-insights"><h4 class="fp-calchead">Questions for your situation</h4>' +
      C().stepRail(cards) + '</div>';
  }

  /* ══════════ THE CONVERSATION LAYER ══════════ (reworked 16 Oct)
     One section below the tile grid. Every insight that fired for this
     household, grouped by the professional they would be talking to, so
     nine findings become three conversations instead of nine buttons.

     THE RULES, AS RULES:

     1. ORDER IS FIXED, NOT SCORED. PRO_ORDER below is a hardcoded array,
        identical for every household whatever fired. It is never sorted by
        severity, size, urgency, confidence, item count, or anything else
        derived from the household's data. A relevance ranking is a
        statement about what matters most in this person's situation, and
        that is a judgment Finn does not make (field-spec 3.5).
     2. Items inside a block run in ascending TILE order, 1 to 9.
     3. A professional with zero items renders NOTHING. No empty state.
     4. WHEN NOTHING ROUTES, THE WHOLE SECTION IS ABSENT. No heading, no
        message, no placeholder. A sentence saying nothing needs attention
        is an overall verdict on the household's position, and Finn never
        gives one (locked, June 2026). Absence is not a verdict; a
        reassuring sentence is.
     5. The cost line and the action render ONCE PER BLOCK, never per item.
        That is what moved out of the tiles.
     6. HARDSHIP IS NEVER MONETISED. Where flags.hardship is true the
        financial counsellor replaces the broker block's debt items and
        renders as its own block, ABOVE every paid block. The counsellor is
        deliberately NOT in PRO_ORDER: it is free, it is not part of the paid
        ordering, and free help does not sit underneath two paid referrals. */
  const PRO_ORDER = ['mortgage_broker', 'financial_planner', 'accountant', 'estate_lawyer'];
  const THINGS = { 1: 'One thing', 2: 'Two things', 3: 'Three things', 4: 'Four things', 5: 'Five things', 6: 'Six things', 7: 'Seven things', 8: 'Eight things', 9: 'Nine things' };
  // A count of items, never a score and never a denominator.
  const thingsWord = (n) => THINGS[n] || (n + ' things');
  const DEBT_TILE = 8;

  function renderWhoToSee(triggersResult, library) {
    const all = [].concat(arr(library && library.insights), arr(library && library.overrides));
    const pros = (library && library.professionals) || {};
    const tiles = (library && library.tiles) || {};
    const hardship = !!(triggersResult && triggersResult.hardship);

    // Everything that fired, carrying the tile it came from.
    const fired = [];
    for (const t of arr(triggersResult && triggersResult.tiles)) {
      if (!t.visible) continue;
      for (const ins of arr(t.insights)) {
        const entry = all.find(e => e.id === ins.id);
        if (entry) fired.push({ entry, tile: t.tile });
      }
    }

    // Group by the professional. no_referral entries route nowhere.
    const byPro = {};
    for (const f of fired) {
      const e = f.entry;
      if (e.no_referral || !e.route_primary) continue;
      if (!byPro[e.route_primary]) byPro[e.route_primary] = [];
      byPro[e.route_primary].push(f);
    }

    // RULE 6. The trigger engine already suppresses 8.1a/8.1b under
    // hardship; this makes the rule explicit here too, so it holds however
    // the engine changes and so it reads as a rule.
    if (hardship && byPro.mortgage_broker) {
      byPro.mortgage_broker = byPro.mortgage_broker.filter(f => f.tile !== DEBT_TILE);
      if (!byPro.mortgage_broker.length) delete byPro.mortgage_broker;
    }

    // RULE 2.
    for (const k of Object.keys(byPro)) byPro[k].sort((a, b) => a.tile - b.tile);

    // RULES 1 and 3: the fixed array decides order; empty blocks never appear.
    const blocks = [];
    for (const id of PRO_ORDER) {
      if (byPro[id] && byPro[id].length) blocks.push([id, byPro[id]]);
    }
    // RULE 6, second half: THE COUNSELLOR GOES FIRST. Free help for someone
    // in hardship does not sit underneath two paid referrals. This is a
    // fixed rule, not a score: it applies identically to every household
    // carrying the flag and is derived from no figure.
    if (byPro.financial_counsellor && byPro.financial_counsellor.length) {
      blocks.unshift(['financial_counsellor', byPro.financial_counsellor]);
    }

    // RULE 4.
    if (!blocks.length) return '';

    let html = '<div class="fc fp-who">';
    html += C().trustBanner(
      "<b>Finn is paid by the professionals on our list.</b> What they can't do is buy their way onto it. We meet everyone first, and if we wouldn't send our own family to them, they're not there. " +
      "There's nothing you need to prepare. Finn sends your whole picture ahead, so you're not sitting there trying to explain a situation you've never had laid out before. " +
      '<span class="steel">Whoever you see, you turn up understood.</span>');

    for (const [proId, items] of blocks) {
      const pro = pros[proId];
      if (!pro) continue;
      const itemsHtml = items.map(({ entry, tile }) => {
        const alsoNames = arr(entry.route_also).map(id => pros[id] && pros[id].name).filter(Boolean);
        const tileMeta = tiles[String(tile)];
        // The education is the library's own, rendered unchanged.
        const edu = entry.blocks && entry.blocks.why && !isPlaceholder(entry.blocks.why)
          ? C().renderCopy(entry.blocks.why) : '';
        return C().professionalItem(entry.question || entry.title || entry.id, alsoNames, {
          tileName: tileMeta ? tileMeta.title : '',
          eduHtml: edu,
        });
      }).join('');
      const action = items.map(i => i.entry).find(e => e.action_label);
      html += C().professionalCard({
        name: pro.name,
        role: pro.role,
        count: thingsWord(items.length),
        why: pro.why_together,
        itemsHtml,
        cost_pill: pro.cost_pill,
        cost_line: pro.cost_line,
        actionHtml: action ? C().actionZone(action.action_label) : '',
      });
    }

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
    // Density (ledger, Sept 2026): the mechanic collapses behind a quiet
    // "How this works" affordance, open by default only on a tile's FIRST
    // visit, remembered per household in household_ui_state (the host page
    // passes opts.sectionBOpen). The copy is unchanged, only its default
    // state — and nothing is ever collapsed or expanded because of what
    // the person's number is.
    if (tileMeta && tileMeta.section_b && !isPlaceholder(tileMeta.section_b)) {
      const openAttr = o.sectionBOpen === false ? '' : ' open';
      html += '<details class="fp-section fp-b"' + openAttr + '><summary class="fp-howthis">How this works</summary>' +
        '<div class="fp-bbody"><h4 class="fp-calchead">What these products actually do</h4><p>' + esc(tileMeta.section_b) + '</p></div></details>';
    }
    html += insightsSection(tileResult, domains, derived, library);
    html += calmSection(tileNo, tileResult, domains, library);
    html += questionsSection(tileNo, library, domains);
    html += '</article>';
    return html;
  }

  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  /* A person's given name, or nothing. (15 Oct: the header rendered
     "test-household-c, 42, and your partner, 40" — a household label sitting
     in the person slot. The page reads members.display_name, which is the
     right field, but that row can hold a household-style label, and on a
     real account the same path would read "The Soutars, 42".)

     So the slot accepts a candidate only if it looks like a given name: no
     digits, no organisation or household words, no slug punctuation. The
     household record's display_name is never consulted for this slot at
     all; this guard is the second line, for when the member's own field
     holds something that is not a person. Anything rejected falls through
     to the library default. */
  const NOT_A_PERSON = /(\d|[_\/]|\b(household|family|trust|pty|ltd|limited|inc|the\s+\w+s)\b)/i;
  function personName(v) {
    const s = text(v);
    if (!s) return null;
    const first = s.trim().split(/\s+/)[0];
    if (!first || !/[a-z]/i.test(first)) return null;
    if (NOT_A_PERSON.test(s) || first.includes('-')) {
      console.error('[Finn panels] "' + s + '" does not read as a person\'s name; the context header will say "You" rather than put it in the person slot.');
      return null;
    }
    return first;
  }

  /* ── the household context header ── (flagged August, built 15 Oct;
     copy moved into finn-library.json 15 Oct)
     The FRAME the nine tiles sit inside, not a tenth tile. It carries no
     badge, no status, no routing and no "questions to ask": it never flags
     anything. EVERY WORD COMES FROM THE LIBRARY, like the insight position
     lines: this function chooses which clauses apply and fills their slots,
     and composes nothing. Without the library there is no approved copy, so
     it renders nothing rather than improvising.

     Names are NOT picture fields (the registry holds no name), so a caller
     that has them from the household record may pass
     { ownerName, partnerName }; without them the library default is used. */
  function fillClause(clause, slots) {
    if (!clause || !clause.template) return null;
    let ok = true;
    const out = clause.template.replace(/\{(\w+)\}/g, (_, name) => {
      const v = slots[name];
      if (v === null || v === undefined || v === '') { ok = false; return ''; }
      return String(v);
    });
    return ok ? out : null;
  }

  function contextHeader(domains, opts) {
    const o = opts || {};
    const lib = (o.library && o.library.context) || null;
    if (!lib || !lib.clauses) {
      console.error('[Finn panels] finn-library.json has no "context" copy: the header renders nothing rather than improvising words.');
      return '';
    }
    const C = lib.clauses;
    const D = lib.defaults || {};
    const joiner = lib.ages_joiner || { separator: ', ', final: ' and ' };
    const c = (domains || {}).context || {};
    const parts = [];
    const push = s => { if (s) parts.push(s); };

    // Who, with ages where they are known. The partner's name IS a picture
    // field (context.partner_name, captured for exactly this), so it comes
    // first; an opts name is the fallback for a caller that has one, and the
    // library default is the last resort. (15 Oct: the header said "your
    // partner" while the picture held "Jess".)
    const ownerName = personName(o.ownerName) || D.owner;
    const partnerName = text(c.partner_name) || personName(o.partnerName) || null;
    const ownerAge = num(c.owner_age);
    const partnerAge = num(c.partner_age);
    const adults = num(c.adults);
    const person = (name, yrs) => yrs !== null
      ? fillClause(C.person_with_age, { name, age: yrs })
      : fillClause(C.person_without_age, { name });
    if (partnerName || (adults !== null && adults > 1) || partnerAge !== null) {
      push(fillClause(C.two_people, {
        first: person(ownerName, ownerAge),
        second: person(partnerName || D.partner, partnerAge),
      }));
    } else if (ownerAge !== null || personName(o.ownerName)) {
      push(fillClause(C.one_person, { first: person(ownerName, ownerAge) }));
    }

    // Children, by age, only where an age is recorded.
    const kids = Array.isArray(c.children) ? c.children.map(k => num(k && k.age)).filter(a => a !== null) : [];
    if (kids.length === 1) push(fillClause(C.one_child, { age: kids[0] }));
    else if (kids.length > 1) {
      const counts = lib.counts || {};
      push(fillClause(C.several_children, {
        count: counts[String(kids.length)] || kids.length,
        ages: kids.slice(0, -1).join(joiner.separator) + joiner.final + kids[kids.length - 1],
      }));
    }

    // Work, and the timeframe they think in, in their own terms.
    const intent = text(c.work_intent);
    if (intent) push(/[.!?]$/.test(intent) ? cap(intent) : fillClause(C.work_intent, { intent: cap(intent) }));
    const horizon = num(c.horizon_years);
    if (horizon !== null) push(fillClause(C.horizon, { years: horizon }));

    if (!parts.length) return '';
    return '<div class="fp-context"><p class="fp-contextline">' + esc(parts.join(' ')) + '</p></div>';
  }

  // A missing finn-derived.js used to render an empty dashboard in silence,
  // which reads as "nothing recorded" rather than as a fault. The fallback
  // stays, but a load-order regression now says so plainly. (15 Oct)
  function deriveOrWarn(domains) {
    if (window.finnDerived && typeof window.finnDerived.derive === 'function') return window.finnDerived.derive(domains);
    console.error('[Finn panels] window.finnDerived is missing: finn-derived.js must load before the dashboard renders. Rendering with no derived figures.');
    return {};
  }

  // Item 6 (15 Oct): the same silence as the derived fallback. An absent
  // finn-triggers.js rendered a dashboard with no tiles at all, which reads
  // as a household with nothing in it. The fallback stays; the fault is loud.
  function evaluateOrWarn(domains, o) {
    if (window.finnTriggers && typeof window.finnTriggers.evaluate === 'function') {
      return window.finnTriggers.evaluate(domains, { yearNow: o.yearNow, derived: o.derived });
    }
    console.error('[Finn panels] window.finnTriggers is missing: finn-triggers.js must load before the dashboard renders. Rendering with no tiles.');
    return { tiles: [] };
  }

  function renderDashboard(domains, opts) {
    const o = opts || {};
    const derived = o.derived || deriveOrWarn(domains);
    const triggers = o.triggers || evaluateOrWarn(domains, { yearNow: o.yearNow, derived });
    let html = '<div class="fp-dashboard">' + contextHeader(domains, o);
    for (const t of triggers.tiles) {
      if (!t.visible) continue;
      html += renderTile(t.tile, domains, derived, t, o.library, o);
    }
    html += '</div>';
    return html;
  }

  /* ══════════ the tile grid's badge, pointer and headline ══════════
     Moved out of app/clarity/index.html (run 11) so the suites cover them. */
  // The badge reports the gathering, never the money. The colour class
  // (flag / calm / building) is unchanged; the words come from `reached`.
  function badgeLabel(complete) { return complete ? 'Complete' : 'Still gathering'; }
  // "Complete" means CODE counts every collection area behind the tile as
  // covered (picture.completed_domains, written by the plan), never merely
  // that something was said (live walk, 17 Sept 2026: "both employed" made
  // the income tile read Complete with no figures).
  const TILE_AREAS = { 1: ['assets', 'liabilities'], 2: ['income'], 3: ['buffer'], 4: ['super'], 5: ['protection'], 6: ['estate'], 7: ['assets'], 8: ['liabilities'], 9: ['income'] };
  /* A tile is COMPLETE only when its areas are covered AND the figure the
     tile exists to show can actually be computed. (16 Oct, Devon's walk on
     production: "What's left over each month" carried a Complete badge over
     a body reading "Still gathering", because TILE_AREAS maps tile 2 to the
     INCOME area while its figure, surplus_monthly, needs expenses too. The
     household had given income and no spending, so the areas were covered
     and the figure was not computable.)

     Keying the badge off the same headline the body renders means the two
     can no longer disagree: no headline, no Complete. */
  function tileComplete(tileNo, picture, domains, derived) {
    const done = Array.isArray(picture && picture.completed_domains) ? picture.completed_domains : [];
    const need = TILE_AREAS[tileNo] || [];
    if (!(need.length > 0 && need.every(a => done.includes(a)))) return false;
    // Called without the picture's figures (older callers, and the badge
    // tests): fall back to the areas alone rather than reporting false.
    if (domains === undefined && derived === undefined) return true;
    return tileHeadline(tileNo, domains || {}, derived || {}) !== null;
  }
  function questionPointer(count) {
    return count > 0
      ? { text: count + (count === 1 ? ' question' : ' questions') + ' for your situation', cls: 'route' }
      : { text: 'Questions to ask', cls: 'route neutral' };
  }

  // Compact headline per tile for the grid card. Deterministic formatting of
  // captured facts and read-time derivations only — never a characterisation.
  function tileHeadline(tileNo, d, der) {
    const home = d.home || {}, inc = d.income || {}, exp = d.expenses || {};
    const buf = d.buffer || {}, sup = d.super || {}, inv = d.investments || {};
    const debts = d.debts || {}, prot = d.protection || {}, est = d.estate || {};
    if (tileNo === 1) {
      if (num(der.home_equity) !== null) return { metric: money(der.home_equity), unit: 'equity in the home', facts: money(home.mortgage_balance) + ' owing' + (num(home.rate_percent) !== null ? ' at ' + home.rate_percent + '%' : '') };
      if (num(home.value_estimate) !== null) return { metric: money(home.value_estimate), unit: 'home value', facts: '' };
      return null;
    }
    if (tileNo === 2) {
      if (num(der.surplus_monthly) !== null) {
        const inTotal = [inc.salary_net_monthly, inc.partner_salary_net_monthly].filter(v => num(v) !== null).reduce((a, b) => a + b, 0);
        return { metric: money(der.surplus_monthly), unit: '/month left over', facts: money(inTotal) + ' in each month' };
      }
      if (num(exp.living_monthly) !== null) return { metric: money(exp.living_monthly), unit: '/month living costs', facts: '' };
      return null;
    }
    if (tileNo === 3) {
      if (num(der.buffer_months) !== null) return { metric: der.buffer_months + (der.buffer_months === 1 ? ' month' : ' months'), unit: 'cover if income paused', facts: num(buf.accessible_savings) !== null ? 'accessible savings ' + money(buf.accessible_savings) : '' };
      if (num(buf.accessible_savings) !== null) return { metric: money(buf.accessible_savings), unit: 'accessible savings', facts: '' };
      return null;
    }
    if (tileNo === 4) {
      const n = Array.isArray(sup.funds) ? sup.funds.length : 0;
      if (num(der.super_total) !== null) return { metric: money(der.super_total), unit: n > 1 ? 'total across ' + n + ' accounts' : 'in super', facts: sup.extra_contributions === true ? 'extra contributions' : '' };
      if (n) return { metric: n + (n === 1 ? ' account' : ' accounts'), unit: '', facts: '' };
      if (sup.multiple_accounts === true) return { metric: 'more than one account', unit: 'details still to gather', facts: '' };
      return null;
    }
    if (tileNo === 5) {
      // Cover is per person (Devon, 17 Sept): count each person's, and say
      // whose has none. The four legacy objects still count as the person's.
      const WORDS = { life: 'life', tpd: 'TPD', income_protection: 'income protection', trauma: 'trauma' };
      const list = Array.isArray(prot.covers) ? prot.covers.filter(c => c && typeof c === 'object') : [];
      const legacy = ['life', 'tpd', 'income_protection', 'trauma']
        .filter(k => prot[k] && typeof prot[k] === 'object')
        .map(k => ({ owner: 'you', type: k, ...prot[k] }));
      const all = list.length ? list : legacy;
      const answered = all.filter(c => c.held === true || c.held === false);
      if (!answered.length) return null;
      const held = answered.filter(c => c.held === true);
      const owners = [...new Set(answered.map(c => c.owner || 'you'))];
      const name = o => o === 'partner' ? (d.context && d.context.partner_name ? d.context.partner_name : 'your partner') : 'you';
      const noneFor = owners.filter(o => !held.some(c => (c.owner || 'you') === o));
      const facts = noneFor.length
        ? 'no cover recorded for ' + noneFor.map(name).join(' or ')
        : owners.map(o => name(o) + ': ' + held.filter(c => (c.owner || 'you') === o).map(c => WORDS[c.type] || c.type).join(', ')).join(' · ');
      return { metric: held.length + ' cover' + (held.length === 1 ? '' : 's') + ' in place', unit: owners.length > 1 ? 'across both of you' : '', facts };
    }
    if (tileNo === 6) {
      /* NO COUNT, NO DENOMINATOR, NO SCORE (Devon, 16 Oct). This used to sum
         the three documents together with one entry per super fund carrying a
         nomination, so a household with three documents in place and three
         funds with nominations read "6 in place": two different kinds of fact
         added into one figure, and more super accounts scoring higher on what
         reads as estate documents. The documents are now named individually
         with their own state, and nominations are a separate line counted
         against the funds in the picture rather than any Finn-set target. */
      const docState = (doc) => {
        if (!doc || typeof doc !== 'object' || doc.in_place === null || doc.in_place === undefined) return 'not recorded';
        if (doc.in_place === true) return 'in place';
        if (doc.in_place === false) return 'not in place';
        if (doc.in_place === 'unsure') return 'not sure';
        if (doc.in_place === 'na') return 'not applicable';
        return 'not recorded';
      };
      const NAMED = [['Will', est.will], ['enduring power of attorney', est.poa], ['guardianship', est.guardianship]];
      const docLine = NAMED.map(([label, doc]) => label + ' ' + docState(doc)).join(' · ');

      // Nominations, against the accounts actually in the picture.
      const WORD = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };
      const funds = Array.isArray(sup.funds) ? sup.funds.filter(f => f && typeof f === 'object') : [];
      const withNom = funds.filter(f => f.nomination && f.nomination.in_place === true).length;
      let nomLine = '';
      if (funds.length === 0) {
        // No accounts in the picture: the household-level field is all there is.
        const hh = docState(est.super_nomination);
        nomLine = hh === 'not recorded' ? '' : 'Super nomination: ' + hh;
      } else if (withNom === 0) {
        nomLine = 'Super nominations: none recorded';
      } else if (withNom === funds.length) {
        nomLine = funds.length === 1
          ? 'Super nominations: your account has one'
          : 'Super nominations: all ' + (WORD[funds.length] || funds.length) + ' accounts have one';
      } else {
        nomLine = 'Super nominations: ' + (WORD[withNom] || withNom) + ' of your ' +
          (WORD[funds.length] || funds.length) + ' accounts have one';
      }

      // Nothing asked at all: the tile says it is still gathering.
      const anyDoc = NAMED.some(([, doc]) => docState(doc) !== 'not recorded');
      if (!anyDoc && !nomLine) return null;
      return { metric: docLine, unit: '', facts: nomLine };
    }
    if (tileNo === 7) {
      const props = Array.isArray(inv.properties) ? inv.properties : [];
      const holdings = [inv.shares_value, inv.managed_funds_value].filter(v => num(v) !== null);
      const total = holdings.length ? holdings.reduce((a, b) => a + b, 0) : null;
      const bits = [];
      if (props.length) bits.push(props.length + (props.length === 1 ? ' investment property' : ' investment properties'));
      if (total !== null) return { metric: money(total), unit: 'in shares and funds', facts: bits.join(' · ') };
      if (props.length) return { metric: bits[0], unit: '', facts: num(props[0].value_estimate) !== null ? 'valued around ' + money(props[0].value_estimate) : '' };
      return null;
    }
    if (tileNo === 8) {
      if (num(der.debts_total) !== null) {
        const n = debts.items.length;
        return { metric: money(der.debts_total), unit: 'across ' + n + (n === 1 ? ' item' : ' items'), facts: num(debts.hecs_balance) !== null && debts.hecs_balance > 0 ? 'HECS held separately' : '' };
      }
      return null;
    }
    if (tileNo === 9) {
      const structure = inc.structure != null ? ({ paye: 'salary (PAYE)', sole_trader: 'sole trader', company: 'through a company', trust: 'through a trust', mixed: 'salary + self-employed' })[inc.structure] || inc.structure : null;
      if (num(der.income_total_annual) !== null) return { metric: money(der.income_total_annual), unit: '/yr household', facts: structure || '' };
      const netTotal = [inc.salary_net_monthly, inc.partner_salary_net_monthly].filter(v => num(v) !== null);
      if (netTotal.length) return { metric: money(netTotal.reduce((a, b) => a + b, 0)), unit: '/month take-home', facts: structure || '' };
      if (structure) return { metric: structure, unit: '', facts: '' };
      return null;
    }
    return null;
  }

  window.finnPanels = { renderDashboard, renderTile, renderWhoToSee, tileReached, fillPositionLine, slotValues, badgeLabel, tileComplete, questionPointer, tileHeadline, contextHeader, conditionalQuestions };
})();
