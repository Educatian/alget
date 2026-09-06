import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logEvent } from '../lib/loggingService'
import SequenceBuilder from './SequenceBuilder'

vi.mock('../lib/loggingService', () => ({ logEvent: vi.fn() }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

const ADDIE = '["Analysis","Design","Development","Implementation","Evaluation"]'

describe('SequenceBuilder - order mode', () => {
    it('renders each item with up/down move controls and a Check button', () => {
        render(<SequenceBuilder items={ADDIE} mode="order" />)
        expect(screen.getByText('Analysis')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Move Analysis up/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Move Analysis down/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument()
    })

    it('reports incorrect via aria-live status when the order is wrong', () => {
        render(<SequenceBuilder items={ADDIE} mode="order" />)
        // Initial arrangement is intentionally shuffled, so a fresh Check is wrong.
        fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        const status = screen.getByRole('status')
        expect(status).toHaveTextContent(/out of place/i)
    })

    it('logs a privacy-safe check summary with section context', () => {
        render(<SequenceBuilder items={ADDIE} mode="order" sectionId="inst-design/02/08" course="inst-design" />)
        fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        expect(logEvent).toHaveBeenCalledWith(
            'sequence_check',
            'sequence-builder',
            expect.objectContaining({ mode: 'order', item_count: 5, complete: false, attempt_number: 1 }),
            'inst-design/02/08',
        )
    })

    it('marks all positions correct (not color-only) once the learner sorts it', () => {
        render(<SequenceBuilder items={ADDIE} mode="order" />)

        // Repeatedly move the top item into place using the keyboard move buttons
        // until the list matches the correct ADDIE order.
        const target = ['Analysis', 'Design', 'Development', 'Implementation', 'Evaluation']
        const currentOrder = () =>
            screen
                .getAllByRole('button', { name: /^Step \d+ of/i })
                .map((el) => el.getAttribute('aria-label').replace(/^Step \d+ of \d+: /, ''))

        // Selection-sort via the visible "Move ... up" buttons.
        for (let pos = 0; pos < target.length; pos += 1) {
            for (let safety = 0; safety < 10; safety += 1) {
                const order = currentOrder()
                const idx = order.indexOf(target[pos])
                if (idx <= pos) break
                fireEvent.click(screen.getByRole('button', { name: `Move ${target[pos]} up` }))
            }
        }

        expect(currentOrder()).toEqual(target)

        fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        expect(screen.getByRole('status')).toHaveTextContent(/Correct/i)
        // Text feedback per item, not color alone.
        expect(screen.getAllByText('Correct position').length).toBe(target.length)
    })

    it('renders nothing without usable items', () => {
        const { container } = render(<SequenceBuilder items="not json" mode="order" />)
        expect(container).toBeEmptyDOMElement()
    })
})

describe('SequenceBuilder - match mode', () => {
    const TERMS = JSON.stringify([
        { term: 'Validity', definition: 'It measures what it claims to measure' },
        { term: 'Reliability', definition: 'It yields consistent results across attempts' },
    ])

    it('renders a labeled select for each term', () => {
        render(<SequenceBuilder items={TERMS} mode="match" />)
        expect(screen.getByLabelText('Validity')).toBeInTheDocument()
        expect(screen.getByLabelText('Reliability')).toBeInTheDocument()
    })

    it('reports correct via aria-live once each term has the right definition', () => {
        render(<SequenceBuilder items={TERMS} mode="match" />)

        const validity = screen.getByLabelText('Validity')
        const reliability = screen.getByLabelText('Reliability')

        // Option values are the canonical ids seq-0 / seq-1.
        fireEvent.change(validity, { target: { value: 'seq-0' } })
        fireEvent.change(reliability, { target: { value: 'seq-1' } })

        fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        expect(screen.getByRole('status')).toHaveTextContent(/Correct/i)
        expect(screen.getAllByText('Correct match').length).toBe(2)
    })

    it('marks a wrong match with text feedback', () => {
        render(<SequenceBuilder items={TERMS} mode="match" />)
        const validityRow = screen.getByLabelText('Validity').closest('li')
        fireEvent.change(screen.getByLabelText('Validity'), { target: { value: 'seq-1' } })
        fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        expect(within(validityRow).getByText(/Not the right definition/i)).toBeInTheDocument()
    })
})
