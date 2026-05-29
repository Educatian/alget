// Cloudflare Worker: alget-llm  (OpenRouter-backed)
//
// The dynamic AI layer for ALGET. On the static Pages deploy, /api only holds
// content/search snapshots, so every LLM call (BigAL rail, chat, grading,
// generation) 404/405'd. This Worker is the single dynamic endpoint:
//
//   - /assist/explain, /assist/represent, /orchestrate  -> answered DIRECTLY
//     via OpenRouter (no cold start). These are the BigAL rail + chat the
//     learner actually sees.
//   - everything else (grade, generate*, diagnostic, research, ...) -> PROXIED
//     to the FastAPI backend as-is (best effort; needs the backend's own key).
//
// SECRET (set via wrangler, NOT committed):
//   wrangler secret put OPENROUTER_API_KEY
// Optional [vars]:
//   OPENROUTER_MODEL     (default: google/gemini-2.0-flash-001)
//   BACKEND_API_BASE     (default: the onrender FastAPI deploy)

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001'
const DEFAULT_BACKEND = 'https://alget.onrender.com/api'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

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

async function openrouter(key, messages, { model, temperature = 0.7, maxTokens = 600 } = {}) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      // OpenRouter attribution headers (optional but recommended).
      'HTTP-Referer': 'https://alget.pages.dev',
      'X-Title': 'ALGET Intelligent Textbook',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `OpenRouter ${res.status}`)
  return (data?.choices?.[0]?.message?.content || '').trim()
}

// Flatten the frontend's chat history (assistant entries can be intent objects)
// into plain OpenRouter messages.
function historyToMessages(history) {
  if (!Array.isArray(history)) return []
  return history.slice(-6).map((m) => {
    let content = m?.content
    if (content && typeof content === 'object') {
      content = content.text || content.summary || content.explanation || content.error || JSON.stringify(content)
    }
    return { role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(content || '') }
  }).filter((m) => m.content)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api/, '') || '/'

    let body = {}
    if (request.method === 'POST') {
      try { body = await request.json() } catch { body = {} }
    }
    // Server key by default; allow a per-user OpenRouter key via the request.
    const key = (body.api_key && String(body.api_key).trim()) || env.OPENROUTER_API_KEY || ''
    const model = env.OPENROUTER_MODEL || DEFAULT_MODEL
    const backend = (env.BACKEND_API_BASE || DEFAULT_BACKEND).replace(/\/$/, '')
    const noKeyMsg = 'AI support is not configured yet (no OpenRouter key). Add your own key in Settings, or ask your instructor to enable it.'

    try {
      // --- Rail: simpler explanation ---
      if (path === '/assist/explain') {
        if (!key) return json({ explanation: noKeyMsg })
        const topic = body.section_title || body.section_id || 'this section'
        const explanation = await openrouter(key, [
          { role: 'system', content: 'You are BigAL, a warm, concise tutor inside an interactive textbook. Explain clearly for a struggling learner using an everyday analogy and a concrete example. Keep it under 200 words. Markdown allowed. Explain the actual topic given by its TITLE — do not reinterpret it from a URL slug or assume a different subject.' },
          { role: 'user', content: `Section title: "${topic}" (id: ${body.section_id || 'n/a'}). Problem: ${body.problem_id || 'general concept'}. The student is stuck (reason: ${body.stuck_reason || 'unknown'}). Give a simpler, step-by-step explanation of THIS topic.` },
        ], { model, temperature: 0.7, maxTokens: 500 })
        return json({ explanation })
      }

      // --- Rail: alternate representation ---
      if (path === '/assist/represent') {
        const type = body.representation_type || 'mindmap'
        if (!key) return json({ content: noKeyMsg, type })
        const guide = {
          mindmap: 'an indented text concept map (parent -> children) of the core idea',
          analogy: 'a vivid real-world analogy that builds intuition',
          visual: 'an ASCII / diagram-style sketch with labels',
          formula: 'the key formulas or rules, each with a one-line plain-language explanation',
        }[type] || 'a concise alternate representation'
        const topic = body.section_title || body.section_id || 'this section'
        const content = await openrouter(key, [
          { role: 'system', content: 'You produce concise alternate representations of textbook concepts. Be specific to the actual topic given by its TITLE; do not reinterpret it from a URL slug, and never assume statics/equilibrium. Markdown allowed.' },
          { role: 'user', content: `For the section titled "${topic}" (id: ${body.section_id || 'n/a'}), produce ${guide}.` },
        ], { model, temperature: 0.6, maxTokens: 600 })
        return json({ content, type })
      }

      // --- BigAL chat ---
      if (path === '/orchestrate') {
        if (!key) return json({ intent: 'legacy', text: noKeyMsg })
        const ctx = body.current_content ? `\n\nSection context (excerpt):\n${String(body.current_content).slice(0, 2000)}` : ''
        const messages = [
          { role: 'system', content: `You are BigAL, a friendly, rigorous tutor embedded in an interactive textbook (course: ${body.course || 'general'}). Answer the learner's question clearly and concisely, grounded in the section context when relevant. Use Markdown. If the learner highlighted a passage, explain it.${ctx}` },
          ...historyToMessages(body.history),
          { role: 'user', content: String(body.query || '') },
        ]
        const text = await openrouter(key, messages, { model, temperature: 0.6, maxTokens: 900 })
        // No recognized `intent` -> ChatWidget renders `text` via its generic
        // <p> branch. (intent:'learn' would route to LearnIntentCard, which
        // expects structured fields and would drop a plain answer.)
        return json({ intent: 'answer', text })
      }

      // --- Everything else: proxy to the FastAPI backend as-is ---
      const proxied = await fetch(`${backend}${path}${url.search}`, {
        method: request.method,
        headers: { 'content-type': 'application/json' },
        body: request.method === 'POST' ? JSON.stringify(body) : undefined,
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
