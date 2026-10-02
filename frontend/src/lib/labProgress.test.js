import { describe, expect, it } from 'vitest'
import { computeLabProgress } from './labProgress'

const trial = (data) => ({ type: 'unity_trial_completed', data })

describe('computeLabProgress', () => {
    it('is incomplete until the required number of trials is reached', () => {
        const p = computeLabProgress([trial({ input_name: 'rib', input_value: 1 })], 5)
        expect(p).toMatchObject({ trialsDone: 1, required: 5, complete: false })
    })

    it('completes after the required trials with at least two designs, even if the goal is never met', () => {
        const events = [1, 2, 3, 4, 5].map((n) => trial({ input_name: 'rib', input_value: n, prediction: 'PASS', result: 'SLIP' }))
        expect(computeLabProgress(events, 5)).toMatchObject({ complete: true, distinctDesigns: 5, goalMet: false, predictionsMatched: 0 })
    })

    it('does not complete when every trial used the same design', () => {
        const events = Array.from({ length: 5 }, () => trial({ input_name: 'rib', input_value: 18 }))
        expect(computeLabProgress(events, 5)).toMatchObject({ complete: false, needsVariedDesigns: true, distinctDesigns: 1 })
    })

    it('does not hold participants back when the lab does not report settings', () => {
        const events = Array.from({ length: 4 }, () => trial({ prediction: 'secure grip', result: 'SECURE_GRIP' }))
        const p = computeLabProgress(events, 4)
        expect(p).toMatchObject({ complete: true, designsKnown: false, predictionsMatched: 4, goalMet: true })
    })

    it('uses the lab-reported trial counts when present', () => {
        const events = [trial({ opportunities_completed: 3, opportunities_available: 3, input_name: 'a', input_value: 1 }),
            trial({ input_name: 'a', input_value: 2 })]
        expect(computeLabProgress(events, 5)).toMatchObject({ required: 3, trialsDone: 3, complete: true })
    })

    it('counts a final design but never requires one', () => {
        const events = [trial({ input_name: 'a', input_value: 1 }), { type: 'unity_final_design_submitted', data: {} }]
        expect(computeLabProgress(events, 1)).toMatchObject({ complete: true, finalDesignSubmitted: true })
    })
})
