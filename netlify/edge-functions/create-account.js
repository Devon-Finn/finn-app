// Create-account edge function — the "payment succeeded → account exists"
// machinery (build step 2).
//
// Pay-first model: an account is only ever created after successful payment,
// and an account is a HOUSEHOLD (one or two members sharing one picture).
// This function creates, atomically-ish: the Supabase Auth user (with the
// password the person just chose), the household, the owner member, and the
// depth:clarity access row — plus the snapshot carry-over link if the account
// came from a completed anonymous snapshot.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ TEMPORARY TRIGGER (step 2 only): because Stripe isn't built yet (step   │
// │ 4), this endpoint is gated by FINN_TEST_TRIGGER_TOKEN instead of a      │
// │ verified Stripe event. Step 4 MUST replace the token gate with real     │
// │ Stripe webhook/session verification before any public checkout exists. │
// └─────────────────────────────────────────────────────────────────────────┘
//
// POST /api/create-account
//   { test_token, email, password, snapshot_id? }
//   → 200 { ok: true }            account ready; client signs in with password
//   → 409 { error: "email_exists" }  already a member — go log in
//   → 4xx/5xx { error: ... }

const rateLimitMap = new Map();
const RATE_LIMIT = 10; // per IP per hour — account creation is rare
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

// Minimal Supabase REST helper using the service role key.
async function sbFetch(path, init) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      ...(init.headers ?? {}),
    },
  });
  return res;
}

export default async function handler(request, context) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
  }

  const ip = context.ip ?? request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) return json({ error: "rate_limited" }, 429);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const triggerToken = Deno.env.get("FINN_TEST_TRIGGER_TOKEN");
  if (!supabaseUrl || !serviceKey) return json({ error: "not_configured" }, 500);
  // TEMPORARY gate — without the token env var, account creation is disabled.
  if (!triggerToken) return json({ error: "trigger_disabled" }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (typeof payload.test_token !== "string" || payload.test_token !== triggerToken) {
    return json({ error: "forbidden" }, 403);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const snapshotId =
    typeof payload.snapshot_id === "string" && UUID_RE.test(payload.snapshot_id.trim())
      ? payload.snapshot_id.trim()
      : null;

  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 8) return json({ error: "password_too_short" }, 400);

  // 1. Create the auth user with the chosen password. email_confirm: the
  //    email came from checkout in the real flow, so no confirmation email.
  const userRes = await sbFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!userRes.ok) {
    const t = await userRes.text();
    if (userRes.status === 422 || /already.*(registered|exists)/i.test(t)) {
      return json({ error: "email_exists" }, 409);
    }
    console.error(`[Finn create-account] auth user create failed — ${userRes.status}: ${t}`);
    return json({ error: "user_create_failed" }, 502);
  }
  const user = await userRes.json();
  const userId = user.id;

  // Best-effort rollback so a half-created account never strands the email.
  async function rollback() {
    try {
      await sbFetch(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    } catch (err) {
      console.error("[Finn create-account] rollback failed:", err);
    }
  }

  // 2. Household. display_name defaults from the email local part; the person
  //    names it properly later in settings, never at the account gate.
  const householdId = crypto.randomUUID();
  const displayName = email.split("@")[0];
  const hhRes = await sbFetch("/rest/v1/households", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      id: householdId,
      account_type: "individual",
      display_name: displayName,
      origin_snapshot_id: snapshotId,
    }),
  });
  if (!hhRes.ok) {
    console.error(`[Finn create-account] household insert failed — ${hhRes.status}: ${await hhRes.text()}`);
    await rollback();
    return json({ error: "household_create_failed" }, 502);
  }

  // 3. Owner member + clarity access. Pay-first: an account always means a
  //    paying customer, so depth is clarity from the start.
  const memberRes = await sbFetch("/rest/v1/members", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      id: userId,
      household_id: householdId,
      email,
      display_name: displayName,
      role: "owner",
    }),
  });
  const accessRes = memberRes.ok
    ? await sbFetch("/rest/v1/access", {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          household_id: householdId,
          depth: "clarity",
          clarity_purchased_at: new Date().toISOString(),
        }),
      })
    : null;
  if (!memberRes.ok || !accessRes || !accessRes.ok) {
    const failed = !memberRes.ok ? memberRes : accessRes;
    console.error(`[Finn create-account] member/access insert failed — ${failed?.status}: ${failed ? await failed.text() : "no response"}`);
    // households cascade-deletes members/access; auth user removed separately.
    try {
      await sbFetch(`/rest/v1/households?id=eq.${householdId}`, { method: "DELETE" });
    } catch {}
    await rollback();
    return json({ error: "account_create_failed" }, 502);
  }

  // 4. Carry-over link: point the anonymous snapshot session at its new
  //    household (foundation for step-3 answer carry-over). Non-fatal.
  if (snapshotId) {
    try {
      const linkRes = await sbFetch(`/rest/v1/snapshot_sessions?id=eq.${snapshotId}`, {
        method: "PATCH",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ household_id: householdId }),
      });
      if (!linkRes.ok) {
        console.error(`[Finn create-account] snapshot link failed — ${linkRes.status}: ${await linkRes.text()}`);
      }
    } catch (err) {
      console.error("[Finn create-account] snapshot link threw:", err);
    }
  }

  return json({ ok: true }, 200);
}
