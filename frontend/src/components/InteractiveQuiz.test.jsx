import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import-light: mock the learner-model services so no network / Supabase runs.
const { recordAdaptiveSignal, updateMastery, logEvent, logProblemAttempt } = vi.hoisted(() => ({
    recordAdaptiveSignal: vi.fn(),
    updateMastery: vi.fn(() => Promise.resolve()),
    logEvent: vi.fn(),
    logProblemAttempt: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    recordAdaptiveSignal,
    updateMastery,
}))

vi.mock('../lib/loggingService', () => ({
    logEvent,
    logProblemAttempt,
}))

import InteractiveQuiz from './InteractiveQuiz'

const OPTIONS = [
    { text: 'Working memory is unlimited', isCorrect: false },
    { text: 'Working memory has a limited capacity', isCorrect: true },
    { text: 'Working memory only stores images', isCorrect: false },
]

function renderQuiz(props = {}) {
    return render(
        <InteractiveQuiz
            question="What is true of working memory?"
            options={OPTIONS}
            explanation="Working memory is capacity-limited."
            conceptId="cognitive_load"
            sectionId="ail606-supplement/01/01"
            {...props}
        />,
    )
}

describe('InteractiveQuiz radiogroup interaction', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it('renders the options as an accessible radiogroup with one radio per option', () => {
        renderQuiz()

        const group = screen.getByRole('radiogroup', { name: /Answer options/i })
        expect(group).toBeInTheDocument()
        const radios = screen.getAllByRole('radio')
        expect(radios).toHaveLength(3)
        // Nothing is checked before the learner picks.
        radios.forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
    })

    it('checks the chosen radio on click and updates aria-checked', () => {
        renderQuiz()

        const correct = screen.getByRole('radio', { name: OPTIONS[1].text })
        fireEvent.click(correct)
        expect(correct).toHaveAttribute('aria-checked', 'true')
    })

    it('moves selection with arrow keys (roving radio semantics)', () => {
        renderQuiz()

        const first = screen.getByRole('radio', { name: OPTIONS[0].text })
        first.focus()
        fireEvent.keyDown(first, { key: 'ArrowDown' })

        // ArrowDown from index 0 selects index 1.
        expect(screen.getByRole('radio', { name: OPTIONS[1].text })).toHaveAttribute(
            'aria-checked',
            'true',
        )
    })

    it('grades a correct answer, records the signal and updates mastery', () => {
        renderQuiz()

        fireEvent.click(screen.getByRole('radio', { name: OPTIONS[1].text }))
        fireEvent.click(screen.getByRole('button', { name: /Check Answer/i }))

        // The polite status region announces the correct verdict.
        expect(screen.getByRole('status')).toHaveTextContent(/Correct!/i)
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/01/01',
            'inline_quiz_correct',
            expect.objectContaining({ conceptId: 'cognitive_load' }),
        )
        expect(logProblemAttempt).toHaveBeenCalledWith(
            expect.stringMatching(/^inline_quiz:cognitive_load:/),
            true,
            expect.any(Number),
            false,
            'ail606-supplement/01/01',
            expect.objectContaining({
                source: 'inline_quiz',
                concept_id: 'cognitive_load',
                selected_option_index: 1,
            }),
        )
        expect(updateMastery).toHaveBeenCalledWith(
            { cognitive_load: 1.0 },
            true,
            { sectionId: 'ail606-supplement/01/01' },
        )
    })

    it('marks an incorrect answer and offers a retry that resets the quiz', () => {
        renderQuiz()

        fireEvent.click(screen.getByRole('radio', { name: OPTIONS[0].text }))
        fireEvent.click(screen.getByRole('button', { name: /Check Answer/i }))

        expect(screen.getByRole('status')).toHaveTextContent(/Not Quite Right/i)
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/01/01',
            'inline_quiz_incorrect',
            expect.objectContaining({ conceptId: 'cognitive_load' }),
        )

        fireEvent.click(screen.getByRole('button', { name: /Try Again/i }))
        // After retry the radios are interactive again and unchecked.
        const radios = screen.getAllByRole('radio')
        radios.forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
        expect(screen.getByRole('button', { name: /Check Answer/i })).toBeDisabled()
    })

    it('renders an error panel when the options JSON cannot be parsed', () => {
        renderQuiz({ options: '{not valid json' })

        expect(screen.getByText(/Quiz Loading Error/i)).toBeInTheDocument()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    })
})
