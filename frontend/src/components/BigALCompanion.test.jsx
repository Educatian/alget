import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BigALCompanion from './BigALCompanion'

describe('BigALCompanion', () => {
    it('exposes the learning state without treating the glyph as decorative content', () => {
        render(<BigALCompanion state="teach" />)

        expect(screen.getByRole('img', { name: /ready to learn from your explanation/i })).toHaveAttribute('data-state', 'teach')
    })

    it.each(['rest', 'notice', 'nudge', 'mirror', 'teach'])('renders the %s state', (state) => {
        const { container } = render(<BigALCompanion state={state} />)

        expect(container.querySelector(`[data-state="${state}"]`)).toBeInTheDocument()
    })

    it('falls back to the quiet rest state for an unknown value', () => {
        const { container } = render(<BigALCompanion state="unknown" />)

        expect(container.querySelector('[data-state="rest"]')).toBeInTheDocument()
    })
})
