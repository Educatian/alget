import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SelfExplain from './SelfExplain'
import { logInteraction } from '../lib/loggingService'

vi.mock('../lib/loggingService', () => ({
    logInteraction: vi.fn(),
}))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

const PROMPT = 'Why does splitting narration and on-screen text hurt learning?'
const ANSWER = 'It splits attention across two visual channels, raising extraneous load.'

describe('SelfExplain', () => {
    it('renders the prompt and a labelled explanation textarea', () => {
        render(<SelfExplain prompt={PROMPT} answer={ANSWER} />)

        expect(screen.getByText(PROMPT)).toBeInTheDocument()
        expect(screen.getByLabelText(/Explain it in your own words first/i)).toBeInTheDocument()
        // Expert answer is hidden before the learner commits a prediction.
        expect(screen.queryByText(ANSWER)).not.toBeInTheDocument()
    })

    it('keeps reveal locked until the learner writes an explanation', () => {
        render(<SelfExplain prompt={PROMPT} answer={ANSWER} />)

        const revealBtn = screen.getByRole('button', { name: /Reveal the expert explanation/i })
        expect(revealBtn).toBeDisabled()

        fireEvent.change(screen.getByLabelText(/Explain it in your own words first/i), {
            target: { value: 'My guess about attention.' },
        })
        expect(revealBtn).toBeEnabled()
    })

    it('reveals the expert explanation after a prediction and logs the interaction', () => {
        render(<SelfExplain prompt={PROMPT} answer={ANSWER} sectionId="ail606/01/01" conceptId="cognitive_load" />)

        fireEvent.change(screen.getByLabelText(/Explain it in your own words first/i), {
            target: { value: 'It overloads the eyes.' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Reveal the expert explanation/i }))

        expect(screen.getByText(ANSWER)).toBeInTheDocument()
        expect(logInteraction).toHaveBeenCalledWith(
            'self_explain_reveal:cognitive_load',
            'predict_then_reveal',
            'ail606/01/01',
        )
        // Textarea locks so the prediction cannot be retro-edited.
        expect(screen.getByLabelText(/Explain it in your own words first/i)).toBeDisabled()
    })

    it('records a self-assessment and shows feedback', () => {
        render(<SelfExplain prompt={PROMPT} answer={ANSWER} conceptId="cognitive_load" />)

        fireEvent.change(screen.getByLabelText(/Explain it in your own words first/i), {
            target: { value: 'Attention split.' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Reveal the expert explanation/i }))

        const partial = screen.getByRole('button', { name: /Partly there/i })
        fireEvent.click(partial)

        expect(partial).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText(/Re-read the part you missed/i)).toBeInTheDocument()
        expect(logInteraction).toHaveBeenCalledWith(
            'self_explain_assess:cognitive_load:partial',
            'self_assessment',
            null,
        )
    })

    it('skips the reveal step when no expert answer is provided', () => {
        render(<SelfExplain prompt={PROMPT} />)

        fireEvent.change(screen.getByLabelText(/Explain it in your own words first/i), {
            target: { value: 'My take.' },
        })
        const continueBtn = screen.getByRole('button', { name: /^Continue$/i })
        fireEvent.click(continueBtn)

        // Jumps straight to self-assessment with no expert block.
        expect(screen.getByRole('group', { name: /How did your explanation compare/i })).toBeInTheDocument()
    })

    it('renders nothing without a prompt', () => {
        const { container } = render(<SelfExplain answer={ANSWER} />)
        expect(container).toBeEmptyDOMElement()
    })
})
