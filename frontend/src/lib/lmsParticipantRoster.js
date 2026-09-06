/**
 * Local, pseudonymous roster contract for the LTPS 210 Introduction to LMS
 * preview.  This module does not create accounts, authenticate learners, or
 * map participant numbers to identity.  It only gives a course-scoped,
 * stable key that a coordinator can bind to an already-authenticated account
 * after consent and approval.
 */

export const LMS_CLASS_COHORT_ID = 'ltps210-intro-lms-fa26'
// `inst-design` is the existing ALGET content key; the human-facing course
// title is LTPS 210 (kept in lmsClassExemplar.js). Keeping this key aligned
// with the reader prevents cross-course joins with another course's 01–30.
export const LMS_CLASS_COURSE_ID = 'inst-design'
export const LMS_CLASS_PARTICIPANT_COUNT = 30

const PARTICIPANT_ID_PATTERN = /^participant-(0[1-9]|[12][0-9]|30)$/

export const LMS_CLASS_PARTICIPANT_SLOTS = Object.freeze(
    Array.from({ length: LMS_CLASS_PARTICIPANT_COUNT }, (_, index) => {
        const number = String(index + 1).padStart(2, '0')
        return Object.freeze({
            participantId: `participant-${number}`,
            participant_id: `participant-${number}`,
            label: `Participant ${number}`,
            number: index + 1,
            courseId: LMS_CLASS_COURSE_ID,
            course_id: LMS_CLASS_COURSE_ID,
            cohortId: LMS_CLASS_COHORT_ID,
            cohort_id: LMS_CLASS_COHORT_ID,
            active: false,
        })
    }),
)

function cleanParticipantId(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-')
    if (PARTICIPANT_ID_PATTERN.test(normalized)) return normalized
    return null
}

/**
 * Build a roster with at most the requested number of active slots.  Active
 * IDs are not credentials; callers must still supply the current auth user or
 * invitation-bound token before reading/writing any learner data.
 */
export function buildLmsParticipantRoster(activeParticipantIds = []) {
    const active = new Set(
        (Array.isArray(activeParticipantIds) ? activeParticipantIds : [])
            .map(cleanParticipantId)
            .filter(Boolean),
    )
    return LMS_CLASS_PARTICIPANT_SLOTS.map((slot) => ({ ...slot, active: active.has(slot.participantId) }))
}

export function getLmsParticipantSlot(participantId) {
    const normalized = cleanParticipantId(participantId)
    return normalized ? LMS_CLASS_PARTICIPANT_SLOTS.find((slot) => slot.participantId === normalized) || null : null
}

/** Stable join key; keep course and cohort in every export row. */
export function buildLmsParticipantKey(participantId, {
    courseId = LMS_CLASS_COURSE_ID,
    cohortId = LMS_CLASS_COHORT_ID,
} = {}) {
    const slot = getLmsParticipantSlot(participantId)
    if (!slot) return null
    const safeCourseId = String(courseId || '').trim().toLowerCase()
    const safeCohortId = String(cohortId || '').trim().toLowerCase()
    if (!safeCourseId || !safeCohortId) return null
    return `${safeCourseId}:${safeCohortId}:${slot.participantId}`
}

/**
 * Add participant metadata to a derived event without placing a participant
 * number in an auth field. This is useful for synthetic tests and for the
 * future server-side export adapter once an authenticated roster binding is
 * approved.
 */
export function withLmsParticipantScope(event, participantId, {
    courseId = LMS_CLASS_COURSE_ID,
    cohortId = LMS_CLASS_COHORT_ID,
} = {}) {
    const slot = getLmsParticipantSlot(participantId)
    if (!slot || !event || typeof event !== 'object') return event
    return {
        ...event,
        course_id: String(courseId || '').trim().toLowerCase() || LMS_CLASS_COURSE_ID,
        cohort_id: String(cohortId || '').trim().toLowerCase() || LMS_CLASS_COHORT_ID,
        participant_id: slot.participantId,
        participant_key: buildLmsParticipantKey(slot.participantId, { courseId, cohortId }),
    }
}

export const LMS_PARTICIPANT_ACCESS_NOTE =
    'Participant IDs are pseudonymous export keys only. Authentication and access control must use the existing signed-in account or invitation-bound token.'

export const LMS_CLASS_ROSTER_BINDINGS_KEY = 'alget_lms_roster_bindings_v1'

