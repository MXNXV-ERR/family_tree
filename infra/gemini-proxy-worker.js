// Cloudflare Worker — proxies Google Gemini so the API key stays SERVER-SIDE and
// never ships in the app bundle. Free tier: 100k requests/day.
//
// Deploy: see infra/README.md. Required secret: GEMINI_KEY. Optional var:
// ALLOW_ORIGIN (your site origin, e.g. https://family-tree-6a597.web.app — defaults
// to '*'; tighten in production). The app calls this Worker when
// EXPO_PUBLIC_GEMINI_PROXY_URL is set (and EXPO_PUBLIC_GEMINI_API_KEY is then left UNSET).
//
// Request body (POST JSON): { model, systemInstruction, history: [{ role, content }] }
// Response: { text }

const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro']);

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    if (!env.GEMINI_KEY) return json({ error: 'server_misconfigured' }, 500, cors);

    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'bad_request' }, 400, cors); }

    const { model, systemInstruction, history } = payload || {};
    const m = ALLOWED_MODELS.has(model) ? model : 'gemini-2.5-flash';
    const turns = Array.isArray(history) ? history : [];
    // Basic abuse guard: cap conversation size.
    if (turns.length > 40) return json({ error: 'too_many_turns' }, 413, cors);

    const contents = turns.map((t) => ({
      role: t && t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String((t && t.content) ?? '').slice(0, 8000) }],
    }));
    const body = {
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: String(systemInstruction).slice(0, 60000) }] } } : {}),
    };

    let upstream;
    try {
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_KEY}`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      );
    } catch {
      return json({ error: 'upstream_unreachable' }, 502, cors);
    }
    if (!upstream.ok) return json({ error: 'upstream', status: upstream.status }, 502, cors);

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    return json({ text }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}
