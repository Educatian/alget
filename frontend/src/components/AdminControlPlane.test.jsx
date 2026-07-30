import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminControlPlane from './AdminControlPlane'
import { loadAdminState } from '../lib/adminControlService'

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
    DEFAULT_ADAPTATION_POLICY: {
        mastery_support_threshold: 0.58, friction_support_threshold: 0.35,
        calibration_support_threshold: 0.25, forgetting_risk_threshold: 0.55,
        cooldown_minutes: 8, max_interventions_per_session: 4,
        fade_mastery_threshold: 0.8, fade_stability_threshold: 0.7,
        show_why_now: true, require_human_approval: true,
    },
    saveAdaptationPolicy: vi.fn(async () => ({})),
    activateAdaptationPolicy: vi.fn(async () => ({})),
    rollbackAdaptationPolicy: vi.fn(async () => ({})),
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

    it('opens the adaptation policy studio with restraint controls', async () => {
        render(<AdminControlPlane cohortContent={<p>Cohort view</p>} />)
        await screen.findByText('One accountable course pipeline')

        fireEvent.click(screen.getByRole('button', { name: 'Adaptation' }))

        expect(screen.getByRole('heading', { name: 'Policy Studio' })).toBeInTheDocument()
        expect(screen.getByText(/Create a managed course/i)).toBeInTheDocument()
    })

    it('previews and bounds a course adaptation policy before activation', async () => {
        loadAdminState.mockResolvedValueOnce({
            persistence: 'local',
            state: {
                instructors: [], ingestionJobs: [], agentRuns: [], auditEvents: [], adaptationPolicies: [],
                courses: [{ id: 'course-1', course_key: 'ail606-supplement', title: 'AIL 606' }],
            },
        })
        render(<AdminControlPlane cohortContent={<p>Cohort view</p>} />)
        await screen.findByText('One accountable course pipeline')

        fireEvent.click(screen.getByRole('button', { name: 'Adaptation' }))

        expect(screen.getByLabelText('Mastery floor')).toHaveValue('0.58')
        expect(screen.getByLabelText('Cooldown (min)')).toHaveValue(8)
        expect(screen.getByText('Struggling, engaged')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save policy draft' })).toBeInTheDocument()
    })
})