function readBindings() {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(LMS_CLASS_ROSTER_BINDINGS_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function writeBindings(bindings) {
    if (typeof window === 'undefined') return false
    try {
        window.localStorage.setItem(LMS_CLASS_ROSTER_BINDINGS_KEY, JSON.stringify(bindings))
        return true
    } catch {
        return false
    }
}

function isInstructorRequester(requester) {
    const role = requester?.app_metadata?.role || requester?.role
    return ['admin', 'course_admin', 'instructor'].includes(role)
}

function requesterId(requester) {
    return String(requester?.id || requester?.authUserId || '').trim()
}

function assertRosterScope(courseId, cohortId) {
    if (String(courseId || '').trim().toLowerCase() !== LMS_CLASS_COURSE_ID || String(cohortId || '').trim().toLowerCase() !== LMS_CLASS_COHORT_ID) {
        throw new Error('lms_roster_scope_mismatch')
    }
}

/**
 * Bind an already-authenticated account to one local slot. Participant IDs
 * cannot be supplied as authUserId. `synthetic: true` is intentionally
 * required for local QA fixtures and must never be used for a real roster.
 */
export function activateLmsParticipant({ participantId, authUserId, courseId = LMS_CLASS_COURSE_ID, cohortId = LMS_CLASS_COHORT_ID, role = 'learner', synthetic = false } = {}) {
    assertRosterScope(courseId, cohortId)
    const slot = getLmsParticipantSlot(participantId)
    const safeAuthUserId = String(authUserId || '').trim()
    if (!slot) throw new Error('lms_participant_slot_invalid')
    if (!safeAuthUserId || safeAuthUserId.toLowerCase() === slot.participantId || /^participant[-_ ]/i.test(safeAuthUserId)) throw new Error('lms_auth_user_required')
    if (synthetic !== true && /^synthetic[-_]/i.test(safeAuthUserId)) throw new Error('lms_synthetic_binding_requires_explicit_flag')

    const bindings = readBindings()
    const existingSlot = bindings.find((entry) => entry.course_id === LMS_CLASS_COURSE_ID && entry.cohort_id === LMS_CLASS_COHORT_ID && entry.participant_id === slot.participantId && entry.active)
    if (existingSlot && existingSlot.auth_user_id !== safeAuthUserId) throw new Error('lms_slot_already_bound')
    const existingAuth = bindings.find((entry) => entry.course_id === LMS_CLASS_COURSE_ID && entry.cohort_id === LMS_CLASS_COHORT_ID && entry.auth_user_id === safeAuthUserId && entry.active && entry.participant_id !== slot.participantId)
    if (existingAuth) throw new Error('lms_auth_user_already_bound')

    const binding = {
        binding_id: buildLmsParticipantKey(slot.participantId, { courseId, cohortId }),
        course_id: LMS_CLASS_COURSE_ID,
        cohort_id: LMS_CLASS_COHORT_ID,
        participant_id: slot.participantId,
        participant_key: buildLmsParticipantKey(slot.participantId, { courseId, cohortId }),
        auth_user_id: safeAuthUserId,
        role: String(role || 'learner'),
        active: true,
        synthetic: Boolean(synthetic),
        activated_at: existingSlot?.activated_at || new Date().toISOString(),
    }
    const next = bindings.filter((entry) => entry.binding_id !== binding.binding_id)
    next.push(binding)
    writeBindings(next)
    return { ...binding }
}

export function deactivateLmsParticipant({ participantId, requester, courseId = LMS_CLASS_COURSE_ID, cohortId = LMS_CLASS_COHORT_ID } = {}) {
    assertRosterScope(courseId, cohortId)
    const slot = getLmsParticipantSlot(participantId)
    if (!slot) throw new Error('lms_participant_slot_invalid')
    const bindings = readBindings()
    const binding = bindings.find((entry) => entry.participant_id === slot.participantId && entry.course_id === LMS_CLASS_COURSE_ID && entry.cohort_id === LMS_CLASS_COHORT_ID)
    if (!binding) return null
    const requesterAuthId = requesterId(requester)
    if (!isInstructorRequester(requester) && requesterAuthId !== binding.auth_user_id) throw new Error('lms_roster_forbidden')
    const next = bindings.map((entry) => entry.binding_id === binding.binding_id ? { ...entry, active: false, deactivated_at: new Date().toISOString() } : entry)
    writeBindings(next)
    return { ...binding, active: false }
}

/** Return only rows the requester is allowed to see. */
export function listLmsParticipantBindings({ requester, courseId = LMS_CLASS_COURSE_ID, cohortId = LMS_CLASS_COHORT_ID } = {}) {
    assertRosterScope(courseId, cohortId)
    const bindings = readBindings().filter((entry) => entry.course_id === LMS_CLASS_COURSE_ID && entry.cohort_id === LMS_CLASS_COHORT_ID && entry.active)
    if (isInstructorRequester(requester)) return bindings.map((entry) => ({ ...entry }))
    const authUserId = requesterId(requester)
    if (!authUserId) return []
    return bindings.filter((entry) => entry.auth_user_id === authUserId).map((entry) => ({ ...entry }))
}

/**
 * Learners can read only their own active binding. Instructors/admins can
 * read a bound slot only within this course/cohort; no number-only lookup is
 * accepted.
 */
export function canAccessLmsParticipantData({ requester, participantId, courseId = LMS_CLASS_COURSE_ID, cohortId = LMS_CLASS_COHORT_ID } = {}) {
    assertRosterScope(courseId, cohortId)
    const slot = getLmsParticipantSlot(participantId)
    if (!slot) return false
    const binding = readBindings().find((entry) => entry.participant_id === slot.participantId && entry.course_id === LMS_CLASS_COURSE_ID && entry.cohort_id === LMS_CLASS_COHORT_ID && entry.active)
    if (!binding) return false
    if (isInstructorRequester(requester)) return true
    return Boolean(requesterId(requester) && requesterId(requester) === binding.auth_user_id)
}
