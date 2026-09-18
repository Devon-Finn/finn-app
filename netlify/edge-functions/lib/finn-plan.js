/* THE INFORMATION PLAN — the guide model's layer 2
   (Finn-Guide-Model-Discovery-Design-Sept2026, Devon's direction after the
   15 Sept walk).

   Finn runs the Clarity Session like an experienced planner's discovery
   meeting, without a planner's conclusions. Behind every turn, CODE works
   out what the picture still needs, where each piece goes, and which trip
   gets it. The model reads this as its working notes; code owns it.

   Pure: buildPlan(domains, goals) → plan. No IO, no model.

   THE GUARDRAIL (tested): the plan is driven by the SHAPE of the household
   (presence, structure, cardinality, completeness), never by MAGNITUDE.
   No branch below compares a figure's size, except the explicit-zero
   convention (a 0 means "none", which is presence, not size). Scaling
   every figure leaves the plan unchanged.

   What it decides:
   - the situation map: which branches the household's shape opens
   - per area: the required fields, which are missing, which are stored but
     unverified, which were put off by the person
   - the sweeps still to ask (code-emitted fixed questions)
   - the trips: missing and unverified items grouped by where they live
   - coverage: an area is covered when nothing required is missing (a
     to-verify or deferred item counts as handled) and its sweeps are asked
   - whether the session may close */

import { FIELD_REGISTRY, resolveEntry } from "./finn-field-registry.js";

export const AREAS = ["income", "assets", "liabilities", "buffer", "super", "protection", "estate", "goals"];

// Code-emitted sweep questions. The model emits [SWEEP: id]; code
// substitutes the text and records the sweep as asked.
export const SWEEPS = {
  other_income: {
    area: "income",
    text: "Apart from what we've covered, does any other money come in regularly? Rent, dividends or distributions, anything paid out of a company or trust, a side business, government payments, or support from family.",
  },
  other_assets: {
    area: "assets",
    text: "Beyond the home and super, what else do you own? Another property, shares or ETFs, managed funds, crypto, cash held somewhere separate, or anything held inside a company, trust or SMSF. Even if it feels small, it helps to have it on the list.",
  },
  other_debts: {
    area: "liabilities",
    text: "What do you owe, all of it in one go? A home loan or a split off it, a line of credit, a credit card, a car or personal loan, buy now pay later, HECS, money owed to family or the tax office, and anything borrowed inside a company or trust.",
  },
  other_super: {
    area: "super",
    text: "Does either of you have more than one super account? Old jobs often leave one behind. myGov lists every account in your name under the ATO section, so if there's any doubt, that's the place to check.",
  },
};

const TRIP_LABELS = {
  payslip: "a payslip",
  loan_details: "the banking app, on the loan screen",
  bank_statement: "the banking app, on the account balances",
  living_costs: "twelve months of transactions",
  super_statement: "the super fund's app or myGov",
  policy_schedule: "the insurance page or policy schedule",
  investment_platform: "the investing platform",
  home_value: "a property estimate site such as realestate.com.au, or a lender valuation",
  rental_income: "the lease or agent statement",
  business_income: "the tax return or accountant's figures",
  hecs: "myGov, ATO section",
  conversation: "just a conversation",
};

const ENTITY_BORROWERS = ["company", "trust", "smsf", "partnership"];
const UNSECURABLE = ["credit_card", "bnpl", "hecs_help", "tax_debt"];

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const arr = v => Array.isArray(v) ? v.filter(isObj) : [];
const has = v => v !== null && v !== undefined && v !== "";
const num = v => typeof v === "number" && isFinite(v);

// Labels for plan-only ids that are not registry fields.
const EXTRA_LABELS = {
  "context.children": "whether there are children, and their ages",
  "super.funds": "each super account",
  "income.other.entity": "what the company or trust earns or pays out to you",
  "income.other.holdings": "the dividends or distributions from the shares",
  "income.other.property": "the rent from this property",
  "income.other.business": "the business profit",
  "investments.properties[].loan": "what's owing against this property, or that nothing is",
  "debts.hecs_balance": "any HECS or HELP balance (none is an answer)",
  "protection.inside_super_detail": "which cover sits inside the super fund that has insurance",
  "goals.directions": "what they want, in their own words",
};

