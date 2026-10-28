import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react'
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
    const sectionRef = useRef(null)
    const [fullscreen, setFullscreen] = useState(false)
    const [overlay, setOverlay] = useState(false)
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

    // Focus mode: real fullscreen where the browser allows it, otherwise a full-window overlay.
    useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === sectionRef.current)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    useEffect(() => {
        if (!overlay) return undefined
        const onKey = (e) => { if (e.key === 'Escape') setOverlay(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [overlay])

    const focused = fullscreen || overlay

    async function toggleFocus() {
        logSimEvent(sectionId, simId, 'focus_mode', { on: !focused })
        if (document.fullscreenElement) return document.exitFullscreen()
        if (overlay) return setOverlay(false)
        try {
            await sectionRef.current.requestFullscreen()
        } catch {
            setOverlay(true)
        }
    }

    if (!src) {
        return (
            <div className="my-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950" role="status">
                Unknown lab: <code>{`${book}/${lesson}`}</code>
            </div>
        )
    }

    const buttonClass = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 text-xs font-semibold text-[var(--ath-secondary)] transition-colors hover:border-[var(--ath-line-strong)] hover:text-[var(--ath-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ath-primary)]'

    return (
        <section
            ref={sectionRef}
            className={focused
                ? 'not-prose fixed inset-0 z-[120] flex flex-col bg-[var(--ath-panel)]'
                : 'reading-breakout not-prose content-card my-12 overflow-hidden'}
            aria-label={title || 'Interactive 3D lab'}
        >
            <div className="flex flex-wrap items-start gap-3 border-b border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-5 py-3">
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-[var(--ath-text)]">
                        <span className="editorial-label text-[var(--ath-primary)]">3D LAB</span>
                        {title}
                    </p>
                    {caption && !focused && <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">{caption}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleFocus} className={buttonClass} aria-pressed={focused}>
                        {focused ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
                        {focused ? 'Exit focus' : 'Focus mode'}
                    </button>
                    <a href={src.replace('embed=1', 'embed=0')} target="_blank" rel="noreferrer" className={buttonClass} aria-label="Open the lab in a new tab">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">New tab</span>
                    </a>
                </div>
            </div>
            <div className={`bg-[#ebe4d4] ${focused ? 'min-h-0 flex-1' : ''}`}>
                <iframe
                    ref={iframeRef}
                    src={src}
                    title={title || 'Interactive 3D lab'}
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    className={focused ? 'block h-full w-full border-0' : 'block aspect-[16/10] max-h-[82vh] min-h-[560px] w-full border-0'}
                />
            </div>
            {!focused && (
                <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                    Predict, watch the demonstration, try it, then lift the flap. Only your choices and settings are recorded, never typed text.
                </p>
            )}
        </section>
    )
}
