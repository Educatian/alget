import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the side-effecting services so the test is import-light (no network /
// no Supabase). We assert the component logs a clear, stable label.
const { logInteraction, recordAdaptiveSignal, fuseTelemetry } = vi.hoisted(() => ({
    logInteraction: vi.fn(),
    recordAdaptiveSignal: vi.fn(),
    fuseTelemetry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../lib/loggingService', () => ({
    logInteraction,
}))

vi.mock('../lib/knowledgeService', () => ({
    recordAdaptiveSignal,
    fuseTelemetry,
}))

import AffectiveReaction from './AffectiveReaction'

describe('AffectiveReaction self-report logging', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it('exposes each reaction as an accessibly-labelled button (text label, not color alone)', () => {
        render(<AffectiveReaction sectionId="ail606-supplement/01/01" conceptIds={['cognitive_load']} />)

        expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Interesting' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Confusing' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Boring' })).toBeInTheDocument()
    })

    it('logs the affective_reaction with its clear reaction id and section on selection', () => {
        render(<AffectiveReaction sectionId="ail606-supplement/01/01" conceptIds={['cognitive_load']} />)

        fireEvent.click(screen.getByRole('button', { name: 'Confusing' }))

        // The interaction log carries the clear, stable label: type, the
        // affect_* reaction id, and the section it was reported against.
        expect(logInteraction).toHaveBeenCalledWith(
            'affective_reaction',
            'affect_confused',
            'ail606-supplement/01/01',
        )
        // The adaptive signal is recorded with the concept context.
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/01/01',
            'affect_confused',
            { conceptId: 'cognitive_load' },
        )
        // Concept present -> telemetry fusion dispatched for that concept.
        expect(fuseTelemetry).toHaveBeenCalledWith('cognitive_load', 'affect_confused', 1.0)
    })

    it('shows the saved-feedback confirmation after a reaction is chosen', () => {
        render(<AffectiveReaction sectionId="s1" />)

        expect(screen.queryByText(/Feedback saved/i)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
        expect(screen.getByText(/Feedback saved/i)).toBeInTheDocument()
    })

    it('ignores a repeat click on the already-selected reaction (logs once)', () => {
        render(<AffectiveReaction sectionId="s1" conceptIds={['c1']} />)

        const button = screen.getByRole('button', { name: 'Got it' })
        fireEvent.click(button)
        fireEvent.click(button)

        expect(logInteraction).toHaveBeenCalledTimes(1)
    })

    it('skips telemetry fusion when no concept ids are provided', () => {
        render(<AffectiveReaction sectionId="s1" conceptIds={[]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Interesting' }))

        expect(logInteraction).toHaveBeenCalledWith('affective_reaction', 'affect_engaged', 's1')
        expect(fuseTelemetry).not.toHaveBeenCalled()
    })
})
