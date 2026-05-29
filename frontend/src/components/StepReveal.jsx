import { useId, useMemo, useRef, useState } from 'react'

/**
 * StepReveal - an interactive step-through for worked examples and derivations.
 *
 * Drops into MDX as:
 *   <step-reveal
 *     title="Deriving the projectile range"
 *     steps='[
 *       {"prompt":"What stays constant during flight?","reveal":"Horizontal velocity is constant: vx = v cos(theta)."},
 *       {"prompt":"Pick the right time of flight","predictType":"choice",
 *        "choices":["t = v/g","t = 2 v sin(theta)/g","t = v sin(theta)/g"],
 *        "answerIndex":1,
 *        "reveal":"Time of flight t = 2 v sin(theta) / g."},
 *       {"reveal":"Range = vx * t = v^2 sin(2 theta) / g."}
 *     ]'
 *   />
 *
 * Each step may carry an optional "predict" prompt (free text or multiple
 * choice). The learner commits a prediction before revealing the step, and the
 * attempt is logged. Revealed text is announced via an aria-live region. The
 * whole control is keyboard operable and degrades to nothing with no steps.
 *
 * MDX delivers attribute values as strings, so steps is parsed defensively.
 */

function safeParse(raw) {
    if (Array.isArray(raw)) return raw
    if (raw == null) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function normalizeSteps(rawSteps) {
    return safeParse(rawSteps)
        .map((step) => {
            if (typeof step === 'string') {
                return { prompt: '', reveal: step, predictType: 'none', choices: [], answerIndex: null }
            }
            if (!step || typeof step !== 'object') return null
            const reveal = String(step.reveal ?? step.text ?? '')
            if (!reveal.trim()) return null
            const choices = Array.isArray(step.choices) ? step.choices.map(String) : []
            let predictType = step.predictType || step.predict || 'none'
            if (predictType === 'choice' && choices.length === 0) {
                predictType = step.prompt ? 'text' : 'none'
            }
            if (predictType === 'none' && step.prompt) {
                // A bare prompt with no explicit type defaults to free text.
                predictType = 'text'
            }
            const answerIndex = Number.isInteger(step.answerIndex) ? step.answerIndex : null
            return {
                prompt: step.prompt ? String(step.prompt) : '',
                reveal,
                predictType: ['none', 'text', 'choice'].includes(predictType) ? predictType : 'text',
                choices,
                answerIndex,
            }
        })
        .filter(Boolean)
}

export default function StepReveal({ steps, title = 'Step through', onAttempt }) {
    const normalized = useMemo(() => normalizeSteps(steps), [steps])
    const baseId = useId()
    const liveRef = useRef(null)

    // How many steps are fully revealed.
    const [revealedCount, setRevealedCount] = useState(0)
    // Per-step prediction state, keyed by step index.
    const [predictions, setPredictions] = useState({})
    const [announce, setAnnounce] = useState('')

    if (normalized.length === 0) {
        return null
    }

    const total = normalized.length
    const allRevealed = revealedCount >= total
    const activeIndex = revealedCount // the next step awaiting reveal
    const activeStep = normalized[activeIndex]

    const logAttempt = (index, payload) => {
        if (typeof onAttempt === 'function') {
            onAttempt({ stepIndex: index, ...payload })
        }
    }

    const revealNext = () => {
        if (allRevealed) return
        const index = activeIndex
        const step = normalized[index]
        const prediction = predictions[index]

        if (step.predictType === 'choice') {
            const chosen = prediction?.choiceIndex
            const isCorrect =
                step.answerIndex != null && chosen != null ? chosen === step.answerIndex : null
            logAttempt(index, { type: 'choice', choiceIndex: chosen ?? null, isCorrect })
        } else if (step.predictType === 'text') {
            logAttempt(index, { type: 'text', text: prediction?.text || '' })
        }

        const nextCount = index + 1
        setRevealedCount(nextCount)
        setAnnounce(`Step ${nextCount} of ${total} revealed. ${step.reveal}`)
    }

    const reset = () => {
        setRevealedCount(0)
        setPredictions({})
        setAnnounce('All steps hidden. Restarted.')
    }

    const setTextPrediction = (index, text) => {
        setPredictions((prev) => ({ ...prev, [index]: { ...prev[index], text } }))
    }

    const setChoicePrediction = (index, choiceIndex) => {
        setPredictions((prev) => ({ ...prev, [index]: { ...prev[index], choiceIndex } }))
    }

    return (
        <section
            className="my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.88)] p-5 shadow-sm"
            aria-labelledby={`${baseId}-title`}
        >
            <div className="flex items-baseline justify-between gap-3">
                <h4
                    id={`${baseId}-title`}
                    className="text-sm font-semibold uppercase tracking-wider text-[var(--ath-primary)]"
                >
                    {title}
                </h4>
                <span className="text-xs text-[var(--ath-muted)]" aria-hidden="true">
                    {revealedCount} of {total} revealed
                </span>
            </div>

            {/* Progress indicator. */}
            <div
                className="mt-3 flex gap-1"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={revealedCount}
                aria-label={`Progress: ${revealedCount} of ${total} steps revealed`}
            >
                {normalized.map((_, index) => (
                    <span
                        key={index}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                            index < revealedCount
                                ? 'bg-[var(--ath-primary)]'
                                : 'bg-[var(--ath-line)]'
                        }`}
                    />
                ))}
            </div>

            {/* Revealed steps. */}
            <ol className="mt-4 space-y-3">
                {normalized.slice(0, revealedCount).map((step, index) => {
                    const prediction = predictions[index]
                    return (
                        <li key={index} className="rounded-xl bg-[var(--ath-panel)] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ath-muted)]">
                                Step {index + 1}
                            </p>
                            {step.predictType === 'choice' && prediction?.choiceIndex != null && (
                                <p className="mt-1 text-xs text-[var(--ath-muted)]">
                                    Your prediction: {step.choices[prediction.choiceIndex]}
                                    {step.answerIndex != null
                                        ? prediction.choiceIndex === step.answerIndex
                                            ? ' (correct)'
                                            : ' (revisit)'
                                        : ''}
                                </p>
                            )}
                            {step.predictType === 'text' && prediction?.text && (
                                <p className="mt-1 text-xs italic text-[var(--ath-muted)]">
                                    Your prediction: {prediction.text}
                                </p>
                            )}
                            <p className="mt-1 text-sm leading-6 text-[var(--ath-text)]">{step.reveal}</p>
                        </li>
                    )
                })}
            </ol>

            {/* Active step: optional predict prompt, then reveal control. */}
            {!allRevealed && (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--ath-line)] bg-white/70 p-4">
                    <p className="editorial-kicker">Next step</p>
                    {activeStep.prompt && (
                        <p className="mt-2 text-sm font-medium text-[var(--ath-text)]">
                            {activeStep.prompt}
                        </p>
                    )}

                    {activeStep.predictType === 'text' && (
                        <label className="mt-3 block">
                            <span className="sr-only">Your prediction for step {activeIndex + 1}</span>
                            <textarea
                                value={predictions[activeIndex]?.text || ''}
                                onChange={(event) => setTextPrediction(activeIndex, event.target.value)}
                                placeholder="Predict before revealing (optional)"
                                rows={2}
                                className="w-full resize-y rounded-lg border border-[var(--ath-line)] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                            />
                        </label>
                    )}

                    {activeStep.predictType === 'choice' && (
                        <fieldset className="mt-3 grid gap-2">
                            <legend className="sr-only">
                                Predict the answer for step {activeIndex + 1}
                            </legend>
                            {activeStep.choices.map((choice, choiceIndex) => {
                                const id = `${baseId}-s${activeIndex}-c${choiceIndex}`
                                const checked = predictions[activeIndex]?.choiceIndex === choiceIndex
                                return (
                                    <label
                                        key={choiceIndex}
                                        htmlFor={id}
                                        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                                            checked
                                                ? 'border-[var(--ath-primary)] bg-[var(--ath-panel)]'
                                                : 'border-[var(--ath-line)] bg-white'
                                        }`}
                                    >
                                        <input
                                            id={id}
                                            type="radio"
                                            name={`${baseId}-predict-${activeIndex}`}
                                            checked={checked}
                                            onChange={() => setChoicePrediction(activeIndex, choiceIndex)}
                                            className="mt-0.5 accent-[var(--ath-primary)]"
                                        />
                                        <span>{choice}</span>
                                    </label>
                                )
                            })}
                        </fieldset>
                    )}

                    <button
                        type="button"
                        onClick={revealNext}
                        className="editorial-button mt-4 px-4 py-2 text-sm"
                    >
                        Reveal step {activeIndex + 1}
                    </button>
                </div>
            )}

            {allRevealed && (
                <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-[var(--ath-muted)]">All steps revealed.</p>
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-full border border-[var(--ath-line)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--ath-text)] transition-colors hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                    >
                        Start over
                    </button>
                </div>
            )}

            {/* Live announcement of the revealed step for assistive tech. */}
            <p ref={liveRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announce}
            </p>
        </section>
    )
}
