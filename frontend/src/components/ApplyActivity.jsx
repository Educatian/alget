import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { annotate } from 'rough-notation'
import API_BASE from '../lib/apiConfig'
import { logEvent } from '../lib/loggingService'
import { TUTOR_ENABLED, requestFeedback } from '../lib/tutorClient'

/**
 * "Apply it": the section's written activity with a feedback loop. The learner writes, says which
 * criteria they think they met, and asks for feedback. The tutor marks their own words like a
 * teacher with coloured pens (PenMentor style, drawn with Rough Notation): green = a strength,
 * red = the first real problem, blue = a question. It judges each criterion and gives one next
 * step as a hint, never the answer. The learner revises and asks again (up to MAX_ROUNDS).
 *
 * Draft and rounds are kept per section in localStorage (alget_activity_v1:<section>), which the
 * TAMU accounts sync to the student's ID. Event logs record lengths and outcomes, never the text.
 *
 * MDX usage: <apply-activity />  (the prompt and criteria come from the section JSON)
 */
const MAX_ROUNDS = 3
const KEY = (sectionId) => `alget_activity_v1:${sectionId}`
const PEN = { strength: '#1f9d55', issue: '#c8402c', question: '#2f6fd6' }
const STATUS = { met: { label: 'Met', cls: 'bg-emerald-100 text-emerald-900' }, partly: { label: 'Partly', cls: 'bg-amber-100 text-amber-900' }, not_yet: { label: 'Not yet', cls: 'bg-rose-100 text-rose-900' } }
const wordCount = (s) => (String(s).trim().match(/\S+/g) || []).length

function load(sectionId) {
    try { return JSON.parse(window.localStorage.getItem(KEY(sectionId))) || null } catch { return null }
}

/** The learner's text with pen marks drawn on the quoted spans. */
function MarkedText({ text, marks }) {
    const ref = useRef(null)
    const parts = []
    let at = 0
    const ordered = marks
        .map((m, i) => ({ ...m, i, start: text.indexOf(m.quote) }))
        .filter((m) => m.start > -1)
        .sort((a, b) => a.start - b.start)
        .filter((m, k, arr) => k === 0 || m.start >= arr[k - 1].start + arr[k - 1].quote.length)
    for (const m of ordered) {
        parts.push(text.slice(at, m.start))
        parts.push(<span key={m.i} data-mark={m.i} data-kind={m.kind}>{m.quote}<sup className="ml-0.5 text-[10px] font-bold" style={{ color: PEN[m.kind] }}>{m.i + 1}</sup></span>)
        at = m.start + m.quote.length
    }
    parts.push(text.slice(at))

    useLayoutEffect(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const drawn = [...(ref.current?.querySelectorAll('span[data-mark]') || [])].map((el, k) => {
            const kind = el.dataset.kind
            const a = annotate(el, {
                type: kind === 'strength' ? 'underline' : kind === 'issue' ? (el.textContent.length < 40 ? 'circle' : 'underline') : 'bracket',
                color: PEN[kind], strokeWidth: 2.5, padding: 3, multiline: true, iterations: 2,
                brackets: ['left', 'right'], animate: !reduce, animationDuration: 700,
            })
            window.setTimeout(() => a.show(), reduce ? 0 : k * 650)
            return a
        })
        return () => drawn.forEach((a) => a.remove())
    }, [text, marks])

    return <p ref={ref} className="whitespace-pre-wrap rounded-xl bg-white px-4 py-3 text-[15px] leading-8 text-[var(--ath-text)]">{parts}</p>
}

