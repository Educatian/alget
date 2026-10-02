import { useEffect, useRef } from 'react'
import { logEvent } from './loggingService'

/**
 * Sim telemetry for the embedded Unity labs (ported from agent/ops-hardening).
 * The labs post `learning-event` messages to the parent page; we validate the
 * origin, source, and schema, keep only safe fields, and log them through
 * ALGET's logEvent pipeline (event_logs in Supabase, linked to the account and
 * so to the Study ID). Free-text fields are deliberately dropped.
 */

export function logSimEvent(sectionId, simId, type, data = {}) {
    return logEvent(`sim_${type}`, simId, { sim: simId, ...data }, sectionId)
}

const UNITY_EVENT_SOURCES = Object.freeze({
    FinGripLab: 'fingrip',
    GeckoGripLab: 'geckogrip-unity',
    'pinemorph-lab': 'pinemorph',
    PineMorphLab: 'pinemorph',
    TrabeculaLab: 'trabecula',
})

const SAFE_EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/
const SAFE_TEXT_FIELDS = new Set([
    'appId', 'schemaVersion', 'sessionId', 'timestampUtc', 'eventName',
    'inputName', 'prediction', 'result', 'constraintFlags',
])
const SAFE_NUMBER_FIELDS = new Set([
    'opportunityIndex', 'opportunitiesCompleted', 'opportunitiesAvailable',
    'normalizedOpportunityProgress', 'inputValue', 'confidence',
    'revisionAttempt', 'competencyScore',
])

function boundedText(value, maxLength = 160) {
    if (typeof value !== 'string') return undefined
    return value.slice(0, maxLength)
}

const snake = (field) => field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)

/** Convert a Unity `learning-event` message into a privacy-safe event, or null. */
export function normalizeIframeSimMessage(data, expectedSimId, allowedSources = []) {
    if (!data || typeof data !== 'object') return null
    const mappedSimId = UNITY_EVENT_SOURCES[data.source]
    if (data.type !== 'learning-event' || mappedSimId !== expectedSimId) return null
    if (allowedSources.length > 0 && !allowedSources.includes(data.source)) return null

    const payload = data.payload || data.detail
    if (!payload || typeof payload !== 'object') return null
    const eventName = boundedText(payload.eventName, 64)
    if (!eventName || !SAFE_EVENT_NAME.test(eventName)) return null

    const normalized = {
        source_app: mappedSimId,
        source_schema: boundedText(payload.schemaVersion, 64) || 'unknown',
    }
    for (const field of SAFE_TEXT_FIELDS) {
        const value = boundedText(payload[field])
        if (value !== undefined) normalized[snake(field)] = value
    }
    for (const field of SAFE_NUMBER_FIELDS) {
        const value = Number(payload[field])
        if (payload[field] !== undefined && payload[field] !== null && Number.isFinite(value)) normalized[snake(field)] = value
    }
    if (typeof payload.isFinalDesign === 'boolean') normalized.is_final_design = payload.isFinalDesign

    return {
        type: `unity_${eventName}`,
        data: normalized,
        dedupKey: [payload.sessionId, payload.timestampUtc, eventName].filter(Boolean).join('|') || null,
    }
}

// Slider drags emit an input_changed event about every frame (~60/s, ~650 bytes
// each). Keep only the settled value of each input: log it once the input has
// been still for this long, or immediately before any other event (e.g. a trial).
export const INPUT_SETTLE_MS = 700

/**
 * Listen for one embedded lab's events, log them, and pass each accepted event
 * to `onEvent` (used for live progress).
 */
export function useIframeSimTelemetry(sectionId, simId, options = {}) {
    const { iframeRef, src, allowedSources = [], onEvent } = options
    const allowedSourcesKey = allowedSources.join('|')
    const seen = useRef(new Set())
    const onEventRef = useRef(onEvent)
    useEffect(() => { onEventRef.current = onEvent }, [onEvent])
    const expectedOrigin = (() => {
        try { return src ? new URL(src, window.location.href).origin : null }
        catch { return null }
    })()

    useEffect(() => {
        logSimEvent(sectionId, simId, 'open', {})
        const pendingInputs = new Map() // input name -> { event, timer }

        function emit(event) {
            logSimEvent(sectionId, simId, event.type, event.data)
            onEventRef.current?.(event)
        }
        function flushInput(name) {
            const pending = pendingInputs.get(name)
            if (!pending) return
            clearTimeout(pending.timer)
            pendingInputs.delete(name)
            emit(pending.event)
        }
        function flushAllInputs() {
            for (const name of [...pendingInputs.keys()]) flushInput(name)
        }

        function onMessage(e) {
            if (expectedOrigin && e.origin !== expectedOrigin) return
            if (iframeRef?.current?.contentWindow && e.source !== iframeRef.current.contentWindow) return

            const event = normalizeIframeSimMessage(e?.data, simId, allowedSourcesKey ? allowedSourcesKey.split('|') : [])
            if (!event) return
            if (event.dedupKey && seen.current.has(event.dedupKey)) return
            if (event.dedupKey) {
                seen.current.add(event.dedupKey)
                if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value)
            }
            if (event.type === 'unity_input_changed') {
                const name = event.data.input_name || ''
                clearTimeout(pendingInputs.get(name)?.timer)
                pendingInputs.set(name, { event, timer: setTimeout(() => flushInput(name), INPUT_SETTLE_MS) })
                return
            }
            flushAllInputs() // settled inputs are recorded before the trial they belong to
            emit(event)
        }
        window.addEventListener('message', onMessage)
        return () => {
            window.removeEventListener('message', onMessage)
            flushAllInputs()
        }
    }, [allowedSourcesKey, expectedOrigin, iframeRef, sectionId, simId])
}
