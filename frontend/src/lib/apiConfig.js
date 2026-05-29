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