function labelFor(field, item) {
  if (EXTRA_LABELS[field]) return EXTRA_LABELS[field];
  const e = resolveEntry(FIELD_REGISTRY[field], item);
  return e && e.label ? e.label : field;
}
function tripFor(field, item) {
  const e = resolveEntry(FIELD_REGISTRY[field], item);
  if (e && e.retrieval !== "none" && Array.isArray(e.paths) && e.paths.length) return e.paths[0];
  if (field === "income.other.property") return "rental_income";
  if (field === "income.other.holdings") return "investment_platform";
  if (field === "income.other.entity" || field === "income.other.business") return "business_income";
  if (field === "investments.properties[].loan") return "loan_details";
  if (field === "debts.hecs_balance") return "hecs";
  if (field === "super.funds" || field === "protection.inside_super_detail") return "super_statement";
  return "conversation";
}

const COVER_WORDS = { life: "life cover", tpd: "TPD cover", income_protection: "income protection", trauma: "trauma cover" };
// The person's own name for their partner, when they gave one: the close
// reads "Jess" rather than "(partner)" (Devon, 17 Sept).
let PARTNER_NAME = null;
const whose = owner => owner === "partner" ? (PARTNER_NAME || "partner") : owner === "you" ? "you" : owner;
function itemLabel(domain, item) {
  if (domain === "protection") return (COVER_WORDS[item.type] || "cover") + " (" + whose(item.owner || "you") + ")";
  if (domain === "super") return (item.fund || "a super account") + (item.owner ? " (" + whose(item.owner) + ")" : "");
  if (domain === "debts") return String(item.type || "a debt").replace(/_/g, " ") + (item.borrower ? " (" + item.borrower + ")" : "");
  if (domain === "investments") return "property" + (item.held_in ? " held in " + item.held_in : "") + (item.use ? ", " + item.use : "");
  if (domain === "income") return String(item.source || "income").replace(/_/g, " ");
  return domain;
}

/* The ledger: flags.to_verify entries keyed field|item_id. */
function ledgerIndex(domains) {
  const idx = new Map();
  const tv = domains && isObj(domains.flags) && Array.isArray(domains.flags.to_verify) ? domains.flags.to_verify : [];
  for (const e of tv) if (isObj(e) && e.field) idx.set(e.field + "|" + (e.item_id || ""), e);
  return { idx, list: tv.filter(isObj) };
}

