/* Term affordance runtime — term-registry.md Part Four (corrected):
   - The handover renders on FIRST ENCOUNTER, not on a fixed tile. The
     dashboard is a grid; whichever tile they open first that uses a term
     carries its handover sentence. introduced_on is an authoring
     preference, never a rule this code obeys.
   - Handed-over state persists against the HOUSEHOLD (the host page
     supplies it and saves it), not the browser session.
   - The affordance (dotted underline + popover) renders on EVERY marked
     term, always, regardless of handover state. The failure mode is
     deliberately asymmetric: tracking gone wrong means at worst a handover
     shown twice, never a cold acronym.
   - The popover shows glossary then why. Never the handover sentence.
   - One first-introduction per block, asserted. Only <term id> wrappers in
     the copy decide what is marked (finn-components renderCopy).

   Usage:
     finnTerms.init({ terms, handed, onHandover })
       terms: the parsed finn-terms.json "terms" object
       handed: { termId: isoDate } already handed over for this household
       onHandover: async (updatedHandedMap) => persist against the household
     finnTerms.processContainer(el)
       call after rendering copy into el; injects handover lines for first
       encounters and records them. Binds nothing per-call (one delegated
       popover listener lives on document). */
(function () {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let TERMS = {};
  let handed = {};
  let onHandover = null;

  /* ── popover (singleton) ── */
  let pop = null;
  let popFor = null;

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'fc fc-termpop';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    document.body.appendChild(pop);
    return pop;
  }

  function closePop() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (popFor) popFor.setAttribute('aria-expanded', 'false');
    popFor = null;
  }

  function openPop(btn) {
    const id = btn.getAttribute('data-term');
    const t = TERMS[id];
    if (!t) return;
    const p = ensurePop();
    // Glossary, then why. Never the handover sentence.
    p.innerHTML = '<div class="g">' + esc(t.glossary) + '</div><div class="w">' + esc(t.why) + '</div>';
    p.hidden = false;
    const r = btn.getBoundingClientRect();
    const pw = Math.min(320, window.innerWidth - 24);
    p.style.maxWidth = pw + 'px';
    let left = r.left + window.scrollX;
    if (left + pw > window.scrollX + window.innerWidth - 12) left = window.scrollX + window.innerWidth - pw - 12;
    p.style.left = Math.max(12, left) + 'px';
    p.style.top = (r.bottom + window.scrollY + 6) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    popFor = btn;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('button.fc-term');
    if (btn) {
      if (popFor === btn && pop && !pop.hidden) { closePop(); return; }
      closePop();
      openPop(btn);
      return;
    }
    if (pop && !pop.hidden && !pop.contains(e.target)) closePop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('scroll', closePop, true);

  /* ── first-encounter handover ── */

  // The block an encountered term belongs to, for the injection point and
  // the one-first-introduction-per-block assertion.
  const BLOCK_SELECTOR = '.fc-edu, .fc-calc, .fc-calm, .fc-handover, .fp-block, .fc-costline, p';
  function blockOf(btn) {
    return (btn.closest && btn.closest(BLOCK_SELECTOR)) || btn.parentElement;
  }

  function processContainer(el) {
    if (!el) return;
    const buttons = el.querySelectorAll('button.fc-term');
    const injectedBlocks = new Set();
    const newlyHanded = [];
    for (const btn of buttons) {
      const id = btn.getAttribute('data-term');
      const t = TERMS[id];
      if (!t) continue;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-haspopup', 'dialog');
      if (handed[id]) continue;              // already learned; affordance still renders
      if (newlyHanded.includes(id)) continue; // second occurrence in this render
      const block = blockOf(btn);
      if (block && injectedBlocks.has(block)) {
        // One first-introduction per block, asserted. A block introducing
        // two is a content error; the first stands, the second is deferred
        // to its next encounter rather than doubling up here.
        console.error('[Finn terms] content error: block would introduce two terms ("' + id + '" deferred)');
        continue;
      }
      const handoverHtml = window.finnComponents
        ? window.finnComponents.handoverLine(t.handover)
        : '<div class="fc fc-handover">' + esc(t.handover) + '</div>';
      if (block && block.parentElement) {
        block.insertAdjacentHTML('afterend', handoverHtml);
        injectedBlocks.add(block);
      } else {
        btn.insertAdjacentHTML('afterend', ' ' + handoverHtml);
      }
      handed[id] = new Date().toISOString();
      newlyHanded.push(id);
    }
    if (newlyHanded.length && typeof onHandover === 'function') {
      Promise.resolve(onHandover({ ...handed })).catch(err =>
        console.error('[Finn terms] handover persistence failed (harmless: worst case the handover shows again):', err));
    }
    return newlyHanded;
  }

  function init(opts) {
    TERMS = (opts && opts.terms) || {};
    handed = { ...((opts && opts.handed) || {}) };
    onHandover = (opts && opts.onHandover) || null;
  }

  /* Handover at the foot of a calc block (component-spec 2.2): the panel
     layer asks for a term's handover where a calc has just demonstrated
     the thing. First encounter returns the handover line and records it;
     afterwards it returns nothing. Same household persistence, same
     harmless failure mode. */
  function handoverFor(termId) {
    const t = TERMS[termId];
    if (!t || handed[termId]) return '';
    handed[termId] = new Date().toISOString();
    if (typeof onHandover === 'function') {
      Promise.resolve(onHandover({ ...handed })).catch(err =>
        console.error('[Finn terms] handover persistence failed (harmless):', err));
    }
    return window.finnComponents
      ? window.finnComponents.handoverLine(t.handover)
      : '<div class="fc fc-handover">' + esc(t.handover) + '</div>';
  }

  window.finnTerms = { init, processContainer, handoverFor };
})();
