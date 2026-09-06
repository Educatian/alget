import { canAccessLmsParticipantData, getLmsParticipantSlot, LMS_CLASS_COHORT_ID, LMS_CLASS_COURSE_ID } from './lmsParticipantRoster'

/**
 * Private local store for learner-authored qualitative evidence. It is
 * deliberately separate from event_logs: telemetry receives only bounded
 * lengths/enums, while an approved qualitative export can include the
 * learner's reason, revision, and reflection. No production activation is
 * implied by this module.
 */
export const LMS_QUALITATIVE_ARTIFACTS_KEY = 'alget_lms_qualitative_artifacts_v1'
const DECISIONS = new Set(['accept', 'modify', 'decline'])
const MAX_TEXT = 8000

function readArtifacts() {
    if (typeof window === 'undefined') return []
    try {
        const parsed = JSON.parse(window.localStorage.getItem(LMS_QUALITATIVE_ARTIFACTS_KEY) || '[]')
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function writeArtifacts(artifacts) {
    if (typeof window === 'undefined') return false
    try {
        window.localStorage.setItem(LMS_QUALITATIVE_ARTIFACTS_KEY, JSON.stringify(artifacts))
        return true
    } catch {
        return false
    }
}

function cleanText(value, label) {
    const text = String(value || '').trim()
    if (!text) throw new Error(`lms_qualitative_${label}_required`)
    return text.slice(0, MAX_TEXT)
}

function makeArtifactId() {
    try {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    } catch {
        // Fall through to a local-only opaque id.
    }
    return `qualitative-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isInstructor(requester) {
    const role = requester?.app_metadata?.role || requester?.role
    return ['admin', 'course_admin', 'instructor'].includes(role)
}

function withoutOwnerAuthId(artifact) {
    const safe = { ...artifact }
    delete safe.owner_auth_id
    return safe
}

function scopeFor(input = {}) {
    const courseId = String(input.courseId || LMS_CLASS_COURSE_ID).trim().toLowerCase()
    const cohortId = String(input.cohortId || LMS_CLASS_COHORT_ID).trim().toLowerCase()
    const participantId = String(input.participantId || '').trim().toLowerCase().replace(/\s+/g, '-')
    const slot = getLmsParticipantSlot(participantId)
    if (!slot || courseId !== LMS_CLASS_COURSE_ID || cohortId !== LMS_CLASS_COHORT_ID) throw new Error('lms_qualitative_scope_mismatch')
    return { courseId, cohortId, participantId: slot.participantId, sectionId: input.sectionId || null }
}

function canWriteSynthetic(input, scope) {
    return input.synthetic === true && /^synthetic-auth-/.test(String(input.ownerAuthId || '')) && scope.participantId
}

function assertWriteAccess(input, scope) {
    const ownerAuthId = String(input.ownerAuthId || input.requester?.id || '').trim()
    if (!ownerAuthId) throw new Error('lms_qualitative_owner_required')
    if (canWriteSynthetic({ ...input, ownerAuthId }, scope)) return ownerAuthId
    if (!canAccessLmsParticipantData({ requester: input.requester || { id: ownerAuthId }, participantId: scope.participantId, courseId: scope.courseId, cohortId: scope.cohortId })) throw new Error('lms_qualitative_forbidden')
    return ownerAuthId
}

/** Save a learner artifact, retaining raw text only in this access-controlled local store. */
export function saveLmsQualitativeArtifact(input = {}) {
    const scope = scopeFor(input)
    const ownerAuthId = assertWriteAccess(input, scope)
    const decision = String(input.decision || '').trim().toLowerCase()
    if (!DECISIONS.has(decision)) throw new Error('lms_qualitative_decision_invalid')
    const reasonText = cleanText(input.reasonText, 'reason')
    const reflectionText = cleanText(input.reflectionText, 'reflection')
    const modifiedProposalText = decision === 'modify' ? cleanText(input.modifiedProposalText, 'modified_proposal') : String(input.modifiedProposalText || '').trim().slice(0, MAX_TEXT)
    const now = new Date().toISOString()
    const artifact = {
        artifact_id: makeArtifactId(),
        course_id: scope.courseId,
        cohort_id: scope.cohortId,
        participant_id: scope.participantId,
        participant_key: `${scope.courseId}:${scope.cohortId}:${scope.participantId}`,
        session_id: input.sessionId || null,
        section_id: scope.sectionId,
        decision,
        reason_text: reasonText,
        modified_proposal_text: modifiedProposalText,
        reflection_text: reflectionText,
        previous_evidence: input.previousEvidence && typeof input.previousEvidence === 'object' ? input.previousEvidence : {},
        follow_up: input.followUp && typeof input.followUp === 'object' ? input.followUp : { next_action: null, result: 'pending' },
        synthetic: Boolean(input.synthetic),
        owner_auth_id: ownerAuthId,
        created_at: now,
        updated_at: now,
    }
    const artifacts = readArtifacts().filter((entry) => entry.artifact_id !== artifact.artifact_id)
    artifacts.push(artifact)
    writeArtifacts(artifacts)
    return { ...artifact }
}

/** Update only the follow-up fields after the learner opens/queues the action. */
export function updateLmsQualitativeArtifact(artifactId, { requester, ownerAuthId, followUp } = {}) {
    const artifacts = readArtifacts()
    const current = artifacts.find((entry) => entry.artifact_id === artifactId)
    if (!current) return null
    const authId = String(ownerAuthId || requester?.id || '').trim()
    const authorized = isInstructor(requester) || (authId && authId === current.owner_auth_id)
    if (!authorized) throw new Error('lms_qualitative_forbidden')
    const next = { ...current, follow_up: followUp && typeof followUp === 'object' ? followUp : current.follow_up, updated_at: new Date().toISOString() }
    writeArtifacts(artifacts.map((entry) => entry.artifact_id === artifactId ? next : entry))
    return { ...next }
}

/** Read only the requester's own artifact, or all scoped artifacts for a teacher/admin. */
export function listLmsQualitativeArtifacts({ requester, participantId, courseId = LMS_CLASS_COURSE_ID, cohortId = LMS_CLASS_COHORT_ID } = {}) {
    const scope = scopeFor({ participantId, courseId, cohortId })
    const artifacts = readArtifacts().filter((entry) => entry.course_id === scope.courseId && entry.cohort_id === scope.cohortId && entry.participant_id === scope.participantId)
    if (isInstructor(requester)) return artifacts.map(withoutOwnerAuthId)
    const authId = String(requester?.id || '').trim()
    if (!authId) return []
    return artifacts.filter((entry) => entry.owner_auth_id === authId).map(withoutOwnerAuthId)
}

/**
 * Approved qualitative export path. Full text is intentional here; callers
 * must pass an authenticated learner or instructor requester. Auth IDs never
 * leave the private store, and no direct identity fields are emitted.
 */
export function buildLmsQualitativeExport({ requester, participantId, courseId = LMS_CLASS_COURSE_ID, cohortId = LMS_CLASS_COHORT_ID } = {}) {
    return listLmsQualitativeArtifacts({ requester, participantId, courseId, cohortId }).map((artifact) => ({
        artifact_id: artifact.artifact_id,
        course_id: artifact.course_id,
        cohort_id: artifact.cohort_id,
        participant_id: artifact.participant_id,
        participant_key: artifact.participant_key,
        session_id: artifact.session_id,
        section_id: artifact.section_id,
        decision: artifact.decision,
        reason_text: artifact.reason_text,
        modified_proposal_text: artifact.modified_proposal_text,
        reflection_text: artifact.reflection_text,
        previous_evidence: artifact.previous_evidence,
        follow_up: artifact.follow_up,
        synthetic: artifact.synthetic,
        created_at: artifact.created_at,
        updated_at: artifact.updated_at,
    }))
}
