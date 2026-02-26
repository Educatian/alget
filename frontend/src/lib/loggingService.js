/**
 * ALGET Logging Service
 * Research-grade behavioral logging with sequential analysis support
 */
import { supabase } from './supabase'

// Session state
let sessionId = null
let sequenceCounter = 0
let userId = null
let eventQueue = []
let flushTimer = null
let lastScrollDepth = 0
let lastClickTarget = null
let lastClickTime = 0

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

/**
 * Initialize a new session
 */
export async function initSession(user) {
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

    // Immediate flush for important events
    if (['problem_attempt', 'session_end'].includes(eventType)) {
        flushEvents()
    }

    return event
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
 * Flush events to database
 */
async function flushEvents() {
    if (eventQueue.length === 0 || !userId) return

    // Do not sync events to Supabase for the guest user
    if (userId === '00000000-0000-0000-0000-000000000000') {
        eventQueue = []
        return
    }

    const eventsToSend = [...eventQueue]
    eventQueue = []

    try {
        const { error } = await supabase.from('event_logs').insert(eventsToSend)
        if (error) {
            // Put events back in queue for retry
            eventQueue = [...eventsToSend, ...eventQueue]
            console.warn('[Logging] Flush failed, will retry:', error)
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
    // Synchronous flush using sendBeacon
    if (eventQueue.length > 0 && userId) {
        const payload = JSON.stringify(eventQueue)
        navigator.sendBeacon?.('/api/log-events', payload)
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
