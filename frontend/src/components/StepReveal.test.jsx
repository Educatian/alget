import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import StepReveal from './StepReveal'

const STEPS = JSON.stringify([
    { prompt: 'What is first?', reveal: 'First step body.' },
    {
        prompt: 'Pick one',
        predictType: 'choice',
        choices: ['Wrong', 'Right'],
        answerIndex: 1,
        reveal: 'Second step body.',
    },
    { reveal: 'Third step body.' },
])

afterEach(() => {
    cleanup()
})

describe('StepReveal', () => {
    it('renders the title and progress without revealing any step initially', () => {
        render(<StepReveal steps={STEPS} title="Derivation" />)

        expect(screen.getByText('Derivation')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
        expect(screen.queryByText('First step body.')).not.toBeInTheDocument()
        // The first step's predict prompt is shown.
        expect(screen.getByText('What is first?')).toBeInTheDocument()
    })

    it('reveals the next step on click and announces it via aria-live', () => {
        render(<StepReveal steps={STEPS} />)

        fireEvent.click(screen.getByRole('button', { name: /Reveal step 1/i }))

        expect(screen.getByText('First step body.')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
        expect(screen.getByRole('status')).toHaveTextContent(/Step 1 of 3 revealed/i)
    })

    it('logs a multiple-choice prediction attempt before revealing', () => {
        const onAttempt = vi.fn()
        render(<StepReveal steps={STEPS} onAttempt={onAttempt} />)

        // Reveal step 1 to advance to the choice step.
        fireEvent.click(screen.getByRole('button', { name: /Reveal step 1/i }))
        // Choose the correct option then reveal step 2.
        fireEvent.click(screen.getByRole('radio', { name: 'Right' }))
        fireEvent.click(screen.getByRole('button', { name: /Reveal step 2/i }))

        expect(onAttempt).toHaveBeenCalledWith(
            expect.objectContaining({ stepIndex: 1, type: 'choice', choiceIndex: 1, isCorrect: true }),
        )
        expect(screen.getByText('Second step body.')).toBeInTheDocument()
    })

    it('shows a start over control once all steps are revealed', () => {
        render(<StepReveal steps={STEPS} />)

        fireEvent.click(screen.getByRole('button', { name: /Reveal step 1/i }))
        fireEvent.click(screen.getByRole('button', { name: /Reveal step 2/i }))
        fireEvent.click(screen.getByRole('button', { name: /Reveal step 3/i }))

        expect(screen.getByText('All steps revealed.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Start over/i }))
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    })

    it('renders nothing with no usable steps', () => {
        const { container } = render(<StepReveal steps="not json" />)
        expect(container).toBeEmptyDOMElement()
    })
})
