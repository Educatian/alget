/**
 * Shared demo-user identifier. Hardcoded historically in AuthModal,
 * loggingService, and several dashboards; centralized here so future
 * changes are one-edit.
 */
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000'

export function isDemoUser(user) {
    return !user?.id || user.id === DEMO_USER_ID
}
