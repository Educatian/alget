import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/themeContext'

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
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-secondary)] shadow-sm transition-all hover:border-[var(--ath-line-strong)] hover:bg-[var(--ath-panel-muted)] hover:text-[var(--ath-text)] ${className}`}
        >
            {isDark ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
            )}
        </button>
    )
}
