import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    safeLocalStorageGet,
    safeLocalStorageSet,
    safeSessionStorageGet,
    safeSessionStorageSet
} from './browserStorage'

describe('browserStorage', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('falls back safely when localStorage access throws', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })

        expect(safeLocalStorageGet('test-key', 'fallback')).toBe('fallback')
        expect(safeLocalStorageSet('test-key', 'value')).toBe(false)
        expect(warnSpy).toHaveBeenCalledTimes(2)
    })

    it('falls back safely when sessionStorage access throws', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })

        expect(safeSessionStorageGet('test-key', 'fallback')).toBe('fallback')
        expect(safeSessionStorageSet('test-key', 'value')).toBe(false)
        expect(warnSpy).toHaveBeenCalledTimes(2)
    })
})
