import { afterEach, describe, expect, it } from 'vitest'
import {
    DEFAULT_READING_PREFS,
    READING_WIDTH_OPTIONS,
    applyReadingPrefs,
} from './readingPrefs'

// readingPrefs is a pure module: applyReadingPrefs writes CSS custom
// properties + classes onto document.documentElement so UDL preferences
// cascade app-wide. These tests assert the live values it emits, with a
// focus on the reading-width preference driving --reading-width (the var
// .reading-narrative actually consumes; --reading-max-width was a dead var).

describe('applyReadingPrefs reading-width preference', () => {
    afterEach(() => {
        const root = document.documentElement
        root.removeAttribute('style')
        root.removeAttribute('data-dyslexia-font')
        root.classList.remove('font-opendyslexic', 'font-atkinson')
    })

    it('applies the selected reading width to the --reading-width custom property', () => {
        const wide = READING_WIDTH_OPTIONS.find((o) => o.value === 'wide')
        applyReadingPrefs({ ...DEFAULT_READING_PREFS, readingWidth: 'wide' })

        expect(
            document.documentElement.style.getPropertyValue('--reading-width'),
        ).toBe(wide.width)
    })

    it('switches --reading-width when the preference changes between options', () => {
        const narrow = READING_WIDTH_OPTIONS.find((o) => o.value === 'narrow')
        const standard = READING_WIDTH_OPTIONS.find((o) => o.value === 'standard')

        applyReadingPrefs({ ...DEFAULT_READING_PREFS, readingWidth: 'narrow' })
        expect(
            document.documentElement.style.getPropertyValue('--reading-width'),
        ).toBe(narrow.width)

        applyReadingPrefs({ ...DEFAULT_READING_PREFS, readingWidth: 'standard' })
        expect(
            document.documentElement.style.getPropertyValue('--reading-width'),
        ).toBe(standard.width)
    })

    it('falls back to the default width for an unknown reading-width value', () => {
        const fallback = READING_WIDTH_OPTIONS.find(
            (o) => o.value === DEFAULT_READING_PREFS.readingWidth,
        )
        applyReadingPrefs({ ...DEFAULT_READING_PREFS, readingWidth: 'not_a_real_width' })

        expect(
            document.documentElement.style.getPropertyValue('--reading-width'),
        ).toBe(fallback.width)
    })

    it('also emits font-scale, line-height and paragraph-spacing vars together', () => {
        applyReadingPrefs({
            fontScale: 1.25,
            lineHeight: 'relaxed',
            paragraphSpacing: 'airy',
            readingWidth: 'wide',
            dyslexiaFont: 'off',
        })

        const root = document.documentElement
        expect(root.style.getPropertyValue('--reading-font-scale')).toBe('1.25')
        // relaxed multiplier is 2, airy spacing is 1.8em.
        expect(root.style.getPropertyValue('--reading-line-height')).toBe('2')
        expect(root.style.getPropertyValue('--reading-paragraph-spacing')).toBe('1.8em')
    })

    it('toggles the dyslexia font class and data attribute (not color alone)', () => {
        applyReadingPrefs({ ...DEFAULT_READING_PREFS, dyslexiaFont: 'opendyslexic' })
        const root = document.documentElement
        expect(root.classList.contains('font-opendyslexic')).toBe(true)
        expect(root.getAttribute('data-dyslexia-font')).toBe('opendyslexic')

        applyReadingPrefs({ ...DEFAULT_READING_PREFS, dyslexiaFont: 'off' })
        expect(root.classList.contains('font-opendyslexic')).toBe(false)
        expect(root.getAttribute('data-dyslexia-font')).toBe('off')
    })
})
