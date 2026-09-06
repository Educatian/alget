import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logEvent } from '../lib/loggingService'
import BranchingScenario from './BranchingScenario'

vi.mock('../lib/loggingService', () => ({ logEvent: vi.fn() }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

const TREE = JSON.stringify({
    title: 'AI integrity dilemma',
    start: 'n1',
    nodes: {
        n1: {
            prompt: 'A student submits work that looks AI-generated. What do you do first?',
            choices: [
                { label: 'Report it to the office', next: 'n2', feedback: 'You escalated immediately.' },
                { label: 'Talk with the student first', next: 'n3', feedback: 'You opened a conversation.' },
            ],
        },
        n2: {
            prompt: 'The office asks for evidence you have not gathered.',
            feedback: 'Escalating without evidence stalls.',
            choices: [],
        },
        n3: {
            prompt: 'The student explains they used AI to brainstorm only.',
            choices: [{ label: 'Co-design a revision plan', next: 'n4' }],
        },
        n4: {
            prompt: 'You agree on a revision plan and a citation note.',
            feedback: 'A restorative outcome.',
            choices: [],
        },
    },
})

describe('BranchingScenario', () => {
    it('renders the start prompt and its choices', () => {
        render(<BranchingScenario tree={TREE} />)
        expect(screen.getByText(/A student submits work/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Report it to the office/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Talk with the student first/i })).toBeInTheDocument()
    })

    it('navigates to a consequence node with aria-live feedback and announces an ending', () => {
        render(<BranchingScenario tree={TREE} />)
        fireEvent.click(screen.getByRole('button', { name: /Report it to the office/i }))

        expect(screen.getByText(/asks for evidence you have not gathered/i)).toBeInTheDocument()
        // Choice-level feedback takes precedence over the node's own feedback.
        expect(screen.getByText(/You escalated immediately/i)).toBeInTheDocument()
        expect(screen.getByText(/reached an ending/i)).toBeInTheDocument()
    })

    it('logs branch choices without storing prompt or choice text', () => {
        render(<BranchingScenario tree={TREE} sectionId="inst-design/02/08" course="inst-design" />)
        fireEvent.click(screen.getByRole('button', { name: /Report it to the office/i }))
        expect(logEvent).toHaveBeenCalledWith(
            'branch_choice',
            'branching-scenario',
            expect.objectContaining({ node_id: 'n1', choice_index: 0, path_depth: 1, terminal: true }),
            'inst-design/02/08',
        )
        const data = logEvent.mock.calls[0][2]
        expect(data).not.toHaveProperty('prompt')
        expect(data).not.toHaveProperty('label')
    })

    it('tracks the path and lets the learner back up to try another branch', () => {
        render(<BranchingScenario tree={TREE} />)
        fireEvent.click(screen.getByRole('button', { name: /Talk with the student first/i }))

        // Path breadcrumb shows the choice made.
        const trail = screen.getByRole('navigation', { name: /Decisions so far/i })
        expect(trail).toHaveTextContent('Talk with the student first')

        // Back up returns to the start node and its choices.
        fireEvent.click(screen.getByRole('button', { name: /Back up and try another branch/i }))
        expect(screen.getByText(/A student submits work/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Report it to the office/i })).toBeInTheDocument()
    })

    it('supports multi-level branches and start over', () => {
        render(<BranchingScenario tree={TREE} />)
        fireEvent.click(screen.getByRole('button', { name: /Talk with the student first/i }))
        fireEvent.click(screen.getByRole('button', { name: /Co-design a revision plan/i }))
        expect(screen.getByText(/restorative outcome/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Start over/i }))
        expect(screen.getByText(/A student submits work/i)).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: /Decisions so far/i })).not.toBeInTheDocument()
    })

    it('renders nothing for an unusable tree', () => {
        const { container } = render(<BranchingScenario tree="not json" />)
        expect(container).toBeEmptyDOMElement()
    })
})
