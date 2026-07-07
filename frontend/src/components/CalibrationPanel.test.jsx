import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import CalibrationPanel from './CalibrationPanel'
import { CALIBRATION_STORAGE_KEY } from '../lib/calibration'

const SECTION = 'inst-design/01/02'

function seed(samples) {
    window.localStorage.setItem(
        CALIBRATION_STORAGE_KEY,
        JSON.stringify(samples.map(([confidence, correct]) => ({
            ts: Date.now(),
            sectionId: SECTION,
            confidence,
            correct: correct ? 1 : 0,
            optionCount: 4,
        }))),
    )
}

describe('CalibrationPanel', () => {
    afterEach(() => {
        cleanup()
        window.localStorage.clear()
    })

    it('renders nothing below 10 course records', () => {
        seed(Array.from({ length: 9 }, () => [0.95, true]))
        render(<CalibrationPanel sectionId={SECTION} />)
        expect(screen.queryByTestId('calibration-panel')).not.toBeInTheDocument()
    })

    it('renders one row per used label with times used and % correct', () => {
        seed([
            [0.25, true], [0.25, false], // Just guessing: 2 used, 50%
            [0.95, true], [0.95, true], [0.95, true], [0.95, true],
            [0.95, true], [0.95, true], [0.95, false], [0.95, false], // Certain: 8 used, 75%
        ])
        render(<CalibrationPanel sectionId={SECTION} />)

        expect(screen.getByText(/Your calibration so far/i)).toBeInTheDocument()
        const rows = screen.getAllByRole('row').slice(1) // drop the header row
        expect(rows.map((row) => row.textContent)).toEqual([
            'Just guessing250%',
            'Certain875%',
        ])
        // Never-used labels stay hidden.
        expect(screen.queryByText('Not sure')).not.toBeInTheDocument()
        expect(screen.queryByText('Fairly sure')).not.toBeInTheDocument()
    })
})
