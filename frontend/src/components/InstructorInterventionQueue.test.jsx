import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InstructorInterventionQueue from './InstructorInterventionQueue'
import { loadInterventions, reviewIntervention } from '../lib/agenticLmsService'

vi.mock('../lib/agenticLmsService', () => ({
    loadInterventions: vi.fn(),
    draftIntervention: vi.fn(),
    reviewIntervention: vi.fn(),
}))

const pending = {
    id: 'intervention-1',
    title: 'Re-teach force vectors',
    status: 'awaiting_approval',
    proposal: {
        summary: 'Prepare a short compare-and-correct activity.',
        evidence: { learner_count: 8, average_mastery: 0.38, urgency: 'urgent' },
    },
}

describe('InstructorInterventionQueue', () => {
    beforeEach(() => {
        loadInterventions.mockResolvedValue([pending])
        reviewIntervention.mockResolvedValue({ ...pending, status: 'approved' })
    })
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('shows evidence and requires a human decision without executing delivery', async () => {
        render(<InstructorInterventionQueue user={{ id: 'instructor-1' }} />)

        expect(await screen.findByText('Re-teach force vectors')).toBeInTheDocument()
        expect(screen.getByText(/cannot message learners, publish content, or finalize grades/i)).toBeInTheDocument()
        expect(screen.getByText(/Approval does not send or grade/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Approve draft' }))
        await waitFor(() => expect(reviewIntervention).toHaveBeenCalledWith('intervention-1', 'approve', '', 'instructor-1'))
        expect(screen.queryByText('Re-teach force vectors')).not.toBeInTheDocument()
    })
})
