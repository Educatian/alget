import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConceptMapMini from './ConceptMapMini'

vi.mock('../lib/loggingService', () => ({
    logEvent: vi.fn(),
}))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('ConceptMapMini', () => {
    it('renders an accessible node-link group with a focusable node per concept', () => {
        render(<ConceptMapMini concepts={'["cognitive_load","information_processing_model"]'} />)

        expect(screen.getByRole('group', { name: /concept map/i })).toBeInTheDocument()

        const nodes = screen.getAllByRole('button', { name: /^Concept:/i })
        expect(nodes).toHaveLength(2)
        nodes.forEach((node) => expect(node).toHaveAttribute('tabindex', '0'))
    })

    it('selecting a node announces its description in the aria-live panel', () => {
        render(<ConceptMapMini concepts={'["cognitive_load","information_processing_model"]'} />)

        const live = screen.getByRole('status')
        expect(live).toHaveTextContent(/No concept selected/i)

        const node = screen.getByRole('button', { name: /Concept: Cognitive Load/i })
        fireEvent.click(node)

        expect(node).toHaveAttribute('aria-pressed', 'true')
        expect(live).toHaveTextContent(/Cognitive Load/i)
        expect(live).toHaveTextContent(/working memory/i)
    })

    it('is keyboard operable: Enter selects a focused node', () => {
        render(<ConceptMapMini concepts={'["cognitive_load","information_processing_model"]'} />)

        const node = screen.getByRole('button', { name: /Concept: Cognitive Load/i })
        fireEvent.keyDown(node, { key: 'Enter' })

        expect(node).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('status')).toHaveTextContent(/Cognitive Load/i)
    })

    it('renders related edges that stay inside the concept neighborhood', () => {
        const { container } = render(
            <ConceptMapMini concepts={'["cognitive_load","information_processing_model"]'} />,
        )
        // cognitive_load relates to information_processing_model in the registry,
        // and both are in the neighborhood, so one link is drawn.
        expect(container.querySelectorAll('line')).toHaveLength(1)
    })

    it('parses a comma-separated string fallback and dedupes ids', () => {
        render(<ConceptMapMini concepts={'cognitive_load, cognitive_load'} />)
        expect(screen.getAllByRole('button', { name: /^Concept:/i })).toHaveLength(1)
    })

    it('degrades gracefully: renders nothing with no resolvable concepts', () => {
        const { container } = render(<ConceptMapMini concepts={'["not_a_real_concept"]'} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing with no props', () => {
        const { container } = render(<ConceptMapMini />)
        expect(container).toBeEmptyDOMElement()
    })
})
