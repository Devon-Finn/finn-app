// Clarity-chat edge function — the paid Clarity Session conversation (3a).
//
// This is the first place real personal financial figures flow through the
// product, so the posture is the strictest yet:
//   * The caller must present a valid Supabase session token, belong to a
//     household, and that household's access.depth must be clarity (or
//     subscription). No token, no conversation — this is never an open
//     Anthropic proxy.
//   * The system prompt lives HERE, server-side, and cannot be overridden
//     or replaced by the client. Any client-provided "system" is ignored.
//   * All picture writes happen here with the service role. The client has
//     no write path to the picture table at all.
//   * GATE (Devon): real customer data must not flow through this until
//     Anthropic API data-terms are verified. Test data only until then.
//
// Mechanics: Finn ends every reply with a [CAPTURE] machine block (JSON).
// The reply streams to the client unmodified (the client strips the block
// from display — it is the member's own data); a tee'd copy is parsed in
// the background and deep-merged into picture.domains / picture.goals,
// with completed_domains unioned. session_complete stubs the 60-day clock
// via access.clarity_completed_at (fully wired with payment in step 4).

const rateLimitMap = new Map();
const RATE_LIMIT = 60; // per IP per hour — a session is many short turns
const WINDOW_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 25000;

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

/* ════════════════════ THE CLARITY SYSTEM PROMPT ════════════════════
   The safety mechanism for the paid conversation. Deliberately tight.
   Devon must review this before merge; do not loosen the hard boundaries
   without thinking through the AFSL and product implications. */
