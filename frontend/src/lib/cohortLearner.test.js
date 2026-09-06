import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildCohortLearnerProfile,
    buildInvitedCohortProfile,
    clearCohortLearner,
    getCohortGuestCredentials,
    persistCohortLearner,
    readCohortLearner,
    signInCohortLearner,
    toPrivacySafeLearnerProfile,
} from './cohortLearner'

vi.mock('./supabase', () => ({
    isSupabaseConfigured: false,
    supabase: {},
}))

beforeEach(() => {
    window.localStorage.clear()
})

describe('cohortLearner', () => {
    it('creates a stable cohort learner profile and deterministic credentials', () => {
        const first = buildCohortLearnerProfile({
            cohortId: 'cat531-summer2026',
            fullName: '  Jamie   Smith  ',
        })
        const second = buildCohortLearnerProfile({
            cohortId: 'cat531-summer2026',
            fullName: 'Jamie Smith',
        })

        expect(first.fullName).toBe('Jamie Smith')
        expect(first.learnerHash).toBe(second.learnerHash)

        persistCohortLearner(first)
        expect(readCohortLearner()).toMatchObject({
            fullName: 'Jamie Smith',
            cohortLabel: 'CAT 531',
            courseId: 'cat531-supplement',
        })
        expect(getCohortGuestCredentials()).toMatchObject({
            guestEmail: `student-cat531-summer2026-${first.learnerHash}@alget.test`,
        })

        clearCohortLearner()
        expect(readCohortLearner()).toBeNull()
    })

    it('returns a display user in offline mode', async () => {
        const user = await signInCohortLearner({
            cohortId: 'cat100-summer2-2026',
            fullName: 'Alex Lee',
        })

        expect(user).toMatchObject({
            displayName: 'Alex Lee',
            cohortLabel: 'CAT 100 Summer II',
            courseId: 'cat100-supplement',
            isCohortLearner: true,
        })
    })

    it('uses a random UUID study ID for research linkage, excludes the name, and never derives guest credentials', () => {
        const profile = buildCohortLearnerProfile({
            cohortId: 'bio-inspired-intervention-2026',
            fullName: 'This Name Must Be Ignored',
            studyId: '8b8d53f0-6c58-4f2a-91c6-b8eb3b42cf65',
        })

        expect(profile.fullName).toBe('Study Learner')
        expect(profile.learnerHash).toBe('8b8d53f0-6c58-4f2a-91c6-b8eb3b42cf65')
        expect(toPrivacySafeLearnerProfile(profile)).toEqual({
            cohortId: 'bio-inspired-intervention-2026',
            cohortLabel: 'Bio-Inspired Design Study',
            courseId: 'bio-inspired',
        })
        persistCohortLearner(profile)
        expect(window.localStorage.getItem('alget_social_alias')).toBe('Study Learner')
        expect(getCohortGuestCredentials(profile)).toBeNull()
        const sameProfile = buildCohortLearnerProfile({
            cohortId: 'bio-inspired-intervention-2026',
            fullName: 'A Different Name',
            studyId: '8b8d53f0-6c58-4f2a-91c6-b8eb3b42cf65',
        })
        expect(sameProfile.fullName).toBe(profile.fullName)
        expect(() => buildCohortLearnerProfile({
            cohortId: 'bio-inspired-intervention-2026',
            fullName: 'Research Learner',
            studyId: 'name@example.edu',
        })).toThrow(/UUID study ID/)
    })

    it('hydrates only an invitation-bound research profile and blocks self-signup', async () => {
        const invited = buildInvitedCohortProfile({
            user_metadata: {
                cohort_id: 'bio-inspired-intervention-2026',
                course_id: 'bio-inspired',
                learner_hash: '8b8d53f0-6c58-4f2a-91c6-b8eb3b42cf65',
            },
        })
        expect(invited).toMatchObject({
            fullName: 'Study Learner',
            learnerHash: '8b8d53f0-6c58-4f2a-91c6-b8eb3b42cf65',
            invitationBound: true,
        })
        expect(buildInvitedCohortProfile({
            user_metadata: {
                cohort_id: 'bio-inspired-intervention-2026',
                course_id: 'bio-inspired',
                learner_hash: 'not-a-study-id',
            },
        })).toBeNull()
        await expect(signInCohortLearner({
            cohortId: 'bio-inspired-intervention-2026',
            fullName: '',
            studyId: '8b8d53f0-6c58-4f2a-91c6-b8eb3b42cf65',
        })).rejects.toThrow(/invitation-only/)
    })
})
