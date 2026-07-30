import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { fetchRctSnapshot } from '../lib/researchService'
import InstructorInterventionQueue from '../components/InstructorInterventionQueue'

/**
 * InstructorDashboard - cohort-level view for instructors. Shows where the
 * class is collectively struggling, who needs attention, and which concepts
 * are surfacing the most stuck events. Distinct from /analytics (researcher)
 * and /dashboard (individual learner).
 *
 * Gated behind 'alget_instructor_access' or 'alget_researcher_access' session
 * flag. Falls back to /analytics for unlock.
 */
export default function InstructorDashboard({ user }) {
    const navigate = useNavigate()
    const [masteryHeatmap, setMasteryHeatmap] = useState([])
    const [strugglers, setStrugglers] = useState([])
    const [rct, setRct] = useState({ interventionOutcomes: [], evaluationGains: [], telemetryProfile: [] })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                // Cap at 5000 rows. A real cohort of 200 learners × 50 concepts
                // = 10K rows; for now, hot-spot detection on the first 5K is
                // representative. If pagination becomes a real need, replace
                // with a SQL view that pre-aggregates server-side.
                const [masteryResponse, rosterResponse] = await Promise.all([
                    supabase
                    .from('mastery')
                    .select('user_id, concept_id, mastery_score, p_known, attempts_count')
                    .limit(5000),
                    supabase
                        .from('cohort_learners')
                        .select('user_id, display_name, cohort_label, course_id')
                ])
                const rows = masteryResponse?.data || []
                const roster = buildRosterMap(rosterResponse?.data || [])
                if (!cancelled && rows) {
                    setMasteryHeatmap(buildHeatmap(rows, roster))
                    setStrugglers(buildStrugglers(rows, roster))
                }
                const snap = await fetchRctSnapshot()
                if (!cancelled) setRct(snap)
            } catch (error) {
                console.warn('[InstructorDashboard] load failed:', error)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    const lowMasteryConcepts = useMemo(
        () => masteryHeatmap
            .filter((entry) => entry.average < 0.6 && entry.learnerCount >= 3)
            .sort((a, b) => a.average - b.average)
            .slice(0, 10),
        [masteryHeatmap]
    )

    const cohortInterventionRate = useMemo(() => {
        const outcomes = rct.interventionOutcomes || []
        const total = outcomes.reduce((sum, row) => sum + Number(row.total_closed || 0), 0)
        const positive = outcomes.reduce((sum, row) => sum + Number(row.resolved_positive || 0), 0)
        return total > 0 ? Math.round((positive / total) * 100) : 0
    }, [rct])

    const cohortCourseId = useMemo(
        () => strugglers.find((entry) => entry.courseId)?.courseId || user?.user_metadata?.course_id || 'cohort',
        [strugglers, user?.user_metadata?.course_id],
    )

    if (loading) {
        return (
            <div className="editorial-shell min-h-screen p-8">
                <p className="text-sm text-[var(--ath-muted)]">Loading cohort data...</p>
            </div>
        )
    }

    return (
        <div className="editorial-shell ath-open-layout ath-density-compact min-h-screen p-4 md:p-6">
            <header className="mx-auto max-w-5xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-1 text-[var(--ath-muted)] hover:text-[var(--ath-text)]"
                        aria-label="Go back"
                    >
                        ← Back
                    </button>
                    <span className="text-[var(--ath-line-strong)]">·</span>
                    <span className="text-[var(--ath-text)] uppercase tracking-[0.18em]">Instructor</span>
                    <span className="text-[var(--ath-line-strong)]">/</span>
                    <span>Cohort heatmap</span>
                    {['admin', 'course_admin'].includes(user?.app_metadata?.role) && (
                        <button
                            type="button"
                            onClick={() => navigate('/admin')}
                            className="ml-auto text-xs font-medium text-[var(--ath-primary)] underline-offset-4 hover:underline"
                        >
                            Course operations
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => navigate('/analytics')}
                        className="text-xs font-medium text-[var(--ath-muted)] underline-offset-4 hover:text-[var(--ath-text)] hover:underline"
                    >
                        Researcher view
                    </button>
                </div>
            </header>

            <section className="mx-auto mt-4 grid max-w-5xl gap-3 md:grid-cols-3">
                <div className="border-l-2 border-[var(--ath-primary-soft)] px-4 py-2">
                    <p className="text-2xl font-semibold text-[var(--ath-text)]">{cohortInterventionRate}%</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Intervention success</p>
                </div>
                <div className="border-l-2 border-[var(--ath-primary-soft)] px-4 py-2">
                    <p className="text-2xl font-semibold text-[var(--ath-text)]">{strugglers.length}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Learners &lt; 50%</p>
                </div>
                <div className="border-l-2 border-[var(--ath-primary-soft)] px-4 py-2">
                    <p className="text-2xl font-semibold text-[var(--ath-text)]">{lowMasteryConcepts.length}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Hot-spot concepts</p>
                </div>
            </section>

            <InstructorInterventionQueue
                user={user}
                hotSpots={lowMasteryConcepts}
                courseId={cohortCourseId}
            />

            <section className="mx-auto mt-5 max-w-5xl border-t border-[var(--ath-line)] pt-4">
                <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-[var(--ath-text)]">Learners &lt; 50% average</h2>
                    <span className="text-[10px] text-[var(--ath-secondary)]" title="Named CAT cohort rows come from the current-student entry form.">named when available</span>
                </div>
                {strugglers.length === 0 ? (
                    <p className="mt-3 text-xs text-[var(--ath-muted)]">None under threshold.</p>
                ) : (
                    <ul className="mt-3 space-y-1 text-xs text-[var(--ath-muted)]">
                        {strugglers.slice(0, 12).map((s) => (
                            <li key={s.user_id} className="flex justify-between border-b border-[var(--ath-line)] px-1 py-2 last:border-b-0">
                                <span>
                                    <span className="font-semibold text-[var(--ath-text)]">{s.displayName || `${s.user_id.slice(0, 8)}...`}</span>
                                    {s.cohortLabel && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{s.cohortLabel}</span>}
                                </span>
                                <span>{Math.round(s.average * 100)}% / {s.conceptCount} concepts</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

function buildRosterMap(rows = []) {
    return new Map(rows.map((row) => [row.user_id, row]))
}

function buildHeatmap(rows, roster = new Map()) {
    const byConcept = new Map()
    rows.forEach((row) => {
        const score = Number(row.mastery_score ?? row.p_known ?? 0)
        const key = row.concept_id
        if (!byConcept.has(key)) byConcept.set(key, { concept_id: key, scores: [], userIds: [] })
        const entry = byConcept.get(key)
        entry.scores.push(score)
        if (score < 0.6 && row.user_id) entry.userIds.push(row.user_id)
    })
    return Array.from(byConcept.values()).map((entry) => ({
        concept_id: entry.concept_id,
        average: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
        learnerCount: entry.scores.length,
        userIds: [...new Set(entry.userIds)],
        courseId: entry.userIds.map((userId) => roster.get(userId)?.course_id).find(Boolean) || null,
    }))
}

function buildStrugglers(rows, roster = new Map()) {
    const byUser = new Map()
    rows.forEach((row) => {
        const score = Number(row.mastery_score ?? row.p_known ?? 0)
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, { user_id: row.user_id, scores: [] })
        byUser.get(row.user_id).scores.push(score)
    })
    return Array.from(byUser.values())
        .map((entry) => ({
            user_id: entry.user_id,
            displayName: roster.get(entry.user_id)?.display_name || null,
            cohortLabel: roster.get(entry.user_id)?.cohort_label || null,
            courseId: roster.get(entry.user_id)?.course_id || null,
            average: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
            conceptCount: entry.scores.length,
        }))
        .filter((entry) => entry.average < 0.5 && entry.conceptCount >= 3)
        .sort((a, b) => a.average - b.average)
}
