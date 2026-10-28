import { describe, expect, it } from 'vitest'
import { normalizeSketchMessage, sketchLabSimId } from '../lib/sketchLab'

describe('sketchLabSimId', () => {
    it('builds prefixed ids for known books only', () => {
        expect(sketchLabSimId('ai', 'next-word')).toBe('ailit-next-word')
        expect(sketchLabSimId('energy', 'track')).toBe('energy-track')
        expect(sketchLabSimId('chemistry', 'track')).toBeNull()
        expect(sketchLabSimId('ai', '../evil')).toBeNull()
    })
})

describe('normalizeSketchMessage', () => {
    const ok = { channel: 'sim-telemetry', sim: 'ailit-bias', type: 'model_trained', data: { night_share: 0.25, acc_night: 0.955, passed: true, ball: 'tennis' } }

    it('accepts a lab event for the expected sim and keeps scalar data', () => {
        expect(normalizeSketchMessage(ok, 'ailit-bias')).toEqual({
            type: 'sketch_model_trained',
            data: { night_share: 0.25, acc_night: 0.955, passed: true, ball: 'tennis' },
        })
    })

    it('rejects other channels, other sims and unsafe event names', () => {
        expect(normalizeSketchMessage({ ...ok, channel: 'other' }, 'ailit-bias')).toBeNull()
        expect(normalizeSketchMessage(ok, 'ailit-verify')).toBeNull()
        expect(normalizeSketchMessage({ ...ok, type: 'Drop Table' }, 'ailit-bias')).toBeNull()
        expect(normalizeSketchMessage(null, 'ailit-bias')).toBeNull()
    })

    it('drops objects, non-finite numbers and unsafe keys, and trims long strings', () => {
        const event = normalizeSketchMessage({ ...ok, data: { nested: { a: 1 }, bad: Number.NaN, 'Weird Key': 1, note: 'x'.repeat(500) } }, 'ailit-bias')
        expect(event.data).toEqual({ note: 'x'.repeat(160) })
    })
})
