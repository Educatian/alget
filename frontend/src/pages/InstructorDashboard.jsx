import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchRctSnapshot } from '../lib/researchService'

/**
 * InstructorDashboard - cohort-level view for instructors. Shows where the
 * class is collectively struggling, who needs attention, and which concepts
 * are surfacing the most stuck events. Distinct from /analytics (researcher)
 * and /dashboard (individual learner).
 *
 * Gated behind 'alget_instructor_access' or 'alget_researcher_access' session
 * flag. Falls back to /analytics for unlock.
 */
export default function InstructorDashboard() {
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
                    setMasteryHeatmap(buildHeatmap(rows))
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

    if (loading) {
        return (
            <div className="editorial-shell min-h-screen p-8">
                <p className="text-sm text-[var(--ath-muted)]">Loading cohort data...</p>
            </div>
        )
    }

    return (
        <div className="editorial-shell min-h-screen p-6 md:p-8">
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
                    <button
                        type="button"
                        onClick={() => navigate('/analytics')}
                        className="ml-auto text-xs font-medium text-[var(--ath-muted)] underline-offset-4 hover:text-[var(--ath-text)] hover:underline"
                    >
                        Researcher view
                    </button>
                </div>
            </header>

            <section className="mx-auto mt-4 grid max-w-5xl gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--ath-line)] bg-white/85 p-4 shadow-sm">
                    <p className="text-2xl font-semibold text-[var(--ath-text)]">{cohortInterventionRate}%</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Intervention success</p>
                </div>
                <div className="rounded-2xl border border-[var(--ath-line)] bg-white/85 p-4 shadow-sm">
                    <p className="text-2xl font-semibold text-[var(--ath-text)]">{strugglers.length}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Learners &lt; 50%</p>
                </div>
                <div className="rounded-2xl border border-[var(--ath-line)] bg-white/85 p-4 shadow-sm">
                    <p className="text-2xl font-semibold text-[var(--ath-text)]">{lowMasteryConcepts.length}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Hot-spot concepts</p>
                </div>
            </section>

            <section className="mx-auto mt-4 max-w-5xl rounded-2xl border border-[var(--ath-line)] bg-white/85 p-5">
                <h2 className="text-sm font-semibold text-[var(--ath-text)]">Concept hot-spots / re-teach next session</h2>
                {lowMasteryConcepts.length === 0 ? (
                    <p className="mt-3 text-xs text-[var(--ath-muted)]">No cohort-wide low mastery - class on track.</p>
                ) : (
                    <ul className="mt-4 space-y-2">
                        {lowMasteryConcepts.map((entry) => (
                            <li
                                key={entry.concept_id}
                                className="flex items-center justify-between rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-[var(--ath-text)]">{prettify(entry.concept_id)}</p>
                                    <p className="text-xs text-[var(--ath-muted)]">
                                        {entry.learnerCount} learners / cohort avg {Math.round(entry.average * 100)}%
                                    </p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    entry.average < 0.4 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {entry.average < 0.4 ? 'urgent' : 'monitor'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mx-auto mt-4 max-w-5xl rounded-2xl border border-[var(--ath-line)] bg-white/85 p-5">
                <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-[var(--ath-text)]">Learners &lt; 50% average</h2>
                    <span className="text-[10px] text-[var(--ath-secondary)]" title="Named CAT cohort rows come from the current-student entry form.">named when available</span>
                </div>
                {strugglers.length === 0 ? (
                    <p className="mt-3 text-xs text-[var(--ath-muted)]">None under threshold.</p>
                ) : (
                    <ul className="mt-3 space-y-1 text-xs text-[var(--ath-muted)]">
                        {strugglers.slice(0, 12).map((s) => (
                            <li key={s.user_id} className="flex justify-between rounded-lg bg-white/70 px-2.5 py-1.5">
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

function buildHeatmap(rows) {
    const byConcept = new Map()
    rows.forEach((row) => {
        const score = Number(row.mastery_score ?? row.p_known ?? 0)
        const key = row.concept_id
        if (!byConcept.has(key)) byConcept.set(key, { concept_id: key, scores: [] })
        byConcept.get(key).scores.push(score)
    })
    return Array.from(byConcept.values()).map((entry) => ({
        concept_id: entry.concept_id,
        average: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
        learnerCount: entry.scores.length,
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

function prettify(id) {
    return String(id || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
