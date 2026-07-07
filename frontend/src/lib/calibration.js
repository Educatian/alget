/**
 * Calibration tracking for one-tap confidence judgments (JOLs).
 *
 * Evidence base: eliciting judgments of learning improves learning itself
 * (Schäfer et al., 2025, Psychological Bulletin meta-analysis), and feeding
 * the judgment-vs-performance gap back to the learner improves calibration
 * (Janssen & Lazonder, 2024, Educational Psychology Review meta-analysis).
 *
 * This module keeps a small client-side rolling record of
 * {confidence, correct, optionCount} tuples (keyed per course via the
 * sectionId prefix) and surfaces at most one gentle nudge per section per
 * session when the learner's recent confidence and accuracy diverge.
 */
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
    safeSessionStorageGet,
    safeSessionStorageSet,
} from './browserStorage'

// v2: confidence values are chance-anchored (floor = 1/optionCount, top = 0.95).
// v1 data used the biased static 0.25..1.0 mapping, so mixing the two scales
// would corrupt the bias metric — v2 deliberately starts fresh.
export const CALIBRATION_STORAGE_KEY = 'alget_calibration_v2'
const LEGACY_CALIBRATION_STORAGE_KEY = 'alget_calibration_v1'
const NUDGE_SESSION_KEY = 'alget_calibration_nudged_v1'
// localStorage (not session) flag: the one-time framing sentence is appended
// only to the very first nudge the learner ever sees, across sessions.
export const FIRST_NUDGE_FLAG_KEY = 'alget_calibration_first_nudge_shown_v1'

// Hard cap so the record can't grow localStorage unbounded; keep most recent.
const MAX_RECORDS = 200
// Rolling window (most recent same-course records) used for the nudge decision.
const WINDOW_SIZE = 12
// Minimum same-course records before any nudge is considered.
// Exact binomial at the 0.25 gap: with n=6 a perfectly calibrated learner is
// falsely nudged 10-23% of the time; n=10 drops the false-positive rate to
// 3-11%, so 10 is the floor for a trustworthy signal.
export const MIN_RECORDS_FOR_NUDGE = 10
// |mean(confidence) - mean(correct)| gap that triggers a nudge.
export const CALIBRATION_GAP_THRESHOLD = 0.25
// A tapped level counts as "high confidence" (top two levels of any
// chance-anchored scale for realistic option counts 2-5) at or above 0.7.
export const HIGH_CONFIDENCE_MIN = 0.7

export const CONFIDENCE_LABELS = ['Just guessing', 'Not sure', 'Fairly sure', 'Certain']

/**
 * Chance-anchored confidence scale (Lichtenstein, Fischhoff & Phillips, 1982,
 * half-range convention): the scale floor must equal the item's chance level
 * 1/k — "Just guessing" on a 4-option item means 25% expected accuracy, not
 * 0% — and the top is capped at 0.95 so a single slip on a "Certain" answer
 * cannot saturate the bias metric the way a literal 1.0 anchor does.
 * Interior points are evenly spaced between the floor and the 0.95 top.
 */
export function confidenceLevelsFor(optionCount) {
    const k = Number(optionCount)
    const count = Number.isFinite(k) && k >= 2 ? Math.floor(k) : 4
    const floor = 1 / count
    const top = 0.95
    const step = (top - floor) / 3
    return CONFIDENCE_LABELS.map((label, index) => ({
        label,
        value: Math.round((floor + step * index) * 100) / 100,
    }))
}

function courseOf(sectionId) {
    return String(sectionId || '').split('/')[0] || 'unknown'
}

