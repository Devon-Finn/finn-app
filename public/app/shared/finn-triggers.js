/* The trigger engine — field-spec.md Part 3, implemented as a pure function.
   Same input, same output, every time. No model call anywhere in this path;
   the model turns conversation into data, THIS code turns data into display,
   finn-library.json supplies the words.

   Conventions honoured throughout (they carry the advice line):
   - null means "not yet asked" and NEVER satisfies a condition. A condition
     on a number fires only on a real number; owns_home fires only on true.
   - Evaluation order per 3.1: hardship override, tile visibility, insight
     conditions, precedence, fixed ordering. Ordering is fixed, not scored —
     a relevance ranking would be a judgment Finn does not make.
   - 6.1 three-state rule (Devon): in_place false fires, "unsure" ALSO fires,
     "na" does not fire and renders as not applicable.
   - 3.2a and 3.2b are mutually exclusive by construction (has_offset true
     versus false); the fixtures assert it.
   - 8.1a/8.1b split on the mortgage: balance > 0 is "has a mortgage",
     anything else (0, null, no home domain) is "no mortgage".

   Exposed as window.finnTriggers.evaluate(domains, opts) -> {
     hardship, tiles: [{tile, visible, insights: [{id, ...flags}],
     lender_paid_note_once?}], insight_ids }
   opts.yearNow (integer) pins "today" for the will-age rule so tests are
   deterministic; it defaults to the current year at call time.
   opts.derived allows a precomputed finnDerived.derive() result; otherwise
   it is computed here (window.finnDerived must be loaded first). */
