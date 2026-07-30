import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GenerationTrace from './GenerationTrace'

const trace = {
    schema_version: 'generation-trace-v1',
    trace_id: 'trace-1',
    model: 'google/gemini-2.5-flash',
    prompt_version: 'bigal-tutor-hint-ladder-v2',
    output_hash: 'abcdef1234567890',
    source_status: 'context_attached',
    sources: [{
        source_id: 'ail606-supplement/01/01',
        title: 'Cognitive load foundations',
        locator: 'ail606-supplement/01/01',
        excerpt: 'Working memory is limited.',
    }],
    review: { status: 'not_human_reviewed' },
    limitations: ['Individual claims were not citation-verified.'],
}

describe('GenerationTrace', () => {
    it('discloses attached context without claiming citation verification', () => {
        render(<GenerationTrace trace={trace} />)
        fireEvent.click(screen.getByText(/Current section context used/i))

        expect(screen.getByText(/not been independently citation-verified/i)).toBeInTheDocument()
        expect(screen.getByText(/Cognitive load foundations/i)).toBeInTheDocument()
        expect(screen.getByText(/Not human-reviewed/i)).toBeInTheDocument()
        expect(screen.getByText('abcdef1234')).toBeInTheDocument()
    })

    it('warns when no source context is attached', () => {
        render(<GenerationTrace trace={{ ...trace, source_status: 'no_source_context', sources: [] }} />)
        expect(screen.getByText(/No source context attached/i)).toBeInTheDocument()
    })
})
