import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    fetchRuntimeJson,
    isSectionPayload,
    isTocPayload,
    RuntimeContractError,
} from './runtimeContract'

afterEach(() => vi.restoreAllMocks())

describe('runtime contract JSON boundary', () => {
    it('rejects a 200 Pages SPA fallback instead of treating it as a TOC', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('<!doctype html><html><body>ALGET</body></html>', {
                status: 200,
                headers: { 'content-type': 'text/html; charset=UTF-8' },
            }),
        ))

        await expect(fetchRuntimeJson('/api', '/book/missing/toc', {
            label: 'chapter list',
            validate: isTocPayload,
        })).rejects.toMatchObject({
            name: 'RuntimeContractError',
            kind: 'invalid_content_type',
        })
    })

    it('rejects JSON that does not satisfy the section shape', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ chapters: [] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        ))

        const request = fetchRuntimeJson('/api', '/book/inst-design/01/01', {
            validate: isSectionPayload,
        })
        await expect(request).rejects.toBeInstanceOf(RuntimeContractError)
        await expect(request).rejects.toMatchObject({ kind: 'invalid_payload' })
    })

    it('preserves HTTP status for a genuine missing section', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }),
        ))

        await expect(fetchRuntimeJson('/api', '/book/inst-design/99/99'))
            .rejects.toMatchObject({ kind: 'http_error', status: 404 })
    })
})
