import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatWidget from './ChatWidget'

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({ maybeSingle: async () => ({ data: null }) }),
                }),
            }),
            upsert: async () => ({}),
            delete: () => ({ eq: () => ({ eq: async () => ({}) }) }),
        }),
    },
}))

vi.mock('../lib/loggingService', () => ({
    logChatMessage: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    fuseTelemetry: vi.fn(async () => {}),
    recordAdaptiveSignal: vi.fn(),
}))

function renderWidget(course = 'ai-ethics') {
    return render(
        <ChatWidget
            context={{
                sectionId: `${course}/01/01`,
                pageContent: '',
                sectionTitle: 'Test section',
                conceptIds: [],
                course,
            }}
        />,
    )
}

async function openWidget() {
    fireEvent.click(screen.getByRole('button', { name: /open bigal tutor chat/i }))
    return screen.findByLabelText(/type your question for bigal/i)
}

describe('ChatWidget', () => {
    beforeEach(() => {
        window.localStorage.clear()
        // jsdom does not implement scrollIntoView (used by the auto-scroll effect).
        Element.prototype.scrollIntoView = vi.fn()
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('shows a friendly offline message on a non-OK response instead of the error body', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: async () => ({ detail: 'Service Unavailable' }),
        })

        renderWidget()
        const input = await openWidget()
        fireEvent.change(input, { target: { value: 'What is fairness?' } })
        fireEvent.click(screen.getByRole('button', { name: /send message to bigal/i }))

        expect(
            await screen.findByText(/BigAL is offline right now/i),
        ).toBeInTheDocument()
        // The raw 503 body must never be rendered as the tutor's reply.
        expect(screen.queryByText(/Service Unavailable/i)).not.toBeInTheDocument()
    })

    it('names the actual course in the header persona and empty state', async () => {
        renderWidget('ai-ethics')
        await openWidget()

        expect(screen.getByText('AI and Ethics')).toBeInTheDocument()
        expect(
            screen.getByText(/Ask me about the ideas in this section of AI and Ethics\./i),
        ).toBeInTheDocument()
        expect(screen.queryByText(/Bio-Inspired/i)).not.toBeInTheDocument()
    })

    it('keeps the correct persona for engineering courses', async () => {
        renderWidget('statics')
        await openWidget()

        expect(screen.getByText('Engineering Statics')).toBeInTheDocument()
    })
})
