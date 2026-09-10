// Import-transactions edge function — the deterministic half of the CSV
// living-costs path (Devon's spec, 2026-09-10).
//
// CODE does the arithmetic, the model does the judgment: this endpoint
// parses bank CSV exports, normalises dates/amounts/debit conventions,
// excludes cross-account transfers and card payments whose card statement
// is also uploaded, detects recurring groups, and returns a SUMMARY of
// totals plus the outliers that need a human answer. No model call ever
// sees a raw row.
//
// READ AND DISCARD, absolutely: the CSV text is parsed in memory and the
// summary returned in the same response. Nothing is stored — no table, no
// log, no capture. Only the figures the person later confirms land in
// their picture, through the normal capture path.
//
// POST /api/import-transactions   (same auth gate as clarity-chat)
//   { files: [{ name, csv_text }] }     max 6 files, 8MB each
//   → 200 { summary }                    per finn-csv-engine.summarise
//   → 422 { error, detail }              parse rejection, specific
//   → 401 / 403 / 4xx as clarity-chat

import { parseCsvText, summarise } from "./lib/finn-csv-engine.js";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function sbFetch(path, init = {}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      ...(init.headers ?? {}),
    },
  });
}

async function authenticate(request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user?.id) return null;
  const memberRes = await sbFetch(`/rest/v1/members?id=eq.${user.id}&select=household_id`);
  const members = memberRes.ok ? await memberRes.json() : [];
  if (!members.length) return null;
  const householdId = members[0].household_id;
  const accessRes = await sbFetch(`/rest/v1/access?household_id=eq.${householdId}&select=depth`);
  const access = accessRes.ok ? await accessRes.json() : [];
  const depth = access.length ? access[0].depth : null;
  return { userId: user.id, householdId, depth };
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
  }

  const auth = await authenticate(request);
  if (!auth) return json({ error: "unauthorized" }, 401);
  if (auth.depth !== "clarity" && auth.depth !== "subscription") {
    return json({ error: "forbidden" }, 403);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const files = Array.isArray(payload.files) ? payload.files : [];
  if (!files.length) return json({ error: "no_files" }, 400);
  if (files.length > MAX_FILES) return json({ error: "too_many_files", detail: `max ${MAX_FILES}` }, 400);

  const parsed = [];
  for (const f of files) {
    const name = typeof f?.name === "string" ? f.name.slice(0, 120) : "statement.csv";
    const text = typeof f?.csv_text === "string" ? f.csv_text : "";
    if (!text) return json({ error: "empty_file", detail: `${name}: no content` }, 422);
    if (text.length > MAX_FILE_BYTES) return json({ error: "file_too_large", detail: `${name}: over 8MB` }, 422);
    const res = parseCsvText(name, text);
    if (res.error) return json({ error: res.error, detail: res.detail }, 422);
    parsed.push(res);
  }

  const summary = summarise(parsed);
  if (summary.error) return json({ error: summary.error, detail: summary.detail }, 422);
  return json({ summary }, 200);
}
