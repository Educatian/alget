import {
    safeLocalStorageGet,
    safeLocalStorageSet
} from './browserStorage'
import { isSupabaseConfigured, supabase } from './supabase'
import API_BASE from './apiConfig'
import {
    logContentAudit,
    logEvaluationArtifact,
    logInterventionTrace,
    logLearnerModelUpdate,
    logRecommendationDecision
} from './loggingService'

const LEARNER_MODEL_KEY = 'alget_research_learner_model_v1'
const INTERVENTION_TRACE_KEY = 'alget_research_traces_v1'
const EVALUATION_KEY = 'alget_research_evaluations_v1'
const CONTENT_AUDIT_KEY = 'alget_research_content_audits_v1'
const RETRY_QUEUE_KEY = 'alget_research_retry_queue_v1'

const MAX_TRACES = 160
const MAX_EVALUATIONS = 80
const MAX_AUDITS = 120
const MAX_RETRY_ITEMS = 200
const MAX_RETRY_ATTEMPTS = 3
const RESEARCH_POLICY_VERSION = 'research-v1'
const RESEARCH_PROMPT_VERSION = 'research-support-v1'
const traceSyncQueue = new Map()
const inflightOperations = new Set()
let unloadHandlersInstalled = false
const EMPTY_RESEARCH_SNAPSHOT = {
    traces: [],
    evaluations: [],
    audits: [],
    learnerMetrics: {
        averageForgettingRisk: 0,
        averageCalibrationDrift: 0,
        averagePredictedNextCorrect: 0,
        averagePredictedRetention: 0,
        dominantMisconceptions: [],
        transferReadyConcepts: 0,
    },
    interventionMetrics: {
        open: 0,
        resolvedPositive: 0,
        resolvedNegative: 0,
    },
    evaluationMetrics: {
        preAverage: 0,
        postAverage: 0,
        retentionAverage: 0,
    },
    contentMetrics: {
        averageAudit: 0,
        approvalRate: 0,
        blockedCount: 0,
        latestAudits: [],
    },
}

function generateId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID()
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

function readJson(key, fallbackValue) {
    try {
        const raw = safeLocalStorageGet(key, '')
        if (!raw) return fallbackValue
        const parsed = JSON.parse(raw)
        return parsed ?? fallbackValue
    } catch (error) {
        console.warn(`[Research] Could not read ${key}:`, error)
        return fallbackValue
    }
}

function writeJson(key, value) {
    try {
        safeLocalStorageSet(key, JSON.stringify(value))
    } catch (error) {
        console.warn(`[Research] Could not persist ${key}:`, error)
    }
}

function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value))
}

function normalizeConfidence(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 0.5
    }

    if (numeric <= 1) {
        return clamp(numeric)
    }

    return clamp(numeric / 5)
}

function normalizeMisconceptionType(value) {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return 'unknown'
    return normalized
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
}

function countRiskPhrases(lower) {
    const patterns = [
        /\bthe answer is\b/g,
        /\bfinal answer\b/g,
        /\bjust plug\b/g,
        /\bmemorize\b/g,
        /\bobviously\b/g,
        /\bclearly\b/g
    ]

    return patterns.reduce((sum, pattern) => sum + ((lower.match(pattern) || []).length), 0)
}

function countScaffoldMarkers(text) {
    return (text.match(/\b(step|first|second|next|then|finally|check|compare|because)\b/gi) || []).length
}

function getLearnerModelStore() {
    return readJson(LEARNER_MODEL_KEY, {
        concepts: {},
        sections: {},
        updatedAt: null
    })
}

function saveLearnerModelStore(store) {
    writeJson(LEARNER_MODEL_KEY, {
        ...store,
        updatedAt: new Date().toISOString()
    })
}

function getTraceStore() {
    return readJson(INTERVENTION_TRACE_KEY, [])
}

function saveTraceStore(traces) {
    writeJson(INTERVENTION_TRACE_KEY, traces.slice(-MAX_TRACES))
}

function getEvaluationStore() {
    return readJson(EVALUATION_KEY, [])
}

function saveEvaluationStore(records) {
    writeJson(EVALUATION_KEY, records.slice(-MAX_EVALUATIONS))
}

function getAuditStore() {
    return readJson(CONTENT_AUDIT_KEY, [])
}

function saveAuditStore(records) {
    writeJson(CONTENT_AUDIT_KEY, records.slice(-MAX_AUDITS))
}

async function getCurrentUserId() {
    if (!isSupabaseConfigured) return null

    try {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.user?.id || null
    } catch (error) {
        console.warn('[Research] Could not resolve current user:', error)
        return null
    }
}

function getRetryQueue() {
    return readJson(RETRY_QUEUE_KEY, [])
}

function saveRetryQueue(items) {
    writeJson(RETRY_QUEUE_KEY, items.slice(-MAX_RETRY_ITEMS))
}

function pushRetryItem(item) {
    const queue = getRetryQueue()
    queue.push({ ...item, queued_at: new Date().toISOString(), attempts: (item.attempts || 0) + 1 })
    saveRetryQueue(queue)
}

function trackInflight(promise) {
    inflightOperations.add(promise)
    promise.finally(() => inflightOperations.delete(promise))
    return promise
}

function queueTracePersistence(traceId, operation, retryDescriptor = null) {
    if (!traceId || !isSupabaseConfigured) return

    const previous = traceSyncQueue.get(traceId) || Promise.resolve()
    const next = previous
        .catch(() => undefined)
        .then(operation)
        .catch((error) => {
            console.warn(`[Research] Trace persistence failed for ${traceId}:`, error)
            if (retryDescriptor) {
                pushRetryItem({ kind: retryDescriptor.kind, payload: retryDescriptor.payload })
            }
        })
        .finally(() => {
            if (traceSyncQueue.get(traceId) === next) {
                traceSyncQueue.delete(traceId)
            }
        })

    traceSyncQueue.set(traceId, next)
    trackInflight(next)
    installUnloadHandlers()
}

function persistInBackground(label, operation, retryDescriptor = null) {
    if (!isSupabaseConfigured) return

    const promise = Promise.resolve()
        .then(operation)
        .catch((error) => {
            console.warn(`[Research] ${label} persistence failed:`, error)
            if (retryDescriptor) {
                pushRetryItem({ kind: retryDescriptor.kind, payload: retryDescriptor.payload })
            }
        })
    trackInflight(promise)
    installUnloadHandlers()
}

function installUnloadHandlers() {
    if (unloadHandlersInstalled || typeof window === 'undefined') return
    unloadHandlersInstalled = true

    const drainOnHide = () => {
        if (document.hidden && inflightOperations.size > 0) {
            // Best-effort wait so in-flight upserts have a chance to complete
            // before the tab is fully suspended. Browsers grant a short window
            // (~5s) for this; we don't await here to avoid blocking unload.
            Promise.race([
                Promise.allSettled([...inflightOperations]),
                new Promise((resolve) => setTimeout(resolve, 1500)),
            ]).catch(() => undefined)
        }
    }

    window.addEventListener('visibilitychange', drainOnHide)
    window.addEventListener('pagehide', drainOnHide)
}

