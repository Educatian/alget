import { useTheme } from '../lib/themeContext'

/**
 * ThemeToggle — sun/moon icon button. Reads/writes ThemeContext.
 * Aria-pressed flips so screen readers announce current state.
 */
export default function ThemeToggle({ className = '' }) {
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={isDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-secondary)] transition-all hover:bg-[var(--ath-surface)] hover:text-[var(--ath-text)] ${className}`}
        >
            {isDark ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" strokeWidth={2} />
                    <path strokeLinecap="round" strokeWidth={2} d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
            ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    )
}