function readRecords() {
    // One-time v1 -> v2 migration: v1 records were recorded on the biased
    // static scale, so they are read only to confirm they parse (avoiding
    // crashes on malformed storage) and then discarded — never merged.
    try {
        const legacy = safeLocalStorageGet(LEGACY_CALIBRATION_STORAGE_KEY)
        if (legacy !== null) {
            try {
                JSON.parse(legacy)
            } catch {
                // Malformed v1 payloads are ignored just the same.
            }
            safeLocalStorageRemove(LEGACY_CALIBRATION_STORAGE_KEY)
        }
    } catch {
        // Storage unavailable: nothing to migrate.
    }

    try {
        const parsed = JSON.parse(safeLocalStorageGet(CALIBRATION_STORAGE_KEY) || '[]')
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

/**
 * Append one confidence judgment to the rolling record.
 * `confidence` is the tapped level's chance-anchored value in [0, 1] (that IS
 * the level value); `correct` is the graded outcome; `optionCount` is the
 * item's option count so the record's chance floor stays reconstructable.
 */
export function recordCalibrationSample(sectionId, confidence, correct, optionCount = null) {
    const value = Number(confidence)
    if (!Number.isFinite(value)) return null

    const parsedOptionCount = Number(optionCount)
    const record = {
        ts: Date.now(),
        sectionId: sectionId || null,
        confidence: Math.max(0, Math.min(1, value)),
        correct: correct ? 1 : 0,
        optionCount: Number.isFinite(parsedOptionCount) && parsedOptionCount >= 2
            ? Math.floor(parsedOptionCount)
            : null,
    }
    const records = [...readRecords(), record].slice(-MAX_RECORDS)
    safeLocalStorageSet(CALIBRATION_STORAGE_KEY, JSON.stringify(records))
    return record
}

function courseRecords(sectionId) {
    const course = courseOf(sectionId)
    return readRecords().filter(
        (r) => courseOf(r.sectionId) === course && Number.isFinite(Number(r.confidence))
    )
}

/**
 * Pure read: compute the calibration verdict for the course this section
 * belongs to. Returns null when there is not enough evidence
 * (< MIN_RECORDS_FOR_NUDGE records) or the learner is within the calibrated
 * band; otherwise { direction, message, ...counts }.
 *
 * The message deliberately contains NO numeric percentages (numeric anchors
 * bias the learner's subsequent judgments — anchoring lineage, see
 * 10.1007/s11409-023-09339-w). Instead it cites concrete item evidence from
 * the same window (Miller & Geraci, 2011: concrete prediction-vs-outcome
 * framing). Percentages stay in the returned fields for telemetry only.
 */
export function getCalibrationNudge(sectionId) {
    const recent = courseRecords(sectionId).slice(-WINDOW_SIZE)
    if (recent.length < MIN_RECORDS_FOR_NUDGE) return null

    const meanConfidence = recent.reduce((sum, r) => sum + Number(r.confidence), 0) / recent.length
    const meanCorrect = recent.reduce((sum, r) => sum + (r.correct ? 1 : 0), 0) / recent.length
    const gap = meanConfidence - meanCorrect
    if (Math.abs(gap) < CALIBRATION_GAP_THRESHOLD) return null

    const n = recent.length
    const highConfidence = recent.filter((r) => Number(r.confidence) >= HIGH_CONFIDENCE_MIN)
    const lowConfidence = recent.filter((r) => Number(r.confidence) < HIGH_CONFIDENCE_MIN)
    const highConfidenceMisses = highConfidence.filter((r) => !r.correct).length
    const lowConfidenceHits = lowConfidence.filter((r) => r.correct).length

    const base = {
        confidencePct: Math.round(meanConfidence * 100),
        accuracyPct: Math.round(meanCorrect * 100),
        gap: Math.round(gap * 1000) / 1000,
        sampleCount: n,
        highConfidenceCount: highConfidence.length,
        highConfidenceMisses,
        lowConfidenceCount: lowConfidence.length,
        lowConfidenceHits,
    }

    if (gap > 0) {
        return {
            ...base,
            direction: 'overconfident',
            message: `Calibration check: on your last ${n} checks you tapped 'Fairly sure' or 'Certain' on ${highConfidence.length} — ${highConfidenceMisses} of those were wrong. High-confidence misses are the ones worth re-reading.`,
        }
    }
    return {
        ...base,
        direction: 'underconfident',
        message: `Calibration check: on your last ${n} checks, you tapped 'Just guessing' or 'Not sure' on ${lowConfidence.length} — ${lowConfidenceHits} of those were actually right. Trust your first answer a little more.`,
    }
}

function readNudgedSections() {
    try {
        const parsed = JSON.parse(safeSessionStorageGet(NUDGE_SESSION_KEY) || '[]')
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

/**
 * Nudge with a nag guard: returns the calibration nudge at most once per
 * section per session (sessionStorage-backed), otherwise null.
 *
 * The very first nudge the learner ever sees (localStorage flag) carries one
 * extra normalizing sentence so the feedback lands as skill-framing rather
 * than criticism.
 */
export function takeCalibrationNudge(sectionId) {
    const nudge = getCalibrationNudge(sectionId)
    if (!nudge) return null

    const key = String(sectionId || 'unknown')
    const shown = readNudgedSections()
    if (shown.includes(key)) return null

    safeSessionStorageSet(NUDGE_SESSION_KEY, JSON.stringify([...shown, key]))

    if (!safeLocalStorageGet(FIRST_NUDGE_FLAG_KEY)) {
        safeLocalStorageSet(FIRST_NUDGE_FLAG_KEY, 'shown')
        return {
            ...nudge,
            firstEver: true,
            message: `${nudge.message} Most learners overestimate what they'll remember — noticing the gap is itself a skill.`,
        }
    }
    return nudge
}

/**
 * Per-label calibration summary over ALL of this course's records (cumulative
 * CBM-debriefing table form, not the rolling nudge window). Returns null with
 * fewer than MIN_RECORDS_FOR_NUDGE records; otherwise
 * { total, rows: [{ label, timesUsed, pctCorrect }] } with never-used labels
 * omitted. Each record is bucketed to the nearest level of ITS OWN
 * chance-anchored scale (reconstructed from the stored optionCount), so
 * 3-option and 4-option judgments land on the right label.
 */
export function getCalibrationSummary(sectionId) {
    const records = courseRecords(sectionId)
    if (records.length < MIN_RECORDS_FOR_NUDGE) return null

    const buckets = CONFIDENCE_LABELS.map(() => ({ used: 0, correct: 0 }))
    records.forEach((record) => {
        const levels = confidenceLevelsFor(record.optionCount)
        const confidence = Number(record.confidence)
        let best = 0
        levels.forEach((level, index) => {
            if (Math.abs(level.value - confidence) < Math.abs(levels[best].value - confidence)) {
                best = index
            }
        })
        buckets[best].used += 1
        if (record.correct) buckets[best].correct += 1
    })

    return {
        total: records.length,
        rows: CONFIDENCE_LABELS.map((label, index) => ({
            label,
            timesUsed: buckets[index].used,
            pctCorrect: buckets[index].used > 0
                ? Math.round((buckets[index].correct / buckets[index].used) * 100)
                : null,
        })).filter((row) => row.timesUsed > 0),
    }
}
