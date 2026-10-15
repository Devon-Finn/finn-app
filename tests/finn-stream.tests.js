/* The reply stream, rebuilt 24 September 2026.

   Code no longer edits Finn's words. What is tested here is the whole of
   what it still does: serve the code-authored copy behind tokens, replace
   em-dashes, cut a close attempted with areas open, and check the finished
   reply against the ABSOLUTE LIST, handing it back to the model once
   instead of deleting anything.

   Run with the clarity-chat module (it exports __streamForTests):
     await runStreamTests(chatModule, tokensModule) */

async function run(streamFactory, chunks, ctx) {
  let done = null;
  const ts = streamFactory(t => { done = t; }, ctx);
  const enc = new TextEncoder();
  const src = new ReadableStream({ start(c) {
    for (const ch of chunks) c.enqueue(enc.encode("data: " + JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: ch } }) + "\n"));
    c.enqueue(enc.encode('data: {"type":"message_stop"}\n'));
    c.close();
  } });
  const rd = src.pipeThrough(ts).getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) { const { done: d, value } = await rd.read(); if (d) break; buf += dec.decode(value); }
  let txt = "";
  for (const line of buf.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try { const e = JSON.parse(line.slice(6)); if (e.delta && e.delta.text) txt += e.delta.text; } catch {}
  }
  return { txt, visible: txt.split("[CAPTURE]")[0].trim(), done };
}

// The [CAPTURE] block as data: these checks assert on the figures, never
// on wording, so they survive a copy change.
function captureOf(raw) {
  const s = String(raw || "");
  const i = s.indexOf("[CAPTURE]");
  if (i === -1) return null;
  try { return JSON.parse(s.slice(i + "[CAPTURE]".length).trim()); } catch { return null; }
}

