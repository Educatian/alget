import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LearnerStudyPlanner from './LearnerStudyPlanner'
import { draftLearnerPlan, loadLearnerPlans, reviewLearnerPlan } from '../lib/agenticLmsService'

vi.mock('../lib/agenticLmsService', () => ({
    loadLearnerPlans: vi.fn(),
    draftLearnerPlan: vi.fn(),
    reviewLearnerPlan: vi.fn(),
}))

const draftedPlan = {
    id: 'plan-1',
    status: 'awaiting_approval',
    plan: {
        sessions: [{ id: 'session-1', concept_id: 'force_vectors', mode: 'worked-example', scheduled_for: '2026-08-01', minutes: 30, why_now: 'Mastery is below the learner goal.' }],
    },
}

describe('LearnerStudyPlanner', () => {
    beforeEach(() => {
        loadLearnerPlans.mockResolvedValue([])
        draftLearnerPlan.mockResolvedValue(draftedPlan)
        reviewLearnerPlan.mockResolvedValue({ ...draftedPlan, status: 'active' })
    })
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('keeps a generated study plan behind explicit learner approval', async () => {
        render(<LearnerStudyPlanner user={{ id: 'learner-1' }} mastery={[]} courseId="cat100-supplement" />)
        await screen.findByText(/create your first approval-gated plan/i)

        fireEvent.change(screen.getByLabelText('Learning goal'), { target: { value: 'Understand force vectors' } })
        fireEvent.click(screen.getByRole('button', { name: 'Draft plan' }))

        expect(await screen.findByRole('button', { name: 'Approve plan' })).toBeInTheDocument()
        expect(screen.getByText(/Mastery is below the learner goal/i)).toBeInTheDocument()
        expect(screen.getByText(/no silent automation/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }))
        await waitFor(() => expect(reviewLearnerPlan).toHaveBeenCalledWith('plan-1', 'approve', 'learner-1'))
        expect(await screen.findByText('Plan active')).toBeInTheDocument()
    })
})
