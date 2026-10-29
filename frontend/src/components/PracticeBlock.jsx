import { useEffect, useRef, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import API_BASE from '../lib/apiConfig'
import { STATIC_DEMO, gradeMultipleChoice } from '../lib/staticDemo'
import { buildHintLadder, revealPassage } from '../lib/hintLadder'
import { recordReviewOutcome } from '../lib/reviewSchedule'
import { TUTOR_ENABLED, askTutorHint } from '../lib/tutorClient'
import { logEvent } from '../lib/loggingService'
import { fuseTelemetry, recordAdaptiveSignal, updateMastery } from '../lib/knowledgeService'
import { annotateMisconceptionSignal, resolveInterventionOutcome, updateLearnerModel } from '../lib/researchService'
import AiBadge from './AiBadge'
import { hasFeature } from '../lib/site'

const AI_BADGE = hasFeature('ai-badge')

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

// Multiple-choice tries before the answer is shown; each wrong pick is struck out for the retry.
const MAX_MCQ_ATTEMPTS = 2
const MAX_AI_HINTS = 2
const isMcqProblem = (p) => p?.type === 'multiple_choice' && Array.isArray(p?.options)

export default function PracticeBlock({ practice, misconceptions = [], sectionContent = '', onStuckEvent, onNeedsReview, sectionId }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState({})
    const [gradeResults, setGradeResults] = useState({})
    const [loading, setLoading] = useState(false)
    const [consecutiveWrong, setConsecutiveWrong] = useState(0)
    const [hintCount, setHintCount] = useState(0)
    const [showHint, setShowHint] = useState(false)
    const [confidenceByProblem, setConfidenceByProblem] = useState({})
    const [misconceptionByProblem, setMisconceptionByProblem] = useState({})
    const [rungsByProblem, setRungsByProblem] = useState({})
    const [struckByProblem, setStruckByProblem] = useState({})
    const [revealedByProblem, setRevealedByProblem] = useState({})

    const idleTimerRef = useRef(null)
    const shownAtRef = useRef(Date.now())
    const attemptsRef = useRef({})
    const problems = practice?.problems || []
    const currentProblem = problems[currentIndex]
    const authoredMisconception = misconceptions.find((m) => m.id === currentProblem?.misconception_id) || null
    const struck = struckByProblem[currentProblem?.id] || []
    // Rungs already shown are kept as shown; the next one is built from the current struck options.
    const shownRungs = rungsByProblem[currentProblem?.id] || []
    const nextRung = buildHintLadder(currentProblem, authoredMisconception, sectionContent, struck)[shownRungs.length] || null
    // After the offline ladder, the AI tutor (when configured) gives up to two Socratic hints.
    const aiHintsUsed = shownRungs.filter((r) => r.kind === 'ai').length
    // The learner's own wrong answers, for the AI tutor; options a hint ruled out are struck too but were never picked.
    const ruledOut = shownRungs.filter((r) => r.kind === 'eliminate').map((r) => r.eliminate)
    const wrongPicks = struck.filter((i) => !ruledOut.includes(i))
    const canAskAi = TUTOR_ENABLED && isMcqProblem(currentProblem) && aiHintsUsed < MAX_AI_HINTS && !shownRungs.some((r) => r.kind === 'ai-unavailable')
    const [aiLoading, setAiLoading] = useState(false)

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
        shownAtRef.current = Date.now()
        if (currentProblem?.id) {
            logEvent('practice_question_shown', currentProblem.id, {
                problem_id: currentProblem.id,
                concept_id: currentProblem.concept_id || null,
                question_index: currentIndex,
                difficulty: currentProblem.difficulty || null,
            }, sectionId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            // The static demo has no backend; multiple choice is graded here by the same rule.
            const result = STATIC_DEMO && isMcq ? gradeMultipleChoice(currentProblem, selectedIndex) : await (await fetch(`${API_BASE}/grade/${problemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answer: isMcq ? (currentProblem.options[selectedIndex] || '') : answer.value,
                    unit: answer?.unit || '',
                    section_id: sectionId || null,
                    selected_option: selectedIndex,
                })
            })).json()
            const confidenceValue = Number(confidenceByProblem[problemId] || 3)
            const misconceptionType = result.unit_error
                ? 'unit_error'
                : misconceptionByProblem[problemId] || 'unknown'

            attemptsRef.current[problemId] = (attemptsRef.current[problemId] || 0) + 1
            setGradeResults((previous) => ({ ...previous, [problemId]: { ...result, attempt: attemptsRef.current[problemId] } }))
            // Full record of this answer for the study (question, choice, outcome, effort).
            logEvent('practice_answer', problemId, {
                problem_id: problemId,
                concept_id: currentProblem?.concept_id || null,
                question_index: currentIndex,
                question: String(currentProblem?.statement || currentProblem?.stem || currentProblem?.question || '').slice(0, 1000),
                question_type: currentProblem?.type || null,
                difficulty: currentProblem?.difficulty || null,
                options: isMcq ? currentProblem.options.slice(0, 10).map((o) => String(o).slice(0, 300)) : null,
                selected_index: selectedIndex,
                selected_option: isMcq ? String(currentProblem.options[selectedIndex] || '').slice(0, 300) : null,
                typed_answer: isMcq ? null : String(answer?.value || '').slice(0, 1000),
                unit: answer?.unit || null,
                is_correct: Boolean(result.is_correct),
                unit_error: Boolean(result.unit_error),
                feedback: String(result.feedback || result.explanation || '').slice(0, 1000),
                attempt_number: attemptsRef.current[problemId],
                time_spent_ms: Date.now() - shownAtRef.current,
                hints_used: hintCount,
                confidence: confidenceValue,
                misconception_type: result.is_correct ? null : misconceptionType,
                authored_misconception_id: result.is_correct ? null : currentProblem?.misconception_id || null,
                hint_rungs_seen: (rungsByProblem[problemId] || []).length,
            }, sectionId)
            if (isMcq && !result.is_correct) {
                setStruckByProblem((previous) => ({ ...previous, [problemId]: [...new Set([...(previous[problemId] || []), selectedIndex])] }))
            }
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
                const hintUsed = hintCount > 0 || (rungsByProblem[problemId] || []).length > 0
                // Review items come from earlier sections; schedule them under their own section.
                recordReviewOutcome(currentProblem.concept_id, currentProblem.review_of || sectionId, result.is_correct, hintUsed)
                await updateMastery(
                    { [currentProblem.concept_id]: 1.0 },
                    result.is_correct,
                    { hintUsed, sectionId }
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

    const handleHintRequest = async () => {
        const nextCount = hintCount + 1
        setHintCount(nextCount)
        setShowHint(true)
        recordAdaptiveSignal(sectionId, 'hint_request', {
            problemId: currentProblem?.id,
            conceptId: currentProblem?.concept_id || null
        })

        // Climb the offline ladder first; the AI tutor (when a backend exists) comes after it.
        const rung = nextRung
        if (rung) {
            setRungsByProblem((previous) => ({ ...previous, [currentProblem.id]: [...shownRungs, rung] }))
            if (rung.kind === 'eliminate') {
                setStruckByProblem((previous) => ({ ...previous, [currentProblem.id]: [...new Set([...(previous[currentProblem.id] || []), rung.eliminate])] }))
                if (answers[currentProblem.id]?.selectedIndex === rung.eliminate) updateAnswer(currentProblem.id, 'selectedIndex', undefined)
            }
            logEvent('hint_rung', currentProblem.id, { problem_id: currentProblem.id, rung: shownRungs.length + 1, kind: rung.kind }, sectionId)
        } else if (canAskAi) {
            const problemId = currentProblem.id
            setAiLoading(true)
            const res = await askTutorHint({ sectionId: currentProblem.review_of || sectionId, problemId, rung: aiHintsUsed + 1, picks: wrongPicks })
            setAiLoading(false)
            const aiRung = res?.hint
                ? { kind: 'ai', title: 'AI tutor', text: `${res.hint}${res.check_question ? ` ${res.check_question}` : ''}` }
                : { kind: 'ai-unavailable', title: 'AI tutor', text: 'The AI tutor can\'t help with this one right now. Try rereading the passage the first hint points to.' }
            setRungsByProblem((previous) => ({ ...previous, [problemId]: [...(previous[problemId] || []), aiRung] }))
            logEvent('hint_rung', problemId, { problem_id: problemId, rung: shownRungs.length + 1, kind: aiRung.kind, tutor_status: res?.hint ? 'ok' : String(res?.error || 'unknown').slice(0, 40) }, sectionId)
        } else if (!STATIC_DEMO) {
            window.dispatchEvent(new CustomEvent('open-chat', {
                detail: {
                    message: `I'm struggling with this problem: "${currentProblem?.statement || currentProblem?.stem}". Can you give me a specific Socratic hint without revealing the full answer?`
                }
            }))
        }

        if (currentProblem?.concept_id && !STATIC_DEMO) {
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

    const isMcq = currentProblem?.type === 'multiple_choice' && Array.isArray(currentProblem?.options)
    const selectedIndex = answers[currentProblem?.id]?.selectedIndex
    const hasSelection = isMcq ? Number.isInteger(selectedIndex) : Boolean(answers[currentProblem?.id]?.value)
    const confidenceValue = Number(confidenceByProblem[currentProblem?.id] || 3)
    const answerShown = Boolean(currentResult?.is_correct || !isMcq || revealedByProblem[currentProblem?.id] || (currentResult?.attempt || 0) >= MAX_MCQ_ATTEMPTS)
    const retryProblem = () => {
        setGradeResults((previous) => {
            const next = { ...previous }
            delete next[currentProblem.id]
            return next
        })
        updateAnswer(currentProblem.id, 'selectedIndex', undefined)
    }

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
                                ? 'bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))] text-[var(--ath-primary)]'
                                : currentProblem.difficulty === 'medium'
                                    ? 'bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] text-[var(--ath-text)]'
                                    : 'bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))] text-[var(--ath-danger)]'
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
                {!currentResult && (
                    <button
                        type="button"
                        onClick={handleHintRequest}
                        disabled={aiLoading || (STATIC_DEMO && !nextRung && !canAskAi)}
                        title={nextRung ? `Hint: ${nextRung.title}` : canAskAi ? 'Ask the AI tutor for a hint (it will not give the answer)' : STATIC_DEMO ? 'No more hints' : 'Ask the tutor for a hint'}
                        aria-label={nextRung ? `Get a hint: ${nextRung.title}` : canAskAi ? 'Get a hint from the AI tutor' : 'Ask the tutor for a hint'}
                        className="absolute right-4 top-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 text-xs font-semibold text-[var(--ath-secondary)] shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] hover:text-[var(--ath-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ath-primary)] disabled:cursor-default disabled:opacity-50"
                    >
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                        {aiLoading ? 'Thinking…' : nextRung ? `Hint ${shownRungs.length + 1}` : canAskAi ? 'Ask AI tutor' : STATIC_DEMO ? 'No more hints' : 'Ask tutor'}
                        {!nextRung && (canAskAi || aiLoading) && <AiBadge />}
                    </button>
                )}

                <p className="pr-28 text-base font-medium leading-7 text-[var(--ath-text)]">
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
                                    const isStruck = struck.includes(index)
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            disabled={isStruck}
                                            aria-label={isStruck ? `${option} (ruled out)` : undefined}
                                            onClick={() => updateAnswer(currentProblem?.id, 'selectedIndex', index)}
                                            className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)] ${
                                                isStruck
                                                    ? 'cursor-not-allowed border-dashed border-[var(--ath-line)] bg-transparent text-[var(--ath-muted)] line-through opacity-60'
                                                    : isSelected
                                                    ? 'border-[var(--ath-primary)] bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] text-[var(--ath-text)] shadow-sm'
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
                            <div className="rounded-xl border border-[var(--ath-line)] bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] p-3">
                                <p className="text-sm leading-6 text-[var(--ath-text)]">
                                    <span className="font-semibold">Hint:</span> {currentProblem.hint}
                                </p>
                            </div>
                        )}

                        {shownRungs.length > 0 && (
                            <ol className="space-y-2" aria-label="Hints" aria-live="polite">
                                {shownRungs.map((rung, i) => (
                                    <li key={`${rung.kind}-${i}`} className="rounded-xl border border-[var(--ath-line)] bg-[color-mix(in_srgb,var(--ath-accent)_10%,var(--ath-panel))] p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                            Hint {i + 1} · {rung.title}{rung.kind === 'ai' && (AI_BADGE ? <AiBadge className="ml-2" /> : <span className="ml-2 rounded bg-[var(--ath-panel)] px-1.5 py-0.5 normal-case tracking-normal">AI-generated</span>)}
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-[var(--ath-text)]">{rung.kind === 'reread' ? `“${rung.text}”` : rung.text}</p>
                                        {rung.kind === 'reread' && (
                                            <button type="button" onClick={() => revealPassage(rung.anchor)} className="mt-2 min-h-[36px] rounded-lg px-2 text-xs font-semibold text-[var(--ath-primary)] underline-offset-2 hover:underline">
                                                Show me in the text
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                ) : (
                    <div className={`mt-6 rounded-[1.3rem] p-5 ${
                        currentResult.is_correct
                            ? 'border border-[var(--ath-line)] bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))]'
                            : 'border border-[color-mix(in_srgb,var(--ath-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))]'
                    }`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className={`text-sm font-semibold ${currentResult.is_correct ? 'text-[var(--ath-primary)]' : 'text-[var(--ath-danger)]'}`}>
                                {currentResult.is_correct ? 'Correct Answer' : 'Not Quite Yet'}
                            </p>
                            {!currentResult.is_correct && !STATIC_DEMO && (
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

                        {!currentResult.is_correct && authoredMisconception && (
                            <div className="mt-3 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Common mix-up</p>
                                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ath-text)]">{authoredMisconception.description}</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">{authoredMisconception.feedback}</p>
                            </div>
                        )}

                        {answerShown && currentResult.explanation && (
                            <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">{currentResult.explanation}</p>
                        )}

                        {answerShown && !currentResult.is_correct && currentResult.expected && (
                            <p className="mt-3 text-sm text-[var(--ath-muted)]">
                                Expected target: <code className="rounded bg-white/80 px-2 py-1 text-[var(--ath-text)]">{currentResult.expected}</code>
                            </p>
                        )}

                        {!answerShown && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button type="button" onClick={retryProblem} className="editorial-button min-h-[40px] px-4 py-2 text-sm">
                                    Try again ({MAX_MCQ_ATTEMPTS - (currentResult.attempt || 0)} left)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRevealedByProblem((previous) => ({ ...previous, [currentProblem.id]: true }))}
                                    className="min-h-[40px] rounded-lg px-3 text-sm font-semibold text-[var(--ath-secondary)] hover:text-[var(--ath-text)]"
                                >
                                    Show answer
                                </button>
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
                                    {authoredMisconception && <option value={authoredMisconception.id}>{authoredMisconception.description}</option>}
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
