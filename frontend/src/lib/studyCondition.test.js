import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({
    isSupabaseConfigured: true,
    supabase: { rpc },
}))

import {
    COMPARISON_ARM,
    TREATMENT_ARM,
    canUseAdaptiveSupport,
    loadStudyCondition,
} from './studyCondition'

const learner = {
    id: 'user-1',
    cohortId: 'bio-inspired-intervention-2026',
    courseId: 'bio-inspired',
}

describe('studyCondition', () => {
    beforeEach(() => rpc.mockReset())

    it('claims only a pre-provisioned research arm', async () => {
        rpc.mockResolvedValue({
            data: [{
                experiment_key: 'alget-bio-inspired-agentic-rct-v1',
                assignment_arm: TREATMENT_ARM,
                stratum_key: 'section-a:baseline_mid',
                allocation_block: 'block-1',
                assignment_hash: 'a'.repeat(64),
            }],
            error: null,
        })
        const condition = await loadStudyCondition(learner, 'bio-inspired')
        expect(rpc).toHaveBeenCalledWith('claim_engineering_study_assignment')
        expect(condition).toMatchObject({ status: 'ready', assignmentArm: TREATMENT_ARM })
        expect(canUseAdaptiveSupport(condition)).toBe(true)
    })

    it('fails closed when allocation is missing and disables comparison adaptivity', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: 'P0001' } })
        const blocked = await loadStudyCondition(learner, 'bio-inspired')
        expect(blocked.status).toBe('blocked')
        expect(canUseAdaptiveSupport(blocked)).toBe(false)
        expect(canUseAdaptiveSupport({ status: 'ready', assignmentArm: COMPARISON_ARM })).toBe(false)
    })

    it('leaves non-study learners in the standard product path', async () => {
        const condition = await loadStudyCondition({ id: 'ordinary-user' }, 'statics')
        expect(condition).toEqual({ status: 'ready', mode: 'standard', assignmentArm: null, experimentKey: null })
        expect(rpc).not.toHaveBeenCalled()
        expect(canUseAdaptiveSupport(condition)).toBe(true)
    })
})