export function buildPlan(domains, goals, opts = {}) {
  const d = isObj(domains) ? domains : {};
  const g = isObj(goals) ? goals : {};
  const ctx = d.context || {}, inc = d.income || {}, exp = d.expenses || {}, home = d.home || {};
  const buf = d.buffer || {}, sup = d.super || {}, prot = d.protection || {}, est = d.estate || {};
  const inv = d.investments || {}, debts = d.debts || {};
  PARTNER_NAME = typeof ctx.partner_name === "string" && ctx.partner_name.trim() ? ctx.partner_name.trim() : null;
  const flags = isObj(d.flags) ? d.flags : {};
  const sweepsAsked = new Set(Array.isArray(flags.sweeps_asked) ? flags.sweeps_asked : []);
  const { idx: ledger, list: ledgerList } = ledgerIndex(d);

  const props = arr(inv.properties);
  const funds = arr(sup.funds);
  const items = arr(debts.items);
  const other = arr(inc.other);
  const kids = Array.isArray(ctx.children) ? ctx.children : null;
  const couple = num(ctx.adults) && ctx.adults >= 2;
  const hasEntity = (isObj(inc.entity) && has(inc.entity.type)) || ["company", "trust"].includes(inc.structure)
    || props.some(p => ENTITY_BORROWERS.includes(String(p.held_in || "").toLowerCase()))
    || items.some(it => ENTITY_BORROWERS.includes(it.borrower));
  const hasHoldings = (num(inv.shares_value) && inv.shares_value !== 0) || (num(inv.managed_funds_value) && inv.managed_funds_value !== 0);
  const ownsHome = home.owns_home === true;
  const mortgaged = ownsHome && !(num(home.mortgage_balance) && home.mortgage_balance === 0);

  const areas = {};
  for (const a of AREAS) areas[a] = { required: [], missing: [], to_verify: [], deferred: [], sweeps: [] };

  // need(area, field, present, item?, domainForItem?)
  // The stored value, so the close can tell a figure from a yes/no.
  function valueOf(field, item) {
    const parts = field.split(".");
    if (field.includes("[]")) return item ? item[parts[parts.length - 1]] : undefined;
    let node = d;
    for (const p of parts) node = isObj(node) ? node[p] : undefined;
    return node;
  }
  function need(area, field, present, item, domainKey) {
    const itemId = item && item.id ? item.id : null;
    const key = field + "|" + (itemId || "");
    const entry = ledger.get(key);
    const rec = {
      field, item_id: itemId,
      label: labelFor(field, item) + (item && domainKey ? ", " + itemLabel(domainKey, item) : ""),
      trip: tripFor(field, item),
      figure: num(valueOf(field, item)),
    };
    areas[area].required.push(rec);
    if (present) {
      // A figure read straight off its source ("sighted") is not raised
      // again in conversation; it stays in the ledger for the professional.
      if (entry && entry.reason !== "deferred" && entry.confidence !== "sighted") areas[area].to_verify.push({ ...rec, reason: entry.reason, confidence: entry.confidence });
      return;
    }
    if (entry && entry.reason === "deferred") { areas[area].deferred.push({ ...rec, nudges: entry.nudges || 1 }); return; }
    areas[area].missing.push(rec);
  }
  function sweep(area, id) {
    areas[area].sweeps.push({ id, asked: sweepsAsked.has(id) });
  }

  /* ── income (household context, income, expenses) ── */
  need("income", "context.adults", has(ctx.adults));
  need("income", "context.owner_age", has(ctx.owner_age));
  if (couple) need("income", "context.partner_age", has(ctx.partner_age));
  need("income", "context.children", kids !== null);
  need("income", "income.structure", has(inc.structure));
  if (["paye", "company", "mixed"].includes(inc.structure) || !has(inc.structure)) {
    need("income", "income.salary_gross_annual", has(inc.salary_gross_annual));
    if (!(num(inc.salary_gross_annual) && inc.salary_gross_annual === 0)) {
      need("income", "income.salary_net_monthly", has(inc.salary_net_monthly));
    }
  }
  if (couple) {
    need("income", "income.partner_salary_gross_annual", has(inc.partner_salary_gross_annual));
    if (!(num(inc.partner_salary_gross_annual) && inc.partner_salary_gross_annual === 0)) {
      need("income", "income.partner_salary_net_monthly", has(inc.partner_salary_net_monthly));
    }
  }
  if (num(inc.salary_gross_annual) || num(inc.partner_salary_gross_annual)) {
    need("income", "income.employer_super_on", Array.isArray(inc.employer_super_on));
  }
  // Producers: every income-producing thing needs its income (or an
  // explicit zero). Presence-driven only.
  for (const p of props) {
    if (num(p.rent_monthly) && p.rent_monthly === 0) continue;
    const entry = other.find(o => o.linked_asset_id && o.linked_asset_id === p.id)
      || (props.length === 1 ? other.find(o => ["rental_residential", "rental_commercial"].includes(o.source) && !o.linked_asset_id) : undefined);
    need("income", "income.other.property", !!(entry && has(entry.amount_annual)), p, "investments");
    if (entry && entry.basis === "gross") {
      need("income", "income.other[].costs_annual", has(entry.costs_annual), entry, "income");
    } else if (entry && !has(entry.basis)) {
      need("income", "income.other[].basis", false, entry, "income");
    }
  }
  if (hasEntity) {
    const ent = other.find(o => o.linked_asset_id === "entity" || ["trust_distribution", "business_profit", "director_fee"].includes(o.source));
    // Also satisfied by an entity-held entry (not a rental) that has an
    // amount or that the person put off.
    const entHeld = other.filter(o => ["company", "trust"].includes(o.entity) && !["rental_residential", "rental_commercial"].includes(o.source));
    const entDeferred = entHeld.some(o => { const e = ledger.get("income.other[].amount_annual|" + o.id); return e && e.reason === "deferred"; })
      || (ent && (() => { const e = ledger.get("income.other[].amount_annual|" + ent.id); return e && e.reason === "deferred"; })())
      // Stand-in run 4: the put-off was recorded against the plan id itself.
      || (() => { const e = ledger.get("income.other.entity|"); return !!(e && e.reason === "deferred"); })();
    if (entDeferred) {
      areas.income.required.push({ field: "income.other.entity", item_id: null, label: labelFor("income.other.entity"), trip: "business_income" });
      const le = ledger.get("income.other.entity|");
      areas.income.deferred.push({ field: "income.other.entity", item_id: null, label: labelFor("income.other.entity"), trip: "business_income", nudges: (le && le.nudges) || 1 });
    } else {
      need("income", "income.other.entity", !!(ent && has(ent.amount_annual)) || entHeld.some(o => has(o.amount_annual)));
    }
  }
  if (hasHoldings) {
    const div = other.find(o => o.linked_asset_id === "holdings" || ["dividends", "distributions"].includes(o.source));
    need("income", "income.other.holdings", !!(div && has(div.amount_annual)));
  }
  if (inc.structure === "sole_trader") {
    const bp = other.find(o => o.source === "business_profit");
    need("income", "income.other.business", !!(bp && has(bp.amount_annual)));
  }
  need("income", "expenses.living_monthly", has(exp.living_monthly));
  if (has(exp.living_monthly)) need("income", "expenses.includes_housing", typeof exp.includes_housing === "boolean");
  sweep("income", "other_income");

  /* ── assets (home, investments) ── */
  need("assets", "home.owns_home", typeof home.owns_home === "boolean");
  if (ownsHome) {
    need("assets", "home.value_estimate", has(home.value_estimate));
    need("assets", "home.value_source", has(home.value_source));
  }
  for (const p of props) {
    need("assets", "investments.properties[].value_estimate", has(p.value_estimate), p, "investments");
    need("assets", "investments.properties[].held_in", has(p.held_in), p, "investments");
    need("assets", "investments.properties[].use", has(p.use), p, "investments");
  }
  if (has(inv.shares_value) || has(inv.managed_funds_value)) {
    // The holding's value is required too, so a remembered figure reaches
    // the close (stand-in run 4: "about 70k" was never listed).
    if (has(inv.shares_value)) need("assets", "investments.shares_value", true);
    if (has(inv.managed_funds_value)) need("assets", "investments.managed_funds_value", true);
    need("assets", "investments.held_in", has(inv.held_in));
  }
  sweep("assets", "other_assets");

  /* ── liabilities (home loan, property loans, debts, HECS) ── */
  if (ownsHome) {
    need("liabilities", "home.mortgage_balance", has(home.mortgage_balance));
    if (mortgaged) {
      for (const f of ["rate_percent", "rate_type", "lender", "repayment_monthly", "term_remaining_years"]) {
        need("liabilities", "home." + f, has(home[f]));
      }
      need("liabilities", "home.has_offset", typeof home.has_offset === "boolean");
      if (home.has_offset === true) need("liabilities", "home.offset_balance", has(home.offset_balance));
    }
  }
  for (const p of props) {
    const secured = items.some(it => it.secured_against_asset_id && it.secured_against_asset_id === p.id);
    need("liabilities", "investments.properties[].loan", has(p.loan_balance) || secured, p, "investments");
  }
  for (const it of items) {
    need("liabilities", "debts.items[].type", has(it.type), it, "debts");
    need("liabilities", "debts.items[].purpose", has(it.purpose), it, "debts");
    need("liabilities", "debts.items[].borrower", has(it.borrower), it, "debts");
    need("liabilities", "debts.items[].balance", has(it.balance), it, "debts");
    const clearedCard = it.type === "credit_card" && it.cleared_monthly === true;
    if (it.type === "credit_card") need("liabilities", "debts.items[].cleared_monthly", typeof it.cleared_monthly === "boolean", it, "debts");
    if (!clearedCard && it.type !== "hecs_help") {
      need("liabilities", "debts.items[].rate_percent", has(it.rate_percent), it, "debts");
      need("liabilities", "debts.items[].minimum_monthly", has(it.minimum_monthly), it, "debts");
    }
    if (!UNSECURABLE.includes(it.type) && it.type !== "family_loan") {
      need("liabilities", "debts.items[].security", has(it.security), it, "debts");
    }
  }
  need("liabilities", "debts.hecs_balance", has(debts.hecs_balance) || items.some(it => it.type === "hecs_help"));
  sweep("liabilities", "other_debts");

  /* ── buffer ── */
  need("buffer", "buffer.accessible_savings", has(buf.accessible_savings));
  need("buffer", "buffer.where_held", has(buf.where_held));

  /* ── super ── */
  need("super", "super.funds", funds.length > 0);
  for (const f of funds) {
    need("super", "super.funds[].fund", has(f.fund), f, "super");
    need("super", "super.funds[].owner", has(f.owner), f, "super");
    need("super", "super.funds[].balance", has(f.balance), f, "super");
    need("super", "super.funds[].has_insurance", typeof f.has_insurance === "boolean", f, "super");
  }
  if (funds.length) need("super", "super.extra_contributions", typeof sup.extra_contributions === "boolean");
  sweep("super", "other_super");

  /* ── protection ── */
  // Per person (Devon, 17 Sept): each adult's four covers are their own
  // facts, so one person's gap is visible instead of averaged away.
  const covers = ["life", "tpd", "income_protection", "trauma"];
  const coverList = Array.isArray(prot.covers) ? prot.covers.filter(isObj) : [];
  const people = num(ctx.adults) !== null && ctx.adults >= 2 ? ["you", "partner"] : ["you"];
  for (const who of people) {
    for (const c of covers) {
      const cv = coverList.find(x => x.type === c && (x.owner || "you") === who) || { owner: who, type: c };
      need("protection", "protection.covers[].held", typeof cv.held === "boolean", cv, "protection");
      if (cv.held === true) {
        need("protection", "protection.covers[].amount", has(cv.amount), cv, "protection");
        need("protection", "protection.covers[].inside_super", typeof cv.inside_super === "boolean", cv, "protection");
      }
    }
  }
  // A fund with insurance inside it means some cover is held inside super.
  // If nothing in protection says so, the picture contradicts itself.
  if (funds.some(f => f.has_insurance === true) && !coverList.some(c => c.held === true && c.inside_super === true)) {
    need("protection", "protection.inside_super_detail", false);
  }

  /* ── estate ── */
  need("estate", "estate.will.in_place", isObj(est.will) && has(est.will.in_place));
  if (isObj(est.will) && est.will.in_place === true) need("estate", "estate.will.last_updated", has(est.will.last_updated));
  need("estate", "estate.poa.in_place", isObj(est.poa) && has(est.poa.in_place));
  if (kids && kids.length) need("estate", "estate.guardianship.in_place", isObj(est.guardianship) && has(est.guardianship.in_place));
  // A nomination per fund (Devon, 17 Sept): one household answer used to
  // overwrite the other fund's.
  for (const f of funds) {
    const nom = isObj(f.nomination) ? f.nomination : (funds.length === 1 && isObj(est.super_nomination) ? est.super_nomination : {});
    need("estate", "super.funds[].nomination.in_place", has(nom.in_place), f, "super");
    if (nom.in_place === true) {
      need("estate", "super.funds[].nomination.binding", typeof nom.binding === "boolean", f, "super");
      need("estate", "super.funds[].nomination.last_updated", has(nom.last_updated), f, "super");
    }
  }

  /* ── goals ── */
  need("goals", "goals.directions", Array.isArray(g.directions) && g.directions.length > 0);

  /* ── coverage ── */
  const covered = [];
  for (const a of AREAS) {
    const A = areas[a];
    A.sweeps_pending = A.sweeps.filter(s => !s.asked).map(s => s.id);
    A.covered = A.missing.length === 0 && A.sweeps_pending.length === 0;
    if (A.covered) covered.push(a);
  }

  /* ── situation map (shape only) ── */
  const signals = [];
  if (has(ctx.adults)) signals.push(couple ? "couple" : "single adult");
  if (kids) signals.push(kids.length ? kids.length + " child" + (kids.length === 1 ? "" : "ren") : "no children");
  if (has(inc.structure)) signals.push("income structure: " + inc.structure);
  if (hasEntity) signals.push("a company or trust is in the picture: gather its assets, its borrowing, and what it earns or pays out");
  if (typeof home.owns_home === "boolean") signals.push(ownsHome ? "owns the home" : "does not own the home");
  if (props.length) signals.push(props.length + " other propert" + (props.length === 1 ? "y" : "ies") + ": each needs value, whose name, use, loan, and its rent and costs");
  if (has(inv.shares_value) || has(inv.managed_funds_value)) signals.push("holds shares or funds: needs whose name and what they pay out");
  if (items.length) signals.push(items.length + " debt item" + (items.length === 1 ? "" : "s") + " beyond the home loan");
  if (funds.length) signals.push(funds.length + " super account" + (funds.length === 1 ? "" : "s"));
  if (funds.some(f => f.has_insurance === true)) signals.push("insurance sits inside super: find which covers and how much");

  // Shape phase: the household's shape is not yet mapped.
  const shapeOpen = [];
  if (!has(ctx.adults)) shapeOpen.push("who is in the household");
  if (kids === null) shapeOpen.push("children and ages");
  if (!has(inc.structure)) shapeOpen.push("how each income is earned (employee, own company, sole trader, trust)");
  if (typeof home.owns_home !== "boolean") shapeOpen.push("whether they own the home they live in");
  for (const id of ["other_assets", "other_debts", "other_super", "other_income"]) {
    if (!sweepsAsked.has(id)) shapeOpen.push("[SWEEP: " + id + "]");
  }
  const phase = shapeOpen.length ? "shape" : "trips";

  // Trips: missing + to_verify grouped by source, most items first.
  const tripMap = new Map();
  for (const a of AREAS) {
    for (const r of [...areas[a].missing.map(x => ({ ...x, status: "missing" })), ...areas[a].to_verify.map(x => ({ ...x, status: "to verify" }))]) {
      if (!tripMap.has(r.trip)) tripMap.set(r.trip, []);
      tripMap.get(r.trip).push({ ...r, area: a });
    }
  }
  const trips = [...tripMap.entries()]
    .map(([id, list]) => ({ id, where: TRIP_LABELS[id] || id, items: list }))
    .sort((x, y) => (x.id === "conversation") - (y.id === "conversation") || y.items.filter(i => i.status === "missing").length - x.items.filter(i => i.status === "missing").length);

  const missingAll = AREAS.flatMap(a => areas[a].missing.map(m => ({ ...m, area: a })));
  const deferredAll = AREAS.flatMap(a => areas[a].deferred.map(m => ({ ...m, area: a })));
  const toVerifyAll = AREAS.flatMap(a => areas[a].to_verify.map(m => ({ ...m, area: a })));
  const sweepsPending = AREAS.flatMap(a => areas[a].sweeps_pending);
  const allCovered = covered.length === AREAS.length;

  return {
    phase, signals, shapeOpen, areas, covered, trips,
    missing: missingAll, deferred: deferredAll, to_verify: toVerifyAll,
    sweeps_asked: [...sweepsAsked],
    sweeps_pending: sweepsPending,
    ledger: ledgerList,
    can_close: allCovered,
  };
}

