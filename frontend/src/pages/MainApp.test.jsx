import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MainApp from './MainApp'

vi.mock('../components/SettingsModal', () => ({
    default: () => null
}))

vi.mock('../components/CourseIllustrations', () => ({
    StaticsIllustration: () => <div>Statics Illustration</div>,
    BioInspiredIllustration: () => <div>Bio Illustration</div>,
    InstDesignIllustration: () => <div>Inst Illustration</div>
}))

beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true })
    })
})

afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
    vi.restoreAllMocks()
})

describe('MainApp', () => {
    it('renders the access screen without crashing', () => {
        render(
            <MemoryRouter>
                <MainApp user={{ email: 'test@example.com' }} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        expect(screen.getByText(/Open your cohort track/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    })

    it('shows all engineering pathways after engineering access is validated', async () => {
        // Staff reveal the non-study pathways with /learn?pathways=all.
        window.history.replaceState(null, '', '/learn?pathways=all')
        render(
            <MemoryRouter>
                <MainApp user={{ email: 'test@example.com' }} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        fireEvent.change(screen.getByLabelText(/^track$/i), { target: { value: 'engineering' } })
        fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: 'eng123' } })
        fireEvent.click(screen.getByRole('button', { name: /unlock/i }))

        expect(await screen.findByText('Engineering Statics')).toBeInTheDocument()
        expect(screen.getByText('ME 201: Engineering Dynamics')).toBeInTheDocument()
        expect(screen.getByText('Bio-Inspired Design')).toBeInTheDocument()
        expect(screen.getByText('3 available')).toBeInTheDocument()
    })

    it('shows all education pathways after education access is validated', async () => {
        // Staff reveal the non-study pathways with /learn?pathways=all.
        window.history.replaceState(null, '', '/learn?pathways=all')
        render(
            <MemoryRouter>
                <MainApp user={{ email: 'test@example.com' }} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        fireEvent.change(screen.getByLabelText(/^track$/i), { target: { value: 'education' } })
        fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: 'edu123' } })
        fireEvent.click(screen.getByRole('button', { name: /unlock/i }))

        expect(await screen.findByText('Foundation of Instructional Design')).toBeInTheDocument()
        expect(screen.getByText('AI and Ethics')).toBeInTheDocument()
        expect(screen.getByText('AIL 606: Software Technology Supplement')).toBeInTheDocument()
        expect(screen.getByText('CAT 531: Technology and Teaching Supplement')).toBeInTheDocument()
        expect(screen.getByText('CAT 100: Computer Concepts Supplement')).toBeInTheDocument()
        expect(screen.getByText('5 available')).toBeInTheDocument()
    })

    it('shows a new participant only their study steps until the pre-survey is done', () => {
        const participant = { email: 'x@participants.alget.example.com', app_metadata: { study_track: 'bio', study_id: 'BIO-7K3Q-9MZP' }, user_metadata: {} }
        render(
            <MemoryRouter>
                <MainApp user={participant} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        expect(screen.getByText('Your study steps')).toBeInTheDocument()
        const link = screen.getByRole('link', { name: /open pre-survey/i })
        expect(link.getAttribute('href')).toContain('study_id=BIO-7K3Q-9MZP')
        expect(screen.queryByText('Bio-Inspired Design')).not.toBeInTheDocument()
        expect(screen.getByText(/open here after you complete the pre-survey/i)).toBeInTheDocument()
    })

    it('opens the course and labs after the pre-survey', () => {
        const participant = { email: 'x@participants.alget.example.com', app_metadata: { study_track: 'bio', study_id: 'BIO-7K3Q-9MZP' }, user_metadata: { study_steps: { pre: '2026-10-15T10:00:00Z' } } }
        render(
            <MemoryRouter>
                <MainApp user={participant} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        expect(screen.getByText('Bio-Inspired Design')).toBeInTheDocument()
        expect(screen.getByText(/Choose and complete one 3D simulation lab/i)).toBeInTheDocument()
        expect(screen.getByText(/Complete one Simulation Lab first/i)).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /open knowledge check/i })).not.toBeInTheDocument()
        // A participant who was stopped early by mistake can reopen the pre-survey.
        expect(screen.getByRole('link', { name: /open the pre-survey again/i }).getAttribute('href')).toContain('study_id=BIO-7K3Q-9MZP')
    })
})
