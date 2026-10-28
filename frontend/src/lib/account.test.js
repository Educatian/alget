import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authHeaders, currentSession, flush, signIn, signOut } from './account'

const TOKEN = 'a'.repeat(64)

/** A fake tutor worker: one account, a progress store, and a log of what was sent. */
function fakeWorker(serverItems = {}) {
    const sent = []
    const items = { ...serverItems }
    globalThis.fetch = vi.fn(async (url, init = {}) => {
        const path = String(url).replace(/^.*?(\/(login|logout|progress))$/, '$1')
        if (path === '/login') {
            const { password } = JSON.parse(init.body)
            return password === 'maple-river-42'
                ? new Response(JSON.stringify({ token: TOKEN, id: 'TAMU-007' }), { status: 200 })
                : new Response(JSON.stringify({ error: 'bad_credentials' }), { status: 401 })
        }
        if (path === '/progress' && init.method === 'POST') {
            const { set } = JSON.parse(init.body)
            sent.push(set)
            for (const [k, v] of Object.entries(set)) v === null ? delete items[k] : (items[k] = v)
            return new Response(JSON.stringify({ ok: true }), { status: 200 })
        }
        if (path === '/progress') return new Response(JSON.stringify({ id: 'TAMU-007', items }), { status: 200 })
        return new Response('{}', { status: 200 })
    })
    return { sent, items }
}

describe('TAMU accounts', () => {
    beforeEach(() => window.localStorage.clear())
    afterEach(() => vi.restoreAllMocks())

    it('rejects a wrong password and stores no session', async () => {
        fakeWorker()
        expect(await signIn('7', 'wrong')).toEqual({ error: 'bad_credentials', minutes: undefined })
        expect(currentSession()).toBeNull()
    })

    it('loads the student copy, replacing what another reader left, and sends later changes', async () => {
        window.localStorage.setItem('alget_review_v1', '{"someone":"else"}')
        const worker = fakeWorker({ 'alget_highlights_v1:ai-literacy/01/02': '[{"id":1}]' })
        expect(await signIn('TAMU-007', 'maple-river-42')).toEqual({ id: 'TAMU-007' })
        expect(authHeaders()).toEqual({ Authorization: `Bearer ${TOKEN}` })
        expect(window.localStorage.getItem('alget_review_v1')).toBeNull()
        expect(window.localStorage.getItem('alget_highlights_v1:ai-literacy/01/02')).toBe('[{"id":1}]')
        expect(worker.sent).toEqual([])

        window.localStorage.setItem('alget_reader_prefs_v1', '{"size":"l"}')
        window.localStorage.removeItem('alget_highlights_v1:ai-literacy/01/02')
        window.localStorage.setItem('openrouter_api_key', 'never-synced')
        await flush()
        expect(worker.sent).toEqual([{ alget_reader_prefs_v1: '{"size":"l"}', 'alget_highlights_v1:ai-literacy/01/02': null }])
        expect(worker.items).toEqual({ alget_reader_prefs_v1: '{"size":"l"}' })
    })

    it('signing out sends what is left and clears the student data from this browser', async () => {
        const worker = fakeWorker()
        await signIn('TAMU-007', 'maple-river-42')
        window.localStorage.setItem('alget_review_v1', '{"c1":{}}')
        await signOut()
        expect(worker.items).toEqual({ alget_review_v1: '{"c1":{}}' })
        expect(window.localStorage.getItem('alget_review_v1')).toBeNull()
        expect(currentSession()).toBeNull()
    })
})
