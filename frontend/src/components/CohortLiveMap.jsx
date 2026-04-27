import { useEffect, useMemo, useState } from 'react'
import { fetchLivePresenceSnapshots } from '../lib/socialService'
import { logEvent } from '../lib/loggingService'
import Skeleton, { SkeletonGroup } from './Skeleton'

/**
 * CohortLiveMap — cohort-wide presence visualization.
 *
 * Reads social_presence (last_seen_at within window) and renders a
 * grid of who's where. Aliases + color tokens only — no real names.
 *
 * Mounts on the StudentDashboard and (optionally) the BookLayout sidebar.
 * Refreshes every 30 seconds while visible.
 *
 * R2 from the annotation/social audit.
 */
export default function CohortLiveMap({ windowMinutes = 5, currentSectionId = null }) {
    const [snapshots, setSnapshots] = useState([])
    const [loading, setLoading] = useState(true)
    const [lastFetched, setLastFetched] = useState(null)

    useEffect(() => {
        let cancelled = false
        let intervalId = null

        const load = async () => {
            // Skip work when tab is hidden — saves Supabase quota + battery.
            if (typeof document !== 'undefined' && document.hidden) return
            try {
                const data = await fetchLivePresenceSnapshots(windowMinutes)
                if (!cancelled) {
                    setSnapshots(data || [])
                    setLastFetched(new Date())
                    setLoading(false)
                    logEvent('cohort_live_map_refresh', null, { count: (data || []).length })
                }
            } catch (err) {
                console.warn('[CohortLiveMap] fetch failed:', err)
                if (!cancelled) setLoading(false)
            }
        }

        load()
        intervalId = window.setInterval(load, 30 * 1000)

        // Refresh once on return-to-foreground so stale data doesn't linger.
        const onVisibilityChange = () => {
            if (!document.hidden) load()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            cancelled = true
            if (intervalId) window.clearInterval(intervalId)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [windowMinutes])

    const totalLearners = useMemo(
        () => new Set(snapshots.map((s) => s.presence_key)).size,
        [snapshots]
    )

    const byCourse = useMemo(() => {
        const acc = {}
        snapshots.forEach((s) => {
            const key = s.course || 'unknown'
            if (!acc[key]) acc[key] = []
            acc[key].push(s)
        })
        return acc
    }, [snapshots])

    const sameSectionPeers = useMemo(
        () => snapshots.filter((s) => s.section_id === currentSectionId).length,
        [snapshots, currentSectionId]
    )

    if (loading) {
        return (
            <div className="rounded-2xl border border-[var(--ath-line)] bg-white/70 p-5" aria-busy="true">
                <p className="editorial-kicker">Cohort live map</p>
                <div className="mt-3 space-y-2">
                    <Skeleton variant="line" width="50%" />
                    <SkeletonGroup count={2} variant="block" />
                </div>
            </div>
        )
    }

    if (snapshots.length === 0) {
        return (
            <div className="rounded-2xl border border-[var(--ath-line)] bg-white/70 p-5">
                <p className="editorial-kicker">Cohort live map</p>
                <p className="mt-2 text-sm text-[var(--ath-muted)]">
                    No one else is in ALGET right now. You're solo.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-[var(--ath-line)] bg-white/70 p-5">
            <div className="flex items-baseline justify-between">
                <p className="editorial-kicker">Cohort live map</p>
                <p className="text-xs text-[var(--ath-muted)]">
                    {lastFetched ? `Updated ${formatTime(lastFetched)}` : ''}
                </p>
            </div>
            <p className="mt-2 text-sm text-[var(--ath-text)]">
                <span className="font-semibold text-[var(--ath-primary)]">{totalLearners}</span> learner(s) in ALGET in the last {windowMinutes} min.
                {currentSectionId && sameSectionPeers > 0 && (
                    <>
                        {' '}<span className="font-semibold">{sameSectionPeers}</span> with you in this exact section.
                    </>
                )}
            </p>

            <div className="mt-4 space-y-3">
                {Object.entries(byCourse).map(([course, members]) => (
                    <div key={course} className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3">
                        <div className="flex items-baseline justify-between">
                            <p className="text-sm font-semibold text-[var(--ath-text)]">{prettyCourse(course)}</p>
                            <span className="text-xs text-[var(--ath-muted)]">{members.length}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {members.slice(0, 16).map((m) => (
                                <span
                                    key={m.presence_key}
                                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-[var(--ath-muted)]"
                                    title={`${m.alias} on ${m.section_id}${m.heading ? ` (${m.heading})` : ''}`}
                                >
                                    <span
                                        className={`h-2 w-2 rounded-full bg-gradient-to-br ${m.color_token || 'from-slate-400 to-slate-500'}`}
                                    />
                                    {m.alias}
                                </span>
                            ))}
                            {members.length > 16 && (
                                <span className="text-xs text-[var(--ath-muted)]">+{members.length - 16} more</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <p className="mt-3 text-xs text-[var(--ath-muted)]">
                Aliases are auto-generated; no real names are exposed.
            </p>
        </div>
    )
}

function prettyCourse(id) {
    return String(id || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
