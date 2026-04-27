import { useCallback, useEffect, useMemo, useState } from 'react'
import { safeLocalStorageGet, safeLocalStorageSet } from './browserStorage'
import { logEvent } from './loggingService'
import { ThemeContext } from './themeContext'

/**
 * ThemeProvider — light / dark mode toggle. The dark palette is defined in
 * index.css via [data-theme="dark"] selectors that override the default
 * --ath-* CSS variables; this provider just toggles the attribute on
 * document.documentElement.
 *
 * Initial value:
 *   1. localStorage 'alget_theme' if set ('light' | 'dark')
 *   2. else prefers-color-scheme: dark
 *   3. else 'light'
 */

const THEME_KEY = 'alget_theme'

function detectInitial() {
    if (typeof window === 'undefined') return 'light'
    const stored = safeLocalStorageGet(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(detectInitial)

    useEffect(() => {
        if (typeof document === 'undefined') return
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

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

    const api = useMemo(() => ({ theme, setTheme: setThemeChecked, toggleTheme }), [theme, setThemeChecked, toggleTheme])

    return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}
