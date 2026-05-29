import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WhySupportNow from './WhySupportNow'

describe('WhySupportNow learner explanation panel', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders reason_codes as readable affordances and the evidence snapshot', () => {
        render(
            <WhySupportNow
                decision={{
                    client_trace_id: 'decision-1',
                    primary_recommendation: { action: 'explain' },
                    reasoning: {
                        confidence: 0.72,
                        reason_codes: ['artifact_quality_gap', 'high_friction'],
                        evidence_snapshot: { artifact_quality: 0.4, forgetting_risk: 0.65 },
                    },
                }}
            />,
        )

        expect(screen.getByText(/Why this support now/i)).toBeInTheDocument()
        expect(screen.getByText(/72% confidence/i)).toBeInTheDocument()
        // Machine reason codes become human-readable affordances.
        expect(screen.getByText(/work-product trace was still thin/i)).toBeInTheDocument()
        expect(screen.getByText(/stuck moments and wrong attempts/i)).toBeInTheDocument()
        // Evidence snapshot values are surfaced as percentages.
        expect(screen.getByText('Artifact quality')).toBeInTheDocument()
        expect(screen.getByText('40%')).toBeInTheDocument()
    })

    it('wires the explicit accepted/declined signal through onResolve', () => {
        const onResolve = vi.fn()
        render(
            <WhySupportNow
                decision={{
                    decision_id: 'decision-2',
                    action: 'practice',
                    reason_codes: ['low_mastery'],
                    evidence_snapshot: {},
                }}
                onResolve={onResolve}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /Contest this support/i }))

        expect(onResolve).toHaveBeenCalledTimes(1)
        expect(onResolve).toHaveBeenCalledWith(
            expect.objectContaining({ accepted: false, decisionId: 'decision-2', action: 'practice' }),
        )
        // After resolving, the contest control is replaced by an acknowledgement.
        expect(screen.queryByRole('button', { name: /Contest this support/i })).not.toBeInTheDocument()
        expect(screen.getByText(/did not fit/i)).toBeInTheDocument()
    })

    it('renders nothing when no decision is provided', () => {
        const { container } = render(<WhySupportNow decision={null} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('falls back gracefully when reason_codes and evidence are absent', () => {
        render(<WhySupportNow decision={{ action: 'ask' }} />)
        expect(screen.getByText(/chosen from your overall learner and artifact evidence/i)).toBeInTheDocument()
    })
})
