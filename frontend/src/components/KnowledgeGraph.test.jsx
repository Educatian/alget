import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import KnowledgeGraph from './KnowledgeGraph'

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(async () => ({ data: { session: null } })),
        },
    },
}))

vi.mock('../lib/apiConfig', () => ({
    default: '/api',
    LLM_API_BASE: '/api',
}))

describe('KnowledgeGraph action explanation', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows compact concept status signals', async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                nodes: [
                    {
                        id: 'current',
                        label: 'Current',
                        section_id: 'inst-design/01/01',
                        section_title: 'Current section',
                        chapter_order: 1,
                        section_order: 1,
                        concept_order: 1,
                        is_current: true,
                        p_known: 0.62,
                    },
                    {
                        id: 'developing',
                        label: 'Developing',
                        section_id: 'inst-design/01/02',
                        chapter_order: 1,
                        section_order: 2,
                        concept_order: 1,
                        status: 'emerging',
                        p_known: 0.42,
                    },
                    {
                        id: 'stable',
                        label: 'Stable',
                        section_id: 'inst-design/01/03',
                        chapter_order: 1,
                        section_order: 3,
                        concept_order: 1,
                        status: 'mastered',
                        p_known: 0.88,
                    },
                ],
                links: [{ source: 'current', target: 'developing' }],
            }),
        }))

        const { container } = render(
            <MemoryRouter>
                <KnowledgeGraph
                    course="inst-design"
                    currentSectionId="inst-design/01/01"
                    currentConceptIds={['current']}
                />
            </MemoryRouter>,
        )

        expect(await screen.findByText('Brain Network')).toBeInTheDocument()
        expect(screen.getByText('3 concepts')).toBeInTheDocument()
        expect(screen.getByLabelText(/Zoom in/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Reset zoom and pan/i)).toBeInTheDocument()
        expect(screen.getByText('Focus')).toBeInTheDocument()
        expect(screen.getAllByText('Dev').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Stable').length).toBeGreaterThan(0)
        expect(screen.getByText('Need')).toBeInTheDocument()
        expect(container.querySelector('.knowledge-graph-mount')).toBeTruthy()
    })
})
