import { afterEach, describe, expect, it, vi } from 'vitest'

const saved = new Map()
const upsert = vi.fn(async (rows, options) => {
    // Mirrors event_logs' unique (session_id, sequence_num): duplicates are skipped only when asked.
    const dupes = rows.filter((row) => saved.has(`${row.session_id}:${row.sequence_num}`))
    if (dupes.length && !options?.ignoreDuplicates) return { error: { code: '23505' } }
    rows.forEach((row) => saved.set(`${row.session_id}:${row.sequence_num}`, row))
    return { error: null }
})
let authListener = null
vi.mock('./supabase', () => ({
    isSupabaseConfigured: true,
    supabaseConfig: { url: 'https://db.example', anonKey: 'anon' },
    supabase: {
        from: (table) => (table === 'event_logs'
            ? { upsert }
            : { insert: async () => ({ error: null }), update: () => ({ eq: async () => ({ error: null }) }) }),
        auth: {
            getSession: async () => ({ data: { session: { access_token: 'token-1' } } }),
            onAuthStateChange: (callback) => {
                authListener = callback
                return { data: { subscription: { unsubscribe: () => { authListener = null } } } }
            },
        },
    },
}))
vi.mock('./apiConfig', () => ({ default: 'https://api.example/api' }))

const { initSession, logEvent, endSession } = await import('./loggingService')

afterEach(async () => {
    await endSession()
    saved.clear()
    upsert.mockClear()
})

describe('event logging', () => {
    it('keeps saving after a batch that was already saved is sent again', async () => {
        await initSession({ id: 'user-1' })
        // First save reaches the database, but its reply is lost, so the batch is queued again.
        upsert.mockImplementationOnce(async (rows) => {
            rows.forEach((row) => saved.set(`${row.session_id}:${row.sequence_num}`, row))
            return { error: { message: 'Failed to fetch' } }
        })
        logEvent('page_view', 'a')
        Object.defineProperty(document, 'hidden', { value: true, configurable: true })
        window.dispatchEvent(new Event('visibilitychange'))
        await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(1))
        Object.defineProperty(document, 'hidden', { value: false, configurable: true })

        logEvent('quiz_answer', 'q1')
        await endSession()

        expect(upsert).toHaveBeenLastCalledWith(expect.any(Array), { onConflict: 'session_id,sequence_num', ignoreDuplicates: true })
        expect([...saved.values()].map((row) => row.event_type)).toEqual(['page_view', 'quiz_answer', 'session_end'])
    })

    it('sends the last events with the newest access token when the tab closes', async () => {
        const sendBeacon = vi.fn(() => true)
        Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
        await initSession({ id: 'user-1' })
        authListener?.('TOKEN_REFRESHED', { access_token: 'token-2' })

        logEvent('page_view', 'a')
        window.dispatchEvent(new Event('beforeunload'))

        const blob = sendBeacon.mock.calls[0][1]
        const body = JSON.parse(await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.readAsText(blob)
        }))
        expect(body.access_token).toBe('token-2')
        expect(body.events.map((event) => event.event_type)).toEqual(['page_view'])
    })
})
