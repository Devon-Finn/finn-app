/* CSV transaction engine — pure, deterministic, no I/O.
   The principle (Devon's spec): CODE does the arithmetic, the model does
   the judgment. No model call ever sees a raw row; this module turns bank
   CSV text into a summary of totals, recurring groups and the outliers
   that need a human answer, and applies the human's classifications back
   into a final figure. A model adding up 2,000 rows is approximately
   right and unverifiable — exactly the soft-number class this exists to
   remove.

   Everything here is testable by injection (no Deno APIs). */

const MONTH_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

/* Quote-aware line splitter for one CSV line with the given delimiter. */
function splitLine(line, delim) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

function sniffDelimiter(lines) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const l of lines.slice(0, 5)) {
    for (const d of [",", ";", "\t"]) counts[d] += splitLine(l, d).length - 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/* AU-first date parsing: DD/MM/YYYY, DD-MM-YY, YYYY-MM-DD, D MMM YYYY. */
function parseDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return Date.UTC(y, mo - 1, d);
    return null;
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{2,4})$/);
  if (m) {
    const mo = MONTH_NAMES[m[2].toLowerCase()];
    if (mo) return Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], mo - 1, +m[1]);
  }
  return null;
}

function parseAmount(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (t === "" || t === "-") return null;
  const v = Number(t);
  return isFinite(v) ? v : null;
}

const HEADER_HINTS = {
  date: /^(date|transaction date|value date|posted|effective date)$/i,
  description: /^(description|narrative|details|transaction( details| description)?|memo|payee)$/i,
  amount: /^(amount|value|transaction amount)$/i,
  debit: /^(debit|debit amount|withdrawal|withdrawals?|money out|spent)$/i,
  credit: /^(credit|credit amount|deposit|deposits?|money in|received)$/i,
  drcr: /^(dr\/cr|cr\/dr|type|indicator)$/i,
};

/* Parse one CSV file. Returns { rows, isCard, headerless } or { error, detail }.
   Row amounts are SIGNED with outflows NEGATIVE. */
export function parseCsvText(name, text) {
  const clean = stripBom(String(text)).replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter(l => l.trim() !== "");
  if (lines.length < 2) return { error: "empty_file", detail: `${name}: no transaction rows found` };
  const delim = sniffDelimiter(lines);

  // Header detection: a first line with no parseable date and at least one
  // recognisable header word. Some banks (CBA) export headerless.
  const first = splitLine(lines[0], delim);
  const firstIsHeader = parseDate(first[0]) === null &&
    first.some(c => Object.values(HEADER_HINTS).some(re => re.test(c)));

  let cols = { date: -1, description: -1, amount: -1, debit: -1, credit: -1, drcr: -1 };
  let dataStart = 0;
  if (firstIsHeader) {
    dataStart = 1;
    first.forEach((c, i) => {
      for (const [key, re] of Object.entries(HEADER_HINTS)) {
        if (re.test(c) && cols[key] === -1) cols[key] = i;
      }
    });
    if (cols.date === -1) {
      return { error: "no_date_column", detail: `${name}: couldn't identify a date column — headers seen: ${first.join(", ")}` };
    }
    if (cols.amount === -1 && cols.debit === -1 && cols.credit === -1) {
      return { error: "no_amount_column", detail: `${name}: couldn't identify an amount column — headers seen: ${first.join(", ")}` };
    }
    if (cols.description === -1) {
      // Fall back to the widest text column that isn't date/amount.
      cols.description = first.findIndex((_, i) => ![cols.date, cols.amount, cols.debit, cols.credit, cols.drcr].includes(i));
    }
  } else {
    // Headerless: assume the common CBA shape date, amount, description[, balance].
    cols = { date: 0, amount: 1, description: 2, debit: -1, credit: -1, drcr: -1 };
  }

  const rows = [];
  let failed = 0;
  const badLines = [];
  for (let i = dataStart; i < lines.length; i++) {
    const parts = splitLine(lines[i], delim);
    const dateTs = parseDate(parts[cols.date]);
    let amount = null;
    if (cols.amount !== -1) {
      amount = parseAmount(parts[cols.amount]);
      if (amount !== null && cols.drcr !== -1) {
        const flag = String(parts[cols.drcr] || "").trim().toUpperCase();
        if (flag.startsWith("D")) amount = -Math.abs(amount);
        else if (flag.startsWith("C")) amount = Math.abs(amount);
      }
    } else {
      const d = parseAmount(parts[cols.debit]);
      const c = parseAmount(parts[cols.credit]);
      if (d !== null && d !== 0) amount = -Math.abs(d);
      else if (c !== null && c !== 0) amount = Math.abs(c);
    }
    if (dateTs === null || amount === null) {
      failed++;
      if (badLines.length < 3) badLines.push(lines[i].slice(0, 120));
      continue;
    }
    rows.push({ date: dateTs, description: String(parts[cols.description] ?? "").trim(), amount, file: name });
  }
  const total = rows.length + failed;
  if (!rows.length) return { error: "no_parseable_rows", detail: `${name}: no rows parsed — first offending lines: ${badLines.join(" | ")}` };
  if (failed / total > 0.02) {
    return { error: "too_many_bad_rows", detail: `${name}: ${failed} of ${total} rows failed to parse — first offending lines: ${badLines.join(" | ")}` };
  }

  // Card-file detection: filename hint, or credits matching payment-received
  // patterns (payments TO the card appear as credits on a card statement).
  const isCard = /card|credit|visa|master|amex/i.test(name) ||
    rows.some(r => r.amount > 0 && /(payment|pymt).{0,20}(receiv|thank)/i.test(r.description));

  return { rows, isCard, headerless: !firstIsHeader };
}

