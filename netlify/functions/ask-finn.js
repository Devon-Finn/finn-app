const https = require("https");

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST", headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders() };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "messages array required" }),
    };
  }

  const requestBody = JSON.stringify({
    model: MODEL,
    max_tokens: payload.max_tokens ?? 1500,
    ...(payload.system ? { system: payload.system } : {}),
    messages: payload.messages,
  });

  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "x-api-key": apiKey,
    "Content-Length": Buffer.byteLength(requestBody),
  };

  try {
    const response = await post(ANTHROPIC_API_URL, headers, requestBody);
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: response.body,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Upstream request failed", detail: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
