/**
 * Central API base URL for static frontend requests.
 *
 * In local development, prefer the Vite proxy so the app can talk to the local
 * FastAPI server on http://localhost:8000 via /api when needed. In production,
 * the Cloudflare Pages build sets VITE_API_BASE=/api so content reads resolve
 * to static JSON snapshots. Dynamic POST endpoints use LLM_API_BASE below.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default API_BASE

/**
 * Base for dynamic AI/compute endpoints: BigAL rail, chat, grading, generation,
 * and research validators.
 *
 * Content and search are served as static JSON under API_BASE (/api) on the
 * Pages deploy. Dynamic endpoints route to the alget-llm Cloudflare Worker in
 * production and to the local Vite proxy in dev.
 */
export const LLM_API_BASE = import.meta.env.VITE_LLM_API_BASE
  || (import.meta.env.DEV ? '/api' : 'https://alget-llm.jewoong-moon.workers.dev')

/**
 * Name of the Supabase Edge Function that hosts the low-latency adaptive
 * support-selection policy (supabase/functions/adaptive-recommendation).
 */
export const ADAPTIVE_EDGE_FUNCTION = 'adaptive-recommendation'

/**
 * Feature flag: route adaptivity to the co-located Supabase edge function when
 * truthy. The hosted Cloudflare path normally uses ADAPTIVE_WORKER_URL below.
 */
export function isAdaptiveEdgeEnabled() {
  return Boolean(import.meta.env.VITE_ADAPTIVE_EDGE)
}

/**
 * Deployed Cloudflare Worker URL for the low-latency adaptive policy
 * (cloudflare/adaptive-recommendation). When set, adaptivity routes here first.
 */
export const ADAPTIVE_WORKER_URL = import.meta.env.VITE_ADAPTIVE_WORKER_URL || ''

/**
 * True when a Cloudflare Worker URL is configured for adaptivity.
 */
export function isAdaptiveWorkerEnabled() {
  return Boolean(ADAPTIVE_WORKER_URL)
}
