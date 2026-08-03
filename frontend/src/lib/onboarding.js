import { logEvent } from './loggingService'
import { safeLocalStorageSet } from './browserStorage'

export const ONBOARDING_TOUR_KEY = 'alget_onboarding_completed_v1'
export const ONBOARDING_REPLAY_EVENT = 'alget:replay-onboarding'

/**
 * Reset the OnboardingTour state. When `replay` is true, the mounted tour is
 * restarted immediately; otherwise it will replay on the next /book/* mount.
 */
export function resetOnboardingTour({ replay = false } = {}) {
    safeLocalStorageSet(ONBOARDING_TOUR_KEY, '')
    logEvent('onboarding_tour_reset', null, { replay })

    if (replay && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT))
    }
}
