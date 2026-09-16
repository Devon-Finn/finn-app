/* CODE-EMITTED COPY — one substitution routine for every trigger token.

   [ASK: path_id]     retrieval asks (finn-retrieval-paths.js)
   [SWEEP: sweep_id]  the fixed "anything else?" questions (finn-plan.js)
   [FRAME: open]      the preframe that opens a fresh session
   [FRAME: close]     the line that opens the close's walk of open items
   [NUDGE: first]     the first time someone skips an item
   [NUDGE: accept]    when they skip it again

   The model never sees or writes this copy; it emits the token and code
   substitutes the exact words, so the wording cannot drift between
   sessions. Parsing and substitution share one regex, so what the person
   saw and what code records as served can never disagree. An unknown id
   is a fault: logged by the caller, emits nothing.

   FRAME and NUDGE copy: Devon's direction, 15 Sept 2026 (draft wording in
   Finn-Guide-Model-Discovery-Design-Sept2026, approved to implement).
   Rules: pattern not person (stalling is what usually happens, never the
   person's failing); no "friend"; reassurance about the process, never
   about their money; AU spelling; no em-dashes; no "simple". */

import { RETRIEVAL_PATHS, askFor } from "./finn-retrieval-paths.js";
import { SWEEPS } from "./finn-plan.js";

export const FRAMES = {
  open: [
    "Hi, I'm Finn. Before we start, a quick word on how this goes.",
    "We're going to put your whole financial picture in one place: what comes in, what goes out, what you own, what you owe, and what's set up to protect you and the people you care about.",
    "Along the way I'll ask for things you might not know off the top of your head, or might not know where to find. That's normal. For most people, it's exactly the point where getting this sorted has stalled before. Not because anyone did anything wrong, but because it's hard to know where to look, and easier to leave it for another day.",
    "That's the part I'm built for. When you don't know something, I'll show you where it lives and wait while you find it. If you'd still rather move past it, we can, and I'll keep a note and bring it back later. Just know that anything left blank stays a gap in the picture, and the picture is why you're here.",
    "Let's start with the people. Who's in your household, and what does work look like at the moment?",
  ].join("\n\n"),
  close: "Here's what's still open. Each one is a gap in the picture right now. None of them are hard to find, and I'll show you where each one lives.",
};

export const NUDGES = {
  first: "We can leave that for now. It's usually the kind of detail that stays unknown for years, and it's often one of the first things a professional asks for. Most people find it in a couple of minutes once they know where to look. Want to have a go now, or shall I note it and come back?",
  accept: "No problem, it's on the list. I'll bring it up again when we're somewhere it's easy to grab.",
};

const TOKEN = /\[(ASK|SWEEP|FRAME|NUDGE):\s*([a-z_]+)\s*\]/g;

export function textFor(kind, id) {
  if (kind === "ASK") return askFor(id);
  if (kind === "SWEEP") return SWEEPS[id] ? SWEEPS[id].text : null;
  if (kind === "FRAME") return FRAMES[id] ?? null;
  if (kind === "NUDGE") return NUDGES[id] ?? null;
  return null;
}

export function parseTokens(text) {
  const out = [];
  for (const m of String(text || "").matchAll(TOKEN)) out.push({ kind: m[1], id: m[2] });
  return out;
}

/* Replace every token in a COMPLETE string. Returns
   { text, served, sweeps, frames, nudges, unknown }. */
export function substituteTokens(text, ctx = {}) {
  const served = new Set();
  const sweeps = new Set();
  const frames = [];
  const nudges = [];
  const unknown = [];
  const out = String(text || "").replace(TOKEN, (whole, kind, id) => {
    let copy = textFor(kind, id);
    if (copy && kind === "FRAME" && id === "close" && ctx.closeList) copy = copy + "\n\n" + ctx.closeList;
    if (copy === null || copy === undefined) { unknown.push(kind + ":" + id); return ""; }
    if (kind === "ASK") for (const f of RETRIEVAL_PATHS[id].satisfies) served.add(f);
    if (kind === "SWEEP") sweeps.add(id);
    if (kind === "FRAME") frames.push(id);
    if (kind === "NUDGE") nudges.push(id);
    return copy;
  });
  return { text: out, served: [...served], sweeps: [...sweeps], frames, nudges, unknown };
}

/* True when s (starting "[") could still grow into a token: used by the
   stream to hold a partial token back across deltas. Never matches the
   machine markers [CAPTURE] / [RESOLVE]. */
export function isTokenPrefix(s) {
  const m = /^\[([A-Z]*)(:\s?[a-z_]*)?$/.exec(s);
  if (!m) return false;
  const word = m[1];
  const kinds = ["ASK", "SWEEP", "FRAME", "NUDGE"];
  if (m[2] !== undefined) return kinds.includes(word);
  return kinds.some(k => k.startsWith(word));
}

export function promptTokenSection() {
  return "\n\n═══ SWEEPS, NUDGES AND FRAMES (code authors the words) ═══\n\n" +
    "These work exactly like the [ASK: ...] tokens: emit the token on its own line where the words should appear; code substitutes fixed copy. Never write these words yourself and never paraphrase them.\n" +
    Object.entries(SWEEPS).map(([id, s]) => "- [SWEEP: " + id + "]: the \"anything else?\" question for " + s.area + ". An area does not count as covered until its sweep has been asked.").join("\n") +
    "\n- [NUDGE: first]: the first time the person wants to skip a document-backed or important item. Emit it and wait for their answer.\n" +
    "- [NUDGE: accept]: when they still want to skip it. Emit it, record the field in \"deferrals\", and move on. Never nudge an item more than twice in total across the session; the working notes show each item's count.\n" +
    "- [FRAME: close]: opens the close, and code appends the list of open items after it (don't restate or add to that list). Only when the working notes say closing is available. Until then, never say goodbye, never summarise the picture as finished, and never ask whether there's anything else before wrapping up.";
}
