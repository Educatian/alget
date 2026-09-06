import { afterEach, describe, expect, it } from 'vitest'
import {
    LMS_CLASS_COHORT_ID,
    LMS_CLASS_COURSE_ID,
    LMS_CLASS_PARTICIPANT_SLOTS,
    LMS_CLASS_ROSTER_BINDINGS_KEY,
    activateLmsParticipant,
    buildLmsParticipantKey,
    buildLmsParticipantRoster,
    canAccessLmsParticipantData,
    deactivateLmsParticipant,
    getLmsParticipantSlot,
    listLmsParticipantBindings,
    withLmsParticipantScope,
} from './lmsParticipantRoster'

afterEach(() => window.localStorage.clear())

describe('local LTPS 210 participant roster', () => {
    it('creates thirty inactive slots and activates only requested valid slots', () => {
        expect(LMS_CLASS_PARTICIPANT_SLOTS).toHaveLength(30)
        expect(LMS_CLASS_PARTICIPANT_SLOTS[0]).toMatchObject({ participant_id: 'participant-01', course_id: LMS_CLASS_COURSE_ID, cohort_id: LMS_CLASS_COHORT_ID })
        const roster = buildLmsParticipantRoster(['participant-01', 'participant 02', 'participant-31', 'not-an-id'])
        expect(roster.filter((slot) => slot.active).map((slot) => slot.participantId)).toEqual(['participant-01', 'participant-02'])
    })

    it('requires course and cohort scope for stable keys', () => {
        const key = buildLmsParticipantKey('participant-07')
        expect(key).toBe(`${LMS_CLASS_COURSE_ID}:${LMS_CLASS_COHORT_ID}:participant-07`)
        expect(buildLmsParticipantKey('participant-00')).toBeNull()
        expect(getLmsParticipantSlot('participant 30')).toMatchObject({ participantId: 'participant-30', number: 30 })
    })

    it('adds scoped keys without putting the participant number in auth fields', () => {
        const event = withLmsParticipantScope({ user_id: 'auth-user', event_type: 'analytics_coach_response' }, 'participant-03')
        expect(event).toMatchObject({
            user_id: 'auth-user',
            participant_id: 'participant-03',
            course_id: LMS_CLASS_COURSE_ID,
            cohort_id: LMS_CLASS_COHORT_ID,
        })
        expect(event.email).toBeUndefined()
        expect(event.password).toBeUndefined()
    })

    it('binds a slot to an authenticated user, persists it, and scopes learner/instructor reads', () => {
        const binding = activateLmsParticipant({ participantId: 'participant-01', authUserId: 'auth-user-01' })
        expect(binding).toMatchObject({ participant_id: 'participant-01', active: true, synthetic: false })
        expect(window.localStorage.getItem(LMS_CLASS_ROSTER_BINDINGS_KEY)).toContain('auth-user-01')
        expect(listLmsParticipantBindings({ requester: { id: 'auth-user-01' } })).toHaveLength(1)
        expect(listLmsParticipantBindings({ requester: { id: 'auth-user-other' } })).toEqual([])
        expect(canAccessLmsParticipantData({ requester: { id: 'auth-user-01' }, participantId: 'participant-01' })).toBe(true)
        expect(canAccessLmsParticipantData({ requester: { id: 'auth-user-01' }, participantId: 'participant-02' })).toBe(false)
        expect(canAccessLmsParticipantData({ requester: { id: 'teacher-01', app_metadata: { role: 'instructor' } }, participantId: 'participant-01' })).toBe(true)
        expect(canAccessLmsParticipantData({ requester: { id: 'participant-01' }, participantId: 'participant-01' })).toBe(false)
    })

    it('rejects unscoped or impersonation-shaped activation and supports deactivation', () => {
        expect(() => activateLmsParticipant({ participantId: 'participant-03', authUserId: 'participant-03' })).toThrow('lms_auth_user_required')
        expect(() => activateLmsParticipant({ participantId: 'participant-03', authUserId: 'synthetic-auth-03' })).toThrow('lms_synthetic_binding_requires_explicit_flag')
        expect(() => activateLmsParticipant({ participantId: 'participant-03', authUserId: 'auth-user-03', cohortId: 'another-course' })).toThrow('lms_roster_scope_mismatch')
        const binding = activateLmsParticipant({ participantId: 'participant-03', authUserId: 'synthetic-auth-03', synthetic: true })
        expect(binding.synthetic).toBe(true)
        expect(() => deactivateLmsParticipant({ participantId: 'participant-03', requester: { id: 'other-user' } })).toThrow('lms_roster_forbidden')
        expect(deactivateLmsParticipant({ participantId: 'participant-03', requester: { id: 'teacher-01', role: 'instructor' } })).toMatchObject({ active: false })
        expect(canAccessLmsParticipantData({ requester: { id: 'synthetic-auth-03' }, participantId: 'participant-03' })).toBe(false)
    })
})
