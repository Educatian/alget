/**
 * UDL reading-preference option tables and defaults.
 *
 * Kept in a plain module (no React component exports) so both the
 * ThemeProvider and the SettingsModal can import them without tripping
 * react-refresh's "only export components" rule.
 */

export const FONT_SCALE_OPTIONS = [
    { value: 1, label: '100%' },
    { value: 1.12, label: '112%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' }
]

export const LINE_HEIGHT_OPTIONS = [
    { value: 'compact', label: 'Compact', multiplier: 1.4 },
    { value: 'standard', label: 'Standard', multiplier: 1.7 },
    { value: 'relaxed', label: 'Relaxed', multiplier: 2 }
]

export const PARAGRAPH_SPACING_OPTIONS = [
    { value: 'tight', label: 'Tight', spacing: '0.75em' },
    { value: 'standard', label: 'Standard', spacing: '1.2em' },
    { value: 'airy', label: 'Airy', spacing: '1.8em' }
]

export const READING_WIDTH_OPTIONS = [
    { value: 'narrow', label: 'Narrow', width: '64ch' },
    { value: 'standard', label: 'Standard', width: '78ch' },
    { value: 'wide', label: 'Wide', width: '92ch' }
]

export const DYSLEXIA_FONT_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'opendyslexic', label: 'OpenDyslexic' },
    { value: 'atkinson', label: 'Atkinson Hyperlegible' }
]

export const DEFAULT_READING_PREFS = {
    fontScale: 1,
    lineHeight: 'standard',
    paragraphSpacing: 'standard',
    readingWidth: 'standard',
    dyslexiaFont: 'off'
}

/**
 * Apply reading preferences to document.documentElement as CSS custom
 * properties + classes so they cascade app-wide. index.css defines the
 * fallback defaults and @font-face rules; this only sets the live values.
 */
export function applyReadingPrefs(prefs) {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const fontScale = FONT_SCALE_OPTIONS.find((o) => o.value === prefs.fontScale)?.value
        ?? DEFAULT_READING_PREFS.fontScale
    const lineHeight = LINE_HEIGHT_OPTIONS.find((o) => o.value === prefs.lineHeight)
        ?? LINE_HEIGHT_OPTIONS.find((o) => o.value === DEFAULT_READING_PREFS.lineHeight)
    const spacing = PARAGRAPH_SPACING_OPTIONS.find((o) => o.value === prefs.paragraphSpacing)
        ?? PARAGRAPH_SPACING_OPTIONS.find((o) => o.value === DEFAULT_READING_PREFS.paragraphSpacing)
    const width = READING_WIDTH_OPTIONS.find((o) => o.value === prefs.readingWidth)
        ?? READING_WIDTH_OPTIONS.find((o) => o.value === DEFAULT_READING_PREFS.readingWidth)

    root.style.setProperty('--reading-font-scale', String(fontScale))
    root.style.setProperty('--reading-line-height', String(lineHeight.multiplier))
    root.style.setProperty('--reading-paragraph-spacing', spacing.spacing)
    // index.css's .reading-narrative consumes --reading-width, so emit that
    // exact name (previously this set --reading-max-width, a dead no-op var).
    root.style.setProperty('--reading-width', width.width)

    root.classList.toggle('font-opendyslexic', prefs.dyslexiaFont === 'opendyslexic')
    root.classList.toggle('font-atkinson', prefs.dyslexiaFont === 'atkinson')
    root.setAttribute('data-dyslexia-font', prefs.dyslexiaFont)
}
