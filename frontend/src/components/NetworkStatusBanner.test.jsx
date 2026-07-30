import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import NetworkStatusBanner from './NetworkStatusBanner'

describe('NetworkStatusBanner', () => {
    afterEach(() => cleanup())

    it('announces an offline state and clears it after reconnecting', () => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
        render(<NetworkStatusBanner />)
        expect(screen.getByRole('status')).toHaveTextContent(/You are offline/i)

        act(() => window.dispatchEvent(new Event('online')))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})
