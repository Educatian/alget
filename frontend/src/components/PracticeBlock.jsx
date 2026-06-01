import { useEffect, useRef, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { LLM_API_BASE } from '../lib/apiConfig'
import { useToast } from '../lib/toastContext'
import { fuseTelemetry, recordAdaptiveSignal, updateMastery } from '../lib/knowledgeService'
import { logEvent, logProblemAttempt } from '../lib/loggingService'
import { annotateMisconceptionSignal, resolveInterventionOutcome, updateLearnerModel } from '../lib/researchService'

const STUCK_RULES = {
    IDLE_TIMEOUT_MS: 90000,
    CONSECUTIVE_WRONG: 2,
    HINT_CLICK_COUNT: 2
}

const nowMs = () => performance.now()

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
    const toast = useToast()
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
    const attemptStartedAtRef = useRef({})
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
        if (currentProblem?.id) {
            attemptStartedAtRef.current[currentProblem.id] = nowMs()
        }
    }, [currentProblem?.id])

    const handleSubmit = async (problemId) => {
        const answer = answers[problemId]
        const isMcq = currentProblem?.type === 'multiple_choice' && Array.isArray(currentProblem?.options)
        const selectedIndex = isMcq && Number.isInteger(answer?.selectedIndex) ? answer.selectedIndex : null
        if (isMcq) {
            if (selectedIndex === null) return
        } else if (!answer?.value) {
            return
        }

        setLoading(true)

        try {
            const response = await fetch(`${LLM_API_BASE}/grade/${problemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answer: isMcq ? (currentProblem.options[selectedIndex] || '') : answer.value,
                    unit: answer?.unit || '',
                    section_id: sectionId || null,
                    selected_option: selectedIndex,
                })
            })
            if (!response.ok) throw new Error(`Grade ${response.status}`)
            const result = await response.json()
            const confidenceValue = Number(confidenceByProblem[problemId] || 3)
            const timeSpentMs = Math.max(0, nowMs() - (attemptStartedAtRef.current[problemId] || nowMs()))
            // Prefer the authored misconception pattern the backend returned for
            // a wrong MCQ option, so the fused signal carries the real tag rather
            // than only the learner's self-report. Falls back to unit_error and
            // then the self-report selector when no authored pattern is present.
            const misconceptionType = result.unit_error
                ? 'unit_error'
                : (!result.is_correct && result.misconception?.pattern)
                    ? result.misconception.pattern
                    : misconceptionByProblem[problemId] || 'unknown'

            setGradeResults((previous) => ({ ...previous, [problemId]: result }))
            logProblemAttempt(problemId, result.is_correct, timeSpentMs, hintCount > 0, sectionId, {
                source: 'practice',
                concept_id: currentProblem?.concept_id || null,
                confidence: confidenceValue,
                selected_option_index: selectedIndex,
                problem_type: currentProblem?.type || 'constructed_response',
                misconception_type: result.is_correct ? null : misconceptionType,
                unit_error: Boolean(result.unit_error),
                attempt_index: Object.prototype.hasOwnProperty.call(gradeResults, problemId) ? 2 : 1,
            })
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
                    { hintUsed: hintCount > 0, sectionId }
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
            // Don't leave the learner staring at a cleared spinner with no result.
            toast?.error?.('Could not check your answer right now. Please try again.')
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
        logEvent('hint_request', currentProblem?.id || 'practice_problem', {
            source: 'practice',
            problem_id: currentProblem?.id || null,
            concept_id: currentProblem?.concept_id || null,
            hint_count: nextCount,
            has_authored_hint: Boolean(currentProblem?.hint)
        }, sectionId)

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
        logEvent('confidence_report', problemId, {
            source: 'practice',
            problem_id: problemId,
            concept_id: currentProblem?.concept_id || null,
            value: Number(value)
        }, sectionId)
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
            logEvent('misconception_report', problemId, {
                source: 'practice_reflection',
                problem_id: problemId,
                concept_id: currentProblem.concept_id,
                type: value
            }, sectionId)
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

    const isMcq = currentProblem?.type === 'multiple_choice' && Array.isArray(currentProblem?.options)
    const selectedIndex = answers[currentProblem?.id]?.selectedIndex
    const hasSelection = isMcq ? Number.isInteger(selectedIndex) : Boolean(answers[currentProblem?.id]?.value)
    const confidenceValue = Number(confidenceByProblem[currentProblem?.id] || 3)

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                <span className="text-[var(--ath-text)] uppercase tracking-[0.18em]">Practice</span>
                <span className="text-[var(--ath-line-strong)]">/</span>
                <span>Q{currentIndex + 1}/{problems.length}</span>
                <span className="text-[var(--ath-line-strong)]">/</span>
                <span>{correctCount} correct</span>
                {currentProblem?.difficulty && (
                    <>
                        <span className="text-[var(--ath-line-strong)]">/</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                            currentProblem.difficulty === 'easy'
                                ? 'bg-emerald-50 text-emerald-700'
                                : currentProblem.difficulty === 'medium'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-[rgba(255,218,214,0.72)] text-[#8c1d1d]'
                        }`}>{currentProblem.difficulty}</span>
                    </>
                )}
                <div className="ml-auto h-1 w-32 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                    <div
                        className="h-full bg-[var(--ath-primary)] transition-all duration-300"
                        style={{ width: `${(totalAnswered / Math.max(problems.length, 1)) * 100}%` }}
                    />
                </div>
            </div>

            <div className="relative rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.82)] p-6 shadow-sm">
                <button
                    type="button"
                    onClick={handleHintRequest}
                    title={currentProblem?.hint ? 'Show hint' : 'Ask the tutor for a hint'}
                    aria-label="Get a hint"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-white/70 text-[var(--ath-secondary)] shadow-sm transition-all hover:bg-[rgba(255,221,187,0.45)] hover:text-[#8a5b1a]"
                >
                    <Lightbulb className="h-4 w-4" />
                </button>

                <p className="pr-10 text-base font-medium leading-7 text-[var(--ath-text)]">
                    {currentProblem?.stem || currentProblem?.statement}
                </p>

                {currentProblem?.givens && (
                    <div className="mt-4 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Given</p>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                            {Object.entries(currentProblem.givens).map(([key, value]) => (
                                <li key={key} className="text-sm text-[var(--ath-muted)]">
                                    <code className="rounded bg-white/75 px-1.5 py-0.5 text-[var(--ath-text)]">{key}</code> = {value}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!currentResult ? (
                    <div className="mt-5 space-y-4">
                        {isMcq ? (
                            <div className="space-y-2" role="radiogroup" aria-label="Answer options">
                                {currentProblem.options.map((option, index) => {
                                    const isSelected = selectedIndex === index
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            onClick={() => updateAnswer(currentProblem?.id, 'selectedIndex', index)}
                                            className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)] ${
                                                isSelected
                                                    ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.4)] text-[var(--ath-text)] shadow-sm'
                                                    : 'border-[var(--ath-line)] bg-white/80 text-[var(--ath-text)] hover:border-[var(--ath-primary-deep)] hover:bg-[rgba(255,255,255,0.95)]'
                                            }`}
                                        >
                                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                                                isSelected
                                                    ? 'border-[var(--ath-primary)] bg-[var(--ath-primary)] text-white'
                                                    : 'border-[var(--ath-line)] bg-white text-[var(--ath-secondary)] group-hover:border-[var(--ath-primary-deep)]'
                                            }`}>{String.fromCharCode(65 + index)}</span>
                                            <span className="flex-1">{option}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 md:flex-row">
                                <input
                                    type="text"
                                    placeholder="Your answer"
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
                        )}

                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Confidence</span>
                            <div className="flex flex-1 items-center gap-2">
                                <span className="text-[10px] text-[var(--ath-secondary)]">Low</span>
                                <div className="flex flex-1 gap-0.5">
                                    {[1, 2, 3, 4, 5].map((value) => {
                                        const isActive = confidenceValue >= value
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => updateConfidence(currentProblem?.id, value)}
                                                aria-label={`Confidence ${value} of 5`}
                                                aria-pressed={confidenceValue === value}
                                                className={`h-2 flex-1 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)] ${
                                                    isActive ? 'bg-[var(--ath-primary)]' : 'bg-[var(--ath-panel-muted)] hover:bg-[var(--ath-line-strong)]'
                                                }`}
                                            />
                                        )
                                    })}
                                </div>
                                <span className="text-[10px] text-[var(--ath-secondary)]">High</span>
                            </div>
                        </div>

                        <button
                            onClick={() => handleSubmit(currentProblem?.id)}
                            disabled={loading || !hasSelection}
                            className="editorial-button w-full px-5 py-3 text-sm disabled:opacity-50"
                        >
                            {loading ? 'Checking...' : 'Submit'}
                        </button>

                        {showHint && currentProblem?.hint && (
                            <div className="rounded-xl border border-[rgba(199,137,67,0.18)] bg-[rgba(255,221,187,0.38)] p-3">
                                <p className="text-sm leading-6 text-[var(--ath-text)]">
                                    <span className="font-semibold">Hint:</span> {currentProblem.hint}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`animate-fade-in mt-6 rounded-[1.3rem] p-5 ${
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

                        {!currentResult.is_correct && currentResult.misconception?.feedback && (
                            <div className="mt-4 rounded-[1rem] border border-[rgba(199,137,67,0.22)] bg-[rgba(255,245,233,0.9)] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a5b1a]">
                                    Common Misconception
                                </p>
                                <p className="mt-2 text-sm leading-7 text-[var(--ath-text)]">
                                    {currentResult.misconception.feedback}
                                </p>
                                {currentResult.misconception.pattern && (
                                    <p className="mt-2 text-xs text-[var(--ath-muted)]">
                                        Pattern: <code className="rounded bg-white/80 px-1.5 py-0.5 text-[var(--ath-text)]">{currentResult.misconception.pattern}</code>
                                    </p>
                                )}
                            </div>
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
