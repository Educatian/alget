import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StudentDashboard from './StudentDashboard'
import { writeExitTicket } from '../lib/exitTickets'

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

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [] })
        }))
    }
}))

afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.clearAllMocks()
})

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
})
