import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PeerPulse from './PeerPulse'

afterEach(() => cleanup())

describe('PeerPulse', () => {
    it('renders a compact presence chip with peer initials and live count', () => {
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
                    reactionCounts: { clicked: 1, need_example: 3, stuck_too: 1 },
                    topConfusion: { heading: 'Worked Example', count: 3 },
                }}
                activeHeading="Worked Example"
                onReaction={onReaction}
            />
        )

        // Compact presence chip surfaces an aria-labelled button + peer initials + live count
        expect(screen.getByRole('button', { name: /Peer presence/i })).toBeInTheDocument()
        expect(screen.getByText(/1 here/i)).toBeInTheDocument()
        expect(screen.getByTitle('Reader One')).toBeInTheDocument()
    })

    it('shows a Live label when no peers are present yet', () => {
        render(
            <PeerPulse
                connected={false}
                signalSummary={{ reactionCounts: {} }}
                activeHeading=""
                onReaction={vi.fn()}
            />
        )

        const trigger = screen.getByRole('button', { name: /Peer presence/i })
        expect(trigger).toBeInTheDocument()
        expect(screen.getByText(/Live/i)).toBeInTheDocument()
    })
})
