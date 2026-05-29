/**
 * Adaptive recommendation client with edge-routing + FastAPI fallback.
 *
 * When the VITE_ADAPTIVE_EDGE flag is truthy, getAdaptiveRecommendation routes
 * the request to the co-located Supabase Edge Function
 * (supabase/functions/adaptive-recommendation) for low-latency adaptivity, via
 * the existing Supabase client. On ANY error or timeout it transparently falls
 * back to the existing FastAPI endpoint (POST `${API_BASE}/adaptive_recommendation`),
 * so enabling the flag can never make adaptivity less available than today.
 *
 * The edge function runs a 1:1 port of backend/knowledge_tracing.py
 * (select_support_move), verified bit-for-bit by the parity test under
 * supabase/functions/adaptive-recommendation/parity/.
 *
 * To switch a caller to this client, replace a direct
 *   fetch(`${API_BASE}/adaptive_recommendation`, { method: 'POST', body })
 * call with:
 *   import { getAdaptiveRecommendation } from '../lib/adaptiveClient'
 *   const { data, error, source } = await getAdaptiveRecommendation(payload)
 * The returned `source` is 'edge' or 'fastapi' so callers can log which path
 * served the decision. The flag is OFF by default, so existing callers that are
 * not switched keep using FastAPI directly.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import API_BASE, {
  ADAPTIVE_EDGE_FUNCTION,
  isAdaptiveEdgeEnabled,
  ADAPTIVE_WORKER_URL,
  isAdaptiveWorkerEnabled,
} from './apiConfig'

const DEFAULT_EDGE_TIMEOUT_MS = 2500

function timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('adaptive_edge_timeout')), ms)
  })
}

async function callWorker(payload, timeoutMs) {
  // Plain fetch to the Cloudflare Worker, raced against a timeout so a slow
  // edge can never stall the UI. On any non-2xx / timeout the caller falls back.
  const fetchPromise = fetch(ADAPTIVE_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`adaptive_worker_${res.status}${text ? `: ${text}` : ''}`)
    }
    return res.json()
  })
  return Promise.race([fetchPromise, timeout(timeoutMs)])
}

async function callEdge(payload, timeoutMs) {
  // supabase.functions.invoke resolves with { data, error }; race it against a
  // timeout so a slow/cold edge isolate cannot stall the UI.
  const invoke = supabase.functions.invoke(ADAPTIVE_EDGE_FUNCTION, { body: payload })
  const result = await Promise.race([invoke, timeout(timeoutMs)])
  if (result?.error) {
    throw new Error(result.error.message || 'adaptive_edge_error')
  }
  if (!result?.data) {
    throw new Error('adaptive_edge_empty')
  }
  return result.data
}

async function callFastApi(payload) {
  const res = await fetch(`${API_BASE}/adaptive_recommendation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`adaptive_fastapi_${res.status}${text ? `: ${text}` : ''}`)
  }
  return res.json()
}

/**
 * Get an adaptive support recommendation.
 *
 * @param {object} payload Same request contract as the FastAPI endpoint:
 *   { learner_id, course, section_id, annotation_adaptive?,
 *     artifact_revision_scores?, annotation_signals?, learner_profile?, ... }
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] Edge timeout before falling back (default 2500ms).
 * @param {boolean} [opts.forceFastApi] Bypass the edge/worker entirely (testing / opt-out).
 * @returns {Promise<{ data: object|null, error: Error|null, source: 'worker'|'edge'|'fastapi' }>}
 */
export async function getAdaptiveRecommendation(payload, opts = {}) {
  const { timeoutMs = DEFAULT_EDGE_TIMEOUT_MS, forceFastApi = false } = opts
  const useWorker = !forceFastApi && isAdaptiveWorkerEnabled()
  const useEdge = !forceFastApi && isAdaptiveEdgeEnabled() && isSupabaseConfigured

  // Prefer the Cloudflare Worker when its URL is configured. On ANY
  // error/timeout, fall back to the Supabase edge fn (if enabled) then FastAPI.
  if (useWorker) {
    try {
      const data = await callWorker(payload, timeoutMs)
      return { data, error: null, source: 'worker' }
    } catch {
      // fall through to edge/fastapi below
    }
  }

  if (useEdge) {
    try {
      const data = await callEdge(payload, timeoutMs)
      return { data, error: null, source: 'edge' }
    } catch {
      // Any edge error/timeout falls through to the FastAPI path below.
      try {
        const data = await callFastApi(payload)
        return { data, error: null, source: 'fastapi' }
      } catch (apiError) {
        return { data: null, error: apiError, source: 'fastapi' }
      }
    }
  }

  try {
    const data = await callFastApi(payload)
    return { data, error: null, source: 'fastapi' }
  } catch (apiError) {
    return { data: null, error: apiError, source: 'fastapi' }
  }
}

export default getAdaptiveRecommendation
