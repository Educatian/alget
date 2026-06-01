import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildCohortLearnerProfile,
    clearCohortLearner,
    getCohortGuestCredentials,
    persistCohortLearner,
    readCohortLearner,
    signInCohortLearner,
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
})
