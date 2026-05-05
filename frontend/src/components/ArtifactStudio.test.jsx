import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ArtifactStudio from './ArtifactStudio'
import { logEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'

vi.mock('../lib/loggingService', () => ({
    logEvent: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    recordAdaptiveSignal: vi.fn(),
    getAdaptiveRecommendation: vi.fn().mockResolvedValue({
        primary_action: 'practice',
        recommended_because: ['Artifact evidence supports a practice move.'],
        evidence: [],
    }),
}))

vi.mock('../lib/apiConfig', () => ({
    default: '/api',
}))

describe('ArtifactStudio markdown contract surface', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('logs the required artifact trace fields from markdown-provided props', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                validator_pass: true,
                validation_errors: [],
                scores: {
                    claim_clarity: 0.8,
                    evidence_alignment: 0.75,
                    revision_depth: 0.9,
                    judgment_quality: 0.8,
                    transfer_readiness: 0.7,
                    specificity_delta: 0.85,
                    overall_revision_quality: 0.81,
                },
                privacy: { raw_text_persisted: false },
                policy_version: 'artifact-revision-scorer-v1',
            }),
        })

        render(
            <ArtifactStudio
                artifact="AI critique log showing accepted, modified, and rejected suggestions"
                course="CAT 100"
                section="01.06"
                sectionId="cat100-supplement/01/06"
                conceptIds={['artifact_trace']}
            />,
        )

        expect(screen.getByText('Artifact Definition')).toBeInTheDocument()
        expect(screen.getByText('File Specification')).toBeInTheDocument()
        expect(screen.getByText(/concrete course deliverable/i)).toBeInTheDocument()
        expect(screen.getByText(/generic reflection with no inspectable product/i)).toBeInTheDocument()
        expect(screen.getByText(/artifact\.\(md\|docx\|pdf\|pptx\|xlsx\|csv\|png\)/i)).toBeInTheDocument()
        expect(screen.getByText(/artifact claim; evidence source/i)).toBeInTheDocument()

        fireEvent.click(screen.getByTitle('Compare support'))
        fireEvent.change(screen.getByLabelText(/Initial Work Product Draft/i), {
            target: { value: 'The first draft states a work product direction before critique.' },
        })
        fireEvent.change(screen.getByLabelText(/Artifact Claim/i), {
            target: { value: 'Audience and constraint are named clearly.' },
        })
        fireEvent.change(screen.getByPlaceholderText(/Rubric line, annotation/i), {
            target: { value: 'Rubric line and annotation evidence are cited.' },
        })
        fireEvent.change(screen.getByPlaceholderText(/What changed/i), {
            target: { value: 'The accepted suggestion improved evidence alignment.' },
        })
        fireEvent.change(screen.getByPlaceholderText(/What did you reject/i), {
            target: { value: 'A vague suggestion was rejected for weak evidence.' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Modify/i }))
        fireEvent.change(screen.getByLabelText(/Judgment Rationale/i), {
            target: { value: 'The suggestion needed modification because the context was too broad.' },
        })
        fireEvent.change(screen.getByLabelText(/Revised Work Product/i), {
            target: { value: 'The revised artifact now connects evidence to a specific course deliverable.' },
        })
        fireEvent.change(screen.getByPlaceholderText(/Name the next audience/i), {
            target: { value: 'The decision must be rechecked in a different classroom setting.' },
        })
        fireEvent.change(screen.getByLabelText(/Confidence/i), {
            target: { value: '4' },
        })
        screen.getAllByRole('combobox').forEach((select) => {
            fireEvent.change(select, { target: { value: '2' } })
        })
        fireEvent.click(screen.getByRole('button', { name: /Log Trace 8\/8/i }))

        await waitFor(() => {
            expect(screen.getByText(/Overall 81%/i)).toBeInTheDocument()
        })

        const scoreRequest = JSON.parse(fetch.mock.calls[0][1].body)
        expect(scoreRequest.initial_draft).toContain('first draft states')
        expect(scoreRequest.revised_draft).toContain('revised artifact now connects')

        const loggedPayload = logEvent.mock.calls[0][2]
        const loggedPayloadText = JSON.stringify(loggedPayload)
        expect(loggedPayload.submission_id).toMatch(/^[\w-]+$/)
        expect(loggedPayload.source_text_metrics.initial_draft).toEqual(expect.objectContaining({
            char_count: expect.any(Number),
            present: true,
        }))
        expect(loggedPayload.source_text_metrics.initial_draft.char_count).toBeGreaterThan(40)
        expect(loggedPayload.raw_submission_privacy).toEqual(expect.objectContaining({
            raw_text_persisted: false,
            raw_text_sent_to_scorer: true,
            policy: 'raw-submission-derived-telemetry-v1',
        }))
        expect(loggedPayload.artifact_submission_spec_version).toBe('artifact-submission-spec-v1')
        expect(loggedPayload.artifact_required_files).toContain('revision-trace.md')
        expect(loggedPayload.artifact_accepted_formats).toContain('.md')
        expect(loggedPayload.artifact_required_sections).toContain('revised state')
        expect(loggedPayloadText).not.toContain('The first draft states a work product direction before critique.')
        expect(loggedPayloadText).not.toContain('The revised artifact now connects evidence to a specific course deliverable.')

        expect(fetch).toHaveBeenCalledWith(
            '/api/research/artifact-revision/score',
            expect.objectContaining({
                method: 'POST',
            }),
        )

        expect(logEvent).toHaveBeenCalledWith(
            'artifact_studio_trace',
            'artifact_studio',
            expect.objectContaining({
                artifact: 'AI critique log showing accepted, modified, and rejected suggestions',
                artifact_definition_id: 'general_work_product',
                artifact_family: 'Course Work Product',
                artifact_submission_spec_version: 'artifact-submission-spec-v1',
                artifact_required_files: expect.arrayContaining(['revision-trace.md']),
                artifact_accepted_formats: expect.arrayContaining(['.md', '.pdf']),
                artifact_required_sections: expect.arrayContaining(['artifact claim', 'transfer constraint']),
                course: 'CAT 100',
                section: '01.06',
                support_move: 'compare',
                studio_mode: 'traceability',
                trace_score: 8,
                trace_denominator: 8,
                artifact_quality_score: 1,
                recommended_support_move: 'audit',
                support_rationale: expect.stringContaining('final quality'),
                judgment: 'modify',
                revision_scores: expect.objectContaining({
                    overall_revision_quality: 0.81,
                }),
                revision_score_validation: expect.objectContaining({
                    validator_pass: true,
                }),
                source_text_metrics: expect.objectContaining({
                    initial_draft: expect.objectContaining({ present: true }),
                    revised_draft: expect.objectContaining({ present: true }),
                }),
                raw_submission_privacy: expect.objectContaining({
                    raw_text_persisted: false,
                }),
                confidence: 4,
                rubric: expect.objectContaining({
                    claim_visibility: 2,
                    evidence_specificity: 2,
                    support_boundary: 2,
                    revision_quality: 2,
                    rejection_rationale: 2,
                    transfer_constraint: 2,
                }),
            }),
            'cat100-supplement/01/06',
        )
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'cat100-supplement/01/06',
            'artifact_studio_trace',
            expect.objectContaining({
                artifactQualityScore: 1,
                artifactSubmissionSpecVersion: 'artifact-submission-spec-v1',
                traceCompleteness: 1,
                recommendedSupportMove: 'audit',
                supportMove: 'compare',
                judgment: 'modify',
            }),
        )
    })
})
