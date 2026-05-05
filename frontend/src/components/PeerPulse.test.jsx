import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PeerPulse from './PeerPulse'

afterEach(() => cleanup())

describe('PeerPulse', () => {
    it('renders section aggregates and sends lightweight reactions', () => {
        const onReaction = vi.fn()

        render(
            <PeerPulse
                connected
                peers={[{ key: 'peer-1', alias: 'Reader One' }]}
                sameHeadingPeers={[{ key: 'peer-1' }]}
                sameConceptPeers={[]}
                signalSummary={{
                    completionsToday: 4,
                    helpOpensToday: 2,
                    reactionTotal: 5,
                    reactionCounts: {
                        clicked: 1,
                        need_example: 3,
                        stuck_too: 1,
                    },
                    topConfusion: {
                        heading: 'Worked Example',
                        count: 3,
                    },
                    supportChoices: [
                        { id: 'need_example', label: 'Asked for an example', count: 3 },
                        { id: 'opened_support', label: 'Opened BigAL support', count: 2 },
                    ],
                    passageReactionChoices: [
                        { id: 'need_example', label: 'Asked for an example', count: 3 },
                    ],
                }}
                activeHeading="Worked Example"
                onReaction={onReaction}
            />
        )

        expect(screen.getByText('Peer Pulse')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText(/Worked Example \(3\)/)).toBeInTheDocument()
        expect(screen.getByText(/Asked for an example \(3\)/)).toBeInTheDocument()
        expect(screen.getByText('4 completions today')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Need example/i }))
        expect(onReaction).toHaveBeenCalledWith('need_example')
    })

    it('does not send passage reactions before a real heading is active', () => {
        const onReaction = vi.fn()

        render(
            <PeerPulse
                connected={false}
                signalSummary={{ reactionCounts: {} }}
                activeHeading=""
                onReaction={onReaction}
            />
        )

        const button = screen.getByRole('button', { name: /Need example/i })
        expect(button).toBeDisabled()
        fireEvent.click(button)
        expect(onReaction).not.toHaveBeenCalled()
    })
})