export async function replayPendingResearchPersists() {
    if (!isSupabaseConfigured) return { replayed: 0, dropped: 0 }

    const queue = getRetryQueue()
    if (queue.length === 0) return { replayed: 0, dropped: 0 }

    const remaining = []
    let replayed = 0
    let dropped = 0

    for (const item of queue) {
        if ((item.attempts || 0) >= MAX_RETRY_ATTEMPTS) {
            dropped += 1
            continue
        }
        try {
            await dispatchRetryItem(item)
            replayed += 1
        } catch (error) {
            console.warn('[Research] Replay failed; will retry next session:', error)
            remaining.push({ ...item, attempts: (item.attempts || 0) + 1 })
        }
    }

    saveRetryQueue(remaining)
    return { replayed, dropped, deferred: remaining.length }
}

async function dispatchRetryItem(item) {
    switch (item.kind) {
        case 'learner_concept_state': {
            const { conceptId, state } = item.payload
            return persistLearnerConceptState(conceptId, state)
        }
        case 'evaluation_run':
            return persistEvaluation(item.payload)
        case 'evaluation_responses':
            return persistEvaluationResponses(item.payload.evaluationId, item.payload.items || [])
        default:
            console.warn(`[Research] Unknown retry kind ignored: ${item.kind}`)
    }
}

function normalizeAction(value) {
    const action = String(value || '').trim().toLowerCase()
    if (['explain', 'represent', 'practice', 'ask', 'advance'].includes(action)) {
        return action
    }
    return 'ask'
}

// Derive learner ACCEPTANCE from an explicit accept/decline signal rather than
// from the recommendation TYPE. A followed 'advance' must not be silently logged
// as accepted=false: acceptance is whatever the learner explicitly resolved
// (event.detail.accepted), and stays null (unresolved) until they act.
function resolveAcceptedFromEvent(event, previousAccepted = null) {
    if (event?.type === 'recommendation_action' && typeof event?.detail?.accepted === 'boolean') {
        return event.detail.accepted
    }
    return previousAccepted ?? null
}

function buildLearnerConceptRow(userId, conceptId, state) {
    const masteryProbability = clamp(
        (state.predicted_next_correct || 0) * 0.45
        + (state.transfer_readiness || 0) * 0.35
        + (1 - (state.forgetting_risk || 0.5)) * 0.2,
        0.05,
        0.99
    )

    return {
        user_id: userId,
        concept_id: conceptId,
        proficiency_mu: Number((((state.correct || 0) * 0.75 + (state.stability_index || 0) * 2) - (state.incorrect || 0) * 0.3).toFixed(3)),
        proficiency_sigma: Number((Math.max(0.12, 1 / Math.sqrt(Math.max(1, state.attempts || 1)))).toFixed(3)),
        mastery_prob: Number(masteryProbability.toFixed(3)),
        forgetting_half_life_hours: Number((24 + (1 - (state.forgetting_risk || 0.5)) * 72).toFixed(2)),
        forgetting_risk: state.forgetting_risk || 0.5,
        transfer_readiness: state.transfer_readiness || 0,
        confidence_mean: state.confidence_average || 0.5,
        calibration_error: state.calibration_drift || 0,
        dominant_misconception: state.dominant_misconception,
        attempts_count: state.attempts || 0,
        correct_count: state.correct || 0,
        last_seen_at: state.last_seen_at,
        last_correct_at: state.last_correct_at,
        model_version: RESEARCH_POLICY_VERSION,
        updated_at: new Date().toISOString()
    }
}

async function persistLearnerConceptState(conceptId, state) {
    const userId = await getCurrentUserId()
    if (!userId || !conceptId || !state) return

    const { error } = await supabase
        .from('learner_concept_state')
        .upsert(buildLearnerConceptRow(userId, conceptId, state), {
            onConflict: 'user_id,concept_id'
        })

    if (!error) return

    // 23503 = foreign key violation (concept_id not in concepts table).
    // Until the concepts catalog is fully seeded, this should be a soft warning
    // rather than a hard failure that loses BKT updates. The retry queue will
    // re-attempt on next session in case the catalog is updated.
    if (error.code === '23503') {
        console.warn(`[Research] concept_id "${conceptId}" not in concepts catalog; learner state held for retry.`)
        const fkError = new Error(`FK_MISS:${conceptId}`)
        fkError.code = '23503'
        throw fkError
    }

    throw error
}

async function persistRecommendationTraceStart(trace) {
    const userId = await getCurrentUserId()
    if (!userId || !trace) return

    const primary = trace.recommendation?.primary_recommendation || {}
    const reasoning = trace.recommendation?.reasoning || {}
    const recommendationRow = {
        trace_id: trace.trace_id,
        user_id: userId,
        course_id: trace.context?.courseId || trace.context?.course || null,
        section_id: trace.section_id,
        concept_ids: Array.isArray(primary.focus_concepts) ? primary.focus_concepts : [],
        chosen_action: normalizeAction(primary.action),
        learner_state_snapshot: {
            learner_state: trace.learner_state,
            learner_profile: trace.learner_profile
        },
        candidate_actions: trace.recommendation?.secondary_recommendations || trace.recommendation?.alternate_actions || [],
        evidence_snapshot: reasoning?.evidence_snapshot || {},
        explanation_snapshot: {
            rationale: primary.rationale || '',
            reasoning
        },
        policy_score: {
            confidence: reasoning?.confidence ?? trace.recommendation?.recommendation_confidence ?? null,
            policy_version: RESEARCH_POLICY_VERSION
        }
    }

    const { data: recommendationData, error: recommendationError } = await supabase
        .from('recommendation_decisions')
        .upsert(recommendationRow, { onConflict: 'trace_id' })
        .select('id')
        .single()

    if (recommendationError) throw recommendationError

    const { error: traceError } = await supabase
        .from('intervention_traces')
        .upsert({
            trace_id: trace.trace_id,
            recommendation_id: recommendationData.id,
            user_id: userId,
            section_id: trace.section_id,
            status: trace.status,
            accepted: null,
            opened_at: trace.opened_at,
            notes: {
                section_title: trace.section_title,
                context: trace.context || {}
            }
        }, { onConflict: 'trace_id' })

    if (traceError) throw traceError
}

async function persistTraceEventUpdate(trace, event) {
    const userId = await getCurrentUserId()
    if (!userId || !trace || !event) return

    const accepted = resolveAcceptedFromEvent(event, trace.accepted)
    const closedAt = ['resolved_positive', 'resolved_negative'].includes(trace.status)
        ? trace.resolved_at || new Date().toISOString()
        : event?.type === 'rail_closed'
            ? event.timestamp
            : null

    const { error: eventError } = await supabase
        .from('intervention_trace_events')
        .insert({
            trace_id: trace.trace_id,
            event_type: event.type || 'trace_update',
            event_ts: event.timestamp || new Date().toISOString(),
            payload: event.detail || {}
        })

    if (eventError) throw eventError

    const { error: updateError } = await supabase
        .from('intervention_traces')
        .update({
            status: trace.status,
            accepted,
            closed_at: closedAt,
            outcome_label: trace.outcome?.is_correct === true
                ? 'correct_after_support'
                : trace.outcome?.is_correct === false
                    ? 'still_incorrect'
                    : null,
            immediate_reward: trace.outcome?.is_correct === true ? 1 : trace.outcome?.is_correct === false ? 0 : null,
            notes: {
                section_title: trace.section_title,
                context: trace.context || {},
                outcome: trace.outcome || null
            }
        })
        .eq('trace_id', trace.trace_id)
        .eq('user_id', userId)

    if (updateError) throw updateError
}

