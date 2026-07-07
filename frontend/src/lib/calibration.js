/**
 * Calibration tracking for one-tap confidence judgments (JOLs).
 *
 * Evidence base: eliciting judgments of learning improves learning itself
 * (Schäfer et al., 2025, Psychological Bulletin meta-analysis), and feeding
 * the judgment-vs-performance gap back to the learner improves calibration
 * (Janssen & Lazonder, 2024, Educational Psychology Review meta-analysis).
 *
 * This module keeps a small client-side rolling record of
 * {confidence, correct} pairs (keyed per course via the sectionId prefix)
 * and surfaces at most one gentle nudge per section per session when the
 * learner's recent confidence and accuracy diverge.
 */
import {
    safeLocalStorageGet,
    safeLocalStorageSet,
    safeSessionStorageGet,
    safeSessionStorageSet,
} from './browserStorage'

export const CALIBRATION_STORAGE_KEY = 'alget_calibration_v1'
const NUDGE_SESSION_KEY = 'alget_calibration_nudged_v1'

// Hard cap so the record can't grow localStorage unbounded; keep most recent.
const MAX_RECORDS = 200
// Rolling window (most recent same-course records) used for the nudge decision.
const WINDOW_SIZE = 12
// Minimum same-course records before any nudge is considered.
export const MIN_RECORDS_FOR_NUDGE = 6
// |mean(confidence) - mean(correct)| gap that triggers a nudge.
export const CALIBRATION_GAP_THRESHOLD = 0.25

function courseOf(sectionId) {
    return String(sectionId || '').split('/')[0] || 'unknown'
}

function readRecords() {
    try {
        const parsed = JSON.parse(safeLocalStorageGet(CALIBRATION_STORAGE_KEY) || '[]')
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

/**
 * Append one confidence judgment to the rolling record.
 * `confidence` is the tapped level in [0, 1]; `correct` is the graded outcome.
 */
export function recordCalibrationSample(sectionId, confidence, correct) {
    const value = Number(confidence)
    if (!Number.isFinite(value)) return null

    const record = {
        ts: Date.now(),
        sectionId: sectionId || null,
        confidence: Math.max(0, Math.min(1, value)),
        correct: correct ? 1 : 0,
    }
    const records = [...readRecords(), record].slice(-MAX_RECORDS)
    safeLocalStorageSet(CALIBRATION_STORAGE_KEY, JSON.stringify(records))
    return record
}

/**
 * Pure read: compute the calibration verdict for the course this section
 * belongs to. Returns null when there is not enough evidence (< 6 records)
 * or the learner is within the calibrated band; otherwise
 * { direction, confidencePct, accuracyPct, gap, message }.
 */
export function getCalibrationNudge(sectionId) {
    const course = courseOf(sectionId)
    const recent = readRecords()
        .filter((r) => courseOf(r.sectionId) === course && Number.isFinite(Number(r.confidence)))
        .slice(-WINDOW_SIZE)
    if (recent.length < MIN_RECORDS_FOR_NUDGE) return null

    const meanConfidence = recent.reduce((sum, r) => sum + Number(r.confidence), 0) / recent.length
    const meanCorrect = recent.reduce((sum, r) => sum + (r.correct ? 1 : 0), 0) / recent.length
    const gap = meanConfidence - meanCorrect
    if (Math.abs(gap) < CALIBRATION_GAP_THRESHOLD) return null

    const confidencePct = Math.round(meanConfidence * 100)
    const accuracyPct = Math.round(meanCorrect * 100)
    const base = { confidencePct, accuracyPct, gap: Math.round(gap * 1000) / 1000, sampleCount: recent.length }

    if (gap > 0) {
        return {
            ...base,
            direction: 'overconfident',
            message: `Calibration check: your recent confidence (${confidencePct}%) is running ahead of your accuracy (${accuracyPct}%). Trying to answer before re-reading strengthens memory.`,
        }
    }
    return {
        ...base,
        direction: 'underconfident',
        message: `Calibration check: your recent accuracy (${accuracyPct}%) is running ahead of your confidence (${confidencePct}%). You know more than you are giving yourself credit for - trust your first answer a little more.`,
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
 */
export function takeCalibrationNudge(sectionId) {
    const nudge = getCalibrationNudge(sectionId)
    if (!nudge) return null

    const key = String(sectionId || 'unknown')
    const shown = readNudgedSections()
    if (shown.includes(key)) return null

    safeSessionStorageSet(NUDGE_SESSION_KEY, JSON.stringify([...shown, key]))
    return nudge
}
