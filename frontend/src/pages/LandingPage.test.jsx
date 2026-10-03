import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import LandingPage from './LandingPage'

vi.mock('../components/AuthModal', () => ({
    default: () => null
}))

vi.mock('../components/GenerativeIllustration', () => ({
    default: () => <div>Illustration</div>
}))

describe('LandingPage', () => {
    it('renders the primary product positioning without crashing', () => {
        render(
            <MemoryRouter>
                <LandingPage onLogin={vi.fn()} user={null} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Generative Intelligent Textbook/i).length).toBeGreaterThan(0)
        // Participants enter with a Study ID; there is no public sign-up or researcher shortcut.
        expect(screen.getByLabelText(/research study participants/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /research team sign-in/i })).toBeInTheDocument()
        expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /researcher view|research console/i })).not.toBeInTheDocument()
    })
})
