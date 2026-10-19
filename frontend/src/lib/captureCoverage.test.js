import { describe, expect, it, vi } from 'vitest'

const logged = []
vi.mock('./loggingService', () => ({ logEvent: (type, target, data) => { logged.push({ type, target, data }); return { event_target: target } } }))
vi.mock('./supabase', () => ({ supabase: {}, isSupabaseConfigured: false }))
vi.mock('./researchService', () => ({ buildLearnerProfileSnapshot: vi.fn(), startInterventionTrace: vi.fn() }))

const { normalizeIframeSimMessage } = await import('./simTelemetry')
const { recordAdaptiveSignal } = await import('./knowledgeService')

describe('study data capture', () => {
    it('keeps the per-trial detail, final design, list values and any extra fields the labs send', () => {
        const event = normalizeIframeSimMessage({
            source: 'TrabeculaLab', type: 'learning-event',
            payload: {
                eventName: 'trial_completed', inputName: 'orientation,density', inputValue: '18.0,0.180',
                detail: 'variablesChanged=1;safety_factor=0.8', finalDesign: '{"density":0.18}', shearCapacityN: 0.3,
            },
        }, 'trabecula')
        expect(event.data).toMatchObject({
            input_value_text: '18.0,0.180',
            detail: 'variablesChanged=1;safety_factor=0.8',
            final_design: '{"density":0.18}',
            extra: { shearCapacityN: 0.3 },
        })
    })

    it('sends adaptive signals (hints, confidence, misconceptions) to the study log', () => {
        logged.length = 0
        recordAdaptiveSignal('statics/01/01', 'hint_request', { problemId: 'p1', conceptId: 'fbd' })
        recordAdaptiveSignal('statics/01/01', 'stuck_event', { reason: 'idle' })
        expect(logged).toEqual([{ type: 'signal_hint_request', target: 'p1', data: { problemId: 'p1', conceptId: 'fbd' } }])
    })
})
