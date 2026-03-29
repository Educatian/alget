import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import MainApp from './MainApp'

vi.mock('../components/SettingsModal', () => ({
    default: () => null
}))

vi.mock('../components/CourseIllustrations', () => ({
    StaticsIllustration: () => <div>Statics Illustration</div>,
    BioInspiredIllustration: () => <div>Bio Illustration</div>,
    InstDesignIllustration: () => <div>Inst Illustration</div>
}))

describe('MainApp', () => {
    it('renders the access screen without crashing', () => {
        render(
            <MemoryRouter>
                <MainApp user={{ email: 'test@example.com' }} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        expect(screen.getByText(/Module Access/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /unlock pathway/i })).toBeInTheDocument()
    })
})
