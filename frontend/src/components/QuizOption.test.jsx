import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import QuizOption from './QuizOption'

describe('QuizOption primitive', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders as an accessible radio with aria-checked reflecting `checked`', () => {
        const { rerender } = render(
            <QuizOption label="Choice A" name="q1" checked={false} onSelect={() => {}} />,
        )
        const radio = screen.getByRole('radio', { name: 'Choice A' })
        expect(radio).toHaveAttribute('aria-checked', 'false')

        rerender(<QuizOption label="Choice A" name="q1" checked onSelect={() => {}} />)
        expect(screen.getByRole('radio', { name: 'Choice A' })).toHaveAttribute('aria-checked', 'true')
    })

    it('calls onSelect on click', () => {
        const onSelect = vi.fn()
        render(<QuizOption label="Choice A" name="q1" onSelect={onSelect} />)

        fireEvent.click(screen.getByRole('radio', { name: 'Choice A' }))
        expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('is keyboard operable via Space and Enter', () => {
        const onSelect = vi.fn()
        render(<QuizOption label="Choice A" name="q1" onSelect={onSelect} />)
        const radio = screen.getByRole('radio', { name: 'Choice A' })

        fireEvent.keyDown(radio, { key: ' ' })
        fireEvent.keyDown(radio, { key: 'Enter' })
        expect(onSelect).toHaveBeenCalledTimes(2)
    })

    it('uses a roving tabIndex: checked is the tab stop, unchecked is removed', () => {
        const { rerender } = render(
            <QuizOption label="Choice A" name="q1" checked onSelect={() => {}} />,
        )
        expect(screen.getByRole('radio', { name: 'Choice A' })).toHaveAttribute('tabindex', '0')

        rerender(<QuizOption label="Choice A" name="q1" checked={false} onSelect={() => {}} />)
        expect(screen.getByRole('radio', { name: 'Choice A' })).toHaveAttribute('tabindex', '-1')
    })

    it('conveys correctness non-color: appends label text and shows a verdict word', () => {
        render(<QuizOption label="Choice A" name="q1" state="correct" onSelect={() => {}} />)

        // Accessible name carries the verdict, not just a tint.
        expect(screen.getByRole('radio', { name: /Choice A \(correct answer\)/i })).toBeInTheDocument()
        expect(screen.getByText('Correct')).toBeInTheDocument()
    })

    it('marks the incorrect graded state in the accessible name and verdict word', () => {
        render(<QuizOption label="Choice B" name="q1" state="incorrect" onSelect={() => {}} />)

        expect(
            screen.getByRole('radio', { name: /Choice B \(your answer, incorrect\)/i }),
        ).toBeInTheDocument()
        expect(screen.getByText('Incorrect')).toBeInTheDocument()
    })

    it('does not fire onSelect when graded or disabled', () => {
        const onSelect = vi.fn()
        const { rerender } = render(
            <QuizOption label="Choice A" name="q1" state="correct" onSelect={onSelect} />,
        )
        fireEvent.click(screen.getByRole('radio', { name: /Choice A/i }))

        rerender(<QuizOption label="Choice A" name="q1" state="disabled" onSelect={onSelect} />)
        fireEvent.click(screen.getByRole('radio', { name: /Choice A/i }))
        fireEvent.keyDown(screen.getByRole('radio', { name: /Choice A/i }), { key: 'Enter' })

        expect(onSelect).not.toHaveBeenCalled()
    })

    it('reflects the disabled state on the element', () => {
        render(<QuizOption label="Choice A" name="q1" state="disabled" onSelect={() => {}} />)
        const radio = screen.getByRole('radio', { name: 'Choice A' })
        expect(radio).toBeDisabled()
        expect(radio).toHaveAttribute('aria-disabled', 'true')
    })

    it('exposes the current state via data-state for parent styling hooks', () => {
        render(<QuizOption label="Choice A" name="q1" state="selected" onSelect={() => {}} />)
        expect(screen.getByRole('radio', { name: 'Choice A' })).toHaveAttribute('data-state', 'selected')
    })
})
