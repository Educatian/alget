/**
 * Stuck Detector - Detects when user is stuck and triggers assistance
 */

export const STUCK_RULES = {
    CONSECUTIVE_WRONG: 2,      // 2 consecutive incorrect answers
    IDLE_TIMEOUT_MS: 90000,    // 90 seconds without input
    UNIT_ERROR_COUNT: 2,       // 2 unit conversion errors
    HINT_CLICK_COUNT: 2        // 2 consecutive hint requests
}

export interface StuckEvent {
    problemId: string | null
    sectionId: string | null
    reason: string
    timestamp: number
}

interface StuckContext {
    consecutiveWrong: number
    unitErrors: number
    hintClicks: number
    lastInputTime: number
    problemId: string | null
    sectionId: string | null
}

/**
 * Detects if user is stuck based on context
 */
export function detectStuckEvent(context: StuckContext): StuckEvent | null {
    const {
        consecutiveWrong,
        unitErrors,
        hintClicks,
        lastInputTime,
        problemId,
        sectionId
    } = context

    // Check consecutive wrong answers
    if (consecutiveWrong >= STUCK_RULES.CONSECUTIVE_WRONG) {
        return {
            problemId,
            sectionId,
            reason: `${consecutiveWrong} consecutive incorrect answers`,
            timestamp: Date.now()
        }
    }

    // Check unit errors
    if (unitErrors >= STUCK_RULES.UNIT_ERROR_COUNT) {
        return {
            problemId,
            sectionId,
            reason: 'Repeated unit conversion errors',
            timestamp: Date.now()
        }
    }

    // Check hint clicks
    if (hintClicks >= STUCK_RULES.HINT_CLICK_COUNT) {
        return {
            problemId,
            sectionId,
            reason: 'Multiple hint requests indicate difficulty',
            timestamp: Date.now()
        }
    }

    // Check idle time
    const idleTime = Date.now() - lastInputTime
    if (idleTime >= STUCK_RULES.IDLE_TIMEOUT_MS) {
        return {
            problemId,
            sectionId,
            reason: 'Extended period without answering',
            timestamp: Date.now()
        }
    }

    return null
}

/**
 * Creates initial stuck context
 */
export function createStuckContext(sectionId: string, problemId: string | null = null): StuckContext {
    return {
        consecutiveWrong: 0,
        unitErrors: 0,
        hintClicks: 0,
        lastInputTime: Date.now(),
        problemId,
        sectionId
    }
}

/**
 * Updates stuck context after an answer
 */
export function updateContextAfterAnswer(
    context: StuckContext,
    isCorrect: boolean,
    hasUnitError: boolean
): StuckContext {
    return {
        ...context,
        consecutiveWrong: isCorrect ? 0 : context.consecutiveWrong + 1,
        unitErrors: hasUnitError ? context.unitErrors + 1 : context.unitErrors,
        lastInputTime: Date.now()
    }
}

/**
 * Updates stuck context after hint click
 */
export function updateContextAfterHint(context: StuckContext): StuckContext {
    return {
        ...context,
        hintClicks: context.hintClicks + 1,
        lastInputTime: Date.now()
    }
}

/**
 * Logs stuck event to backend
 */
export async function logStuckEvent(event: StuckEvent, userId: string): Promise<void> {
    try {
        await fetch('/api/stuck-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                problem_id: event.problemId,
                section_id: event.sectionId,
                reason: event.reason,
                timestamp: new Date(event.timestamp).toISOString()
            })
        })
    } catch (err) {
        console.error('Failed to log stuck event:', err)
    }
}
