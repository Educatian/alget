import { useState } from 'react'
import { logEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'

/**
 * InlineCheck — zyBooks-style embedded comprehension check.
 *
 * Drops into MDX as <inline-check question="..." answer="..."
 *   options='[{"text":"...","correct":true|false}]' />.
 * Mid-paragraph placement is the point: every 200-400 words the learner
 * commits to a quick retrieval before continuing. The component logs
 * attempt outcome to the adaptive signal store so the engine sees the
 * learner's running comprehension, not just end-of-section practice.
 */
export default function InlineCheck({
    question,
    options,
    sectionId = null,
    conceptId = null,
}) {
    const parsedOptions = typeof options === 'string' ? safeParse(options) : options || []
    const [selectedIndex, setSelectedIndex] = useState(null)
    const [revealed, setRevealed] = useState(false)

    const handleSelect = (index) => {
        if (revealed) return
        setSelectedIndex(index)
        setRevealed(true)
        const option = parsedOptions[index] || {}
        const isCorrect = Boolean(option.correct || option.isCorrect)
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

    if (!question || parsedOptions.length === 0) return null

    return (
        <div className="my-5 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] p-4 shadow-sm">
            <p className="editorial-kicker">Quick check</p>
            <p className="mt-2 text-sm font-medium text-[var(--ath-text)]">{question}</p>
            <div className="mt-3 grid gap-2">
                {parsedOptions.map((option, index) => {
                    const isCorrect = Boolean(option.correct || option.isCorrect)
                    const isSelected = selectedIndex === index
                    const showState = revealed && isSelected
                    const baseClass = 'flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm leading-6 transition-all duration-150'
                    const stateClass = !revealed
                        ? 'border-[var(--ath-line)] bg-white hover:-translate-y-px hover:border-[var(--ath-primary)] hover:bg-[var(--ath-panel)] hover:shadow-sm active:translate-y-0'
                        : showState && isCorrect
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : showState && !isCorrect
                                ? 'border-rose-300 bg-rose-50 text-rose-900'
                                : isCorrect
                                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                                    : 'border-[var(--ath-line)] bg-white/70 text-[var(--ath-muted)]'

                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleSelect(index)}
                            className={`${baseClass} ${stateClass}`}
                            disabled={revealed}
                            aria-pressed={isSelected}
                            aria-label={`Option ${String.fromCharCode(65 + index)}: ${option.text || ''}`}
                        >
                            <span className="font-mono text-xs">{String.fromCharCode(65 + index)}.</span>
                            <span>{option.text || ''}</span>
                        </button>
                    )
                })}
            </div>
            {revealed && (
                <div className="mt-3 rounded-xl bg-[var(--ath-panel)] px-3 py-2 text-xs leading-5 text-[var(--ath-muted)]">
                    {parsedOptions[selectedIndex]?.explanation || (
                        (parsedOptions[selectedIndex]?.correct || parsedOptions[selectedIndex]?.isCorrect)
                            ? 'Correct. Keep reading.'
                            : 'Not quite — re-read the surrounding passage and try the next check.'
                    )}
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
