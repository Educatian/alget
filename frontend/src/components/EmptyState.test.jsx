import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import EmptyState from './EmptyState'

describe('EmptyState primitive', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders the title and body', () => {
        render(<EmptyState title="No focus yet" body="Start a section to see your plan." />)

        expect(screen.getByRole('heading', { name: /No focus yet/i })).toBeInTheDocument()
        expect(screen.getByText(/Start a section to see your plan\./i)).toBeInTheDocument()
    })

    it('renders an optional recovery CTA as a button and fires onClick', () => {
        const onClick = vi.fn()
        render(
            <EmptyState
                title="Nothing here"
                action={{ label: 'Begin reading', onClick }}
            />,
        )

        const cta = screen.getByRole('button', { name: /Begin reading/i })
        fireEvent.click(cta)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('renders the CTA as a link when an href is given', () => {
        render(
            <EmptyState
                title="Nothing here"
                action={{ label: 'Open dashboard', href: '/dashboard' }}
            />,
        )

        const link = screen.getByRole('link', { name: /Open dashboard/i })
        expect(link).toHaveAttribute('href', '/dashboard')
    })

    it('omits the CTA when no valid action is provided', () => {
        render(<EmptyState title="Nothing here" body="Empty." />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('marks the decorative icon container as aria-hidden', () => {
        const { container } = render(
            <EmptyState icon={<svg data-testid="icon" />} title="With icon" />,
        )

        const hidden = container.querySelector('[aria-hidden="true"]')
        expect(hidden).toBeTruthy()
        expect(hidden).toContainElement(screen.getByTestId('icon'))
    })
})
