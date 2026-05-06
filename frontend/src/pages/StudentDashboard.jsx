import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../lib/apiConfig'
import { supabase } from '../lib/supabase'
import { getResearchDashboardSnapshot, getEvaluationStatus } from '../lib/researchService'
import { ALL_COURSE_IDS } from '../lib/courseCatalog'
import CohortLiveMap from '../components/CohortLiveMap'
import KindredReaders from '../components/KindredReaders'

/**
 * StudentDashboard - learner-facing mastery view. Shows weak concepts,
 * dominant misconceptions, recent intervention activity, and the next
 * recommended action per concept.
 *
 * This is distinct from /analytics (researcher-only): it surfaces an
 * actionable view of the learner's own state, not a cohort-level
 * research view.
 */
export default function StudentDashboard({ user }) {
    const navigate = useNavigate()
    const [masteryRows, setMasteryRows] = useState([])
    const [snapshot, setSnapshot] = useState(() => getResearchDashboardSnapshot())
    const [retentionDue, setRetentionDue] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            setLoading(true)
            try {
                const userId = user?.id
                if (userId && userId !== '00000000-0000-0000-0000-000000000000') {
                    const { data } = await supabase
                        .from('mastery')
                        .select('concept_id, p_known, mastery_score, attempts_count, correct_count, last_practiced_at')
                        .eq('user_id', userId)
                        .order('mastery_score', { ascending: true })
                    if (!cancelled && data) setMasteryRows(data)
                }

                if (!cancelled) {
                    setSnapshot(getResearchDashboardSnapshot())
                }

                const dueChecks = []
                ALL_COURSE_IDS.forEach((course) => {
                    const status = getEvaluationStatus(course)
                    if (status?.pending?.retention) {
                        dueChecks.push({ course, dueAt: status.byPhase.post?.retention_due_at })
                    }
                })
                if (!cancelled) setRetentionDue(dueChecks)
            } catch (error) {
                console.warn('[StudentDashboard] load failed:', error)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [user])

    const weakConcepts = useMemo(
        () => masteryRows
            .filter((row) => Number(row.mastery_score ?? row.p_known ?? 0) < 0.6)
            .slice(0, 8),
        [masteryRows]
    )

    const strongConcepts = useMemo(
        () => masteryRows
            .filter((row) => Number(row.mastery_score ?? row.p_known ?? 0) >= 0.8)
            .slice(0, 6),
        [masteryRows]
    )

    const recentMisconceptions = snapshot.learnerMetrics?.dominantMisconceptions?.slice(0, 5) || []

    const handleConceptOpen = async (conceptId) => {
        // Best-effort navigation: ask backend which section first introduces
        // this concept. Falls back to the bio-inspired course root.
        try {
            const res = await fetch(`${API_BASE}/concept/${encodeURIComponent(conceptId)}/origin`)
            if (res.ok) {
                const data = await res.json()
                if (data?.section_slug) {
                    navigate(`/book/${data.section_slug}`)
                    return
                }
            }
        } catch {
            // intentionally ignored
        }
        navigate('/learn')
    }

    if (loading) {
        return (
            <div className="editorial-shell min-h-screen p-8">
                <p className="text-sm text-[var(--ath-muted)]">Loading your dashboard...</p>
            </div>
        )
    }

    const isDemoUser = !user?.id || user.id === '00000000-0000-0000-0000-000000000000'

    return (
        <div className="editorial-shell min-h-screen p-6 md:p-8">
            <header className="mx-auto max-w-5xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                    <span className="text-[var(--ath-text)] uppercase tracking-[0.18em]">Your dashboard</span>
                    {weakConcepts.length > 0 && (
                        <>
                            <span className="text-[var(--ath-line-strong)]">/</span>
                            <span>{weakConcepts.length} weak</span>
                        </>
                    )}
                    {strongConcepts.length > 0 && (
                        <>
                            <span className="text-[var(--ath-line-strong)]">/</span>
                            <span>{strongConcepts.length} strong</span>
                        </>
                    )}
                    {retentionDue.length > 0 && (
                        <>
                            <span className="text-[var(--ath-line-strong)]">/</span>
                            <span className="text-amber-700">{retentionDue.length} retention check{retentionDue.length === 1 ? '' : 's'} due</span>
                        </>
                    )}
                </div>
            </header>

            {isDemoUser && (
                <section className="mx-auto mt-4 max-w-5xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
                    <span className="font-semibold">Demo mode</span> / sign in to persist mastery, kindred readers, and retention checks
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="ml-3 text-xs font-semibold text-sky-700 underline-offset-4 hover:underline"
                    >
                        Sign in
                    </button>
                </section>
            )}

            {retentionDue.length > 0 && (
                <section className="mx-auto mt-4 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
                        <span className="uppercase tracking-[0.18em]">Retention due</span>
                        {retentionDue.map((entry) => (
                            <button
                                key={entry.course}
                                type="button"
                                className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                                onClick={() => navigate(`/diagnostic/${entry.course}?phase=retention`)}
                            >
                                {entry.course} / 5 min
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section className="mx-auto mt-6 grid max-w-5xl gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--ath-line)] bg-white/85 p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-[var(--ath-text)]">Weakest concepts</h2>
                    {weakConcepts.length === 0 ? (
                        <p className="mt-3 text-xs text-[var(--ath-muted)]">All concepts ≥ 60% mastery. Keep retention checks current.</p>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {weakConcepts.map((row) => {
                                const score = Number(row.mastery_score ?? row.p_known ?? 0)
                                return (
                                    <li
                                        key={row.concept_id}
                                        className="flex items-center justify-between rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2 transition-colors hover:border-[var(--ath-primary-soft)] hover:bg-white"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--ath-text)]">{prettify(row.concept_id)}</p>
                                            <p className="text-xs text-[var(--ath-muted)]">
                                                Mastery {Math.round(score * 100)}% / attempts {row.attempts_count || 0}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleConceptOpen(row.concept_id)}
                                            className="editorial-button px-3 py-1 text-xs"
                                        >
                                            Review
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <div className="rounded-2xl border border-[var(--ath-line)] bg-white/85 p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-[var(--ath-text)]">Misconception patterns</h2>
                    {recentMisconceptions.length === 0 ? (
                        <p className="mt-3 text-xs text-[var(--ath-muted)]">No patterns yet. Practice surfaces signals.</p>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {recentMisconceptions.map((entry) => (
                                <li
                                    key={entry.type}
                                    className="rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2 text-sm"
                                >
                                    <p className="font-semibold text-[var(--ath-text)]">{prettify(entry.type)}</p>
                                    <p className="text-xs text-[var(--ath-muted)]">{entry.count} occurrence(s) recently</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            <section className="mx-auto mt-4 max-w-5xl rounded-2xl border border-[var(--ath-line)] bg-white/85 p-5">
                <h2 className="text-sm font-semibold text-[var(--ath-text)]">Strong concepts</h2>
                {strongConcepts.length === 0 ? (
                    <p className="mt-3 text-xs text-[var(--ath-muted)]">Practice + retention will move concepts here.</p>
                ) : (
                    <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                        {strongConcepts.map((row) => (
                            <li
                                key={row.concept_id}
                                className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900"
                            >
                                {prettify(row.concept_id)}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-2">
                <CohortLiveMap windowMinutes={5} />
                <KindredReaders user={user} limit={5} />
            </section>
        </div>
    )
}

function prettify(id) {
    return String(id || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
