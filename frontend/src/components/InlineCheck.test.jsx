import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Import-light: mock the learner-model services so no network / Supabase runs.
// The calibration lib is NOT mocked - it runs against jsdom storage so the
// tap -> reveal -> nudge chain is exercised end to end.
const { recordAdaptiveSignal, logEvent } = vi.hoisted(() => ({
    recordAdaptiveSignal: vi.fn(),
    logEvent: vi.fn(),
}))

vi.mock('../lib/knowledgeService', () => ({
    recordAdaptiveSignal,
}))

vi.mock('../lib/loggingService', () => ({
    logEvent,
}))

import InlineCheck from './InlineCheck'
import { CALIBRATION_STORAGE_KEY } from '../lib/calibration'

const OPTIONS = [
    { text: 'Stress equals force over area', correct: true },
    { text: 'Stress equals force times area', correct: false },
]

const SECTION = 'inst-design/01/02'

function renderCheck(props = {}) {
    return render(
        <InlineCheck
            question="How is normal stress defined?"
            options={OPTIONS}
            explanation="Normal stress is force divided by cross-sectional area."
            conceptId="normal_stress"
            sectionId={SECTION}
            {...props}
        />,
    )
}

function seedCalibration(samples) {
    window.localStorage.setItem(
        CALIBRATION_STORAGE_KEY,
        JSON.stringify(samples.map(([confidence, correct]) => ({
            ts: Date.now(),
            sectionId: SECTION,
            confidence,
            correct: correct ? 1 : 0,
            optionCount: 2,
        }))),
    )
}

describe('InlineCheck confidence-first flow', () => {
    afterEach(() => {
        cleanup()
        window.localStorage.clear()
        window.sessionStorage.clear()
        vi.clearAllMocks()
    })

    it('selecting an option does NOT reveal; it surfaces the confidence prompt instead', () => {
        renderCheck()

        fireEvent.click(screen.getByRole('radio', { name: /Option A/i }))

        // No verdict yet - the confidence tap is the submit.
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(logEvent).not.toHaveBeenCalled()
        expect(screen.getByRole('group', { name: /Tapping a level submits your answer/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Just guessing - submit answer/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Certain - submit answer/i })).toBeInTheDocument()
    })

    it('hides the confidence prompt until an option is chosen', () => {
        renderCheck()
        expect(screen.queryByRole('group', { name: /submits your answer/i })).not.toBeInTheDocument()
    })

    it('tapping a confidence level grades the attempt and logs the judgment', () => {
        renderCheck()

        fireEvent.click(screen.getByRole('radio', { name: /Option A/i }))
        // Two options -> chance-anchored scale 0.5/0.65/0.8/0.95; Fairly sure = 0.8.
        fireEvent.click(screen.getByRole('button', { name: /Fairly sure - submit answer/i }))

        expect(screen.getByRole('status')).toHaveTextContent(/Correct/i)
        expect(logEvent).toHaveBeenCalledWith(
            'inline_check_attempt',
            SECTION,
            expect.objectContaining({ is_correct: true, option_index: 0, confidence: 0.8 }),
            SECTION,
        )
        expect(logEvent).toHaveBeenCalledWith(
            'confidence_report',
            SECTION,
            expect.objectContaining({ source: 'inline_check', value: 0.8, is_correct: true }),
            SECTION,
        )
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            SECTION,
            'inline_check_correct',
            expect.objectContaining({ conceptId: 'normal_stress', confidence: 0.8 }),
        )
        // The judgment is persisted to the rolling calibration record.
        const stored = JSON.parse(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ confidence: 0.8, correct: 1, optionCount: 2 })
    })

    it('echoes the tapped judgment in the reveal without a miss tag when correct', () => {
        renderCheck()

        fireEvent.click(screen.getByRole('radio', { name: /Option A/i }))
        fireEvent.click(screen.getByRole('button', { name: /Fairly sure - submit answer/i }))

        expect(screen.getByText(/You said: Fairly sure/i)).toBeInTheDocument()
        expect(screen.queryByText(/High-confidence miss/i)).not.toBeInTheDocument()
    })

    it('tags a wrong high-confidence answer as a high-confidence miss', () => {
        renderCheck()

        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))

        expect(screen.getByText(/You said: Certain/i)).toBeInTheDocument()
        expect(screen.getByText(/High-confidence miss — worth re-reading this passage/i)).toBeInTheDocument()
    })

    it('does not tag a wrong low-confidence answer', () => {
        renderCheck()

        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        // 0.5 on the two-option scale is below the 0.7 high-confidence line.
        fireEvent.click(screen.getByRole('button', { name: /Just guessing - submit answer/i }))

        expect(screen.getByText(/You said: Just guessing/i)).toBeInTheDocument()
        expect(screen.queryByText(/High-confidence miss/i)).not.toBeInTheDocument()
    })

    it('supports keyboard selection (Enter picks, confidence still gates the reveal)', () => {
        renderCheck()

        const first = screen.getByRole('radio', { name: /Option A/i })
        first.focus()
        fireEvent.keyDown(first, { key: 'Enter' })

        expect(first).toHaveAttribute('aria-checked', 'true')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Certain - submit answer/i })).toBeInTheDocument()
    })

    it('shows one overconfidence nudge after >=10 records with a >=0.25 gap, then never again this session', () => {
        // Nine prior high-confidence-but-wrong judgments in this course.
        seedCalibration(Array.from({ length: 9 }, () => [0.95, false]))

        renderCheck()
        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))

        // 10 records: mean confidence 0.95, mean accuracy 0 -> overconfident.
        // Copy cites window counts, never percentages, and this is the very
        // first nudge ever, so the normalizing sentence is appended.
        const note = screen.getByRole('note', { name: /Calibration check/i })
        expect(note).toHaveTextContent(
            /on your last 10 checks you tapped 'Fairly sure' or 'Certain' on 10 — 10 of those were wrong/i,
        )
        expect(note).toHaveTextContent(/noticing the gap is itself a skill/i)
        expect(note).not.toHaveTextContent(/%/)
        expect(logEvent).toHaveBeenCalledWith(
            'calibration_nudge',
            SECTION,
            expect.objectContaining({ direction: 'overconfident', confidence_pct: 95, accuracy_pct: 0 }),
            SECTION,
        )

        // A second check in the same section this session must not nag again.
        cleanup()
        renderCheck()
        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))
        expect(screen.queryByRole('note', { name: /Calibration check/i })).not.toBeInTheDocument()
    })

    it('stays quiet with fewer than 10 records', () => {
        seedCalibration(Array.from({ length: 8 }, () => [0.95, false]))

        renderCheck()
        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))

        expect(screen.queryByRole('note', { name: /Calibration check/i })).not.toBeInTheDocument()
    })
})
