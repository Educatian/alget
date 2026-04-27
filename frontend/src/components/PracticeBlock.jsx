import { useEffect, useRef, useState } from 'react'
import API_BASE from '../lib/apiConfig'
import { fuseTelemetry, recordAdaptiveSignal, updateMastery } from '../lib/knowledgeService'
import { annotateMisconceptionSignal, resolveInterventionOutcome, updateLearnerModel } from '../lib/researchService'

const STUCK_RULES = {
    IDLE_TIMEOUT_MS: 90000,
    CONSECUTIVE_WRONG: 2,
    HINT_CLICK_COUNT: 2
}

function buildReviewPayload(problem, reason, preferredTab = 'explain') {
    return {
        source: 'practice',
        preferredTab,
        conceptId: problem?.concept_id || null,
        problemId: problem?.id || null,
        question: problem?.statement || problem?.stem || '',
        reason
    }
}

export default function PracticeBlock({ practice, onStuckEvent, onNeedsReview, sectionId }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState({})
    const [gradeResults, setGradeResults] = useState({})
    const [loading, setLoading] = useState(false)
    const [consecutiveWrong, setConsecutiveWrong] = useState(0)
    const [hintCount, setHintCount] = useState(0)
    const [showHint, setShowHint] = useState(false)
    const [confidenceByProblem, setConfidenceByProblem] = useState({})
    const [misconceptionByProblem, setMisconceptionByProblem] = useState({})

    const idleTimerRef = useRef(null)
    const problems = practice?.problems || []
    const currentProblem = problems[currentIndex]

    useEffect(() => {
        const resetIdleTimer = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

            idleTimerRef.current = setTimeout(() => {
                onStuckEvent?.({
                    problemId: currentProblem?.id,
                    reason: 'Idle for 90 seconds without answering'
                })
            }, STUCK_RULES.IDLE_TIMEOUT_MS)
        }

        window.addEventListener('keydown', resetIdleTimer)
        window.addEventListener('click', resetIdleTimer)
        resetIdleTimer()

        return () => {
            window.removeEventListener('keydown', resetIdleTimer)
            window.removeEventListener('click', resetIdleTimer)
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        }
    }, [currentProblem, onStuckEvent])

    useEffect(() => {
        setHintCount(0)
        setShowHint(false)
        setConsecutiveWrong(0)
    }, [currentProblem?.id])

    const handleSubmit = async (problemId) => {
        const answer = answers[problemId]
        if (!answer?.value) return

        setLoading(true)

        try {
            const response = await fetch(`${API_BASE}/grade/${problemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answer: answer.value,
                    unit: answer.unit || ''
                })
            })
            const result = await response.json()
            const confidenceValue = Number(confidenceByProblem[problemId] || 3)
            const misconceptionType = result.unit_error
                ? 'unit_error'
                : misconceptionByProblem[problemId] || 'unknown'

            setGradeResults((previous) => ({ ...previous, [problemId]: result }))
            recordAdaptiveSignal(
                sectionId,
                result.is_correct ? 'practice_correct' : 'practice_incorrect',
                {
                    problemId,
                    conceptId: currentProblem?.concept_id || null,
                    confidence: confidenceValue
                }
            )
            recordAdaptiveSignal(sectionId, 'confidence_report', {
                problemId,
                conceptId: currentProblem?.concept_id || null,
                value: confidenceValue
            })
            if (!result.is_correct) {
                recordAdaptiveSignal(sectionId, 'misconception_report', {
                    problemId,
                    conceptId: currentProblem?.concept_id || null,
                    type: misconceptionType
                })
            }

            if (currentProblem?.concept_id) {
                await updateMastery(
                    { [currentProblem.concept_id]: 1.0 },
                    result.is_correct,
                    { hintUsed: hintCount > 0 }
                )
                updateLearnerModel({
                    sectionId,
                    conceptId: currentProblem.concept_id,
                    isCorrect: result.is_correct,
                    confidence: confidenceValue,
                    misconceptionType,
                    source: 'practice',
                    transferTag: currentProblem?.difficulty === 'hard' ? 'far' : 'near'
                })
                resolveInterventionOutcome({
                    sectionId,
                    conceptId: currentProblem.concept_id,
                    isCorrect: result.is_correct,
                    source: 'practice',
                    confidence: confidenceValue,
                    misconceptionType
                })
            }

            if (!result.is_correct) {
                const nextCount = consecutiveWrong + 1
                setConsecutiveWrong(nextCount)

                if (nextCount >= STUCK_RULES.CONSECUTIVE_WRONG) {
                    onStuckEvent?.({
                        problemId,
                        reason: `${nextCount} consecutive incorrect answers`
                    })
                    setConsecutiveWrong(0)
                }

                if (result.unit_error) {
                    onStuckEvent?.({
                        problemId,
                        reason: 'Unit conversion error detected'
                    })
                }
            } else {
                setConsecutiveWrong(0)
            }
        } catch (error) {
            console.error('Grading error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleHintRequest = () => {
        const nextCount = hintCount + 1
        setHintCount(nextCount)
        setShowHint(true)
        recordAdaptiveSignal(sectionId, 'hint_request', {
            problemId: currentProblem?.id,
            conceptId: currentProblem?.concept_id || null
        })

        const event = new CustomEvent('open-chat', {
            detail: {
                message: `I'm struggling with this problem: "${currentProblem?.statement || currentProblem?.stem}". Can you give me a specific Socratic hint without revealing the full answer?`
            }
        })
        window.dispatchEvent(event)

        if (currentProblem?.concept_id) {
            fuseTelemetry(currentProblem.concept_id, 'hint_request', 1.0).catch(console.error)
        }

        if (nextCount >= STUCK_RULES.HINT_CLICK_COUNT) {
            onStuckEvent?.({
                problemId: currentProblem?.id,
                reason: 'Requested multiple hints'
            })
            setHintCount(0)
        }
    }

    const updateAnswer = (problemId, field, value) => {
        setAnswers((previous) => ({
            ...previous,
            [problemId]: {
                ...previous[problemId],
                [field]: value
            }
        }))
    }

    const updateConfidence = (problemId, value) => {
        setConfidenceByProblem((previous) => ({
            ...previous,
            [problemId]: Number(value)
        }))
    }

    const updateMisconception = (problemId, value) => {
        setMisconceptionByProblem((previous) => ({
            ...previous,
            [problemId]: value
        }))

        if (currentProblem?.concept_id && value && value !== 'unknown') {
            recordAdaptiveSignal(sectionId, 'misconception_report', {
                problemId,
                conceptId: currentProblem.concept_id,
                type: value
            })
            annotateMisconceptionSignal({
                sectionId,
                conceptId: currentProblem.concept_id,
                misconceptionType: value,
                source: 'practice_reflection'
            })
        }
    }

    if (problems.length === 0) {
        return (
            <div className="rounded-[1.8rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.74)] p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ath-panel)] text-lg font-semibold text-[var(--ath-primary)]">
                    PR
                </div>
                <h3 className="text-xl font-semibold text-[var(--ath-text)]">Practice Will Appear Here</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">
                    No section-specific practice problems are available yet.
                </p>
            </div>
        )
    }

    const totalAnswered = Object.keys(gradeResults).length
    const correctCount = Object.values(gradeResults).filter((result) => result.is_correct).length
    const currentResult = gradeResults[currentProblem?.id]

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="editorial-kicker">Practice</p>
                    <h2 className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">Work Through the Section Problems</h2>
                </div>
                <div className="editorial-chip">
                    {totalAnswered}/{problems.length} completed / {correctCount} correct
                </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                <div
                    className="h-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382)] transition-all duration-300"
                    style={{ width: `${(totalAnswered / Math.max(problems.length, 1)) * 100}%` }}
                />
            </div>

            <div className="rounded-[1.9rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.82)] p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="editorial-kicker">Problem {currentIndex + 1} of {problems.length}</span>
                    {currentProblem?.difficulty && (
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                            currentProblem.difficulty === 'easy'
                                ? 'bg-emerald-50 text-emerald-700'
                                : currentProblem.difficulty === 'medium'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-[rgba(255,218,214,0.72)] text-[#8c1d1d]'
                        }`}>
                            {currentProblem.difficulty}
                        </span>
                    )}
                </div>

                <p className="mt-5 text-lg font-medium leading-8 text-[var(--ath-text)]">
                    {currentProblem?.stem || currentProblem?.statement}
                </p>

                {currentProblem?.givens && (
                    <div className="mt-5 rounded-[1.2rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                        <p className="editorial-label">Given Values</p>
                        <ul className="mt-3 space-y-2">
                            {Object.entries(currentProblem.givens).map(([key, value]) => (
                                <li key={key} className="text-sm text-[var(--ath-muted)]">
                                    <code className="rounded bg-white/75 px-2 py-1 text-[var(--ath-text)]">{key}</code> = {value}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!currentResult ? (
                    <div className="mt-6 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row">
                            <input
                                type="text"
                                placeholder="Enter your answer"
                                value={answers[currentProblem?.id]?.value || ''}
                                onChange={(event) => updateAnswer(currentProblem?.id, 'value', event.target.value)}
                                className="editorial-input flex-1"
                            />
                            {currentProblem?.requires_unit && (
                                <input
                                    type="text"
                                    placeholder="Unit"
                                    value={answers[currentProblem?.id]?.unit || ''}
                                    onChange={(event) => updateAnswer(currentProblem?.id, 'unit', event.target.value)}
                                    className="editorial-input w-full md:w-28"
                                />
                            )}
                        </div>

                        <div className="rounded-[1.2rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                            <p className="editorial-label">How confident are you before you submit?</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map((value) => {
                                    const isActive = Number(confidenceByProblem[currentProblem?.id] || 3) === value
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => updateConfidence(currentProblem?.id, value)}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                                isActive
                                                    ? 'bg-[var(--ath-primary)] text-white'
                                                    : 'border border-[var(--ath-line)] bg-white/80 text-[var(--ath-secondary)]'
                                            }`}
                                        >
                                            {value}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => handleSubmit(currentProblem?.id)}
                                disabled={loading || !answers[currentProblem?.id]?.value}
                                className="editorial-button flex-1 px-5 py-3 text-sm disabled:opacity-50"
                            >
                                {loading ? 'Checking Answer...' : 'Submit Answer'}
                            </button>
                            <button
                                onClick={handleHintRequest}
                                className="editorial-button-secondary px-5 py-3 text-sm"
                            >
                                Get a Hint
                            </button>
                        </div>

                        {showHint && currentProblem?.hint && (
                            <div className="rounded-[1.2rem] border border-[rgba(199,137,67,0.18)] bg-[rgba(255,221,187,0.38)] p-4">
                                <p className="text-sm leading-7 text-[var(--ath-text)]">
                                    <span className="font-semibold">Hint:</span> {currentProblem.hint}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`mt-6 rounded-[1.3rem] p-5 ${
                        currentResult.is_correct
                            ? 'border border-emerald-200 bg-emerald-50/70'
                            : 'border border-[rgba(186,26,26,0.12)] bg-[rgba(255,218,214,0.72)]'
                    }`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className={`text-sm font-semibold ${currentResult.is_correct ? 'text-emerald-700' : 'text-[#8c1d1d]'}`}>
                                {currentResult.is_correct ? 'Correct Answer' : 'Not Quite Yet'}
                            </p>
                            {!currentResult.is_correct && (
                                <button
                                    type="button"
                                    onClick={() => onNeedsReview?.(
                                        buildReviewPayload(
                                            currentProblem,
                                            currentResult.unit_error ? 'Practice review: unit conversion issue' : 'Practice review: incorrect answer',
                                            currentResult.unit_error ? 'represent' : 'explain'
                                        )
                                    )}
                                    className="editorial-button px-4 py-2 text-sm"
                                >
                                    Open Targeted Review
                                </button>
                            )}
                        </div>

                        {currentResult.explanation && (
                            <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">{currentResult.explanation}</p>
                        )}

                        {!currentResult.is_correct && currentResult.expected && (
                            <p className="mt-3 text-sm text-[var(--ath-muted)]">
                                Expected target: <code className="rounded bg-white/80 px-2 py-1 text-[var(--ath-text)]">{currentResult.expected}</code>
                            </p>
                        )}

                        {!currentResult.is_correct && (
                            <div className="mt-4 rounded-[1rem] border border-[var(--ath-line)] bg-white/70 p-4">
                                <p className="editorial-label">What Kind of Miss Was This?</p>
                                <select
                                    value={misconceptionByProblem[currentProblem?.id] || (currentResult.unit_error ? 'unit_error' : 'unknown')}
                                    onChange={(event) => updateMisconception(currentProblem?.id, event.target.value)}
                                    className="editorial-input mt-3"
                                >
                                    <option value="unknown">Not sure yet</option>
                                    <option value="unit_error">Unit error</option>
                                    <option value="sign_error">Sign or direction error</option>
                                    <option value="formula_selection">Wrong formula or relation</option>
                                    <option value="concept_mixup">Concept mix-up</option>
                                    <option value="algebraic_slip">Algebra or arithmetic slip</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <button
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="text-sm font-semibold text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-text)] disabled:opacity-50"
                >
                    Previous
                </button>
                <button
                    onClick={() => setCurrentIndex(Math.min(problems.length - 1, currentIndex + 1))}
                    disabled={currentIndex === problems.length - 1}
                    className="text-sm font-semibold text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-text)] disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    )
}
