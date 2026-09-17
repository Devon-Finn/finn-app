/* The reply stream — paragraph discipline, code-emitted copy, auto-nudge.
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
  return { txt, done };
}

export async function runStreamTests(chat, tokens) {
  const failures = [];
  const t = (name, cond) => { if (!cond) failures.push(name); };
  const f = chat.__streamForTests;
  const { NUDGES, FRAMES } = tokens;

  const a = await run(f, ["Good, noted.\n\nAny other assets", " worth knowing about?\n\n[SWE", "EP: other_assets]\n\n[CAPTURE]{\"domains\":{}}"], {});
  t('composed-question-before-sweep-dropped', !a.txt.includes('Any other assets worth') && a.txt.includes('Beyond the home and super'));
  t('token-split-across-deltas-substitutes', !a.txt.includes('[SWE'));
  t('capture-block-still-delivered', a.txt.endsWith('[CAPTURE]{"domains":{}}'));
  t('raw-text-handed-to-save-unchanged', a.done.includes('Any other assets worth knowing about?') && a.done.includes('[SWEEP: other_assets]'));

  const b = await run(f, ["Of course.\n\nNow the Hostplus balance?\n\n[CAPTURE]{\"deferrals\":[\"super.funds[].has_insurance#x\"]}"], { isFirstDeferral: () => true });
  t('auto-nudge-on-first-deferral', b.txt.includes(NUDGES.first));
  t('auto-nudge-drops-new-question', !b.txt.includes('Hostplus balance'));
  const b2 = await run(f, ["Of course.\n\n[CAPTURE]{\"deferrals\":[\"x.y\"]}"], { isFirstDeferral: () => false });
  t('no-auto-nudge-on-repeat', !b2.txt.includes(NUDGES.first));
  const b3 = await run(f, ["[NUDGE: accept]\n\n[CAPTURE]{\"deferrals\":[\"x.y\"]}"], { isFirstDeferral: () => true });
  t('no-double-nudge-when-model-nudged', b3.txt.includes(NUDGES.accept) && !b3.txt.includes(NUDGES.first));

  const c = await run(f, ["Here we go — nearly there.\n\n[FRAME: close]\n\nThanks.\n\n[CAPTURE]{\"session_complete\":true}"], { closeList: "- an open item: where it lives." });
  t('close-frame-carries-code-list', c.txt.includes(FRAMES.close + "\n\n- an open item: where it lives."));
  t('em-dash-scrubbed', !c.txt.includes('—'));

  const d = await run(f, ["What is the ", "balance?"], {});
  t('trailing-question-delivered', d.txt === 'What is the balance?');
  const e = await run(f, ["First.\n\nIs it joint?\n\nThanks for that.\n\n[CAPTURE]{}"], {});
  t('question-not-before-token-kept', e.txt.startsWith('First.\n\nIs it joint?\n\nThanks for that.'));

  const g = await run(f, ["Wrapping up.\n\n[FRAME: close]\n\n[CAPTURE]{}"], { closeList: "- x", canClose: false });
  t('close-frame-refused-when-plan-open', !g.txt.includes(FRAMES.close) && !g.txt.includes('[FRAME'));

  // Stand-in run 4: the model dropped the opening {"domains": key.
  const h = await run(f, ["Of course.\n\n[CAPTURE]{},\"deferrals\":[\"x.y\"]}"], { isFirstDeferral: () => true });
  t('malformed-block-missing-domains-salvaged', h.txt.includes(NUDGES.first));

  // Stand-in run 4: a close attempted with areas open is cut at the frame,
  // wrap-up and verdict sentences go, and code says the session carries on.
  const k = await run(f, ["Other than those, I think we're in good shape. Let me pull together what we've built.\n\n[FRAME: close]\n\nThe picture is now clear enough to hand to a professional.\n\n[CAPTURE]{}"], { closeList: "- x", canClose: false });
  t('refused-close-cuts-reply', !k.txt.includes('clear enough') && k.txt.includes(FRAMES.not_yet));
  t('verdict-and-wrapup-sentences-removed', !/good shape|pull together/.test(k.txt));
  // A figure given from memory is not a skip: no nudge.
  const m = await run(f, ["Noted, about 9,000.\n\n[CAPTURE]{\"domains\":{\"debts\":{\"hecs_balance\":9000}},\"deferrals\":[\"debts.hecs_balance\"]}"], { isFirstDeferral: () => true });
  t('no-nudge-when-deferred-field-has-value', !m.txt.includes(NUDGES.first));

  // Stand-in run 5: a composed "anything else?" whose paragraph does not end
  // with "?" is still dropped before the sweep.
  const n = await run(f, ["Good.\n\nAre there any other debts in the picture? Things like car loans or cards.\n\n[SWEEP: other_debts]\n\n[CAPTURE]{}"], {});
  t('mid-paragraph-question-dropped-before-sweep', !n.txt.includes('any other debts in the picture') && n.txt.includes('Now the borrowing side'));

  // Live walk, 17 Sept 2026: internal words leaked ("A few quick sweep questions:").
  const j = await run(f, ["Good.\n\nBefore we gather figures, a few quick sweep questions:\n\n[SWEEP: other_income]\n\n[CAPTURE]{}"], {});
  t('internal-jargon-sentence-removed', !/sweep/i.test(j.txt) && j.txt.includes('does any other money come in'));

  // Live walk, 17 Sept 2026: two questions in one reply, and the second
  // part was later assumed. Only the first question goes out.
  const q2 = await run(f, ["Good, that's helpful.\n\nWhen you say your own company, are you paid a wage through it?\n\nAnd is Jess employed directly by the school?\n\n[CAPTURE]{}"], {});
  t('one-question-per-reply', q2.txt.includes('paid a wage through it?') && !q2.txt.includes('Jess'));

  // Stand-in run 6.
  const q3 = await run(f, ["Got it.\n\nDoes Jess's employer pay super on her salary? And does the company pay super on yours too?\n\n[CAPTURE]{}"], {});
  t('second-question-sentence-dropped', q3.txt.includes("Jess's employer") && !q3.txt.includes('company pay super'));
  const q4 = await run(f, ["Got it.\n\nIs that gross rent? Or is it net of costs?\n\n[CAPTURE]{}"], {});
  t('or-alternative-kept', q4.txt.includes('Or is it net of costs?'));
  const q5 = await run(f, ["Noted.\n\nNow, is there anything else coming in regularly that we haven't covered?\n\n[CAPTURE]{}"], { sweepsAsked: ['other_income'] });
  t('composed-re-ask-of-asked-sweep-dropped', !q5.txt.includes('anything else coming in'));
  const n2 = await run(f, ["No problem, we can come back to that.\n\nNow the REST account, can you check it?\n\n[CAPTURE]{\"deferrals\":[\"super.funds[].has_insurance#x\"]}"], { isFirstDeferral: () => true });
  t('nudge-replaces-contradicting-reply', n2.txt.startsWith(NUDGES.first) && !n2.txt.includes('No problem'));

  // Stand-in run 7: shape first, by code.
  const fs = {};
  const sw = await run(f, ["Good, thanks.\n\n[ASK: loan_details]\n\n[CAPTURE]{}"], { forceSweep: 'other_assets', result: fs });
  t('shape-phase-sweep-replaces-figure-ask', sw.txt.startsWith('Good, thanks.') && sw.txt.includes('Beyond the home and super') && !sw.txt.includes('loan account') && fs.forcedSweep === 'other_assets');

  const soft = await run(f, ["And roughly how much do the distributions come to each year?\n\n[CAPTURE]{}"], {});
  t('softener-removed-from-question', soft.txt.startsWith('And how much do the distributions come to each year?'));

  return { pass: failures.length === 0, total: 26, failures };
}
