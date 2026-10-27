import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const history = { data: null }
const chain = {
    select: () => chain, eq: () => chain, upsert: async () => ({}),
    maybeSingle: () => new Promise((r) => setTimeout(() => r(history), 20)),
}
vi.mock('../lib/supabase', () => ({ supabase: { from: () => chain } }))
vi.mock('../lib/loggingService', () => ({ logChatMessage: vi.fn() }))
vi.mock('../lib/knowledgeService', () => ({ fuseTelemetry: vi.fn(async () => {}), recordAdaptiveSignal: vi.fn() }))

Element.prototype.scrollIntoView = () => {}

const { default: ChatWidget } = await import('./ChatWidget')

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('ChatWidget auto-send (chapter check-in)', () => {
    it.each([['before history loads', 0], ['after history loads', 60]])('shows and sends the message %s', async (_, delay) => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ text: 'Nice work' }) })
        render(<ChatWidget userId="u1" context={{ course: 'statics', sectionId: 'statics/01/05' }} />)
        if (delay) await act(() => new Promise((r) => setTimeout(r, delay)))
        act(() => { window.dispatchEvent(new CustomEvent('open-chat', { detail: { autoSend: true, message: 'Chapter check-in: my idea' } })) })
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(screen.getByText('Chapter check-in: my idea')).toBeInTheDocument()
        expect(await screen.findByText('Nice work')).toBeInTheDocument()

        // A follow-up question carries the check-in and BigAL's reply as history.
        act(() => { window.dispatchEvent(new CustomEvent('open-chat', { detail: { message: 'What did I miss?' } })) })
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        const { history } = JSON.parse(fetchMock.mock.calls[1][1].body)
        expect(history).toEqual([
            { role: 'user', content: 'Chapter check-in: my idea' },
            { role: 'assistant', content: 'Nice work' },
        ])
    })
})
