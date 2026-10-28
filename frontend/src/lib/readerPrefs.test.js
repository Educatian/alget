import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_READER_PREFS, applyReaderPrefs, loadReaderPrefs, saveReaderPrefs } from './readerPrefs'

describe('reader preferences', () => {
    beforeEach(() => window.localStorage.clear())

    it('falls back to defaults and ignores unknown saved values', () => {
        expect(loadReaderPrefs()).toEqual(DEFAULT_READER_PREFS)
        window.localStorage.setItem('alget_reader_prefs_v1', JSON.stringify({ size: 'xl', leading: 'huge' }))
        expect(loadReaderPrefs()).toMatchObject({ size: 'xl', leading: 'standard' })
    })

    it('round-trips and writes the CSS variables the reading column uses', () => {
        saveReaderPrefs({ ...DEFAULT_READER_PREFS, leading: 'relaxed', measure: 'narrow' })
        const root = document.createElement('div')
        applyReaderPrefs(loadReaderPrefs(), root)
        expect(root.style.getPropertyValue('--reader-line-height')).toBe('2.05')
        expect(root.style.getPropertyValue('--reader-measure')).toBe('54ch')
        expect(root.style.getPropertyValue('--reader-font-size')).toBe('1.0625rem')
    })
})
