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
      if (r.result) html += '<div class="crule"></div>';
      html += '<div class="crow' + (r.result ? ' result' : '') + (r.indent ? ' indent' : '') + '">' +
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
    if (opts.itemsHtml) html += '<div class="pitems">' + opts.itemsHtml + '</div>';
    html += '<div class="pcost">' + costPill(opts.cost_pill) + costLine(opts.cost_line) + '</div>' +
      (opts.actionHtml || '') + '</div>';
    return html;
  }
  function professionalItem(text, alsoNames) {
    return '<div class="pitem">' + renderCopyInline(text) +
      (alsoNames && alsoNames.length ? '<div class="palso">also: ' + alsoNames.map(esc).join(', ') + '</div>' : '') + '</div>';
  }

  /* ── 3.9 Trust banner ── the disclosure lives inside the trust claim,
        said plainly and first. The one legitimate use of steel on forest. */
  function trustBanner(html) {
    return '<div class="fc fc-trust">' + html + '</div>';
  }

  window.finnComponents = {
    renderCopy, renderCopyInline, termAffordance,
    calcBlock, handoverLine, proportionBar, referenceBlock, costPill, costLine,
    figureHero, gapCard, eduBlock, stepRail, promiseBlock, actionZone,
    calmBlock, repeatingItems, professionalCard, professionalItem, trustBanner,
  };
})();
