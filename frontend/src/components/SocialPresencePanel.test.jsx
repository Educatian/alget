import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SocialPresencePanel from './SocialPresencePanel'

afterEach(() => cleanup())

const signalSummary = {
    completionsToday: 2,
    helpOpensToday: 1,
    reactionCounts: {
        clicked: 3,
        need_example: 4,
        stuck_too: 1
    }
}

describe('SocialPresencePanel', () => {
    it('renders the live pulse as a compact status panel without explanatory copy', () => {
        render(
            <SocialPresencePanel
                connected={false}
                peers={[]}
                sameHeadingPeers={[]}
                sameConceptPeers={[]}
                signalSummary={signalSummary}
                liveFeed={[]}
                sectionTitle="Storyboard Studio"
            />
        )

        expect(screen.getByText('Social Pulse')).toBeInTheDocument()
        expect(screen.getByText('Offline')).toBeInTheDocument()
        expect(screen.getByText('Section')).toBeInTheDocument()
        expect(screen.getByText('Passage')).toBeInTheDocument()
        expect(screen.getByText('Concept')).toBeInTheDocument()
        expect(screen.getByText('Done')).toBeInTheDocument()
        expect(screen.getByText('Help')).toBeInTheDocument()
        expect(screen.getByText('Example')).toBeInTheDocument()
        expect(screen.queryByText(/Live peers are active/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/React to This Part/i)).not.toBeInTheDocument()
    })

    it('keeps reactions clickable in the compact layout', () => {
        const onReaction = vi.fn()

        render(
            <SocialPresencePanel
                connected
                peers={[{ key: 'peer-1', alias: 'Reader One' }]}
                sameHeadingPeers={[{ key: 'peer-1' }]}
                sameConceptPeers={[]}
                signalSummary={signalSummary}
                liveFeed={[{ kind: 'reaction', alias: 'Reader One', reactionId: 'need_example' }]}
                onReaction={onReaction}
                sectionTitle="Storyboard Studio"
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Example/i }))

        expect(onReaction).toHaveBeenCalledWith('need_example')
        expect(screen.getByTitle('Reader One')).toBeInTheDocument()
    })
})
