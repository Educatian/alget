import { describe, expect, it } from 'vitest'
import { buildPilotEvent, sanitizePilotPayload } from './pilotEventSchema'

describe('pilot event export contract', () => {
    it('allow-lists derived payload fields and removes free text', () => {
        expect(sanitizePilotPayload('tutor_opened', { intent: 'compare', raw_prompt: 'private learner text' })).toEqual({ intent: 'compare' })
    })

    it('normalizes bounded numeric and boolean values', () => {
        expect(sanitizePilotPayload('social_evidence_compared', { rubric_score: 4, evidence_submitted: 1 })).toEqual({ rubric_score: 1, evidence_submitted: true })
    })

    it('requires pseudonymous identifiers and emits a versioned event', () => {
        expect(() => buildPilotEvent({ eventType: 'section_opened', courseId: 'ail-606', sectionId: '01/01', payload: {} })).toThrow(/pseudonymous/)
        expect(buildPilotEvent({ eventType: 'section_opened', courseId: 'ail-606', sectionId: '01/01', actorHash: 'h1', payload: { mode: 'reader' } })).toMatchObject({ schema_version: 'alget-pilot-events-v1', payload: { mode: 'reader' } })
    })
})
