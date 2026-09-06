import { describe, expect, it } from 'vitest'
import { buildUnloadBeaconPayload } from './loggingService'

describe('unload telemetry relay contract', () => {
    it('sends only bounded events and a short-lived access token', () => {
        const payload = buildUnloadBeaconPayload([
            { event_type: 'sequence_check', event_data: { answer: 'private prose' } },
        ], '  learner-token  ')

        expect(payload).toEqual({
            events: [{ event_type: 'sequence_check', event_data: { answer: 'private prose' } }],
            access_token: 'learner-token',
        })
        expect(payload).not.toHaveProperty('supabase_url')
        expect(payload).not.toHaveProperty('supabase_anon_key')
    })

    it('caps the queue and normalizes missing credentials to null', () => {
        const payload = buildUnloadBeaconPayload(Array.from({ length: 501 }, (_, index) => ({ sequence_num: index })), '   ')
        expect(payload.events).toHaveLength(500)
        expect(payload.events[0]).toEqual({ sequence_num: 1 })
        expect(payload.access_token).toBeNull()
    })
})
