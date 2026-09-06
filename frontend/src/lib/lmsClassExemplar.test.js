import { describe, expect, it } from 'vitest'
import { buildLmsClassExportJoin, buildLmsFixtureEvents, deriveLmsCoachRecommendation, getLmsClassFixture, LMS_CLASS_CONFIG, LMS_CLASS_EXEMPLAR, LMS_CLASS_ROSTER } from './lmsClassExemplar'

describe('LMS class exemplar export join', () => {
    it('keeps only allowed event types and derived artifact scores', () => {
        const rows = buildLmsClassExportJoin([
            {
                user_id: 'learner-1',
                session_id: 'session-1',
                section_id: LMS_CLASS_EXEMPLAR.sectionPath,
                event_type: 'artifact_studio_trace',
                event_data: { client_seq: 3, submission_id: 'submission-7', answer: 'private prose' },
            },
            { user_id: 'learner-1', event_type: 'not_exportable', event_data: { answer: 'drop me' } },
        ], [{ submission_id: 'submission-7', score: 0.82 }])

        expect(rows).toEqual([{
            user_id: 'learner-1',
            session_id: 'session-1',
            section_id: LMS_CLASS_EXEMPLAR.sectionPath,
            event_type: 'artifact_studio_trace',
            client_seq: 3,
            submission_id: 'submission-7',
            artifact_score: 0.82,
        }])
        expect(JSON.stringify(rows)).not.toContain('private prose')
    })

    it('handles malformed inputs without widening the export boundary', () => {
        expect(buildLmsClassExportJoin(null, null)).toEqual([])
        expect(buildLmsClassExportJoin([{ event_type: 'sequence_check', event_data: { client_seq: 'bad' } }])).toEqual([{
            user_id: null,
            session_id: null,
            section_id: null,
            event_type: 'sequence_check',
            client_seq: null,
            submission_id: null,
            artifact_score: null,
        }])
    })

    it('keeps scoped participant keys for the local synthetic class fixtures', () => {
        const weakRows = buildLmsClassExportJoin(buildLmsFixtureEvents('intro-lms-weak', 'modify', 42, 'artifact-weak'))
        const readyRows = buildLmsClassExportJoin(buildLmsFixtureEvents('intro-lms-ready', 'accept', 31))

        expect(weakRows).toHaveLength(5)
        expect(readyRows).toHaveLength(5)
        expect(new Set(weakRows.map((row) => row.participant_id))).toEqual(new Set(['participant-01']))
        expect(new Set(readyRows.map((row) => row.participant_id))).toEqual(new Set(['participant-02']))
        expect(weakRows.every((row) => row.course_id === 'inst-design' && row.cohort_id === 'ltps210-intro-lms-fa26')).toBe(true)
        expect(weakRows.find((row) => row.event_type === 'analytics_coach_decision')).toMatchObject({ participant_key: expect.stringContaining('participant-01'), next_action: 'review_weakest_concept', qualitative_artifact_id: 'artifact-weak' })
        expect(JSON.stringify(weakRows)).not.toContain('42-character')
    })

    it('drops participant rows with a mismatched course/cohort scope or forged key', () => {
        const rows = buildLmsClassExportJoin([
            {
                user_id: 'auth-user',
                session_id: 'session-cross-course',
                section_id: LMS_CLASS_EXEMPLAR.sectionPath,
                event_type: 'analytics_coach_decision',
                course_id: 'other-course',
                cohort_id: 'other-cohort',
                participant_id: 'participant-01',
                participant_key: 'other-course:other-cohort:participant-01',
                event_data: { decision: 'accept', reason_length: 20 },
            },
        ])
        expect(rows).toEqual([])
    })

    it('defines a 30-slot local roster without making slot numbers credentials', () => {
        expect(LMS_CLASS_ROSTER.capacity).toBe(30)
        expect(LMS_CLASS_ROSTER.activeCount).toBe(0)
        expect(LMS_CLASS_ROSTER.slots).toHaveLength(30)
        expect(LMS_CLASS_ROSTER.slots[0]).toMatchObject({ participantId: 'participant-01', active: false })
        expect(LMS_CLASS_ROSTER.slots[29]).toMatchObject({ participantId: 'participant-30', active: false })
        expect(LMS_CLASS_ROSTER.accessBoundary).toMatch(/never authenticate/i)
    })

    it('keeps email-confirmed facts, user-stated facts, and open questions separate', () => {
        expect(LMS_CLASS_CONFIG.course.provenance).toBe('confirmed-from-email')
        expect(LMS_CLASS_CONFIG.collaborator.displayLabel).toBe('연지정')
        expect(LMS_CLASS_CONFIG.collaborator.emailDisplayLabel).toBe('Jung, Yeonji')
        expect(LMS_CLASS_CONFIG.learnerProfile.provenance).toBe('user-stated')
        expect(LMS_CLASS_CONFIG.learningDesign.provenance).toBe('proposed')
        expect(LMS_CLASS_CONFIG.unknowns.length).toBeGreaterThan(0)
        expect(getLmsClassFixture('intro-lms-weak').participantId).not.toBe(getLmsClassFixture('intro-lms-ready').participantId)
    })

    it('derives the action from observed records rather than fixture labels', () => {
        const weak = getLmsClassFixture('intro-lms-weak')
        const ready = getLmsClassFixture('intro-lms-ready')
        expect(deriveLmsCoachRecommendation({ masteryRows: weak.masteryRows, recentSection: weak.recentSection, latestExitTicket: weak.exitTickets[0] })).toMatchObject({ id: 'review_weakest_concept' })
        expect(deriveLmsCoachRecommendation({ masteryRows: ready.masteryRows, recentSection: ready.recentSection, latestExitTicket: ready.exitTickets[0] })).toMatchObject({ id: 'retention_check', rationale: expect.stringContaining('84%') })
    })
})
