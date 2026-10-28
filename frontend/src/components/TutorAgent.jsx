import { useCallback, useEffect, useRef, useState } from 'react'
import { annotate } from 'rough-notation'
import { wrapAnchor } from '../lib/annotationAnchor'
import { getLocalMasteryMap } from '../lib/knowledgeService'
import { logEvent } from '../lib/loggingService'
import { TUTOR_ENABLED, requestAnnotations } from '../lib/tutorClient'
import { recommendNextStep } from '../lib/tutorAgent'

/**
 * The section's tutor agent (static TAMU preview, where the support rail is off):
 *
 *  - Intervene: when practice shows the learner is stuck (BookLayout dispatches 'alget-stuck'),
 *    offer to mark where to look, replay the lecture clip, or open the next hint.
 *  - Annotate: ask the tutor worker for 2–3 margin notes aimed at the learner's misconception
 *    and draw them on the reading with Rough Notation (green key idea, red watch out, blue connect).
 *  - Adapt: a "next step" that follows mastery of the section's concepts and the written activity:
 *    review with tutor notes, practise once more, try the written activity, or move on.
 *
 * Every offer, choice and outcome is logged (intervention_*, tutor_notes_*, adaptation_*).
 */
const PEN = { key_idea: '#1f9d55', watch_out: '#c8402c', connect: '#2f6fd6' }
const KIND_LABEL = { key_idea: 'Key idea', watch_out: 'Watch out', connect: 'Connect' }

// The practice block hides its answer options once an item is answered, so look for either.
const practiceAnchor = () => document.querySelector('[aria-label="Answer options"]') || document.querySelector('button[aria-label^="Get a hint"]')

function readActivity(sectionId) {
    try { return JSON.parse(window.localStorage.getItem(`alget_activity_v1:${sectionId}`)) || null } catch { return null }
}

