import { useId, useState } from 'react'
import { Check, X } from 'lucide-react'
import { logEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'
import { useReducedMotion, motionClasses } from '../lib/motion'

/**
 * InlineCheck - zyBooks-style embedded comprehension check.
 *
 * Drops into MDX as <inline-check question="..." explanation="..."
 *   options='[{"text":"...","correct":true|false}]' />.
 * Mid-paragraph placement is the point: every 200-400 words the learner
 * commits to a quick retrieval before continuing. The component logs
 * attempt outcome to the adaptive signal store so the engine sees the
 * learner's running comprehension, not just end-of-section practice.
 *
 * Accessibility: the options form an ARIA radiogroup with roving tabindex and
 * arrow-key navigation; selection grades immediately and the verdict is
 * announced through a polite live region. Correctness is conveyed with an icon
 * and text label, never color alone.
 */
export default function InlineCheck({
    question,
    options,
    explanation = null,
    sectionId = null,
    conceptId = null,
}) {
    const reducedMotion = useReducedMotion()
    const baseId = useId()
    const parsedOptions = typeof options === 'string' ? safeParse(options) : options || []
    const [selectedIndex, setSelectedIndex] = useState(null)
    const [revealed, setRevealed] = useState(false)

    const optionIsCorrect = (option) => Boolean(option?.correct || option?.isCorrect)

    const grade = (index) => {
        if (revealed) return
        setSelectedIndex(index)
        setRevealed(true)
        const option = parsedOptions[index] || {}
        const isCorrect = optionIsCorrect(option)
        logEvent(
            'inline_check_attempt',
            sectionId,
            { is_correct: isCorrect, option_index: index, concept_id: conceptId },
            sectionId
        )
        if (conceptId) {
            recordAdaptiveSignal(sectionId, isCorrect ? 'inline_check_correct' : 'inline_check_incorrect', {
                conceptId,
                optionIndex: index,
            })
        }
    }

    const handleKeyDown = (event, index) => {
        if (revealed) return
        const total = parsedOptions.length
        if (total === 0) return

        let nextIndex = null
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            nextIndex = ((selectedIndex ?? index) + 1) % total
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            nextIndex = ((selectedIndex ?? index) - 1 + total) % total
        } else if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            grade(index)
            return
        }

        if (nextIndex !== null) {
            event.preventDefault()
            setSelectedIndex(nextIndex)
        }
    }

    if (!question || parsedOptions.length === 0) return null

    const selectedCorrect = revealed && optionIsCorrect(parsedOptions[selectedIndex])
    const feedbackId = `${baseId}-feedback`
    const resolvedExplanation =
        parsedOptions[selectedIndex]?.explanation
        || explanation
        || (selectedCorrect
            ? 'Keep reading.'
            : 'Re-read the surrounding passage and try the next check.')

    return (
        <div className="my-5 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] p-4 shadow-sm">
            <p className="editorial-kicker">Quick check</p>
            <p className="mt-2 text-sm font-medium text-[var(--ath-text)]" id={`${baseId}-q`}>{question}</p>
            <div
                className="mt-3 grid gap-2"
                role="radiogroup"
                aria-labelledby={`${baseId}-q`}
            >
                {parsedOptions.map((option, index) => {
                    const isCorrect = optionIsCorrect(option)
                    const isSelected = selectedIndex === index
                    const isFocusable = isSelected || (selectedIndex === null && index === 0)
                    const showSelectedState = revealed && isSelected
                    const baseClass = 'flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]'
                    const motion = motionClasses(['transition', revealed ? '' : 'lift', revealed ? '' : 'press'], reducedMotion)
                    const stateClass = !revealed
                        ? 'border-[var(--ath-line)] bg-white hover:border-[var(--ath-primary)] hover:bg-[var(--ath-panel)] hover:shadow-sm'
                        : showSelectedState && isCorrect
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : showSelectedState && !isCorrect
                                ? 'border-rose-300 bg-rose-50 text-rose-900'
                                : isCorrect
                                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                                    : 'border-[var(--ath-line)] bg-white/70 text-[var(--ath-muted)]'

                    let resultLabel = ''
                    if (revealed && isCorrect) {
                        resultLabel = ' (correct answer)'
                    } else if (showSelectedState && !isCorrect) {
                        resultLabel = ' (your answer, incorrect)'
                    }

                    return (
                        <button
                            key={index}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={revealed ? -1 : (isFocusable ? 0 : -1)}
                            onClick={() => grade(index)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={`${baseClass} ${motion} ${stateClass}`}
                            disabled={revealed}
                            aria-label={`Option ${String.fromCharCode(65 + index)}: ${option.text || ''}${resultLabel}`}
                        >
                            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center font-mono text-xs">
                                {revealed && isCorrect ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} aria-hidden="true" />
                                ) : showSelectedState && !isCorrect ? (
                                    <X className="h-3.5 w-3.5 text-rose-600" strokeWidth={3} aria-hidden="true" />
                                ) : (
                                    <span aria-hidden="true">{String.fromCharCode(65 + index)}.</span>
                                )}
                            </span>
                            <span className="flex-1">{option.text || ''}</span>
                        </button>
                    )
                })}
            </div>
            {revealed && (
                <div
                    id={feedbackId}
                    role="status"
                    aria-live="polite"
                    className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5 ${motionClasses(['fadeIn'], reducedMotion)} ${
                        selectedCorrect
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'bg-rose-50 text-rose-900'
                    }`}
                >
                    <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white ${selectedCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        aria-hidden="true"
                    >
                        {selectedCorrect
                            ? <Check className="h-3 w-3" strokeWidth={3} />
                            : <X className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span>
                        <span className="font-semibold">{selectedCorrect ? 'Correct. ' : 'Not quite. '}</span>
                        {resolvedExplanation}
                    </span>
                </div>
            )}
        </div>
    )
}

function safeParse(raw) {
    try {
        return JSON.parse(raw)
    } catch {
        return []
    }
}
