// Lightweight day-based completion streak.
// Stored in localStorage as { lastDay: 'YYYY-MM-DD', count: number }.
// "Day" boundary is local-time midnight. The streak increments at most
// once per calendar day (even if a learner completes 6 sections in the
// same evening), advances by 1 when a new day completes a section
// adjacent to the prior streak day, and resets to 1 if a calendar day
// was missed in between. Read-only consumers call getStreak; the
// markCompleted hook calls bumpStreak.

import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './browserStorage'

const STREAK_KEY = 'alget_completion_streak'

// Cleared on identity change (login/logout) so a different user on the same
// browser doesn't inherit the previous user's streak.
export function clearStreak() {
    safeLocalStorageRemove(STREAK_KEY)
}

function todayKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function dayDelta(fromKey, toKey) {
    if (!fromKey || !toKey) return Infinity
    // Parse the calendar-date keys as UTC midnights so the difference is an exact
    // whole number of days regardless of DST (local-midnight parsing made a span
    // crossing a DST boundary 23h/25h, risking a wrong streak reset).
    const from = new Date(`${fromKey}T00:00:00Z`)
    const to = new Date(`${toKey}T00:00:00Z`)
    return Math.round((to - from) / 86400000)
}

function readState() {
    try {
        const raw = safeLocalStorageGet(STREAK_KEY, '')
        if (!raw) return { lastDay: null, count: 0 }
        const parsed = JSON.parse(raw)
        return {
            lastDay: typeof parsed.lastDay === 'string' ? parsed.lastDay : null,
            count: Number.isFinite(parsed.count) ? parsed.count : 0,
        }
    } catch {
        return { lastDay: null, count: 0 }
    }
}

function writeState(state) {
    safeLocalStorageSet(STREAK_KEY, JSON.stringify(state))
}

export function getStreak() {
    const state = readState()
    if (!state.lastDay) return { count: 0, lastDay: null, isToday: false }
    const delta = dayDelta(state.lastDay, todayKey())
    if (delta > 1) return { count: 0, lastDay: state.lastDay, isToday: false }
    return {
        count: state.count,
        lastDay: state.lastDay,
        isToday: delta === 0,
    }
}

export function bumpStreak() {
    const today = todayKey()
    const state = readState()

    if (state.lastDay === today) {
        return { count: state.count, lastDay: today, isToday: true, advanced: false }
    }

    const delta = dayDelta(state.lastDay, today)
    const nextCount = delta === 1 ? state.count + 1 : 1
    const next = { lastDay: today, count: nextCount }
    writeState(next)
    return { count: nextCount, lastDay: today, isToday: true, advanced: true }
}
