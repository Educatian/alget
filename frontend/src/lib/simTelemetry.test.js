import { describe, expect, it } from 'vitest'
import { normalizeIframeSimMessage } from './simTelemetry'

describe('normalizeIframeSimMessage', () => {
    it('normalizes an allow-listed Unity learning event and removes free text', () => {
        const result = normalizeIframeSimMessage({
            source: 'FinGripLab',
            type: 'learning-event',
            payload: {
                schemaVersion: 'bio-design-learning-event/1.0',
                appId: 'fingrip',
                sessionId: 'anon-session',
                timestampUtc: '2026-08-15T12:00:00Z',
                eventName: 'trial_completed',
                opportunityIndex: 2,
                confidence: 70,
                detail: 'learner-authored CER must not leave the iframe',
                finalDesign: '{"possibly":"free text"}',
            },
        }, 'fingrip', ['FinGripLab'])

        expect(result.type).toBe('unity_trial_completed')
        expect(result.data.opportunity_index).toBe(2)
        expect(result.data.detail).toBeUndefined()
        expect(result.data.final_design).toBeUndefined()
        expect(result.dedupKey).toContain('anon-session')
    })

    it('rejects source/simulation mismatches and unsafe event names', () => {
        expect(normalizeIframeSimMessage({
            source: 'FinGripLab', type: 'learning-event', payload: { eventName: 'trial_completed' },
        }, 'pinemorph')).toBeNull()
        expect(normalizeIframeSimMessage({
            source: 'FinGripLab', type: 'learning-event', payload: { eventName: '<script>' },
        }, 'fingrip')).toBeNull()
    })

    it('keeps the legacy contract for existing WebGPU labs', () => {
        expect(normalizeIframeSimMessage({
            channel: 'sim-telemetry', sim: 'nacre', type: 'design', data: { score: 4 },
        }, 'nacre')).toEqual({ type: 'design', data: { score: 4 }, dedupKey: null })
    })
})
