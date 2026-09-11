// Conduct-report edge function — capture-conduct step 6, the read/run
// surface for the conduct linter.
//
// The linter runs automatically when a session completes (clarity-chat
// triggers it on session_complete). This endpoint covers the other two
// needs: reading a stored report, and running the pass on demand for a
// session that never completed (a walk cut short is still a walk).
//
// GET  /api/conduct-report?session_id=<uuid>   latest stored report
// POST /api/conduct-report  { session_id }     run now, store, return
// Both JWT-gated to the member's own household, like clarity-chat.

import { FIELD_REGISTRY, CONFIDENCE_RANK, PRODUCERS } from "./lib/finn-field-registry.js";
import { RETRIEVAL_PATHS, assertRequiredServable } from "./lib/finn-retrieval-paths.js";
import { runConductLinter } from "./lib/finn-conduct-linter.js";

assertRequiredServable(FIELD_REGISTRY, RETRIEVAL_PATHS);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  return { userId: user.id, householdId: members[0].household_id };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function runAndStore(householdId, sessionId) {
  const rowsRes = await sbFetch(
    `/rest/v1/capture_log?household_id=eq.${householdId}&session_id=eq.${sessionId}` +
    `&select=status,raw_text,capture,errors,field_id,created_at&order=created_at.asc`);
  const rows = rowsRes.ok ? await rowsRes.json() : [];
  const picRes = await sbFetch(`/rest/v1/picture?household_id=eq.${householdId}&select=domains,refusals`);
  const pics = picRes.ok ? await picRes.json() : [];
  const picture = pics[0] || { domains: {}, refusals: [] };
  const report = runConductLinter({
    rows, picture,
    registry: FIELD_REGISTRY,
    paths: RETRIEVAL_PATHS,
    confidenceRank: CONFIDENCE_RANK,
    producers: PRODUCERS,
  });
  const ins = await sbFetch(`/rest/v1/conduct_report`, {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({ household_id: householdId, session_id: sessionId, report }),
  });
  if (!ins.ok) console.error(`[Finn conduct] report store failed — ${ins.status}: ${await ins.text()}`);
  return report;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const auth = await authenticate(request);
  if (!auth) return json({ error: "unauthorised" }, 401);

  if (request.method === "GET") {
    const sessionId = new URL(request.url).searchParams.get("session_id");
    if (!sessionId || !UUID.test(sessionId)) return json({ error: "session_id_required" }, 400);
    const res = await sbFetch(
      `/rest/v1/conduct_report?household_id=eq.${auth.householdId}&session_id=eq.${sessionId}` +
      `&select=report,created_at&order=created_at.desc&limit=1`);
    const rows = res.ok ? await res.json() : [];
    if (!rows.length) return json({ error: "no_report" }, 404);
    return json({ report: rows[0].report, created_at: rows[0].created_at }, 200);
  }

  if (request.method === "POST") {
    let payload;
    try { payload = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
    const sessionId = payload && payload.session_id;
    if (!sessionId || !UUID.test(String(sessionId))) return json({ error: "session_id_required" }, 400);
    const report = await runAndStore(auth.householdId, sessionId);
    return json({ report }, 200);
  }

  return json({ error: "method_not_allowed" }, 405);
}