/* The close list, written by code: every item stored from memory or as an
   estimate, and every item the person put off, with where it lives. */
export function closeListText(plan) {
  const where = t => TRIP_LABELS[t] || "a conversation";
  const lines = [];
  // "label, item" reads better as "Item: label".
  const bare = t => t.replace(/\s*\([^)]*\)\s*$/, "");
  const nice = l => { const i = l.lastIndexOf(", "); if (i === -1) { const b = bare(l); return b.charAt(0).toUpperCase() + b.slice(1); } const item = l.slice(i + 2); return item.charAt(0).toUpperCase() + item.slice(1) + ": " + bare(l.slice(0, i)); };
  for (const d of plan.deferred) lines.push("- " + nice(d.label) + ". Not gathered yet; it lives in " + where(d.trip) + ".");
  // Only figures that have a source to check against are listed (stand-in
  // run 4: yes/no details and "just a conversation" items cluttered it).
  for (const v of plan.to_verify) {
    if (!v.figure || v.trip === "conversation") continue;
    const how = v.confidence === "estimated" ? "Noted as an estimate"
      : (v.confidence === "stated" || (v.reason === "declined_source" && !v.confidence)) ? "Noted from memory"
      : "Not yet checked against its source";
    lines.push("- " + nice(v.label) + ". " + how + "; it can be confirmed from " + where(v.trip) + ".");
  }
  const uniq = [...new Set(lines)];
  return uniq.length ? uniq.join("\n") : "- Nothing is waiting on you. Every figure came from its source.";
}

