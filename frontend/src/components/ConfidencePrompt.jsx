import { useEffect, useState } from 'react'
import { useReducedMotion, motionClasses } from '../lib/motion'
import { confidenceLevelsFor, HIGH_CONFIDENCE_MIN } from '../lib/calibration'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/browserStorage'

/**
 * ConfidencePrompt - one-tap judgment-of-learning (JOL) elicitation that IS
 * the submit action. Instead of a separate "check" button, the learner
 * commits to an answer by tapping how sure they are; the tap grades the
 * attempt and reveals correctness.
 *
 * Pedagogy: eliciting JOLs before feedback improves learning (Schäfer et
 * al., 2025 meta-analysis), and pairing the judgment with the outcome is
 * what makes calibration feedback possible (Janssen & Lazonder, 2024).
 * Level values are chance-anchored to the item's option count
 * (see confidenceLevelsFor in lib/calibration.js).
 *
 * Accessibility: a labelled group of ordinary buttons (keyboard-focusable,
 * explicit aria-labels stating that tapping submits). Colors come from the
 * semantic --ath-* tokens so both themes render correctly.
 */

/**
 * @deprecated Static values assume a 4-option item and a saturating 1.0 top
 * anchor. Use confidenceLevelsFor(optionCount) from lib/calibration.js.
 */
export const CONFIDENCE_LEVELS = [
    { value: 0.25, label: 'Just guessing' },
    { value: 0.5, label: 'Not sure' },
    { value: 0.75, label: 'Fairly sure' },
    { value: 1, label: 'Certain' },
]

// One-time framing caption: tells the learner these taps feed their
// calibration profile (unlike e.g. the SelfExplain reflection rating).
// Dismissal persists in localStorage so it truly shows once per browser.
export const CONFIDENCE_CAPTION_DISMISSED_KEY = 'alget_confidence_caption_dismissed_v1'
// Several prompts can be mounted on one page (inline checks + quiz items);
// dismissing the caption anywhere hides it everywhere via this window event.
const CAPTION_DISMISS_EVENT = 'alget:confidence-caption-dismissed'

export default function ConfidencePrompt({ onSelect, disabled = false, promptId, optionCount = null, prompt = 'How sure are you? Tapping a level submits your answer.' }) {
    const reducedMotion = useReducedMotion()
    const levels = confidenceLevelsFor(optionCount)
    const [captionDismissed, setCaptionDismissed] = useState(
        () => safeLocalStorageGet(CONFIDENCE_CAPTION_DISMISSED_KEY) === 'true'
    )

    useEffect(() => {
        const hide = () => setCaptionDismissed(true)
        window.addEventListener(CAPTION_DISMISS_EVENT, hide)
        return () => window.removeEventListener(CAPTION_DISMISS_EVENT, hide)
    }, [])

    const dismissCaption = () => {
        setCaptionDismissed(true)
        safeLocalStorageSet(CONFIDENCE_CAPTION_DISMISSED_KEY, 'true')
        window.dispatchEvent(new Event(CAPTION_DISMISS_EVENT))
    }

    return (
        <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-4 py-3">
            <p id={promptId} className="text-xs font-semibold uppercase tracking-wide text-[var(--ath-secondary)]">
                {prompt}
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={promptId}>
                {levels.map((level) => (
                    <button
                        key={level.label}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(level.value, level.label)}
                        aria-label={`${level.label} - submit answer`}
                        className={`min-h-11 sm:min-h-0 rounded-full border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] ${motionClasses(['transition'], reducedMotion)} ${
                            disabled
                                ? 'cursor-not-allowed border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-muted)] opacity-60'
                                : 'border-[var(--ath-line-strong)] bg-[var(--ath-surface-strong)] text-[var(--ath-text)] hover:border-[var(--ath-primary)] hover:bg-[var(--ath-panel)]'
                        }`}
                    >
                        {level.label}
                    </button>
                ))}
            </div>
            {!captionDismissed && (
                <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--ath-muted)]">
                    <span>Counts toward your calibration profile.</span>
                    <button
                        type="button"
                        onClick={dismissCaption}
                        aria-label="Dismiss calibration note"
                        className="font-semibold underline-offset-2 hover:text-[var(--ath-text)] hover:underline"
                    >
                        Got it
                    </button>
                </p>
            )}
        </div>
    )
}

/**
 * ConfidenceReveal - external-standards feedback next to the verdict
 * (Janssen & Lazonder, 2024): echoes the learner's own judgment ("You said:
 * Fairly sure") so the judgment-vs-outcome pair is visible, and flags a
 * high-confidence miss (wrong at >= HIGH_CONFIDENCE_MIN) as the re-reading
 * priority. Subtle chips, not alarms.
 */
export function ConfidenceReveal({ label, confidence, correct }) {
    if (!label) return null
    const highConfidenceMiss = !correct && Number(confidence) >= HIGH_CONFIDENCE_MIN

    return (
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--ath-secondary)]">
                You said: {label}
            </span>
            {highConfidenceMiss && (
                <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--ath-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--ath-warning)_9%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--ath-text)]">
                    High-confidence miss — worth re-reading this passage
                </span>
            )}
        </span>
    )
}

/**
 * CalibrationNudge - one gentle judgment-vs-performance feedback line shown
 * under the attempt feedback when recent confidence and accuracy diverge
 * (see lib/calibration.js for thresholds and the once-per-section guard).
 */
export function CalibrationNudge({ nudge }) {
    if (!nudge) return null

    const tone = nudge.direction === 'overconfident'
        ? 'border-[color-mix(in_srgb,var(--ath-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--ath-warning)_9%,transparent)]'
        : 'border-[color-mix(in_srgb,var(--ath-info)_45%,transparent)] bg-[color-mix(in_srgb,var(--ath-info)_9%,transparent)]'

    return (
        <div role="note" aria-label="Calibration check" className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-5 text-[var(--ath-text)] ${tone}`}>
            {nudge.message}
        </div>
    )
}
