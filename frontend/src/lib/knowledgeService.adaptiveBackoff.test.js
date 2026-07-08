import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
    supabase: {
        auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
        from: vi.fn(),
    },
}))

vi.mock('./researchService', () => ({
    buildLearnerProfileSnapshot: vi.fn(() => ({ snapshot: true })),
    startInterventionTrace: vi.fn(() => ({ trace_id: 'trace-1' })),
}))

import { getAdaptiveRecommendation, _resetAdaptiveBackoffForTests } from './knowledgeService'

const REQUEST = {
    sectionId: 'inst-design/01/02',
    sectionTitle: 'Test section',
    conceptIds: ['gagne_nine_events'],
}

function mockFetchSequence(...results) {
    const fn = vi.fn()
    results.forEach((result) => {
        if (result === 'ok') {
            fn.mockResolvedValueOnce({ ok: true, json: async () => ({ action: 'hint' }) })
        } else {
            fn.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
        }
    })
    globalThis.fetch = fn
    return fn
}

describe('getAdaptiveRecommendation backoff / circuit breaker', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        _resetAdaptiveBackoffForTests()
        vi.spyOn(console, 'info').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('keeps the success path identical (data + client_trace_id)', async () => {
        const fetchMock = mockFetchSequence('ok')
        const result = await getAdaptiveRecommendation(REQUEST)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(result).toMatchObject({ action: 'hint', client_trace_id: 'trace-1' })
    })

    it('does not re-fetch during the backoff window after a 503', async () => {
        const fetchMock = mockFetchSequence(503, 503)

        expect(await getAdaptiveRecommendation(REQUEST)).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        // Immediate retry (the old tight loop) is swallowed without a request.
        expect(await getAdaptiveRecommendation(REQUEST)).toBeNull()
        expect(await getAdaptiveRecommendation(REQUEST)).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        // After the first 1s step elapses, one retry is allowed again.
        vi.advanceTimersByTime(1100)
        expect(await getAdaptiveRecommendation(REQUEST)).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('opens the circuit for the session after the ladder (1s/4s/15s) is exhausted, with one console.info', async () => {
        const fetchMock = mockFetchSequence(503, 503, 503, 503)

        await getAdaptiveRecommendation(REQUEST) // failure 1 -> wait 1s
        vi.advanceTimersByTime(1100)
        await getAdaptiveRecommendation(REQUEST) // failure 2 -> wait 4s
        vi.advanceTimersByTime(4100)
        await getAdaptiveRecommendation(REQUEST) // failure 3 -> wait 15s
        vi.advanceTimersByTime(15100)
        await getAdaptiveRecommendation(REQUEST) // failure 4 -> circuit opens
        expect(fetchMock).toHaveBeenCalledTimes(4)
        expect(console.info).toHaveBeenCalledTimes(1)
        expect(console.info.mock.calls[0][0]).toMatch(/pausing further attempts/i)

        // Circuit open: even much later, no further network attempts or logs.
        vi.advanceTimersByTime(10 * 60 * 1000)
        expect(await getAdaptiveRecommendation(REQUEST)).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(4)
        expect(console.info).toHaveBeenCalledTimes(1)
    })

    it('a success after a failure resets the ladder', async () => {
        const fetchMock = mockFetchSequence(503, 'ok', 503)

        await getAdaptiveRecommendation(REQUEST) // failure 1
        vi.advanceTimersByTime(1100)
        const ok = await getAdaptiveRecommendation(REQUEST) // success resets
        expect(ok).toMatchObject({ action: 'hint' })

        await getAdaptiveRecommendation(REQUEST) // failure -> back to step 1 (1s)
        expect(fetchMock).toHaveBeenCalledTimes(3)
        // Blocked inside the fresh 1s window, allowed right after.
        expect(await getAdaptiveRecommendation(REQUEST)).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(3)
        vi.advanceTimersByTime(1100)
        mockFetchSequence('ok')
        const again = await getAdaptiveRecommendation(REQUEST)
        expect(again).toMatchObject({ action: 'hint' })
    })
})
