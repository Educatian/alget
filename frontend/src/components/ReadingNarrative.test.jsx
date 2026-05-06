import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingNarrative from './ReadingNarrative'

vi.mock('../lib/loggingService', () => ({
    logEvent: vi.fn(),
    logInteraction: vi.fn(),
    logTimeOnTask: vi.fn(),
}))

describe('ReadingNarrative markdown extension contract', () => {
    beforeEach(() => {
        globalThis.IntersectionObserver = vi.fn(() => ({
            observe: vi.fn(),
            disconnect: vi.fn(),
        }))
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('renders artifact-studio markdown blocks with their artifact, course, section, and runtime sectionId', async () => {
        render(
            <ReadingNarrative
                sectionId="cat531-supplement/08/06"
                course="cat531-supplement"
                conceptIds={['ai_policy']}
                content={`
# Transfer Task

<artifact-studio artifact="Design Tension Studio map naming a classroom value conflict and negotiated decision" course="CAT 531" section="08.06" />
`}
            />,
        )

        expect(await screen.findByRole('button', { name: /Submission rules/i })).toBeInTheDocument()
        expect(screen.getByText('Design Tension Studio map naming a classroom value conflict and negotiated decision')).toBeInTheDocument()
        expect(screen.getByText('CAT 531 08.06')).toBeInTheDocument()
        expect(screen.getByText(/0\/8/)).toBeInTheDocument()
    })

    it('normalizes generated MDX where the first heading is flush but the remaining body is indented', async () => {
        render(
            <ReadingNarrative
                sectionId="ail606-supplement/01/01"
                course="ail606-supplement"
                conceptIds={['cognitive_load']}
                content={`# Cognitive Architecture

    ## Artifact Studio

    <artifact-studio artifact="cognitive load diagnosis table with intrinsic/extraneous/germane load evidence" course="AIL 606" section="01.01" />
`}
            />,
        )

        expect(await screen.findByRole('button', { name: /Submission rules/i })).toBeInTheDocument()
        expect(screen.getByText('AIL 606 01.01')).toBeInTheDocument()
    })

    it('renders curated youtube embeds from markdown without raw html', async () => {
        render(
            <ReadingNarrative
                sectionId="inst-design/07/01"
                course="inst-design"
                conceptIds={['udl']}
                content={`# UDL

<youtube-embed id="PHOJwnSV6t4" title="Universal Design for Learning and CAST" caption="Use this after reading to compare the section's design language with a UDL overview." />
`}
            />,
        )

        const frame = await screen.findByTitle('Universal Design for Learning and CAST')
        expect(frame).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/PHOJwnSV6t4'))
        expect(screen.getByText(/compare the section's design language/i)).toBeInTheDocument()
    })
})
