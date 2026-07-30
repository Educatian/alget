import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Flame, NotebookPen, Target } from 'lucide-react'
import { LLM_API_BASE } from '../lib/apiConfig'
import { supabase } from '../lib/supabase'
import { getResearchDashboardSnapshot, getEvaluationStatus } from '../lib/researchService'
import { ALL_COURSE_IDS } from '../lib/courseCatalog'
import { useCourseProgress } from '../hooks/useCourseProgress'
import { getStreak } from '../lib/streak'
import { getLocalTroubleSpots } from '../lib/calibration'
import { getExitTicketCue, listExitTickets } from '../lib/exitTickets'
import CohortLiveMap from '../components/CohortLiveMap'
import KindredReaders from '../components/KindredReaders'
import EmptyState from '../components/EmptyState'

/**
 * StudentDashboard - learner-facing mastery view. Shows weak concepts,
 * dominant misconceptions, recent intervention activity, and the next
 * recommended action per concept.
 *
 * This is distinct from /analytics (researcher-only): it surfaces an
 * actionable view of the learner's own state, not a cohort-level
 * research view.
 *
 * Layout follows the design system: an outer min-h-screen .editorial-shell
 * paints only the grid-textured background, while the inner .ath-container
 * stack is height:auto so the page does not float a small content block in a
 * tall empty grid (critique #1). Surfaces use the tokenized card primitives
 * (.content-card / .card-actionable / .card-surface), titles use Fraunces via
 * the type-scale tokens, numeric values use .ath-stat, and zero-states use the
 * <EmptyState> primitive (critique #5, systemic gap #9).
 */
