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
    .map((r) => ({ date: r.date, description: r.description, amount: Math.abs(r.amount), norm: normDesc(r.description) }));
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
      outliers.push({ id: "o" + (++oid), label: d.description, date: new Date(d.date).toISOString().slice(0, 10), amount: Math.round(d.amount), kind: kinds[0] });
    }
  }
  for (const r of recurring.filter(r => r.housing_candidate)) {
    outliers.push({ id: r.id, label: r.label, date: null, amount: r.total, kind: "housing_candidate", recurring: true });
  }

  const base = Math.round(nonRecurring.filter(d => !d.isOutlier).reduce((a, d) => a + d.amount, 0));

  return {
    coverage: { from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10), months },
    coverage_short: months < 11,
    account_count: parsedFiles.length,
    card_file_present: cardFilePresent,
    base_debits: base,           // span totals, not annualised — divide by coverage.months
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
