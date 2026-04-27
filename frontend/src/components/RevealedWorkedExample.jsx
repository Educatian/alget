import { useState } from 'react'
import { logEvent } from '../lib/loggingService'

/**
 * RevealedWorkedExample — Sweller worked-example effect with progressive
 * step reveal, paired with an isomorphic "you try" problem.
 *
 * Usage in MDX:
 *   <worked-example title="..." steps='[{"label":"...","detail":"..."}]'
 *                  pair-stem="..." pair-answer="..." />
 *
 * Pedagogy: novices benefit from worked examples *before* practice (Sweller).
 * The isomorphic pair has the same structure with surface differences, so
 * the learner immediately reproduces the procedure on something new.
 */
export default function RevealedWorkedExample({
    title = 'Worked example',
    steps,
    pairStem = '',
    pairAnswer = '',
    sectionId = null,
}) {
    const parsedSteps = typeof steps === 'string' ? safeParse(steps) : steps || []
    const [revealedCount, setRevealedCount] = useState(1)
    const [pairAttempt, setPairAttempt] = useState('')
    const [pairChecked, setPairChecked] = useState(false)

    const revealNext = () => {
        const next = Math.min(revealedCount + 1, parsedSteps.length)
        setRevealedCount(next)
        logEvent('worked_example_step_reveal', sectionId, { step: next }, sectionId)
    }

    const checkPair = () => {
        if (!pairAttempt.trim()) return
        setPairChecked(true)
        const expected = String(pairAnswer || '').trim().toLowerCase()
        const got = pairAttempt.trim().toLowerCase()
        const matches = expected && (got === expected || got.includes(expected) || expected.includes(got))
        logEvent('worked_example_pair_attempt', sectionId, { matches: Boolean(matches) }, sectionId)
    }

    if (parsedSteps.length === 0) return null

    return (
        <div className="my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.88)] p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--ath-primary)]">{title}</h4>
                <span className="text-xs text-[var(--ath-muted)]">
                    Step {revealedCount} of {parsedSteps.length}
                </span>
            </div>

            <ol className="mt-3 space-y-3">
                {parsedSteps.slice(0, revealedCount).map((step, index) => (
                    <li key={index} className="rounded-xl bg-[var(--ath-panel)] px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--ath-text)]">{index + 1}. {step.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">{step.detail}</p>
                        {step.equation && (
                            <pre className="mt-2 overflow-x-auto rounded bg-white/70 p-2 text-xs">{step.equation}</pre>
                        )}
                    </li>
                ))}
            </ol>

            {revealedCount < parsedSteps.length ? (
                <button
                    type="button"
                    onClick={revealNext}
                    className="editorial-button mt-4 px-4 py-2 text-sm"
                >
                    Reveal next step
                </button>
            ) : (
                pairStem && (
                    <div className="mt-5 rounded-xl border border-[var(--ath-line)] bg-white/70 p-4">
                        <p className="editorial-kicker">Now you try</p>
                        <p className="mt-2 text-sm text-[var(--ath-text)]">{pairStem}</p>
                        <div className="mt-3 flex gap-2">
                            <input
                                type="text"
                                value={pairAttempt}
                                onChange={(event) => setPairAttempt(event.target.value)}
                                placeholder="Type your answer..."
                                className="editorial-input flex-1 text-sm"
                                disabled={pairChecked}
                            />
                            <button
                                type="button"
                                onClick={checkPair}
                                disabled={!pairAttempt.trim() || pairChecked}
                                className="editorial-button px-4 py-2 text-sm disabled:opacity-50"
                            >
                                Check
                            </button>
                        </div>
                        {pairChecked && (
                            <p className="mt-2 text-xs text-[var(--ath-muted)]">
                                Reference answer: <span className="font-mono">{pairAnswer}</span>
                            </p>
                        )}
                    </div>
                )
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
