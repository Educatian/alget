import { beforeEach, describe, expect, it } from 'vitest'
import {
    CALIBRATION_STORAGE_KEY,
    CALIBRATION_GAP_THRESHOLD,
    FIRST_NUDGE_FLAG_KEY,
    MIN_RECORDS_FOR_NUDGE,
    confidenceLevelsFor,
    getCalibrationNudge,
    getCalibrationSummary,
    recordCalibrationSample,
    takeCalibrationNudge,
} from './calibration'

const SECTION = 'inst-design/01/02'
const OTHER_SECTION_SAME_COURSE = 'inst-design/02/01'
const OTHER_COURSE_SECTION = 'bio-inspired/01/01'

function seed(samples, sectionId = SECTION, optionCount = 4) {
    samples.forEach(([confidence, correct]) =>
        recordCalibrationSample(sectionId, confidence, correct, optionCount))
}

describe('confidenceLevelsFor (chance-anchored half-range scale)', () => {
    it('anchors the floor at chance (1/k) and caps the top at 0.95 for k=4', () => {
        const levels = confidenceLevelsFor(4)
        expect(levels.map((l) => l.value)).toEqual([0.25, 0.48, 0.72, 0.95])
        expect(levels.map((l) => l.label)).toEqual(['Just guessing', 'Not sure', 'Fairly sure', 'Certain'])
    })

    it('anchors the floor at 1/3 for a 3-option item', () => {
        const levels = confidenceLevelsFor(3)
        expect(levels.map((l) => l.value)).toEqual([0.33, 0.54, 0.74, 0.95])
    })

    it('anchors the floor at 0.5 for a true/false item', () => {
        const levels = confidenceLevelsFor(2)
        expect(levels.map((l) => l.value)).toEqual([0.5, 0.65, 0.8, 0.95])
    })

    it('floor equals 1/k and top is 0.95 (never 1.0) for each k', () => {
        for (const k of [2, 3, 4, 5]) {
            const values = confidenceLevelsFor(k).map((l) => l.value)
            expect(values[0]).toBeCloseTo(Math.round((1 / k) * 100) / 100, 5)
            expect(values[3]).toBe(0.95)
            expect(Math.max(...values)).toBeLessThan(1)
        }
    })

    it('defaults to a 4-option scale for missing or invalid option counts', () => {
        for (const bad of [undefined, null, 0, 1, -3, 'x', NaN]) {
            expect(confidenceLevelsFor(bad).map((l) => l.value)).toEqual([0.25, 0.48, 0.72, 0.95])
        }
    })
})

