import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

vi.mock('../lib/supabase', () => {
    const buildChain = (table) => {
        const dataByTable = {
            mastery: masteryRows,
            social_signals: socialSignalRows,
            social_presence: socialPresenceRows,
            course_progress: progressRows,
        }
        const chain = {
            select: () => chain,
            eq: () => chain,
            order: async () => ({ data: dataByTable[table] || [], error: null }),
            gte: async () => ({ data: dataByTable[table] || [], error: null }),
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

        expect(await screen.findByText('Concepts needing attention')).toBeInTheDocument()
        expect(screen.getAllByText('instructional design').length).toBeGreaterThan(0)
        expect(screen.getByText('Where peers are clustering now')).toBeInTheDocument()
        expect(screen.getAllByText('inst-design/01/01').length).toBeGreaterThan(0)
        expect(screen.getByText('Help, reaction, and completion balance')).toBeInTheDocument()
    })
})
