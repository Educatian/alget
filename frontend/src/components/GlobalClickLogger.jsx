import { useEffect, useRef } from 'react'
import { logClick, logEvent, logScroll } from '../lib/loggingService'

const POINTER_SAMPLE_MS = 100     // one mouse position every 100 ms while moving
const POINTER_FLUSH_MS = 5000     // send the movement path every 5 s
const POINTER_MAX_SAMPLES = 50
const RAGE_WINDOW_MS = 1000       // 3+ clicks on the same thing within 1 s
const RAGE_MIN_CLICKS = 3

/** Short, non-sensitive description of a form field for the study log. */
function describeField(el) {
    return {
        tag: el.tagName?.toLowerCase(),
        type: el.type || null,
        name: el.name || el.id || el.getAttribute?.('aria-label') || el.getAttribute?.('placeholder') || null,
    }
}

/**
 * Global interaction logger for the study: clicks (with what was clicked),
 * repeated/rapid clicks, scroll depth, mouse movement paths, and committed
 * choices and inputs in form fields. Wrap the app root with this component.
 */
export default function GlobalClickLogger({ children, sectionId }) {
    const containerRef = useRef(null)
    const scrollTimeoutRef = useRef(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return undefined

        // Clicks, plus rapid repeated clicks on the same element (a frustration signal).
        let rageTarget = null
        let rageTimes = []
        let rageLogged = false
        const handleClick = (e) => {
            const target = e.target
            const entry = logClick(target, e.clientX, e.clientY, sectionId)
            const key = entry?.event_target || target
            const now = Date.now()
            if (key !== rageTarget) { rageTarget = key; rageTimes = []; rageLogged = false }
            rageTimes = [...rageTimes.filter((t) => now - t < RAGE_WINDOW_MS), now]
            if (rageTimes.length >= RAGE_MIN_CLICKS && !rageLogged) {
                rageLogged = true
                logEvent('rage_click', entry?.event_target || null, {
                    clicks: rageTimes.length, window_ms: RAGE_WINDOW_MS,
                    path: window.location.pathname, x: e.clientX, y: e.clientY,
                }, sectionId)
            }
        }

        // Scroll depth (debounced).
        const handleScroll = () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
            scrollTimeoutRef.current = setTimeout(() => {
                const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
                const scrollPercent = scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 0
                logScroll(scrollPercent, sectionId)
            }, 200)
        }

        // Mouse movement: sampled path, sent every few seconds while the mouse moves.
        let samples = []
        let lastSample = 0
        let pathStart = 0
        let distance = 0
        const handleMove = (e) => {
            const now = Date.now()
            if (now - lastSample < POINTER_SAMPLE_MS) return
            const prev = samples[samples.length - 1]
            if (prev) distance += Math.hypot(e.clientX - prev[0], e.clientY - prev[1])
            if (!samples.length) pathStart = now
            lastSample = now
            if (samples.length < POINTER_MAX_SAMPLES) samples.push([e.clientX, e.clientY, now - pathStart])
        }
        const flushPointer = () => {
            if (samples.length >= 2 && distance >= 20) {
                logEvent('pointer_path', null, {
                    samples, sample_count: samples.length, distance_px: Math.round(distance),
                    duration_ms: samples[samples.length - 1][2], pointer_type: 'mouse',
                    path: window.location.pathname,
                    viewport: [window.innerWidth, window.innerHeight],
                }, sectionId)
            }
            samples = []
            distance = 0
        }
        const pointerTimer = setInterval(flushPointer, POINTER_FLUSH_MS)

        // Choices and inputs in any form field, recorded when committed (change event:
        // immediately for selects, checkboxes, radios and sliders; on leaving a text box).
        const handleChange = (e) => {
            const el = e.target
            if (!el || !('value' in el)) return
            const field = describeField(el)
            if (field.type === 'password' || field.type === 'email') return
            const value = field.type === 'checkbox' || field.type === 'radio' ? el.checked : String(el.value ?? '').slice(0, 1000)
            logEvent('input_commit', field.name, { ...field, value, path: window.location.pathname }, sectionId)
        }

        container.addEventListener('click', handleClick, true)
        container.addEventListener('change', handleChange, true)
        window.addEventListener('scroll', handleScroll, { passive: true })
        window.addEventListener('mousemove', handleMove, { passive: true })

        return () => {
            container.removeEventListener('click', handleClick, true)
            container.removeEventListener('change', handleChange, true)
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('mousemove', handleMove)
            clearInterval(pointerTimer)
            flushPointer()
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
        }
    }, [sectionId])

    return (
        <div ref={containerRef} className="contents">
            {children}
        </div>
    )
}
