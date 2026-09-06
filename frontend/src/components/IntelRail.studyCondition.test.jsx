import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { getAdaptiveRecommendation, logEvent } = vi.hoisted(() => ({
    getAdaptiveRecommendation: vi.fn(),
    logEvent: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    getAdaptiveRecommendation,
    recordAdaptiveSignal: vi.fn(),
}))
vi.mock('../lib/loggingService', () => ({
    logEvent,
    logGenerationTrace: vi.fn(),
}))
vi.mock('../lib/researchService', () => ({
    appendInterventionTrace: vi.fn(),
    evaluateSupportContent: vi.fn(),
    incrementConceptInterventionCount: vi.fn(),
}))

import IntelRail from './IntelRail'
import { COMPARISON_ARM, TREATMENT_ARM } from '../lib/studyCondition'

const sectionInfo = {
    sectionId: 'bio-inspired/01/01',
    sectionTitle: 'Cellular Structures',
    conceptIds: ['load_path_efficiency'],
    pageContent: 'Course text',
}

describe('IntelRail study condition', () => {
    beforeEach(() => {
        getAdaptiveRecommendation.mockReset()
        logEvent.mockReset()
    })

    it('gives the comparison arm only fixed practice and makes no adaptive request', async () => {
        render(<IntelRail sectionInfo={sectionInfo} studyArm={COMPARISON_ARM} onClose={vi.fn()} />)

        expect(await screen.findByText('Continue with the fixed practice sequence')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Practice' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Explain' })).not.toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Ask' })).not.toBeInTheDocument()
        expect(getAdaptiveRecommendation).not.toHaveBeenCalled()
        expect(logEvent).toHaveBeenCalledWith(
            'study_fixed_support_displayed',
            'intel_rail',
            expect.objectContaining({ assignment_arm: COMPARISON_ARM }),
            sectionInfo.sectionId,
        )
    })

    it('keeps the adaptive path for the treatment arm', async () => {
        getAdaptiveRecommendation.mockResolvedValue({
            client_trace_id: 'trace-1',
            primary_recommendation: {
                action: 'explain',
                title: 'Review the load path',
                rationale: 'Recent evidence indicates a misconception.',
                focus_concepts: ['load_path_efficiency'],
            },
            secondary_recommendations: [],
        })
        render(<IntelRail sectionInfo={sectionInfo} studyArm={TREATMENT_ARM} onClose={vi.fn()} />)

        await waitFor(() => expect(getAdaptiveRecommendation).toHaveBeenCalledTimes(1))
        expect(await screen.findByText('Review the load path')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Explain' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Ask' })).toBeInTheDocument()
    })
})
