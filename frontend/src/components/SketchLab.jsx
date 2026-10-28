import { useEffect, useMemo, useRef } from 'react'
import { logSimEvent } from '../lib/simTelemetry'
import { normalizeSketchMessage, sketchLabSimId } from '../lib/sketchLab'

/**
 * Sketchbook lab: one interactive 3D lesson from the Energy/AI Literacy Sketchbook, framed in the
 * reading flow with `<sketch-lab book="ai" lesson="next-word" title="…" />`.
 *
 * The lab only posts to allow-listed ALGET origins; messages are accepted only from the framed
 * window at the lab's origin and are filtered by lib/sketchLab.js before logging.
 */
const SKETCHBOOK_URL = import.meta.env.VITE_SKETCHBOOK_URL || 'https://energy-sketchbook.pages.dev/'

export default function SketchLab({ book = 'ai', lesson, title, caption, sectionId }) {
    const iframeRef = useRef(null)
    const simId = sketchLabSimId(book, lesson)
    const src = useMemo(() => {
        if (!simId) return null
        const url = new URL(SKETCHBOOK_URL)
        url.searchParams.set('embed', '1')
        url.searchParams.set('book', book)
        url.searchParams.set('lesson', lesson)
        url.searchParams.set('parentOrigin', window.location.origin)
        return url.toString()
    }, [book, lesson, simId])

    useEffect(() => {
        if (!src) return undefined
        const origin = new URL(src).origin
        logSimEvent(sectionId, simId, 'open', { book })
        function onMessage(e) {
            if (e.origin !== origin || e.source !== iframeRef.current?.contentWindow) return
            const event = normalizeSketchMessage(e.data, simId)
            if (event) logSimEvent(sectionId, simId, event.type, event.data)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [book, sectionId, simId, src])

    if (!src) {
        return (
            <div className="my-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950" role="status">
                Unknown lab: <code>{`${book}/${lesson}`}</code>
            </div>
        )
    }

    return (
        <section className="reading-breakout not-prose content-card my-10 overflow-hidden" aria-label={title || 'Interactive 3D lab'}>
            <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4">
                <p className="flex items-center gap-3 font-semibold text-[var(--ath-text)]">
                    <span className="editorial-label text-[var(--ath-primary)]">3D LAB</span>
                    {title}
                </p>
                {caption && <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">{caption}</p>}
            </div>
            <div className="border-t border-[var(--ath-line)] bg-[#ebe4d4]">
                <iframe
                    ref={iframeRef}
                    src={src}
                    title={title || 'Interactive 3D lab'}
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    className="block h-[clamp(560px,78vh,780px)] w-full border-0"
                />
            </div>
            <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                Predict, watch the demonstration, try it, then lift the flap. Only your choices and settings are recorded, never typed text.{' '}
                <a href={src.replace('embed=1', 'embed=0')} target="_blank" rel="noreferrer" className="font-semibold text-[var(--ath-primary)] underline-offset-2 hover:underline">
                    Open full-screen ↗
                </a>
            </p>
        </section>
    )
}