async function persistEvaluation(evaluation) {
    const userId = await getCurrentUserId()
    if (!userId || !evaluation) return

    const validatedEvaluation = await validateEvaluationWithBackend(evaluation)

    const row = {
        user_id: userId,
        course_id: validatedEvaluation.course,
        phase: validatedEvaluation.phase,
        form_key: validatedEvaluation.section_id || validatedEvaluation.recommended_start || validatedEvaluation.course,
        started_at: validatedEvaluation.created_at,
        completed_at: validatedEvaluation.created_at,
        score_raw: validatedEvaluation.score,
        score_pct: validatedEvaluation.percentage,
        delayed_days: validatedEvaluation.phase === 'retention' ? 7 : null,
        notes: {
            client_evaluation_id: validatedEvaluation.evaluation_id,
            section_id: validatedEvaluation.section_id,
            recommended_start: validatedEvaluation.recommended_start,
            gaps: validatedEvaluation.gaps,
            mastered_concepts: validatedEvaluation.mastered_concepts,
            total_questions: validatedEvaluation.total_questions,
            server_validation: validatedEvaluation.server_validation || null
        }
    }

    const { data, error } = await supabase
        .from('evaluation_runs')
        .upsert(row, { onConflict: 'user_id,course_id,phase' })
        .select('id')
        .single()

    if (error) throw error

    if (validatedEvaluation.item_responses?.length) {
        await persistEvaluationResponses(data?.id || validatedEvaluation.evaluation_id, validatedEvaluation.item_responses)
    }
}