export async function runStreamTests(chat, tokens) {
  const failures = [];
  let ran = 0;
  // COUNTED, never typed: total used to be a literal, so an assertion that
  // failed to land still reported PASS. ran is what actually executed.
  const t = (name, cond) => { ran++; if (!cond) failures.push(name); };
  const f = chat.__streamForTests;
  const { NUDGES, FRAMES } = tokens;
  const SWEEPS = chat.__sweepsForTests;

  /* ── 1. the code-authored copy, served by token ── */
  const ask = await run(f, ["Let's get the loan screen.\n\n[ASK: loan_details]\n\n[CAPTURE]{}"], {});
  t('ask-token-becomes-the-checked-copy', ask.visible.startsWith("Let's get the loan screen.") && /banking app|internet banking/i.test(ask.visible) && !ask.visible.includes('[ASK:'));
  const sweep = await run(f, ["[SWEEP: other_debts]\n\n[CAPTURE]{}"], {});
  t('sweep-token-becomes-the-checked-copy', sweep.visible === SWEEPS.other_debts.text);
  const nudge = await run(f, ["[NUDGE: first]\n\n[CAPTURE]{}"], {});
  t('nudge-token-becomes-the-checked-copy', nudge.visible === NUDGES.first);
  const already = await run(f, ["[SWEEP: other_income]\n\n[CAPTURE]{}"], { sweepsAsked: ['other_income'] });
  t('a-sweep-already-asked-emits-nothing', already.visible === '');

  /* ── 2. em-dashes, a brand rule ── */
  const dash = await run(f, ["The offset — an account against the loan — cuts the interest.\n\n[CAPTURE]{}"], {});
  t('em-dash-replaced', !dash.visible.includes('—') && dash.visible.includes('offset, an account'));

  /* ── 3. the close, with areas open ── */
  const early = await run(f, ["Here's where you've landed.\n\n[FRAME: close]\n\nEverything is saved.\n\n[CAPTURE]{}"], { canClose: false });
  t('early-close-cut-at-the-frame', early.visible.startsWith("Here's where you've landed.") && early.visible.includes(FRAMES.not_yet) && !early.visible.includes('Everything is saved'));
  const proper = await run(f, ["[FRAME: close]\n\n[CAPTURE]{}"], { canClose: true, closeList: '- The company profit.' });
  t('close-allowed-when-code-says-so', proper.visible.startsWith(FRAMES.close) && proper.visible.includes('The company profit'));

  /* ── 4. what code no longer touches (the decision of 24 Sept) ── */
  const answer = await run(f, ["An SMSF is a Self-Managed Super Fund, a fund you run yourself rather than having a big fund manage it.\n\nSo you've got ETFs. Are those held in your name, Jess's name, or jointly?\n\n[CAPTURE]{}"], { canClose: false });
  t('an-answer-and-its-question-both-stand', answer.visible.includes('Self-Managed Super Fund') && answer.visible.includes('held in your name'));
  const two = await run(f, ["What does Jess earn?\n\nAnd what do you earn?\n\n[CAPTURE]{}"], {});
  t('two-questions-are-the-models-business-now', two.visible.includes('What does Jess earn?') && two.visible.includes('And what do you earn?'));
  const soft = await run(f, ["And roughly how much do the distributions come to each year?\n\n[CAPTURE]{}"], {});
  t('softeners-are-the-models-business-now', soft.visible.includes('roughly'));
  const recap = await run(f, ["So Jess is PAYE, employed by a school.\n\nDo you own the home?\n\n[CAPTURE]{}"], { userCorpus: 'jess is a teacher' });
  t('recaps-are-the-models-business-now', recap.visible.includes('PAYE'));

  /* ── 5. THE ABSOLUTE LIST: handed back, never cut ── */
  const r1 = {};
  const verdict = await run(f, ["You're in good shape here.\n\nWhat's the balance?\n\n[CAPTURE]{}"], {
    result: r1, canClose: false,
    retry: async (why) => { r1.why = why; return { text: "The offset holds $38,000 against the loan.\n\nWhat's the balance on the card?\n\n[CAPTURE]{}" }; },
  });
  t('verdict-is-handed-back-not-cut', r1.absoluteFailures[0] === 'verdict' && /verdict/i.test(r1.why) && r1.retried === true);
  t('the-rewrite-is-what-the-person-sees', verdict.visible.includes('$38,000') && !verdict.visible.includes('good shape'));
  const r2 = {};
  await run(f, ["You should consolidate those accounts.\n\n[CAPTURE]{}"], {
    result: r2, canClose: false,
    retry: async () => ({ text: "Super accounts each charge their own fees.\n\nWhich funds are they?\n\n[CAPTURE]{}" }),
  });
  t('recommendation-is-handed-back', r2.absoluteFailures[0] === 'recommendation' && r2.retried === true);
  const r3 = {};
  await run(f, ["We're pretty much done, that's everything we need.\n\n[CAPTURE]{}"], {
    result: r3, canClose: false,
    retry: async () => ({ text: "There are a few areas still open.\n\nWhat's in the offset?\n\n[CAPTURE]{}" }),
  });
  t('wrapping-up-with-areas-open-is-handed-back', r3.absoluteFailures[0] === 'wrapping_up' && r3.retried === true);
  const r3b = {};
  await run(f, ["That's everything we need. What else is on your mind?\n\n[CAPTURE]{}"], { result: r3b, canClose: true, retry: async () => ({ text: 'x' }) });
  t('wrapping-up-allowed-once-code-says-it-can-close', !r3b.absoluteFailures.length && !r3b.retried);
  const r4 = {};
  const empty = await run(f, ["[SWEEP: other_income]\n\n[CAPTURE]{}"], {
    result: r4, sweepsAsked: ['other_income'],
    retry: async () => ({ text: "What else comes in each month?\n\n[CAPTURE]{}" }),
  });
  t('an-empty-reply-is-handed-back-too', r4.retried === true && empty.visible.includes('What else comes in'));
  const r5 = {};
  await run(f, ["You're on track.\n\n[CAPTURE]{}"], {
    result: r5, canClose: false,
    retry: async () => ({ text: "You're on track and well placed.\n\n[CAPTURE]{}" }),
  });
  t('a-second-failure-falls-back-to-checked-copy', r5.retryFailed === true && !r5.visible.includes('on track'));
  const clean = {};
  await run(f, ["The loan sits at $412,000 against a home worth $845,000.\n\nWhat's in the offset?\n\n[CAPTURE]{}"], { result: clean, canClose: false, retry: async () => ({ text: 'should not be called' }) });
  t('a-clean-reply-is-never-handed-back', !clean.retried && !clean.absoluteFailures.length);

  /* ── 6. a turn that stalls, and a question asked twice (walk 1, 24 Sept) ── */
  const dup = await run(f, ["Now, beyond the home loan, are there any other debts in the picture?\n\n[SWEEP: other_debts]\n\n[CAPTURE]{}"], {});
  t('the-models-own-version-of-a-served-ask-goes', !dup.visible.includes('beyond the home loan') && dup.visible === SWEEPS.other_debts.text);
  const dupKeep = await run(f, ["An offset sits against the loan and cuts the interest charged.\n\nSo what else is there?\n\n[SWEEP: other_assets]\n\n[CAPTURE]{}"], {});
  t('its-explanation-stays', dupKeep.visible.startsWith('An offset sits against the loan') && !dupKeep.visible.includes('So what else is there?'));
  const st = {};
  const stall = await run(f, ["A few things I'll want to come back to on the warehouse: what it's worth, and whether the company has a loan on it. We'll get to that.\n\n[CAPTURE]{}"], {
    result: st, retry: async (why) => { st.why = why; return { text: "Does the company have a loan against the warehouse?\n\n[CAPTURE]{}" }; },
  });
  t('a-turn-with-nothing-to-answer-is-handed-back', st.retried === true && /nothing to answer/i.test(st.why) && stall.visible.includes('loan against the warehouse'));
  const waitOk = {};
  await run(f, ["Take your time, I'll be here.\n\n[CAPTURE]{}"], { result: waitOk, retry: async () => ({ text: 'should not be called' }) });
  t('waiting-on-them-is-not-a-stall', !waitOk.retried);
  const fetchOk = {};
  await run(f, ["Open the loan screen and read me the balance, the rate and the repayment.\n\n[CAPTURE]{}"], { result: fetchOk, retry: async () => ({ text: 'should not be called' }) });
  t('an-instruction-to-fetch-is-not-a-stall', !fetchOk.retried);

  /* ── 7. walk 2, 24 Sept ── */
  const attrib = {};
  const badAttrib = await run(f, ["You mentioned other cash beyond the offset.\n\nHow much could you reach quickly?\n\n[CAPTURE]{}"], {
    result: attrib, saidIt: () => false,
    retry: async (why) => { attrib.why = why; return { text: "What could you reach quickly if income stopped?\n\n[CAPTURE]{}" }; },
  });
  t('a-claim-they-never-made-is-handed-back', attrib.absoluteFailures.includes('unsupported_attribution') && /never said/i.test(attrib.why) && badAttrib.visible.includes('reach quickly'));
  const okAttrib = {};
  await run(f, ["You mentioned the offset holds $38,000.\n\nIs it against the main loan?\n\n[CAPTURE]{}"], { result: okAttrib, saidIt: () => true, retry: async () => ({ text: 'should not be called' }) });
  t('a-claim-they-did-make-stands', !okAttrib.retried && !okAttrib.absoluteFailures.length);
  const secondNudge = await run(f, ["Noted.\n\n[NUDGE: first]\n\n[CAPTURE]{}"], { alreadyNudged: true });
  t('a-nudge-one-turn-after-a-nudge-becomes-the-acceptance', secondNudge.visible.includes(NUDGES.accept) && !secondNudge.visible.includes(NUDGES.first));
  const firstNudge = await run(f, ["Noted.\n\n[NUDGE: first]\n\n[CAPTURE]{}"], { alreadyNudged: false });
  t('the-first-nudge-still-goes-out', firstNudge.visible.includes(NUDGES.first));

  /* ── 8. the machine block always survives ── */
  const cap = await run(f, ['Noted.\n\n[CAPTURE]{"domains":{"home":{"owns_home":true}}}'], {});
  t('capture-block-passes-through', cap.txt.includes('"owns_home":true'));
  t('capture-block-reaches-the-save-path', typeof cap.done === 'string' && cap.done.includes('[CAPTURE]'));

  /* ── 9. a retried turn's capture is the RETRY's (15 Oct) ──
     The write-ahead runs after the retry is accepted, so both the save
     path and the served stream must read the second reply's block. The
     figures are asserted, not words in the prose, so this still means
     something when the copy changes. */
  const rc = {};
  const retryCap = await run(f, ['You’re in good shape here.\n\nWhat’s the balance?\n\n[CAPTURE]{"domains":{"buffer":{"accessible_savings":1000}}}'], {
    result: rc, canClose: false,
    retry: async () => ({ text: 'The offset holds $38,000 against the loan.\n\nWhat’s the balance on the card?\n\n[CAPTURE]{"domains":{"buffer":{"accessible_savings":38000}}}' }),
  });
  const savedCap = captureOf(retryCap.done);
  const servedCap = captureOf(retryCap.txt);
  t('a-retried-turn-saves-the-retrys-capture', rc.retried === true
    && savedCap?.domains?.buffer?.accessible_savings === 38000
    && servedCap?.domains?.buffer?.accessible_savings === 38000);


  /* ── 10. the nudge ledger survives a session boundary (walk 4, 15 Oct) ──
     The old check scanned the last assistant message, and `messages` is the
     current session only, so a returning household always read as never
     nudged. The empty `messages` array below IS the test: the durable
     count in flags.to_verify[].nudges has to carry it. */
  const nudgedPlan = {
    phase: 'trips',
    trips: [{ id: 'conversation', items: [{ field: 'protection.income_protection.amount', item_id: null, status: 'missing', label: "Jess's income protection monthly benefit" }] }],
    to_verify: [], sweeps_pending: [],
  };
  const nudgedDomains = { flags: { to_verify: [{ field: 'protection.income_protection.amount', item_id: null, nudges: 2, reason: 'deferred' }] } };
  if (typeof chat.__alreadyNudgedForTests === 'function') {
    t('a-prior-session-nudge-is-remembered-with-an-empty-transcript',
      chat.__alreadyNudgedForTests(nudgedPlan, nudgedDomains, [], NUDGES.first) === true);
    t('a-never-nudged-item-still-gets-the-first-nudge',
      chat.__alreadyNudgedForTests(nudgedPlan, { flags: { to_verify: [] } }, [], NUDGES.first) === false);
    // The transcript check stays as an OR for a nudge served this session
    // before the ledger has been written.
    t('a-nudge-earlier-in-this-session-still-counts',
      chat.__alreadyNudgedForTests(nudgedPlan, { flags: { to_verify: [] } },
        [{ role: 'assistant', content: NUDGES.first }], NUDGES.first) === true);
  }
  const remembered = await run(f, ['Noted.\n\n[NUDGE: first]\n\n[CAPTURE]{}'], {
    alreadyNudged: chat.__alreadyNudgedForTests
      ? chat.__alreadyNudgedForTests(nudgedPlan, nudgedDomains, [], NUDGES.first) : false,
  });
  t('a-remembered-nudge-serves-the-acceptance-not-the-first-nudge',
    remembered.visible.includes(NUDGES.accept) && !remembered.visible.includes(NUDGES.first));

  /* ── 11. a refused close replaces the claim and carries the next ask ──
     Walk 4 served both "that's actually everything we set out to cover" AND
     "we're not finished yet" in one reply, with nothing to answer. The
     finishing claim must go with the frame, and the correction must ask the
     next open thing code already knows. */
  const refused = await run(f, [
    "That's actually everything we set out to cover.\n\n" +
    "Let me flag the one thing still open: Jess's income protection monthly benefit amount. That's sitting in the Hostplus insurance page whenever you get a chance to check it.\n\n" +
    "[FRAME: close]\n\nYour picture is saved.\n\n[CAPTURE]{}",
  ], { canClose: false, nextAsk: { kind: 'item', id: 'protection.income_protection.amount', text: 'Next on the list is the income protection monthly benefit. What can you tell me about that?' } });
  t('the-finishing-claim-goes-with-the-frame', !/everything we set out to cover/i.test(refused.visible));
  t('the-useful-paragraph-survives', /Hostplus/.test(refused.visible));
  t('the-correction-is-served', refused.visible.includes(FRAMES.not_yet));
  t('the-correction-carries-something-to-answer', /\?/.test(refused.visible) && /income protection monthly benefit/i.test(refused.visible));
  t('nothing-after-the-close-frame-survives', !/picture is saved/i.test(refused.visible));


  /* ── 12. the finishing claim, framed or not (hole closed 15 Oct) ──
     One pattern governs both paths now. The walk-4 phrasing with no close
     frame used to pass untouched: compose() never ran without a frame, and
     the old wrapping_up test knew six phrasings that did not include it.
     All four cases below are canClose false except the last, which is the
     control: wrapping_up is only ever evaluated while areas are open, so a
     household that can genuinely close is never tested against it. */
  const CLAIM = "That’s actually everything we set out to cover.";
  const unframed = {};
  const u = await run(f, [CLAIM + "\n\nIs there anything else on your mind?\n\n[CAPTURE]{}"], {
    result: unframed, canClose: false, saidIt: () => true,
    retry: async () => ({ text: "What's in the offset?\n\n[CAPTURE]{}" }),
  });
  t('an-unframed-finishing-claim-is-handed-back',
    unframed.absoluteFailures.includes('wrapping_up') && unframed.retried === true
    && !/everything we set out to cover/i.test(u.visible));
  const knownPhrase = {};
  await run(f, ["That's everything we need.\n\nAnything else?\n\n[CAPTURE]{}"], {
    result: knownPhrase, canClose: false, saidIt: () => true,
    retry: async () => ({ text: "What's the card balance?\n\n[CAPTURE]{}" }),
  });
  t('the-phrasing-the-rule-already-knew-still-trips',
    knownPhrase.absoluteFailures.includes('wrapping_up') && knownPhrase.retried === true);
  const framed = {};
  const fr = await run(f, [CLAIM + "\n\nThe benefit figure is in the Hostplus insurance page.\n\n[FRAME: close]\n\nSaved.\n\n[CAPTURE]{}"], {
    result: framed, canClose: false, saidIt: () => true,
    nextAsk: { kind: 'item', text: 'Next on the list is the income protection benefit. What can you tell me about that?' },
    retry: async () => ({ text: "x\n\n[CAPTURE]{}" }),
  });
  t('a-framed-claim-still-behaves-as-it-did',
    !/everything we set out to cover/i.test(fr.visible) && fr.visible.includes(FRAMES.not_yet)
    && /Hostplus/.test(fr.visible) && /income protection benefit/i.test(fr.visible));
  // THE CONTROL: a household that can close is never tested, so the real
  // close is untouched however it is worded.
  const canCloseNow = {};
  await run(f, [CLAIM + "\n\nWhat else is on your mind?\n\n[CAPTURE]{}"], {
    result: canCloseNow, canClose: true, saidIt: () => true,
    retry: async () => ({ text: 'should not be called\n\n[CAPTURE]{}' }),
  });
  t('a-finishing-claim-is-allowed-once-the-picture-can-close',
    !canCloseNow.absoluteFailures.includes('wrapping_up') && !canCloseNow.retried);

  return { pass: failures.length === 0, total: ran, declared: 43, failures };
}
