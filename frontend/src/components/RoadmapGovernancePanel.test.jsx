import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/roadmapRuntimeService', () => ({
    loadRoadmapManifest: vi.fn().mockResolvedValue({
        roadmap_contract: 'roadmap-runtime-v1',
        horizons: { '0-12_months': ['governed_runtime_package'], '12-24_months': ['decision_ledger'], '24-36_months': ['caliper'] },
        high_risk_actions: { publish: 'human_approval' },
    }),
    registerModel: vi.fn().mockResolvedValue({ status: 'draft' }),
    createIncident: vi.fn().mockResolvedValue({ status: 'open' }),
    createEvaluationManifest: vi.fn().mockResolvedValue({ preregistered: false }),
}))

import RoadmapGovernancePanel from './RoadmapGovernancePanel'
import { createEvaluationManifest } from '../lib/roadmapRuntimeService'

describe('RoadmapGovernancePanel', () => {
    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('renders all three roadmap horizons and the human gate', async () => {
        render(<RoadmapGovernancePanel />)
        expect(await screen.findByText('governed runtime package')).toBeInTheDocument()
        expect(screen.getByText('decision ledger')).toBeInTheDocument()
        expect(screen.getByText('caliper')).toBeInTheDocument()
        expect(screen.getByText('publish · human approval')).toBeInTheDocument()
        expect(screen.getByText('LTI 1.3')).toBeInTheDocument()
    })

    it('creates an evaluation manifest from the visible form', async () => {
        render(<RoadmapGovernancePanel />)
        fireEvent.change(screen.getAllByPlaceholderText('course-id')[1], { target: { value: 'ail-606' } })
        fireEvent.change(screen.getByPlaceholderText('Evidence Trail + tutor'), { target: { value: 'Evidence Trail' } })
        fireEvent.change(screen.getByDisplayValue('reader only'), { target: { value: 'Reader only' } })
        fireEvent.change(screen.getByDisplayValue('transfer'), { target: { value: 'Transfer' } })
        fireEvent.click(screen.getByRole('button', { name: 'Create manifest' }))
        await waitFor(() => expect(createEvaluationManifest).toHaveBeenCalled())
    })
})