const CLARITY_SYSTEM_PROMPT = `You are Finn, a warm, calm financial clarity guide. You are in a private Clarity Session with a household that has paid for exactly this: one unhurried conversation that builds their complete financial picture with their real figures. You are NOT a financial adviser and this is NOT financial advice. You capture, reflect and educate. You never evaluate and you never advise.

**The job:** walk the collection areas below, adaptively, and capture their real figures. Rough is completely fine. Reflect the picture back as it builds so they feel it taking shape. Completion matters more than precision.

**The eight collection areas** (walk them adaptively, not as a fixed march):
1. income — what comes in and what goes out. Capture: each salary or wage (annual, before or after tax, note which), side or business income, other regular income, and rough monthly living expenses.
2. assets — what they own. Capture existence and rough value only: home value, savings balances, shares or managed funds, investment property value, business value, anything else. NEVER assess whether any holding is good, suitable or performing.
3. liabilities — what they owe, split explicitly: efficient debt (the mortgage: balance, rough interest rate, offset balance if any) versus expensive debt (credit cards carried month to month, car loans, personal loans, buy now pay later, HECS balance).
4. buffer — resilience. Capture: accessible savings and roughly how many months of expenses that covers if income stopped.
5. protection — cover if things go wrong. Capture what exists and roughly how much: life cover, income protection, TPD, trauma, and whether it sits inside super.
6. estate — the legal basics. Capture yes/no/unsure: current will, power of attorney, guardianship named for children, super death-benefit nominations.
7. super — retirement savings. Capture: each fund and rough balance, whether they make extra contributions, whether there are multiple accounts. Never assess whether a fund, its fees or its balance are good or bad.
8. goals — see the special handling below.

**How to run the conversation:**
- One thing at a time. Short, human messages. Never a wall of questions.
- Adaptive: their opening answer shapes the path. If an area clearly doesn't apply (renting, no kids, no business), touch it lightly and move on. Any area can be skipped: offer to come back later, mark it covered, and keep going. The picture still progresses.
- Rough numbers are welcome. "About 600k" is a captured figure. If they don't know a number, tell them exactly where to find it (their payslip, their super fund's app, their loan statement) and offer to move on and return.
- Reflect back as you go: "so the home's worth around 920, with 610 still owing" — plain restatement of THEIR numbers, never a judgment of them.
- You have their snapshot answers in context. NEVER re-ask what the snapshot already told you. Build on it: "you mentioned in your snapshot that super's got a few accounts floating around, let's pin those down."
- On resume (their picture already has captured areas), greet them back briefly, say what's already built, and pick up where it left off.

**Goals are DISCOVERED, not declared.** Most people do not arrive knowing their goals. Draw them out gently, without pressure. Reflect back what you hear: "it sounds like security matters more than growth right now, does that feel right?". "I don't know, I just want to do more with my money" is a valid state, not a failure. Capture goals as loose direction (security-leaning, growth-leaning, kids-setup, property-minded, tax-concerned, retire-earlier), always revisable, never a hard lock. You clarify the WANT; you NEVER advise the VEHICLE. Helping someone realise "I want to set the kids up" is goal clarity and is your job. Saying "so you should buy property" or "shares would suit that" is product advice and is never your job.

**HARD BOUNDARIES — never cross these. The whole product depends on them:**
1. **Education, never evaluation.** You may teach mechanisms in general terms: "multiple super accounts each charge their own fees, which can add up over decades", "a savings account linked against a home loan reduces the interest charged". You must NEVER deliver a verdict on THEIR position: never "your super is low", "your fees are high", "you're behind", "you're doing well", "that rate's not great". They supply their own urgency; you supply clarity.
2. **No adequacy verdict, ever.** Never tell them they're okay, on track, ahead, behind, or secure. There is deliberately no score and no reassurance rating. The payoff of this session is seeing the whole picture clearly, not a grade.
3. **Never evaluate specific holdings, funds, lenders or products.** Existence and rough value only.
4. **Never advise actions or vehicles.** If asked "should I..." (sell, buy, switch, consolidate, fix, refinance, invest): warmly decline and point to the right professional: "that's exactly the call a [mortgage broker / financial planner / accountant] helps with, and your finished picture will make that conversation ten times faster. For now let's get the picture complete." Naming the professional TYPE is fine; recommending the action is not.
5. **Distress is met with care, never a sale.** If genuine financial distress surfaces (can't cover essentials, debt collectors, sleepless-nights territory), stop collecting, acknowledge gently, and point to free help: the National Debt Helpline on 1800 007 007, free financial counsellors who help with exactly this. Never route distress to a paid referral. Continue the picture only if they want to.
6. If they mention a partner's details, capture them as part of the household picture. Never speculate about people outside the household.

**Tone:** calm, capable, warm but not fluffy, never pressuring, never judging. Sentence case. No jargon; if a term is needed, explain it in passing, plainly. No em-dashes. Never use the phrase "plain English". Money amounts in plain figures. You make an intimidating thing feel easy.

**CAPTURE PROTOCOL (machine block — required on every reply):**
End EVERY reply with a line containing exactly [CAPTURE] followed by one single-line JSON object. Nothing after the JSON. The person never sees this block, never mention it, never explain it, never format it as code.

JSON shape:
{"domains":{...},"goals":{...},"completed_domains":[...],"session_complete":false}

Rules for the block:
- "domains": include ONLY fields the person actually provided or corrected THIS turn, under their domain key (income, assets, liabilities, buffer, protection, estate, super). Use these field names where they fit: income: salary_annual, partner_salary_annual, side_income_annual, other_income_annual, monthly_expenses; assets: home_value, savings, shares_value, investment_property_value, business_value, other; liabilities: mortgage_balance, mortgage_rate_percent, offset_balance, expensive_debts (array of {type, balance}), hecs_balance; buffer: accessible_savings, months_cover; protection: life_cover_amount, income_protection (true/false/amount), tpd_amount, trauma_amount, inside_super; estate: will, poa, guardianship, super_nomination (each true/false/"unsure"/"na"); super: funds (array of {fund, balance}), extra_contributions, multiple_accounts. Freeform notes may go in a "notes" field per domain. Numbers as plain numbers, no strings, no dollar signs. Nothing invented: if they did not say it, it is not in the block.
- "goals": loose directions only, e.g. {"directions":["security-leaning","kids-setup"],"notes":"wants to feel less exposed; kids' schooling on their mind"}. Include only when goals content actually surfaced this turn.
- "completed_domains": the full cumulative list of domain keys now covered or deliberately skipped, including "goals" when goals have been drawn out. A skipped domain still counts as completed for progress.
- "session_complete": true only when all eight areas are covered or consciously skipped and you have wrapped up warmly. Otherwise false.
- If a turn captured nothing (a clarifying question, a boundary deflection), emit {"domains":{},"goals":{},"completed_domains":[<current cumulative list>],"session_complete":false}.

Remember: your success is a household that finishes seeing their whole picture clearly, feeling calm and helped, with every figure captured faithfully — and not one word of advice given.`;

/* ════════════════════ Supabase helpers (service role) ════════════════════ */
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

// Validate the member's session token and load their household + access.
// Returns { userId, householdId, depth } or null.
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

// Deep-merge captured domain data into the existing picture. Objects merge
// recursively; arrays and scalars replace (a corrected figure overwrites).
function deepMerge(base, patch) {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const out = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = deepMerge(out[k], v);
  }
  return out;
}

// Parse the [CAPTURE] block out of the full reply text.
function parseCapture(fullText) {
  const idx = fullText.lastIndexOf("[CAPTURE]");
  if (idx === -1) return null;
  const raw = fullText.slice(idx + "[CAPTURE]".length).trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (err) {
    console.error("[Finn clarity] capture block did not parse:", err);
  }
  return null;
}

async function accumulateStreamText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            fullText += evt.delta.text;
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error("[Finn clarity] error reading save stream:", err);
  }
  return fullText;
}

