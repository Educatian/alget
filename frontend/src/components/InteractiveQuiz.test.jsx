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
        window.localStorage.clear()
        window.sessionStorage.clear()
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

    it('keeps the verdict hidden until a confidence level is tapped', () => {
        renderQuiz()

        fireEvent.click(screen.getByRole('radio', { name: OPTIONS[1].text }))

        // Picking an answer alone must not grade - the confidence tap submits.
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(logProblemAttempt).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: /Fairly sure - submit answer/i })).toBeEnabled()
    })

    it('disables the confidence buttons until an answer is selected', () => {
        renderQuiz()

        expect(screen.getByRole('button', { name: /Certain - submit answer/i })).toBeDisabled()
        fireEvent.click(screen.getByRole('radio', { name: OPTIONS[1].text }))
        expect(screen.getByRole('button', { name: /Certain - submit answer/i })).toBeEnabled()
    })

    it('grades a correct answer on confidence tap, records the signal and updates mastery', () => {
        renderQuiz()

        fireEvent.click(screen.getByRole('radio', { name: OPTIONS[1].text }))
        // Three options -> chance-anchored scale 0.33/0.54/0.74/0.95; Fairly sure = 0.74.
        fireEvent.click(screen.getByRole('button', { name: /Fairly sure - submit answer/i }))

        // The polite status region announces the correct verdict.
        expect(screen.getByRole('status')).toHaveTextContent(/Correct!/i)
        // The reveal echoes the learner's judgment; no miss tag on a correct answer.
        expect(screen.getByText(/You said: Fairly sure/i)).toBeInTheDocument()
        expect(screen.queryByText(/High-confidence miss/i)).not.toBeInTheDocument()
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/01/01',
            'inline_quiz_correct',
            expect.objectContaining({ conceptId: 'cognitive_load', confidence: 0.74 }),
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
                confidence: 0.74,
                selected_option_index: 1,
            }),
        )
        expect(logEvent).toHaveBeenCalledWith(
            'confidence_report',
            expect.stringMatching(/^inline_quiz:cognitive_load:/),
            expect.objectContaining({ source: 'inline_quiz', value: 0.74, is_correct: true }),
            'ail606-supplement/01/01',
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
        fireEvent.click(screen.getByRole('button', { name: /Just guessing - submit answer/i }))

        expect(screen.getByRole('status')).toHaveTextContent(/Not Quite Right/i)
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            'ail606-supplement/01/01',
            'inline_quiz_incorrect',
            expect.objectContaining({ conceptId: 'cognitive_load', confidence: 0.33 }),
        )
        // Low-confidence miss: judgment is echoed but not flagged.
        expect(screen.getByText(/You said: Just guessing/i)).toBeInTheDocument()
        expect(screen.queryByText(/High-confidence miss/i)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Try Again/i }))
        // After retry the radios are interactive again and unchecked, and the
        // confidence buttons re-lock until a fresh answer is chosen.
        const radios = screen.getAllByRole('radio')
        radios.forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
        expect(screen.getByRole('button', { name: /Just guessing - submit answer/i })).toBeDisabled()
    })

    it('tags a wrong high-confidence answer as a high-confidence miss', () => {
        renderQuiz()

        fireEvent.click(screen.getByRole('radio', { name: OPTIONS[0].text }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))

        expect(screen.getByText(/You said: Certain/i)).toBeInTheDocument()
        expect(screen.getByText(/High-confidence miss — worth re-reading this passage/i)).toBeInTheDocument()
    })

    it('renders an error panel when the options JSON cannot be parsed', () => {
        renderQuiz({ options: '{not valid json' })

        expect(screen.getByText(/Quiz Loading Error/i)).toBeInTheDocument()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    })
})
