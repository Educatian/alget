/**
 * Reader typography preferences (text size, line spacing, paragraph spacing, line width, font,
 * letter spacing). Kept in this browser only and applied as CSS variables that .reading-narrative
 * reads in index.css. Defaults follow common readability guidance: 16px+ body, line-height
 * about 1.5-1.8, and roughly 60-75 characters per line.
 */

const KEY = 'alget_reader_prefs_v1'

export const READER_OPTIONS = {
    size: [
        { id: 's', label: 'S', value: '1rem' },
        { id: 'm', label: 'M', value: '1.0625rem' },
        { id: 'l', label: 'L', value: '1.1875rem' },
        { id: 'xl', label: 'XL', value: '1.3125rem' },
    ],
    leading: [
        { id: 'compact', label: 'Compact', value: '1.6' },
        { id: 'standard', label: 'Standard', value: '1.8' },
        { id: 'relaxed', label: 'Relaxed', value: '2.05' },
    ],
    paragraph: [
        { id: 'tight', label: 'Tight', value: '1em' },
        { id: 'standard', label: 'Standard', value: '1.45em' },
        { id: 'airy', label: 'Airy', value: '2em' },
    ],
    measure: [
        { id: 'narrow', label: 'Narrow', value: '54ch' },
        { id: 'standard', label: 'Standard', value: '62ch' },
        { id: 'wide', label: 'Wide', value: '74ch' },
    ],
    font: [
        { id: 'sans', label: 'Sans', value: "'IBM Plex Sans', Inter, system-ui, sans-serif" },
        { id: 'serif', label: 'Serif', value: "'Newsreader', 'Iowan Old Style', Georgia, serif" },
    ],
    tracking: [
        { id: 'normal', label: 'Normal', value: 'normal' },
        { id: 'wide', label: 'Wide', value: '0.025em' },
    ],
}

export const DEFAULT_READER_PREFS = { size: 'm', leading: 'standard', paragraph: 'standard', measure: 'standard', font: 'sans', tracking: 'normal' }

const CSS_VARS = {
    size: '--reader-font-size',
    leading: '--reader-line-height',
    paragraph: '--reader-para-space',
    measure: '--reader-measure',
    font: '--reader-font',
    tracking: '--reader-tracking',
}

export function loadReaderPrefs() {
    try {
        const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}')
        const prefs = { ...DEFAULT_READER_PREFS }
        for (const key of Object.keys(prefs)) {
            if (READER_OPTIONS[key].some((o) => o.id === saved?.[key])) prefs[key] = saved[key]
        }
        return prefs
    } catch {
        return { ...DEFAULT_READER_PREFS }
    }
}

export function saveReaderPrefs(prefs) {
    try { window.localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* storage unavailable */ }
}

export function applyReaderPrefs(prefs, root = document.documentElement) {
    for (const [key, cssVar] of Object.entries(CSS_VARS)) {
        const option = READER_OPTIONS[key].find((o) => o.id === prefs[key]) || READER_OPTIONS[key].find((o) => o.id === DEFAULT_READER_PREFS[key])
        root.style.setProperty(cssVar, option.value)
    }
}