export default function ApplyActivity({ sectionId }) {
    const [activity, setActivity] = useState(null)
    const [state, setState] = useState(() => load(sectionId) || { text: '', rounds: [], self: {} })
    const [editing, setEditing] = useState(() => !load(sectionId)?.rounds?.length)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        // The section view remounts per section, so the saved draft is read once, in useState above.
        fetch(`${API_BASE}/book/${sectionId}`).then((r) => r.json()).then((d) => { if (!cancelled) setActivity(d?.activity || null) }).catch(() => {})
        return () => { cancelled = true }
    }, [sectionId])

    const save = (next) => {
        setState(next)
        try { window.localStorage.setItem(KEY(sectionId), JSON.stringify(next)) } catch { /* storage unavailable */ }
    }

    if (!activity) return null
    const rounds = state.rounds || []
    const last = rounds.at(-1)
    const words = wordCount(state.text)
    const enough = words >= (activity.min_words || 30)
    const done = last?.ready
    const outOfRounds = rounds.length >= MAX_ROUNDS

    const ask = async () => {
        setBusy(true)
        setError('')
        const revision = rounds.length + 1
        const selfMet = activity.criteria.filter((c) => state.self?.[c.id]).map((c) => c.id)
        logEvent('activity_feedback_request', activity.id, { revision, words, self_met: selfMet }, sectionId)
        const res = await requestFeedback({ sectionId, text: state.text, revision, previous: last?.criteria?.map(({ id, status }) => ({ id, status })) })
        setBusy(false)
        if (!res || res.error) {
            setError(res?.error === 'too_short' ? 'Write a little more first.' : 'Feedback is not available right now. Check your answer against the criteria yourself, then try again later.')
            logEvent('activity_feedback_error', activity.id, { revision, error: res?.error || 'unavailable' }, sectionId)
            return
        }
        const round = { at: new Date().toISOString(), text: state.text, words, criteria: res.criteria, marks: res.marks, next_step: res.next_step, ready: res.ready, self_met: selfMet }
        save({ ...state, rounds: [...rounds, round] })
        setEditing(false)
        const met = res.criteria.filter((c) => c.status === 'met').map((c) => c.id)
        logEvent('activity_feedback_received', activity.id, {
            revision, ready: res.ready, met, marks: res.marks.map((m) => m.kind),
            // Calibration: criteria the learner thought they met that the tutor did not judge met.
            overclaimed: selfMet.filter((id) => !met.includes(id)),
        }, sectionId)
    }

    const revise = () => {
        setEditing(true)
        logEvent('activity_revise_start', activity.id, { after_round: rounds.length }, sectionId)
    }

    return (
        <section className="not-prose my-10 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-5 shadow-sm" aria-label="Apply it: written activity">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Apply it · written activity</p>
            <p className="mt-2 text-base font-semibold text-[var(--ath-text)]">{activity.prompt}</p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--ath-muted)]">
                {activity.criteria.map((c) => {
                    const verdict = last?.criteria?.find((x) => x.id === c.id)
                    return (
                        <li key={c.id} className="flex flex-wrap items-center gap-2">
                            {editing && !done ? (
                                <label className="inline-flex items-center gap-2">
                                    <input type="checkbox" name={`self-${c.id}`} checked={Boolean(state.self?.[c.id])} onChange={(e) => save({ ...state, self: { ...state.self, [c.id]: e.target.checked } })} />
                                    <span>{c.label}</span>
                                </label>
                            ) : <span>{c.label}</span>}
                            {verdict && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[verdict.status].cls}`}>{STATUS[verdict.status].label}</span>}
                            {verdict?.comment && <span className="text-xs text-[var(--ath-muted)]">{verdict.comment}</span>}
                        </li>
                    )
                })}
            </ul>
            {editing && !done && <p className="mt-1 text-xs text-[var(--ath-muted)]">Tick the criteria you think your answer meets before asking for feedback.</p>}

            {editing && !done ? (
                <div className="mt-4">
                    <label htmlFor={`activity-${sectionId}`} className="sr-only">Your answer</label>
                    <textarea
                        id={`activity-${sectionId}`}
                        name="apply_activity"
                        value={state.text}
                        onChange={(e) => save({ ...state, text: e.target.value })}
                        rows={7}
                        className="w-full rounded-xl border border-[var(--ath-line)] bg-white px-3 py-2 text-[15px] leading-7 text-[var(--ath-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                        placeholder="Write your answer in your own words."
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className={`text-xs ${enough ? 'text-[var(--ath-muted)]' : 'text-amber-700'}`}>{words} words{enough ? '' : ` (at least ${activity.min_words || 30})`}</span>
                        {TUTOR_ENABLED && (
                            <button type="button" onClick={ask} disabled={!enough || busy || outOfRounds} className="rounded-lg bg-[var(--ath-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-background)] disabled:opacity-50">
                                {busy ? 'Reading your answer…' : rounds.length ? `Get feedback on revision ${rounds.length + 1}` : 'Get feedback'}
                            </button>
                        )}
                        {outOfRounds && <span className="text-xs text-[var(--ath-muted)]">You have used all {MAX_ROUNDS} feedback rounds. Compare your answer with the criteria yourself.</span>}
                    </div>
                    {TUTOR_ENABLED && <p className="mt-2 text-[11px] text-[var(--ath-muted)]">Feedback comes from the university's AI service, which receives your answer. It is not graded.</p>}
                </div>
            ) : last ? (
                <div className="mt-4 space-y-3">
                    <MarkedText text={last.text} marks={last.marks} />
                    {last.marks.length > 0 && (
                        <ol className="space-y-1 text-sm">
                            {last.marks.map((m, i) => (
                                <li key={i} className="flex gap-2"><span className="font-bold" style={{ color: PEN[m.kind] }}>{i + 1}</span><span className="text-[var(--ath-text)]">{m.note}</span></li>
                            ))}
                        </ol>
                    )}
                    <p className={`rounded-xl px-3 py-2 text-sm ${done ? 'bg-emerald-50 text-emerald-900' : 'bg-[rgba(200,226,236,0.35)] text-[var(--ath-text)]'}`}>
                        <span className="font-semibold">{done ? 'All criteria met. ' : 'Next step: '}</span>{done ? 'Nice work: your answer covers everything this activity asks for.' : last.next_step}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {!done && !outOfRounds && <button type="button" onClick={revise} className="rounded-lg bg-[var(--ath-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-background)]">Revise my answer</button>}
                        <span className="text-xs text-[var(--ath-muted)]">Round {rounds.length} of {MAX_ROUNDS}</span>
                    </div>
                </div>
            ) : null}
            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
        </section>
    )
}
