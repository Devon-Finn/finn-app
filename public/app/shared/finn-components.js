/* Finn component library — component-spec.md Parts Two and Three, as code.
   Every component exists ONCE, here, and everything (tile panels, calm
   state, who-to-see) renders through these. Pure HTML-string factories:
   no state, no fetches, no model calls.

   The governing rule is enforced structurally: layout responds to the
   SHAPE of the data (cardinality, presence, completeness), never to its
   magnitude. Nothing in this file inspects whether a value is big, small,
   good or bad. Copy arrives verbatim from finn-library.json; the factories
   arrange, they never compose.

   Requires finn-components.css. Pages add class "fc" on a wrapping element
   (or the component root carries it) for the token scope.

   Exposed as window.finnComponents. */
(function () {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isPlaceholder = s => typeof s === 'string' && s.startsWith('[Not provided');

  const OPS = ['', '−', '+', '÷', '=']; // empty, −, +, ÷, =

  /* Copy pipeline: escapes everything, then re-materialises <term id="x">
     wrappers (the ONLY markup copy may carry — term-registry Part Four)
     as affordance buttons. The renderer never decides what to mark. */
  function renderCopyInline(text) {
    let out = esc(text);
    out = out.replace(/&lt;term id=&quot;([a-z0-9_-]+)&quot;&gt;([\s\S]*?)&lt;\/term&gt;/g,
      (_, id, label) => termAffordance(id, label));
    return out;
  }
  function renderCopy(text) {
    return String(text).split('\n\n').map(p => '<p>' + renderCopyInline(p) + '</p>').join('');
  }

  /* ── 2.3 Term affordance (popover behaviour arrives with the registry,
        component-spec build step 3) ── */
  function termAffordance(id, label) {
    return '<button type="button" class="fc-term" data-term="' + esc(id) + '">' + esc(label) + '</button>';
  }

  /* ── 2.1 Calc block ──
     rows: [{label, op, value, missing, result, indent}]
     op is one of '', '−', '+', '÷', '=' (validated). A rule line renders
     before the first result row. missing renders 'none recorded', never $0. */
  function calcBlock(rows) {
    let html = '<div class="fc fc-calc">';
    for (const r of rows) {
      if (r.op && !OPS.includes(r.op)) throw new Error('calcBlock: operator "' + r.op + '" is not in the grammar');
      if (r.result || r.subtotal) html += '<div class="crule"></div>';
      // subtotal (ledger, Sept 2026): the calc grammar with NO colour and
      // NO emphasis — a subtotal is arithmetic, not an evaluation.
      html += '<div class="crow' + (r.result ? ' result' : '') + (r.subtotal ? ' subtotal' : '') + (r.indent ? ' indent' : '') + '">' +
        '<span class="cl">' + esc(r.label) + '</span>' +
        '<span class="co">' + esc(r.op || '') + '</span>' +
        '<span class="cv' + (r.missing ? ' missing' : '') + '">' + (r.missing ? 'none recorded' : esc(r.value)) + '</span>' +
        '</div>';
    }
    return html + '</div>';
  }

  /* ── 2.2 Handover line ── one per calc block, maximum (asserted). */
  function handoverLine(text) {
    const introductions = (String(text).match(/<term /g) || []).length;
    if (introductions > 1) throw new Error('handoverLine: a block introducing two terms is a content error');
    return '<div class="fc fc-handover">' + renderCopyInline(text) + '</div>';
  }

  /* ── 2.4 Proportion bar ── genuine part-of-whole only; segment colours
        never change with the ratio (fixed classes). */
  function proportionBar(a, b, ariaLabel) {
    const total = a.value + b.value;
    if (!(total > 0) || a.value < 0 || b.value < 0) return '';
    const pa = Math.round(a.value / total * 100);
    return '<div class="fc fc-propbar" role="img" aria-label="' + esc(ariaLabel) + '">' +
      '<span class="seg a" style="flex:0 0 ' + pa + '%">' + esc(a.label) + '</span>' +
      '<span class="seg b" style="flex:1">' + esc(b.label) + '</span>' +
      '</div>';
  }

  /* ── 2.5 Reference block ── missing data behind a closed row reads as a
        neutral fact instead of a product failure. */
  function referenceBlock(summaryLabel, missingCount, bodyHtml) {
    const cnt = missingCount > 0 ? '<span class="cnt">' + missingCount + ' not recorded</span>' : '';
    return '<details class="fc fc-ref"><summary><span>' + esc(summaryLabel) + '</span>' + cnt + '</summary>' +
      '<div class="refbody">' + bodyHtml + '</div></details>';
  }

  /* ── 2.6 Cost pill and line ── never an amount; how the professional is
        paid and who pays them. */
  function costPill(text) { return '<span class="fc fc-pill">' + esc(text) + '</span>'; }
  function costLine(text) { return '<span class="fc fc-costline">' + renderCopyInline(text) + '</span>'; }

  /* ── 3.1 Figure hero ── caption ends in the Fraunces accent word. */
  function figureHero(value, captionBefore, accentWord, barHtml) {
    return '<div class="fc fc-hero"><div class="num">' + esc(value) + '</div>' +
      '<div class="cap">' + renderCopyInline(captionBefore) + ' <span class="fr">' + esc(accentWord) + '</span></div>' +
      (barHtml || '') + '</div>';
  }

  /* ── 3.2 Gap card ── the snapshot's gap-card language, collapsed by
        default. Body assembly (block order) belongs to the panel layer. */
  function gapCard(opts) {
    return '<details class="fc fc-gap" data-insight="' + esc(opts.id || '') + '"' + (opts.open ? ' open' : '') + '>' +
      '<summary><div class="gh">' + esc(opts.headline) + '</div>' +
      (opts.hook ? '<div class="ghook">' + renderCopyInline(opts.hook) + '</div>' : '') +
      (opts.chip ? '<span class="gchip">' + esc(opts.chip) + '</span>' : '') +
      '</summary><div class="gbody">' + (opts.bodyHtml || '') + '</div></details>';
  }

  /* Education block inside a gap card. knowledge: true is the ONLY place
     emphasis is spent — white inset, forest heading. */
  function eduBlock(heading, bodyText, knowledge) {
    return '<div class="fc fc-edu' + (knowledge ? ' knowledge' : '') + '">' +
      (heading ? '<div class="eh">' + esc(heading) + '</div>' : '') +
      renderCopy(bodyText) + '</div>';
  }

  /* ── 3.3 Step rail ── numbers are enumeration, never ranking. A single
        card renders bare: numbering a single item is absurd. */
  function stepRail(cardsHtml) {
    if (!cardsHtml.length) return '';
    if (cardsHtml.length === 1) return cardsHtml[0];
    let html = '<div class="fc fc-rail">';
    cardsHtml.forEach((c, i) => {
      html += '<div class="step"><span class="marker" aria-hidden="true">' + (i + 1) + '</span>' + c + '</div>';
    });
    return html + '</div>';
  }

  /* ── 3.4 Promise block ── inset on a tile panel; the banner form lives
        on the who-to-see view. Never both (caller's responsibility, and
        the who-to-see view uses trustBanner). */
  function promiseBlock(html) {
    return '<div class="fc fc-promise">' + html + '</div>';
  }

  /* ── 3.5 Action zone ── */
  const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function actionZone(label, vettingLine) {
    if (!label) return '';
    return '<div class="fc fc-action"><button type="button" class="btn">' + esc(label) + ARROW + '</button>' +
      (vettingLine ? '<div class="vetting">' + esc(vettingLine) + '</div>' : '') + '</div>';
  }

  /* ── 3.6 Calm block ── renders nothing while the copy is still owed;
        never a tick, never green, never a completion state. */
  function calmBlock(calm) {
    if (!calm || isPlaceholder(calm.statement)) return '';
    let html = '<div class="fc fc-calm"><div class="cstate">' + esc(calm.statement) + '</div>';
    if (calm.why && !isPlaceholder(calm.why)) html += '<div class="cwhy">' + renderCopyInline(calm.why) + '</div>';
    const wch = (calm.what_would_change || []).filter(x => !isPlaceholder(x));
    if (wch.length) html += '<ul class="cwch">' + wch.map(x => '<li>' + renderCopyInline(x) + '</li>').join('') + '</ul>';
    if (calm.closing && !isPlaceholder(calm.closing)) html += '<div class="cclose">' + renderCopyInline(calm.closing) + '</div>';
    return html + '</div>';
  }

  /* ── 2.7 Item row (ledger, Sept 2026) ── one asset or one liability: a
        name, one line saying what it is, the two figures that matter, and
        a right-aligned chip only where the chip is FACTUAL ("Fixed until
        Jun 2027", "Offset linked"). Rows are separated by a hairline
        rule, never boxed individually, never striped. */
  function itemRow(opts) {
    let html = '<div class="fc-itemrow">' +
      '<div class="irmain"><div class="irname">' + esc(opts.name) + '</div>' +
      (opts.line ? '<div class="irline">' + renderCopyInline(opts.line) + '</div>' : '') + '</div>';
    html += '<div class="irfigs">';
    for (const f of (opts.figures || []).slice(0, 2)) {
      html += '<div class="irfig"><span class="irfl">' + esc(f.label) + '</span>' +
        '<span class="irfv' + (f.missing ? ' missing' : '') + '">' + (f.missing ? 'none recorded' : esc(f.value)) + '</span></div>';
    }
    html += '</div>';
    if (opts.chip) html += '<span class="irchip">' + esc(opts.chip) + '</span>';
    return html + '</div>';
  }

  /* ── 2.8 Item group (ledger, Sept 2026) ── rows of one kind under a
        quiet label, closed by a subtotal in the calc block's arithmetic
        style. A subtotal is arithmetic: no colour, no emphasis, not an
        evaluation (calcBlock's `subtotal` rows). */
  function itemGroup(label, rowsHtml, subtotalRows) {
    let html = '<div class="fc fc-group">';
    if (label) html += '<div class="iglabel">' + esc(label) + '</div>';
    html += '<div class="igrows">' + rowsHtml.join('') + '</div>';
    if (subtotalRows && subtotalRows.length) {
      html += '<div class="igsub">' + calcBlock(subtotalRows.map(r => ({ ...r, subtotal: true, result: false }))) + '</div>';
    }
    return html + '</div>';
  }

  /* ── 3.7 Repeating item card + aggregate ── each item its own calc, the
        aggregate beneath in the same grammar. The insight still fires once
        regardless of item count — that lives in the trigger engine. */
  function repeatingItems(items, aggregateRows) {
    let html = '<div class="fc fc-items">';
    for (const it of items) {
      html += '<div class="item">' + (it.title ? '<div class="it">' + esc(it.title) + '</div>' : '') + calcBlock(it.rows) + '</div>';
    }
    if (aggregateRows && aggregateRows.length && items.length > 1) {
      html += '<div class="aggregate">' + calcBlock(aggregateRows) + '</div>';
    }
    return html + '</div>';
  }

  /* ── 3.8 Professional card ── items appear once under their primary;
        secondaries are named inline (the palso line), never duplicated. */
  function professionalCard(opts) {
    let html = '<div class="fc fc-pro"><div class="ph"><span class="pn">' + esc(opts.name) + '</span>' +
      (opts.count ? '<span class="pcount">' + esc(String(opts.count)) + '</span>' : '') + '</div>' +
      '<div class="prole">' + esc(opts.role) + '</div>';
    // Why these sit together. Library copy, count-agnostic, never composed.
    if (opts.why) html += '<div class="pwhy">' + esc(opts.why) + '</div>';
    if (opts.itemsHtml) html += '<div class="pitems">' + opts.itemsHtml + '</div>';
    html += '<div class="pcost">' + costPill(opts.cost_pill) + costLine(opts.cost_line) + '</div>' +
      (opts.actionHtml || '') + '</div>';
    return html;
  }
  // opts: { tileName, eduHtml } — the tile the item came from, and the
  // existing education for it, rendered unchanged beneath the sentence.
  function professionalItem(text, alsoNames, opts) {
    const o = opts || {};
    return '<div class="pitem">' +
      (o.tileName ? '<div class="psrc">' + esc(o.tileName) + '</div>' : '') +
      renderCopyInline(text) +
      (alsoNames && alsoNames.length ? '<div class="palso">also: ' + alsoNames.map(esc).join(', ') + '</div>' : '') +
      (o.eduHtml ? '<div class="pedu">' + o.eduHtml + '</div>' : '') +
      '</div>';
  }

  /* ══════════ CHARTS (Part C, 16 Oct) ══════════
     A chart where the thing is a QUANTITY, a state where the thing is a
     STATE. Four panels chart; two do not.

     Rules enforced here, not left to the caller:
     - Fills come ONLY from the three ramp tokens. There is no fourth. If a
       chart seems to need one, the chart is wrong, so the stacked bar folds
       instead of reaching for a colour.
     - Every mark is labelled, so nothing is identifiable by colour alone.
     - Chart text takes its colour from the ink tokens, never the series.
     - Every chart gets a table view. The lightest ramp step is below 3:1
       against the surface; visible labels plus the table are the required
       relief, so the table is not optional.
     - SVG/chart text font is set by a CSS rule, never by a font-family
       presentation attribute: as an attribute it silently falls back to a
       serif face in some rendering paths. */
  /* WHY THESE ARE HTML AND CSS, NOT SVG. DO NOT "UPGRADE" THEM.
     For horizontal bars this is the better tool, for three concrete reasons:
       - Text in normal flow CANNOT CLIP. An SVG label sits at a coordinate
         inside a fixed viewBox, so the outermost labels clip the moment a
         figure grows a digit or a category name gets longer. That is a real
         bug class these components simply do not have.
       - It REFLOWS at phone width. The rows restack and the bar track moves
         to its own line by a media query. An SVG would need its viewBox and
         every coordinate recomputed per breakpoint.
       - It is READABLE TO ASSISTIVE TECH with no extra work: the labels and
         figures are ordinary DOM text, and the table view is a real table.
         The SVG equivalent needs role, aria-label and a text alternative
         bolted on to reach the same place.
     The svg text { font-family: inherit } rule in the CSS stays for the day
     a chart genuinely needs SVG geometry (an area, a line, anything with a
     path). Setting the font by attribute silently falls back to a serif
     face in some rendering paths, which is invisible until screenshotted. */
  // Local helpers: the charts live here, so they do not borrow finn-panels'.
  const arr = (v) => (Array.isArray(v) ? v : []);
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
  const FILLS = ['var(--fc-fill-1)', 'var(--fc-fill-2)', 'var(--fc-fill-3)'];
  let tableSeq = 0;
  const nextTableId = function () { tableSeq += 1; return 'fc-tbl-' + tableSeq; };

  // ONE toggle pattern, not four. hidden + aria-expanded, never display.
  function tableToggle(id) {
    return '<button type="button" class="fc-tbtn" data-fc-table="' + esc(id) +
      '" aria-expanded="false" aria-controls="' + esc(id) + '">Show as a table</button>';
  }
  function dataTable(id, headers, rows) {
    return '<table class="fc-dtable" id="' + esc(id) + '" hidden><thead><tr>' +
      headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          return i === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function initTables(root) {
    var scope = root || document;
    if (scope.__fcTablesBound) return;
    scope.__fcTablesBound = true;
    scope.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.fc-tbtn') : null;
      if (!btn) return;
      var tbl = scope.querySelector('#' + btn.getAttribute('data-fc-table'));
      if (!tbl) return;
      var willShow = tbl.hidden;
      tbl.hidden = !willShow;
      btn.setAttribute('aria-expanded', String(willShow));
      btn.textContent = willShow ? 'Hide the table' : 'Show as a table';
    });
  }

  /* ── COMPONENT 1: stacked proportion bar ── one total, split into parts.
     Max three segments. A fourth FOLDS into "other" and LOGS: defensive
     code that fires silently is how a fourth fill reaches production. */
  function stackedBar(opts) {
    var o = opts || {};
    var fmt = o.money || function (v) { return String(v); };
    var segs = arr(o.segments).filter(function (s) { return s && num(s.value) !== null && s.value > 0; });
    if (!segs.length) return '';
    if (segs.length > FILLS.length) {
      var sorted = segs.slice().sort(function (a, b) { return b.value - a.value; });
      var keep = sorted.slice(0, FILLS.length - 1);
      var folded = sorted.slice(FILLS.length - 1);
      var ft = folded.reduce(function (a, s) { return a + s.value; }, 0);
      console.error('[Finn charts] ' + segs.length + ' segments exceed the three-fill ramp; folded the ' +
        folded.length + ' smallest (' + folded.map(function (s) { return s.label; }).join(', ') +
        ') into "other". There is no fourth fill by design.');
      segs = keep.concat([{ label: 'Other', value: ft, display: fmt(ft) }]);
    }
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0);
    var id = nextTableId();
    var legend = '<div class="fc-legend">' + segs.map(function (s, i) {
      return '<span class="fc-lg"><span class="fc-sw" style="background:' + FILLS[i] + '"></span>' + esc(s.label) + '</span>';
    }).join('') + '</div>';
    var bar = '<div class="fc-stack" role="img" aria-label="' +
      esc(segs.map(function (s) { return s.label + ' ' + (s.display || fmt(s.value)); }).join(', ')) + '">' +
      segs.map(function (s, i) {
        return '<span class="fc-seg" style="flex:' + s.value + ' 0 0;background:' + FILLS[i] +
          '" title="' + esc(s.label + ': ' + (s.display || fmt(s.value))) + '"></span>';
      }).join('') + '</div>';
    var marks = '<div class="fc-stacklabels">' + segs.map(function (s) {
      return '<span class="fc-sl" style="flex:' + s.value + ' 0 0"><b>' + esc(s.display || fmt(s.value)) +
        '</b><span>' + esc(s.label) + '</span></span>';
    }).join('') + '</div>';
    var totalDisplay = o.totalDisplay || fmt(total);
    var totalLabel = o.totalLabel || 'Total';
    var totalRow = '<div class="fc-total"><span>' + esc(totalLabel) + '</span><b>' + esc(totalDisplay) + '</b></div>';
    var tRows = segs.map(function (s) { return [s.label, s.display || fmt(s.value)]; });
    tRows.push([totalLabel, totalDisplay]);
    return '<div class="fc-chart">' + legend + bar + marks + totalRow +
      tableToggle(id) + dataTable(id, ['Part', 'Amount'], tRows) + '</div>';
  }

  /* ── COMPONENT 2: labelled bar rows ── several items of the same kind,
     compared by size. ONE fill: the labels carry identity and the length
     carries magnitude, so six categories do not need six colours and a
     single series needs no legend.
     ORDER IS THE CALLER'S AND IS NEVER SORTED HERE. A list sorted
     biggest-first implies the top one is the problem, which is a verdict
     by arrangement rather than by words. */
  function barRows(opts) {
    var o = opts || {};
    var groups = arr(o.groups).filter(function (g) { return g && arr(g.rows).length; });
    if (!groups.length) return '';
    var all = groups.reduce(function (a, g) { return a.concat(arr(g.rows)); }, []);
    var vals = all.map(function (r) { return num(r.value) || 0; });
    if (o.rule && num(o.rule.value) !== null) vals.push(num(o.rule.value) || 0);
    var scale = Math.max.apply(null, vals);
    if (!(scale > 0)) return '';
    var id = nextTableId();
    var row = function (r, fill) {
      var pct = Math.max(Math.round((num(r.value) || 0) / scale * 100), 1);
      return '<div class="fc-brow"><span class="fc-blabel">' + esc(r.label) + '</span>' +
        '<span class="fc-btrack"><span class="fc-bbar" style="width:' + pct + '%;background:' + fill +
        '" title="' + esc(r.label + ': ' + (r.display || String(r.value))) + '"></span></span>' +
        '<span class="fc-bval">' + esc(r.display || String(r.value)) + '</span></div>';
    };
    var html = '<div class="fc-chart">';
    groups.forEach(function (g) {
      if (g.heading) html += '<div class="fc-bgroup">' + esc(g.heading) + '</div>';
      html += arr(g.rows).map(function (r) { return row(r, FILLS[1]); }).join('');
    });
    // The rule row is a different KIND of thing from the rows above it, so
    // it sits below a dividing rule and takes the darkest fill.
    if (o.rule && num(o.rule.value) !== null) html += '<div class="fc-brule"></div>' + row(o.rule, FILLS[0]);
    if (o.footer) html += '<div class="fc-bfoot"><span>' + esc(o.footer.label) + '</span><b>' + esc(o.footer.display) + '</b></div>';
    var tRows = groups.reduce(function (a, g) {
      return a.concat(arr(g.rows).map(function (r) {
        return [(g.heading ? g.heading + ' - ' : '') + r.label, r.display || String(r.value)];
      }));
    }, []);
    if (o.rule) tRows.push([o.rule.label, o.rule.display || String(o.rule.value)]);
    if (o.footer) tRows.push([o.footer.label, o.footer.display]);
    html += tableToggle(id) + dataTable(id, ['Item', 'Amount'], tRows) + '</div>';
    return html;
  }

  /* ── COMPONENT 3: state matrix ── NOT a chart. Tile 5.
     THREE STATES, EACH WITH A DOT AND A WORD. Never colour alone.
       in place     true  - the household said it exists
       none held    false - the household said there is none
       not recorded null  - Finn never asked
     "None held" is a fact about the household. "Not recorded" is a fact
     about the conversation. Collapsing the third into a blank cell has
     Finn implying something it was never told. */
  var STATE_WORDS = { in_place: 'in place', none_held: 'none held', not_recorded: 'not recorded' };
  function stateCell(state, note) {
    var s = STATE_WORDS[state] ? state : 'not_recorded';
    return '<td class="fc-cell fc-' + s + '"><span class="fc-dot" aria-hidden="true"></span>' +
      '<span class="fc-word">' + esc(STATE_WORDS[s]) + '</span>' +
      (note ? '<span class="fc-note">' + esc(note) + '</span>' : '') + '</td>';
  }
  function stateMatrix(opts) {
    var o = opts || {};
    var rows = arr(o.rows);
    if (!rows.length) return '';
    var cols = arr(o.colLabels);
    var html = '<div class="fc-matrix"><table class="fc-mtable"><thead><tr><th scope="col">Cover</th>' +
      cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') +
      (o.whereLabel ? '<th scope="col">' + esc(o.whereLabel) + '</th>' : '') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><th scope="row">' + esc(r.label) + '</th>' +
        arr(r.cells).map(function (c) { return stateCell(c && c.state, c && c.note); }).join('') +
        (o.whereLabel ? '<td class="fc-where">' + esc(r.where || 'not recorded') + '</td>' : '') + '</tr>';
    });
    html += '</tbody></table>';
    // The legend spells all three out: "not recorded" is unusual enough to
    // need explaining the first time someone sees it.
    html += '<div class="fc-mlegend">' +
      '<span class="fc-lg"><span class="fc-dot fc-in_place" aria-hidden="true"></span>in place, you told Finn it exists</span>' +
      '<span class="fc-lg"><span class="fc-dot fc-none_held" aria-hidden="true"></span>none held, you told Finn there is none</span>' +
      '<span class="fc-lg"><span class="fc-dot fc-not_recorded" aria-hidden="true"></span>not recorded, Finn has not asked yet</span>' +
      '</div></div>';
    return html;
  }

  /* ── 3.9 Trust banner ── the disclosure lives inside the trust claim,
        said plainly and first. The one legitimate use of steel on forest. */
  function trustBanner(html) {
    return '<div class="fc fc-trust">' + html + '</div>';
  }

  window.finnComponents = {
    renderCopy, renderCopyInline, termAffordance,
    calcBlock, handoverLine, proportionBar, referenceBlock, costPill, costLine,
    stackedBar, barRows, stateMatrix, tableToggle, dataTable, initTables,
    itemRow, itemGroup,
    figureHero, gapCard, eduBlock, stepRail, promiseBlock, actionZone,
    calmBlock, repeatingItems, professionalCard, professionalItem, trustBanner,
  };
})();