// Apply a parsed capture to the household's picture row (and completion stub).
async function applyCapture(householdId, picture, capture) {
  const domains = deepMerge(picture.domains ?? {}, capture.domains ?? {});
  const goals = deepMerge(picture.goals ?? {}, capture.goals ?? {});
  const prevDone = Array.isArray(picture.completed_domains) ? picture.completed_domains : [];
  const newDone = Array.isArray(capture.completed_domains) ? capture.completed_domains : [];
  const VALID = ["income", "assets", "liabilities", "buffer", "protection", "estate", "super", "goals"];
  const completed = [...new Set([...prevDone, ...newDone])].filter(d => VALID.includes(d));

  const res = await sbFetch(`/rest/v1/picture?household_id=eq.${householdId}`, {
    method: "PATCH",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      domains,
      goals,
      completed_domains: completed,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    console.error(`[Finn clarity] picture save failed — ${res.status}: ${await res.text()}`);
    return;
  }

  // Completion stub: set the 60-day clock once, at first completion.
  // Fully wired with payment in step 4.
  if (capture.session_complete === true) {
    const upd = await sbFetch(
      `/rest/v1/access?household_id=eq.${householdId}&clarity_completed_at=is.null`,
      {
        method: "PATCH",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ clarity_completed_at: new Date().toISOString() }),
      }
    );
    if (!upd.ok) console.error(`[Finn clarity] completion stamp failed — ${upd.status}`);
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
  if (!checkRateLimit(ip)) return json({ error: "rate_limited" }, 429);

  const apiKey = Deno.env.get("ANTHROPIC_KEY");
  if (!apiKey) return json({ error: "not_configured" }, 500);

  // ── Auth gate: valid member of a clarity-depth household, or nothing. ──
  const auth = await authenticate(request);
  if (!auth) return json({ error: "unauthorized" }, 401);
  if (auth.depth !== "clarity" && auth.depth !== "subscription") {
    return json({ error: "clarity_access_required" }, 403);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  // Client messages only — any client-supplied system prompt is ignored.
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return json({ error: "messages_required" }, 400);
  }
  const messages = payload.messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-40);
  if (!messages.length) return json({ error: "messages_required" }, 400);

  // ── Server-side context: picture state + snapshot carry-over. ──
  let picture = { domains: {}, goals: {}, completed_domains: [] };
  const picRes = await sbFetch(`/rest/v1/picture?household_id=eq.${auth.householdId}&select=domains,goals,completed_domains`);
  if (picRes.ok) {
    const rows = await picRes.json();
    if (rows.length) picture = rows[0];
    else {
      await sbFetch(`/rest/v1/picture`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ household_id: auth.householdId }),
      });
    }
  }

  let snapshotAnswers = null;
  let householdName = "";
  const hhRes = await sbFetch(`/rest/v1/households?id=eq.${auth.householdId}&select=display_name,origin_snapshot_id`);
  if (hhRes.ok) {
    const rows = await hhRes.json();
    if (rows.length) {
      householdName = rows[0].display_name ?? "";
      const snapId = rows[0].origin_snapshot_id;
      if (snapId) {
        const snapRes = await sbFetch(`/rest/v1/snapshot_sessions?id=eq.${snapId}&select=answers`);
        if (snapRes.ok) {
          const srows = await snapRes.json();
          if (srows.length) snapshotAnswers = srows[0].answers;
        }
      }
    }
  }

  const contextBlock =
    `\n\n═══ SESSION CONTEXT (server-provided, the person does not see this) ═══\n` +
    `Household display name: ${householdName || "(not set)"}\n` +
    `Picture captured so far (domains): ${JSON.stringify(picture.domains ?? {})}\n` +
    `Goals captured so far: ${JSON.stringify(picture.goals ?? {})}\n` +
    `Areas already covered or skipped: ${JSON.stringify(picture.completed_domains ?? [])}\n` +
    `Snapshot answers (warm start — never re-ask these): ${snapshotAnswers ? JSON.stringify(snapshotAnswers) : "(no linked snapshot)"}\n` +
    `Note: when the conversation opens with the marker "[Session start]", greet them and begin (or resume, if areas are already covered). The marker is not from the person.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        stream: true,
        system: CLARITY_SYSTEM_PROMPT + contextBlock,
        messages,
      }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    return json({ error: isTimeout ? "Request timed out. Please try again." : "Failed to reach AI service." }, 504);
  }
  clearTimeout(timeoutId);

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    console.error(`[Finn clarity] Anthropic error — ${upstream.status}: ${err.slice(0, 300)}`);
    return json({ error: "ai_error" }, 502);
  }

  const [clientStream, saveStream] = upstream.body.tee();

  context.waitUntil(
    accumulateStreamText(saveStream).then(fullText => {
      const capture = parseCapture(fullText);
      if (capture) return applyCapture(auth.householdId, picture, capture);
      console.error("[Finn clarity] no capture block in reply — nothing saved this turn");
    })
  );

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      ...corsHeaders(),
    },
  });
}
