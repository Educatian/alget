import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FacultyPartnershipWorkspace from './FacultyPartnershipWorkspace'
import { importGoogleDocCourseDraft, loadAssignedIngestionSources, loadFacultyWorkspace, publishFacultyPilot, saveShadowPilot } from '../lib/facultyPartnershipService'

vi.mock('../lib/facultyPartnershipService', async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        loadFacultyWorkspace: vi.fn(),
        loadAssignedIngestionSources: vi.fn(),
        importGoogleDocCourseDraft: vi.fn(),
        saveShadowPilot: vi.fn(),
        saveEvidenceBrief: vi.fn(async (brief) => ({ id: 'brief-1', summary: brief })),
        saveImpactReport: vi.fn(async (report) => ({ id: 'report-1', report })),
        publishFacultyPilot: vi.fn(),
        setPilotStatus: vi.fn(),
    }
})

describe('FacultyPartnershipWorkspace', () => {
    beforeEach(() => {
        loadFacultyWorkspace.mockResolvedValue({ pilots: [], briefs: [], reports: [], published: [], persistence: 'local' })
        loadAssignedIngestionSources.mockResolvedValue([])
        saveShadowPilot.mockResolvedValue({ id: 'pilot-1', module_name: 'AI evidence', status: 'shadow' })
        importGoogleDocCourseDraft.mockResolvedValue({
            source: { title: 'AI Literacy Module', sha256: 'abc123' },
            learning_objectives: ['Evaluate AI-supported claims'],
            sections: [{ section_id: 'draft-01', title: 'Evidence evaluation', reading: { estimated_minutes: 8 }, activity: { type: 'claim-evidence-revision' }, simulation: { status: 'proposed' } }],
        })
    })

    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('turns cohort signals into a compact weekly instructor brief', async () => {
        render(<FacultyPartnershipWorkspace
            courseId="ail-606"
            hotSpots={[{ concept_id: 'source_evaluation', average: 0.42, learnerCount: 7 }]}
            strugglers={[{ user_id: 'learner-1', displayName: 'Student A', average: 0.38, conceptCount: 4 }]}
            rct={{ interventionOutcomes: [], evaluationGains: [] }}
        />)

        expect(screen.getByRole('heading', { name: 'See the course before changing it' })).toBeInTheDocument()
        expect(screen.getByText('Source Evaluation')).toBeInTheDocument()
        expect(screen.getByText(/Signals are correlational/i)).toBeInTheDocument()
        await waitFor(() => expect(loadFacultyWorkspace).toHaveBeenCalledWith('ail-606'))
    })

    it('creates a student-invisible one-module shadow pilot', async () => {
        render(<FacultyPartnershipWorkspace courseId="ail-606" rct={{}} />)

        fireEvent.click(screen.getByRole('button', { name: 'Shadow pilot' }))
        fireEvent.change(screen.getByLabelText('Module to inspect'), { target: { value: 'AI evidence' } })
        fireEvent.change(screen.getByLabelText('Learning objectives, one per line'), { target: { value: 'Evaluate claims\nRevise with evidence' } })
        fireEvent.click(screen.getByRole('button', { name: 'Start shadow mode' }))

        await waitFor(() => expect(saveShadowPilot).toHaveBeenCalledWith(expect.objectContaining({
            courseId: 'ail-606',
            moduleName: 'AI evidence',
            learningObjectives: ['Evaluate claims', 'Revise with evidence'],
        }), 'local'))
        expect(await screen.findByText(/Nothing is visible to students/i)).toBeInTheDocument()
    })

    it('connects a Google Doc and previews generated learning experiences', async () => {
        render(<FacultyPartnershipWorkspace courseId="ail-606" rct={{}} />)

        fireEvent.click(screen.getByRole('button', { name: 'Shadow pilot' }))
        fireEvent.change(screen.getByLabelText('Google Docs course source'), { target: { value: 'https://docs.google.com/document/d/12345678901234567890/edit' } })
        fireEvent.click(screen.getByRole('button', { name: 'Connect & draft' }))

        await waitFor(() => expect(importGoogleDocCourseDraft).toHaveBeenCalledWith({
            courseId: 'ail-606',
            documentUrl: 'https://docs.google.com/document/d/12345678901234567890/edit',
        }))
        expect(await screen.findByText('Evidence evaluation')).toBeInTheDocument()
        expect(screen.getByText(/Reading · 8 min/i)).toBeInTheDocument()
    })

    it('shows the instructor when a draft fell back instead of being generated', async () => {
        importGoogleDocCourseDraft.mockResolvedValue({
            source: { title: 'AI Literacy Module' },
            learning_objectives: [],
            quality: { warnings: ['AI enrichment returned no usable sections; the deterministic source-grounded draft was kept.'] },
            sections: [{ section_id: 'draft-01', title: 'Evidence evaluation', reading: { estimated_minutes: 8 }, activity: { type: 'claim-evidence-revision' } }],
        })

        render(<FacultyPartnershipWorkspace courseId="ail-606" rct={{}} />)
        fireEvent.click(screen.getByRole('button', { name: 'Shadow pilot' }))
        fireEvent.change(screen.getByLabelText('Google Docs course source'), { target: { value: 'https://docs.google.com/document/d/12345678901234567890/edit' } })
        fireEvent.click(screen.getByRole('button', { name: 'Connect & draft' }))

        const notices = await screen.findByRole('list', { name: 'Draft generation notices' })
        expect(notices).toHaveTextContent(/deterministic source-grounded draft was kept/i)
    })

    it('restores a saved generated draft after reload and publishes only after approval', async () => {
        const pilot = {
            id: 'pilot-1', course_id: 'ail-606', title: 'AI evidence', module_name: 'Evidence evaluation',
            status: 'ready', learning_objectives: ['Evaluate claims'],
            generation_draft: { sections: [{ section_id: 'draft-01', title: 'Restored reading', reading: { estimated_minutes: 5 } }] },
        }
        loadFacultyWorkspace.mockResolvedValue({ pilots: [pilot], briefs: [], reports: [], published: [], persistence: 'local' })
        publishFacultyPilot.mockResolvedValue({ pilot: { ...pilot, status: 'active' }, published: { id: 'published-1', generation_draft: pilot.generation_draft } })
        render(<FacultyPartnershipWorkspace courseId="ail-606" rct={{}} />)

        fireEvent.click(screen.getByRole('button', { name: 'Shadow pilot' }))
        expect(await screen.findByText('Restored reading')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Approve & publish' }))
        await waitFor(() => expect(publishFacultyPilot).toHaveBeenCalledWith(pilot, 'local'))
        expect(await screen.findByText(/Published to the learner reader/i)).toBeInTheDocument()
    })
})
