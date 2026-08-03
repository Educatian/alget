import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
    supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1' } } }) } },
}))

import { createEvaluationManifest, loadRoadmapManifest, recordAgentDecision } from './roadmapRuntimeService'

describe('roadmapRuntimeService', () => {
    beforeEach(() => vi.clearAllMocks())

    it('loads the public roadmap manifest with a session token when available', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ roadmap_contract: 'roadmap-runtime-v1' }) }))
        await expect(loadRoadmapManifest()).resolves.toEqual({ roadmap_contract: 'roadmap-runtime-v1' })
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/roadmap/manifest'), expect.objectContaining({ headers: { Authorization: 'Bearer token-1' } }))
    })

    it('posts a decision ledger event through the governed endpoint', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ event: { decision: 'modify' } }) }))
        await expect(recordAgentDecision({ course_id: 'ail-606', decision: 'modify' })).resolves.toEqual({ event: { decision: 'modify' } })
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/roadmap/decision-ledger'), expect.objectContaining({ method: 'POST' }))
    })

    it('surfaces API errors instead of silently writing learner data locally', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ detail: 'Identity provider unavailable' }) }))
        await expect(createEvaluationManifest({ course_id: 'ail-606' })).rejects.toThrow('Identity provider unavailable')
    })
})
