import * as Popover from '@radix-ui/react-popover'
import { HandHelping, Lightbulb } from 'lucide-react'

function peerInitials(alias = '') {
    return String(alias)
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase()
        || 'U'
}

export default function PeerPulse({
    connected,
    peers = [],
    sameHeadingPeers = [],
    sameConceptPeers = [],
    signalSummary = {},
    activeHeading = '',
    onReaction,
}) {
    const livePeerCount = peers.length
    const canReact = Boolean(activeHeading)
    const visiblePeers = peers.slice(0, 4)
    const overflowCount = Math.max(0, peers.length - visiblePeers.length)
    const topConfusion = signalSummary.topConfusion
    const tooltipLines = [
        connected ? 'Live peers in this section' : 'Reconnecting',
        livePeerCount > 0
            ? `${livePeerCount} reader${livePeerCount === 1 ? '' : 's'}${sameHeadingPeers.length > 0 ? ` / ${sameHeadingPeers.length} on this passage` : sameConceptPeers.length > 0 ? ` / ${sameConceptPeers.length} on this concept` : ''}`
            : 'Signals appear as readers join',
        topConfusion ? `Pause point: ${topConfusion.heading} (${topConfusion.count})` : null,
    ].filter(Boolean)

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    title={tooltipLines.join('\n')}
                    className="my-6 inline-flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--ath-muted)] shadow-sm transition-all hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                    aria-label="Peer presence in this section"
                >
                    <span className={`inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden />
                    <div className="flex -space-x-1.5">
                        {visiblePeers.length > 0 ? (
                            visiblePeers.map((peer) => (
                                <span
                                    key={peer.key || peer.alias}
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-linear-to-br ${peer.colorToken || 'from-slate-400 to-slate-500'} text-[10px] font-bold text-white`}
                                    title={peer.alias}
                                >
                                    {peerInitials(peer.alias)}
                                </span>
                            ))
                        ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--ath-panel)] text-[10px] font-bold text-[var(--ath-secondary)]">0</span>
                        )}
                        {overflowCount > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--ath-panel-muted)] text-[10px] font-bold text-[var(--ath-secondary)]">
                                +{overflowCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[var(--ath-text)]">{livePeerCount > 0 ? `${livePeerCount} here` : 'Live'}</span>
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="z-[80] w-64 rounded-2xl border border-[var(--ath-line)] bg-white/95 p-3 text-xs shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl"
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Peer pulse</p>
                    <p className="mt-1.5 text-[var(--ath-text)]">
                        {livePeerCount > 0 ? `${livePeerCount} anonymous reader${livePeerCount === 1 ? '' : 's'} in this section` : 'No live peers right now'}
                    </p>
                    {sameHeadingPeers.length > 0 && (
                        <p className="mt-1 text-[var(--ath-muted)]">{sameHeadingPeers.length} on this passage</p>
                    )}
                    {topConfusion && (
                        <p className="mt-1 text-[var(--ath-muted)]">Pause point: {topConfusion.heading}</p>
                    )}
                    {canReact && (
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={() => onReaction?.('need_example')}
                                className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:bg-[var(--ath-panel)]"
                                aria-label="Need example"
                                title="Need example"
                            >
                                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onReaction?.('stuck_too')}
                                className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:bg-[var(--ath-panel)]"
                                aria-label="Stuck too"
                                title="Stuck too"
                            >
                                <HandHelping className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
