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
export function useIframeSimTelemetry(sectionId, simId) {
    useEffect(() => {
        logSimEvent(sectionId, simId, 'open', {})
        function onMessage(e) {
            const d = e?.data
            if (!d || d.channel !== 'sim-telemetry' || d.sim !== simId) return
            logSimEvent(sectionId, simId, d.type || 'design', d.data || {})
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionId, simId])
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
