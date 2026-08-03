/**
 * Research-export contract for the ALGET pilot.
 * Runtime telemetry may contain richer product diagnostics, but a research
 * export must be reduced to this allow-list and never include free text or
 * direct identifiers.
 */
export const PILOT_EVENT_SCHEMA_VERSION = 'alget-pilot-events-v1'

const PAYLOAD_KEYS = {
    section_opened: ['mode', 'device_class'],
    section_completed: ['elapsed_bucket'],
    evidence_echo_opened: ['source_count'],
    peer_pulse_seen: ['peer_count_bucket'],
    your_cue_selected: ['cue_type'],
    social_round_started: ['activity_type'],
    social_evidence_compared: ['evidence_submitted', 'rubric_score'],
    tutor_opened: ['intent'],
    tutor_source_opened: ['citation_id'],
    assessment_submitted: ['score', 'attempt_bucket'],
    artifact_trace_submitted: ['quality_score', 'trace_complete'],
    instructor_reviewed_draft: ['decision', 'correction_count'],
    module_published: ['version', 'source_count'],
}

export const PILOT_EVENT_TYPES = Object.freeze(Object.keys(PAYLOAD_KEYS))

function clampNumber(value, min = 0, max = 1) {
    const number = Number(value)
    if (!Number.isFinite(number)) return null
    return Math.min(max, Math.max(min, number))
}

function sanitizeValue(key, value) {
    if (value === null || value === undefined) return null
    if (['score', 'quality_score', 'rubric_score'].includes(key)) return clampNumber(value)
    if (['source_count', 'correction_count'].includes(key)) return Math.max(0, Math.round(Number(value) || 0))
    if (key === 'trace_complete' || key === 'evidence_submitted') return Boolean(value)
    return typeof value === 'string' ? value.trim().slice(0, 120) : null
}

/** Return a research-safe, allow-listed payload for a known pilot event. */
export function sanitizePilotPayload(eventType, payload = {}) {
    const keys = PAYLOAD_KEYS[eventType]
    if (!keys) return null
    return Object.fromEntries(keys.map((key) => [key, sanitizeValue(key, payload[key])]).filter(([, value]) => value !== null))
}

/**
 * Build the stable export shape. Identifiers are supplied as pseudonyms by the
 * caller; this helper intentionally has no access to names, emails, or raw
 * writing.
 */
export function buildPilotEvent({ eventType, courseId, sectionId, actorHash, occurredAt, payload = {} }) {
    const safePayload = sanitizePilotPayload(eventType, payload)
    if (!safePayload) throw new Error(`Unsupported pilot event type: ${eventType}`)
    if (!courseId || !sectionId || !actorHash) throw new Error('Pilot events require pseudonymous course, section, and actor identifiers')
    return {
        schema_version: PILOT_EVENT_SCHEMA_VERSION,
        event_type: eventType,
        course_id: String(courseId),
        section_id: String(sectionId),
        actor_hash: String(actorHash),
        occurred_at: occurredAt || new Date().toISOString(),
        payload: safePayload,
    }
}
