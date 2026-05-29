import { useId, useState } from 'react'
import { logInteraction } from '../lib/loggingService'

/**
 * SelfExplain - a metacognitive predict -> explain -> reveal prompt
 * (backlog rank 28).
 *
 * The learner first commits to their own explanation (and a confidence rating)
 * BEFORE the expert take is revealed. Generating an answer from memory, then
 * comparing it to an expert account, is the self-explanation effect: the act of
 * predicting and then checking surfaces gaps the learner would otherwise read
 * past. Revealing the expert explanation only after a commitment is what makes
 * the comparison diagnostic rather than a recognition exercise.
 *
 * MDX usage:
 *   <self-explain
 *     prompt="Why does splitting narration and on-screen text hurt learning?"
 *     answer="It splits attention across two visual channels, raising extraneous load." />
 *
 * MDX attribute values arrive as STRINGS. The component takes simple string
 * props (prompt, answer) and degrades gracefully: with no prompt it renders
 * nothing; with no expert answer the reveal step is skipped.
 *
 * Accessibility: progressive disclosure keeps the flow to one step at a time
 * (no wall of text); the textarea is labelled; the confidence control is a
 * labelled radiogroup; the reveal and the self-assessment results are announced
 * via aria-live; focus styles are visible and motion respects
 * prefers-reduced-motion.
 */
export default function SelfExplain({
    prompt,
    answer,
    sectionId = null,
    conceptId = null,
}) {
    const reactId = useId()
    const promptText = typeof prompt === 'string' ? prompt.trim() : ''
    const expertText = typeof answer === 'string' ? answer.trim() : ''

    // phase: 'predict' (writing) -> 'reveal' (comparing) -> 'assess' (judged)
    const [phase, setPhase] = useState('predict')
    const [explanation, setExplanation] = useState('')
    const [confidence, setConfidence] = useState('')
    const [assessment, setAssessment] = useState('')

    if (!promptText) return null

    const promptId = `${reactId}-prompt`
    const explainId = `${reactId}-explain`
    const confidenceName = `${reactId}-confidence`
    const liveId = `${reactId}-live`
    const canReveal = explanation.trim().length > 0

    const handleReveal = () => {
        if (!canReveal) return
        setPhase(expertText ? 'reveal' : 'assess')
        // Privacy: log metrics about the interaction, not the raw learner text.
        logInteraction(
            `self_explain_reveal:${conceptId || 'concept'}`,
            'predict_then_reveal',
            sectionId,
        )
    }

    const handleAssess = (value) => {
        setAssessment(value)
        setPhase('assess')
        logInteraction(
            `self_explain_assess:${conceptId || 'concept'}:${value}`,
            'self_assessment',
            sectionId,
        )
    }

    return (
        <div className="my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] p-4 shadow-sm">
            <style>{`
                @media (prefers-reduced-motion: reduce) {
                    .self-explain-reveal { animation: none !important; }
                }
            `}</style>
            <p className="editorial-kicker">Predict, then check</p>
            <p id={promptId} className="mt-2 text-sm font-medium text-[var(--ath-text)]">
                {promptText}
            </p>

            {/* Step 1: predict / explain. Always visible until revealed; once
                revealed it locks so the learner cannot retro-edit the prediction. */}
            <div className="mt-3">
                <label htmlFor={explainId} className="text-xs font-semibold text-[var(--ath-secondary)]">
                    Explain it in your own words first
                </label>
                <textarea
                    id={explainId}
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    disabled={phase !== 'predict'}
                    rows={3}
                    aria-describedby={promptId}
                    placeholder="Write your explanation before revealing the expert take."
                    className="mt-1 w-full rounded-xl border border-[var(--ath-line)] bg-white px-3 py-2 text-sm leading-6 text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-70"
                />

                <fieldset className="mt-3" disabled={phase !== 'predict'}>
                    <legend className="text-xs font-semibold text-[var(--ath-secondary)]">
                        How confident are you?
                    </legend>
                    <div role="radiogroup" aria-label="Confidence" className="mt-1 flex flex-wrap gap-2">
                        {CONFIDENCE_LEVELS.map((level) => {
                            const inputId = `${confidenceName}-${level.value}`
                            return (
                                <label
                                    key={level.value}
                                    htmlFor={inputId}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${confidence === level.value
                                        ? 'border-[var(--ath-primary)] bg-[var(--ath-panel)] text-[var(--ath-text)]'
                                        : 'border-[var(--ath-line)] bg-white text-[var(--ath-muted)]'
                                        }`}
                                >
                                    <input
                                        id={inputId}
                                        type="radio"
                                        name={confidenceName}
                                        value={level.value}
                                        checked={confidence === level.value}
                                        onChange={() => setConfidence(level.value)}
                                        className="h-3 w-3 accent-[var(--ath-primary)]"
                                    />
                                    {level.label}
                                </label>
                            )
                        })}
                    </div>
                </fieldset>

                {phase === 'predict' && (
                    <button
                        type="button"
                        onClick={handleReveal}
                        disabled={!canReveal}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--ath-line)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--ath-text)] transition-colors hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {expertText ? 'Reveal the expert explanation' : 'Continue'}
                    </button>
                )}
                {phase === 'predict' && !canReveal && (
                    <p className="mt-1 text-[11px] text-[var(--ath-muted)]">
                        Write your own explanation to unlock the expert take.
                    </p>
                )}
            </div>

            {/* Step 2: reveal expert explanation (progressive disclosure). */}
            <div id={liveId} aria-live="polite">
                {phase !== 'predict' && expertText && (
                    <div className="self-explain-reveal mt-4 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                            Expert explanation
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--ath-text)]">{expertText}</p>
                    </div>
                )}

                {/* Step 3: self-assessment against the expert take. */}
                {phase !== 'predict' && (
                    <fieldset className="mt-3">
                        <legend className="text-xs font-semibold text-[var(--ath-secondary)]">
                            How did your explanation compare?
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {ASSESSMENT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleAssess(option.value)}
                                    aria-pressed={assessment === option.value}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] ${assessment === option.value
                                        ? 'border-[var(--ath-primary)] bg-white text-[var(--ath-text)]'
                                        : 'border-[var(--ath-line)] bg-white text-[var(--ath-muted)] hover:bg-[var(--ath-panel)]'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {assessment && (
                            <p className="mt-2 text-xs leading-5 text-[var(--ath-muted)]" role="status">
                                {ASSESSMENT_FEEDBACK[assessment]}
                            </p>
                        )}
                    </fieldset>
                )}
            </div>
        </div>
    )
}

const CONFIDENCE_LEVELS = [
    { value: 'low', label: 'Not sure' },
    { value: 'medium', label: 'Somewhat sure' },
    { value: 'high', label: 'Very sure' },
]

const ASSESSMENT_OPTIONS = [
    { value: 'matched', label: 'I had it' },
    { value: 'partial', label: 'Partly there' },
    { value: 'missed', label: 'I missed it' },
]

const ASSESSMENT_FEEDBACK = {
    matched: 'Good calibration. Try to add one detail the expert take did not mention.',
    partial: 'Useful gap to notice. Re-read the part you missed before moving on.',
    missed: 'That is exactly what self-explanation is for. Re-read, then restate it once more.',
}
