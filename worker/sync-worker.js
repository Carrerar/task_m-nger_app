// Cloudflare Worker — single-user JSON sync for Focus Board + AI proxy.
//
// Setup (see docs/SYNC_SETUP.md):
//   1. Create a KV namespace, bind it to this Worker as  STATE
//   2. Set a secret:  wrangler secret put SYNC_TOKEN   (a long random string)
//   3. (optional, for the AI assistant) set two more secrets:
//        wrangler secret put GOOGLE_AI_API_KEY   (from Google AI Studio)
//        wrangler secret put AI_ROOMS            (comma-separated room ids)
//   4. Deploy. The Worker URL + SYNC_TOKEN go into the app's sync settings.
//
// Storage model: one KV key per "room" holds { rev, updatedAt, data }. Every
// PUT bumps rev server-side (last-write-wins). The shared SYNC_TOKEN gates the
// Worker against abuse; the room id (URL path, e.g. /<roomId>) namespaces the
// data so each person has a private board. Anyone with the token AND a given
// room id can read/write that room — keep the room id long and unguessable.
//
// AI proxy: POST /<roomId>/ai forwards the request body to Google's Gemini
// API with GOOGLE_AI_API_KEY injected server-side (key never reaches the
// browser). Only rooms in the AI_ROOMS allowlist may use it, and each room
// gets a soft per-UTC-day call cap to guard against runaway tool loops.

// Room ids are kept to a small, URL-safe charset so they need no decoding and
// can't smuggle a sub-path or KV-key separator.
const ROOM_RE = /^[A-Za-z0-9._-]{6,128}$/;

// Soft daily ceiling per room (override via env.AI_DAILY_CAP). This is a
// runaway-loop guard, not a billing-exact meter — KV is eventually consistent
// so concurrent requests can undercount. The real hard limit is the Gemini
// free tier (~1500 req/day).
const DEFAULT_AI_DAILY_CAP = 100;

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Pure: parse a pathname into a route descriptor, or null if it isn't one we
// serve. `/<room>` -> sync; `/<room>/ai` -> AI proxy. Anything else -> null.
export function parseRoute(pathname) {
  const parts = String(pathname || "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (parts.length === 1 && ROOM_RE.test(parts[0])) {
    return { room: parts[0], kind: "sync" };
  }
  if (parts.length === 2 && parts[1] === "ai" && ROOM_RE.test(parts[0])) {
    return { room: parts[0], kind: "ai" };
  }
  return null;
}

// Pure: is this room allowed to use the AI proxy? Allowlist is a
// comma-separated secret so room ids never live in the repo.
export function roomAllowed(room, aiRoomsCsv) {
  if (!aiRoomsCsv) return false;
  return aiRoomsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(room);
}

// Pure: given the raw stored counter and the cap, decide whether this call is
// allowed and what the counter should become. Increment counts attempts (we
// bump before calling Gemini) so a tight failing loop still hits the ceiling.
export function nextCount(storedRaw, cap) {
  const n = Number.parseInt(storedRaw || "0", 10) || 0;
  if (n >= cap) return { allowed: false, count: n };
  return { allowed: true, count: n + 1 };
}

// Pure: UTC date stamp (YYYY-MM-DD) for the per-day counter key.
export function utcDate(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Cache-Control": "no-store",
    ...extra,
  };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: cors({ "Content-Type": "application/json" }),
  });

async function handleAi(request, env, room) {
  if (request.method !== "POST") {
    return json({ error: "method-not-allowed" }, 405);
  }
  if (!env.GOOGLE_AI_API_KEY) {
    return json({ error: "ai-not-configured" }, 503);
  }
  if (!roomAllowed(room, env.AI_ROOMS)) {
    return json({ error: "ai-forbidden" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }

  const cap = Number.parseInt(env.AI_DAILY_CAP, 10) || DEFAULT_AI_DAILY_CAP;
  const capKey = `ai:n:${room}:${utcDate()}`;
  const stored = await env.STATE.get(capKey);
  const { allowed, count } = nextCount(stored, cap);
  if (!allowed) {
    return json({ error: "ai-daily-cap", cap }, 429);
  }
  // Bump before the upstream call so runaway loops still hit the ceiling.
  // expirationTtl ~2 days so stale day-counters self-clean.
  await env.STATE.put(capKey, String(count), { expirationTtl: 172800 });

  let upstream;
  try {
    upstream = await fetch(`${GEMINI_ENDPOINT}?key=${env.GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return json({ error: "ai-upstream-unreachable" }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: cors({ "Content-Type": "application/json" }),
  });
}

async function handleSync(request, env, room) {
  const KEY = `state:${room}`;

  if (request.method === "GET") {
    const stored = await env.STATE.get(KEY);
    if (!stored) return json({ rev: 0, updatedAt: 0, data: null });
    return new Response(stored, { headers: cors({ "Content-Type": "application/json" }) });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad-json" }, 400);
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      return json({ error: "missing-data" }, 400);
    }
    const prev = await env.STATE.get(KEY, "json");
    const rev = ((prev && prev.rev) || 0) + 1;
    const record = { rev, updatedAt: Date.now(), data: body.data };
    await env.STATE.put(KEY, JSON.stringify(record));
    return json({ rev: record.rev, updatedAt: record.updatedAt });
  }

  return json({ error: "method-not-allowed" }, 405);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

    const route = parseRoute(new URL(request.url).pathname);
    if (!route) return json({ error: "bad-room" }, 400);

    if (route.kind === "ai") return handleAi(request, env, route.room);
    return handleSync(request, env, route.room);
  },
};
