/**
 * ALGET Logging Service
 * Research-grade behavioral logging with sequential analysis support
 */
import { supabase, supabaseConfig, isSupabaseConfigured } from './supabase'
import { safeLocalStorageGet, safeLocalStorageSet } from './browserStorage'
import API_BASE from './apiConfig'

// Session state
let sessionId = null
let sequenceCounter = 0
let userId = null
let eventQueue = []
let flushTimer = null
let lastScrollDepth = 0
let lastClickTarget = null
let lastClickTime = 0
let cachedAccessToken = null

// Config
const FLUSH_INTERVAL_MS = 5000
const CLICK_MERGE_MS = 500
const SCROLL_THRESHOLD = 10 // 10% increments

/**
 * Generate UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

function ensureGuestCredentials() {
    let guestId = safeLocalStorageGet('alget_guest_id')
    let guestPassword = safeLocalStorageGet('alget_guest_password')

    if (!guestId) {
        guestId = generateUUID().substring(0, 8)
        safeLocalStorageSet('alget_guest_id', guestId)
    }

    if (!guestPassword) {
        guestPassword = generateUUID() + generateUUID()
        safeLocalStorageSet('alget_guest_password', guestPassword)
    }

    return {
        guestEmail: `guest-${guestId}@alget.test`,
        guestPassword
    }
}

/**
 * Initialize a new session
 */
export async function initSession(user) {
    // Defensive: if a prior session is still active (e.g. demo -> real login
    // without an intervening endSession), tear down its flush timer + listeners
    // first so they don't accumulate (duplicate intervals / beforeunload handlers).
    if (flushTimer) {
        clearInterval(flushTimer)
        flushTimer = null
        window.removeEventListener('beforeunload', handleUnload)
        window.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    sessionId = generateUUID()
    sequenceCounter = 0
    userId = user?.id || null

    const deviceInfo = {
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    // Create session in database
    if (userId && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
            await supabase.from('user_sessions').insert({
                id: sessionId,
                user_id: userId,
                device_info: deviceInfo
            })
        } catch (err) {
            console.warn('Could not create session:', err)
        }
    } else {
        // We must create a real auth.users DB entry or the foreign key will reject all logs
        const { guestEmail, guestPassword } = ensureGuestCredentials()

        try {
            // Attempt to create a dummy user to bypass foreign key constraint
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: guestEmail,
                password: guestPassword
            });

            if (authError && authError.message.includes('already registered')) {
                // If already registered, just log them in
                const { data: signInData } = await supabase.auth.signInWithPassword({
                    email: guestEmail,
                    password: guestPassword
                });
                userId = signInData?.user?.id || '00000000-0000-0000-0000-000000000000';
            } else {
                userId = authData?.user?.id || '00000000-0000-0000-0000-000000000000';
            }

            // Now insert session with valid foreign key
            if (userId !== '00000000-0000-0000-0000-000000000000') {
                await supabase.from('user_sessions').insert({
                    id: sessionId,
                    user_id: userId,
                    device_info: deviceInfo
                });
            }
        } catch (err) {
            console.warn('Guest login failed. All FK DB requests will fail.', err);
            userId = '00000000-0000-0000-0000-000000000000';
        }
    }

    // Cache access token for unload-time sendBeacon (which can't await)
    if (isSupabaseConfigured) {
        try {
            const { data: { session: authSession } } = await supabase.auth.getSession()
            cachedAccessToken = authSession?.access_token || null
        } catch (err) {
            console.warn('[Logging] Could not cache access token:', err)
            cachedAccessToken = null
        }
    }

    // Start flush timer
    flushTimer = setInterval(flushEvents, FLUSH_INTERVAL_MS)

    // Flush on page unload
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    console.log('[Logging] Session started:', sessionId)
    return sessionId
}

/**
 * Log an event
 */
