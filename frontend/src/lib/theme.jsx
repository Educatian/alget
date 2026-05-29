import { useCallback, useEffect, useMemo, useState } from 'react'
import { safeLocalStorageGet, safeLocalStorageSet } from './browserStorage'
import { logEvent } from './loggingService'
import { ThemeContext } from './themeContext'
import { DEFAULT_READING_PREFS, applyReadingPrefs } from './readingPrefs'

/**
 * ThemeProvider — light / dark mode toggle plus UDL reading preferences.
 *
 * Theme: the dark palette is defined in index.css via [data-theme="dark"]
 * selectors that override the default --ath-* CSS variables; this provider
 * just toggles the attribute on document.documentElement.
 *
 * Reading preferences (UDL 3.0 — Perception / Language & Symbols): font scale,
 * line height, paragraph spacing, reading width, and a dyslexia-friendly font.
 * These are applied as CSS custom properties / classes on
 * document.documentElement so they cascade app-wide. index.css defines the
 * fallback defaults and @font-face rules; this provider only sets the values.
 *
 * Initial theme value:
 *   1. localStorage 'alget_theme' if set ('light' | 'dark')
 *   2. else prefers-color-scheme: dark
 *   3. else 'light'
 */

const THEME_KEY = 'alget_theme'
const READING_PREFS_KEY = 'alget_reading_prefs'

function detectInitial() {
    if (typeof window === 'undefined') return 'light'
    const stored = safeLocalStorageGet(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
}

function detectInitialReadingPrefs() {
    if (typeof window === 'undefined') return DEFAULT_READING_PREFS
    const raw = safeLocalStorageGet(READING_PREFS_KEY)
    if (!raw) return DEFAULT_READING_PREFS
    try {
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_READING_PREFS, ...parsed }
    } catch {
        return DEFAULT_READING_PREFS
    }
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(detectInitial)
    const [readingPrefs, setReadingPrefs] = useState(detectInitialReadingPrefs)

    useEffect(() => {
        if (typeof document === 'undefined') return
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    useEffect(() => {
        applyReadingPrefs(readingPrefs)
    }, [readingPrefs])

    const setThemeChecked = useCallback((next) => {
        if (next !== 'light' && next !== 'dark') return
        setTheme(next)
        safeLocalStorageSet(THEME_KEY, next)
        logEvent('theme_change', null, { theme: next })
    }, [])

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark'
            safeLocalStorageSet(THEME_KEY, next)
            logEvent('theme_toggle', null, { from: prev, to: next })
            return next
        })
    }, [])

    const setReadingPref = useCallback((key, value) => {
        if (!(key in DEFAULT_READING_PREFS)) return
        setReadingPrefs((prev) => {
            const next = { ...prev, [key]: value }
            safeLocalStorageSet(READING_PREFS_KEY, JSON.stringify(next))
            logEvent('reading_pref_change', null, { key, value })
            return next
        })
    }, [])

    const resetReadingPrefs = useCallback(() => {
        setReadingPrefs(DEFAULT_READING_PREFS)
        safeLocalStorageSet(READING_PREFS_KEY, JSON.stringify(DEFAULT_READING_PREFS))
        logEvent('reading_pref_reset', null, {})
    }, [])

    const api = useMemo(
        () => ({
            theme,
            setTheme: setThemeChecked,
            toggleTheme,
            readingPrefs,
            setReadingPref,
            resetReadingPrefs
        }),
        [theme, setThemeChecked, toggleTheme, readingPrefs, setReadingPref, resetReadingPrefs]
    )

    return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}