/* Description normalisation for grouping: case-fold, strip digits, refs,
   dates and card suffixes. */
function normDesc(s) {
  return String(s).toLowerCase()
    .replace(/\b(ref|receipt|txn|id)[:# ]?\S+/g, " ")
    .replace(/\d{2,}/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim().slice(0, 60);
}

const TRANSFER_RE = /(transfer (to|from)|internal transfer|\btfr\b|linked ac|own account)/i;
const HOUSING_RE = /(rent(al)?\b|mortgage|home ?loan|loan (repay|pymt|payment)|\bathena\b|\bunloan\b)/i;
// Both word orders: "MASTERCARD PAYMENT" and "PAYMENT MASTERCARD 1234".
const CARD_PAYMENT_RE = /((credit ?card|mastercard|visa|amex|card) ?(payment|pymt|autopay)|(payment|pymt) ?(of|to)? ?.{0,15}\b(credit ?card|mastercard|visa|amex|card)\b|bpay .{0,20}card\b)/i;

const DAY = 86400000;

/* ── Where the money goes (Devon, 16 Sept 2026) ──
   Each spending row is sorted into one of a FIXED set of categories by the
   merchant text, first match wins. This is description, never judgment:
   the categories exist so a person can see where their money goes, and
   nothing downstream ever calls a category high, low or too much.
   Budgeting stays an input to the surplus, not a feature. */
export const SPEND_CATEGORIES = [
  { key: "groceries",      label: "Groceries" },
  { key: "eating_out",     label: "Eating out and takeaway" },
  { key: "transport",      label: "Car and transport" },
  { key: "utilities",      label: "Power, water, phone and internet" },
  { key: "insurance",      label: "Insurance" },
  { key: "health",         label: "Health and medical" },
  { key: "kids_education", label: "Kids, school and childcare" },
  { key: "home_costs",     label: "Rates, strata and home upkeep" },
  { key: "shopping",       label: "Shopping and household" },
  { key: "leisure",        label: "Subscriptions, fitness and leisure" },
  { key: "travel",         label: "Travel and holidays" },
  { key: "other",          label: "Everything else" },
];
export const SPEND_CATEGORY_KEYS = SPEND_CATEGORIES.map(c => c.key);

const CATEGORY_RULES = [
  ["travel", /(qantas|virgin ?australia|jetstar|rex airlines|airbnb|booking\.com|expedia|hotels?\.com|wotif|webjet|flight ?centre|\bmotel\b|resort|holiday|caravan park|big4|discovery parks|spirit of tasmania|cruise)/i],
  ["insurance", /(insurance|insur\b|\baami\b|allianz|\bnrma ins|youi|budget direct|\bgio\b|suncorp ins|\bqbe\b|\bcgu\b|real insurance|\bbupa\b|medibank|\bhcf\b|\bnib\b|\bahm\b|hbf|teachers health|\bgmhba\b|health fund|clearview|tal life|\bmlc\b|\bzurich\b|\baia\b|premium)/i],
  ["groceries", /(woolworths|woolies|coles(?! ?express)|\baldi\b|\biga\b|foodworks|harris farm|costco|drakes|romeo'?s|spudshed|friendly grocer|supermarket|butcher|bakers? delight|green ?grocer|fruit ?(and|&) ?veg)/i],
  ["eating_out", /(mcdonald|hungry jack|\bkfc\b|domino|pizza|subway|guzman|grill'?d|nando|oporto|red rooster|zambrero|uber\W*eats|doordash|menulog|deliveroo|\bcafe\b|caf[eé]|coffee|espresso|restaurant|\bbar\b|\bpub\b|hotel bistro|bistro|takeaway|sushi|kebab|thai|noodle|bakery|donut|boost juice|starbucks|gloria jean)/i],
  ["transport", /(\bbp\b|ampol|caltex|\bshell\b|coles ?express|7-?eleven|united petrol|puma energy|liberty oil|metro petroleum|\bfuel\b|petrol|linkt|e-?toll|eastlink|citylink|transurban|\bmyki\b|\bopal\b|go ?card|translink|public transport|parking|secure parking|wilson parking|\buber\b(?!\W*eats)|\bdidi\b|\bola\b|\btaxi\b|13cabs|vicroads|transport for nsw|service nsw rego|registration|\brego\b|\btac\b|mydealer|autobarn|supercheap|repco|ultra tune|mycar|tyre|mechanic|car wash|\bracv\b|\bnrma\b|\bracq\b|\braa\b|\brac\b)/i],
  ["utilities", /(\bagl\b|origin energy|energy ?australia|red energy|lumo|alinta|powershop|simply energy|momentum energy|tango energy|globird|dodo|ovo energy|\bpower\b|electricity|\bgas\b|yarra valley water|sydney water|south east water|city west water|barwon water|gippsland water|unitywater|icon water|sa water|water corp|\bwater\b|telstra|optus|vodafone|\btpg\b|iinet|aussie ?broadband|belong|amaysim|boost mobile|\bnbn\b|internet|mobile plan)/i],
  ["health", /(chemist|pharmacy|priceline|terry white|amcal|blooms|medical|\bclinic\b|\bgp\b|doctor|dental|dentist|orthodont|physio|chiro|osteo|pathology|radiology|imaging|hospital|optometr|specsavers|opsm|psycholog|medicare|vet(erinary)?\b|\bvet\b)/i],
  ["kids_education", /(school|college|grammar|primary|secondary|childcare|child care|early learning|kindergarten|\bkinder\b|oshc|before and after school|tuition|tutor|kumon|swim(ming)? school|uniform|\bdance\b|scouts|little athletics|football club|netball|cricket club|soccer club|university|tafe|\bhecs\b)/i],
  ["home_costs", /(council|\brates\b|shire of|city of|strata|owners corp|body corporate|bunnings|mitre ?10|home ?hardware|plumb|electrician|handyman|pest|garden|landscap|cleaning|cleaner|locksmith|hipages|airtasker)/i],
  ["leisure", /(netflix|stan\b|stan\.com|binge|kayo|foxtel|disney|spotify|apple\.com|itunes|google ?(play|one|storage)|youtube|amazon prime|paramount|audible|playstation|xbox|nintendo|steam|\bgym\b|fitness|anytime fitness|f45|snap fitness|jetts|goodlife|yoga|pilates|cinema|hoyts|village cinemas|event cinemas|ticketek|ticketmaster|golf|bowls|club\b|patreon|chatgpt|openai|microsoft|adobe|dropbox)/i],
  ["shopping", /(kmart|\bbig w\b|target|myer|david jones|jb ?hi-?fi|harvey norman|the good guys|officeworks|amazon|ebay|catch\.com|temu|shein|\biconic\b|cotton on|uniqlo|h&m|zara|rebel|\bbcf\b|anaconda|spotlight|lincraft|ikea|fantastic furniture|freedom|adairs|house\b|petbarn|pet stock|petstock|chemist warehouse|dan murphy|bws|liquorland|first choice liquor|bottle ?shop|newsagen|australia post|auspost|best & less|lowes|rivers|payless|athlete'?s foot|hairdress|barber|salon|beauty|nails|afterpay|zip ?pay|zip ?money|humm|klarna)/i],
];

// Once-a-year bills: named here so the tile can say what spreads across
// the year. Presence only; nothing is judged.
const ANNUAL_RE = /(\brego\b|registration|vicroads|\btac\b|council|\brates\b|insurance|premium|school fees?|term fees?|land tax|strata|owners corp|body corporate|membership|annual)/i;

// Plain names for once-a-year bills, never the bank's raw text.
const ANNUAL_TERMS = [
  [/(\brego\b|registration|vicroads|\btac\b)/i, "car rego"],
  [/(home|house|contents|building)\W*(and\W*contents\W*)?insur/i, "home insurance"],
  [/(car|motor|vehicle|comprehensive)\W*insur/i, "car insurance"],
  [/(health|medibank|bupa|\bhcf\b|\bnib\b|\bahm\b)/i, "health insurance"],
  [/(insurance|premium)/i, "insurance"],
  [/(council|\brates\b)/i, "council rates"],
  [/(school fees?|term fees?)/i, "school fees"],
  [/land tax/i, "land tax"],
  [/(strata|owners corp|body corporate)/i, "strata"],
  [/(membership|annual)/i, "memberships"],
];
function annualTerm(description) {
  for (const [re, term] of ANNUAL_TERMS) if (re.test(description)) return term;
  return null;
}

export function categorise(description) {
  const d = String(description || "");
  for (const [key, re] of CATEGORY_RULES) if (re.test(d)) return key;
  return "other";
}
const emptyCats = () => Object.fromEntries(SPEND_CATEGORY_KEYS.map(k => [k, 0]));

/* Summarise parsed files into the model-facing shape. Deterministic. */
export function summarise(parsedFiles) {
  const cardFilePresent = parsedFiles.some(f => f.isCard);
  const all = parsedFiles.flatMap(f => f.rows.map(r => ({ ...r, fromCard: f.isCard })));
  if (!all.length) return { error: "no_rows", detail: "nothing parsed" };

  const dates = all.map(r => r.date);
  const from = Math.min(...dates), to = Math.max(...dates);
  const months = Math.max(1, Math.round(((to - from) / DAY / 30.44) * 10) / 10);

  // 1. Cross-file internal transfers: equal-and-opposite within 3 days.
  const excluded = { transfers: [], card_payments: [] };
  const used = new Set();
  const outs = all.map((r, i) => ({ r, i })).filter(x => x.r.amount < 0);
  const ins = all.map((r, i) => ({ r, i })).filter(x => x.r.amount > 0);
  for (const o of outs) {
    if (used.has(o.i)) continue;
    const match = ins.find(x => !used.has(x.i) && x.r.file !== o.r.file &&
      Math.abs(x.r.amount + o.r.amount) < 0.01 && Math.abs(x.r.date - o.r.date) <= 3 * DAY);
    if (match) {
      used.add(o.i); used.add(match.i);
      excluded.transfers.push({ amount: Math.abs(o.r.amount), description: o.r.description });
    }
  }

  // 2. Card payments from ACCOUNT files when a card statement is also in
  //    the set: the card's own transactions are the spending; counting the
  //    payment too double-counts (Devon's addition). Without a card file,
  //    the payment stays — it is the proxy for that spending.
  all.forEach((r, i) => {
    if (used.has(i) || r.amount >= 0 || r.fromCard) return;
    if (cardFilePresent && CARD_PAYMENT_RE.test(r.description)) {
      used.add(i);
      excluded.card_payments.push({ amount: Math.abs(r.amount), description: r.description });
    }
  });
  // Payments arriving ON the card statement (credits) are never spending.
  all.forEach((r, i) => { if (!used.has(i) && r.fromCard && r.amount > 0) used.add(i); });

  const debits = all.filter((r, i) => !used.has(i) && r.amount < 0)
    .map((r) => ({ date: r.date, description: r.description, amount: Math.abs(r.amount), norm: normDesc(r.description), category: categorise(r.description) }));
  const creditsTotal = all.filter((r, i) => !used.has(i) && r.amount > 0 && !r.fromCard)
    .reduce((a, r) => a + r.amount, 0);

  // 3. Recurring groups: >=3 occurrences, stable cadence (+-4 days around
  //    weekly/fortnightly/monthly/quarterly), stable amount (+-15%).
  const groups = new Map();
  for (const d of debits) {
    if (!groups.has(d.norm)) groups.set(d.norm, []);
    groups.get(d.norm).push(d);
  }
  const recurring = [];
  const recurringNorms = new Set();
  const CADENCES = [[7, "weekly"], [14, "fortnightly"], [30.44, "monthly"], [91.3, "quarterly"]];
  let rid = 0;
  for (const [norm, items] of groups) {
    if (items.length < 3 || !norm) continue;
    items.sort((a, b) => a.date - b.date);
    const gaps = items.slice(1).map((it, i) => (it.date - items[i].date) / DAY);
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const cadence = CADENCES.find(([days]) => Math.abs(meanGap - days) <= 4);
    const amounts = items.map(i => i.amount);
    const meanAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stableAmt = amounts.every(a => Math.abs(a - meanAmt) <= meanAmt * 0.15);
    if (cadence && stableAmt) {
      recurringNorms.add(norm);
      recurring.push({
        id: "r" + (++rid),
        label: items[0].description,
        cadence: cadence[1],
        typical_amount: Math.round(meanAmt),
        total: Math.round(items.reduce((a, i) => a + i.amount, 0)),
        count: items.length,
        category: items[0].category,
        housing_candidate: HOUSING_RE.test(items[0].description),
      });
    }
  }

  // 4. Outliers: large one-offs (top decile, min $500), transfer suspects,
  //    housing candidates — flagged for the human answer, never silently
  //    dropped. Recurring housing candidates become outliers too, because
  //    only the person knows the mortgage from the rent from the gym.
  const nonRecurring = debits.filter(d => !recurringNorms.has(d.norm));
  const sortedAmts = nonRecurring.map(d => d.amount).sort((a, b) => b - a);
  const decileCut = sortedAmts.length ? sortedAmts[Math.floor(sortedAmts.length / 10)] : Infinity;
  const threshold = Math.max(500, decileCut);
  const outliers = [];
  let oid = 0;
  for (const d of nonRecurring) {
    const kinds = [];
    if (TRANSFER_RE.test(d.description)) kinds.push("transfer_suspect");
    if (HOUSING_RE.test(d.description)) kinds.push("housing_candidate");
    if (d.amount >= threshold) kinds.push("large_one_off");
    if (kinds.length) {
      d.isOutlier = true;
      outliers.push({ id: "o" + (++oid), label: d.description, date: new Date(d.date).toISOString().slice(0, 10), amount: Math.round(d.amount), kind: kinds[0], category: d.category, annual_term: annualTerm(d.description) });
    }
  }
  for (const r of recurring.filter(r => r.housing_candidate)) {
    outliers.push({ id: r.id, label: r.label, date: null, amount: r.total, kind: "housing_candidate", recurring: true, category: r.category });
  }

  const baseRows = nonRecurring.filter(d => !d.isOutlier);
  const base = Math.round(baseRows.reduce((a, d) => a + d.amount, 0));
  const baseByCategory = emptyCats();
  for (const d of baseRows) baseByCategory[d.category] += d.amount;
  for (const k of SPEND_CATEGORY_KEYS) baseByCategory[k] = Math.round(baseByCategory[k]);
  // Once-a-year bills among the non-recurring rows (outliers resolved as
  // housing or transfers are removed client-side; these never are).
  // Outliers are counted client-side once the person classifies them, so
  // only the rows already in the base are counted here.
  const annualRows = baseRows.filter(d => ANNUAL_RE.test(d.description) && !HOUSING_RE.test(d.description) && !TRANSFER_RE.test(d.description));
  const annualByLabel = new Map();
  for (const d of annualRows) {
    const label = annualTerm(d.description) || "other yearly bills";
    annualByLabel.set(label, { label, total: (annualByLabel.get(label)?.total || 0) + d.amount });
  }
  const annual = [...annualByLabel.values()].sort((a, b) => b.total - a.total);

  return {
    coverage: { from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10), months },
    coverage_short: months < 11,
    account_count: parsedFiles.length,
    card_file_present: cardFilePresent,
    base_debits: base,           // span totals, not annualised — divide by coverage.months
    base_by_category: baseByCategory,
    annual_bills: { total: Math.round(annual.reduce((a, x) => a + x.total, 0)), labels: annual.slice(0, 5).map(x => x.label) },
    recurring: recurring.map(({ housing_candidate, ...r }) => r),
    outliers,
    credits_total: Math.round(creditsTotal),
    excluded: {
      transfer_pairs: excluded.transfers.length,
      transfer_total: Math.round(excluded.transfers.reduce((a, t) => a + t.amount, 0)),
      card_payments: excluded.card_payments.length,
      card_payments_total: Math.round(excluded.card_payments.reduce((a, t) => a + t.amount, 0)),
    },
  };
}

/* Resolution arithmetic lives CLIENT-side (public/app/shared/
   finn-transactions.js) per spec §7 — the endpoint never applies
   resolutions, it only summarises. */
