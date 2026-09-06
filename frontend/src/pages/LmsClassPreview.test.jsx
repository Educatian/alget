import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import LmsClassPreview from './LmsClassPreview'

afterEach(() => cleanup())

function renderPreview(user = null) {
    return render(
        <MemoryRouter initialEntries={['/class/lms-exemplar']}>
            <Routes>
                <Route path="/class/lms-exemplar" element={<LmsClassPreview user={user} />} />
                <Route path="/book/:course/:chapter/:section" element={<div>Reading module opened</div>} />
                <Route path="/dashboard" element={<div>Dashboard opened</div>} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('LmsClassPreview', () => {
    it('surfaces the class contract and links to the familiar reading module', () => {
        renderPreview()
        expect(screen.getByText('Introduction to LMS · Agentic reading lab')).toBeInTheDocument()
        expect(screen.getByText('Design one week of an LMS activity')).toBeInTheDocument()
        expect(screen.getByText('120-minute path')).toBeInTheDocument()
        expect(screen.getByText('Artifact rubric')).toBeInTheDocument()
        expect(screen.getByText(/Clicks, presence, and support requests are process proxies/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Open reading module/i }))
        expect(screen.getByText('Reading module opened')).toBeInTheDocument()
    })

    it('offers the learner analytics route only when a learner is present', () => {
        const { rerender } = renderPreview()
        expect(screen.queryByRole('button', { name: /Open learner analytics/i })).not.toBeInTheDocument()

        rerender(
            <MemoryRouter initialEntries={['/class/lms-exemplar']}>
                <Routes>
                    <Route path="/class/lms-exemplar" element={<LmsClassPreview user={{ id: 'learner-1' }} />} />
                    <Route path="/dashboard" element={<div>Dashboard opened</div>} />
                </Routes>
            </MemoryRouter>,
        )
        fireEvent.click(screen.getByRole('button', { name: /Open learner analytics/i }))
        expect(screen.getByText('Dashboard opened')).toBeInTheDocument()
    })
})
