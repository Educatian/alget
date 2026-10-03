import { describe, expect, it } from 'vitest'
import { computeLabProgress } from './labProgress'

// Shapes taken from a real GeckoGrip run: trial events carry no settings (input_value 0).
const trial = (n, extra = {}) => ({ type: 'unity_trial_completed', data: { opportunities_completed: n, opportunities_available: 4, input_value: 0, ...extra } })
const change = (value) => ({ type: 'unity_input_changed', data: { input_name: 'seta_angle_deg', input_value: value } })

describe('computeLabProgress', () => {
    it('is incomplete until the required number of trials is reached', () => {
        expect(computeLabProgress([change(30), trial(1)], 4)).toMatchObject({ trialsDone: 1, required: 4, complete: false })
    })

    it('completes after the required trials when inputs changed between trials, even if the goal is never met', () => {
        const events = [change(30), trial(1, { prediction: 'SLIP RISK', result: 'CONTACT LOSS' }), change(45), trial(2),
            change(50), trial(3), change(20), trial(4)]
        expect(computeLabProgress(events, 4)).toMatchObject({ complete: true, distinctDesigns: 4, goalMet: false, trialsDone: 4 })
    })

    it('reproduces the real test run: repeated trial numbers and extra runs after 4 of 4', () => {
        const events = [change(30), trial(1), trial(1), change(40), trial(2, { prediction: 'SECURE GRIP', result: 'SECURE GRIP' }),
            change(45), trial(3), change(8), trial(4), trial(4), trial(4)]
        const p = computeLabProgress(events, 4)
        expect(p).toMatchObject({ complete: true, trialsDone: 4, runs: 7, required: 4, predictionsMatched: 1, goalMet: true })
        expect(p.distinctDesigns).toBe(4)
    })

    it('does not complete when no input was changed between trials', () => {
        const events = [change(30), trial(1), trial(2), trial(3), trial(4)]
        expect(computeLabProgress(events, 4)).toMatchObject({ complete: false, needsVariedDesigns: true, distinctDesigns: 1 })
    })

    it('does not hold participants back when the lab sends no input events', () => {
        const events = [trial(1), trial(2), trial(3), trial(4)]
        expect(computeLabProgress(events, 4)).toMatchObject({ complete: true, designsKnown: false })
    })

    it('falls back to counting trials when the lab does not report trial numbers', () => {
        const plain = (n) => ({ type: 'unity_trial_completed', data: { input_value: n } })
        expect(computeLabProgress([change(1), plain(1), change(2), plain(2)], 2)).toMatchObject({ trialsDone: 2, complete: true })
    })

    it('counts a final design but never requires one', () => {
        const events = [change(1), trial(1, { opportunities_available: 1 }), { type: 'unity_final_design_submitted', data: {} }]
        expect(computeLabProgress(events, 1)).toMatchObject({ complete: true, finalDesignSubmitted: true })
    })
})
