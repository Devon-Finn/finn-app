// Subscribe edge function — pushes email signups into MailerLite so the email
// automations actually receive people. Reads MAILERLITE_API_KEY server-side only.
//
// Two audiences, chosen by `type` (group IDs are held here, never sent by the
// client, so a caller can only pick a known audience — not an arbitrary group):
//   type "snapshot" → add to Snapshot Completers, set snapshot_id field (when a
//                     valid UUID is supplied), AND remove from Homepage—No Snapshot
//                     (the "graduation" handoff so they stop getting the
//                     "go do the snapshot" sequence).
//   type "homepage" → add to Homepage—No Snapshot only, no snapshot_id.
//
// MailerLite work runs in the background (context.waitUntil) and never throws to
// the caller — same non-blocking pattern as the Supabase snapshot save. A
// MailerLite outage must never break the signup experience.

const MAILERLITE_API = "https://connect.mailerlite.com/api";

// NOTE: group IDs are kept as STRINGS on purpose — they exceed JS's safe integer
// range (Number.MAX_SAFE_INTEGER), so treating them as numbers would corrupt them.
const GROUPS = {
  SNAPSHOT_COMPLETERS: "189406100807746827",
  HOMEPAGE_NO_SNAPSHOT: "189407077071848962",
};

// Light in-memory rate limit: 20 subscribes per IP per hour (per edge instance).
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Upsert subscriber into MailerLite. POST /subscribers creates a new subscriber
// or updates an existing one (upsert) and assigns them to the given group.
// Returns the subscriber id, or null on failure (logged).
async function upsertSubscriber(apiKey, email, fields, groupId) {
  const body = { email, groups: [groupId] };
  if (fields && Object.keys(fields).length) body.fields = fields;

  const res = await fetch(`${MAILERLITE_API}/subscribers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`[Finn subscribe] MailerLite upsert failed — status ${res.status}, body: ${t}`);
    return null;
  }
  const data = await res.json().catch(() => null);
  return data?.data?.id ?? null;
}

// Remove subscriber from a group (the graduation handoff). Logged-only on failure;
// a 404 just means they weren't in that group, which is fine.
async function removeFromGroup(apiKey, subscriberId, groupId) {
  try {
    const res = await fetch(`${MAILERLITE_API}/subscribers/${subscriberId}/groups/${groupId}`, {
      method: "DELETE",
      headers: { "Accept": "application/json", "Authorization": `Bearer ${apiKey}` },
    });
    if (!res.ok && res.status !== 404) {
      const t = await res.text();
      console.error(`[Finn subscribe] remove-from-group failed — status ${res.status}, body: ${t}`);
    }
  } catch (err) {
    console.error("[Finn subscribe] remove-from-group threw:", err);
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

  const apiKey = Deno.env.get("MAILERLITE_API_KEY");
  if (!apiKey) {
    console.error("[Finn subscribe] MAILERLITE_API_KEY not set — skipping MailerLite push");
    // Soft-fail: never break the caller just because the key is missing.
    return json({ ok: false, error: "not_configured" }, 200);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const type = payload.type;

  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
  if (type !== "snapshot" && type !== "homepage") return json({ error: "invalid_type" }, 400);

  // Run the MailerLite work in the background so the caller's UX never waits on
  // it and never fails because of it.
  const work = (async () => {
    try {
      if (type === "homepage") {
        await upsertSubscriber(apiKey, email, null, GROUPS.HOMEPAGE_NO_SNAPSHOT);
        return;
      }

      // type === "snapshot": attach snapshot_id only when a real UUID was supplied.
      const fields = {};
      const snapshotId = typeof payload.snapshot_id === "string" ? payload.snapshot_id.trim() : "";
      if (UUID_RE.test(snapshotId)) {
        fields.snapshot_id = snapshotId;
      } else if (snapshotId) {
        console.error(`[Finn subscribe] snapshot type but snapshot_id not a UUID: "${snapshotId}" — subscribing without it`);
      }

      const subId = await upsertSubscriber(apiKey, email, fields, GROUPS.SNAPSHOT_COMPLETERS);
      // Graduation: stop the "go do the snapshot" sequence for this person.
      if (subId) await removeFromGroup(apiKey, subId, GROUPS.HOMEPAGE_NO_SNAPSHOT);
    } catch (err) {
      console.error("[Finn subscribe] background work threw:", err);
    }
  })();

  context.waitUntil(work);

  return json({ ok: true }, 200);
}
