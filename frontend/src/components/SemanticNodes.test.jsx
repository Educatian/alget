import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingNarrative from './ReadingNarrative'

vi.mock('../lib/loggingService', () => ({
    logEvent: vi.fn(),
    logInteraction: vi.fn(),
    logTimeOnTask: vi.fn(),
}))

describe('typed semantic content nodes', () => {
    beforeEach(() => {
        globalThis.IntersectionObserver = vi.fn(() => ({
            observe: vi.fn(),
            disconnect: vi.fn(),
        }))
        // radix Popover measures its trigger via ResizeObserver, which jsdom
        // does not implement. Minimal no-op polyfill scoped to this suite.
        globalThis.ResizeObserver = vi.fn(() => ({
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
        }))
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('renders a Definition as an accessible term/definition block linked to the concept registry', async () => {
        render(
            <ReadingNarrative
                sectionId="ail606-supplement/01/01"
                course="ail606-supplement"
                conceptIds={['cognitive_load']}
                content={`# Working Memory

<definition term="Cognitive load" conceptid="cognitive_load">
The total mental effort imposed on working memory during a task.
</definition>
`}
            />,
        )

        // Semantic structure (role/aria), not color-only.
        const block = await screen.findByRole('group', { name: /Definition: Cognitive load/i })
        expect(block).toBeInTheDocument()
        // The defined term resolves to the registry and becomes a knowl trigger.
        expect(
            screen.getByRole('button', { name: /Show definition of Cognitive load/i }),
        ).toBeInTheDocument()
    })

    it('expands a ConceptRef in place via an accessible popover instead of navigating', async () => {
        render(
            <ReadingNarrative
                sectionId="ail606-supplement/01/02"
                course="ail606-supplement"
                conceptIds={['cognitive_load']}
                content={`# Read this

This idea connects to <concept-ref id="cognitive_load">cognitive load</concept-ref> directly.
`}
            />,
        )

        const trigger = await screen.findByRole('button', { name: /Show definition of cognitive load/i })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        fireEvent.click(trigger)

        const popover = await screen.findByRole('dialog', { name: /Definition of Cognitive Load/i })
        expect(popover).toBeInTheDocument()
        expect(popover).toHaveTextContent(/working memory/i)
    })

    it('renders a Callout with its purpose label and icon, not color alone', async () => {
        render(
            <ReadingNarrative
                sectionId="ai-ethics/03/02"
                course="ai-ethics"
                conceptIds={['spec_gaming']}
                content={`# Pitfalls

<callout purpose="warning">
Specification gaming can satisfy the metric while defeating the goal.
</callout>
`}
            />,
        )

        const note = await screen.findByRole('note', { name: /Warning/i })
        expect(note).toHaveAttribute('data-callout-purpose', 'warning')
        expect(note).toHaveTextContent(/Specification gaming/i)
    })

    it('renders figure purpose, caption, source, license, and descriptive alt text', async () => {
        render(
            <ReadingNarrative
                sectionId="statics/01/01"
                course="statics"
                conceptIds={['equilibrium']}
                content={`# Equilibrium

<figure-block caption="A concept map connecting equilibrium to force balance." conceptid="equilibrium" purpose="organizational" source="ALGET original instructional diagram" license="Project-authored">
  <img src="/course-art/reference-figures/statics/example.png" alt="Equilibrium at the center with force and moment balance connected around it" />
</figure-block>
`}
            />,
        )

        const figure = await screen.findByRole('figure')
        expect(figure).toHaveAttribute('data-visual-purpose', 'organizational')
        expect(screen.getByRole('region', { name: /Scrollable instructional figure/i })).toHaveAttribute('tabindex', '0')
        expect(screen.getByAltText(/Equilibrium at the center/i)).toBeInTheDocument()
        expect(screen.getByText(/A concept map connecting equilibrium/i)).toBeInTheDocument()
        expect(screen.getByText(/Source:/i)).toHaveTextContent(/ALGET original instructional diagram/i)
        expect(screen.getByText(/Source:/i)).toHaveTextContent(/Project-authored/i)
    })

    it('falls back to readable text for an unresolved concept reference', async () => {
        render(
            <ReadingNarrative
                sectionId="ai-ethics/03/03"
                course="ai-ethics"
                content={`# Edge case

See <concept-ref id="not_a_real_concept">this term</concept-ref> for context.
`}
            />,
        )

        // No expansion trigger; the text still renders.
        expect(await screen.findByText('this term')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Show definition of/i })).not.toBeInTheDocument()
    })
})
