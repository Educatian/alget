import { logEvent } from './loggingService'
import { safeLocalStorageSet } from './browserStorage'

const TOUR_KEY = 'alget_onboarding_completed_v1'

/**
 * Reset the OnboardingTour state so the tour replays on the next /book/*
 * mount. Call from a Settings menu, an admin tool, or the dev console:
 *   import { resetOnboardingTour } from './lib/onboarding'; resetOnboardingTour()
 */
export function resetOnboardingTour() {
    safeLocalStorageSet(TOUR_KEY, '')
    logEvent('onboarding_tour_reset', null, {})
}
