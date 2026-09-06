import { useEffect, useRef } from 'react'
import { logEvent, logEvaluationArtifact } from './loggingService'

/**
 * Sim telemetry — research instrumentation for the bio-inspired simulation suite.
 * Rides ALGET's existing logEvent pipeline (event_logs / interaction_events in
 * Supabase). Captures the design-based-learning *process*: redesign iterations,
 * time-on-task, the parameter trajectory, and mastery moments — plus pre/post
 * misconception probes as evaluation artifacts.
 *
 * Privacy: only parameter values + derived flags are logged (no PII).
 */

export function logSimEvent(sectionId, simId, type, data = {}) {
    return logEvent(`sim_${type}`, simId, { sim: simId, ...data }, sectionId)
}

/**
 * Bridge telemetry for an iframe-embedded 3D sim: listens for postMessage events
 * the sim sends to its parent (channel 'sim-telemetry') and logs them. Use in
 * the iframe wrapper components (GeckoGripLab / NacreLab / RibletLab).
 */
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

/**
 * Convert either the legacy ALGET iframe contract or the shared Unity learning
 * event into a privacy-safe event. Free-response detail and finalDesign are
 * deliberately excluded: those fields may contain learner-authored text.
 */
export function normalizeIframeSimMessage(data, expectedSimId, allowedSources = []) {
    if (!data || typeof data !== 'object') return null

    if (data.channel === 'sim-telemetry') {
        if (data.sim !== expectedSimId || !SAFE_EVENT_NAME.test(data.type || '')) return null
        const safeData = {}
        for (const [key, value] of Object.entries(data.data || {})) {
            if (typeof value === 'boolean') safeData[key] = value
            else if (typeof value === 'number' && Number.isFinite(value)) safeData[key] = value
            else if (typeof value === 'string') safeData[key] = value.slice(0, 160)
        }
        return { type: data.type, data: safeData, dedupKey: null }
    }

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
        if (value !== undefined) normalized[field.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)] = value
    }
    for (const field of SAFE_NUMBER_FIELDS) {
        const value = Number(payload[field])
        if (Number.isFinite(value)) normalized[field.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)] = value
    }
    if (typeof payload.isFinalDesign === 'boolean') normalized.is_final_design = payload.isFinalDesign

    return {
        type: `unity_${eventName}`,
        data: normalized,
        dedupKey: [payload.sessionId, payload.timestampUtc, eventName].filter(Boolean).join('|') || null,
    }
}

export function useIframeSimTelemetry(sectionId, simId, options = {}) {
    const { iframeRef, src, allowedSources = [] } = options
    const allowedSourcesKey = allowedSources.join('|')
    const seen = useRef(new Set())
    const expectedOrigin = (() => {
        try { return src ? new URL(src, window.location.href).origin : null }
        catch { return null }
    })()

    useEffect(() => {
        logSimEvent(sectionId, simId, 'open', {})
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
            logSimEvent(sectionId, simId, event.type, event.data)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [allowedSourcesKey, expectedOrigin, iframeRef, sectionId, simId])
}

/** Pre/post conceptual-change probe for a sim (phase: 'pre' | 'post'). */
export function logSimProbe(sectionId, simId, phase, data = {}) {
    return logEvaluationArtifact(sectionId, {
        phase,
        instrument: 'sim_misconception_probe',
        sim: simId,
        ...data,
    })
}

/**
 * Instrument a sim component. Logs open/close (with time-on-task + redesign
 * count), a debounced snapshot of the parameter state on each change, and a
 * one-shot mastery event when `mastery` first becomes true.
 */
export function useSimTelemetry(sectionId, simId, state, mastery = false) {
    const mountTs = useRef(Date.now())
    const redesigns = useRef(0)
    const firstChange = useRef(true)
    const timer = useRef(null)
    const reachedMastery = useRef(false)
    const stateKey = JSON.stringify(state)

    useEffect(() => {
        logSimEvent(sectionId, simId, 'open', {})
        const started = mountTs.current
        return () => {
            logSimEvent(sectionId, simId, 'close', {
                time_on_task_ms: Date.now() - started,
                redesigns: redesigns.current,
                reached_mastery: reachedMastery.current,
            })
        }
    }, [sectionId, simId])

    useEffect(() => {
        if (firstChange.current) {
            firstChange.current = false
            return
        }
        redesigns.current += 1
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            logSimEvent(sectionId, simId, 'design', {
                redesign_index: redesigns.current,
                state: JSON.parse(stateKey),
            })
        }, 800)
        return () => timer.current && clearTimeout(timer.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stateKey])

    useEffect(() => {
        if (mastery && !reachedMastery.current) {
            reachedMastery.current = true
            logSimEvent(sectionId, simId, 'mastery', {
                redesigns_to_mastery: redesigns.current,
                time_to_mastery_ms: Date.now() - mountTs.current,
                state: JSON.parse(stateKey),
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mastery])
}
