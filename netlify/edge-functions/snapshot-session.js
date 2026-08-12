// Snapshot-session edge function — persistence for the anonymous demo-mode
// snapshot at /app/snapshot. All writes to public.snapshot_sessions go through
// here using the service_role key (the table has RLS enabled with no policies,
// so clients can never touch it directly). Same non-blocking philosophy as the
// rest of the stack: a failure here must never break the visitor's experience,
// so callers treat every response as fire-and-forget.
//
// Actions (POST JSON { action, ... }):
//   create   { source? }          → { id }   new in_progress row
//   update   { id, answers }      → { ok }   save answers as they go
//   complete { id, answers }      → { ok }   final answers + completed_at + status
//   email    { id, email }        → { ok }   attach email to the session

const rateLimitMap = new Map();
const RATE_LIMIT = 60; // per IP per hour — a full completion is ~25 calls
const WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) ?? { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ANSWERS_JSON = 20000; // answers payload cap — 19 short answers is ~2kB

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// Validated answers object → JSON string, or null if unusable.
function answersJson(answers) {
  if (answers === undefined || answers === null) return "{}";
  if (typeof answers !== "object" || Array.isArray(answers)) return null;
  const s = JSON.stringify(answers);
  if (s.length > MAX_ANSWERS_JSON) return null;
  return s;
}

async function supabase(method, path, body) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[Finn session] missing env var — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return false;
  }
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[Finn session] ${method} ${path} failed — status ${res.status}, body: ${t}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Finn session] ${method} ${path} threw:`, err);
    return false;
  }
}

export default async function handler(request, context) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
  }

  const ip = context.ip ?? request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return json({ error: "rate_limited" }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = payload.action;
  const now = new Date().toISOString();

  if (action === "create") {
    const id = crypto.randomUUID();
    const source = typeof payload.source === "string" ? payload.source.slice(0, 500) : null;
    const ok = await supabase("POST", "snapshot_sessions", {
      id,
      answers: {},
      status: "in_progress",
      source,
    });
    return ok ? json({ id }, 200) : json({ error: "create_failed" }, 502);
  }

  // Everything below operates on an existing row.
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!UUID_RE.test(id)) return json({ error: "invalid_id" }, 400);
  const patchPath = `snapshot_sessions?id=eq.${id}`;

  if (action === "update" || action === "complete") {
    const aj = answersJson(payload.answers);
    if (aj === null) return json({ error: "invalid_answers" }, 400);
    const patch = { answers: JSON.parse(aj), updated_at: now };
    if (action === "complete") {
      patch.status = "completed";
      patch.completed_at = now;
    }
    const ok = await supabase("PATCH", patchPath, patch);
    return ok ? json({ ok: true }, 200) : json({ error: "update_failed" }, 502);
  }

  if (action === "email") {
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
    const ok = await supabase("PATCH", patchPath, { email, updated_at: now });
    return ok ? json({ ok: true }, 200) : json({ error: "update_failed" }, 502);
  }

  return json({ error: "invalid_action" }, 400);
}