export function logEvent(eventType, eventTarget, eventData = {}, sectionId = null) {
    if (!sessionId) return
    // Offline/demo mode (no Supabase): the no-op stub always returns an error,
    // so flushEvents would re-queue forever and the queue would grow unbounded.
    // Drop telemetry instead of accumulating it.
    if (!isSupabaseConfigured) return

    const event = {
        user_id: userId,
        session_id: sessionId,
        sequence_num: ++sequenceCounter,
        event_type: eventType,
        event_target: eventTarget,
        event_data: eventData,
        section_id: sectionId,
        client_ts: new Date().toISOString()
    }

    eventQueue.push(event)
    // Hard cap so a prolonged backend outage can't grow the queue without bound;
    // keep the most recent events.
    if (eventQueue.length > 500) {
        eventQueue = eventQueue.slice(-500)
    }

    // Immediate flush for important events
    if (['problem_attempt', 'session_end', 'artifact_studio_trace'].includes(eventType)) {
        flushEvents()
    }

    return event
}

function toInteractionEvent(event) {
    return {
        user_id: event.user_id,
        session_id: event.session_id,
        section_id: event.section_id,
        item_id: event.event_data?.problem_id || event.event_target || null,
        event_type: event.event_type,
        event_ts: event.client_ts,
        client_seq: event.sequence_num,
        payload: {
            target: event.event_target,
            data: event.event_data || {},
            source_table: 'event_logs'
        }
    }
}

function toArtifactRevisionScore(event) {
    if (event.event_type !== 'artifact_studio_trace') {
        return null
    }

    const scores = event.event_data?.revision_scores
    if (!scores?.overall_revision_quality) {
        return null
    }

    const [courseId = null] = String(event.section_id || '').split('/')
    return {
        user_id: event.user_id,
        section_id: event.section_id,
        course_id: event.event_data?.course || courseId,
        artifact_type: event.event_data?.artifact || null,
        studio_mode: event.event_data?.studio_mode || null,
        judgment: event.event_data?.judgment || null,
        trace_score: Number(event.event_data?.trace_score || 0),
        trace_denominator: Number(event.event_data?.trace_denominator || 8),
        claim_clarity: Number(scores.claim_clarity || 0),
        evidence_alignment: Number(scores.evidence_alignment || 0),
        revision_depth: Number(scores.revision_depth || 0),
        judgment_quality: Number(scores.judgment_quality || 0),
        transfer_readiness: Number(scores.transfer_readiness || 0),
        specificity_delta: Number(scores.specificity_delta || 0),
        overall_revision_quality: Number(scores.overall_revision_quality || 0),
        diagnostics: {
            submission_id: event.event_data?.submission_id || null,
            artifact_definition_id: event.event_data?.artifact_definition_id || null,
            artifact_family: event.event_data?.artifact_family || null,
            artifact_submission_spec_version: event.event_data?.artifact_submission_spec_version || null,
            artifact_required_files: event.event_data?.artifact_required_files || null,
            artifact_accepted_formats: event.event_data?.artifact_accepted_formats || null,
            artifact_naming_pattern: event.event_data?.artifact_naming_pattern || null,
            artifact_required_sections: event.event_data?.artifact_required_sections || null,
            source_text_metrics: event.event_data?.source_text_metrics || null,
            raw_submission_privacy: event.event_data?.raw_submission_privacy || null,
            scorer_validation: event.event_data?.revision_score_validation || null,
            trace_validation: event.event_data?.server_validation || null,
            rubric: event.event_data?.rubric || null,
            support_move: event.event_data?.recommended_support_move || null,
        },
        privacy_policy: 'score-derived-only-v1',
        scorer_version: event.event_data?.revision_score_validation?.policy_version || 'artifact-revision-scorer-v1',
    }
}

