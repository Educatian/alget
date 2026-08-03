import { LLM_API_BASE } from './apiConfig'
import { supabase } from './supabase'

async function accessToken() {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || ''
}

export async function roadmapRequest(path, payload, { method, token } = {}) {
    const authToken = token ?? await accessToken()
    const response = await fetch(`${LLM_API_BASE}${path}`, {
        method: method || (payload ? 'POST' : 'GET'),
        headers: {
            ...(payload ? { 'Content-Type': 'application/json' } : {}),
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.detail || `Roadmap request failed (${response.status})`)
    return body
}

export const loadRoadmapManifest = () => roadmapRequest('/roadmap/manifest')
export const createRuntimePackage = (payload) => roadmapRequest('/roadmap/runtime-package', payload)
export const recordAgentDecision = (payload) => roadmapRequest('/roadmap/decision-ledger', payload)
export const summarizeSocialOutcomes = (events) => roadmapRequest('/roadmap/social/outcomes', { events })
export const toCaliperEvent = (payload) => roadmapRequest('/roadmap/interoperability/caliper', payload)
export const normalizeOneRoster = (users) => roadmapRequest('/roadmap/interoperability/oneroster', { users })
export const buildCaseCompetency = (payload) => roadmapRequest('/roadmap/interoperability/case', payload)
export const buildLti13Context = (payload) => roadmapRequest('/roadmap/interoperability/lti13', payload)
export const loadModelRegistry = () => roadmapRequest('/roadmap/model-registry')
export const registerModel = (payload) => roadmapRequest('/roadmap/model-registry', payload)
export const exportSubjectData = (subjectId, records) => roadmapRequest('/roadmap/privacy/export', { subject_id: subjectId, records })
export const planSubjectDeletion = (subjectId, records) => roadmapRequest('/roadmap/privacy/delete', { subject_id: subjectId, records, confirm: false })
export const confirmSubjectDeletion = (subjectId, records) => roadmapRequest('/roadmap/privacy/delete', { subject_id: subjectId, records, confirm: true })
export const createIncident = (payload) => roadmapRequest('/roadmap/incidents', payload)
export const transitionIncident = (incidentId, payload) => roadmapRequest(`/roadmap/incidents/${incidentId}/transition`, payload)
export const createEvaluationManifest = (payload) => roadmapRequest('/roadmap/evaluation-manifest', payload)
