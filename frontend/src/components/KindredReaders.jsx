import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/loggingService'
import { SkeletonGroup } from './Skeleton'

/**
 * KindredReaders - peers whose highlight pattern overlaps with the
 * current learner's. Reads from the `kindred_readers` SQL view, joins
 * the peer's chosen alias from `social_presence` (last seen alias used).
 *
 * Pedagogically grounded in connectivism (Siemens) and study-network
 * literature: learners benefit from seeing peers whose attention
 * landed on similar passages, without surfacing real identities.
 *
 * No friend-request mechanic on purpose: the LXD audit flagged
 * manufactured social pressure as a risk. This is discovery, not
 * forced connection.
 *
 * R3 from the annotation/social audit.
 */
export default function KindredReaders({ user, limit = 5 }) {
    const [rows, setRows] = useState([])
    const [aliases, setAliases] = useState({})
    const [expanded, setExpanded] = useState(null)
    const [loading, setLoading] = useState(true)

    const userId = user?.id

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
                setLoading(false)
                return
            }
            try {
                const { data: kindred } = await supabase
                    .from('kindred_readers')
                    .select('peer_user_id, total_overlap, shared_sections')
                    .eq('user_a', userId)
                    .order('total_overlap', { ascending: false })
                    .limit(limit)

                if (cancelled) return
                setRows(kindred || [])

                if (kindred && kindred.length > 0) {
                    const peerIds = kindred.map((row) => row.peer_user_id)
                    const { data: presenceRows } = await supabase
                        .from('social_presence')
                        .select('user_id, alias, color_token')
                        .in('user_id', peerIds)
                    if (cancelled) return
                    const map = {}
                    ;(presenceRows || []).forEach((row) => {
                        if (!map[row.user_id]) map[row.user_id] = row
                    })
                    setAliases(map)
                }
            } catch (err) {
                console.warn('[KindredReaders] load failed:', err)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [userId, limit])

    const totalKindred = rows.length

    const handleExpand = (peerId) => {
        setExpanded(expanded === peerId ? null : peerId)
        logEvent('kindred_readers_expand', null, { peer_id: peerId })
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-[var(--ath-line)] bg-white/70 p-5" aria-busy="true">
                <p className="editorial-kicker">Kindred readers</p>
                <SkeletonGroup count={3} variant="block" className="mt-3" />
            </div>
        )
    }

    if (totalKindred === 0) {
        return (
            <div className="rounded-2xl border border-[var(--ath-line)] bg-white/70 p-5">
                <p className="editorial-kicker">Kindred readers</p>
                <p className="mt-2 text-sm text-[var(--ath-muted)]">
                    Once you and another learner highlight the same passages, they'll show up here.
                    Try highlighting more - the system finds your reading-pattern peers.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-[var(--ath-line)] bg-white/70 p-5">
            <p className="editorial-kicker">Kindred readers</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--ath-text)]">
                Learners highlighting similar passages
            </h2>
            <p className="mt-1 text-xs text-[var(--ath-muted)]">
                Discovery only - aliases, not names. The point is to see who's noticing what you notice.
            </p>

            <ul className="mt-4 space-y-2">
                {rows.map((row) => {
                    const peer = aliases[row.peer_user_id] || {}
                    const alias = peer.alias || `Peer ${row.peer_user_id.slice(0, 6)}`
                    const sections = row.shared_sections || []
                    return (
                        <li
                            key={row.peer_user_id}
                            className="rounded-xl border border-[var(--ath-line)] bg-white/80 px-3 py-2 transition-colors hover:border-[var(--ath-primary-soft)] hover:bg-white"
                        >
                            <button
                                type="button"
                                onClick={() => handleExpand(row.peer_user_id)}
                                aria-expanded={expanded === row.peer_user_id}
                                className="flex w-full items-center justify-between text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`h-2 w-2 rounded-full bg-gradient-to-br ${peer.color_token || 'from-slate-400 to-slate-500'}`}
                                    />
                                    <span className="text-sm font-semibold text-[var(--ath-text)]">{alias}</span>
                                </div>
                                <span className="text-xs text-[var(--ath-muted)]">
                                    {row.total_overlap} shared / {sections.length} section{sections.length === 1 ? '' : 's'}
                                </span>
                            </button>
                            {expanded === row.peer_user_id && sections.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-[var(--ath-muted)]">
                                    {sections.slice(0, 6).map((s) => (
                                        <span key={s} className="rounded bg-[var(--ath-panel)] px-2 py-1">{s}</span>
                                    ))}
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