/* The plan as the model's working notes. Compact, factual, no figures. */
export function planPromptSection(plan, opts = {}) {
  const L = [];
  L.push("\n\n═══ FINN'S WORKING NOTES (computed by code every turn; the person never sees this) ═══");
  L.push("Use these to decide what to ask next. They describe what the picture still NEEDS, never what anything means. Never select or prioritise a question because of the size of a figure.");
  L.push("Item references are shown as {field#item_id}; use exactly those in \"deferrals\" when the person puts one off.");
  L.push("Phase: " + (plan.phase === "shape" ? "SHAPE, map the household before gathering figures." : "TRIPS, gather figures one source at a time."));
  if (plan.signals.length) L.push("Household shape so far: " + plan.signals.join("; ") + ".");
  if (plan.shapeOpen.length) L.push("Shape still to map: " + plan.shapeOpen.join("; ") + ".");
  const areaLine = AREAS.map(a => {
    const A = plan.areas[a];
    if (A.covered) return a + " covered";
    const bits = [];
    if (A.missing.length) bits.push(A.missing.length + " missing");
    if (A.to_verify.length) bits.push(A.to_verify.length + " to verify");
    if (A.deferred.length) bits.push(A.deferred.length + " put off");
    if (A.sweeps_pending.length) bits.push("sweep not asked");
    return a + " (" + bits.join(", ") + ")";
  });
  L.push("Areas: " + areaLine.join("; ") + ".");
  if (plan.trips.length) {
    L.push("By source (take everything on one source in a single visit):");
    for (const t of plan.trips.slice(0, 8)) {
      const tag = i => i.label + " {" + i.field + (i.item_id ? "#" + i.item_id : "") + "}";
      const miss = t.items.filter(i => i.status === "missing").map(tag);
      const ver = t.items.filter(i => i.status === "to verify").map(tag);
      L.push("- " + t.where + ": " + [miss.length ? "missing: " + miss.slice(0, 10).join("; ") : "", ver.length ? "stored but unverified: " + ver.slice(0, 8).join("; ") : ""].filter(Boolean).join(" | "));
    }
  }
  if (plan.deferred.length) {
    L.push("Put off by the person (re-raise when it's easy to grab, e.g. they're already on that source; never push an item with 2 nudges): " +
      plan.deferred.map(x => x.label + " [nudges " + (x.nudges || 1) + "/2, field " + x.field + (x.item_id ? ", item " + x.item_id : "") + "]").slice(0, 14).join("; ") + ".");
  }
  if (plan.sweeps_pending.length) L.push("Sweeps not yet asked: " + plan.sweeps_pending.map(s => "[SWEEP: " + s + "]").join(" ") + ".");
  // The next move, stated plainly (the stand-in run showed the model
  // composing sweeps in its own words, which never count).
  const basicsKnown = !plan.shapeOpen.some(x => !x.startsWith("[SWEEP"));
  if (plan.phase === "shape" && basicsKnown && plan.sweeps_pending.length) {
    L.push("NEXT MOVE: your one question in this reply is [SWEEP: " + plan.sweeps_pending.find(x => ["other_assets", "other_debts", "other_super", "other_income"].includes(x)) + "], emitted as the token. Writing your own version of an 'anything else?' question does NOT count: the area stays uncovered and you will have to ask it again.");
  }
  if (plan.phase === "trips") {
    const firstMissing = plan.trips.map(t => ({ t, m: t.items.find(i => i.status === "missing") })).find(x => x.m);
    const servedSet = new Set(opts.servedPaths || []);
    const memory = plan.to_verify.find(v => ["stated", "estimated", "unrecorded"].includes(v.confidence) && v.trip !== "conversation" && !servedSet.has(v.trip));
    if (firstMissing) {
      L.push("NEXT MOVE: gather " + firstMissing.m.label + " {" + firstMissing.m.field + (firstMissing.m.item_id ? "#" + firstMissing.m.item_id : "") + "}" +
        (firstMissing.t.id !== "conversation" && !servedSet.has(firstMissing.t.id) ? ", opening with [ASK: " + firstMissing.t.id + "] so everything on that source comes in one visit" : "") +
        ". If the person says that's everything or wants to finish, do NOT wrap up: tell them plainly there are a few things still to cover, and carry on.");
    } else if (memory) {
      L.push("NEXT MOVE: " + memory.label + " came from memory; offer the source once with [ASK: " + memory.trip + "]. If they decline, record it in deferrals and move on.");
    } else if (plan.can_close) {
      L.push("NEXT MOVE: close. Emit [FRAME: close] on its own line; code appends the list of open items after it. Add one short warm line, say what happens next in one sentence (their picture is saved and they can come back to any open item), and set session_complete true. No verdicts, no 'well set up', no 'complete'.");
    }
  }
  if (opts.servedPaths && opts.servedPaths.length) {
    L.push("Sources already walked through this session (do not emit these [ASK] tokens again; if the person is stuck on one, help with the specific screen or menu in your own words): " + opts.servedPaths.join(", ") + ".");
  }
  L.push("Discipline, every reply: ONE question per reply. For a document-backed figure, emit the [ASK] token for its source first; never open with 'do you know roughly' or 'a rough sense'. Record everything the person says, including things that merely exist (a loan, a fund, a property, a cover) with no figures yet. Never compute a figure yourself. Never characterise a figure or a choice (no 'reasonable', 'solid', 'decent', 'doing double duty'). Never call any area or the picture complete. When the person skips something, the whole reply is [NUDGE: first] (or [NUDGE: accept] the second time) plus at most a short warm line; no new question in the same reply.");
  if (opts.unsaved && opts.unsaved.length) {
    L.push("Last turn these details did not save: " + opts.unsaved.slice(0, 8).join("; ") + ". Ask for them again naturally, owning it as your slip, and capture them correctly this time.");
  }
  L.push(plan.can_close
    ? "Closing: every area is covered. When the person is ready, emit [FRAME: close] then walk every item still to verify or put off, one line each with where it lives, then set session_complete true."
    : "Closing is NOT available yet: code will refuse session_complete until every area above is covered (each missing item gathered or put off by the person, every sweep asked). Do not wrap up, summarise as finished, or ask 'anything else before we wrap up' while items remain.");
  return L.join("\n");
}
