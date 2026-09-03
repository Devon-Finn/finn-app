/* Panel components — field-spec Part 5 step 5, sections A/B/C per the
   education library's display rules (docs/education-library.md, Part One §2).

   Rules enforced in code, because they carry the advice line:
   - Section A is figures, not findings. A missing value renders as
     "none recorded" (bold allowed), NEVER as zero — the person never
     confirmed a zero. No colour, no icons, no progress bars, no score with
     a denominator.
   - Section B is the library's mechanics copy, verbatim. Blocks marked
     [Not provided ...] do not render.
   - Section C insight units render the position line by SLOT SUBSTITUTION
     ONLY. If any slot cannot be filled from the data, the position line is
     OMITTED rather than composed — the renderer never writes its own
     characterisation of a situation. Education blocks render verbatim under
     their fixed headings; block_style "single" renders the one block with
     no heading; block_style "inline_headings" renders blocks without the
     template headings (the copy carries its own), with the entry's intro
     first.
   - Everything here is deterministic formatting. No model call anywhere.

   Exposed as window.finnPanels:
     renderDashboard(domains, {yearNow, derived, triggers, library}) -> html
     renderTile(tileNo, domains, derived, tileResult, library) -> html
   library is the parsed finn-library.json object. */
(function () {
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const arr = v => Array.isArray(v) ? v : [];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NONE = '<strong>none recorded</strong>';

  // Negative values render as "-$354" (tile 2's Section A can legitimately
  // show a negative surplus; display is broader than triggering).
  const money = v => num(v) !== null
    ? (Math.round(v) < 0 ? '-$' + Math.abs(Math.round(v)).toLocaleString('en-AU') : '$' + Math.round(v).toLocaleString('en-AU'))
    : null;
  const rate = v => num(v) !== null ? v + '%' : null;
  const text = v => (typeof v === 'string' && v.trim()) ? esc(v.trim()) : null;
  const show = v => v === null || v === undefined ? NONE : v;

  const isPlaceholder = s => typeof s === 'string' && s.startsWith('[Not provided');

  // ── Deterministic display formatters (formatting, never characterisation) ──

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
    paye: 'salary (PAYE)',
    sole_trader: 'sole trader income',
    company: 'income through a company',
    trust: 'income through a trust',
    mixed: 'a mix of salary and self-employed income',
  };

  // ── Position-line slot resolution ──

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
    const invTotal = [inv.shares_value, inv.managed_funds_value]
      .filter(v => num(v) !== null).reduce((a, b) => a + b, 0);
    const invTotalKnown = [inv.shares_value, inv.managed_funds_value].some(v => num(v) !== null);

    return {
      rate_percent: num(home.rate_percent),
      rate_type: text(home.rate_type),
      lender: text(home.lender),
      with_lender_since: text(home.with_lender_since) ?? (num(home.with_lender_since) !== null ? String(home.with_lender_since) : null),
      offset_balance: money(home.offset_balance),
      mortgage_balance: money(home.mortgage_balance),
      home_equity: money(der.home_equity),
      lvr_percent: num(der.lvr_percent),
      surplus_monthly: money(der.surplus_monthly),
      buffer_months: num(der.buffer_months),
      accessible_savings: money(buf.accessible_savings),
      where_held: text(buf.where_held),
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
      investments_total_display: invTotalKnown ? money(invTotal) : null,
      held_in: text(inv.held_in),
      debts_total: money(der.debts_total),
      debt_count_display: arr(debts.items).length > 0 ? String(debts.items.length) : null,
      structure_display: (function () {
        const base = inc.structure != null ? STRUCTURE_LABELS[inc.structure] || text(inc.structure) : null;
        if (base === null) return null;
        return inc.entity && inc.entity.type ? base + ', with a ' + esc(inc.entity.type) + ' in the picture' : base;
      })(),
    };
  }

  // Fill a template; ANY unresolved slot omits the whole line (never compose,
  // never render "null" into a fixed sentence). For the protection/estate
  // _display slots a null cover means the domain slice was not reached and
  // "none recorded" fills legitimately — those resolve to undefined only when
  // the value object itself is malformed.
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

  // ── Section A per-tile figure layouts ──

  function row(label, value) {
    return '<div class="fp-row"><span class="fp-label">' + esc(label) + '</span><span class="fp-value">' + show(value) + '</span></div>';
  }

  function sectionA(tileNo, d, der) {
    const home = d.home || {}, inc = d.income || {}, exp = d.expenses || {};
    const buf = d.buffer || {}, sup = d.super || {}, inv = d.investments || {};
    const debts = d.debts || {}, prot = d.protection || {}, est = d.estate || {};
    const ctx = d.context || {};
    const rows = [];

    if (tileNo === 1) {
      rows.push(row('Property value' + (text(home.value_source) ? ' (' + text(home.value_source) + ')' : ''), money(home.value_estimate)));
      rows.push(row('Loan balance', money(home.mortgage_balance)));
      rows.push(row('Equity', money(der.home_equity)));
      rows.push(row('Rate', rate(home.rate_percent) !== null ? rate(home.rate_percent) + (text(home.rate_type) ? ' · ' + text(home.rate_type) : '') : null));
      rows.push(row('Lender', text(home.lender) !== null ? text(home.lender) + (text(home.with_lender_since) ? ', since ' + text(home.with_lender_since) : '') : null));
      rows.push(row('Repayment', money(home.repayment_monthly) !== null ? money(home.repayment_monthly) + '/month' : null));
      rows.push(row('Offset balance', home.has_offset === false ? 'no offset on this loan' : money(home.offset_balance)));
      rows.push(row('Term remaining', num(home.term_remaining_years) !== null ? home.term_remaining_years + ' years' : null));
    } else if (tileNo === 2) {
      rows.push(row('Take-home pay', money(inc.salary_net_monthly) !== null ? money(inc.salary_net_monthly) + '/month' : null));
      rows.push(row('Partner take-home', money(inc.partner_salary_net_monthly) !== null ? money(inc.partner_salary_net_monthly) + '/month' : null));
      rows.push(row('Living costs', money(exp.living_monthly) !== null ? money(exp.living_monthly) + '/month' + (exp.includes_housing === true ? ' · includes housing' : '') : null));
      if (exp.includes_housing !== true) rows.push(row('Housing repayment', money(exp.housing_repayment_monthly) !== null ? money(exp.housing_repayment_monthly) + '/month' : null));
      rows.push(row('Left over', money(der.surplus_monthly) !== null ? money(der.surplus_monthly) + '/month' : null));
    } else if (tileNo === 3) {
      rows.push(row('Accessible savings', money(buf.accessible_savings)));
      rows.push(row('Monthly living costs', money(exp.living_monthly) !== null ? money(exp.living_monthly) + '/month' + (exp.includes_housing === true ? ' · includes housing' : '') : null));
      rows.push(row('Cover', num(der.buffer_months) !== null ? der.buffer_months + ' months' : null));
      rows.push(row('Where it sits', text(buf.where_held) !== null ? text(buf.where_held) + (buf.linked_to_loan === true ? ', linked to the loan' : buf.linked_to_loan === false ? ', not linked to the loan' : '') : null));
    } else if (tileNo === 4) {
      const funds = arr(sup.funds);
      if (funds.length) {
        for (const f of funds) {
          const label = (text(f && f.fund) || 'Fund') + (text(f && f.owner) ? ' (' + text(f.owner) + ')' : '');
          const val = money(f && f.balance) !== null
            ? money(f.balance) + (f.has_insurance === true ? ' · insurance inside' : f.has_insurance === false ? ' · no insurance inside' : '')
            : null;
          rows.push(row(label, val));
        }
        rows.push(row('Total', money(der.super_total)));
      } else {
        rows.push(row('Super accounts', sup.multiple_accounts === true ? 'more than one account mentioned, details not yet gathered' : null));
      }
      rows.push(row('Extra contributions', sup.extra_contributions === true ? 'yes' : sup.extra_contributions === false ? 'no' : null));
    } else if (tileNo === 5) {
      rows.push(row('Life cover', coverDisplay(prot.life)));
      rows.push(row('TPD cover', coverDisplay(prot.tpd)));
      rows.push(row('Income protection', coverDisplay(prot.income_protection)));
      rows.push(row('Trauma cover', coverDisplay(prot.trauma)));
      const kids = arr(ctx.children);
      const hh = [];
      if (num(ctx.adults) !== null) hh.push(ctx.adults + (ctx.adults === 1 ? ' adult' : ' adults'));
      if (kids.length) hh.push(kids.length + (kids.length === 1 ? ' child' : ' children') + (kids.every(c => c && num(c.age) !== null) ? ' aged ' + kids.map(c => c.age).join(' and ') : ''));
      rows.push(row('Household', hh.length ? hh.join(', ') : null));
      rows.push(row('Mortgage outstanding', d.home && d.home.owns_home === false ? 'no mortgage' : money(home.mortgage_balance)));
    } else if (tileNo === 6) {
      rows.push(row('Will', estateDisplay(est.will)));
      rows.push(row('Enduring power of attorney', estateDisplay(est.poa)));
      rows.push(row('Guardianship for the children', estateDisplay(est.guardianship)));
      rows.push(row('Super death benefit nomination', (function () {
        const base = estateDisplay(est.super_nomination);
        if (base === null) return null;
        const n = est.super_nomination;
        return n && n.in_place === true && typeof n.binding === 'boolean' ? base + (n.binding ? ' · binding' : ' · non-binding') : base;
      })()));
      const kids = arr(ctx.children);
      if (kids.length) rows.push(row('Household', kids.length + (kids.length === 1 ? ' child' : ' children') + (kids.every(c => c && num(c.age) !== null) ? ', aged ' + kids.map(c => c.age).join(' and ') : '')));
    } else if (tileNo === 7) {
      const props = arr(inv.properties);
      props.forEach((p, i) => {
        const name = 'Investment property' + (props.length > 1 ? ' ' + (i + 1) : '');
        rows.push(row(name, money(p && p.value_estimate) !== null ? money(p.value_estimate) + ' estimated value' : null));
        rows.push(row('  Loan against it', money(p && p.loan_balance) !== null ? money(p.loan_balance) + (rate(p.rate_percent) !== null ? ', ' + rate(p.rate_percent) : '') + (text(p.repayment_type) ? ', ' + text(p.repayment_type).replace('_', ' ') : '') : null));
        const eq = der.property_equity && num(der.property_equity[i]) !== null ? money(der.property_equity[i]) : null;
        rows.push(row('  Equity', eq));
        rows.push(row('  Rent', money(p && p.rent_monthly) !== null ? money(p.rent_monthly) + '/month' : null));
      });
      rows.push(row('Shares and ETFs', money(inv.shares_value) !== null ? money(inv.shares_value) + (text(inv.held_in) ? ' · held in ' + text(inv.held_in) : '') : null));
      rows.push(row('Managed funds', money(inv.managed_funds_value)));
    } else if (tileNo === 8) {
      const items = arr(debts.items);
      const TYPE_LABELS = { credit_card: 'Credit card', personal_loan: 'Personal loan', car_loan: 'Car loan', bnpl: 'Buy now pay later', tax_debt: 'Tax debt', other: 'Other debt' };
      for (const it of items) {
        const label = TYPE_LABELS[it && it.type] || 'Debt';
        const bits = [];
        if (money(it && it.balance) !== null) bits.push(money(it.balance));
        if (rate(it && it.rate_percent) !== null) bits.push(rate(it.rate_percent));
        if (money(it && it.minimum_monthly) !== null) bits.push('minimum ' + money(it.minimum_monthly) + '/month');
        rows.push(row(label, bits.length ? bits.join(' · ') : null));
      }
      rows.push(row('Total', money(der.debts_total)));
      if (num(debts.hecs_balance) !== null) rows.push(row('HECS (held separately)', money(debts.hecs_balance)));
    } else if (tileNo === 9) {
      rows.push(row('Salary', money(inc.salary_gross_annual) !== null ? money(inc.salary_gross_annual) + '/year' : (money(inc.salary_net_monthly) !== null ? money(inc.salary_net_monthly) + '/month take-home' : null)));
      rows.push(row('Partner salary', money(inc.partner_salary_gross_annual) !== null ? money(inc.partner_salary_gross_annual) + '/year' : (money(inc.partner_salary_net_monthly) !== null ? money(inc.partner_salary_net_monthly) + '/month take-home' : null)));
      rows.push(row('Business income', money(inc.business_income_annual) !== null ? money(inc.business_income_annual) + '/year' : null));
      rows.push(row('Rental income', money(inc.rental_income_annual) !== null ? money(inc.rental_income_annual) + '/year' : null));
      rows.push(row('Other income', money(inc.other_income_annual) !== null ? money(inc.other_income_annual) + '/year' : null));
      rows.push(row('Total (annual figures)', money(der.income_total_annual)));
      rows.push(row('Structure', inc.structure != null ? esc(STRUCTURE_LABELS[inc.structure] || inc.structure) + (inc.entity && inc.entity.name ? ' · ' + esc(inc.entity.type || 'entity') + ': ' + esc(inc.entity.name) : '') : null));
      rows.push(row('Employer super', arr(inc.employer_super_on).length ? 'paid on ' + inc.employer_super_on.map(esc).join(', ') : null));
    }

    return '<div class="fp-section fp-a">' + rows.join('') + '</div>';
  }

  // ── Section B — mechanics copy from the library, verbatim ──

  function sectionB(tileNo, library) {
    const tile = library && library.tiles && library.tiles[String(tileNo)];
    if (!tile || !tile.section_b || isPlaceholder(tile.section_b)) return '';
    return '<div class="fp-section fp-b"><h4>What these actually do</h4><p>' + esc(tile.section_b) + '</p></div>';
  }

  // ── Section C — insight units ──

  const BLOCK_HEADINGS = {
    why: 'Why this is worth a conversation',
    turn_up: 'What a look at this can turn up',
    dont_realise: "The part most people don't realise",
    how_professional: 'How the professional works',
    nothing_to_prepare: "There's nothing you need to know or prepare",
  };
  const BLOCK_ORDER = ['why', 'turn_up', 'dont_realise', 'how_professional', 'nothing_to_prepare'];

  function paragraphs(s) {
    return s.split('\n\n').map(p => '<p>' + esc(p) + '</p>').join('');
  }

  function insightUnit(insight, domains, derived, library) {
    const all = [].concat(arr(library && library.insights), arr(library && library.overrides));
    const entry = all.find(e => e.id === insight.id);
    if (!entry) return '';
    let html = '<div class="fp-insight" data-insight="' + esc(entry.id) + '">';
    const pos = fillPositionLine(entry.position_line, domains, derived);
    if (pos) html += '<p class="fp-position">' + pos + '</p>';
    if (entry.intro && !isPlaceholder(entry.intro)) html += '<p class="fp-intro">' + esc(entry.intro) + '</p>';
    for (const key of BLOCK_ORDER) {
      let block = entry.blocks && entry.blocks[key];
      if (!block || isPlaceholder(block)) continue;
      // Entity precedence (3.4): the engine flags 7.2 when an entity exists
      // and the entry's ownership_block metadata names the paragraph that
      // stands down in favour of Tile 9. Whole-paragraph selection from the
      // signed-off copy — never a rewrite.
      if (insight.ownership_block_suppressed && entry.ownership_block && entry.ownership_block.block === key) {
        const paras = block.split('\n\n');
        paras.splice(entry.ownership_block.paragraph, 1);
        if (!paras.length) continue;
        block = paras.join('\n\n');
      }
      if (entry.block_style === 'single' || entry.block_style === 'inline_headings') {
        html += '<div class="fp-block">' + paragraphs(block) + '</div>';
      } else {
        html += '<div class="fp-block"><h5>' + esc(BLOCK_HEADINGS[key]) + '</h5>' + paragraphs(block) + '</div>';
      }
    }
    if (entry.action_label) html += '<p class="fp-action">→ ' + esc(entry.action_label) + '</p>';
    html += '</div>';
    return html;
  }

  function sectionC(tileResult, domains, derived, library) {
    if (!tileResult || !tileResult.insights.length) return '';
    let html = '<div class="fp-section fp-c"><h4>Worth a conversation</h4>';
    for (const ins of tileResult.insights) html += insightUnit(ins, domains, derived, library);
    html += '</div>';
    return html;
  }

  // ── Assembly ──

  function renderTile(tileNo, domains, derived, tileResult, library) {
    const tileMeta = library && library.tiles && library.tiles[String(tileNo)];
    const title = tileMeta ? tileMeta.title : 'Tile ' + tileNo;
    let html = '<article class="fp-tile" data-tile="' + tileNo + '"><h3>' + esc(title) + '</h3>';
    html += sectionA(tileNo, domains || {}, derived || {});
    html += sectionB(tileNo, library);
    html += sectionC(tileResult, domains, derived, library);
    html += '</article>';
    return html;
  }

  function renderDashboard(domains, opts) {
    const o = opts || {};
    const derived = o.derived || (window.finnDerived ? window.finnDerived.derive(domains) : {});
    const triggers = o.triggers || (window.finnTriggers ? window.finnTriggers.evaluate(domains, { yearNow: o.yearNow, derived }) : { tiles: [] });
    const library = o.library;
    let html = '<div class="fp-dashboard">';
    for (const t of triggers.tiles) {
      if (!t.visible) continue;
      html += renderTile(t.tile, domains, derived, t, library);
    }
    html += '</div>';
    return html;
  }

  window.finnPanels = { renderDashboard, renderTile, fillPositionLine, slotValues };
})();
