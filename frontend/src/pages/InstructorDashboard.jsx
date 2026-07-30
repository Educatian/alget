import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { fetchRctSnapshot } from '../lib/researchService'
import { inviteLearnerToCourse } from '../lib/facultyPartnershipService'
import InstructorInterventionQueue from '../components/InstructorInterventionQueue'
import FacultyPartnershipWorkspace from '../components/FacultyPartnershipWorkspace'

/**
 * Course-scoped instructor view. The route requires a server-issued role and
 * Supabase RLS remains the authority for every course and learner row.
 */
export default function InstructorDashboard({ user }) {
    const navigate = useNavigate()
    const [courses, setCourses] = useState([])
    const [selectedCourseId, setSelectedCourseId] = useState('')
    const [masteryHeatmap, setMasteryHeatmap] = useState([])
    const [strugglers, setStrugglers] = useState([])
    const [rct, setRct] = useState({ interventionOutcomes: [], evaluationGains: [], telemetryProfile: [] })
    const [loading, setLoading] = useState(true)
    const [dataError, setDataError] = useState('')

    useEffect(() => {
        let cancelled = false
        async function loadCourses() {
            setLoading(true)
            setDataError('')
            try {
                const response = await supabase.from('managed_courses').select('course_key, title, status').neq('status', 'archived').order('title')
                if (response.error) throw response.error
                let assigned = response.data || []
                if (user?.id === 'e2e-user' && assigned.length === 0) assigned = [{ course_key: 'e2e-course', title: 'E2E course', status: 'active' }]
                if (!cancelled) {
                    setCourses(assigned)
                    setSelectedCourseId((current) => current || assigned[0]?.course_key || '')
                }
                const snapshot = await fetchRctSnapshot()
                if (!cancelled) setRct(snapshot)
            } catch (error) {
                console.warn('[InstructorDashboard] course assignment load failed:', error)
                if (!cancelled) setDataError(error.message || 'Could not load assigned courses.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadCourses()
        return () => { cancelled = true }
    }, [user?.id])

    useEffect(() => {
        if (!selectedCourseId) {
            setMasteryHeatmap([])
            setStrugglers([])
            return undefined
        }
        let cancelled = false
        async function loadCourseData() {
            setLoading(true)
            setDataError('')
            try {
                const rosterResponse = await supabase.from('cohort_learners').select('user_id, display_name, cohort_label, course_id').eq('course_id', selectedCourseId)
                if (rosterResponse.error) throw rosterResponse.error
                const rosterRows = rosterResponse.data || []
                const learnerIds = rosterRows.map((row) => row.user_id).filter(Boolean)
                let masteryRows = []
                if (learnerIds.length > 0) {
                    const masteryResponse = await supabase.from('mastery').select('user_id, concept_id, mastery_score, p_known, attempts_count').in('user_id', learnerIds).limit(5000)
                    if (masteryResponse.error) throw masteryResponse.error
                    masteryRows = masteryResponse.data || []
                }
                if (!cancelled) {
                    const roster = buildRosterMap(rosterRows)
                    setMasteryHeatmap(buildHeatmap(masteryRows, roster))
                    setStrugglers(buildStrugglers(masteryRows, roster))
                }
            } catch (error) {
                console.warn('[InstructorDashboard] course data load failed:', error)
                if (!cancelled) {
                    setMasteryHeatmap([])
                    setStrugglers([])
                    setDataError(error.message || 'Could not load this course roster.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadCourseData()
        return () => { cancelled = true }
    }, [selectedCourseId])

    const lowMasteryConcepts = useMemo(() => masteryHeatmap.filter((entry) => entry.average < 0.6 && entry.learnerCount >= 3).sort((a, b) => a.average - b.average).slice(0, 10), [masteryHeatmap])
    const cohortInterventionRate = useMemo(() => {
        const outcomes = rct.interventionOutcomes || []
        const total = outcomes.reduce((sum, row) => sum + Number(row.total_closed || 0), 0)
        const positive = outcomes.reduce((sum, row) => sum + Number(row.resolved_positive || 0), 0)
        return total > 0 ? Math.round((positive / total) * 100) : 0
    }, [rct])

    if (loading && courses.length === 0) return <div className="editorial-shell min-h-screen p-8"><p className="text-sm text-[var(--ath-muted)]">Loading assigned courses...</p></div>

    if (courses.length === 0) {
        return (
            <div className="editorial-shell min-h-screen p-6">
                <section className="mx-auto max-w-3xl border-l-2 border-[var(--ath-primary)] pl-5">
                    <p className="editorial-kicker">INSTRUCTOR ACCESS</p>
                    <h1 className="mt-1 font-headline text-2xl font-semibold text-[var(--ath-text)]">No assigned course yet</h1>
                    <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">An administrator must connect your instructor profile to a managed course before learner data can be viewed.</p>
                    {dataError && <p role="alert" className="mt-3 text-sm text-red-700">{dataError}</p>}
                    {['admin', 'course_admin'].includes(user?.app_metadata?.role) && <button type="button" onClick={() => navigate('/admin')} className="editorial-button mt-4 px-4 py-2 text-xs">Open course operations</button>}
                </section>
            </div>
        )
    }

    return (
        <div className="ath-instructor-shell editorial-shell ath-open-layout ath-density-compact min-h-screen p-4 md:p-6">
            <header className="mx-auto max-w-5xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                    <button type="button" onClick={() => navigate(-1)} className="text-[var(--ath-muted)] hover:text-[var(--ath-text)]" aria-label="Go back">← Back</button>
                    <span aria-hidden="true">·</span><span className="uppercase tracking-[0.18em] text-[var(--ath-text)]">Instructor</span><span aria-hidden="true">/</span><span>Cohort heatmap</span>
                    <label className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--ath-muted)]">Course
                        <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="rounded-md border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-2 py-1 text-xs normal-case tracking-normal text-[var(--ath-text)]">
                            {courses.map((item) => <option key={item.course_key} value={item.course_key}>{item.title || item.course_key}</option>)}
                        </select>
                    </label>
                    {['admin', 'course_admin'].includes(user?.app_metadata?.role) && <button type="button" onClick={() => navigate('/admin')} className="text-xs font-medium text-[var(--ath-primary)] underline-offset-4 hover:underline">Course operations</button>}
                    <button type="button" onClick={() => navigate('/analytics')} className="text-xs font-medium text-[var(--ath-muted)] underline-offset-4 hover:text-[var(--ath-text)] hover:underline">Researcher view</button>
                </div>
            </header>

            {dataError && <p role="alert" className="mx-auto mt-3 max-w-5xl border-l-2 border-red-500 pl-3 text-sm text-red-700">{dataError}</p>}
            <section className="mx-auto mt-4 grid max-w-5xl gap-3 md:grid-cols-3">
                <Metric value={`${cohortInterventionRate}%`} label="Intervention success" />
                <Metric value={strugglers.length} label="Learners < 50%" />
                <Metric value={lowMasteryConcepts.length} label="Hot-spot concepts" />
            </section>

            <LearnerInvitePanel courseId={selectedCourseId} />

            <FacultyPartnershipWorkspace courseId={selectedCourseId} hotSpots={lowMasteryConcepts} strugglers={strugglers} rct={rct} />
            <InstructorInterventionQueue user={user} hotSpots={lowMasteryConcepts} courseId={selectedCourseId} />

            <section className="mx-auto mt-5 max-w-5xl border-t border-[var(--ath-line)] pt-4">
                <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold text-[var(--ath-text)]">Learners &lt; 50% average</h2><span className="text-[10px] text-[var(--ath-secondary)]">named when available</span></div>
                {strugglers.length === 0 ? <p className="mt-3 text-xs text-[var(--ath-muted)]">None under threshold.</p> : (
                    <ul className="mt-3 space-y-1 text-xs text-[var(--ath-muted)]">
                        {strugglers.slice(0, 12).map((learner) => <li key={learner.user_id} className="flex justify-between border-b border-[var(--ath-line)] px-1 py-2 last:border-b-0"><span><span className="font-semibold text-[var(--ath-text)]">{learner.displayName || `${learner.user_id.slice(0, 8)}...`}</span>{learner.cohortLabel && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{learner.cohortLabel}</span>}</span><span>{Math.round(learner.average * 100)}% / {learner.conceptCount} concepts</span></li>)}
                    </ul>
                )}
            </section>
        </div>
    )
}

function Metric({ value, label }) {
    return <div className="border-l-2 border-[var(--ath-primary-soft)] px-4 py-2"><p className="text-2xl font-semibold text-[var(--ath-text)]">{value}</p><p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{label}</p></div>
}

function LearnerInvitePanel({ courseId }) {
    const [form, setForm] = useState({ email: '', displayName: '', cohortLabel: '' })
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        setMessage('')
        setError('')
        try {
            await inviteLearnerToCourse({ courseId, ...form })
            setForm({ email: '', displayName: '', cohortLabel: '' })
            setMessage('Invitation sent. The learner will receive a secure account setup email.')
        } catch (inviteError) {
            setError(inviteError.message || 'Could not invite learner.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="mx-auto mt-5 max-w-5xl border-y border-[var(--ath-line)] py-4" aria-labelledby="learner-invite-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="editorial-kicker">COURSE ROSTER</p>
                    <h2 id="learner-invite-title" className="mt-1 text-sm font-semibold text-[var(--ath-text)]">Invite a learner to {courseId}</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">The invitation is limited to this assigned course. Learners receive an email to set up their account.</p>
                </div>
            </div>
            <form onSubmit={submit} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="editorial-input" placeholder="learner@school.edu" aria-label="Learner email" />
                <input required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className="editorial-input" placeholder="Learner name" aria-label="Learner name" />
                <input value={form.cohortLabel} onChange={(event) => setForm({ ...form, cohortLabel: event.target.value })} className="editorial-input" placeholder="Cohort label (optional)" aria-label="Cohort label" />
                <button type="submit" disabled={busy} className="editorial-button px-4 py-2 text-xs">{busy ? 'Sending…' : 'Invite learner'}</button>
            </form>
            {message && <p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}
            {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
        </section>
    )
}

function buildRosterMap(rows = []) { return new Map(rows.map((row) => [row.user_id, row])) }

function buildHeatmap(rows, roster = new Map()) {
    const byConcept = new Map()
    rows.forEach((row) => {
        const score = Number(row.mastery_score ?? row.p_known ?? 0)
        if (!byConcept.has(row.concept_id)) byConcept.set(row.concept_id, { concept_id: row.concept_id, scores: [], userIds: [] })
        const entry = byConcept.get(row.concept_id)
        entry.scores.push(score)
        if (score < 0.6 && row.user_id) entry.userIds.push(row.user_id)
    })
    return Array.from(byConcept.values()).map((entry) => ({ concept_id: entry.concept_id, average: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length, learnerCount: entry.scores.length, userIds: [...new Set(entry.userIds)], courseId: entry.userIds.map((id) => roster.get(id)?.course_id).find(Boolean) || null }))
}

function buildStrugglers(rows, roster = new Map()) {
    const byUser = new Map()
    rows.forEach((row) => {
        const score = Number(row.mastery_score ?? row.p_known ?? 0)
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, { user_id: row.user_id, scores: [] })
        byUser.get(row.user_id).scores.push(score)
    })
    return Array.from(byUser.values()).map((entry) => ({ user_id: entry.user_id, displayName: roster.get(entry.user_id)?.display_name || null, cohortLabel: roster.get(entry.user_id)?.cohort_label || null, courseId: roster.get(entry.user_id)?.course_id || null, average: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length, conceptCount: entry.scores.length })).filter((entry) => entry.average < 0.5 && entry.conceptCount >= 3).sort((a, b) => a.average - b.average)
}
