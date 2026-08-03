import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    ONBOARDING_REPLAY_EVENT,
    ONBOARDING_TOUR_KEY,
    resetOnboardingTour,
} from './onboarding'

describe('onboarding replay contract', () => {
    afterEach(() => {
        window.localStorage.clear()
        vi.restoreAllMocks()
    })

    it('clears completion and dispatches an immediate replay request', () => {
        window.localStorage.setItem(ONBOARDING_TOUR_KEY, 'done')
        const listener = vi.fn()
        window.addEventListener(ONBOARDING_REPLAY_EVENT, listener)

        resetOnboardingTour({ replay: true })

        expect(window.localStorage.getItem(ONBOARDING_TOUR_KEY)).toBe('')
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('only clears completion when replay is not requested', () => {
        window.localStorage.setItem(ONBOARDING_TOUR_KEY, 'done')
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

        resetOnboardingTour()

        expect(window.localStorage.getItem(ONBOARDING_TOUR_KEY)).toBe('')
        expect(dispatchSpy).not.toHaveBeenCalled()
    })
})
