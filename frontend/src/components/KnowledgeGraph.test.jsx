import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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
}))

describe('KnowledgeGraph action explanation', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('explains concept status as a work-product action map', async () => {
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
        expect(screen.getByText('What this shows')).toBeInTheDocument()
        expect(screen.getByText(/Node color is not a grade/i)).toBeInTheDocument()
        expect(screen.getByText('Next action')).toBeInTheDocument()
        expect(screen.getByText(/Work Product Studio/i)).toBeInTheDocument()
        expect(screen.getByText('Current focus')).toBeInTheDocument()
        expect(screen.getAllByText('Developing').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Stable').length).toBeGreaterThan(0)
        expect(screen.getByText('Evidence needed')).toBeInTheDocument()
        expect(container.querySelector('.knowledge-graph-mount')).toBeTruthy()
    })
})