export default function TutorAgent({ sectionId, practice, misconceptions = [], conceptIds = [], nextSection, onNavigate }) {
    const [offer, setOffer] = useState(null) // { problemId, reason, misconceptionIds }
    const [notes, setNotes] = useState([])
    const [notesState, setNotesState] = useState('idle') // idle | loading | shown | empty | error
    const [mastery, setMastery] = useState(() => getLocalMasteryMap())
    const [activity, setActivity] = useState(() => readActivity(sectionId))
    const drawn = useRef([])
    const shownRec = useRef(null)

    useEffect(() => {
        const refresh = () => { setMastery(getLocalMasteryMap()); setActivity(readActivity(sectionId)) }
        const id = window.setInterval(refresh, 4000)
        window.addEventListener('focus', refresh)
        return () => { window.clearInterval(id); window.removeEventListener('focus', refresh) }
    }, [sectionId])

    const clearNotes = useCallback(() => {
        for (const { a, marks } of drawn.current) {
            a?.remove()
            for (const m of marks) m.replaceWith(...m.childNodes)
        }
        drawn.current = []
    }, [])
    useEffect(() => () => clearNotes(), [sectionId, clearNotes])

    const showNotes = useCallback(async (misconceptionIds, origin) => {
        setNotesState('loading')
        logEvent('tutor_notes_request', null, { origin, misconceptions: misconceptionIds }, sectionId)
        const res = await requestAnnotations({ sectionId, misconceptionIds })
        if (!res || res.error) { setNotesState('error'); logEvent('tutor_notes_error', null, { origin, error: res?.error || 'unavailable' }, sectionId); return }
        clearNotes()
        const article = document.querySelector('.reading-narrative')
        const placed = []
        for (const n of res.notes || []) {
            const marks = article ? wrapAnchor(article, { exact: n.quote }, () => {
                const s = document.createElement('span')
                s.dataset.tutorNote = String(placed.length + 1)
                return s
            }) : []
            if (!marks.length) continue
            const a = annotate(marks[0], { type: n.kind === 'watch_out' ? 'box' : n.kind === 'connect' ? 'bracket' : 'underline', color: PEN[n.kind], strokeWidth: 2.5, padding: 3, multiline: true, iterations: 2, brackets: ['left'] })
            a.show()
            drawn.current.push({ a, marks })
            placed.push({ ...n, n: placed.length + 1 })
        }
        setNotes(placed)
        setNotesState(placed.length ? 'shown' : 'empty')
        logEvent('tutor_notes_shown', null, { origin, notes: placed.map((p) => p.kind), cached: Boolean(res.cached) }, sectionId)
        document.querySelector('span[data-tutor-note="1"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [sectionId, clearNotes])

    // Intervene when practice reports the learner is stuck: once per question, and for the idle
    // signal only while the question is on screen (scrolling does not reset the idle timer).
    const offered = useRef(new Set())
    useEffect(() => {
        const onStuck = (e) => {
            const d = e.detail || {}
            if (d.sectionId !== sectionId || offered.current.has(d.problemId)) return
            if (/idle/i.test(d.reason || '')) {
                const r = practiceAnchor()?.getBoundingClientRect()
                if (!r || r.bottom < 0 || r.top > window.innerHeight) return
            }
            offered.current.add(d.problemId)
            const problem = (practice?.problems || []).find((p) => p.id === d.problemId)
            const ids = problem?.misconception_id && misconceptions.some((m) => m.id === problem.misconception_id) ? [problem.misconception_id] : []
            // Hints are only offered before an answer is checked; after the last attempt, the answer is.
            const step = document.querySelector('button[aria-label^="Get a hint"]:not([disabled])') ? 'hint' : 'show_answer'
            const options = [TUTOR_ENABLED && 'tutor_notes', document.querySelector('.reading-narrative video') && 'rewatch', step, 'dismiss'].filter(Boolean)
            setOffer({ problemId: d.problemId || null, reason: d.reason || 'stuck', misconceptionIds: ids, options })
            logEvent('intervention_shown', d.problemId || null, { trigger: d.reason || 'stuck', misconceptions: ids, options }, sectionId)
        }
        window.addEventListener('alget-stuck', onStuck)
        return () => window.removeEventListener('alget-stuck', onStuck)
    }, [sectionId, practice, misconceptions])

    const choose = async (option) => {
        logEvent('intervention_choice', offer?.problemId || null, { option, trigger: offer?.reason }, sectionId)
        const current = offer
        setOffer(null)
        if (option === 'tutor_notes') await showNotes(current?.misconceptionIds || [], 'intervention')
        if (option === 'rewatch') {
            const video = document.querySelector('.reading-narrative video')
            video?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (video) { video.currentTime = 0; video.play().catch(() => {}) }
        }
        if (option === 'show_answer') {
            const btn = [...document.querySelectorAll('button')].find((b) => /^Show answer/.test(b.textContent.trim()))
            btn?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            btn?.click()
        }
        if (option === 'hint') {
            const btn = document.querySelector('button[aria-label^="Get a hint"]:not([disabled])')
            if (btn) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                btn.click()
            } else {
                practiceAnchor()?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    }

    const rec = recommendNextStep({ mastery, conceptIds, activityDone: Boolean(activity?.rounds?.at(-1)?.ready), activityStarted: Boolean(activity?.text) })
    useEffect(() => {
        if (shownRec.current === rec.id) return
        shownRec.current = rec.id
        logEvent('adaptation_recommendation', rec.id, { level: rec.level === null ? null : Math.round(rec.level * 100) / 100, concepts: conceptIds.length }, sectionId)
    }, [rec.id, rec.level, conceptIds.length, sectionId])

    const act = (choice) => {
        logEvent('adaptation_choice', rec.id, { choice, level: rec.level === null ? null : Math.round(rec.level * 100) / 100 }, sectionId)
        if (choice === 'tutor_notes') showNotes([], 'next_step')
        if (choice === 'practice') practiceAnchor()?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (choice === 'apply') document.querySelector('[aria-label="Apply it: written activity"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (choice === 'next' && nextSection) onNavigate?.(nextSection.chapter, nextSection.section)
    }

    const btn = 'rounded-lg border border-[var(--ath-line)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ath-secondary)] hover:text-[var(--ath-text)]'
    const primary = 'rounded-lg bg-[var(--ath-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-background)]'

    return (
        <>
            <section className="not-prose my-10 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-5 shadow-sm" aria-label="Your next step">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Your next step · tutor</p>
                <p className="mt-1 text-base font-semibold text-[var(--ath-text)]">{rec.title}</p>
                <p className="mt-1 text-sm text-[var(--ath-muted)]">{rec.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {rec.id === 'review' && TUTOR_ENABLED && <button type="button" className={primary} onClick={() => act('tutor_notes')}>Mark where to look</button>}
                    {rec.id === 'start' && <button type="button" className={primary} onClick={() => act('practice')}>Go to the practice</button>}
                    {(rec.id === 'review' || rec.id === 'practice') && <button type="button" className={rec.id === 'practice' ? primary : btn} onClick={() => act('practice')}>Practise again</button>}
                    {rec.id === 'apply' && <button type="button" className={primary} onClick={() => act('apply')}>Go to the written activity</button>}
                    {rec.id === 'next' && nextSection && <button type="button" className={primary} onClick={() => act('next')}>Next section</button>}
                    {rec.id !== 'review' && TUTOR_ENABLED && notesState !== 'shown' && <button type="button" className={btn} onClick={() => act('tutor_notes')}>Tutor notes on this section</button>}
                </div>
                {notesState === 'loading' && <p className="mt-3 text-sm text-[var(--ath-muted)]">The tutor is reading the section…</p>}
                {notesState === 'error' && <p className="mt-3 text-sm text-rose-800">Tutor notes are not available right now.</p>}
                {notesState === 'empty' && <p className="mt-3 text-sm text-[var(--ath-muted)]">The tutor had no notes to add here.</p>}
                {notesState === 'shown' && (
                    <ol className="mt-4 space-y-2" aria-label="Tutor notes">
                        {notes.map((n) => (
                            <li key={n.n}>
                                <button type="button" className="flex w-full gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm" onClick={() => { logEvent('tutor_notes_jump', String(n.n), { kind: n.kind }, sectionId); document.querySelector(`span[data-tutor-note="${n.n}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>
                                    <span className="font-bold" style={{ color: PEN[n.kind] }}>{n.n}</span>
                                    <span><span className="font-semibold" style={{ color: PEN[n.kind] }}>{KIND_LABEL[n.kind]}: </span>{n.note} <span className="text-[var(--ath-muted)]">“{n.quote}”</span></span>
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {offer && (
                <div role="dialog" aria-modal="false" aria-label="Tutor check-in" className="fixed bottom-4 right-4 z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4 shadow-xl">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Tutor check-in</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">This one seems tricky. Want some help?</p>
                    <div className="mt-3 flex flex-col gap-2">
                        {offer.options.includes('tutor_notes') && <button type="button" className={primary} onClick={() => choose('tutor_notes')}>Show me where to look in the reading</button>}
                        {offer.options.includes('rewatch') && <button type="button" className={btn} onClick={() => choose('rewatch')}>Replay the lecture clip</button>}
                        {offer.options.includes('hint') && <button type="button" className={btn} onClick={() => choose('hint')}>Give me the next hint</button>}
                        {offer.options.includes('show_answer') && <button type="button" className={btn} onClick={() => choose('show_answer')}>Show the answer and why</button>}
                        <button type="button" className="text-xs text-[var(--ath-muted)] underline" onClick={() => choose('dismiss')}>I'll keep trying</button>
                    </div>
                </div>
            )}
        </>
    )
}
