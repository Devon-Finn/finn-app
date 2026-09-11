/* The conduct linter — capture-conduct Part Five, build step 6.

   A post-session pass over capture_log, run automatically at the end of
   every session and on demand. Output is a PER-SESSION REPORT, not log
   lines: Devon runs a walk and reads a report. The moment a check has a
   name it stops being a discovery and becomes a regression.

   Pure: runConductLinter({ rows, picture, registry, paths, confidenceRank,
   producers }) → report. `rows` are this session's capture_log rows
   ({ status, raw_text, capture, errors, field_id, created_at }), `picture`
   is the household's picture row ({ domains, refusals }) at report time.

   Check statuses: "fail" (a conduct rule was breached), "report" (a
   metric Devon reads, not a breach), "pass". Detection notes:
   - raw_text holds the FULL raw reply (visible text + machine block),
     pre-substitution — so legitimate ask copy never appears in it, only
     [ASK: tokens. Any retrieval-instruction prose in raw visible text is
     a composed ask.
   - A reply whose capture block was absent is tagged in raw_text by the
     recovery path ([REEXTRACTED... / [CAPTURE ABSENT...). */

const SOFTENERS = /\b(roughly|approximately|ballpark|a rough idea|if you know it)\b/i;
const FACT_KEYWORDS = /\b(rate|balance|owing|term|repayment|cover|super balance)\b/i;
// Retrieval-instruction prose. CSV/export sentences are exempt: the bank
// export walkthrough is reference data the model relays in its own words.
const ASK_PROSE = /\b(open your|log in to|banking app|internet banking|in front of you|attach (?:a|the|it)|screenshot of)\b/i;
const ASK_EXEMPT = /\b(csv|export)\b/i;
const ABSENT_TAG = /^\[(?:REEXTRACTED|CAPTURE ABSENT)/;

function visibleOf(rawText) {
  let s = String(rawText || "");
  s = s.replace(/^\[(?:REEXTRACTED|CAPTURE ABSENT)[^\n]*\n/, "");
  const cuts = [s.indexOf("[CAPTURE]"), s.indexOf("[RESOLVE]")].filter(i => i !== -1);
  return cuts.length ? s.slice(0, Math.min(...cuts)) : s;
}

function sentences(s) {
  return String(s || "").split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
}

// Leaf writes of a capture's domains, mirroring the gate's traversal:
// { id, domain, item } per non-null leaf, array items as domain.list[].field.
function leafWrites(domains) {
  const out = [];
  for (const [domainKey, domainVal] of Object.entries(domains || {})) {
    if (!domainVal || typeof domainVal !== "object" || Array.isArray(domainVal)) continue;
    for (const [k, v] of Object.entries(domainVal)) {
      if (k.startsWith("_") || v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (!item || typeof item !== "object") continue;
          for (const [ik, iv] of Object.entries(item)) {
            if (ik.startsWith("_") || ik === "id" || iv === null || iv === undefined) continue;
            out.push({ id: `${domainKey}.${k}[].${ik}`, domain: domainKey, item });
          }
        }
      } else if (typeof v === "object") {
        for (const [ik, iv] of Object.entries(v)) {
          if (ik.startsWith("_") || iv === null || iv === undefined) continue;
          out.push({ id: `${domainKey}.${k}.${ik}`, domain: domainKey });
        }
      } else {
        out.push({ id: `${domainKey}.${k}`, domain: domainKey });
      }
    }
  }
  return out;
}

function resolveEntry(registry, id, item) {
  const entry = registry[id];
  if (!entry || !entry.retrieval_by_type) return entry;
  const t = item && item[entry.type_key || "type"];
  const byType = t && entry.retrieval_by_type[t];
  return byType ? { ...entry, ...byType } : { ...entry, retrieval: "required" };
}

export function runConductLinter({ rows, picture, registry, paths, confidenceRank, producers }) {
  const checks = [];
  const add = (id, name, status, details) =>
    checks.push({ id, name, status, count: details.length, details: details.slice(0, 25) });

  const allRows = Array.isArray(rows) ? rows : [];
  const captureRows = allRows.filter(r => ["received", "applied", "refused", "failed"].includes(r.status));
  const servedRows = allRows.filter(r => r.status === "path_served");
  const servedFields = new Map(); // field_id -> earliest created_at
  for (const r of servedRows) {
    if (!r.field_id) continue;
    const t = new Date(r.created_at).getTime();
    if (!servedFields.has(r.field_id) || t < servedFields.get(r.field_id)) servedFields.set(r.field_id, t);
  }
  const domains = (picture && picture.domains) || {};
  const refusalFields = new Set(((picture && picture.refusals) || []).map(r => r && r.field).filter(Boolean));

  /* 1 · Confidence floor: a required field resting below its floor in the
     final picture with no refusal record. Attempts the gate caught are
     listed for the record but do NOT fail — the write was refused and
     nothing rests below floor; the linter flags leaks, not blocks. */
  {
    const details = [];
    for (const w of leafWrites(domains)) {
      const e = resolveEntry(registry, w.id, w.item);
      if (!e || e.never_asked || e.retrieval !== "required") continue;
      const conf = (domains[w.domain] || {})._confidence;
      const rank = confidenceRank[conf] ?? 0;
      const floor = confidenceRank[e.confidence_floor];
      if (floor !== undefined && rank < floor && !refusalFields.has(w.id)) {
        details.push(`${w.id} rests at "${conf ?? "no confidence"}" below floor "${e.confidence_floor}" with no refusal record`);
      }
    }
    const failing = details.length > 0;
    const caught = allRows.filter(r => r.status === "refused" && Array.isArray(r.errors) && r.errors.some(e => String(e).includes("below floor")));
    for (const r of caught) details.push(`(caught by gate, write refused) ${r.errors.filter(e => String(e).includes("below floor")).join("; ")}`);
    add("confidence_floor", "Confidence floor", failing ? "fail" : "pass", details);
  }

  /* 2 · Refusal validity: a refusal claimed in an APPLIED capture with no
     path_served row for that field at or before the claim. Claims in
     refused rows never took effect — the gate rejected them, which is the
     machinery working, not a leak. */
  {
    const details = [];
    for (const r of captureRows.filter(r => r.status === "applied")) {
      const claims = r.capture && Array.isArray(r.capture.refusals) ? r.capture.refusals : [];
      const t = new Date(r.created_at).getTime();
      for (const f of claims) {
        const served = servedFields.get(f);
        if (served === undefined || served > t + 2000) {
          details.push(`refusal claimed for ${f} with no code-witnessed path_served row before it`);
        }
      }
    }
    add("refusal_validity", "Refusal validity", details.length ? "fail" : "pass", details);
  }

  /* 3 · Softener: a forbidden softener in the same sentence as a
     retrievable-fact keyword, in the visible stream. */
  {
    const details = [];
    for (const r of captureRows) {
      for (const s of sentences(visibleOf(r.raw_text))) {
        if (SOFTENERS.test(s) && FACT_KEYWORDS.test(s)) details.push(`"${s.slice(0, 140)}"`);
      }
    }
    add("softener", "Softener", details.length ? "fail" : "pass", details);
  }

  /* 4 · Enum default: an enum resting without its requires satisfied
     (debts items with type but no purpose/borrower), plus caught attempts. */
  {
    const details = [];
    const items = domains.debts && Array.isArray(domains.debts.items) ? domains.debts.items : [];
    items.forEach((it, i) => {
      if (!it || typeof it !== "object" || !it.type) return;
      for (const req of ["purpose", "borrower"]) {
        if (it[req] === null || it[req] === undefined) details.push(`debts.items[${i}] has type "${it.type}" without ${req}`);
      }
    });
    const failing = details.length > 0;
    const caught = allRows.filter(r => r.status === "refused" && Array.isArray(r.errors) && r.errors.some(e => /before required field (purpose|borrower)/.test(String(e))));
    for (const r of caught) details.push(`(caught by gate, write refused) ${r.errors.join("; ").slice(0, 160)}`);
    add("enum_default", "Enum default", failing ? "fail" : "pass", details);
  }

  /* 5 · Reconciliation: declared producers with no income entry and no
     explicit zero (mirrors the derive-time walk over the final picture). */
  {
    const details = [];
    const inc = domains.income || {};
    const inv = domains.investments || {};
    const other = (Array.isArray(inc.other) ? inc.other.filter(o => o && typeof o === "object") : [])
      .map(o => o.source ? o : { ...o, source: o.type === "family_support" ? "other" : o.type });
    const props = Array.isArray(inv.properties) ? inv.properties : [];
    const unlinkedRentals = other.filter(o => (o.source === "rental_residential" || o.source === "rental_commercial") && !o.linked_asset_id);
    // A rental producer needs both the income entry AND its costs: a
    // gross entry carries costs_annual (a figure, or 0 with a stated
    // reason); net-of-costs carries them inside. Gross with no costs is
    // unreconciled. rent_monthly of exactly 0 is the explicit zero.
    const rentalCostsOk = (o) => o.basis === "net_of_costs"
      || (o.basis === "gross" && typeof o.costs_annual === "number"
          && (o.costs_annual > 0 || (typeof o.costs_note === "string" && o.costs_note.length > 0)));
    props.forEach((p, i) => {
      if (!p) return;
      if (typeof p.rent_monthly === "number" && p.rent_monthly === 0) return;
      const linkedEntry = p.id ? other.find(o => o.linked_asset_id === p.id) : undefined;
      const soleEntry = (!linkedEntry && props.length === 1 && unlinkedRentals.length > 0) ? unlinkedRentals[0] : undefined;
      const entry = linkedEntry || soleEntry;
      if (!entry) { details.push(`property ${p.id || i + 1}: no income entry and no explicit zero`); return; }
      if ((entry.source === "rental_residential" || entry.source === "rental_commercial") && !rentalCostsOk(entry)) {
        details.push(`property ${p.id || i + 1}: gross rent with no costs recorded (and no stated reason for zero)`);
      }
    });
    if (inc.entity && typeof inc.entity === "object" && inc.entity.type) {
      if (!other.some(o => o.linked_asset_id === "entity" || ["trust_distribution", "business_profit", "director_fee"].includes(o.source))) {
        details.push("entity: no income entry and no explicit zero");
      }
    }
    if ((typeof inv.shares_value === "number" && inv.shares_value > 0) || (typeof inv.managed_funds_value === "number" && inv.managed_funds_value > 0)) {
      if (!other.some(o => o.linked_asset_id === "holdings" || ["dividends", "distributions"].includes(o.source))) {
        details.push("holdings: no dividends or distributions entry and no explicit zero");
      }
    }
    if (inc.structure === "sole_trader" && !other.some(o => o.source === "business_profit")) {
      details.push("sole-trader business: no business_profit entry");
    }
    const stored = domains.flags && Array.isArray(domains.flags.income_unreconciled) ? domains.flags.income_unreconciled : [];
    for (const id of stored) details.push(`open (stored): ${id}`);
    add("reconciliation", "Reconciliation", details.length ? "fail" : "pass", details);
  }

  /* 6 · Path served: a required field APPLIED below document confidence
     with no path_served row — the ask happened without its path text.
     Document-confidence writes are exempt (a volunteered attachment
     needs no ask), and refused writes never landed. */
  {
    const details = [];
    const seen = new Set();
    for (const r of captureRows.filter(r => r.status === "applied")) {
      const capDomains = r.capture && r.capture.domains ? r.capture.domains : {};
      for (const w of leafWrites(capDomains)) {
        const e = resolveEntry(registry, w.id, w.item);
        if (!e || e.never_asked || e.retrieval !== "required") continue;
        const conf = (capDomains[w.domain] || {})._confidence;
        if (conf === "document") continue;
        if (!servedFields.has(w.id) && !seen.has(w.id)) {
          seen.add(w.id);
          details.push(`${w.id} captured at "${conf ?? "no confidence"}" without its path ever served this session`);
        }
      }
    }
    add("path_served", "Path served", details.length ? "fail" : "pass", details);
  }

  /* 7 · Single visit: the same path served more than once in the session.
     path_served rows cluster into serve events by time gap; each event
     maps to the path with the best field overlap. */
  {
    const details = [];
    const sorted = servedRows.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const clusters = [];
    for (const r of sorted) {
      const t = new Date(r.created_at).getTime();
      const last = clusters[clusters.length - 1];
      if (last && t - last.end <= 5000) { last.fields.add(r.field_id); last.end = t; }
      else clusters.push({ fields: new Set([r.field_id]), end: t });
    }
    const perPath = {};
    for (const c of clusters) {
      let best = null, bestOverlap = 0;
      for (const [pid, p] of Object.entries(paths)) {
        const overlap = p.satisfies.filter(f => c.fields.has(f)).length;
        if (overlap > bestOverlap) { best = pid; bestOverlap = overlap; }
      }
      if (best) perPath[best] = (perPath[best] || 0) + 1;
    }
    for (const [pid, n] of Object.entries(perPath)) {
      if (n > 1) details.push(`path "${pid}" served ${n} times — the same institution visited more than once`);
    }
    add("single_visit", "Single visit", details.length ? "fail" : "pass", details);
  }

  /* 8 · Stated rate per offered field (report): how often each offered
     field rests on stated rather than a source. */
  {
    const details = [];
    let statedCount = 0, total = 0;
    for (const w of leafWrites(domains)) {
      const e = resolveEntry(registry, w.id, w.item);
      if (!e || e.retrieval !== "offered") continue;
      const conf = (domains[w.domain] || {})._confidence;
      total++;
      if (conf === "stated" || conf === "estimated") statedCount++;
      details.push(`${w.id}: ${conf ?? "no confidence"}`);
    }
    if (total) details.unshift(`${statedCount} of ${total} offered fields rest on stated or below`);
    add("stated_rate_offered", "Stated rate per offered field", "report", details);
  }

  /* 9 · Fields resting on sighted (report). */
  {
    const details = [];
    for (const [domainKey, dom] of Object.entries(domains)) {
      if (dom && typeof dom === "object" && !Array.isArray(dom) && dom._confidence === "sighted") {
        const fields = leafWrites({ [domainKey]: dom }).map(w => w.id);
        details.push(`${domainKey} (${fields.length} fields): ${fields.join(", ").slice(0, 200)}`);
      }
    }
    add("sighted_resting", "Fields resting on sighted", "report", details);
  }

  /* 10 · Composed ask: retrieval-instruction prose in the raw visible
     text. Raw text is pre-substitution, so legitimate asks appear only
     as [ASK: tokens — any ask prose here was authored by the model. */
  {
    const details = [];
    for (const r of captureRows) {
      for (const s of sentences(visibleOf(r.raw_text))) {
        if (ASK_PROSE.test(s) && !ASK_EXEMPT.test(s) && !s.includes("[ASK:")) details.push(`"${s.slice(0, 140)}"`);
      }
    }
    add("composed_ask", "Composed ask", details.length ? "fail" : "pass", details);
  }

  /* 11 · Capture block: replies with no capture block (tagged by the
     recovery path), with the outcome of each re-extraction. */
  {
    const details = [];
    for (const r of allRows) {
      if (ABSENT_TAG.test(String(r.raw_text || ""))) {
        details.push(`reply with no capture block — recovery outcome: ${r.status}`);
      }
    }
    add("capture_block", "Capture block", details.length ? "fail" : "pass", details);
  }

  /* 12 · Em-dash: any em-dash in the raw visible stream (scrubbed before
     display, reported here so the leak rate stays visible). */
  {
    const details = [];
    let n = 0;
    for (const r of captureRows) {
      const m = visibleOf(r.raw_text).match(/—/g);
      if (m) n += m.length;
    }
    if (n) details.push(`${n} em-dash${n === 1 ? "" : "es"} in the raw visible stream (scrubbed before display)`);
    add("em_dash", "Em-dash", n ? "fail" : "pass", details);
  }

  const failures = checks.filter(c => c.status === "fail").length;
  return {
    generated_at: new Date().toISOString(),
    turns: captureRows.length,
    serves: servedRows.length,
    checks,
    summary: { failures, verdict: failures === 0 ? "clean" : `${failures} check${failures === 1 ? "" : "s"} failing` },
  };
}
