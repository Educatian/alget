import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, PauseCircle, ShieldCheck, Target } from 'lucide-react'
import { ALL_COURSE_IDS } from '../lib/courseCatalog'
import { draftLearnerPlan, loadLearnerPlans, reviewLearnerPlan } from '../lib/agenticLmsService'

function defaultTargetDate() {
    const value = new Date()
    value.setDate(value.getDate() + 7)
    return value.toISOString().slice(0, 10)
}

export default function LearnerStudyPlanner({ user, mastery = [], courseId = '' }) {
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [form, setForm] = useState({
        courseId: courseId || ALL_COURSE_IDS[0],
        title: '',
        targetDate: defaultTargetDate(),
        targetMastery: 0.8,
        weeklyMinutes: 180,
    })

    useEffect(() => {
        let cancelled = false
        loadLearnerPlans(user?.id)
            .then((rows) => { if (!cancelled) setPlans(rows) })
            .catch((nextError) => { if (!cancelled) setError(nextError.message) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [user?.id])

    const currentPlan = useMemo(
        () => plans.find((plan) => ['awaiting_approval', 'active', 'paused'].includes(plan.status)) || plans[0],
        [plans],
    )

    const createPlan = async (event) => {
        event.preventDefault()
        setBusy('draft')
        setError('')
        try {
            const created = await draftLearnerPlan({
                userId: user?.id || 'demo-learner',
                courseId: form.courseId,
                title: form.title.trim(),
                targetDate: form.targetDate,
                targetMastery: form.targetMastery,
                weeklyMinutes: form.weeklyMinutes,
                mastery,
            })
            setPlans((rows) => [created, ...rows])
            setForm((current) => ({ ...current, title: '' }))
        } catch (nextError) {
            setError(nextError.message || 'Could not draft the plan')
        } finally {
            setBusy('')
        }
    }

    const review = async (decision) => {
        if (!currentPlan) return
        setBusy(decision)
        setError('')
        try {
            const updated = await reviewLearnerPlan(currentPlan.id, decision, user?.id || 'demo-learner')
            setPlans((rows) => rows.map((plan) => plan.id === updated.id ? { ...plan, ...updated } : plan))
        } catch (nextError) {
            setError(nextError.message || 'Could not review the plan')
        } finally {
            setBusy('')
        }
    }

    return (
        <section aria-labelledby="agentic-plan-title" className="border-y border-[var(--ath-line)] py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                    <p className="editorial-kicker">PLAN WITH EVIDENCE</p>
                    <h2 id="agentic-plan-title" className="mt-1 font-headline text-[var(--ath-text-xl)] font-semibold text-[var(--ath-text)]">
                        Turn a learning goal into a plan you control
                    </h2>
                    <p className="mt-1 text-[var(--ath-text-sm)] leading-6 text-[var(--ath-muted)]">
                        BigAL uses mastery evidence, available time, and your deadline. Nothing starts until you approve it.
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[var(--ath-text-xs)] font-semibold text-[var(--ath-primary)]">
                    <ShieldCheck className="h-4 w-4" /> Learner-owned memory
                </span>
            </div>

            <form onSubmit={createPlan} className="mt-4 grid gap-2 border-y border-[var(--ath-line)] py-3 md:grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,1fr)_9rem_8rem_auto]">
                <label className="sr-only" htmlFor="agentic-goal">Learning goal</label>
                <input id="agentic-goal" required minLength={3} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="editorial-input" placeholder="Learning goal" />
                <label className="sr-only" htmlFor="agentic-course">Course</label>
                <select id="agentic-course" value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })} className="editorial-input">
                    {ALL_COURSE_IDS.map((course) => <option key={course} value={course}>{course}</option>)}
                </select>
                <label className="sr-only" htmlFor="agentic-date">Target date</label>
                <input id="agentic-date" required type="date" min={new Date().toISOString().slice(0, 10)} value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} className="editorial-input" />
                <label className="sr-only" htmlFor="agentic-minutes">Minutes per week</label>
                <input id="agentic-minutes" required type="number" min="60" max="1200" step="30" value={form.weeklyMinutes} onChange={(event) => setForm({ ...form, weeklyMinutes: Number(event.target.value) })} className="editorial-input" />
                <button disabled={busy === 'draft'} className="editorial-button min-h-11 px-4 text-sm">{busy === 'draft' ? 'Drafting…' : 'Draft plan'}</button>
            </form>

            {error && <p role="alert" className="mt-3 border-l-2 border-[var(--ath-danger)] pl-3 text-sm text-[var(--ath-danger)]">{error}</p>}
            {loading ? <p className="mt-3 text-sm text-[var(--ath-muted)]">Loading study plans…</p> : currentPlan ? (
                <PlanPreview plan={currentPlan} busy={busy} onReview={review} />
            ) : (
                <p className="mt-3 text-sm text-[var(--ath-muted)]">Set a specific goal to create your first approval-gated plan.</p>
            )}
        </section>
    )
}

function PlanPreview({ plan, busy, onReview }) {
    const generated = plan.plan || {}
    const sessions = generated.sessions || []
    const awaiting = plan.status === 'awaiting_approval'
    return (
        <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline text-[var(--ath-text-lg)] font-semibold text-[var(--ath-text)]">
                    This week · {sessions.length} focused session{sessions.length === 1 ? '' : 's'}
                </h3>
                <span className={`ml-auto text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.16em] ${awaiting ? 'text-[var(--ath-warning)]' : 'text-[var(--ath-success)]'}`}>
                    {String(plan.status).replaceAll('_', ' ')}
                </span>
            </div>
            <ol className="mt-3 grid gap-2 bg-[var(--ath-primary-soft)] p-3 sm:grid-cols-2 lg:grid-cols-4">
                {sessions.slice(0, 4).map((session, index) => (
                    <li key={session.id || index} className="border-l border-[var(--ath-primary)] pl-3">
                        <p className="text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.14em] text-[var(--ath-primary)]">{String(index + 1).padStart(2, '0')} · {session.mode}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">{prettify(session.concept_id)}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--ath-muted)]"><CalendarDays className="h-3 w-3" /> {session.scheduled_for} · {session.minutes} min</p>
                    </li>
                ))}
            </ol>
            {sessions[0]?.why_now && <p className="mt-3 text-xs leading-5 text-[var(--ath-muted)]">Why now: {sessions[0].why_now}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--ath-line)] pt-3">
                <p className="mr-auto inline-flex items-center gap-1.5 text-xs text-[var(--ath-muted)]"><PauseCircle className="h-4 w-4" /> Editable · pausable · cancellable · no silent automation</p>
                {awaiting && (
                    <>
                        <button type="button" disabled={Boolean(busy)} onClick={() => onReview('cancel')} className="editorial-button-secondary px-4 py-2 text-xs">Not now</button>
                        <button type="button" disabled={Boolean(busy)} onClick={() => onReview('approve')} className="editorial-button px-4 py-2 text-xs">Approve plan</button>
                    </>
                )}
                {plan.status === 'active' && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ath-success)]"><Target className="h-4 w-4" /> Plan active</span>}
            </div>
        </div>
    )
}

function prettify(value) {
    return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}
