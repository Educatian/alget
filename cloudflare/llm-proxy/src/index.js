// Cloudflare Worker: alget-llm
//
// The dynamic AI layer for ALGET. On the static Pages deploy, /api only holds
// content/search snapshots, so every LLM call (BigAL rail, chat, grading,
// generation) 404/405'd. This Worker is the single dynamic endpoint:
//
//   - /assist/explain, /assist/represent  -> answered DIRECTLY via Gemini
//     (no cold start; the rail's reported "Unable to generate").
//   - everything else (orchestrate, grade, generate*, diagnostic, research,
//     generate-image, ...) -> PROXIED to the FastAPI backend, injecting the
//     server-side Gemini key so the backend's "API Key not found" 500s stop.
//
// SECRET (set via wrangler, NOT committed):
//   wrangler secret put GEMINI_API_KEY
// Optional [vars]: ORIGIN backend URL (defaults to the onrender deploy).

const GEMINI_MODEL = 'gemini-2.0-flash'
const DEFAULT_BACKEND = 'https://alget.onrender.com/api'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

async function gemini(key, prompt, { temperature = 0.7, maxOutputTokens = 500 } = {}) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`)
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(request.url)
    // Accept both "/assist/explain" and "/api/assist/explain".
    const path = url.pathname.replace(/^\/api/, '') || '/'

    let body = {}
    if (request.method === 'POST') {
      try { body = await request.json() } catch { body = {} }
    }
    // Prefer a per-user key from the request (BYOK); else the server secret.
    const key = (body.api_key && String(body.api_key).trim()) || env.GEMINI_API_KEY || ''
    const backend = (env.BACKEND_API_BASE || DEFAULT_BACKEND).replace(/\/$/, '')

    try {
      // --- Rail: simpler explanation, generated directly (fast path) ---
      if (path === '/assist/explain') {
        if (!key) {
          return json({
            explanation:
              'Add your Gemini API key in Settings to get an AI-generated explanation. In the meantime: re-read the passage, restate the core idea in your own words, and try the next check.',
          })
        }
        const prompt = `A student is stuck on the textbook section "${body.section_id || 'this section'}".
Problem: ${body.problem_id || 'general concept'}
Why they're stuck: ${body.stuck_reason || 'unknown'}

Write a simpler, step-by-step explanation for a struggling learner. Use an everyday analogy and a concrete example. Be warm and encouraging. Keep it under 200 words. Do not assume a specific subject (statics, etc.) — explain THIS section's topic. Markdown allowed.`
        const explanation = await gemini(key, prompt, { temperature: 0.7, maxOutputTokens: 500 })
        return json({ explanation })
      }

      // --- Rail: alternate representation, generated per section/type ---
      if (path === '/assist/represent') {
        const type = body.representation_type || 'mindmap'
        if (!key) {
          return json({ content: 'Add your Gemini API key in Settings to generate this representation.', type })
        }
        const guide = {
          mindmap: 'an indented text concept map (parent → children) of the core idea',
          analogy: 'a vivid real-world analogy that builds intuition',
          visual: 'an ASCII / diagram-style sketch with labels',
          formula: 'the key formulas or rules, each with a one-line plain-language explanation',
        }[type] || 'a concise alternate representation'
        const prompt = `For the textbook section "${body.section_id || 'this section'}", produce ${guide}.
Keep it concise and specific to THIS section's actual topic (do not assume statics/equilibrium). Markdown allowed.`
        const content = await gemini(key, prompt, { temperature: 0.6, maxOutputTokens: 600 })
        return json({ content, type })
      }

      // --- Everything else: proxy to the FastAPI backend with the key injected ---
      const proxied = await fetch(`${backend}${path}${url.search}`, {
        method: request.method,
        headers: { 'content-type': 'application/json' },
        body: request.method === 'POST' ? JSON.stringify({ ...body, api_key: key }) : undefined,
      })
      const text = await proxied.text()
      return new Response(text, {
        status: proxied.status,
        headers: { ...CORS, 'content-type': proxied.headers.get('content-type') || 'application/json' },
      })
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}