async function validateEvaluationWithBackend(evaluation) {
    try {
        const response = await fetch(`${API_BASE}/research/evaluation/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                course: evaluation.course,
                phase: evaluation.phase,
                score: evaluation.score,
                percentage: evaluation.percentage,
                total_questions: evaluation.total_questions,
                item_responses: evaluation.item_responses || [],
            }),
        })

        if (!response.ok) {
            throw new Error(`validator_http_${response.status}`)
        }

        const validation = await response.json()
        if (!validation.validator_pass) {
            const error = new Error(`Research evaluation validation failed: ${(validation.validation_errors || []).join(', ')}`)
            error.validation = validation
            throw error
        }

        return {
            ...evaluation,
            score: validation.computed_score,
            percentage: validation.computed_percentage,
            item_responses: validation.normalized_item_responses || evaluation.item_responses || [],
            server_validation: validation,
        }
    } catch (error) {
        console.warn('[Research] Server-side evaluation validation unavailable or failed:', error)
        throw error
    }
}

function normalizeEvaluationResponseItem(item, index) {
    const itemId = item?.item_id || item?.itemId || item?.id || `item_${String(index + 1).padStart(2, '0')}`
    const confidence = item?.confidence === undefined || item?.confidence === null
        ? null
        : normalizeConfidence(item.confidence)
    const latencyMs = item?.latency_ms ?? item?.latencyMs ?? item?.time_spent_ms ?? item?.timeSpentMs ?? null
    const isCorrect = item?.is_correct ?? item?.isCorrect ?? item?.correct

    return {
        item_id: String(itemId),
        concept_id: item?.concept_id || item?.conceptId || null,
        is_correct: Boolean(isCorrect),
        confidence,
        latency_ms: Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null,
        misconception_label: item?.misconception_label || item?.misconceptionLabel || item?.misconception_type || null,
        response_payload: {
            response_hash: item?.response_hash || item?.responseHash || null,
            selected_option: item?.selected_option || item?.selectedOption || item?.choice || null,
            rubric_score: item?.rubric_score ?? item?.rubricScore ?? null,
            source: item?.source || 'recordEvaluationResult',
            raw: item?.response_payload || item?.payload || {}
        }
    }
}

async function persistEvaluationResponses(evaluationId, itemResponses = []) {
    if (!evaluationId || !Array.isArray(itemResponses) || itemResponses.length === 0) return

    const rows = itemResponses
        .map((item, index) => normalizeEvaluationResponseItem(item, index))
        .filter((row) => row.item_id)
        .map((row) => ({
            evaluation_id: evaluationId,
            ...row
        }))

    if (rows.length === 0) return

    const { error } = await supabase
        .from('evaluation_responses')
        .upsert(rows, { onConflict: 'evaluation_id,item_id' })

    if (error?.code === '23503') {
        const safeRows = rows.map((row) => ({
            ...row,
            concept_id: null,
            response_payload: {
                ...row.response_payload,
                original_concept_id: row.concept_id
            }
        }))
        const { error: safeError } = await supabase
            .from('evaluation_responses')
            .upsert(safeRows, { onConflict: 'evaluation_id,item_id' })

        if (!safeError) return
        throw safeError
    }

    if (error) throw error
}

async function persistSupportAudit(audit, content, focusConcepts = []) {
    const feedbackId = generateId()
    const { error: feedbackError } = await supabase
        .from('generated_feedback')
        .insert({
            id: feedbackId,
            trace_id: audit.trace_id || null,
            support_type: audit.support_type,
            prompt_version: RESEARCH_PROMPT_VERSION,
            retrieved_context: {
                section_id: audit.section_id,
                focus_concepts: focusConcepts
            },
            generated_text: String(content || ''),
            validator_pass: audit.validator_pass
        })

    if (feedbackError) throw feedbackError

    const { error: auditError } = await supabase
        .from('content_audits')
        .insert({
            feedback_id: feedbackId,
            rubric_name: 'pedagogical_support_v1',
            auto_score: audit.overall,
            rubric_breakdown: {
                ...audit.rubric,
                notes: audit.notes,
                severity: audit.severity,
                release_status: audit.release_status,
                validator_pass: audit.validator_pass,
                metrics: audit.metrics
            },
            approved: audit.validator_pass
        })

    if (auditError) throw auditError
}

function computeForgettingRisk(state, now) {
    if (!state.last_correct_at) {
        return clamp(0.62 + (state.incorrect_streak || 0) * 0.06)
    }

    const elapsedDays = Math.max(0, (now - Date.parse(state.last_correct_at)) / (1000 * 60 * 60 * 24))
    const elapsedComponent = clamp(elapsedDays / 10)
    const errorComponent = clamp((state.incorrect || 0) / Math.max(1, state.attempts || 1))
    const streakComponent = clamp((state.incorrect_streak || 0) * 0.14)
    return clamp(elapsedComponent * 0.5 + errorComponent * 0.3 + streakComponent * 0.2)
}

function computeMisconceptionPressure(state) {
    const totalMisconceptions = Object.values(state.misconceptions || {}).reduce((sum, count) => sum + count, 0)
    if (!totalMisconceptions) return 0
    return clamp(totalMisconceptions / Math.max(2, state.attempts || 1))
}

function computeStabilityIndex(state, forgettingRisk, calibrationDrift) {
    const attempts = Math.max(1, state.attempts || 1)
    const accuracy = (state.correct || 0) / attempts
    const streakSignal = 1 / (1 + Math.max(0, state.incorrect_streak || 0))
    return clamp(
        accuracy * 0.45
        + (1 - forgettingRisk) * 0.25
        + (1 - calibrationDrift) * 0.15
        + streakSignal * 0.15
    )
}

function computePredictedNextCorrect(state, forgettingRisk, calibrationDrift, transferReadiness, misconceptionPressure, stabilityIndex) {
    const attempts = Math.max(1, state.attempts || 1)
    const accuracy = (state.correct || 0) / attempts
    return clamp(
        0.18
        + accuracy * 0.34
        + (state.confidence_average || 0.5) * 0.14
        + (1 - forgettingRisk) * 0.12
        + transferReadiness * 0.1
        + stabilityIndex * 0.18
        - calibrationDrift * 0.1
        - misconceptionPressure * 0.16
    )
}

function computePredictedRetention(state, forgettingRisk, transferReadiness, misconceptionPressure, stabilityIndex) {
    const attempts = Math.max(1, state.attempts || 1)
    const accuracy = (state.correct || 0) / attempts
    return clamp(
        0.15
        + accuracy * 0.28
        + (1 - forgettingRisk) * 0.24
        + transferReadiness * 0.18
        + stabilityIndex * 0.2
        - misconceptionPressure * 0.14
    )
}

function summarizeMisconceptions(misconceptions = {}) {
    return Object.entries(misconceptions)
        .map(([type, count]) => ({ type, count }))
        .sort((left, right) => right.count - left.count)
}

function finalizeConceptState(state, now) {
    const attempts = state.attempts || 0
    const confidenceSamples = state.confidence_samples || 0
    const transferAttempts = state.transfer_attempts || 0
    const misconceptionSummary = summarizeMisconceptions(state.misconceptions)
    const confidenceAverage = confidenceSamples
        ? Number((state.confidence_sum / confidenceSamples).toFixed(3))
        : 0.5
    const calibrationDrift = state.calibration_samples
        ? Number((state.calibration_error_sum / state.calibration_samples).toFixed(3))
        : 0
    const transferReadiness = transferAttempts
        ? Number((state.transfer_successes / transferAttempts).toFixed(3))
        : attempts
            ? Number((state.correct / Math.max(1, attempts)).toFixed(3))
            : 0
    const forgettingRisk = Number(computeForgettingRisk(state, now).toFixed(3))
    const misconceptionPressure = Number(computeMisconceptionPressure(state).toFixed(3))
    const stabilityIndex = Number(computeStabilityIndex(state, forgettingRisk, calibrationDrift).toFixed(3))
    const predictedNextCorrect = Number(computePredictedNextCorrect(state, forgettingRisk, calibrationDrift, transferReadiness, misconceptionPressure, stabilityIndex).toFixed(3))
    const predictedRetention = Number(computePredictedRetention(state, forgettingRisk, transferReadiness, misconceptionPressure, stabilityIndex).toFixed(3))

    return {
        ...state,
        confidence_average: confidenceAverage,
        calibration_drift: calibrationDrift,
        transfer_readiness: transferReadiness,
        misconception_summary: misconceptionSummary,
        dominant_misconception: misconceptionSummary[0]?.type || null,
        forgetting_risk: forgettingRisk,
        misconception_pressure: misconceptionPressure,
        stability_index: stabilityIndex,
        predicted_next_correct: predictedNextCorrect,
        predicted_retention: predictedRetention
    }
}

export function updateLearnerModel({
    sectionId,
    conceptId,
    isCorrect,
    confidence = 3,
    misconceptionType = 'unknown',
    source = 'practice',
    supportAction = null,
    responseLatencyMs = null,
    transferTag = 'near',
    metadata = {}
}) {
    if (!conceptId) return null

    const nowIso = new Date().toISOString()
    const now = Date.parse(nowIso)
    const store = getLearnerModelStore()
    const previous = store.concepts[conceptId] || {
        concept_id: conceptId,
        attempts: 0,
        correct: 0,
        incorrect: 0,
        incorrect_streak: 0,
        confidence_sum: 0,
        confidence_samples: 0,
        calibration_error_sum: 0,
        calibration_samples: 0,
        misconceptions: {},
        transfer_attempts: 0,
        transfer_successes: 0,
        intervention_count: 0,
        section_history: [],
        last_seen_at: null,
        last_correct_at: null,
        last_incorrect_at: null,
        last_support_action: null,
        last_source: null
    }

    const normalizedConfidence = normalizeConfidence(confidence)
    const normalizedMisconception = normalizeMisconceptionType(misconceptionType)
    const next = {
        ...previous,
        attempts: previous.attempts + 1,
        correct: previous.correct + (isCorrect ? 1 : 0),
        incorrect: previous.incorrect + (isCorrect ? 0 : 1),
        incorrect_streak: isCorrect ? 0 : previous.incorrect_streak + 1,
        confidence_sum: previous.confidence_sum + normalizedConfidence,
        confidence_samples: previous.confidence_samples + 1,
        calibration_error_sum: previous.calibration_error_sum + Math.abs(normalizedConfidence - (isCorrect ? 1 : 0)),
        calibration_samples: previous.calibration_samples + 1,
        misconceptions: {
            ...previous.misconceptions,
            [normalizedMisconception]: (previous.misconceptions?.[normalizedMisconception] || 0) + (isCorrect ? 0 : 1)
        },
        transfer_attempts: previous.transfer_attempts + (transferTag === 'near' ? 0 : 1),
        transfer_successes: previous.transfer_successes + (!isCorrect || transferTag === 'near' ? 0 : 1),
        last_seen_at: nowIso,
        last_correct_at: isCorrect ? nowIso : previous.last_correct_at,
        last_incorrect_at: isCorrect ? previous.last_incorrect_at : nowIso,
        last_support_action: supportAction || previous.last_support_action,
        last_source: source,
        last_latency_ms: responseLatencyMs ?? previous.last_latency_ms ?? null,
        section_history: Array.from(new Set([...(previous.section_history || []), sectionId].filter(Boolean))).slice(-12)
    }

    const finalized = finalizeConceptState(next, now)
    store.concepts[conceptId] = finalized

    if (sectionId) {
        const sectionSummary = store.sections[sectionId] || {
            concepts: [],
            attempts: 0,
            correct: 0,
            last_assessed_at: null
        }
        store.sections[sectionId] = {
            ...sectionSummary,
            concepts: Array.from(new Set([...(sectionSummary.concepts || []), conceptId])),
            attempts: (sectionSummary.attempts || 0) + 1,
            correct: (sectionSummary.correct || 0) + (isCorrect ? 1 : 0),
            last_assessed_at: nowIso
        }
    }

    saveLearnerModelStore(store)
    logLearnerModelUpdate(sectionId, {
        concept_id: conceptId,
        source,
        is_correct: isCorrect,
        confidence: normalizedConfidence,
        misconception_type: normalizedMisconception,
        forgetting_risk: finalized.forgetting_risk,
        calibration_drift: finalized.calibration_drift,
        dominant_misconception: finalized.dominant_misconception,
        transfer_readiness: finalized.transfer_readiness,
        predicted_next_correct: finalized.predicted_next_correct,
        predicted_retention: finalized.predicted_retention,
        stability_index: finalized.stability_index,
        misconception_pressure: finalized.misconception_pressure,
        response_latency_ms: responseLatencyMs,
        support_action: supportAction,
        metadata
    })

    persistInBackground(
        'learner_concept_state',
        () => persistLearnerConceptState(conceptId, finalized),
        { kind: 'learner_concept_state', payload: { conceptId, state: finalized } }
    )

    return finalized
}

export function incrementConceptInterventionCount(conceptId) {
    if (!conceptId) return null
    const store = getLearnerModelStore()
    const previous = store.concepts[conceptId]
    if (!previous) return null

    const finalized = finalizeConceptState(
        {
            ...previous,
            intervention_count: (previous.intervention_count || 0) + 1
        },
        Date.now()
    )
    store.concepts[conceptId] = finalized
    saveLearnerModelStore(store)
    persistInBackground(
        'learner_concept_state',
        () => persistLearnerConceptState(conceptId, finalized),
        { kind: 'learner_concept_state', payload: { conceptId, state: finalized } }
    )
    return finalized
}

export function annotateMisconceptionSignal({ sectionId, conceptId, misconceptionType, source = 'reflection' }) {
    if (!conceptId) return null
    const store = getLearnerModelStore()
    const previous = store.concepts[conceptId]
    if (!previous) return null

    const normalizedMisconception = normalizeMisconceptionType(misconceptionType)
    const finalized = finalizeConceptState(
        {
            ...previous,
            misconceptions: {
                ...(previous.misconceptions || {}),
                [normalizedMisconception]: (previous.misconceptions?.[normalizedMisconception] || 0) + 1
            }
        },
        Date.now()
    )

    store.concepts[conceptId] = finalized
    saveLearnerModelStore(store)
    logLearnerModelUpdate(sectionId, {
        concept_id: conceptId,
        source,
        misconception_type: normalizedMisconception,
        dominant_misconception: finalized.dominant_misconception,
        calibration_drift: finalized.calibration_drift,
        forgetting_risk: finalized.forgetting_risk,
        predicted_next_correct: finalized.predicted_next_correct,
        predicted_retention: finalized.predicted_retention
    })
    persistInBackground(
        'learner_concept_state',
        () => persistLearnerConceptState(conceptId, finalized),
        { kind: 'learner_concept_state', payload: { conceptId, state: finalized } }
    )
    return finalized
}

export function buildLearnerProfileSnapshot({ sectionId, conceptIds = [], mastery = [], telemetry = {} }) {
    const store = getLearnerModelStore()
    const relevantStates = conceptIds
        .map((conceptId) => store.concepts?.[conceptId])
        .filter(Boolean)

    const confidenceSamples = relevantStates.reduce((sum, state) => sum + (state.confidence_samples || 0), 0)
    const calibrationSamples = relevantStates.reduce((sum, state) => sum + (state.calibration_samples || 0), 0)
    const misconceptionCounts = {}

    relevantStates.forEach((state) => {
        Object.entries(state.misconceptions || {}).forEach(([type, count]) => {
            misconceptionCounts[type] = (misconceptionCounts[type] || 0) + count
        })
    })

    const profile = {
        section_id: sectionId,
        average_confidence: confidenceSamples
            ? Number((relevantStates.reduce((sum, state) => sum + (state.confidence_sum || 0), 0) / confidenceSamples).toFixed(3))
            : 0.5,
        confidence_samples: confidenceSamples,
        calibration_drift: calibrationSamples
            ? Number((relevantStates.reduce((sum, state) => sum + (state.calibration_error_sum || 0), 0) / calibrationSamples).toFixed(3))
            : 0,
        forgetting_risk: relevantStates.length
            ? Number((relevantStates.reduce((sum, state) => sum + (state.forgetting_risk || 0), 0) / relevantStates.length).toFixed(3))
            : 0.5,
        transfer_readiness: relevantStates.length
            ? Number((relevantStates.reduce((sum, state) => sum + (state.transfer_readiness || 0), 0) / relevantStates.length).toFixed(3))
            : 0,
        predicted_next_correct: relevantStates.length
            ? Number((relevantStates.reduce((sum, state) => sum + (state.predicted_next_correct || 0), 0) / relevantStates.length).toFixed(3))
            : 0,
        predicted_retention: relevantStates.length
            ? Number((relevantStates.reduce((sum, state) => sum + (state.predicted_retention || 0), 0) / relevantStates.length).toFixed(3))
            : 0,
        stability_index: relevantStates.length
            ? Number((relevantStates.reduce((sum, state) => sum + (state.stability_index || 0), 0) / relevantStates.length).toFixed(3))
            : 0,
        misconception_pressure: relevantStates.length
            ? Number((relevantStates.reduce((sum, state) => sum + (state.misconception_pressure || 0), 0) / relevantStates.length).toFixed(3))
            : 0,
        misconception_patterns: summarizeMisconceptions(misconceptionCounts).slice(0, 4),
        recent_interventions: relevantStates.reduce((sum, state) => sum + (state.intervention_count || 0), 0),
        retrieval_gap_days: relevantStates.length
            ? Number(
                (
                    relevantStates.reduce((sum, state) => {
                        const lastSeen = Date.parse(state.last_seen_at || '')
                        if (!Number.isFinite(lastSeen)) return sum
                        return sum + Math.max(0, (Date.now() - lastSeen) / (1000 * 60 * 60 * 24))
                    }, 0) / relevantStates.length
                ).toFixed(2)
            )
            : 0,
        concept_states: relevantStates.map((state) => ({
            concept_id: state.concept_id,
            forgetting_risk: state.forgetting_risk,
            calibration_drift: state.calibration_drift,
            dominant_misconception: state.dominant_misconception,
            transfer_readiness: state.transfer_readiness,
            predicted_next_correct: state.predicted_next_correct,
            predicted_retention: state.predicted_retention,
            stability_index: state.stability_index
        })),
        mastery_snapshot: mastery,
        telemetry_snapshot: telemetry
    }

    return profile
}

export function startInterventionTrace({
    sectionId,
    sectionTitle,
    recommendation,
    learnerState,
    learnerProfile,
    context = {}
}) {
    const traceId = generateId()
    const traces = getTraceStore()
    const nowIso = new Date().toISOString()
    const trace = {
        trace_id: traceId,
        section_id: sectionId,
        section_title: sectionTitle,
        status: 'recommended',
        opened_at: nowIso,
        last_event_at: nowIso,
        recommendation,
        learner_state: learnerState,
        learner_profile: learnerProfile,
        context,
        events: [
            {
                type: 'recommendation_created',
                timestamp: nowIso,
                detail: {
                    action: recommendation?.primary_recommendation?.action || null
                }
            }
        ],
        outcome: null
    }

    saveTraceStore([...traces, trace])
    logRecommendationDecision(sectionId, {
        trace_id: traceId,
        section_title: sectionTitle,
        recommendation,
        learner_state: learnerState,
        learner_profile: learnerProfile,
        context
    })
    queueTracePersistence(traceId, () => persistRecommendationTraceStart(trace))
    return trace
}

export function appendInterventionTrace(traceId, event) {
    if (!traceId) return null
    const traces = getTraceStore()
    let updatedTrace = null

    const next = traces.map((trace) => {
        if (trace.trace_id !== traceId) return trace
        const nextEvent = {
            ...event,
            timestamp: event?.timestamp || new Date().toISOString()
        }
        updatedTrace = {
            ...trace,
            status: event?.status || trace.status,
            accepted: resolveAcceptedFromEvent(event, trace.accepted),
            last_event_at: nextEvent.timestamp,
            events: [...(trace.events || []), nextEvent].slice(-20)
        }
        return updatedTrace
    })

    saveTraceStore(next)
    if (updatedTrace) {
        logInterventionTrace(updatedTrace.section_id, {
            trace_id: traceId,
            status: updatedTrace.status,
            event: event?.type || 'trace_update',
            detail: event?.detail || {}
        })
        queueTracePersistence(traceId, () => persistTraceEventUpdate(updatedTrace, {
            ...event,
            timestamp: event?.timestamp || updatedTrace.last_event_at
        }))
    }
    return updatedTrace
}

export function resolveInterventionOutcome({
    sectionId,
    conceptId,
    isCorrect,
    source,
    confidence = null,
    misconceptionType = 'unknown'
}) {
    const traces = getTraceStore()
    const targetTrace = [...traces]
        .reverse()
        .find((trace) => {
            if (!trace || !['recommended', 'engaged', 'awaiting_outcome'].includes(trace.status)) return false
            if (sectionId && trace.section_id !== sectionId) return false
            const focusConcepts = trace.recommendation?.primary_recommendation?.focus_concepts || []
            return !conceptId || focusConcepts.length === 0 || focusConcepts.includes(conceptId)
        })

    if (!targetTrace) return null

    const status = isCorrect ? 'resolved_positive' : 'resolved_negative'
    const outcome = {
        source,
        is_correct: isCorrect,
        confidence: confidence !== null ? normalizeConfidence(confidence) : null,
        misconception_type: normalizeMisconceptionType(misconceptionType)
    }

    const updated = appendInterventionTrace(targetTrace.trace_id, {
        type: 'outcome_recorded',
        status,
        detail: outcome
    })

    if (!updated) return null

    const nextTraces = getTraceStore().map((trace) =>
        trace.trace_id === updated.trace_id
            ? {
                ...trace,
                status,
                outcome,
                resolved_at: new Date().toISOString()
            }
            : trace
    )
    saveTraceStore(nextTraces)
    return updated
}

export function getRecentInterventionTraces(limit = 12) {
    return getTraceStore()
        .slice()
        .sort((left, right) => Date.parse(right.last_event_at || right.opened_at || 0) - Date.parse(left.last_event_at || left.opened_at || 0))
        .slice(0, limit)
}

export function evaluateSupportContent({
    sectionId,
    supportType,
    content,
    focusConcepts = [],
    traceId = null
}) {
    const text = String(content || '').trim()
    const lower = text.toLowerCase()
    const wordCount = text.split(/\s+/).filter(Boolean).length
    const stepCount = countScaffoldMarkers(text)
    const questionCount = (text.match(/\?/g) || []).length
    const conceptHits = focusConcepts.filter((concept) => lower.includes(String(concept || '').replace(/_/g, ' ').toLowerCase())).length
    const riskPhraseCount = countRiskPhrases(lower)
    const hedgeCount = (text.match(/\b(might|may|could|often|usually|sometimes)\b/gi) || []).length
    const sentenceCount = Math.max(1, (text.match(/[.!?]/g) || []).length)
    const conceptCoverage = focusConcepts.length ? conceptHits / focusConcepts.length : 1
    const retrievalSupport = clamp((questionCount + Math.min(stepCount, 4)) / 5, 0, 1)
    const answerLeak = riskPhraseCount > 0 || lower.includes('therefore the answer')

    const rubric = {
        grounding: clamp(text ? 2 + Math.round(conceptCoverage * 2) + (hedgeCount > 0 ? 1 : 0) - riskPhraseCount : 1, 1, 5),
        pedagogical_alignment: clamp(1 + Math.round(conceptCoverage * 2) + Math.min(stepCount, 3), 1, 5),
        scaffold_quality: clamp(1 + Math.min(stepCount, 3) + (questionCount > 0 ? 1 : 0), 1, 5),
        disclosure_control: clamp(answerLeak ? 1 : 4 + (questionCount > 0 ? 1 : 0), 1, 5),
        actionability: clamp((wordCount >= 28 ? 2 : 1) + Math.min(stepCount, 2) + (sentenceCount >= 2 ? 1 : 0), 1, 5),
        retrieval_support: clamp(1 + Math.round(retrievalSupport * 4), 1, 5)
    }

    const overall = Number((Object.values(rubric).reduce((sum, value) => sum + value, 0) / Object.keys(rubric).length).toFixed(2))
    const notes = []

    if (stepCount === 0) {
        notes.push('Support text could add more explicit stepwise scaffolding.')
    }
    if (questionCount === 0 && supportType === 'ask') {
        notes.push('Coaching prompts work better when they include at least one diagnostic question.')
    }
    if (conceptHits === 0 && focusConcepts.length > 0) {
        notes.push('Concept alignment is weak; the support does not explicitly reference the flagged concept.')
    }
    if (answerLeak) {
        notes.push('This support may reveal the answer too directly for a scaffold-first flow.')
    }
    if (wordCount < 18) {
        notes.push('Support text is short enough that it may feel under-explained.')
    }
    if (hedgeCount === 0 && conceptCoverage < 0.5) {
        notes.push('Grounding cues are thin; the explanation sounds more assertive than the available concept evidence.')
    }

    const severity = answerLeak
        ? 'high'
        : overall < 3.2
            ? 'moderate'
            : 'low'
    const releaseStatus = answerLeak || overall < 2.8
        ? 'blocked'
        : overall < 3.8 || conceptCoverage < 0.5
            ? 'review'
            : 'approved'
    const validatorPass = releaseStatus === 'approved'

    const audit = {
        audit_id: generateId(),
        section_id: sectionId,
        trace_id: traceId,
        support_type: supportType,
        created_at: new Date().toISOString(),
        overall,
        rubric,
        notes,
        severity,
        release_status: releaseStatus,
        validator_pass: validatorPass,
        metrics: {
            word_count: wordCount,
            step_count: stepCount,
            question_count: questionCount,
            concept_coverage: Number(conceptCoverage.toFixed(3)),
            risk_phrase_count: riskPhraseCount,
            retrieval_support: Number(retrievalSupport.toFixed(3))
        }
    }

    const audits = getAuditStore()
    saveAuditStore([...audits, audit])
    logContentAudit(sectionId, audit)
    if (traceId) {
        queueTracePersistence(traceId, () => persistSupportAudit(audit, content, focusConcepts))
    }
    return audit
}

export function recordEvaluationResult({
    course,
    phase,
    score,
    percentage,
    sectionId = null,
    recommendedStart = null,
    gaps = [],
    masteredConcepts = [],
    totalQuestions = 0,
    itemResponses = []
}) {
    const now = new Date()
    const nowIso = now.toISOString()
    const dueAt = phase === 'post'
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null

    const evaluation = {
        evaluation_id: generateId(),
        course,
        phase,
        score,
        percentage,
        total_questions: totalQuestions,
        section_id: sectionId,
        recommended_start: recommendedStart,
        gaps,
        mastered_concepts: masteredConcepts,
        item_responses: Array.isArray(itemResponses)
            ? itemResponses.map((item, index) => normalizeEvaluationResponseItem(item, index))
            : [],
        created_at: nowIso,
        retention_due_at: dueAt
    }

    const records = getEvaluationStore().filter((record) => !(record.course === course && record.phase === phase))
    const next = [...records, evaluation]
    saveEvaluationStore(next)
    logEvaluationArtifact(sectionId || course, evaluation)
    persistInBackground(
        'evaluation_run',
        () => persistEvaluation(evaluation),
        { kind: 'evaluation_run', payload: evaluation }
    )
    return evaluation
}

export function getEvaluationStatus(course) {
    const evaluations = getEvaluationStore()
        .filter((record) => !course || record.course === course)
        .sort((left, right) => Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0))

    const byPhase = Object.fromEntries(
        ['pre', 'post', 'retention'].map((phase) => [
            phase,
            evaluations.find((record) => record.phase === phase) || null
        ])
    )

    return {
        evaluations,
        byPhase,
        pending: {
            post: !byPhase.post && Boolean(byPhase.pre),
            retention: Boolean(byPhase.post?.retention_due_at) && Date.parse(byPhase.post.retention_due_at) <= Date.now() && !byPhase.retention
        }
    }
}

function summarizeArtifactRevisionScores(rows = []) {
    const normalizedRows = rows
        .map((row) => ({
            id: row.id,
            section_id: row.section_id,
            course_id: row.course_id,
            artifact_type: row.artifact_type,
            studio_mode: row.studio_mode,
            judgment: row.judgment,
            score_count: Number(row.score_count || row.scored_traces || 1),
            learner_count: Number(row.learner_count || 0),
            trace_score: Number(row.trace_score || 0),
            trace_denominator: Number(row.trace_denominator || 8),
            claim_clarity: Number(row.claim_clarity || row.avg_claim_clarity || 0),
            evidence_alignment: Number(row.evidence_alignment || row.avg_evidence_alignment || row.average_evidence_alignment || 0),
            revision_depth: Number(row.revision_depth || row.avg_revision_depth || row.average_revision_depth || 0),
            judgment_quality: Number(row.judgment_quality || row.avg_judgment_quality || row.average_judgment_quality || 0),
            transfer_readiness: Number(row.transfer_readiness || row.avg_transfer_readiness || 0),
            specificity_delta: Number(row.specificity_delta || row.avg_specificity_delta || 0),
            overall_revision_quality: Number(row.overall_revision_quality || row.avg_overall_revision_quality || row.average_overall_revision_quality || 0),
            weak_evidence_count: Number(row.weak_evidence_count || 0),
            shallow_revision_count: Number(row.shallow_revision_count || 0),
            judgment_risk_count: Number(row.judgment_risk_count || 0),
            transfer_ready_count: Number(row.transfer_ready_count || 0),
            created_at: row.created_at || row.latest_score_at
        }))
        .sort((left, right) => Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0))

    const totalScores = normalizedRows.reduce((sum, row) => sum + Math.max(0, row.score_count || 0), 0)
    const average = (field) => totalScores
        ? Number((normalizedRows.reduce((sum, row) => sum + Number(row[field] || 0) * Math.max(0, row.score_count || 0), 0) / totalScores).toFixed(3))
        : 0

    return {
        totalScores,
        learnerCount: normalizedRows.reduce((sum, row) => sum + (row.learner_count || 0), 0),
        averageOverallRevisionQuality: average('overall_revision_quality'),
        averageEvidenceAlignment: average('evidence_alignment'),
        averageRevisionDepth: average('revision_depth'),
        averageJudgmentQuality: average('judgment_quality'),
        weakEvidenceCount: normalizedRows.reduce((sum, row) => sum + (row.weak_evidence_count || (row.evidence_alignment < 0.5 ? row.score_count : 0)), 0),
        shallowRevisionCount: normalizedRows.reduce((sum, row) => sum + (row.shallow_revision_count || (row.revision_depth < 0.5 ? row.score_count : 0)), 0),
        judgmentRiskCount: normalizedRows.reduce((sum, row) => sum + (row.judgment_risk_count || (row.judgment_quality < 0.5 ? row.score_count : 0)), 0),
        transferReadyCount: normalizedRows.reduce((sum, row) => sum + (row.transfer_ready_count || (row.transfer_readiness >= 0.7 ? row.score_count : 0)), 0),
        sectionRows: normalizedRows,
        recentScores: normalizedRows.slice(0, 8)
    }
}

export function getResearchDashboardSnapshot() {
    const traces = getRecentInterventionTraces(16)
    const evaluations = getEvaluationStore()
    const audits = getAuditStore()
    const learnerStore = getLearnerModelStore()
    const conceptStates = Object.values(learnerStore.concepts || {})

    const learnerMetrics = {
        averageForgettingRisk: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + (state.forgetting_risk || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        averageCalibrationDrift: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + (state.calibration_drift || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        averagePredictedNextCorrect: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + (state.predicted_next_correct || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        averagePredictedRetention: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + (state.predicted_retention || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        dominantMisconceptions: summarizeMisconceptions(
            conceptStates.reduce((bucket, state) => {
                Object.entries(state.misconceptions || {}).forEach(([type, count]) => {
                    bucket[type] = (bucket[type] || 0) + count
                })
                return bucket
            }, {})
        ).slice(0, 5),
        transferReadyConcepts: conceptStates.filter((state) => (state.transfer_readiness || 0) >= 0.7).length
    }

    const interventionMetrics = {
        open: traces.filter((trace) => ['recommended', 'engaged', 'awaiting_outcome'].includes(trace.status)).length,
        resolvedPositive: traces.filter((trace) => trace.status === 'resolved_positive').length,
        resolvedNegative: traces.filter((trace) => trace.status === 'resolved_negative').length
    }

    const evaluationMetrics = {
        preAverage: averageByPhase(evaluations, 'pre'),
        postAverage: averageByPhase(evaluations, 'post'),
        retentionAverage: averageByPhase(evaluations, 'retention')
    }

    const contentMetrics = {
        averageAudit: audits.length
            ? Number((audits.reduce((sum, audit) => sum + (audit.overall || 0), 0) / audits.length).toFixed(2))
            : 0,
        approvalRate: audits.length
            ? Number((audits.filter((audit) => audit.validator_pass || audit.release_status === 'approved').length / audits.length).toFixed(3))
            : 0,
        blockedCount: audits.filter((audit) => audit.release_status === 'blocked').length,
        latestAudits: audits.slice().sort((left, right) => Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0)).slice(0, 6)
    }

    return {
        traces,
        evaluations,
        audits,
        learnerMetrics,
        interventionMetrics,
        evaluationMetrics,
        contentMetrics,
        artifactMetrics: summarizeArtifactRevisionScores([])
    }
}

function buildSnapshotFromRemote({
    conceptStates = [],
    traces = [],
    evaluations = [],
    audits = [],
    artifactRevisionScores = [],
}) {
    const learnerMetrics = {
        averageForgettingRisk: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + Number(state.forgetting_risk || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        averageCalibrationDrift: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + Number(state.calibration_error || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        averagePredictedNextCorrect: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => sum + Number(state.mastery_prob || 0), 0) / conceptStates.length).toFixed(3))
            : 0,
        averagePredictedRetention: conceptStates.length
            ? Number((conceptStates.reduce((sum, state) => (
                sum + clamp(
                    Number(state.mastery_prob || 0) * 0.45
                    + (1 - Number(state.forgetting_risk || 0.5)) * 0.35
                    + Number(state.transfer_readiness || 0) * 0.2,
                    0,
                    1
                )
            ), 0) / conceptStates.length).toFixed(3))
            : 0,
        dominantMisconceptions: summarizeMisconceptions(
            conceptStates.reduce((bucket, state) => {
                const key = state.dominant_misconception
                if (key) {
                    bucket[key] = (bucket[key] || 0) + 1
                }
                return bucket
            }, {})
        ).slice(0, 5),
        transferReadyConcepts: conceptStates.filter((state) => Number(state.transfer_readiness || 0) >= 0.7).length
    }

    const interventionMetrics = {
        open: traces.filter((trace) => ['recommended', 'engaged', 'awaiting_outcome'].includes(trace.status)).length,
        resolvedPositive: traces.filter((trace) => trace.status === 'resolved_positive').length,
        resolvedNegative: traces.filter((trace) => trace.status === 'resolved_negative').length
    }

    const evaluationMetrics = {
        preAverage: averageByPhase(evaluations, 'pre'),
        postAverage: averageByPhase(evaluations, 'post'),
        retentionAverage: averageByPhase(evaluations, 'retention')
    }

    const contentMetrics = {
        averageAudit: audits.length
            ? Number((audits.reduce((sum, audit) => sum + Number(audit.overall || 0), 0) / audits.length).toFixed(2))
            : 0,
        approvalRate: audits.length
            ? Number((audits.filter((audit) => audit.approved).length / audits.length).toFixed(3))
            : 0,
        blockedCount: audits.filter((audit) => audit.release_status === 'blocked').length,
        latestAudits: audits
            .slice()
            .sort((left, right) => Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0))
            .slice(0, 6)
    }

    return {
        traces,
        evaluations,
        audits,
        learnerMetrics,
        interventionMetrics,
        evaluationMetrics,
        contentMetrics,
        artifactMetrics: summarizeArtifactRevisionScores(artifactRevisionScores)
    }
}

function normalizeCandidateAction(candidate) {
    if (!candidate) return null
    if (typeof candidate === 'string') {
        return { action: candidate, title: candidate, rationale: '' }
    }
    return {
        action: candidate.action || candidate.id || 'alternate',
        title: candidate.title || candidate.action || 'Alternate action',
        rationale: candidate.rationale || ''
    }
}

function mapRemoteTrace(traceRow, decisionRow) {
    const explanation = decisionRow?.explanation_snapshot || {}
    const reasoning = explanation?.reasoning || {}
    const chosenAction = decisionRow?.chosen_action || 'support'
    // Rejected candidate actions are the persisted candidates the policy did NOT
    // select. Surfacing them (with the evidence snapshot) is what makes the
    // decision auditable as RCT data for the instructor view.
    const rejectedActions = (decisionRow?.candidate_actions || [])
        .map(normalizeCandidateAction)
        .filter((candidate) => candidate && candidate.action !== chosenAction)
    return {
        trace_id: traceRow.trace_id,
        section_id: traceRow.section_id,
        section_title: traceRow.notes?.section_title || null,
        status: traceRow.status,
        opened_at: traceRow.opened_at,
        closed_at: traceRow.closed_at,
        accepted: traceRow.accepted,
        outcome_label: traceRow.outcome_label,
        rejected_actions: rejectedActions,
        evidence_snapshot: reasoning?.evidence_snapshot || decisionRow?.evidence_snapshot || {},
        recommendation: {
            primary_recommendation: {
                action: chosenAction,
                rationale: explanation?.rationale || 'No rationale recorded.',
                focus_concepts: decisionRow?.concept_ids || []
            },
            reasoning: {
                confidence: Number(decisionRow?.policy_score?.confidence || 0),
                reason_codes: reasoning?.reason_codes || [],
                recommended_because: reasoning?.recommended_because || [],
                not_recommended_because: reasoning?.not_recommended_because || [],
                action_scores: reasoning?.action_scores || {},
                predicted_outcomes: reasoning?.predicted_outcomes || {},
                policy_strategy: reasoning?.policy_strategy || 'heuristic_bandit_v2',
                evidence_snapshot: reasoning?.evidence_snapshot || {}
            }
        }
    }
}

export async function fetchResearchDashboardSnapshot() {
    if (!isSupabaseConfigured) {
        return getResearchDashboardSnapshot()
    }

    try {
        const [
            learnerStateResponse,
            traceResponse,
            decisionResponse,
            evaluationResponse,
            auditResponse,
            artifactRevisionResponse
        ] = await Promise.all([
            supabase
                .from('learner_concept_state')
                .select('concept_id, mastery_prob, forgetting_risk, calibration_error, dominant_misconception, transfer_readiness')
                .order('updated_at', { ascending: false }),
            supabase
                .from('intervention_traces')
                .select('trace_id, section_id, status, accepted, outcome_label, opened_at, closed_at, notes, recommendation_id')
                .order('opened_at', { ascending: false }),
            supabase
                .from('recommendation_decisions')
                .select('id, trace_id, chosen_action, concept_ids, candidate_actions, evidence_snapshot, explanation_snapshot, policy_score, created_at')
                .order('created_at', { ascending: false }),
            supabase
                .from('evaluation_runs')
                .select('id, phase, score_pct, created_at')
                .order('created_at', { ascending: false }),
            supabase
                .from('content_audits')
                .select('id, auto_score, approved, rubric_breakdown, created_at')
                .order('created_at', { ascending: false }),
            supabase
                .from('artifact_revision_cohort_summary')
                .select('course_id, section_id, studio_mode, artifact_type, score_count, learner_count, avg_claim_clarity, avg_evidence_alignment, avg_revision_depth, avg_judgment_quality, avg_transfer_readiness, avg_specificity_delta, avg_overall_revision_quality, weak_evidence_count, shallow_revision_count, judgment_risk_count, transfer_ready_count, latest_score_at')
                .order('latest_score_at', { ascending: false })
                .limit(200)
        ])

        const conceptStates = learnerStateResponse?.data || []
        const traceRows = (traceResponse?.data || []).slice(0, 16)
        const decisionById = Object.fromEntries((decisionResponse?.data || []).map((row) => [row.id, row]))
        const traces = traceRows.map((trace) => mapRemoteTrace(trace, decisionById[trace.recommendation_id]))
        const evaluations = (evaluationResponse?.data || []).map((row) => ({
            evaluation_id: row.id,
            phase: row.phase,
            percentage: Number(row.score_pct || 0),
            created_at: row.created_at
        }))
        const audits = (auditResponse?.data || []).map((row) => ({
            audit_id: row.id,
            overall: Number(row.auto_score || 0),
            approved: Boolean(row.approved),
            release_status: row.rubric_breakdown?.release_status || (row.approved ? 'approved' : 'review'),
            created_at: row.created_at
        }))

        return buildSnapshotFromRemote({
            conceptStates,
            traces,
            evaluations,
            audits,
            artifactRevisionScores: artifactRevisionResponse?.data || []
        })
    } catch (error) {
        console.warn('[Research] Falling back to local dashboard snapshot:', error)
        return getResearchDashboardSnapshot()
    }
}

function averageByPhase(records, phase) {
    const matches = records.filter((record) => record.phase === phase)
    if (matches.length === 0) return 0
    return Number((matches.reduce((sum, record) => sum + (record.percentage || 0), 0) / matches.length).toFixed(1))
}

export async function fetchRctSnapshot() {
    if (!isSupabaseConfigured) {
        return { interventionOutcomes: [], evaluationGains: [], telemetryProfile: [], itemDiagnostics: [] }
    }

    try {
        const [outcomes, gains, telemetry, itemDiagnostics] = await Promise.all([
            supabase.from('rct_intervention_outcomes').select('*'),
            supabase.from('rct_evaluation_gains').select('*'),
            supabase.from('rct_user_telemetry_profile').select('*').limit(50),
            supabase.from('rct_evaluation_item_diagnostics').select('*').limit(200),
        ])

        return {
            interventionOutcomes: outcomes?.data || [],
            evaluationGains: gains?.data || [],
            telemetryProfile: telemetry?.data || [],
            itemDiagnostics: itemDiagnostics?.data || [],
        }
    } catch (error) {
        console.warn('[Research] RCT snapshot fetch failed:', error)
        return { interventionOutcomes: [], evaluationGains: [], telemetryProfile: [], itemDiagnostics: [] }
    }
}
