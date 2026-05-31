import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    LLM_API_BASE: '/api',
}))

// Walks the wizard to the final step with all trace fields populated so the
// support-move controls are visible and a trace can be submitted.
async function stepToReview() {
    fireEvent.change(screen.getByPlaceholderText(/Paste or summarize the current draft/i), {
        target: { value: 'The first draft states a work product direction before critique.' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Next/i })[0])

    fireEvent.change(screen.getByPlaceholderText(/Audience, constraint/i), {
        target: { value: 'Audience and constraint are named clearly.' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Rubric line, annotation/i), {
        target: { value: 'Rubric line and annotation evidence are cited.' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Next/i })[0])

    fireEvent.change(screen.getByPlaceholderText(/What did you accept/i), {
        target: { value: 'The accepted suggestion improved evidence alignment.' },
    })
    fireEvent.change(screen.getByPlaceholderText(/What did you reject or modify/i), {
        target: { value: 'A vague suggestion was rejected for weak evidence.' },
    })
    // The AI Feedback Judgment Gate uses progressive disclosure: the rationale
    // field only appears after an explicit accept/modify/reject/defer choice.
    fireEvent.click(screen.getByRole('button', { name: /^Modify$/i }))
    fireEvent.change(screen.getByPlaceholderText(/Name the evidence that drove this judgment/i), {
        target: { value: 'The suggestion needed modification because the context was too broad.' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Next/i })[0])

    fireEvent.change(screen.getByPlaceholderText(/Paste or summarize the revised version/i), {
        target: { value: 'The revised artifact now connects evidence to a specific course deliverable.' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Where would this decision change next/i), {
        target: { value: 'The decision must be rechecked in a different classroom setting.' },
    })
}

describe('ArtifactStudio support-move telemetry integrity', () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    function mockScorer() {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                validator_pass: true,
                validation_errors: [],
                scores: { overall_revision_quality: 0.81 },
                privacy: { raw_text_persisted: false },
                policy_version: 'artifact-revision-scorer-v1',
            }),
        })
    }

    it('logs the learner-selected support_move, which can differ from the frozen "explain" constant', async () => {
        mockScorer()

        render(
            <ArtifactStudio
                artifact="AI critique log showing accepted, modified, and rejected suggestions"
                course="CAT 100"
                section="01.06"
                sectionId="cat100-supplement/01/06"
                conceptIds={['artifact_trace']}
            />,
        )

        await stepToReview()

        // Explicitly select a support move that is NOT 'explain'.
        fireEvent.click(screen.getByRole('button', { name: /Compare/i }))

        fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }))

        await waitFor(() => {
            expect(logEvent).toHaveBeenCalled()
        })

        const loggedPayload = logEvent.mock.calls[0][2]
        // The frozen-bug regression: support_move was always 'explain'. It must
        // now reflect the learner's explicit selection.
        expect(loggedPayload.support_move).toBe('compare')
        expect(loggedPayload.support_move).not.toBe('explain')
        expect(loggedPayload.support_move_overridden).toBe(true)
        // The recommended move is still persisted alongside the selected one.
        expect(loggedPayload.recommended_support_move).toBe('audit')

        // AI Feedback Judgment Gate is logged as a first-class trace field.
        expect(loggedPayload.judgment).toBe('modify')
        expect(loggedPayload.ai_feedback_judgment.value).toBe('modify')
        expect(loggedPayload.ai_feedback_judgment.resolved).toBe(true)
        // Scored before/after artifact states are exported as live policy inputs.
        expect(loggedPayload.artifact_quality).toBe(loggedPayload.after_quality_score)
        expect(typeof loggedPayload.artifact_gap).toBe('number')
        expect(loggedPayload.artifact_gap).toBeCloseTo(1 - loggedPayload.artifact_quality, 5)
        expect(loggedPayload).toHaveProperty('before_quality_score')
        expect(loggedPayload).toHaveProperty('artifact_revision_delta')

        const adaptivePayload = recordAdaptiveSignal.mock.calls.find(
            (call) => call[1] === 'artifact_studio_trace',
        )[2]
        expect(adaptivePayload.supportMove).toBe('compare')
        expect(adaptivePayload.recommendedSupportMove).toBe('audit')
        expect(adaptivePayload.supportMoveOverridden).toBe(true)
        // artifact_quality and artifact_gap are fed INTO the live policy signal.
        expect(adaptivePayload.artifactQuality).toBe(loggedPayload.artifact_quality)
        expect(adaptivePayload.artifactGap).toBe(loggedPayload.artifact_gap)
        expect(adaptivePayload.judgment).toBe('modify')
    })

    it('defaults the logged support_move to the recommended move (not a frozen constant) when the learner does not override', async () => {
        mockScorer()

        render(
            <ArtifactStudio
                artifact="AI critique log showing accepted, modified, and rejected suggestions"
                course="CAT 100"
                section="01.06"
                sectionId="cat100-supplement/01/06"
                conceptIds={['artifact_trace']}
            />,
        )

        await stepToReview()

        fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }))

        await waitFor(() => {
            expect(logEvent).toHaveBeenCalled()
        })

        const loggedPayload = logEvent.mock.calls[0][2]
        // A full trace (8/8 fields) recommends 'audit'; the logged move follows
        // the recommendation rather than the old hard-coded 'explain'.
        expect(loggedPayload.support_move).toBe('audit')
        expect(loggedPayload.support_move).not.toBe('explain')
        expect(loggedPayload.support_move_overridden).toBe(false)
        expect(loggedPayload.recommended_support_move).toBe('audit')
    })
})
