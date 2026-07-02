import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReadingPane from './ReadingPane'
import { logEvent } from '../lib/loggingService'

afterEach(() => {
    cleanup()
    window.localStorage.clear()
})

vi.mock('../lib/loggingService', () => ({
    logInteraction: vi.fn(),
    logEvent: vi.fn(),
    logEvaluationArtifact: vi.fn(),
}))

vi.mock('./ReadingNarrative', () => ({
    default: () => <div>Reading narrative loaded</div>,
}))

vi.mock('./PracticeBlock', () => ({
    default: () => <div>Practice loaded</div>,
}))

vi.mock('./KnowledgeCheck', () => ({
    default: () => <div>Knowledge check loaded</div>,
}))

vi.mock('./AffectiveReaction', () => ({
    default: () => <div>Reflection loaded</div>,
}))

vi.mock('./KnowledgeGraph', () => ({
    default: () => <div>Brain network loaded</div>,
}))

vi.mock('./PerusallLayer', () => ({
    default: () => <div>Social annotation loaded</div>,
}))

const sectionData = {
    meta: {
        course: 'inst-design',
        chapter: '01',
        section: '02',
        title: 'Current Section',
        description: 'A current section.',
        estimated_time_minutes: 12,
        learning_objectives: ['Build a work product trace.'],
        concept_ids: ['artifact_trace'],
    },
    content: '# Current Section',
    practice: [],
}

describe('ReadingPane continuity cues', () => {
    it('offers a section path with jump targets and a ready check', () => {
        const scrollIntoView = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoView

        render(
            <ReadingPane
                sectionData={sectionData}
                loading={false}
                isBookmarked={false}
                toggleBookmark={vi.fn()}
                isCompleted={false}
                markCompleted={vi.fn()}
                previousSection={null}
                nextSection={null}
                recentSection={null}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /Jump to Practice/i }))
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
        expect(screen.getByText('Ready check')).toBeInTheDocument()
        expect(screen.getByText(/0\/3 evidence moves checked/i)).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText(/State the claim/i))
        expect(screen.getByText(/1\/3 evidence moves checked/i)).toBeInTheDocument()
    })

    it('autosaves an exit ticket and uses it as section completion evidence', async () => {
        const note = [
            'The core claim is that artifact evidence should show the learner decision, not only the final answer.',
            'My evidence is the practice result plus the annotation I would cite before revising.',
            'Next I would test whether the same claim holds in a new lesson plan.'
        ].join(' ')

        render(
            <ReadingPane
                sectionData={sectionData}
                loading={false}
                isBookmarked={false}
                toggleBookmark={vi.fn()}
                isCompleted={false}
                markCompleted={vi.fn()}
                previousSection={null}
                nextSection={null}
                recentSection={null}
            />,
        )

        fireEvent.change(screen.getByLabelText(/Exit ticket/i), { target: { value: note } })

        await waitFor(() => {
            expect(window.localStorage.getItem('alget_exit_ticket_v1_inst-design/01/02')).toBe(note)
        })
        expect(screen.getByText(/120\/120 evidence trace/i)).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText(/State the claim/i))
        fireEvent.click(screen.getByLabelText(/Use evidence/i))
        fireEvent.click(screen.getByLabelText(/Name the next move/i))

        expect(screen.getByRole('button', { name: /Complete Section/i })).toBeInTheDocument()
    })

    it('shows a returning learner check-in and resumes the last section', async () => {
        const onNavigate = vi.fn()

        render(
            <ReadingPane
                sectionData={sectionData}
                loading={false}
                isBookmarked={false}
                toggleBookmark={vi.fn()}
                isCompleted={false}
                markCompleted={vi.fn()}
                previousSection={null}
                nextSection={null}
                onNavigate={onNavigate}
                recentSection={{
                    sectionId: 'inst-design/01/01',
                    course: 'inst-design',
                    chapter: '01',
                    section: '01',
                    title: 'Prior Section',
                    updatedAt: '2026-05-05T10:00:00Z',
                }}
            />,
        )

        expect(screen.getByText(/course deliverable with claim/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Resume 01\.01/i }))
        expect(onNavigate).toHaveBeenCalledWith('01', '01', 'backward')
        expect(await screen.findByText('Reading narrative loaded')).toBeInTheDocument()
    })

    it('names the next learning actions when there is no prior section to resume', () => {
        render(
            <ReadingPane
                sectionData={sectionData}
                loading={false}
                isBookmarked={false}
                toggleBookmark={vi.fn()}
                isCompleted={false}
                markCompleted={vi.fn()}
                previousSection={null}
                nextSection={null}
                recentSection={null}
            />,
        )

        expect(screen.getByText('Read')).toBeInTheDocument()
        expect(screen.getByText('Reflect')).toBeInTheDocument()
        expect(screen.getByText('Practice')).toBeInTheDocument()
        expect(screen.getByText('Finish')).toBeInTheDocument()
    })

    it('does not duplicate the objective block when the MDX already has learning targets', () => {
        render(
            <ReadingPane
                sectionData={{
                    ...sectionData,
                    content: '# Current Section\n\n## Learning Targets\n\n- Build a work product trace.',
                }}
                loading={false}
                isBookmarked={false}
                toggleBookmark={vi.fn()}
                isCompleted={false}
                markCompleted={vi.fn()}
                previousSection={null}
                nextSection={null}
                recentSection={null}
            />,
        )

        expect(screen.queryByText('Learning Objectives')).not.toBeInTheDocument()
    })
})

