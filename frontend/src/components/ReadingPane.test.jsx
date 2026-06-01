import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReadingPane from './ReadingPane'

afterEach(() => {
    cleanup()
    window.localStorage.clear()
})

vi.mock('../lib/loggingService', () => ({
    logInteraction: vi.fn(),
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
