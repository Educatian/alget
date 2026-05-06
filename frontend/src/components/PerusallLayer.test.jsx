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

    it('expands the collapsed bar, captures a local note, and exposes a Helpful reaction', async () => {
        render(
            <PerusallLayer
                sectionId="ail606-supplement/05/01"
                conceptIds={['design_claims', 'artifact_evidence']}
            />,
        )

        // Collapsed bar shows the count + sync badge + Add note CTA
        expect(screen.getByText('Annotations')).toBeInTheDocument()
        expect(screen.getByText('Local')).toBeInTheDocument()

        // Add note opens the inline composer
        fireEvent.click(screen.getByRole('button', { name: /Add note/i }))

        // Default tag is 'question' — the placeholder reflects it
        const noteField = screen.getByPlaceholderText(/Write a question/i)
        fireEvent.change(noteField, { target: { value: 'This is a confusion that the storyboard claim has no evidence.' } })

        fireEvent.click(screen.getByRole('button', { name: /^Post$/i }))

        // Posted note appears in the list
        expect(screen.getByText('This is a confusion that the storyboard claim has no evidence.')).toBeInTheDocument()

        // Helpful reaction works
        fireEvent.click(screen.getByRole('button', { name: /^Helpful$/i }))
        expect(screen.getByRole('button', { name: /Helpful 1/i })).toBeInTheDocument()

        const persisted = JSON.parse(
            window.localStorage.getItem('alget_perusall_annotations_ail606-supplement/05/01'),
        )
        expect(persisted).toEqual([
            expect.objectContaining({
                body: 'This is a confusion that the storyboard claim has no evidence.',
                tag: 'question',
                source: 'local',
            }),
        ])
        expect(logEvent).toHaveBeenCalledWith(
            'annotation_create',
            'perusall_layer',
            expect.objectContaining({
                annotation_type: 'question',
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
            expect.objectContaining({ annotationType: 'question' }),
        )
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/05/01',
            'annotation_reaction',
            expect.objectContaining({ reactionType: 'helpful' }),
        )
    })
})
