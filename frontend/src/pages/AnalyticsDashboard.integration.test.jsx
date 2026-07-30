import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import AnalyticsDashboard from './AnalyticsDashboard'

vi.mock('../lib/browserStorage', () => ({
    safeSessionStorageGet: vi.fn(() => 'granted'),
    safeSessionStorageSet: vi.fn(),
    safeSessionStorageRemove: vi.fn(),
    safeLocalStorageGet: vi.fn(() => null),
    safeLocalStorageSet: vi.fn(),
}))

const masteryRows = [
    {
        concept_id: 'instructional_design',
        mastery_score: 0.34,
        confidence_level: 'low',
        correct_count: 1,
        attempts_count: 4,
    },
    {
        concept_id: 'learning_theories',
        mastery_score: 0.84,
        confidence_level: 'high',
        correct_count: 5,
        attempts_count: 6,
    },
]

const socialSignalRows = [
    { section_id: 'inst-design/01/01', course: 'inst-design', signal_type: 'reaction', signal_value: 'this_clicked', created_at: '2026-03-29T10:00:00Z' },
    { section_id: 'inst-design/01/01', course: 'inst-design', signal_type: 'help_open', signal_value: null, created_at: '2026-03-29T10:10:00Z' },
    { section_id: 'inst-design/02/01', course: 'inst-design', signal_type: 'completion', signal_value: null, created_at: '2026-03-29T10:20:00Z' },
]

const socialPresenceRows = [
    { presence_key: 'reader-1', alias: 'Peer A', course: 'inst-design', section_id: 'inst-design/01/01', last_seen_at: '2026-03-29T10:01:00Z' },
    { presence_key: 'reader-2', alias: 'Peer B', course: 'inst-design', section_id: 'inst-design/01/01', last_seen_at: '2026-03-29T10:02:00Z' },
]

const progressRows = [
    { course: 'inst-design', section_id: 'inst-design/02/01', completed_at: '2026-03-29T10:20:00Z' },
]

const artifactRevisionRows = [
    {
        course_id: 'inst-design',
        section_id: 'inst-design/01/01',
        studio_mode: 'traceability',
        artifact_type: 'AI critique log',
        score_count: 4,
        learner_count: 3,
        avg_claim_clarity: 0.72,
        avg_evidence_alignment: 0.46,
        avg_revision_depth: 0.42,
        avg_judgment_quality: 0.58,
        avg_transfer_readiness: 0.63,
        avg_specificity_delta: 0.44,
        avg_overall_revision_quality: 0.52,
        weak_evidence_count: 2,
        shallow_revision_count: 2,
        judgment_risk_count: 1,
        transfer_ready_count: 1,
        latest_score_at: '2026-03-29T10:30:00Z',
    },
]

vi.mock('../lib/supabase', () => {
    const buildChain = (table) => {
        const dataByTable = {
            mastery: masteryRows,
            social_signals: socialSignalRows,
            social_presence: socialPresenceRows,
            course_progress: progressRows,
            learner_concept_state: [],
            intervention_traces: [],
            recommendation_decisions: [],
            evaluation_runs: [],
            content_audits: [],
            artifact_revision_cohort_summary: artifactRevisionRows,
            rct_intervention_outcomes: [],
            rct_evaluation_gains: [],
            rct_user_telemetry_profile: [],
            rct_evaluation_item_diagnostics: [],
        }
        const chain = {
            select: () => chain,
            eq: () => chain,
            order: () => chain,
            gte: async () => ({ data: dataByTable[table] || [], error: null }),
            limit: async () => ({ data: dataByTable[table] || [], error: null }),
            then: (resolve) => resolve({ data: dataByTable[table] || [], error: null }),
        }
        return chain
    }

    return {
        isSupabaseConfigured: true,
        supabase: {
            auth: {
                getSession: async () => ({ data: { session: { user: { id: 'researcher-1' } } } }),
            },
            from: (table) => buildChain(table),
        },
    }
})

describe('AnalyticsDashboard integration', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('renders intervention and concurrency insights from live analytics data', async () => {
        render(
            <MemoryRouter>
                <AnalyticsDashboard />
            </MemoryRouter>,
        )

        expect(await screen.findByText(/Intervention queue/i)).toBeInTheDocument()
        expect(screen.getAllByText('instructional design').length).toBeGreaterThan(0)
        expect(screen.getByText(/Live section concurrency/i)).toBeInTheDocument()
        expect(screen.getAllByText('inst-design/01/01').length).toBeGreaterThan(0)
        expect(screen.getByText(/Signal mix today/i)).toBeInTheDocument()
        expect(screen.getByText(/Artifact revision/i)).toBeInTheDocument()
        expect(screen.getByText('Weak evidence alignment')).toBeInTheDocument()
    })
})