describe('ReadingPane embedded labs', () => {
    const baseProps = {
        loading: false,
        isBookmarked: false,
        toggleBookmark: vi.fn(),
        isCompleted: false,
        markCompleted: vi.fn(),
        previousSection: null,
        nextSection: null,
        recentSection: null,
    }

    // The embedded labs are lazy() now (code-split), so they mount asynchronously
    // behind Suspense — use findBy* (which waits) instead of the synchronous getBy*.
    it('embeds the GeckoGrip Lab on the dry-adhesion section (bio-inspired/04/01)', async () => {
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{
                    meta: { course: 'bio-inspired', chapter: '04', section: '01', title: 'Gecko-Inspired Dry Adhesion' },
                    content: '# Gecko-Inspired Dry Adhesion',
                    practice: [],
                }}
            />,
        )
        const frame = await screen.findByTitle(/GeckoGrip Lab/i)
        expect(frame).toBeInTheDocument()
        expect(frame.getAttribute('src')).toContain('geckogrip-lab.pages.dev')
    })

    it('embeds the Nacre Lab on bio-inspired/01/02', async () => {
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{ meta: { course: 'bio-inspired', chapter: '01', section: '02', title: 'Hierarchical Structures' }, content: '# x', practice: [] }}
            />,
        )
        const frame = await screen.findByTitle(/Nacre Lab/i)
        expect(frame.getAttribute('src')).toContain('nacre-lab.pages.dev')
    })

    it('embeds the Riblet Lab on bio-inspired/02/01', async () => {
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{ meta: { course: 'bio-inspired', chapter: '02', section: '01', title: 'Fluid Dynamics' }, content: '# x', practice: [] }}
            />,
        )
        const frame = await screen.findByTitle(/Riblet Lab/i)
        expect(frame.getAttribute('src')).toContain('riblet-lab.pages.dev')
    })

    it('embeds the serration optimizer on bio-inspired/03/01', async () => {
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{ meta: { course: 'bio-inspired', chapter: '03', section: '01', title: 'Aeroacoustics' }, content: '# x', practice: [] }}
            />,
        )
        expect(await screen.findByText(/Quiet-Blade Serration Optimizer/i)).toBeInTheDocument()
    })

    it('embeds the stack-effect designer on bio-inspired/06/01', async () => {
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{ meta: { course: 'bio-inspired', chapter: '06', section: '01', title: 'Thermal Regulation' }, content: '# x', practice: [] }}
            />,
        )
        expect(await screen.findByText(/Stack-Effect Ventilation Designer/i)).toBeInTheDocument()
    })

    it.each([
        ['01', '01', /Relative-Density Trade-Off Explorer/i],
        ['01', '03', /Peel-Angle Switch/i],
        ['05', '01', /Structural-Color Multilayer Designer/i],
        ['07', '01', /Self-Healing Capsule Designer/i],
        ['08', '01', /Swarm Flocking Lab/i],
    ])('embeds a sim on bio-inspired/%s/%s', async (chapter, section, re) => {
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{ meta: { course: 'bio-inspired', chapter, section, title: 'Section' }, content: '# x', practice: [] }}
            />,
        )
        expect(await screen.findByText(re)).toBeInTheDocument()
    })

    it('fires research telemetry (sim_open) when a sim mounts', async () => {
        logEvent.mockClear()
        render(
            <ReadingPane
                {...baseProps}
                sectionData={{ meta: { course: 'bio-inspired', chapter: '06', section: '01', title: 'Thermal' }, content: '# x', practice: [] }}
            />,
        )
        // Lazy lab — wait for it to mount before asserting its mount telemetry.
        await screen.findByText(/Stack-Effect Ventilation Designer/i)
        const opened = logEvent.mock.calls.some(
            (c) => c[0] === 'sim_open' && c[3] === 'bio-inspired/06/01',
        )
        expect(opened).toBe(true)
    })

    it('does not embed any lab on unrelated sections', () => {
        render(<ReadingPane {...baseProps} sectionData={sectionData} />)
        expect(screen.queryByTitle(/GeckoGrip Lab/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/Serration Optimizer|Stack-Effect/i)).not.toBeInTheDocument()
    })
})
