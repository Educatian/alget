import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MainApp from './MainApp'
import { buildCohortLearnerProfile, persistCohortLearner } from '../lib/cohortLearner'

vi.mock('../components/SettingsModal', () => ({
    default: () => null
}))

vi.mock('../components/CourseIllustrations', () => ({
    StaticsIllustration: () => <div>Statics Illustration</div>,
    BioInspiredIllustration: () => <div>Bio Illustration</div>,
    InstDesignIllustration: () => <div>Inst Illustration</div>
}))

beforeEach(() => {
    window.localStorage.clear()
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true })
    })
})

afterEach(() => {
    cleanup()
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

    it('opens the named CAT 100 cohort directly to its course only', () => {
        const profile = buildCohortLearnerProfile({
            cohortId: 'cat100-summer1-2026',
            fullName: 'Jamie Smith',
        })
        persistCohortLearner(profile)

        render(
            <MemoryRouter>
                <MainApp
                    user={{
                        id: 'student-1',
                        email: 'student@alget.test',
                        displayName: 'Jamie Smith',
                        cohortLabel: 'CAT 100 Summer I',
                        isCohortLearner: true,
                    }}
                    onLogout={vi.fn()}
                />
            </MemoryRouter>
        )

        expect(screen.getByText('CAT 100: Computer Concepts Supplement')).toBeInTheDocument()
        expect(screen.queryByText('CAT 531: Technology and Teaching Supplement')).not.toBeInTheDocument()
        expect(screen.getByText('1 available')).toBeInTheDocument()
        expect(screen.getByText('Jamie Smith')).toBeInTheDocument()
    })
})
