import { useCallback, useEffect, useRef, useState } from 'react'
import { logEvent } from '../lib/loggingService'
import { parseVttTimes } from '../lib/vtt'

/**
 * LessonVideo — a short course video served from this site (frontend/public/media/...).
 * Videos are narrated lectures rendered from media_src/ (ManimGL + Kokoro TTS); each has a
 * WebVTT caption file with the same name next to it.
 *
 * Embedded quiz: if <Name>.quiz.json sits next to the video, the video pauses at each checkpoint
 * (the end of caption cue `after_cue`) and asks one question. The learner answers, sees why, and
 * can rewatch the part it is about (from cue `rewatch_cue`) or skip. Seeking past a checkpoint
 * still stops there.
 *
 * MDX usage:
 *   <lesson-video src="/media/ai-literacy/NextWordVideo.mp4" title="…" caption="…" />
 */

export default function LessonVideo({ src, title, caption, sectionId }) {
    const valid = typeof src === 'string' && /^\/media\/[a-z0-9/_-]+\.mp4$/i.test(src)
    const videoRef = useRef(null)
    const [checkpoints, setCheckpoints] = useState([])
    const [cues, setCues] = useState([])
    const [done, setDone] = useState({}) // checkpoint id -> 'correct' | 'skipped'
    const [active, setActive] = useState(null) // { cp, choice, result, attempt }

    useEffect(() => {
        if (!valid) return undefined
        let cancelled = false
        const base = src.replace(/\.mp4$/i, '')
        Promise.all([
            fetch(`${base}.quiz.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
            fetch(`${base}.vtt`).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
        ]).then(([quiz, vtt]) => {
            if (cancelled) return
            setCheckpoints(Array.isArray(quiz?.checkpoints) ? quiz.checkpoints : [])
            setCues(parseVttTimes(vtt))
        })
        return () => { cancelled = true }
    }, [src, valid])

    const stopAt = useCallback((cp) => cues[cp.after_cue - 1]?.end ?? null, [cues])

    const onTimeUpdate = (e) => {
        if (active) return
        const t = e.currentTarget.currentTime
        const due = checkpoints.find((cp) => !done[cp.id] && stopAt(cp) !== null && t >= stopAt(cp) - 0.1)
        if (!due) return
        const video = e.currentTarget
        video.pause()
        if (document.fullscreenElement === video) document.exitFullscreen().catch(() => {})
        setActive({ cp: due, choice: null, result: null, attempt: 0 })
        logEvent('video_quiz_shown', due.id, { video: src, at_s: Math.round(t) }, sectionId)
    }

    const check = () => {
        if (!active || active.choice === null) return
        const correct = active.choice === active.cp.correct
        const attempt = active.attempt + 1
        setActive({ ...active, result: correct ? 'correct' : 'wrong', attempt })
        logEvent('video_quiz_answer', active.cp.id, { video: src, choice: active.choice, correct, attempt }, sectionId)
    }

    const resume = (status) => {
        const cp = active.cp
        setDone((d) => ({ ...d, [cp.id]: status }))
        setActive(null)
        logEvent(status === 'skipped' ? 'video_quiz_skip' : 'video_quiz_continue', cp.id, { video: src, attempts: active.attempt }, sectionId)
        videoRef.current?.play().catch(() => {})
    }

    const rewatch = () => {
        const cp = active.cp
        const from = cues[(cp.rewatch_cue || cp.after_cue) - 1]?.start ?? 0
        logEvent('video_quiz_rewatch', cp.id, { video: src, from_s: Math.round(from), attempts: active.attempt }, sectionId)
        setActive(null)
        if (videoRef.current) {
            videoRef.current.currentTime = from
            videoRef.current.play().catch(() => {})
        }
    }

    if (!valid) {
        return (
            <div className="my-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="status">
                Video unavailable: <code>{String(src)}</code>
            </div>
        )
    }
    const log = (type, e) => logEvent(type, null, { video: src, at_s: Math.round(e.currentTarget.currentTime) }, sectionId)
    const answered = Object.keys(done).length

    return (
        <figure className="reading-breakout reading-breakout--media not-prose my-10 overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] shadow-sm">
            <div className="relative">
                <video
                    ref={videoRef}
                    src={src}
                    controls
                    preload="metadata"
                    playsInline
                    className="block aspect-video w-full bg-[#f5f0e6]"
                    aria-label={title}
                    onPlay={(e) => log('lesson_video_play', e)}
                    onPause={(e) => log('lesson_video_pause', e)}
                    onEnded={(e) => log('lesson_video_finished', e)}
                    onTimeUpdate={onTimeUpdate}
                >
                    <track kind="captions" src={src.replace(/\.mp4$/i, '.vtt')} srcLang="en" label="English" default />
                </video>
                {active && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(20,18,15,0.55)] p-3 sm:p-6">
                        <div role="dialog" aria-modal="false" aria-label="Video check-in question" className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--ath-panel)] p-4 text-[var(--ath-text)] shadow-xl sm:p-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Quick check</p>
                            <p className="mt-1 text-sm font-semibold sm:text-base">{active.cp.question}</p>
                            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Answer options">
                                {active.cp.options.map((option, i) => {
                                    const chosen = active.choice === i
                                    const tone = active.result && chosen ? (active.result === 'correct' ? 'border-emerald-500 bg-emerald-50' : 'border-rose-400 bg-rose-50') : chosen ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.35)]' : 'border-[var(--ath-line)] bg-white'
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            role="radio"
                                            aria-checked={chosen}
                                            disabled={active.result === 'correct'}
                                            onClick={() => setActive({ ...active, choice: i, result: null })}
                                            className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${tone}`}
                                        >
                                            {option}
                                        </button>
                                    )
                                })}
                            </div>
                            {active.result && (
                                <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${active.result === 'correct' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
                                    {active.result === 'correct' ? `Right. ${active.cp.explain}` : 'Not quite. Try another answer, or rewatch the part this is about.'}
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                {active.result === 'correct' ? (
                                    <button type="button" onClick={() => resume('correct')} className="rounded-lg bg-[var(--ath-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-background)]">Continue the video</button>
                                ) : (
                                    <button type="button" onClick={check} disabled={active.choice === null} className="rounded-lg bg-[var(--ath-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-background)] disabled:opacity-50">Check</button>
                                )}
                                <button type="button" onClick={rewatch} className="rounded-lg border border-[var(--ath-line)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-secondary)]">Rewatch this part</button>
                                {active.result !== 'correct' && (
                                    <button type="button" onClick={() => resume('skipped')} className="ml-auto text-xs text-[var(--ath-muted)] underline">Skip</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-2 text-xs text-[var(--ath-muted)]">
                <span className="font-semibold text-[var(--ath-text)]">{title}</span>
                {caption && <span>{caption}</span>}
                {checkpoints.length > 0 && <span>{answered} of {checkpoints.length} check-ins done</span>}
            </figcaption>
        </figure>
    )
}
