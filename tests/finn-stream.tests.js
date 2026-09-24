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

export async function runStreamTests(chat, tokens) {
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };
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
  await run(f, ["That's everything we need.\n\n[CAPTURE]{}"], { result: r3b, canClose: true, retry: async () => ({ text: 'x' }) });
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

  /* ── 6. the machine block always survives ── */
  const cap = await run(f, ['Noted.\n\n[CAPTURE]{"domains":{"home":{"owns_home":true}}}'], {});
  t('capture-block-passes-through', cap.txt.includes('"owns_home":true'));
  t('capture-block-reaches-the-save-path', typeof cap.done === 'string' && cap.done.includes('[CAPTURE]'));

  return { pass: failures.length === 0, total: 20, failures };
}
