import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../lib/apiConfig'
import { supabase } from '../lib/supabase'
import { getResearchDashboardSnapshot, getEvaluationStatus } from '../lib/researchService'
import { ALL_COURSE_IDS } from '../lib/courseCatalog'
import CohortLiveMap from '../components/CohortLiveMap'
import KindredReaders from '../components/KindredReaders'

/**
 * StudentDashboard — learner-facing mastery view. Shows weak concepts,
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
        <div className="editorial-shell min-h-screen p-8">
            <header className="mx-auto max-w-5xl">
                <p className="editorial-kicker">Your dashboard</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                    What's next for you to learn
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">
                    A snapshot of your concept-level mastery. Weak concepts are the highest-leverage
                    place to spend your next study session. Retention checks coming due strengthen
                    long-term recall — five minutes spent here is worth far more than five extra
                    minutes of new reading.
                </p>
            </header>

            {isDemoUser && (
                <section className="mx-auto mt-6 max-w-5xl rounded-2xl border border-sky-200 bg-sky-50 p-5">
                    <p className="editorial-kicker text-sky-700">Demo mode</p>
                    <p className="mt-1 text-sm text-sky-900">
                        You're using ALGET in demo mode. Mastery, kindred-readers, and retention checks
                        appear here once you sign in with a real account so the system can persist your
                        learning record across devices.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="mt-3 editorial-button px-4 py-2 text-xs"
                    >
                        Go to sign-in
                    </button>
                </section>
            )}

            {retentionDue.length > 0 && (
                <section className="mx-auto mt-6 max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="editorial-kicker text-amber-700">Retention checks due</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                        {retentionDue.map((entry) => (
                            <li key={entry.course} className="flex items-center justify-between">
                                <span>{entry.course}</span>
                                <button
                                    type="button"
                                    className="editorial-button px-3 py-1 text-xs"
                                    onClick={() => navigate(`/diagnostic/${entry.course}?phase=retention`)}
                                >
                                    Take 5-min check
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-2">
                <div className="editorial-surface p-6">
                    <p className="editorial-kicker">Weakest concepts</p>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--ath-text)]">Where to focus next</h2>
                    {weakConcepts.length === 0 ? (
                        <p className="mt-4 text-sm text-[var(--ath-muted)]">
                            No concept is below 60% mastery. Keep your retention checks current and
                            start a new section.
                        </p>
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
                                                Mastery {Math.round(score * 100)}% · attempts {row.attempts_count || 0}
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

                <div className="editorial-surface p-6">
                    <p className="editorial-kicker">Recent misconception signals</p>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--ath-text)]">Patterns the system noticed</h2>
                    {recentMisconceptions.length === 0 ? (
                        <p className="mt-4 text-sm text-[var(--ath-muted)]">
                            No misconception patterns surfaced yet. Try the practice problems in your
                            current section to give the system more signal.
                        </p>
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

            <section className="mx-auto mt-8 max-w-5xl rounded-2xl border border-[var(--ath-line)] bg-white/70 p-6">
                <p className="editorial-kicker">Strong concepts</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--ath-text)]">What you've consolidated</h2>
                {strongConcepts.length === 0 ? (
                    <p className="mt-4 text-sm text-[var(--ath-muted)]">
                        Practice and retention will move concepts here. Keep going.
                    </p>
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
