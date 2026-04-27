import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchRctSnapshot } from '../lib/researchService'

/**
 * InstructorDashboard — cohort-level view for instructors. Shows where the
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
                const { data: rows } = await supabase
                    .from('mastery')
                    .select('user_id, concept_id, mastery_score, p_known, attempts_count')
                    .limit(5000)
                if (!cancelled && rows) {
                    setMasteryHeatmap(buildHeatmap(rows))
                    setStrugglers(buildStrugglers(rows))
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
        <div className="editorial-shell min-h-screen p-8">
            <header className="mx-auto max-w-5xl">
                <p className="editorial-kicker">Instructor view</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                    Cohort heatmap and intervention surface
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">
                    Where the class is collectively under-performing. Use this view to identify which
                    concepts to re-teach in the next session and which learners may need a direct check-in.
                    Researcher access is at <button type="button" onClick={() => navigate('/analytics')} className="underline">/analytics</button>.
                </p>
            </header>

            <section className="mx-auto mt-6 grid max-w-5xl gap-6 md:grid-cols-3">
                <div className="editorial-surface p-5">
                    <p className="editorial-kicker">Cohort intervention success</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{cohortInterventionRate}%</p>
                    <p className="text-xs text-[var(--ath-muted)]">of closed intervention traces resolved positively</p>
                </div>
                <div className="editorial-surface p-5">
                    <p className="editorial-kicker">Learners needing attention</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{strugglers.length}</p>
                    <p className="text-xs text-[var(--ath-muted)]">with average mastery below 50%</p>
                </div>
                <div className="editorial-surface p-5">
                    <p className="editorial-kicker">Low-mastery concepts</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{lowMasteryConcepts.length}</p>
                    <p className="text-xs text-[var(--ath-muted)]">where 3+ learners scored below 60%</p>
                </div>
            </section>

            <section className="mx-auto mt-8 max-w-5xl rounded-2xl border border-[var(--ath-line)] bg-white/70 p-6">
                <p className="editorial-kicker">Concept hot-spots</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--ath-text)]">Where to re-teach next session</h2>
                {lowMasteryConcepts.length === 0 ? (
                    <p className="mt-4 text-sm text-[var(--ath-muted)]">
                        No concept has cohort-wide low mastery. The class is broadly tracking the curriculum.
                    </p>
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
                                        {entry.learnerCount} learners · cohort avg {Math.round(entry.average * 100)}%
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

            <section className="mx-auto mt-8 max-w-5xl rounded-2xl border border-[var(--ath-line)] bg-white/70 p-6">
                <p className="editorial-kicker">Learners needing attention</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--ath-text)]">Below 50% average mastery</h2>
                {strugglers.length === 0 ? (
                    <p className="mt-4 text-sm text-[var(--ath-muted)]">No learners under the threshold currently.</p>
                ) : (
                    <ul className="mt-4 space-y-1 text-sm text-[var(--ath-muted)]">
                        {strugglers.slice(0, 12).map((s) => (
                            <li key={s.user_id} className="flex justify-between rounded-lg bg-white/70 px-3 py-2">
                                <span className="font-mono text-xs">{s.user_id.slice(0, 8)}...</span>
                                <span>avg {Math.round(s.average * 100)}% across {s.conceptCount} concepts</span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-3 text-xs text-[var(--ath-muted)]">
                    User IDs are anonymized; consult roster to map to names. Action options: targeted check-in,
                    office-hours invite, or supplementary practice assignment.
                </p>
            </section>
        </div>
    )
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

function buildStrugglers(rows) {
    const byUser = new Map()
    rows.forEach((row) => {
        const score = Number(row.mastery_score ?? row.p_known ?? 0)
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, { user_id: row.user_id, scores: [] })
        byUser.get(row.user_id).scores.push(score)
    })
    return Array.from(byUser.values())
        .map((entry) => ({
            user_id: entry.user_id,
            average: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
            conceptCount: entry.scores.length,
        }))
        .filter((entry) => entry.average < 0.5 && entry.conceptCount >= 3)
        .sort((a, b) => a.average - b.average)
}

function prettify(id) {
    return String(id || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
