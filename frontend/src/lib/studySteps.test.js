import { describe, expect, it, vi } from 'vitest'

const updateUser = vi.fn(async () => ({ error: null }))
vi.mock('./supabase', () => ({ supabase: { auth: { updateUser } } }))
vi.mock('./loggingService', () => ({ logEvent: vi.fn() }))

const { getStudySteps, markStepDone } = await import('./studySteps')

const bio = (steps = {}) => ({ app_metadata: { study_track: 'bio', study_id: 'BIO-7K3Q-9MZP' }, user_metadata: { study_steps: steps } })
const basic = (steps = {}) => ({ app_metadata: { study_track: 'basic', study_id: 'BAS-2345-6789' }, user_metadata: { study_steps: steps } })

describe('studySteps', () => {
    it('returns nothing for accounts that are not in the study', () => {
        expect(getStudySteps({ app_metadata: {} })).toBeNull()
    })

    it('builds Qualtrics links that carry the Study ID, cohort and wave', () => {
        const pre = getStudySteps(bio())[0]
        const url = new URL(pre.url)
        expect(url.origin + url.pathname).toBe('https://universityofalabama.az1.qualtrics.com/jfe/form/SV_5z5mWwX62DyFRCC')
        expect(Object.fromEntries(url.searchParams)).toEqual({ study_id: 'BIO-7K3Q-9MZP', cohort: 'study-bio', wave: 'pre' })
    })

    it('unlocks the steps in order', () => {
        const steps = getStudySteps(bio({ pre: '2026-10-15T10:00:00Z' }))
        expect(steps.map((s) => [s.id, s.done, s.unlocked])).toEqual([
            ['pre', true, true], ['learn', false, true], ['posttest', false, false], ['post', false, false], ['gift', false, false],
        ])
    })

    it('opens the shared posttest with the right cohort for each track', () => {
        const bioUrl = new URL(getStudySteps(bio()).find((s) => s.id === 'posttest').url)
        const basicUrl = new URL(getStudySteps(basic()).find((s) => s.id === 'posttest').url)
        expect(bioUrl.pathname).toContain('SV_8xjjebrtWhJnpKC')
        expect(basicUrl.pathname).toContain('SV_8xjjebrtWhJnpKC')
        expect(bioUrl.searchParams.get('cohort')).toBe('study-bio')
        expect(basicUrl.searchParams.get('cohort')).toBe('study-basic')
    })

    it('saves a step once, keeping earlier steps', async () => {
        await markStepDone(bio({ pre: 'earlier' }), 'learn')
        expect(updateUser).toHaveBeenCalledWith({ data: { study_steps: { pre: 'earlier', learn: expect.any(String) } } })
        updateUser.mockClear()
        await markStepDone(bio({ pre: 'earlier' }), 'pre')
        await markStepDone(bio(), 'not-a-step')
        expect(updateUser).not.toHaveBeenCalled()
    })
})