async function validateArtifactStudioEvent(event) {
    if (event.event_type !== 'artifact_studio_trace') {
        return event
    }

    try {
        const response = await fetch(`${API_BASE}/research/artifact-trace/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event.event_data || {}),
        })

        if (!response.ok) {
            throw new Error(`artifact_validator_http_${response.status}`)
        }

        const validation = await response.json()
        return {
            ...event,
            event_data: {
                ...event.event_data,
                trace_score: validation.computed_trace_score,
                artifact_quality_score: validation.computed_artifact_quality_score,
                recommended_support_move: validation.recommended_support_move,
                rubric: validation.normalized_rubric,
                server_validation: validation,
            },
        }
    } catch (error) {
        console.warn('[Logging] Artifact trace server validation failed:', error)
        return {
            ...event,
            event_data: {
                ...event.event_data,
                server_validation: {
                    validator_pass: false,
                    validation_errors: ['artifact_trace_validator_unavailable'],
                    policy_version: 'artifact-trace-validator-v1',
                },
            },
        }
    }
}

async function validateResearchEvents(events) {
    return Promise.all(events.map(validateArtifactStudioEvent))
}

/**
 * Log click with merge logic
 */
export function logClick(target, x, y, sectionId = null) {
    const now = Date.now()
    const targetClassName = typeof target?.className === 'string' ? target.className : '';
    const targetId = target?.dataset?.testid || target?.id || targetClassName.split(' ')[0] || 'unknown'

    // Merge consecutive clicks on same target
    if (targetId === lastClickTarget && now - lastClickTime < CLICK_MERGE_MS) {
        return null
    }

    lastClickTarget = targetId
    lastClickTime = now

    return logEvent('click', targetId, { x, y }, sectionId)
}

/**
 * Log scroll with threshold
 */
export function logScroll(depthPercent, sectionId = null) {
    const roundedDepth = Math.floor(depthPercent / SCROLL_THRESHOLD) * SCROLL_THRESHOLD

    if (roundedDepth === lastScrollDepth) {
        return null
    }

    lastScrollDepth = roundedDepth
    return logEvent('scroll', null, { depth_percent: roundedDepth }, sectionId)
}

/**
 * Log page view
 */
export function logPageView(sectionId, referrerSection = null) {
    lastScrollDepth = 0 // Reset scroll tracking
    return logEvent('page_view', null, { referrer_section: referrerSection }, sectionId)
}

/**
 * Log problem attempt (no raw answer, just metrics)
 */
export function logProblemAttempt(problemId, isCorrect, timeSpentMs, hintUsed, sectionId) {
    return logEvent('problem_attempt', problemId, {
        problem_id: problemId,
        is_correct: isCorrect,
        time_spent_ms: timeSpentMs,
        hint_used: hintUsed
    }, sectionId)
}

/**
 * Log chat message (no raw text, just metrics)
 */
export function logChatMessage(turnNumber, messageLength, isUser, sectionId) {
    return logEvent('chat_message', null, {
        turn_number: turnNumber,
        message_length: messageLength,
        is_user: isUser
    }, sectionId)
}

/**
 * Log highlight creation (no raw text)
 */
export function logHighlightCreate(textLength, hasNote, sectionId) {
    return logEvent('highlight_create', null, {
        text_length: textLength,
        has_note: hasNote
    }, sectionId)
}

/**
 * Log stuck events (e.g., fast consecutive incorrect answers)
 */
export function logStuckEvent(problemId, reason, latencyBeforeClick, sectionId) {
    return logEvent('stuck_event', problemId, {
        reason: reason,
        latency_before_click_ms: latencyBeforeClick
    }, sectionId)
}

/**
 * Log time spent on reading/task
 */
export function logTimeOnTask(durationMs, sectionId) {
    return logEvent('time_on_task', null, {
        duration_ms: durationMs
    }, sectionId)
}

/**
 * Log specific interactions like opening accordions or tabs
 */
export function logInteraction(elementId, actionType, sectionId) {
    return logEvent('structural_interaction', elementId, {
        action: actionType
    }, sectionId)
}

/**
 * Log recommendation rationale snapshots for research analysis.
 */
export function logRecommendationDecision(sectionId, eventData = {}) {
    return logEvent('recommendation_decision', 'adaptive_engine', eventData, sectionId)
}

/**
 * Log intervention trace lifecycle updates.
 */
export function logInterventionTrace(sectionId, eventData = {}) {
    return logEvent('intervention_trace', eventData.trace_id || 'trace', eventData, sectionId)
}

/**
 * Log learner-model updates that go beyond mastery-only signals.
 */
export function logLearnerModelUpdate(sectionId, eventData = {}) {
    return logEvent('learner_model_update', eventData.concept_id || 'learner_model', eventData, sectionId)
}

/**
 * Log evaluation outcomes such as pre/post/retention assessments.
 */
export function logEvaluationArtifact(sectionId, eventData = {}) {
    return logEvent('evaluation_artifact', eventData.phase || 'evaluation', eventData, sectionId)
}

/**
 * Log support-content quality audits.
 */
export function logContentAudit(sectionId, eventData = {}) {
    return logEvent('content_audit', eventData.support_type || 'support', eventData, sectionId)
}

/**
 * Flush events to database
 */
async function flushEvents() {
    if (eventQueue.length === 0 || !userId) return
    // Nothing can persist without Supabase; clear rather than re-queue forever.
    if (!isSupabaseConfigured) {
        eventQueue = []
        return
    }

    // Note: We are no longer skipping the flush for the guest user ('00000000...'), 
    // because we have replaced it with `guestId` in initSession. 
    // If the backend allows anonymous inserts, they will go through. 
    // If RLS blocks it, we catch the error below.

    const queuedEvents = [...eventQueue]
    eventQueue = []
    const eventsToSend = await validateResearchEvents(queuedEvents)

    try {
        const { error } = await supabase.from('event_logs').insert(eventsToSend)
        if (error) {
            // Put events back in queue for retry
            eventQueue = [...eventsToSend, ...eventQueue]
            console.warn('[Logging] Flush failed, will retry:', error)
            return
        }

        const canonicalRows = eventsToSend.map(toInteractionEvent)
        const { error: canonicalError } = await supabase
            .from('interaction_events')
            .insert(canonicalRows)

        if (canonicalError) {
            console.warn('[Logging] Canonical interaction_events mirror failed:', canonicalError)
        }

        const artifactRevisionScoreRows = eventsToSend
            .map(toArtifactRevisionScore)
            .filter(Boolean)

        if (artifactRevisionScoreRows.length > 0) {
            const { error: artifactScoreError } = await supabase
                .from('artifact_revision_scores')
                .insert(artifactRevisionScoreRows)

            if (artifactScoreError) {
                console.warn('[Logging] Artifact revision score persistence failed:', artifactScoreError)
            }
        }
    } catch (err) {
        eventQueue = [...eventsToSend, ...eventQueue]
        console.warn('[Logging] Flush error:', err)
    }
}

/**
 * End session
 */
export async function endSession() {
    if (!sessionId) return

    logEvent('session_end', null, { total_events: sequenceCounter })
    await flushEvents()

    // Update session record
    if (userId && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
            await supabase.from('user_sessions').update({
                ended_at: new Date().toISOString(),
                total_events: sequenceCounter
            }).eq('id', sessionId)
        } catch (err) {
            console.warn('Could not end session:', err)
        }
    }

    // Cleanup
    clearInterval(flushTimer)
    window.removeEventListener('beforeunload', handleUnload)
    window.removeEventListener('visibilitychange', handleVisibilityChange)

    console.log('[Logging] Session ended:', sessionId, 'Events:', sequenceCounter)
    sessionId = null
}

/**
 * Handle page unload
 */
function handleUnload() {
    if (eventQueue.length === 0 || !userId || !navigator.sendBeacon) return
    if (!isSupabaseConfigured || !supabaseConfig.url || !supabaseConfig.anonKey) return

    const payload = JSON.stringify({
        events: eventQueue,
        supabase_url: supabaseConfig.url,
        supabase_anon_key: supabaseConfig.anonKey,
        access_token: cachedAccessToken,
    })

    try {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(`${API_BASE}/log-events`, blob)
    } catch (err) {
        console.warn('[Logging] sendBeacon failed:', err)
    }
}

/**
 * Handle visibility change (tab switch)
 */
function handleVisibilityChange() {
    if (document.hidden) {
        flushEvents()
    }
}

/**
 * Get current session info
 */
export function getSessionInfo() {
    return { sessionId, sequenceCounter, userId }
}
