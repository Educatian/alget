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
        expect(screen.getByRole('button', { name: /start as a learner/i })).toBeInTheDocument()
    })
})
