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
        fireEvent.click(screen.getByRole('button', { name: /Fairly sure - submit answer/i }))

        expect(screen.getByRole('status')).toHaveTextContent(/Correct/i)
        expect(logEvent).toHaveBeenCalledWith(
            'inline_check_attempt',
            SECTION,
            expect.objectContaining({ is_correct: true, option_index: 0, confidence: 0.75 }),
            SECTION,
        )
        expect(logEvent).toHaveBeenCalledWith(
            'confidence_report',
            SECTION,
            expect.objectContaining({ source: 'inline_check', value: 0.75, is_correct: true }),
            SECTION,
        )
        expect(recordAdaptiveSignal).toHaveBeenCalledWith(
            SECTION,
            'inline_check_correct',
            expect.objectContaining({ conceptId: 'normal_stress', confidence: 0.75 }),
        )
        // The judgment is persisted to the rolling calibration record.
        const stored = JSON.parse(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ confidence: 0.75, correct: 1 })
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

    it('shows one overconfidence nudge after >=6 records with a >=0.25 gap, then never again this session', () => {
        // Five prior overconfident-but-wrong judgments in this course.
        seedCalibration(Array.from({ length: 5 }, () => [1, false]))

        renderCheck()
        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))

        // 6 records: mean confidence 1.0, mean accuracy 0 -> overconfident.
        const note = screen.getByRole('note', { name: /Calibration check/i })
        expect(note).toHaveTextContent(/confidence \(100%\) is running ahead of your accuracy \(0%\)/i)
        expect(logEvent).toHaveBeenCalledWith(
            'calibration_nudge',
            SECTION,
            expect.objectContaining({ direction: 'overconfident', confidence_pct: 100, accuracy_pct: 0 }),
            SECTION,
        )

        // A second check in the same section this session must not nag again.
        cleanup()
        renderCheck()
        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))
        expect(screen.queryByRole('note', { name: /Calibration check/i })).not.toBeInTheDocument()
    })

    it('stays quiet with fewer than 6 records', () => {
        seedCalibration(Array.from({ length: 3 }, () => [1, false]))

        renderCheck()
        fireEvent.click(screen.getByRole('radio', { name: /Option B/i }))
        fireEvent.click(screen.getByRole('button', { name: /Certain - submit answer/i }))

        expect(screen.queryByRole('note', { name: /Calibration check/i })).not.toBeInTheDocument()
    })
})
