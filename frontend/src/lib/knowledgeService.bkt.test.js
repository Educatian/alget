import { afterEach, describe, expect, it, vi } from 'vitest'

const logEvent = vi.fn()
const upsert = vi.fn(async () => ({ error: null }))
vi.mock('./loggingService', () => ({ logEvent }))
vi.mock('./researchService', () => ({ buildLearnerProfileSnapshot: vi.fn(), startInterventionTrace: vi.fn() }))
vi.mock('./supabase', () => ({
    supabase: {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
        from: () => ({
            select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }),
            upsert,
        }),
    },
}))

const { updateMastery } = await import('./knowledgeService')

afterEach(() => {
    logEvent.mockClear()
    upsert.mockClear()
    vi.unstubAllGlobals()
})

function stubGrade(newStates) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ new_states: newStates }) })))
}

describe('updateMastery study record', () => {
    it('logs the BKT result when the mastery table rejects the concept', async () => {
        stubGrade({ van_der_waals: 0.42 })
        upsert.mockResolvedValueOnce({ error: { code: '23503' } })

        const result = await updateMastery({ van_der_waals: 1.0 }, true, { sectionId: 'bio-inspired/01/01' })

        expect(result).toEqual({ van_der_waals: 0.42 })
        expect(logEvent).toHaveBeenCalledWith('bkt_update', 'van_der_waals', expect.objectContaining({
            new_states: { van_der_waals: 0.42 },
            q_matrix: { van_der_waals: 1.0 },
            is_correct: true,
            hint_used: false,
            mastery_saved: false,
        }), 'bio-inspired/01/01')
        expect(upsert).toHaveBeenCalledTimes(1)
    })

    it('still writes both tables and logs when the concept is accepted', async () => {
        stubGrade({ tension: 0.3 })

        await updateMastery({ tension: 1.0 }, false, { sectionId: 'statics/01/01' })

        expect(logEvent).toHaveBeenCalledWith('bkt_update', 'tension', expect.objectContaining({ mastery_saved: true, is_correct: false }), 'statics/01/01')
        expect(upsert).toHaveBeenCalledTimes(2)
    })
})
