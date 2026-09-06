import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import StudentDashboard from './StudentDashboard'
import { writeExitTicket } from '../lib/exitTickets'
import { recordCalibrationSample } from '../lib/calibration'
import { LMS_QUALITATIVE_ARTIFACTS_KEY } from '../lib/lmsQualitativeArtifactStore'

vi.mock('../components/CohortLiveMap', () => ({
    default: () => <div data-testid="cohort-live-map" />
}))

vi.mock('../components/KindredReaders', () => ({
    default: () => <div data-testid="kindred-readers" />
}))

vi.mock('../hooks/useCourseProgress', () => ({
    useCourseProgress: () => ({
        recentSection: null
    })
}))

// Mutable server-side mastery fixture: tests flip this to simulate a synced
// learner model responding vs. no synced evidence (offline/degraded/demo).
const masteryFixture = vi.hoisted(() => ({ rows: [] }))

vi.mock('../lib/supabase', () => ({
    isSupabaseConfigured: false,
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn(async () => ({ data: masteryFixture.rows }))
        }))
    }
}))

afterEach(() => {
    cleanup()
    window.localStorage.clear()
    window.sessionStorage.clear()
    masteryFixture.rows = []
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

const DEMO_USER = { id: '00000000-0000-0000-0000-000000000000' }

function renderDashboard(user = DEMO_USER) {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/dashboard" element={<StudentDashboard user={user} />} />
                <Route path="/book/:course/:chapter/:section" element={<div>Section route opened</div>} />
            </Routes>
        </MemoryRouter>
    )
}

function renderFixtureDashboard(fixture) {
    return render(
        <MemoryRouter initialEntries={[`/dashboard?course=inst-design&section=02/08&fixture=${fixture}`]}>
            <Routes>
                <Route path="/dashboard" element={<StudentDashboard user={{ id: 'e2e-user' }} />} />
                <Route path="/book/:course/:chapter/:section" element={<div>Section route opened</div>} />
                <Route path="/diagnostic/:course" element={<div>Retention route opened</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('StudentDashboard', () => {
    it('surfaces saved exit tickets as a reusable learning trace queue', async () => {
        writeExitTicket('cat100-supplement/01/01', 'The claim is clearer because my annotation evidence shows that the resume bullet needs a concrete tool and audience. Next I will revise the artifact and compare it against the rubric.', {
            course: 'cat100-supplement',
            chapter: '01',
            section: '01',
            title: 'Digital Identity and Professional Presence',
        })
        writeExitTicket('cat531-supplement/02/03', 'Short trace', {
            course: 'cat531-supplement',
            chapter: '02',
            section: '03',
            title: 'Data Story Check',
        })

        render(
            <MemoryRouter initialEntries={['/dashboard']}>
                <Routes>
                    <Route path="/dashboard" element={<StudentDashboard user={{ id: '00000000-0000-0000-0000-000000000000' }} />} />
                    <Route path="/book/:course/:chapter/:section" element={<div>Trace route opened</div>} />
                </Routes>
            </MemoryRouter>
        )

        expect(await screen.findByText('Recent learning traces')).toBeInTheDocument()
        expect(screen.getByText('Digital Identity and Professional Presence')).toBeInTheDocument()
        expect(screen.getAllByText('Data Story Check').length).toBeGreaterThan(0)
        expect(screen.getByText('Reuse insight')).toBeInTheDocument()
        expect(screen.getByText('Strengthen trace')).toBeInTheDocument()

        fireEvent.click(screen.getAllByRole('button', { name: /open trace/i })[0])
        expect(await screen.findByText('Trace route opened')).toBeInTheDocument()
    })

    it('shows the honest no-synced-evidence empty state instead of claiming all concepts are strong', async () => {
        renderDashboard()

        expect(await screen.findByText('Not enough synced evidence yet')).toBeInTheDocument()
        expect(screen.getByText(/keep answering checks/i)).toBeInTheDocument()
        expect(screen.queryByText('No weak concepts')).not.toBeInTheDocument()
        expect(screen.queryByText(/all concepts are at 60% mastery or higher/i)).not.toBeInTheDocument()
    })

    it('keeps the genuine all-strong empty state when the synced model reports only strong concepts', async () => {
        masteryFixture.rows = [
            { concept_id: 'free_body_diagram', p_known: 0.9, mastery_score: 0.9, attempts_count: 6, correct_count: 6 },
        ]
        renderDashboard({ id: 'real-user-1' })

        expect(await screen.findByText('No weak concepts')).toBeInTheDocument()
        expect(screen.queryByText('Not enough synced evidence yet')).not.toBeInTheDocument()
    })

    it('surfaces local trouble spots from this browser\'s calibration records and links to the section', async () => {
        // 12 wrong-at-Certain answers split across 2 sections (audit scenario).
        for (let i = 0; i < 6; i += 1) {
            recordCalibrationSample('inst-design/01/02', 0.95, false, 4)
            recordCalibrationSample('inst-design/02/01', 0.95, false, 4)
        }

        renderDashboard()

        expect(await screen.findByText('Recent trouble spots (this browser)')).toBeInTheDocument()
        expect(screen.getByText(/stored locally on this device/i)).toBeInTheDocument()
        expect(screen.getByText('Inst Design 01.02')).toBeInTheDocument()
        expect(screen.getByText('Inst Design 02.01')).toBeInTheDocument()
        // Honest empty state coexists above the local list.
        expect(screen.getByText('Not enough synced evidence yet')).toBeInTheDocument()

        const reviewButtons = screen.getAllByRole('button', { name: 'Review' })
        fireEvent.click(reviewButtons[0])
        expect(await screen.findByText('Section route opened')).toBeInTheDocument()
    })

    it('does not render a trouble-spots list without local evidence', async () => {
        renderDashboard()
        expect(await screen.findByText('Weakest concepts')).toBeInTheDocument()
        expect(screen.queryByText('Recent trouble spots (this browser)')).not.toBeInTheDocument()
    })

    it('lets a learner ask BigAL to explain the evidence and receive a bounded next move', async () => {
        masteryFixture.rows = [
            { concept_id: 'interaction_design', p_known: 0.35, mastery_score: 0.35, attempts_count: 3, correct_count: 1 },
        ]
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ text: 'Review interaction design, then decide whether the explanation changed your reasoning.' }),
        }))

        renderDashboard({ id: 'real-user-1' })
        fireEvent.click(await screen.findByRole('button', { name: /Explain and suggest one move/i }))

        expect(await screen.findByText(/Review interaction design/i)).toBeInTheDocument()
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/orchestrate'),
            expect.objectContaining({ method: 'POST' }),
        )
    })

    it('runs the synthetic weak learner through response, modify decision, reason metadata, and export join', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ text: 'Review the weakest concept and compare the interaction evidence.' }),
        }))

        renderFixtureDashboard('intro-lms-weak')
        expect(await screen.findByText(/Synthetic learner A/)).toBeInTheDocument()
        expect(screen.getByText(/Participant scope: participant-01/)).toBeInTheDocument()
        expect(screen.getByText(/Synced concept records: 2/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Explain and suggest one move/i }))
        expect(await screen.findByText(/Evidence anchor/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Modify suggestion' }))
        fireEvent.change(screen.getByLabelText('Why this choice?'), { target: { value: 'I will revise the mode after checking the peer evidence.' } })
        fireEvent.change(screen.getByLabelText('Your modified next move'), { target: { value: 'Rebuild the activity with a peer comparison checkpoint.' } })
        fireEvent.change(screen.getByLabelText('Short reflection'), { target: { value: 'The score is an estimate, so I want one more check before deciding.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save decision' }))
        expect(await screen.findByText(/Decision recorded: modify/)).toBeInTheDocument()
        expect(screen.getByText(/Behavior join: analytics_coach_decision.*participant-01.*ltps210-intro-lms-fa26/)).toBeInTheDocument()
        const trace = JSON.parse(window.sessionStorage.getItem('alget:lms-fixture-trace:intro-lms-weak'))
        expect(trace.participant_id).toBe('participant-01')
        expect(trace.events.some((row) => row.event_type === 'analytics_coach_decision')).toBe(true)
        expect(JSON.stringify(trace)).not.toContain('I will revise')
        const qualitative = JSON.parse(window.localStorage.getItem(LMS_QUALITATIVE_ARTIFACTS_KEY))
        expect(qualitative).toHaveLength(1)
        expect(qualitative[0]).toMatchObject({ participant_id: 'participant-01', decision: 'modify', modified_proposal_text: 'Rebuild the activity with a peer comparison checkpoint.' })
        expect(qualitative[0].reflection_text).toContain('score is an estimate')

        fireEvent.click(screen.getByRole('button', { name: 'Review the weakest observed concept' }))
        expect(await screen.findByText(/Follow-up opened: Online & Distance Learning Design/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open follow-up activity' }))
        expect(await screen.findByText('Section route opened')).toBeInTheDocument()
    })

    it('keeps the synthetic ready learner isolated and gives it a distinct agent response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ text: 'Run one retrieval check to confirm transfer.' }),
        }))

        renderFixtureDashboard('intro-lms-ready')
        expect(await screen.findByText(/Synthetic learner B/)).toBeInTheDocument()
        expect(screen.getByText(/Participant scope: participant-02/)).toBeInTheDocument()
        expect(screen.getByText(/Synced concept records: 2/)).toBeInTheDocument()
        expect(screen.getByText('No weak concepts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Explain and suggest one move/i }))
        expect(await screen.findByText(/Evidence anchor/)).toBeInTheDocument()
        expect(screen.getAllByText(/retention check/i).length).toBeGreaterThan(0)
    })
})
