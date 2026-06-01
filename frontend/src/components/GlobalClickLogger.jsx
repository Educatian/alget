import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { logClick, logPointerPath, logScroll } from '../lib/loggingService'

const POINTER_SAMPLE_INTERVAL_MS = 50
const POINTER_MIN_DISTANCE_PX = 12
const POINTER_MIN_DURATION_MS = 120
const POINTER_MAX_SAMPLES = 80

function getTargetId(target) {
    if (!target) return 'unknown'
    const targetClassName = typeof target.className === 'string' ? target.className : ''
    return target.dataset?.testid ||
        target.getAttribute?.('aria-label') ||
        target.id ||
        target.closest?.('[data-testid]')?.dataset?.testid ||
        target.closest?.('button,a,input,textarea,select,[role="button"],svg,canvas')?.getAttribute?.('aria-label') ||
        target.tagName?.toLowerCase?.() ||
        targetClassName.split(' ')[0] ||
        'unknown'
}

function deriveSectionId(pathname) {
    const match = pathname.match(/^\/book\/([^/]+)(?:\/([^/]+)\/([^/]+))?/)
    if (!match) return null
    if (!match[2] || !match[3]) return match[1]
    return `${match[1]}/${match[2]}/${match[3]}`
}

function pointFromEvent(event, startTime) {
    return {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        t: Math.max(0, Math.round(performance.now() - startTime)),
    }
}

function distanceBetween(a, b) {
    if (!a || !b) return 0
    return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0))
}

/**
 * Global Click Logger - Captures all click and scroll interactions
 * Wrap your app root with this component
 */
export default function GlobalClickLogger({ children, sectionId }) {
    const containerRef = useRef(null)
    const scrollTimeoutRef = useRef(null)
    const pointerTraceRef = useRef(null)
    const location = useLocation()
    const resolvedSectionId = sectionId || deriveSectionId(location.pathname)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // Click handler
        const handleClick = (e) => {
            const target = e.target
            logClick(target, e.clientX, e.clientY, resolvedSectionId)
        }

        // Scroll handler with debounce
        const handleScroll = () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }

            scrollTimeoutRef.current = setTimeout(() => {
                const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
                const scrollPercent = scrollHeight > 0
                    ? Math.round((window.scrollY / scrollHeight) * 100)
                    : 0
                logScroll(scrollPercent, resolvedSectionId)
            }, 200)
        }

        const handlePointerDown = (event) => {
            if (event.isPrimary === false) return
            const startTime = performance.now()
            const start = pointFromEvent(event, startTime)
            pointerTraceRef.current = {
                pointerId: event.pointerId,
                pointer_type: event.pointerType || 'unknown',
                target_id: getTargetId(event.target),
                started_on: event.target?.tagName?.toLowerCase?.() || null,
                startTime,
                lastSampleTime: startTime,
                lastPoint: start,
                distance_px: 0,
                samples: [start],
            }
        }

        const handlePointerMove = (event) => {
            const trace = pointerTraceRef.current
            if (!trace || trace.pointerId !== event.pointerId) return

            const now = performance.now()
            if (now - trace.lastSampleTime < POINTER_SAMPLE_INTERVAL_MS) return

            const point = pointFromEvent(event, trace.startTime)
            trace.distance_px += distanceBetween(trace.lastPoint, point)
            trace.lastPoint = point
            trace.lastSampleTime = now
            if (trace.samples.length < POINTER_MAX_SAMPLES) {
                trace.samples.push(point)
            }
        }

        const finishPointerTrace = (event) => {
            const trace = pointerTraceRef.current
            if (!trace || trace.pointerId !== event.pointerId) return

            const end = pointFromEvent(event, trace.startTime)
            trace.distance_px += distanceBetween(trace.lastPoint, end)
            if (trace.samples.length < POINTER_MAX_SAMPLES) {
                trace.samples.push(end)
            }

            const durationMs = Math.round(performance.now() - trace.startTime)
            pointerTraceRef.current = null
            if (trace.distance_px < POINTER_MIN_DISTANCE_PX && durationMs < POINTER_MIN_DURATION_MS) return

            logPointerPath({
                pointer_type: trace.pointer_type,
                target_id: trace.target_id,
                started_on: trace.started_on,
                ended_on: event.target?.tagName?.toLowerCase?.() || null,
                duration_ms: durationMs,
                distance_px: Math.round(trace.distance_px),
                samples: trace.samples,
            }, resolvedSectionId)
        }

        // Attach listeners
        container.addEventListener('click', handleClick, true)
        container.addEventListener('pointerdown', handlePointerDown, true)
        container.addEventListener('pointermove', handlePointerMove, true)
        container.addEventListener('pointerup', finishPointerTrace, true)
        container.addEventListener('pointercancel', finishPointerTrace, true)
        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            container.removeEventListener('click', handleClick, true)
            container.removeEventListener('pointerdown', handlePointerDown, true)
            container.removeEventListener('pointermove', handlePointerMove, true)
            container.removeEventListener('pointerup', finishPointerTrace, true)
            container.removeEventListener('pointercancel', finishPointerTrace, true)
            window.removeEventListener('scroll', handleScroll)
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [resolvedSectionId])

    return (
        <div ref={containerRef} className="contents">
            {children}
        </div>
    )
}
