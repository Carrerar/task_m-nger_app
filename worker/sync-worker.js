// Cloudflare Worker — single-user JSON sync for Focus Board.
//
// Setup (see docs/SYNC_SETUP.md):
//   1. Create a KV namespace, bind it to this Worker as  STATE
//   2. Set a secret:  wrangler secret put SYNC_TOKEN   (a long random string)
//   3. Deploy. The Worker URL + that token go into the app's sync settings.
//
// Storage model: one KV key holds { rev, updatedAt, data }. Every PUT bumps
// rev server-side (last-write-wins). The token is the only gate — keep it
// secret; anyone with the URL + token can read/write your data.

const KEY = "focus-board-state";

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

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
  },
};