export default function StudentDashboard({ user }) {
    const navigate = useNavigate()
    const { recentSection } = useCourseProgress(user)
    const [masteryRows, setMasteryRows] = useState([])
    const [snapshot, setSnapshot] = useState(() => getResearchDashboardSnapshot())
    const [retentionDue, setRetentionDue] = useState([])
    const [exitTickets, setExitTickets] = useState(() => listExitTickets({ limit: 3 }))
    const [loading, setLoading] = useState(true)
    const [streak] = useState(() => getStreak())

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
                    setExitTickets(listExitTickets({ limit: 3 }))
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
    const latestExitTicket = exitTickets[0] || null

    // Honesty guard: masteryRows only holds data when the synced learner model
    // actually answered (signed-in user + successful fetch + non-empty rows).
    // Without it, an empty weak-concepts list means "no synced evidence", NOT
    // "all concepts strong" — the empty-state copy must not claim mastery.
    const hasSyncedMastery = masteryRows.length > 0

    // Local-evidence fallback: recent trouble spots computed from this
    // browser's calibration records (scoped to the current course when one is
    // known). Subordinate to the server view — rendered below it, and clearly
    // labelled as local.
    const troubleSpots = useMemo(
        () => getLocalTroubleSpots({ course: recentSection?.course || null }),
        [recentSection?.course]
    )

    const handleConceptOpen = async (conceptId) => {
        // Best-effort navigation: ask backend which section first introduces
        // this concept. Falls back to the bio-inspired course root.
        try {
            const res = await fetch(`${LLM_API_BASE}/concept/${encodeURIComponent(conceptId)}/origin`)
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
            <div className="editorial-shell min-h-screen">
                <div className="ath-container py-12">
                    <p className="text-[var(--ath-text-sm)] text-[var(--ath-muted)]">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    const isDemoUser = !user?.id || user.id === '00000000-0000-0000-0000-000000000000'

    return (
        <div className="editorial-shell ath-open-layout ath-density-compact min-h-screen">
            <div className="ath-container flex flex-col gap-5 pb-10">
                <header className="pt-5">
                    <div className="flex flex-wrap items-center gap-2 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-secondary)]">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-1 text-[var(--ath-muted)] hover:text-[var(--ath-text)]"
                            aria-label="Go back"
                        >
                            ← Back
                        </button>
                        <span className="text-[var(--ath-line-strong)]">·</span>
                        <span className="text-[var(--ath-text)] uppercase tracking-[0.18em]">Your dashboard</span>
                        {weakConcepts.length > 0 && (
                            <>
                                <span className="text-[var(--ath-line-strong)]">/</span>
                                <span><span className="ath-stat">{weakConcepts.length}</span> weak</span>
                            </>
                        )}
                        {strongConcepts.length > 0 && (
                            <>
                                <span className="text-[var(--ath-line-strong)]">/</span>
                                <span><span className="ath-stat">{strongConcepts.length}</span> strong</span>
                            </>
                        )}
                        {retentionDue.length > 0 && (
                            <>
                                <span className="text-[var(--ath-line-strong)]">/</span>
                                <span className="text-[var(--ath-warning)]"><span className="ath-stat">{retentionDue.length}</span> retention check{retentionDue.length === 1 ? '' : 's'} due</span>
                            </>
                        )}
                    </div>
                </header>

                {isDemoUser && (
                    <section className="card-surface px-4 py-2.5 text-[var(--ath-text-sm)] text-[var(--ath-text)]">
                        <span className="font-semibold text-[var(--ath-info)]">Demo mode</span> / sign in to persist mastery, kindred readers, and retention checks
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="ml-3 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-info)] underline-offset-4 hover:underline"
                        >
                            Sign in
                        </button>
                    </section>
                )}

                {retentionDue.length > 0 && (
                    <section className="card-surface px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-warning)]">
                            <span className="uppercase tracking-[0.18em]">Retention due</span>
                            {retentionDue.map((entry) => (
                                <button
                                    key={entry.course}
                                    type="button"
                                    className="rounded-full border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] px-2.5 py-0.5 text-[var(--ath-text-2xs)] font-semibold text-[var(--ath-warning)] hover:bg-[var(--ath-warning)] hover:text-[var(--ath-background)]"
                                    onClick={() => navigate(`/diagnostic/${entry.course}?phase=retention`)}
                                >
                                    {entry.course} / 5 min
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <div className="flex flex-wrap items-center gap-2 text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                        <span>Today's focus · 20 min</span>
                        {streak.count > 0 && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] px-2 py-0.5 text-[var(--ath-text-2xs)] font-bold text-[var(--ath-warning)]">
                                <Flame className="h-3 w-3" />
                                <span className="ath-stat">{streak.count}</span>-day streak
                            </span>
                        )}
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {/* Card 1 — weakest concept */}
                        <button
                            type="button"
                            onClick={() => weakConcepts[0] && handleConceptOpen(weakConcepts[0].concept_id)}
                            disabled={!weakConcepts[0]}
                            className="group card-actionable flex min-h-[8rem] flex-col gap-2 p-4 text-left disabled:cursor-default disabled:opacity-60"
                        >
                            <div className="flex items-center gap-2 text-[var(--ath-primary)]">
                                <Target className="h-4 w-4" />
                                <span className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Review · 5 min</span>
                            </div>
                            {weakConcepts[0] ? (
                                <>
                                    <p className="font-headline text-[var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">{prettify(weakConcepts[0].concept_id)}</p>
                                    <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]">
                                        <span className="ath-stat">{Math.round(Number(weakConcepts[0].mastery_score ?? weakConcepts[0].p_known ?? 0) * 100)}%</span> mastery · review the section that introduces it
                                    </p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Open section <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[var(--ath-text-xs)] text-[var(--ath-muted)]">No weak concept right now, keep practicing.</p>
                            )}
                        </button>

                        {/* Card 2 — resume reading */}
                        <button
                            type="button"
                            onClick={() => recentSection && navigate(`/book/${recentSection.course}/${recentSection.chapter}/${recentSection.section}`)}
                            disabled={!recentSection}
                            className="group card-actionable flex min-h-[8rem] flex-col gap-2 p-4 text-left disabled:cursor-default disabled:opacity-60"
                        >
                            <div className="flex items-center gap-2 text-[var(--ath-primary)]">
                                <BookOpen className="h-4 w-4" />
                                <span className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Resume · 5 min</span>
                            </div>
                            {recentSection ? (
                                <>
                                    <p className="font-headline text-[var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">{recentSection.title || `${recentSection.course} ${recentSection.chapter}.${recentSection.section}`}</p>
                                    <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]"><span className="ath-stat">{recentSection.chapter}.{recentSection.section}</span> · pick up where you left off</p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Continue <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[var(--ath-text-xs)] text-[var(--ath-muted)]">No recent section. Open a course to get started.</p>
                            )}
                        </button>

                        {/* Card 3 — evidence trace */}
                        <button
                            type="button"
                            onClick={() => latestExitTicket && navigate(`/book/${latestExitTicket.course}/${latestExitTicket.chapter}/${latestExitTicket.section}`)}
                            disabled={!latestExitTicket}
                            className="group card-actionable flex min-h-[8rem] flex-col gap-2 p-4 text-left disabled:cursor-default disabled:opacity-60"
                        >
                            <div className="flex items-center gap-2 text-[var(--ath-primary)]">
                                <NotebookPen className="h-4 w-4" />
                                <span className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Trace · 5 min</span>
                            </div>
                            {latestExitTicket ? (
                                <>
                                    <p className="font-headline text-[var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">
                                        {latestExitTicket.title || `${latestExitTicket.course} ${latestExitTicket.chapter}.${latestExitTicket.section}`}
                                    </p>
                                    <p className="text-[var(--ath-text-xs)] leading-5 text-[var(--ath-muted)] line-clamp-3">
                                        {latestExitTicket.text}
                                    </p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Reopen trace <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[var(--ath-text-xs)] text-[var(--ath-muted)]">Write an exit ticket at the end of a section to create a reusable trace.</p>
                            )}
                        </button>

                        {/* Card 4 — retention */}
                        <button
                            type="button"
                            onClick={() => retentionDue[0] && navigate(`/diagnostic/${retentionDue[0].course}?phase=retention`)}
                            disabled={!retentionDue[0]}
                            className="group card-actionable flex min-h-[8rem] flex-col gap-2 p-4 text-left disabled:cursor-default disabled:opacity-60"
                        >
                            <div className="flex items-center gap-2 text-[var(--ath-primary)]">
                                <Flame className="h-4 w-4" />
                                <span className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Retention · 5 min</span>
                            </div>
                            {retentionDue[0] ? (
                                <>
                                    <p className="font-headline text-[var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">{prettify(retentionDue[0].course)} check</p>
                                    <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]">A delayed probe to lock in last week's learning</p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Take check <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[var(--ath-text-xs)] text-[var(--ath-muted)]">All retention checks current.</p>
                            )}
                        </button>
                    </div>
                </section>

                {exitTickets.length > 0 && (
                    <section>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Recent learning traces</p>
                                <h2 className="font-headline text-[var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Turn reflections into the next study move</h2>
                            </div>
                            <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]">
                                {exitTickets.length} saved trace{exitTickets.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        <ul className="mt-3 grid gap-3 md:grid-cols-3">
                            {exitTickets.map((ticket) => {
                                const cue = getExitTicketCue(ticket)
                                const title = ticket.title || `${ticket.course} ${ticket.chapter}.${ticket.section}`
                                return (
                                    <li
                                        key={ticket.sectionId}
                                        className="card-actionable flex min-h-[13rem] flex-col gap-3 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="rounded-full border border-[var(--ath-line)] bg-white px-2 py-0.5 text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                                                {ticket.chapter}.{ticket.section}
                                            </span>
                                            <span className="text-right text-[var(--ath-text-2xs)] font-semibold text-[var(--ath-muted)]">
                                                {formatTraceUpdatedAt(ticket.updatedAt)}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-headline text-[var(--ath-text-lg)] font-semibold leading-tight text-[var(--ath-text)] line-clamp-2">
                                                {title}
                                            </h3>
                                            <p className="mt-2 text-[var(--ath-text-xs)] leading-5 text-[var(--ath-muted)] line-clamp-3">
                                                {ticket.text}
                                            </p>
                                        </div>
                                        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-[var(--ath-text-xs)] font-semibold text-[var(--ath-primary)]">{cue.label}</p>
                                                <p className="mt-1 text-[var(--ath-text-2xs)] leading-4 text-[var(--ath-muted)] line-clamp-2">{cue.detail}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/book/${ticket.course}/${ticket.chapter}/${ticket.section}`)}
                                                className="editorial-button shrink-0 px-3 py-2 text-[var(--ath-text-xs)]"
                                            >
                                                Open trace
                                            </button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )}

                <section className="grid gap-4 lg:grid-cols-2">
                    <div className="content-card p-5">
                        <h2 className="font-headline text-[var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Weakest concepts</h2>
                        {weakConcepts.length === 0 ? (
                            hasSyncedMastery ? (
                                <EmptyState
                                    className="mt-4"
                                    icon={<Target className="h-6 w-6" />}
                                    title="No weak concepts"
                                    body="All concepts are at 60% mastery or higher. Keep your retention checks current to hold the line."
                                    action={{ label: 'Open a course', onClick: () => navigate('/learn') }}
                                />
                            ) : (
                                <EmptyState
                                    className="mt-4"
                                    icon={<Target className="h-6 w-6" />}
                                    title="Not enough synced evidence yet"
                                    body="Keep answering checks. Your synced learner model has no mastery evidence to show here yet, so this view cannot judge which concepts are weak or strong."
                                    action={{ label: 'Open a course', onClick: () => navigate('/learn') }}
                                />
                            )
                        ) : (
                            <ul className="mt-4 space-y-2">
                                {weakConcepts.map((row) => {
                                    const score = Number(row.mastery_score ?? row.p_known ?? 0)
                                    return (
                                        <li
                                            key={row.concept_id}
                                            className="flex items-center justify-between rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2 transition-colors hover:border-[var(--ath-primary-soft)]"
                                        >
                                            <div>
                                                <p className="text-[var(--ath-text-sm)] font-semibold text-[var(--ath-text)]">{prettify(row.concept_id)}</p>
                                                <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]">
                                                    Mastery <span className="ath-stat">{Math.round(score * 100)}%</span> / attempts <span className="ath-stat">{row.attempts_count || 0}</span>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleConceptOpen(row.concept_id)}
                                                className="editorial-button px-3 py-1 text-[var(--ath-text-xs)]"
                                            >
                                                Review
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}

                        {troubleSpots.length > 0 && (
                            <div className="mt-4 rounded-[var(--ath-radius)] border border-dashed border-[var(--ath-line-strong)] bg-[var(--ath-surface)] p-3">
                                <p className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                    Recent trouble spots (this browser)
                                </p>
                                <p className="mt-1 text-[var(--ath-text-xs)] text-[var(--ath-muted)]">
                                    Based on your recent check answers stored locally on this device — not yet part of your synced learner model.
                                </p>
                                <ul className="mt-2 space-y-2">
                                    {troubleSpots.map((spot) => {
                                        const [spotCourse, spotChapter, spotSection] = String(spot.sectionId).split('/')
                                        const label = spotChapter && spotSection
                                            ? `${prettify(spotCourse)} ${spotChapter}.${spotSection}`
                                            : prettify(spot.sectionId)
                                        return (
                                            <li
                                                key={spot.sectionId}
                                                className="flex items-center justify-between gap-3 rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-[var(--ath-text-sm)] font-semibold text-[var(--ath-text)]">{label}</p>
                                                    <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]">
                                                        <span className="ath-stat">{spot.correct}</span>/<span className="ath-stat">{spot.attempts}</span> correct on recent checks
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/book/${spot.sectionId}`)}
                                                    className="editorial-button shrink-0 px-3 py-1 text-[var(--ath-text-xs)]"
                                                >
                                                    Review
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="content-card p-5">
                        <h2 className="font-headline text-[var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Misconception patterns</h2>
                        {recentMisconceptions.length === 0 ? (
                            <EmptyState
                                className="mt-4"
                                icon={<Flame className="h-6 w-6" />}
                                title="No patterns yet"
                                body="Practice and quizzes surface the misconceptions worth addressing. They will appear here as you work."
                                action={{ label: 'Start practicing', onClick: () => navigate('/learn') }}
                            />
                        ) : (
                            <ul className="mt-4 space-y-2">
                                {recentMisconceptions.map((entry) => (
                                    <li
                                        key={entry.type}
                                        className="rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2 text-[var(--ath-text-sm)]"
                                    >
                                        <p className="font-semibold text-[var(--ath-text)]">{prettify(entry.type)}</p>
                                        <p className="text-[var(--ath-text-xs)] text-[var(--ath-muted)]"><span className="ath-stat">{entry.count}</span> occurrence(s) recently</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="content-card p-5">
                    <h2 className="font-headline text-[var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Strong concepts</h2>
                    {strongConcepts.length === 0 ? (
                        <EmptyState
                            className="mt-4"
                            icon={<BookOpen className="h-6 w-6" />}
                            title="Nothing here yet"
                            body="Practice and retention checks move concepts here once you reach 80% mastery."
                            action={{ label: 'Open a course', onClick: () => navigate('/learn') }}
                        />
                    ) : (
                        <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                            {strongConcepts.map((row) => (
                                <li
                                    key={row.concept_id}
                                    className="rounded-[var(--ath-radius)] border border-[var(--ath-success)] bg-[var(--ath-success-soft)] px-3 py-2 text-[var(--ath-text-sm)] text-[var(--ath-text)]"
                                >
                                    {prettify(row.concept_id)}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                    <CohortLiveMap windowMinutes={5} />
                    <KindredReaders user={user} limit={5} />
                </section>
            </div>
        </div>
    )
}

function prettify(id) {
    return String(id || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatTraceUpdatedAt(value) {
    if (!value) return 'Saved'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Saved'

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    })
}
