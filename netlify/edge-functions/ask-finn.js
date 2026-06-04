// In-memory rate limiter: 10 requests per IP per hour
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
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

// Parse Anthropic SSE stream bytes and accumulate the full text output.
// Reads from a ReadableStream (the tee'd save copy), returns the complete string.
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
      // SSE lines end with \n; split and keep any incomplete trailing line in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const evt = JSON.parse(raw);
          if (
            evt.type === "content_block_delta" &&
            evt.delta?.type === "text_delta" &&
            typeof evt.delta.text === "string"
          ) {
            fullText += evt.delta.text;
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
    // Process any remaining buffer content
    if (buffer.startsWith("data: ")) {
      const raw = buffer.slice(6).trim();
      if (raw && raw !== "[DONE]") {
        try {
          const evt = JSON.parse(raw);
          if (
            evt.type === "content_block_delta" &&
            evt.delta?.type === "text_delta" &&
            typeof evt.delta.text === "string"
          ) {
            fullText += evt.delta.text;
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error("Finn: error reading save stream:", err);
  }

  return fullText;
}

// Save snapshot row to Supabase using service_role key (bypasses RLS).
// Failures are logged but never surface to the user.
async function saveSnapshot(snapshotId, output, answers) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // DIAGNOSTIC — logs env var presence and accumulated text length.
  // Remove once save is confirmed working.
  console.log(`[Finn save] SUPABASE_URL present: ${!!supabaseUrl} (length: ${supabaseUrl?.length ?? 0})`);
  console.log(`[Finn save] SUPABASE_SERVICE_ROLE_KEY present: ${!!serviceKey} (length: ${serviceKey?.length ?? 0})`);
  console.log(`[Finn save] accumulated output length: ${output?.length ?? 0} chars`);
  console.log(`[Finn save] snapshotId: ${snapshotId}`);

  if (!supabaseUrl || !serviceKey) {
    console.error("[Finn save] MISSING env var — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not available in edge function runtime. Check Netlify env var scope: must be 'All' or include Edge Functions, not just 'Functions' (serverless).");
    return;
  }

  if (!output) {
    console.error("[Finn save] empty output after stream accumulation — skipping insert");
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/snapshots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        id: snapshotId,
        output,
        answers: answers ?? null,
        source: "snapshot-output",
      }),
    });

    // DIAGNOSTIC — log full Supabase response regardless of success/failure.
    const responseBody = await res.text();
    if (res.ok) {
      console.log(`[Finn save] Supabase insert OK — status: ${res.status}`);
    } else {
      console.error(`[Finn save] Supabase insert FAILED — status: ${res.status}, body: ${responseBody}`);
    }
  } catch (err) {
    console.error("[Finn save] fetch to Supabase threw:", err);
  }
}

export default async function handler(request, context) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const ip = context.ip ?? request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  // Pre-generate snapshot UUID here, before streaming begins.
  // This is returned to the client via X-Snapshot-Id header and used for the Supabase insert.
  const snapshotId = crypto.randomUUID();

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
        max_tokens: payload.max_tokens ?? 2500,
        stream: true,
        ...(payload.system ? { system: payload.system } : {}),
        messages: payload.messages,
      }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    return new Response(
      JSON.stringify({ error: isTimeout ? "Request timed out. Please try again." : "Failed to reach AI service." }),
      { status: 504, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }

  clearTimeout(timeoutId);

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(err, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  // Tee the stream: clientStream goes to the browser (SSE, unchanged UX),
  // saveStream is consumed in the background to accumulate the full text for Supabase.
  const [clientStream, saveStream] = upstream.body.tee();

  // Background task: accumulate text then save. context.waitUntil keeps the
  // edge function alive after the HTTP response is returned until this resolves.
  context.waitUntil(
    accumulateStreamText(saveStream).then((output) =>
      saveSnapshot(snapshotId, output, payload.answers ?? null)
    )
  );

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      // Snapshot UUID — client reads this from the fetch response headers
      // before consuming the body, so it knows the result URL immediately.
      "X-Snapshot-Id": snapshotId,
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Expose X-Snapshot-Id so client JS can read it (required for cross-origin;
    // harmless for same-origin — added for defence in depth).
    "Access-Control-Expose-Headers": "X-Snapshot-Id",
  };
}