describe('calibration record + nudge thresholds', () => {
    beforeEach(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
    })

    it('persists samples (with optionCount) under the v2 localStorage key', () => {
        recordCalibrationSample(SECTION, 0.72, true, 4)
        const stored = JSON.parse(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
        expect(CALIBRATION_STORAGE_KEY).toBe('alget_calibration_v2')
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ sectionId: SECTION, confidence: 0.72, correct: 1, optionCount: 4 })
        expect(stored[0].ts).toEqual(expect.any(Number))
    })

    it('starts fresh from v1 data: legacy records are never merged and the v1 key is cleared', () => {
        // v1 records used the biased static 0.25..1.0 mapping - a strongly
        // overconfident v1 history must not trigger a v2 nudge.
        window.localStorage.setItem('alget_calibration_v1', JSON.stringify(
            Array.from({ length: 12 }, () => ({ ts: Date.now(), sectionId: SECTION, confidence: 1, correct: 0 })),
        ))
        expect(getCalibrationNudge(SECTION)).toBeNull()
        expect(window.localStorage.getItem('alget_calibration_v1')).toBeNull()
        expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull()
    })

    it('survives malformed v1 payloads without crashing', () => {
        window.localStorage.setItem('alget_calibration_v1', '{not json')
        expect(getCalibrationNudge(SECTION)).toBeNull()
        expect(window.localStorage.getItem('alget_calibration_v1')).toBeNull()
    })

    it('ignores non-numeric confidence values', () => {
        expect(recordCalibrationSample(SECTION, 'high', true)).toBeNull()
        expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull()
    })

    it('stores a null optionCount when the option count is missing or invalid', () => {
        recordCalibrationSample(SECTION, 0.5, true)
        recordCalibrationSample(SECTION, 0.5, true, 'x')
        const stored = JSON.parse(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
        expect(stored.map((r) => r.optionCount)).toEqual([null, null])
    })

    it('stays silent at 9 records even at a maximal gap (min-n boundary)', () => {
        seed(Array.from({ length: MIN_RECORDS_FOR_NUDGE - 1 }, () => [0.95, false]))
        expect(getCalibrationNudge(SECTION)).toBeNull()
    })

    it('nudges at exactly 10 records with a maximal gap (min-n boundary)', () => {
        seed(Array.from({ length: MIN_RECORDS_FOR_NUDGE }, () => [0.95, false]))
        expect(MIN_RECORDS_FOR_NUDGE).toBe(10)
        expect(getCalibrationNudge(SECTION)).toMatchObject({ direction: 'overconfident' })
    })

    it('phrases overconfidence as window evidence counts, with no percentages', () => {
        // 6 high-confidence wrong + 4 low-confidence right:
        // mean(confidence)=0.77, mean(correct)=0.4 -> gap +0.37.
        seed([
            ...Array.from({ length: 6 }, () => [0.95, false]),
            ...Array.from({ length: 4 }, () => [0.48, true]),
        ])
        const nudge = getCalibrationNudge(SECTION)
        expect(nudge).toMatchObject({
            direction: 'overconfident',
            sampleCount: 10,
            highConfidenceCount: 6,
            highConfidenceMisses: 6,
        })
        expect(nudge.message).toBe(
            "Calibration check: on your last 10 checks you tapped 'Fairly sure' or 'Certain' on 6 — 6 of those were wrong. High-confidence misses are the ones worth re-reading.",
        )
        expect(nudge.message).not.toMatch(/%|\d+ ?percent/i)
    })

    it('phrases underconfidence as window evidence counts, with no percentages', () => {
        // 10 "Not sure" (0.48 on a 4-option scale) but 9 right:
        // mean(confidence)=0.48, mean(correct)=0.9 -> gap -0.42.
        seed([
            ...Array.from({ length: 9 }, () => [0.48, true]),
            [0.48, false],
        ])
        const nudge = getCalibrationNudge(SECTION)
        expect(nudge).toMatchObject({
            direction: 'underconfident',
            sampleCount: 10,
            lowConfidenceCount: 10,
            lowConfidenceHits: 9,
        })
        expect(nudge.message).toBe(
            "Calibration check: on your last 10 checks, you tapped 'Just guessing' or 'Not sure' on 10 — 9 of those were actually right. Trust your first answer a little more.",
        )
        expect(nudge.message).not.toMatch(/%/)
    })

    it('stays silent when the gap is below the 0.25 threshold', () => {
        // mean(confidence)=0.72, mean(correct)=0.8 -> |gap| = 0.08.
        seed([
            ...Array.from({ length: 8 }, () => [0.72, true]),
            ...Array.from({ length: 2 }, () => [0.72, false]),
        ])
        expect(CALIBRATION_GAP_THRESHOLD).toBe(0.25)
        expect(getCalibrationNudge(SECTION)).toBeNull()
    })

    it('only counts records from the same course', () => {
        seed(Array.from({ length: 10 }, () => [0.95, false]), OTHER_COURSE_SECTION)
        expect(getCalibrationNudge(SECTION)).toBeNull()
        expect(getCalibrationNudge(OTHER_COURSE_SECTION)).toMatchObject({ direction: 'overconfident' })
    })

    it('takeCalibrationNudge fires at most once per section per session', () => {
        seed(Array.from({ length: 10 }, () => [0.95, false]))
        expect(takeCalibrationNudge(SECTION)).toMatchObject({ direction: 'overconfident' })
        expect(takeCalibrationNudge(SECTION)).toBeNull()
        // A different section (same course, same evidence) still gets one nudge.
        expect(takeCalibrationNudge(OTHER_SECTION_SAME_COURSE)).toMatchObject({ direction: 'overconfident' })
        expect(takeCalibrationNudge(OTHER_SECTION_SAME_COURSE)).toBeNull()
    })

    it('appends the normalizing sentence only to the very first nudge ever', () => {
        const EXTRA = "Most learners overestimate what they'll remember — noticing the gap is itself a skill."
        seed(Array.from({ length: 10 }, () => [0.95, false]))

        const first = takeCalibrationNudge(SECTION)
        expect(first.firstEver).toBe(true)
        expect(first.message).toContain(EXTRA)
        expect(window.localStorage.getItem(FIRST_NUDGE_FLAG_KEY)).toBe('shown')

        const second = takeCalibrationNudge(OTHER_SECTION_SAME_COURSE)
        expect(second).not.toBeNull()
        expect(second.firstEver).toBeUndefined()
        expect(second.message).not.toContain(EXTRA)
    })
})

describe('getCalibrationSummary (section-end debriefing table)', () => {
    beforeEach(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
    })

    it('returns null below 10 course records', () => {
        seed(Array.from({ length: 9 }, () => [0.95, true]))
        expect(getCalibrationSummary(SECTION)).toBeNull()
    })

    it('computes times-used and %-correct per label and hides never-used rows', () => {
        seed([
            [0.25, true], [0.25, true], [0.25, true], // Just guessing: 3 used, 100%
            [0.72, false], [0.72, false], [0.72, false], // Fairly sure: 3 used, 0%
            [0.95, true], [0.95, true], [0.95, true], [0.95, false], [0.95, false], [0.95, false], // Certain: 6 used, 50%
        ])
        const summary = getCalibrationSummary(SECTION)
        expect(summary.total).toBe(12)
        expect(summary.rows).toEqual([
            { label: 'Just guessing', timesUsed: 3, pctCorrect: 100 },
            { label: 'Fairly sure', timesUsed: 3, pctCorrect: 0 },
            { label: 'Certain', timesUsed: 6, pctCorrect: 50 },
        ])
    })

    it('buckets each record against its own option-count scale', () => {
        // 0.74 on a 3-option scale is "Fairly sure" (levels 0.33/0.54/0.74/0.95);
        // on the default 4-option scale it also sits nearest 0.72 - but 0.54
        // ("Not sure" on 3 options) must not fall into the 4-option "Not sure"
        // bucket by accident of rounding, so mix scales explicitly.
        seed(Array.from({ length: 6 }, () => [0.74, true]), SECTION, 3)
        seed(Array.from({ length: 6 }, () => [0.33, false]), SECTION, 3)
        const summary = getCalibrationSummary(SECTION)
        expect(summary.rows).toEqual([
            { label: 'Just guessing', timesUsed: 6, pctCorrect: 0 },
            { label: 'Fairly sure', timesUsed: 6, pctCorrect: 100 },
        ])
    })

    it('uses all course records, not just the 12-record nudge window', () => {
        seed(Array.from({ length: 20 }, () => [0.95, true]))
        expect(getCalibrationSummary(SECTION).total).toBe(20)
    })

    it('excludes other courses', () => {
        seed(Array.from({ length: 12 }, () => [0.95, true]))
        expect(getCalibrationSummary(OTHER_COURSE_SECTION)).toBeNull()
    })
})
