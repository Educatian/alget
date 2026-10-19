import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/loggingService', () => ({ logChatMessage: vi.fn() }))
vi.mock('../lib/knowledgeService', () => ({ fuseTelemetry: vi.fn(), recordAdaptiveSignal: vi.fn() }))

const { default: ChatWidget } = await import('./ChatWidget')

afterEach(cleanup)

function openFor(course) {
    render(<ChatWidget context={{ course, sectionId: `${course}/01/01` }} />)
    fireEvent.click(screen.getByRole('button', { name: /open bigal tutor chat/i }))
}

describe('ChatWidget course context', () => {
    it('describes itself as a Statics tutor in the Statics course', () => {
        openFor('statics')
        expect(screen.getByText('Engineering Statics')).toBeInTheDocument()
        expect(screen.queryByText(/biological mechanisms/i)).not.toBeInTheDocument()
    })

    it('describes itself as a Dynamics tutor in the Dynamics course', () => {
        openFor('dynamics')
        expect(screen.getByText('Engineering Dynamics')).toBeInTheDocument()
    })

    it('keeps the bio-inspired wording in the Bio-Inspired Design course', () => {
        openFor('bio-inspired')
        expect(screen.getByText('Bio-Inspired Engineering')).toBeInTheDocument()
        expect(screen.getByText(/biological mechanisms/i)).toBeInTheDocument()
    })
})
