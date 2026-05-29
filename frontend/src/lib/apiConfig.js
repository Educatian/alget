/**
 * Central API base URL for frontend requests.
 *
 * In local development, prefer the Vite proxy so the app talks to the
 * local FastAPI server on http://localhost:8000 via /api.
 * In production, fall back to the deployed API unless explicitly overridden.
 */

const API_BASE = import.meta.env.VITE_API_BASE
  || (import.meta.env.DEV ? '/api' : 'https://alget.onrender.com/api')

export default API_BASE

/**
 * Base for DYNAMIC / LLM endpoints (BigAL rail, chat, grading, generation).
 *
 * Content + search are served as static JSON under API_BASE (/api) on the Pages
 * deploy, but the LLM endpoints have no static handler there — so they route to
 * the alget-llm Cloudflare Worker (Gemini for the rail, proxy to the FastAPI
 * backend for the rest). In dev we use the Vite proxy (/api -> :8000).
 */
export const LLM_API_BASE = import.meta.env.VITE_LLM_API_BASE
  || (import.meta.env.DEV ? '/api' : 'https://alget-llm.jewoong-moon.workers.dev')

/**
 * Name of the Supabase Edge Function that hosts the low-latency adaptive
 * support-selection policy (supabase/functions/adaptive-recommendation).
 */
export const ADAPTIVE_EDGE_FUNCTION = 'adaptive-recommendation'

/**
 * Feature flag: route adaptivity to the co-located edge function (with
 * automatic FastAPI fallback) when truthy. Defaults OFF so the existing
 * FastAPI path is unchanged until the flag is set.
 */
export function isAdaptiveEdgeEnabled() {
  return Boolean(import.meta.env.VITE_ADAPTIVE_EDGE)
}

/**
 * Deployed Cloudflare Worker URL for the low-latency adaptive policy
 * (cloudflare/adaptive-recommendation). When set, adaptivity routes here first
 * (with automatic fallback to the Supabase edge fn / FastAPI). Unset by default
 * so existing behavior is unchanged.
 */
export const ADAPTIVE_WORKER_URL = import.meta.env.VITE_ADAPTIVE_WORKER_URL || ''

/**
 * True when a Cloudflare Worker URL is configured for adaptivity.
 */
export function isAdaptiveWorkerEnabled() {
  return Boolean(ADAPTIVE_WORKER_URL)
}