(function () {
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const pos = v => num(v) !== null && v > 0;
  const arr = v => Array.isArray(v) ? v : [];

  // Extract a 4-digit year from estate last_updated ("2019", "March 2014").
  // Unparseable wording ("before the kids") returns null and the age rule
  // simply cannot fire — the engine never guesses a date.
  function yearOf(lastUpdated) {
    if (typeof lastUpdated === 'number' && isFinite(lastUpdated)) return lastUpdated;
    if (typeof lastUpdated !== 'string') return null;
    const m = lastUpdated.match(/(19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : null;
  }

  // 6.1 per-document test: false fires, "unsure" fires, "na" and true do not.
  function estateDocFires(doc) {
    if (!doc || typeof doc !== 'object') return false;
    return doc.in_place === false || doc.in_place === 'unsure';
  }

  function evaluate(domains, opts) {
    const d = domains || {};
    const o = opts || {};
    const yearNow = num(o.yearNow) !== null ? o.yearNow : new Date().getFullYear();
    const derived = o.derived || (window.finnDerived ? window.finnDerived.derive(d) : {});

    const home = d.home || {};
    const inc = d.income || {};
    const exp = d.expenses || {};
    const buf = d.buffer || {};
    const sup = d.super || {};
    const inv = d.investments || {};
    const debts = d.debts || {};
    const est = d.estate || {};
    const flags = d.flags || {};

    // 3.1 step 1 — hardship first.
    const hardship = flags.hardship === true;

    const hasMortgage = pos(home.mortgage_balance);
    const debtItems = arr(debts.items);
    const expensesPresent = num(exp.living_monthly) !== null;

    // 3.2 — tile visibility.
    const visible = {
      1: home.owns_home === true,
      2: true, 3: true, 4: true, 5: true, 6: true,
      7: pos(inv.shares_value) || pos(inv.managed_funds_value) || arr(inv.properties).length > 0,
      8: debtItems.length > 0,
      9: true,
    };

    // 3.3 — insight conditions. Every condition is spec-table literal.
    const fires = {};

    fires['1.1'] = home.owns_home === true && hasMortgage;
    // 1.2 — fires only on an offset holding NOTHING: asked and answered
    // zero, never null. Someone with money in their offset has the
    // arrangement working and no question to take anyone; judging whether
    // their balance is "enough" would be an evaluation (explicit
    // non-trigger, field-spec 3.3).
    fires['1.2'] = home.has_offset === true && num(home.offset_balance) !== null && home.offset_balance === 0;
    fires['1.3'] = pos(derived.home_equity);
    fires['2.1'] = pos(derived.surplus_monthly);
    // 2.2 — nothing left over: surplus zero or negative AND computable.
    // Null means the inputs were ambiguous, not that the money is tight;
    // 2.1 and 2.2 are mutually exclusive by construction (>0 vs <=0).
    fires['2.2'] = num(derived.surplus_monthly) !== null && derived.surplus_monthly <= 0;
    fires['3.1'] = expensesPresent;
    // 3.2a counts ALL cash held outside the offset, not only the emergency
    // buffer: a dollar outside an offset behaves the same way whatever it
    // is earmarked for (field-spec 3.3 explicit non-trigger).
    fires['3.2a'] = home.has_offset === true && buf.linked_to_loan === false
      && ((num(buf.accessible_savings) || 0) + (num(buf.other_cash) || 0)) > 0;
    fires['3.2b'] = home.owns_home === true && home.has_offset === false && pos(buf.accessible_savings);

    // 4.1 — count(super.funds) > 1 for the SAME owner, OR multiple_accounts
    // true. Funds without an owner never aggregate (a couple with one fund
    // each is calm); the flag covers the person who says "I've got a few
    // super accounts somewhere" but can only name one.
    const ownerCounts = {};
    for (const f of arr(sup.funds)) {
      if (f && typeof f.owner === 'string' && f.owner) {
        ownerCounts[f.owner] = (ownerCounts[f.owner] || 0) + 1;
      }
    }
    fires['4.1'] = Object.values(ownerCounts).some(n => n > 1) || sup.multiple_accounts === true;

    // 5.1 — fires when the protection domain was actually REACHED: any leaf
    // of the four covers is non-null. An all-null domain means the
    // conversation never got there, not that they hold nothing, and no
    // insight fires on a domain that was never reached (explicit
    // non-trigger). held false IS a reached answer and fires.
    fires['5.1'] = ['life', 'tpd', 'income_protection', 'trauma'].some(k => {
      const cover = (d.protection || {})[k];
      return cover && typeof cover === 'object'
        && ['held', 'amount', 'inside_super'].some(f => cover[f] !== null && cover[f] !== undefined);
    });

    const willYear = est.will && est.will.in_place === true ? yearOf(est.will.last_updated) : null;
    fires['6.1'] = [est.will, est.poa, est.guardianship, est.super_nomination].some(estateDocFires)
      || (willYear !== null && (yearNow - willYear) > 5);

    fires['7.1'] = arr(inv.properties).length > 0;
    fires['7.2'] = pos(inv.shares_value) || pos(inv.managed_funds_value);

    fires['8.1a'] = debtItems.length > 0 && hasMortgage && !hardship;
    fires['8.1b'] = debtItems.length > 0 && !hasMortgage && !hardship;

    // 9.1 — structural complexity only. A null structure is "not yet asked"
    // and never fires; rental/dividend income alone never fires (Tile 7 owns
    // those — explicit non-trigger in 3.3).
    fires['9.1'] = (inc.structure != null && inc.structure !== 'paye')
      || pos(inc.business_income_annual)
      || inc.entity != null;

    // 3.4 — precedence.
    // Entity precedence: 7.2 stands its ownership block down; Tile 9 owns
    // the ownership question. Content flag for the renderer, not a
    // suppression of the insight itself.
    const ownershipStandsDown = inc.entity != null;

    // Assemble in fixed order (3.5): tiles 1..9, insights numeric within.
    const TILE_INSIGHTS = {
      1: ['1.1', '1.2', '1.3'], 2: ['2.1', '2.2'], 3: ['3.1', '3.2a', '3.2b'],
      4: ['4.1'], 5: ['5.1'], 6: ['6.1'], 7: ['7.1', '7.2'],
      8: ['8.1a', '8.1b'], 9: ['9.1'],
    };

    const tiles = [];
    const insight_ids = [];
    for (let t = 1; t <= 9; t++) {
      const tile = { tile: t, visible: visible[t], insights: [] };
      if (tile.visible) {
        for (const id of TILE_INSIGHTS[t]) {
          if (!fires[id]) continue;
          const insight = { id };
          if (id === '7.2' && ownershipStandsDown) insight.ownership_block_suppressed = true;
          tile.insights.push(insight);
          insight_ids.push(id);
        }
        // Hardship override: 8.1a/8.1b are already suppressed above; the
        // financial counsellor route surfaces in their place.
        if (t === 8 && hardship) {
          tile.insights.push({ id: 'hardship', override: true });
          insight_ids.push('hardship');
        }
        // Three-broker cap: when 1.1, 1.2 and 1.3 all fire, the "paid by
        // the lender" note renders once at tile level, not once per insight.
        if (t === 1 && fires['1.1'] && fires['1.2'] && fires['1.3']) {
          tile.lender_paid_note_once = true;
        }
      }
      tiles.push(tile);
    }

    return { hardship, tiles, insight_ids };
  }

  window.finnTriggers = { evaluate };
})();
