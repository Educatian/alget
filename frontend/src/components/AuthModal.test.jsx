import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AuthModal from './AuthModal'

vi.mock('../hooks/useFocusTrap', () => ({
    useFocusTrap: () => ({ current: null }),
}))

describe('AuthModal entry paths', () => {
    afterEach(() => cleanup())

    it('separates course entry, account sign-in, and preview mode', () => {
        render(<AuthModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />)

        expect(screen.getByRole('button', { name: /^Course learner/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByLabelText('Name')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'CAT 531' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Bio-Inspired Design Study' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /^ALGET account/ }))
        expect(screen.getByLabelText('Email')).toBeInTheDocument()
        expect(screen.getByText(/invitation-bound account/i)).toBeInTheDocument()
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /^Preview demo/ }))
        expect(screen.getByText(/Demo progress is local to this browser/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continue in Demo Mode' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    })
})
