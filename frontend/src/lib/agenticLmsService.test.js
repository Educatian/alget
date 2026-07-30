import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    draftIntervention,
    draftLearnerPlan,
    loadInterventions,
    loadLearnerPlans,
    reviewIntervention,
    reviewLearnerPlan,
} from './agenticLmsService'

vi.mock('./supabase', () => ({
    isSupabaseConfigured: false,
    supabase: {},
}))

describe('agenticLmsService offline workflow parity', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        window.localStorage.clear()
    })

    it('persists a learner draft and activates it only after learner approval', async () => {
        const plan = await draftLearnerPlan({
            userId: 'learner-1',
            courseId: 'cat100-supplement',
            title: 'Master force vectors',
            targetDate: '2026-08-08',
            targetMastery: 0.8,
            weeklyMinutes: 180,
            mastery: [{ concept_id: 'force_vectors', mastery_score: 0.32, attempts_count: 3 }],
        })

        expect(plan.status).toBe('awaiting_approval')
        expect(plan.plan.learner_control.requires_approval).toBe(true)
        expect(await loadLearnerPlans('learner-1')).toHaveLength(1)

        const active = await reviewLearnerPlan(plan.id, 'approve', 'learner-1')
        expect(active.status).toBe('active')
        expect(active.agent_workflows.status).toBe('active')
    })

    it('records instructor approval without executing delivery', async () => {
        const draft = await draftIntervention({
            userId: 'instructor-1',
            courseId: 'cat100-supplement',
            conceptId: 'force_vectors',
            learnerCount: 8,
            averageMastery: 0.38,
            targetUserIds: [],
        })

        expect(draft.status).toBe('awaiting_approval')
        expect(draft.proposal.delivery.executed).toBe(false)
        expect(await loadInterventions()).toHaveLength(1)

        const approved = await reviewIntervention(draft.id, 'approve', 'Reviewed evidence', 'instructor-1')
        expect(approved.status).toBe('approved')
        expect(approved.proposal.delivery.executed).toBe(false)
        expect(approved.agent_workflows.status).toBe('active')
    })
})
