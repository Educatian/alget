import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowRight, BookOpen, Flame, MessageCircle, NotebookPen, Target } from 'lucide-react'
import { fetchDynamicJson } from '../lib/runtimeContract'
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
import LearnerStudyPlanner from '../components/LearnerStudyPlanner'
import { logEvent } from '../lib/loggingService'
import { LMS_CLASS_CONFIG, LMS_CLASS_EXEMPLAR, buildLmsClassExportJoin, buildLmsFixtureEvents, deriveLmsCoachRecommendation, getLmsClassFixture } from '../lib/lmsClassExemplar'
import { activateLmsParticipant } from '../lib/lmsParticipantRoster'
import { buildLmsQualitativeExport, saveLmsQualitativeArtifact, updateLmsQualitativeArtifact } from '../lib/lmsQualitativeArtifactStore'

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
    const location = useLocation()
    const { recentSection: progressRecentSection } = useCourseProgress(user)
    const routeParams = useMemo(() => new URLSearchParams(location.search), [location.search])
    const fixtureKey = routeParams.get('fixture') || ''
    const fixtureAllowed = import.meta.env.DEV || import.meta.env.VITE_ALGET_DEMO_MODE === 'true' || import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
    const demoFixture = fixtureAllowed ? getLmsClassFixture(fixtureKey) : null
    const contextRecentSection = useMemo(() => {
        const course = routeParams.get('course')
        const section = routeParams.get('section')
        if (!course || !section) return null
        const [chapter, subsection] = section.split('/')
        if (!chapter || !subsection) return null
        return {
            course,
            chapter,
            section: subsection,
            sectionId: `${course}/${chapter}/${subsection}`,
            title: course === LMS_CLASS_EXEMPLAR.courseId && section === '02/08' ? 'Online & Distance Learning Design' : `${course} ${section}`,
        }
    }, [routeParams])
    const recentSection = demoFixture?.recentSection || contextRecentSection || progressRecentSection
    const [masteryRows, setMasteryRows] = useState(() => demoFixture?.masteryRows || [])
    const [snapshot, setSnapshot] = useState(() => demoFixture
        ? { ...getResearchDashboardSnapshot(), learnerMetrics: { ...getResearchDashboardSnapshot().learnerMetrics, dominantMisconceptions: demoFixture.dominantMisconceptions } }
        : getResearchDashboardSnapshot())
    const [retentionDue, setRetentionDue] = useState([])
    const [exitTickets, setExitTickets] = useState(() => demoFixture?.exitTickets || listExitTickets({ limit: 3 }))
    const [loading, setLoading] = useState(true)
    const [streak] = useState(() => getStreak())

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            setLoading(true)
            try {
                if (demoFixture) {
                    try {
                        activateLmsParticipant({
                            participantId: demoFixture.participantId,
                            authUserId: demoFixture.ownerAuthId,
                            synthetic: true,
                        })
                    } catch (error) {
                        console.warn('[StudentDashboard] synthetic roster binding unavailable:', error)
                    }
                    setMasteryRows(demoFixture.masteryRows)
                    setSnapshot({ ...getResearchDashboardSnapshot(), learnerMetrics: { ...getResearchDashboardSnapshot().learnerMetrics, dominantMisconceptions: demoFixture.dominantMisconceptions } })
                    setExitTickets(demoFixture.exitTickets)
                    setRetentionDue([])
                    return
                }
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
    }, [demoFixture, user])

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
    const coachRecommendation = useMemo(
        () => deriveLmsCoachRecommendation({ masteryRows, recentSection, latestExitTicket }),
        [latestExitTicket, masteryRows, recentSection]
    )

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
        () => demoFixture ? [] : getLocalTroubleSpots({ course: recentSection?.course || null }),
        [demoFixture, recentSection?.course]
    )

    const handleConceptOpen = async (conceptId) => {
        // Synthetic class fixtures already pin the reading section. Avoid a
        // network origin lookup so local QA remains deterministic and cannot
        // accidentally navigate into another course.
        if (demoFixture?.recentSection?.sectionId) {
            navigate(`/book/${demoFixture.recentSection.sectionId}`)
            return
        }
        // Best-effort navigation: ask backend which section first introduces
        // this concept. Falls back to the bio-inspired course root.
        try {
            const data = await fetchDynamicJson(`/concept/${encodeURIComponent(conceptId)}/origin`)
            if (data?.section_slug) {
                navigate(`/book/${data.section_slug}`)
                return
            }
        } catch {
            // intentionally ignored
        }
        navigate('/learn')
    }

    if (loading) {
        return (
            <div className="editorial-shell min-h-screen">
                <main className="ath-container py-12">
                    <p className="text-[length:var(--ath-text-sm)] text-[var(--ath-muted)]">Loading your dashboard...</p>
                </main>
            </div>
        )
    }

    const isDemoUser = !user?.id || user.id === '00000000-0000-0000-0000-000000000000'

    return (
        <div className="student-dashboard ath-learner-shell editorial-shell ath-open-layout ath-density-compact min-h-screen">
            <main className="ath-container flex flex-col gap-5 pb-10">
                <header className="pt-5">
                    <div className="flex flex-wrap items-center gap-2 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-secondary)]">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-1 text-[var(--ath-muted)] hover:text-[var(--ath-text)]"
                            aria-label="Go back"
                        >
                            ← Back
                        </button>
                        <span className="text-[var(--ath-line-strong)]">·</span>
                        <h1 className="text-[length:var(--ath-text-xs)] font-semibold uppercase tracking-[0.18em] text-[var(--ath-text)]">Your dashboard</h1>
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
                    <section className="card-surface px-4 py-2.5 text-[length:var(--ath-text-sm)] text-[var(--ath-text)]">
                        <span className="font-semibold text-[var(--ath-info)]">Demo mode</span> / sign in to persist mastery, kindred readers, and retention checks
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="ml-3 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-info)] underline-offset-4 hover:underline"
                        >
                            Sign in
                        </button>
                    </section>
                )}

                {demoFixture && (
                    <section className="card-surface flex flex-wrap items-start justify-between gap-3 px-4 py-3" role="note" data-testid="synthetic-fixture-banner">
                        <div>
                            <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.16em] text-[var(--ath-warning)]">Synthetic QA fixture · not a real learner</p>
                            <p className="mt-1 text-[length:var(--ath-text-sm)] font-semibold text-[var(--ath-text)]">{demoFixture.label}</p>
                            <p className="mt-1 text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">{demoFixture.participantId} · {demoFixture.cohortId} · {demoFixture.sessionId}. Nothing is sent to production or used as an authentication credential.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="editorial-button-secondary px-3 py-2 text-[length:var(--ath-text-2xs)]" onClick={() => navigate('/dashboard?course=inst-design&section=02/08&fixture=intro-lms-weak')}>Load weak evidence</button>
                            <button type="button" className="editorial-button-secondary px-3 py-2 text-[length:var(--ath-text-2xs)]" onClick={() => navigate('/dashboard?course=inst-design&section=02/08&fixture=intro-lms-ready')}>Load ready evidence</button>
                        </div>
                    </section>
                )}

                {retentionDue.length > 0 && (
                    <section className="card-surface px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-warning)]">
                            <span className="uppercase tracking-[0.18em]">Retention due</span>
                            {retentionDue.map((entry) => (
                                <button
                                    key={entry.course}
                                    type="button"
                                    className="rounded-full border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] px-2.5 py-0.5 text-[length:var(--ath-text-2xs)] font-semibold text-[var(--ath-warning)] hover:bg-[var(--ath-warning)] hover:text-[var(--ath-background)]"
                                    onClick={() => navigate(`/diagnostic/${entry.course}?phase=retention`)}
                                >
                                    {entry.course} / 5 min
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <LearnerStudyPlanner
                    user={user}
                    mastery={masteryRows}
                    courseId={recentSection?.course || ''}
                    courseTitle={demoFixture ? LMS_CLASS_CONFIG.course.title : ''}
                />

                <LearnerAnalyticsCoach
                    masteryRows={masteryRows}
                    weakConcepts={weakConcepts}
                    recentSection={recentSection}
                    latestExitTicket={latestExitTicket}
                    onOpenConcept={handleConceptOpen}
                    onOpenRetention={() => navigate(`/diagnostic/${recentSection?.course || LMS_CLASS_EXEMPLAR.courseId}?phase=retention`)}
                    demoFixture={demoFixture}
                    fixtureKey={fixtureKey}
                    coachRecommendation={coachRecommendation}
                />

                <section>
                    <div className="flex flex-wrap items-center gap-2 text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                        <span>Today's focus · 20 min</span>
                        {streak.count > 0 && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] px-2 py-0.5 text-[length:var(--ath-text-2xs)] font-bold text-[var(--ath-warning)]">
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
                                <span className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Review · 5 min</span>
                            </div>
                            {weakConcepts[0] ? (
                                <>
                                    <p className="font-headline text-[length:var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">{prettify(weakConcepts[0].concept_id)}</p>
                                    <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">
                                        <span className="ath-stat">{Math.round(Number(weakConcepts[0].mastery_score ?? weakConcepts[0].p_known ?? 0) * 100)}%</span> mastery · review the section that introduces it
                                    </p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Open section <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">No weak concept right now, keep practicing.</p>
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
                                <span className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Resume · 5 min</span>
                            </div>
                            {recentSection ? (
                                <>
                                    <p className="font-headline text-[length:var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">{recentSection.title || `${recentSection.course} ${recentSection.chapter}.${recentSection.section}`}</p>
                                    <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]"><span className="ath-stat">{recentSection.chapter}.{recentSection.section}</span> · pick up where you left off</p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Continue <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">No recent section. Open a course to get started.</p>
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
                                <span className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Trace · 5 min</span>
                            </div>
                            {latestExitTicket ? (
                                <>
                                    <p className="font-headline text-[length:var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">
                                        {latestExitTicket.title || `${latestExitTicket.course} ${latestExitTicket.chapter}.${latestExitTicket.section}`}
                                    </p>
                                    <p className="text-[length:var(--ath-text-xs)] leading-5 text-[var(--ath-muted)] line-clamp-3">
                                        {latestExitTicket.text}
                                    </p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Reopen trace <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">Write an exit ticket at the end of a section to create a reusable trace.</p>
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
                                <span className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em]">Retention · 5 min</span>
                            </div>
                            {retentionDue[0] ? (
                                <>
                                    <p className="font-headline text-[length:var(--ath-text-lg)] font-semibold text-[var(--ath-text)] line-clamp-2">{prettify(retentionDue[0].course)} check</p>
                                    <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">A delayed probe to lock in last week's learning</p>
                                    <span className="mt-auto inline-flex items-center gap-1 text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-primary)] group-hover:gap-2">
                                        Take check <ArrowRight className="h-3 w-3" />
                                    </span>
                                </>
                            ) : (
                                <p className="mt-auto text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">All retention checks current.</p>
                            )}
                        </button>
                    </div>
                </section>

                {exitTickets.length > 0 && (
                    <section>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Recent learning traces</p>
                                <h2 className="font-headline text-[length:var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Turn reflections into the next study move</h2>
                            </div>
                            <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">
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
                                            <span className="rounded-full border border-[var(--ath-line)] bg-white px-2 py-0.5 text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                                                {ticket.chapter}.{ticket.section}
                                            </span>
                                            <span className="text-right text-[length:var(--ath-text-2xs)] font-semibold text-[var(--ath-muted)]">
                                                {formatTraceUpdatedAt(ticket.updatedAt)}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-headline text-[length:var(--ath-text-lg)] font-semibold leading-tight text-[var(--ath-text)] line-clamp-2">
                                                {title}
                                            </h3>
                                            <p className="mt-2 text-[length:var(--ath-text-xs)] leading-5 text-[var(--ath-muted)] line-clamp-3">
                                                {ticket.text}
                                            </p>
                                        </div>
                                        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-primary)]">{cue.label}</p>
                                                <p className="mt-1 text-[length:var(--ath-text-2xs)] leading-4 text-[var(--ath-muted)] line-clamp-2">{cue.detail}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/book/${ticket.course}/${ticket.chapter}/${ticket.section}`)}
                                                className="editorial-button shrink-0 px-3 py-2 text-[length:var(--ath-text-xs)]"
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
                        <h2 className="font-headline text-[length:var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Weakest concepts</h2>
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
                                                <p className="text-[length:var(--ath-text-sm)] font-semibold text-[var(--ath-text)]">{prettify(row.concept_id)}</p>
                                                <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">
                                                    Mastery <span className="ath-stat">{Math.round(score * 100)}%</span> / attempts <span className="ath-stat">{row.attempts_count || 0}</span>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleConceptOpen(row.concept_id)}
                                                className="editorial-button px-3 py-1 text-[length:var(--ath-text-xs)]"
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
                                <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                    Recent trouble spots (this browser)
                                </p>
                                <p className="mt-1 text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">
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
                                                    <p className="truncate text-[length:var(--ath-text-sm)] font-semibold text-[var(--ath-text)]">{label}</p>
                                                    <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">
                                                        <span className="ath-stat">{spot.correct}</span>/<span className="ath-stat">{spot.attempts}</span> correct on recent checks
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/book/${spot.sectionId}`)}
                                                    className="editorial-button shrink-0 px-3 py-1 text-[length:var(--ath-text-xs)]"
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
                        <h2 className="font-headline text-[length:var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Misconception patterns</h2>
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
                                        className="rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2 text-[length:var(--ath-text-sm)]"
                                    >
                                        <p className="font-semibold text-[var(--ath-text)]">{prettify(entry.type)}</p>
                                        <p className="text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]"><span className="ath-stat">{entry.count}</span> occurrence(s) recently</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="content-card p-5">
                    <h2 className="font-headline text-[length:var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">Strong concepts</h2>
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
                                    className="rounded-[var(--ath-radius)] border border-[var(--ath-success)] bg-[var(--ath-success-soft)] px-3 py-2 text-[length:var(--ath-text-sm)] text-[var(--ath-text)]"
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
            </main>
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

function formatEvidenceTime(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'time not recorded'
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Render agent text as safe plain paragraphs/lists, removing raw Markdown markers. */
function renderCoachResponse(value) {
    const normalized = String(value || '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\binst-design\b/g, LMS_CLASS_CONFIG.course.title)
        .replace(/\binteraction_design\b/g, 'Interaction Design')
        .replace(/\bcommunity_of_inquiry\b/g, 'Community of Inquiry')
        .trim()
    if (!normalized) return null
    return normalized.split(/\n{2,}/).map((block, index) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
        const listLines = lines.filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line))
        if (listLines.length === lines.length && listLines.length > 0) {
            return <ul key={`coach-list-${index}`} className="list-disc space-y-1 pl-5">{listLines.map((line) => <li key={line}>{line.replace(/^(?:[-*]|\d+[.)])\s+/, '')}</li>)}</ul>
        }
        return <p key={`coach-paragraph-${index}`} className="whitespace-pre-wrap">{lines.join('\n')}</p>
    })
}

/**
 * A learner-facing explanation loop for the dashboard. It sends only derived
 * evidence (counts, observed estimates, timestamps, and section identifiers),
 * never private reflection text or raw answers. BigAL can explain the visible
 * evidence and propose one reversible next move; the learner chooses whether
 * to act on it. Learner-authored qualitative text is stored through the
 * separate scoped artifact boundary after an explicit choice.
 */
function LearnerAnalyticsCoach({ masteryRows, weakConcepts, recentSection, latestExitTicket, onOpenConcept, onOpenRetention, demoFixture, fixtureKey, coachRecommendation }) {
    const [question, setQuestion] = useState('What should I do next?')
    const [response, setResponse] = useState('')
    const [source, setSource] = useState('')
    const [loading, setLoading] = useState(false)
    const [decision, setDecision] = useState('')
    const [decisionReason, setDecisionReason] = useState('')
    const [modifiedProposal, setModifiedProposal] = useState('')
    const [reflection, setReflection] = useState('')
    const [decisionSaved, setDecisionSaved] = useState(null)
    const [followUpResult, setFollowUpResult] = useState('')
    const [qualitativeArtifact, setQualitativeArtifact] = useState(() => demoFixture
        ? buildLmsQualitativeExport({ requester: { id: demoFixture.ownerAuthId }, participantId: demoFixture.participantId })[0] || null
        : null)

    const observedConcepts = useMemo(() => masteryRows
        .map((row) => {
            const score = Number(row.mastery_score ?? row.p_known)
            const observedAt = row.last_practiced_at ? `; observed ${formatEvidenceTime(row.last_practiced_at)}` : ''
            return `${prettify(row.concept_id)} — observed estimate ${Number.isFinite(score) ? `${Math.round(score * 100)}%` : 'unavailable'} across ${Number(row.attempts_count || 0)} attempts${observedAt}`
        })
        .join('; '), [masteryRows])

    const reflectionCue = latestExitTicket ? getExitTicketCue(latestExitTicket) : null
    const reflectionSummary = demoFixture?.reflectionSummary
        || (reflectionCue ? `Saved reflection signal: ${reflectionCue.label} — ${reflectionCue.detail}; private prose is not sent to the agent.` : 'No saved reflection trace is available')
    const evidenceAsOf = demoFixture?.evidenceAsOf || masteryRows.map((row) => row.last_practiced_at).filter(Boolean).sort().slice(-1)[0] || null

    const evidenceSummary = useMemo(() => {
        return [
            `Synced concept records: ${masteryRows.length}`,
            observedConcepts ? `Observed concepts: ${observedConcepts}` : 'Observed concepts: none yet',
            `Evidence snapshot: ${evidenceAsOf ? formatEvidenceTime(evidenceAsOf) : 'time not recorded'}`,
            `Saved learning trace: ${reflectionSummary}`,
            `Course context: ${LMS_CLASS_CONFIG.course.title}`,
            `Reading section: ${recentSection?.title || 'current section'}`,
            demoFixture ? `Participant scope: ${demoFixture.participantId} · ${demoFixture.cohortId}` : 'Participant scope: authenticated learner account',
            `Next action derived from these records: ${coachRecommendation.label} — ${coachRecommendation.rationale}`,
        ].join('\n')
    }, [coachRecommendation, demoFixture, evidenceAsOf, masteryRows.length, observedConcepts, recentSection?.title, reflectionSummary])

    const fallback = `${coachRecommendation.rationale} This is a reversible cue based on observed records, not a judgment of ability, emotion, or engagement.`

    const handleSubmit = async (event) => {
        event.preventDefault()
        const trimmed = question.trim()
        if (!trimmed || loading) return
        setLoading(true)
        setResponse('')
        setSource('')
        setDecision('')
        setDecisionReason('')
        setModifiedProposal('')
        setReflection('')
        setDecisionSaved(null)
        setFollowUpResult('')
        logEvent('analytics_coach_request', 'student-dashboard', {
            question_length: trimmed.length,
            synced_concept_count: masteryRows.length,
            weak_concept_count: weakConcepts.length,
            participant_id: demoFixture?.participantId || null,
            cohort_id: demoFixture?.cohortId || null,
        }, recentSection?.course ? `${recentSection.course}/dashboard` : null)

        try {
            const data = await fetchDynamicJson('/orchestrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `${trimmed}\n\nYou are the learner-facing analytics coach for ${LMS_CLASS_CONFIG.course.title}. Explain only the observed records below. Use the human course title and concept names, not machine IDs. State that scores are observed estimates with limits; never claim mastery, ability, emotion, or engagement. Recommend exactly this one reversible action, because it is derived from the records: ${coachRecommendation.label}. Do not substitute a generic review/new-material question. Return plain paragraphs and bullets without Markdown emphasis markers.\n${evidenceSummary}`,
                    current_content: evidenceSummary,
                    course: recentSection?.course || 'general',
                    course_title: LMS_CLASS_CONFIG.course.title,
                    section_id: recentSection?.sectionId || null,
                    history: [],
                }),
            })
            if (!data?.text) throw new Error('analytics_coach_empty_response')
            // Anchor synthetic responses to the actual observed records and
            // derived recommendation. This is not a fixture-name prefix: it
            // is computed from scores, attempts, timestamps, and trace state.
            const boundedResponse = demoFixture
                ? `${data.text.trim()}\n\nEvidence anchor · ${coachRecommendation.rationale}`
                : data.text
            setResponse(boundedResponse)
            setSource('BigAL · evidence-grounded explanation')
            logEvent('analytics_coach_response', 'student-dashboard', {
                response_length: String(boundedResponse).length,
                used_synced_evidence: masteryRows.length > 0,
                participant_id: demoFixture?.participantId || null,
                cohort_id: demoFixture?.cohortId || null,
            }, recentSection?.course ? `${recentSection.course}/dashboard` : null)
            if (demoFixture) {
                try {
                    sessionStorage.setItem(`alget:lms-fixture-trace:${fixtureKey}`, JSON.stringify({
                        fixture: fixtureKey,
                        participant_id: demoFixture.participantId,
                        participant_key: demoFixture.participantKey,
                        cohort_id: demoFixture.cohortId,
                        session_id: demoFixture.sessionId,
                        recommendation: coachRecommendation.id,
                        events: buildLmsClassExportJoin(buildLmsFixtureEvents(fixtureKey)),
                    }))
                } catch {
                    // Session storage is a convenience for local QA only.
                }
            }
        } catch (error) {
            console.warn('[StudentDashboard] analytics coach unavailable:', error)
            const boundedFallback = fallback
            setResponse(boundedFallback)
            setSource('Local evidence cue · AI unavailable')
        } finally {
            setLoading(false)
        }
    }

    const handleDecisionSave = () => {
        const safeReasonLength = decisionReason.trim().length
        if (!decision || safeReasonLength < 10 || !response || (demoFixture && reflection.trim().length < 10) || (demoFixture && decision === 'modify' && modifiedProposal.trim().length < 10)) return
        const nextAction = decision === 'decline' ? 'no_action' : coachRecommendation.id
        const sectionId = recentSection?.sectionId || LMS_CLASS_EXEMPLAR.sectionPath
        const eventData = {
            decision,
            reason_length: safeReasonLength,
            next_action: nextAction,
            participant_id: demoFixture?.participantId || null,
            cohort_id: demoFixture?.cohortId || null,
            synthetic_fixture: Boolean(demoFixture),
        }
        logEvent('analytics_coach_decision', 'student-dashboard', eventData, sectionId)
        let joined = null
        let artifact = null
        if (demoFixture) {
            artifact = saveLmsQualitativeArtifact({
                ownerAuthId: demoFixture.ownerAuthId,
                participantId: demoFixture.participantId,
                courseId: demoFixture.courseId,
                cohortId: demoFixture.cohortId,
                sessionId: demoFixture.sessionId,
                sectionId,
                decision,
                reasonText: decisionReason,
                modifiedProposalText: modifiedProposal,
                reflectionText: reflection,
                previousEvidence: {
                    as_of: evidenceAsOf,
                    concepts: masteryRows.map((row) => ({ concept_id: row.concept_id, observed_score: Number(row.mastery_score ?? row.p_known), attempts: Number(row.attempts_count || 0), observed_at: row.last_practiced_at || null })),
                    saved_trace: Boolean(latestExitTicket),
                    recommendation: { id: coachRecommendation.id, rationale: coachRecommendation.rationale },
                },
                followUp: { next_action: nextAction, result: 'pending' },
                synthetic: true,
            })
            setQualitativeArtifact(artifact)
            const rows = buildLmsClassExportJoin(buildLmsFixtureEvents(fixtureKey, decision, safeReasonLength, artifact.artifact_id))
            joined = rows[rows.length - 2] || null
            try {
                sessionStorage.setItem(`alget:lms-fixture-trace:${fixtureKey}`, JSON.stringify({
                    fixture: fixtureKey,
                    participant_id: demoFixture.participantId,
                    participant_key: demoFixture.participantKey,
                    cohort_id: demoFixture.cohortId,
                    session_id: demoFixture.sessionId,
                    qualitative_artifact_id: artifact.artifact_id,
                    events: rows,
                }))
            } catch {
                // Session storage is a convenience for local QA only.
            }
        }
        setDecisionSaved({ decision, reasonLength: safeReasonLength, nextAction, joined, artifactId: artifact?.artifact_id || null })
    }

    const handleFollowUp = () => {
        if (!decisionSaved) return
        if (decisionSaved.decision === 'decline') {
            setFollowUpResult('Follow-up skipped: you declined this suggestion.')
            logEvent('analytics_coach_follow_up', 'student-dashboard', {
                next_action: 'no_action',
                result: 'declined',
                participant_id: demoFixture?.participantId || null,
                cohort_id: demoFixture?.cohortId || null,
            }, recentSection?.sectionId || LMS_CLASS_EXEMPLAR.sectionPath)
            if (demoFixture && qualitativeArtifact) {
                const updatedArtifact = updateLmsQualitativeArtifact(qualitativeArtifact.artifact_id, {
                    ownerAuthId: demoFixture.ownerAuthId,
                    followUp: { next_action: 'no_action', result: 'declined' },
                })
                if (updatedArtifact) setQualitativeArtifact(buildLmsQualitativeExport({ requester: { id: demoFixture.ownerAuthId }, participantId: demoFixture.participantId })[0] || updatedArtifact)
                try {
                    sessionStorage.setItem(`alget:lms-fixture-trace:${fixtureKey}`, JSON.stringify({
                        fixture: fixtureKey,
                        participant_id: demoFixture.participantId,
                        participant_key: demoFixture.participantKey,
                        cohort_id: demoFixture.cohortId,
                        session_id: demoFixture.sessionId,
                        qualitative_artifact_id: qualitativeArtifact.artifact_id,
                        events: buildLmsClassExportJoin(buildLmsFixtureEvents(fixtureKey, 'decline', decisionSaved.reasonLength, qualitativeArtifact.artifact_id)),
                    }))
                } catch {
                    // Session storage is a convenience for local QA only.
                }
            }
            return
        }
        const nextAction = coachRecommendation.id
        const result = nextAction === 'review_weakest_concept' ? `Follow-up opened: ${recentSection?.title || 'the selected reading section'}` : nextAction === 'retention_check' ? 'Follow-up queued: retention check' : 'Follow-up queued: evidence check'
        setFollowUpResult(result)
        logEvent('analytics_coach_follow_up', 'student-dashboard', {
            next_action: nextAction,
            result: weakConcepts[0] ? 'opened' : 'queued',
            participant_id: demoFixture?.participantId || null,
            cohort_id: demoFixture?.cohortId || null,
        }, recentSection?.sectionId || LMS_CLASS_EXEMPLAR.sectionPath)
        if (demoFixture) {
            try {
                const updatedArtifact = qualitativeArtifact
                    ? updateLmsQualitativeArtifact(qualitativeArtifact.artifact_id, {
                        ownerAuthId: demoFixture.ownerAuthId,
                        followUp: { next_action: nextAction, result: weakConcepts[0] ? 'opened' : 'queued' },
                    })
                    : null
                if (updatedArtifact) setQualitativeArtifact(buildLmsQualitativeExport({ requester: { id: demoFixture.ownerAuthId }, participantId: demoFixture.participantId })[0] || updatedArtifact)
                const existing = buildLmsFixtureEvents(fixtureKey, decisionSaved?.decision || 'accept', decisionSaved?.reasonLength || 0, qualitativeArtifact?.artifact_id)
                sessionStorage.setItem(`alget:lms-fixture-trace:${fixtureKey}`, JSON.stringify({
                    fixture: fixtureKey,
                    participant_id: demoFixture.participantId,
                    participant_key: demoFixture.participantKey,
                    cohort_id: demoFixture.cohortId,
                    session_id: demoFixture.sessionId,
                    qualitative_artifact_id: qualitativeArtifact?.artifact_id || null,
                    events: buildLmsClassExportJoin(existing),
                }))
            } catch {
                // Session storage is a convenience for local QA only.
            }
        }
        // In a synthetic fixture keep the dashboard mounted so QA can inspect
        // the completed result and export link before opening the activity.
        if (!demoFixture) {
            if (weakConcepts[0]) onOpenConcept(weakConcepts[0].concept_id)
            else onOpenRetention()
        }
    }

    return (
        <section className="content-card p-5" aria-labelledby="analytics-coach-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Evidence → next move</p>
                    <h2 id="analytics-coach-title" className="mt-1 flex items-center gap-2 font-headline text-[length:var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">
                        <MessageCircle className="h-5 w-5 text-[var(--ath-primary)]" aria-hidden="true" />
                        Ask about my learning evidence
                    </h2>
                </div>
                <p className="max-w-md text-right text-[length:var(--ath-text-xs)] leading-5 text-[var(--ath-muted)]">
                    Uses your synced checks and saved trace metadata only. It does not infer ability, emotion, or engagement from clicks.
                </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="rounded-[var(--ath-radius)] bg-[var(--ath-panel)] p-3">
                    <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Evidence in view</p>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-[length:var(--ath-text-xs)] leading-5 text-[var(--ath-text)]">{evidenceSummary}</pre>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <label htmlFor="analytics-coach-question" className="text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-text)]">Your question</label>
                    <textarea
                        id="analytics-coach-question"
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        rows={3}
                        maxLength={240}
                        className="min-h-20 resize-y rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-2 text-[length:var(--ath-text-sm)] text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                    />
                    <button type="submit" disabled={loading || !question.trim()} className="editorial-button inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[length:var(--ath-text-xs)]">
                        {loading ? 'Reading evidence…' : 'Explain and suggest one move'}
                    </button>
                </form>
            </div>

            {qualitativeArtifact && (
                <div className="mt-3 rounded-[var(--ath-radius)] border border-dashed border-[var(--ath-line-strong)] bg-[var(--ath-panel)] px-3 py-2 text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]" role="status" data-testid="qualitative-artifact-status">
                    Previous qualitative artifact restored for this local fixture · decision <span className="font-semibold text-[var(--ath-text)]">{qualitativeArtifact.decision}</span> · {qualitativeArtifact.reflection_text ? 'reflection saved' : 'reflection pending'} · private text is available only through the approved scoped export.
                </div>
            )}

            {response && (
                <div className="mt-4 rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4" role="status" aria-live="polite">
                    <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{source}</p>
                    <div className="mt-2 text-[length:var(--ath-text-sm)] leading-6 text-[var(--ath-text)]">{renderCoachResponse(response)}</div>
                    <div className="mt-4 rounded-[var(--ath-radius)] bg-[var(--ath-panel)] p-3">
                        <p className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Your choice</p>
                        <p className="mt-1 text-[length:var(--ath-text-xs)] text-[var(--ath-muted)]">Keep control: accept, modify, or decline the suggested next move. {demoFixture ? 'Your reason, revision, and reflection stay in a separate approved qualitative artifact; general telemetry receives only bounded metadata.' : 'Qualitative capture is gated until the course/research owner enables an approved artifact store; this live view records only bounded decision metadata.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Agent suggestion decision">
                            {[
                                ['accept', 'Accept suggestion'],
                                ['modify', 'Modify suggestion'],
                                ['decline', 'Decline suggestion'],
                            ].map(([value, label]) => (
                                <button key={value} type="button" aria-pressed={decision === value} onClick={() => setDecision(value)} className={decision === value ? 'editorial-button px-3 py-2 text-[length:var(--ath-text-xs)]' : 'editorial-button-secondary px-3 py-2 text-[length:var(--ath-text-xs)]'}>{label}</button>
                            ))}
                        </div>
                        <label htmlFor="analytics-coach-decision-reason" className="mt-3 block text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-text)]">Why this choice?</label>
                        <textarea
                            id="analytics-coach-decision-reason"
                            value={decisionReason}
                            onChange={(event) => setDecisionReason(event.target.value)}
                            rows={2}
                            maxLength={240}
                            placeholder="At least 10 characters; not copied to general telemetry."
                            className="mt-1 min-h-16 w-full resize-y rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-2 text-[length:var(--ath-text-sm)] text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                        />
                        {demoFixture && decision === 'modify' && (
                            <>
                                <label htmlFor="analytics-coach-modified-proposal" className="mt-3 block text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-text)]">Your modified next move</label>
                                <textarea id="analytics-coach-modified-proposal" value={modifiedProposal} onChange={(event) => setModifiedProposal(event.target.value)} rows={2} maxLength={240} placeholder="Write the action you will actually try." className="mt-1 min-h-16 w-full resize-y rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-2 text-[length:var(--ath-text-sm)] text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]" />
                            </>
                        )}
                        {demoFixture && <>
                            <label htmlFor="analytics-coach-reflection" className="mt-3 block text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-text)]">Short reflection</label>
                            <textarea id="analytics-coach-reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} rows={2} maxLength={480} placeholder="What did this evidence clarify or leave uncertain?" className="mt-1 min-h-16 w-full resize-y rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-2 text-[length:var(--ath-text-sm)] text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]" />
                        </>}
                        <button type="button" onClick={handleDecisionSave} disabled={!decision || decisionReason.trim().length < 10 || (demoFixture && reflection.trim().length < 10) || (demoFixture && decision === 'modify' && modifiedProposal.trim().length < 10)} className="editorial-button-secondary mt-2 px-3 py-2 text-[length:var(--ath-text-xs)]">Save decision</button>
                        {decisionSaved && (
                            <p className="mt-2 text-[length:var(--ath-text-xs)] text-[var(--ath-success)]" role="status">Decision recorded: {decisionSaved.decision}. Qualitative artifact linked: {decisionSaved.artifactId || 'not enabled for this account'}. General export keeps reason length ({decisionSaved.reasonLength}) only; {decisionSaved.artifactId ? `qualitative export retains the reason, ${decisionSaved.decision === 'modify' ? 'modified proposal, ' : ''}and reflection under its access boundary.` : 'qualitative text is not stored until an approved course/research gate is enabled.'} Next action: {decisionSaved.nextAction}. {decisionSaved.joined ? `Behavior join: ${decisionSaved.joined.event_type} · ${decisionSaved.joined.participant_id} · ${decisionSaved.joined.cohort_id}.` : 'Behavior join will use your authenticated account scope.'}</p>
                        )}
                        <button type="button" onClick={handleFollowUp} disabled={!decisionSaved} className="editorial-button mt-3 px-3 py-2 text-[length:var(--ath-text-xs)] disabled:cursor-not-allowed disabled:opacity-50">{decisionSaved?.decision === 'decline' ? 'Keep suggestion declined' : coachRecommendation.label}</button>
                        {followUpResult && <>
                            <p className="mt-2 text-[length:var(--ath-text-xs)] text-[var(--ath-primary)]" role="status">{followUpResult}</p>
                            {demoFixture && decisionSaved?.decision !== 'decline' && <button type="button" onClick={() => coachRecommendation.id === 'review_weakest_concept' ? onOpenConcept(weakConcepts[0]?.concept_id) : onOpenRetention()} className="editorial-button-secondary mt-2 px-3 py-2 text-[length:var(--ath-text-xs)]">Open follow-up activity</button>}
                        </>}
                    </div>
                </div>
            )}
        </section>
    )
}
