import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminControlPlane from './AdminControlPlane'

vi.mock('../lib/adminControlService', () => ({
    AGENT_MANIFEST: [
        { id: 'extraction', name: 'Document Extraction', stage: 'Ingestion', approval: 'automatic' },
        { id: 'release', name: 'Release', stage: 'Release', approval: 'required', canPublish: true },
    ],
    loadAdminState: vi.fn(async () => ({
        persistence: 'local',
        state: { instructors: [], courses: [], ingestionJobs: [], agentRuns: [], auditEvents: [] },
    })),
    registerInstructor: vi.fn(async () => ({})),
    createManagedCourse: vi.fn(async () => ({})),
    convertCoursePdf: vi.fn(async () => ({})),
    createGovernedAgentRun: vi.fn(async () => ({})),
    approveAgentRun: vi.fn(async () => ({})),
}))

describe('AdminControlPlane', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => cleanup())

    it('presents the accountable course pipeline and release policy', async () => {
        render(<AdminControlPlane cohortContent={<p>Cohort view</p>} />)

        expect(await screen.findByText('One accountable course pipeline')).toBeInTheDocument()
        expect(screen.getByText(/No content reaches Published/i)).toBeInTheDocument()
        expect(screen.getByText('Register instructor')).toBeInTheDocument()
    })

    it('moves from overview to instructor registration', async () => {
        render(<AdminControlPlane cohortContent={<p>Cohort view</p>} />)
        await screen.findByText('One accountable course pipeline')

        fireEvent.click(screen.getByRole('button', { name: 'Instructors' }))

        expect(screen.getByRole('heading', { name: 'Instructor registry' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Invite instructor' })).toBeInTheDocument()
    })

    it('keeps the agent release step explicitly human-gated', async () => {
        render(<AdminControlPlane cohortContent={<p>Cohort view</p>} />)
        await screen.findByText('One accountable course pipeline')

        fireEvent.click(screen.getByRole('button', { name: 'Agent control' }))

        await waitFor(() => expect(screen.getByText('Release')).toBeInTheDocument())
        expect(screen.getByText(/Release · required approval/i)).toBeInTheDocument()
    })
})
