import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PerusallLayer from './PerusallLayer'
import { logEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'

vi.mock('../lib/supabase', () => ({
    isSupabaseConfigured: false,
    supabase: {},
}))

vi.mock('../lib/loggingService', () => ({
    logEvent: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    recordAdaptiveSignal: vi.fn(),
}))

describe('PerusallLayer local annotation integration', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-05T12:00:00.000Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('creates, displays, persists, filters, and reacts to a local public note', () => {
        render(
            <PerusallLayer
                sectionId="ail606-supplement/05/01"
                sectionTitle="From Rationale to Testable Hypotheses"
                conceptIds={['design_claims', 'artifact_evidence']}
            />,
        )

        expect(screen.getByText('Local only')).toBeInTheDocument()
        expect(screen.getByText('design claims')).toBeInTheDocument()
        expect(screen.getByText('artifact evidence')).toBeInTheDocument()

        const quoteText = 'The design claim must name the artifact evidence.'
        const bodyText = 'This question asks whether the artifact trace is specific enough.'

        fireEvent.change(screen.getByPlaceholderText(/capture or paste the passage/i), {
            target: { value: quoteText },
        })
        fireEvent.change(screen.getByPlaceholderText(/Write a question for From Rationale/i), {
            target: { value: bodyText },
        })
        fireEvent.click(screen.getByRole('button', { name: /Add Public Note/i }))

        expect(screen.getByText('The design claim must name the artifact evidence.')).toBeInTheDocument()
        expect(screen.getByText('This question asks whether the artifact trace is specific enough.')).toBeInTheDocument()
        expect(screen.getByText('1 visible of 1 notes')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Helpful/i }))
        expect(screen.getByRole('button', { name: /Helpful 1/i })).toBeInTheDocument()

        const persisted = JSON.parse(
            window.localStorage.getItem('alget_perusall_annotations_ail606-supplement/05/01'),
        )
        expect(persisted).toEqual([
            expect.objectContaining({
                quote: 'The design claim must name the artifact evidence.',
                body: 'This question asks whether the artifact trace is specific enough.',
                tag: 'question',
                source: 'local',
            }),
        ])
        expect(logEvent).toHaveBeenCalledWith(
            'annotation_create',
            'perusall_layer',
            expect.objectContaining({
                annotation_type: 'question',
                quote_length: quoteText.length,
                body_length: bodyText.length,
                concept_ids: ['design_claims', 'artifact_evidence'],
                synced: false,
            }),
            'ail606-supplement/05/01',
        )
        expect(logEvent).toHaveBeenCalledWith(
            'annotation_reaction',
            'perusall_layer',
            expect.objectContaining({ reaction_type: 'helpful' }),
            'ail606-supplement/05/01',
        )
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/05/01',
            'annotation_create',
            expect.objectContaining({
                annotationType: 'question',
                quoteLength: quoteText.length,
                bodyLength: bodyText.length,
            }),
        )
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/05/01',
            'annotation_reaction',
            expect.objectContaining({ reactionType: 'helpful' }),
        )
    })
})
