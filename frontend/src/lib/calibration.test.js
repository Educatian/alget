import { beforeEach, describe, expect, it } from 'vitest'
import {
    CALIBRATION_STORAGE_KEY,
    CALIBRATION_GAP_THRESHOLD,
    MIN_RECORDS_FOR_NUDGE,
    getCalibrationNudge,
    recordCalibrationSample,
    takeCalibrationNudge,
} from './calibration'

const SECTION = 'inst-design/01/02'
const OTHER_SECTION_SAME_COURSE = 'inst-design/02/01'
const OTHER_COURSE_SECTION = 'bio-inspired/01/01'

function seed(samples, sectionId = SECTION) {
    samples.forEach(([confidence, correct]) => recordCalibrationSample(sectionId, confidence, correct))
}

describe('calibration record + nudge thresholds', () => {
    beforeEach(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
    })

    it('persists samples under the versioned localStorage key', () => {
        recordCalibrationSample(SECTION, 0.75, true)
        const stored = JSON.parse(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ sectionId: SECTION, confidence: 0.75, correct: 1 })
        expect(stored[0].ts).toEqual(expect.any(Number))
    })

    it('ignores non-numeric confidence values', () => {
        expect(recordCalibrationSample(SECTION, 'high', true)).toBeNull()
        expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull()
    })

    it('stays silent with fewer than 6 records even at a maximal gap', () => {
        seed(Array.from({ length: MIN_RECORDS_FOR_NUDGE - 1 }, () => [1, false]))
        expect(getCalibrationNudge(SECTION)).toBeNull()
    })

    it('flags overconfidence at exactly the 0.25 gap once 6 records exist', () => {
        // mean(confidence)=0.75, mean(correct)=0.5 -> gap exactly +0.25
        seed([[0.75, true], [0.75, true], [0.75, true], [0.75, false], [0.75, false], [0.75, false]])
        const nudge = getCalibrationNudge(SECTION)
        expect(nudge).toMatchObject({ direction: 'overconfident', confidencePct: 75, accuracyPct: 50 })
        expect(nudge.gap).toBeCloseTo(CALIBRATION_GAP_THRESHOLD, 5)
        expect(nudge.message).toMatch(/Calibration check/i)
        expect(nudge.message).toMatch(/75%/)
        expect(nudge.message).toMatch(/50%/)
    })

    it('stays silent when the gap is below the 0.25 threshold', () => {
        // mean(confidence)=0.75, mean(correct)=4/6 -> gap ~= +0.083
        seed([[0.75, true], [0.75, true], [0.75, true], [0.75, true], [0.75, false], [0.75, false]])
        expect(getCalibrationNudge(SECTION)).toBeNull()
    })

    it('flags underconfidence at a -0.25 gap', () => {
        // mean(confidence)=0.25, mean(correct)=0.5 -> gap exactly -0.25
        seed([[0.25, true], [0.25, true], [0.25, true], [0.25, false], [0.25, false], [0.25, false]])
        const nudge = getCalibrationNudge(SECTION)
        expect(nudge).toMatchObject({ direction: 'underconfident', confidencePct: 25, accuracyPct: 50 })
    })

    it('only counts records from the same course', () => {
        // Six strongly overconfident records, but in a different course.
        seed(Array.from({ length: 6 }, () => [1, false]), OTHER_COURSE_SECTION)
        expect(getCalibrationNudge(SECTION)).toBeNull()
        expect(getCalibrationNudge(OTHER_COURSE_SECTION)).toMatchObject({ direction: 'overconfident' })
    })

    it('takeCalibrationNudge fires at most once per section per session', () => {
        seed(Array.from({ length: 6 }, () => [1, false]))
        expect(takeCalibrationNudge(SECTION)).toMatchObject({ direction: 'overconfident' })
        expect(takeCalibrationNudge(SECTION)).toBeNull()
        // A different section (same course, same evidence) still gets one nudge.
        expect(takeCalibrationNudge(OTHER_SECTION_SAME_COURSE)).toMatchObject({ direction: 'overconfident' })
        expect(takeCalibrationNudge(OTHER_SECTION_SAME_COURSE)).toBeNull()
    })
})
