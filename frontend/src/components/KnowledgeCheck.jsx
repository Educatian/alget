import { useEffect, useRef, useState } from 'react'
import { generateAssessment, updateMastery, gradeSummary, recordAdaptiveSignal } from '../lib/knowledgeService'
import { logEvent, logGenerationTrace, logProblemAttempt } from '../lib/loggingService'
import { annotateMisconceptionSignal, resolveInterventionOutcome, updateLearnerModel } from '../lib/researchService'
import ConfidenceFeedback from './ConfidenceFeedback'
import RubricFeedback from './RubricFeedback'
import GenerationTrace from './GenerationTrace'

const nowMs = () => performance.now()

function buildReviewPayload(question, sectionTitle, sourceReason) {
    return {
        source: 'knowledge-check',
        preferredTab: 'explain',
        conceptId: question?.concept_id || null,
        problemId: question?.id || question?.concept_id || null,
        question: question?.question || '',
        reason: `${sectionTitle || 'This section'} review: ${sourceReason}`
    }
}

export default function KnowledgeCheck({
    bioContext,
    engContext,
    sectionId,
    sectionTitle,
    contentVersion,
    learningObjectives,
    conceptIds,
    onNeedsReview
}) {
    const [status, setStatus] = useState('idle')
    const [questions, setQuestions] = useState([])
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedOptionId, setSelectedOptionId] = useState(null)
    const [isAnswered, setIsAnswered] = useState(false)
    const [results, setResults] = useState([])
    const [summaryText, setSummaryText] = useState('')
    const [summaryFeedback, setSummaryFeedback] = useState(null)
    const [assessmentTrace, setAssessmentTrace] = useState(null)
    const [isGrading, setIsGrading] = useState(false)
    const [confidence, setConfidence] = useState(3)
    const [misconceptionType, setMisconceptionType] = useState('unknown')
    const questionStartedAtRef = useRef(0)

    const currentQuestion = questions[currentQuestionIndex]

    useEffect(() => {
        questionStartedAtRef.current = nowMs()
    }, [currentQuestionIndex, currentQuestion?.id, currentQuestion?.concept_id])

    const handleStart = async () => {
        setStatus('loading')
        logEvent('assessment_generate_request', 'knowledge_check', {
            source: 'knowledge_check',
            section_title_length: String(sectionTitle || '').length,
            objective_count: Array.isArray(learningObjectives) ? learningObjectives.length : 0,
            concept_count: Array.isArray(conceptIds) ? conceptIds.length : 0
        }, sectionId || sectionTitle || 'knowledge-check')

        try {
            const bioTrim = bioContext ? bioContext.substring(0, 1000) : 'Biological mechanisms of adhesion and load-bearing'
            const engTrim = engContext ? engContext.substring(0, 1000) : 'Engineering statics and equilibrium'
            const titleTrim = sectionTitle || 'Statics 1.1: Equilibrium'
            const retrievalTerms = [titleTrim, ...(learningObjectives || []), ...(conceptIds || [])].join(' ').toLowerCase().split(/\W+/).filter((term) => term.length > 3)
            const retrievedContext = String(bioContext || '').split(/\n\s*\n/).map((content, index) => ({ content: content.trim().slice(0, 900), source_id: sectionId || 'section-context', chunk_index: index }))
                .filter((item) => item.content.length > 40)
                .map((item) => ({ ...item, score: retrievalTerms.filter((term) => item.content.toLowerCase().includes(term)).length }))
                .sort((a, b) => b.score - a.score).slice(0, 5)

            const generated = await generateAssessment(titleTrim, bioTrim, engTrim, learningObjectives, conceptIds, { sectionId, contentVersion, retrievedContext })
            if (!generated || (!generated.mcq_questions?.length && !generated.summary_question)) {
                setStatus('error')
                return
            }

            const combined = [
                ...(generated.mcq_questions || []).map((question) => ({ ...question, type: 'mcq' })),
                ...(generated.summary_question ? [{ ...generated.summary_question, type: 'summary' }] : [])
            ]

            setQuestions(combined)
            setAssessmentTrace(generated.generation_trace || null)
            logGenerationTrace(generated.generation_trace, 'knowledge_check_generation', sectionId)
            setStatus('active')
            logEvent('assessment_generate_success', 'knowledge_check', {
                source: 'knowledge_check',
                item_count: combined.length,
                mcq_count: generated.mcq_questions?.length || 0,
                has_summary: Boolean(generated.summary_question)
            }, sectionId || sectionTitle || 'knowledge-check')
        } catch (error) {
            console.error(error)
            setStatus('error')
            logEvent('assessment_generate_error', 'knowledge_check', {
                source: 'knowledge_check'
            }, sectionId || sectionTitle || 'knowledge-check')
        }
    }

    const handleOptionClick = async (optionId) => {
        if (isAnswered || !currentQuestion) return

        setSelectedOptionId(optionId)
        setIsAnswered(true)

        const isCorrect = optionId === currentQuestion.correct_option_id
        const nextResults = [...results, { isCorrect, conceptId: currentQuestion.concept_id, type: 'mcq' }]
        setResults(nextResults)
        const problemId = currentQuestion.id || currentQuestion.concept_id || `knowledge-check-${currentQuestionIndex + 1}`
        const timeSpentMs = Math.max(0, nowMs() - (questionStartedAtRef.current || nowMs()))

        logProblemAttempt(problemId, isCorrect, timeSpentMs, false, sectionId || sectionTitle || 'knowledge-check', {
            source: 'knowledge_check',
            question_type: 'mcq',
            concept_id: currentQuestion.concept_id,
            confidence,
            selected_option_id: optionId,
            misconception_type: isCorrect ? null : misconceptionType
        })

        updateMastery({ [currentQuestion.concept_id]: 1.0 }, isCorrect, { sectionId }).catch(console.error)
        recordAdaptiveSignal(sectionId || sectionTitle || 'knowledge-check', 'confidence_report', {
            conceptId: currentQuestion.concept_id,
            value: confidence
        })
        if (!isCorrect) {
            recordAdaptiveSignal(sectionId || sectionTitle || 'knowledge-check', 'misconception_report', {
                conceptId: currentQuestion.concept_id,
                type: misconceptionType
            })
        }
        updateLearnerModel({
            sectionId: sectionId || sectionTitle || 'knowledge-check',
            conceptId: currentQuestion.concept_id,
            isCorrect,
            confidence,
            misconceptionType,
            source: 'knowledge_check',
            transferTag: currentQuestion?.type === 'summary' ? 'far' : 'near'
        })
        resolveInterventionOutcome({
            sectionId: sectionId || sectionTitle || 'knowledge-check',
            conceptId: currentQuestion.concept_id,
            isCorrect,
            source: 'knowledge_check',
            confidence,
            misconceptionType
        })
    }

    const handleSummarySubmit = async () => {
        if (!summaryText.trim() || !currentQuestion) return

        setIsGrading(true)

        try {
            const data = await gradeSummary(
                currentQuestion.question,
                summaryText,
                currentQuestion.rubric,
                { sectionId, sectionTitle }
            )

            setSummaryFeedback(data)
            logGenerationTrace(data.generation_trace, 'knowledge_check_grading', sectionId)
            setIsAnswered(true)
            setResults([...results, { isCorrect: data.is_passing, conceptId: currentQuestion.concept_id, type: 'summary' }])
            const problemId = currentQuestion.id || currentQuestion.concept_id || `knowledge-summary-${currentQuestionIndex + 1}`
            const timeSpentMs = Math.max(0, nowMs() - (questionStartedAtRef.current || nowMs()))

            logProblemAttempt(problemId, data.is_passing, timeSpentMs, false, sectionId || sectionTitle || 'knowledge-check', {
                source: 'knowledge_check',
                question_type: 'summary',
                concept_id: currentQuestion.concept_id,
                confidence,
                response_length: summaryText.trim().length,
                content_score: data.content_score ?? null,
                wording_score: data.wording_score ?? null,
                sub_score_count: data.sub_scores ? Object.keys(data.sub_scores).length : 0,
                misconception_type: data.is_passing ? null : misconceptionType
            })

            if (data.sub_scores && Object.keys(data.sub_scores).length > 0) {
                updateMastery(data.sub_scores, data.is_passing, { sectionId }).catch(console.error)
            } else {
                updateMastery({ [currentQuestion.concept_id]: 1.0 }, data.is_passing, { sectionId }).catch(console.error)
            }
            recordAdaptiveSignal(sectionId || sectionTitle || 'knowledge-check', 'confidence_report', {
                conceptId: currentQuestion.concept_id,
                value: confidence
            })
            if (!data.is_passing) {
                recordAdaptiveSignal(sectionId || sectionTitle || 'knowledge-check', 'misconception_report', {
                    conceptId: currentQuestion.concept_id,
                    type: misconceptionType
                })
            }

            updateLearnerModel({
                sectionId: sectionId || sectionTitle || 'knowledge-check',
                conceptId: currentQuestion.concept_id,
                isCorrect: data.is_passing,
                confidence,
                misconceptionType,
                source: 'summary_check',
                transferTag: 'far'
            })
            resolveInterventionOutcome({
                sectionId: sectionId || sectionTitle || 'knowledge-check',
                conceptId: currentQuestion.concept_id,
                isCorrect: data.is_passing,
                source: 'summary_check',
                confidence,
                misconceptionType
            })
        } catch (error) {
            console.error(error)
            setSummaryFeedback({
                content_score: 0.5,
                wording_score: 0.5,
                feedback: 'We could not grade this response just now. Try tightening the mechanism or key idea in one more sentence.',
                is_passing: false
            })
            setIsAnswered(true)
            setResults([...results, { isCorrect: false, conceptId: currentQuestion.concept_id, type: 'summary' }])
            logProblemAttempt(
                currentQuestion.id || currentQuestion.concept_id || `knowledge-summary-${currentQuestionIndex + 1}`,
                false,
                Math.max(0, nowMs() - (questionStartedAtRef.current || nowMs())),
                false,
                sectionId || sectionTitle || 'knowledge-check',
                {
                    source: 'knowledge_check',
                    question_type: 'summary',
                    concept_id: currentQuestion.concept_id,
                    confidence,
                    response_length: summaryText.trim().length,
                    grading_error: true,
                    misconception_type: misconceptionType
                }
            )
            updateLearnerModel({
                sectionId: sectionId || sectionTitle || 'knowledge-check',
                conceptId: currentQuestion.concept_id,
                isCorrect: false,
                confidence,
                misconceptionType,
                source: 'summary_check',
                transferTag: 'far'
            })
        } finally {
            setIsGrading(false)
        }
    }

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1)
            setSelectedOptionId(null)
            setIsAnswered(false)
            setSummaryText('')
            setSummaryFeedback(null)
            setConfidence(3)
            setMisconceptionType('unknown')
            return
        }

        setStatus('completed')
    }

    const triggerReview = (question = currentQuestion, sourceReason = 'knowledge check miss') => {
        onNeedsReview?.(buildReviewPayload(question, sectionTitle, sourceReason))
    }

    if (status === 'idle') {
        return (
            <div className="ath-knowledge-check mt-8 overflow-hidden border-y border-[var(--ath-line)] bg-[color-mix(in_srgb,var(--ath-primary-soft)_28%,transparent)]">
                <div className="h-1 w-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382)]" />
                <div className="px-4 py-6 text-center md:px-8">
                    <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--ath-panel)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--ath-primary)]">
                        Knowledge Check
                    </div>
                    <h3 className="text-2xl font-semibold text-[var(--ath-text)]">Stress-Test Your Understanding</h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">
                        Generate a short adaptive quiz for this section. Missed questions can now feed directly into the support rail for targeted review.
                    </p>
                    <button
                        onClick={handleStart}
                        className="editorial-button mt-5 px-5 py-2.5 text-sm"
                    >
                        Generate Quiz
                    </button>
                </div>
            </div>
        )
    }

    if (status === 'loading') {
        return (
            <div className="ath-knowledge-check mt-8 border-y border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-6 text-center md:px-8">
                <p className="editorial-kicker">Knowledge Check</p>
                <div className="mx-auto my-5 h-12 w-12 animate-spin rounded-full border-4 border-[var(--ath-panel-muted)] border-t-[var(--ath-primary)]" />
                <h3 className="text-2xl font-semibold text-[var(--ath-text)]">Synthesizing Questions</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">
                    BigAL is drafting section-specific checks from the reading and learning objectives.
                </p>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="ath-knowledge-check mt-8 border-y border-[color-mix(in_srgb,var(--ath-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--ath-danger)_8%,var(--ath-panel))] px-4 py-6 text-center md:px-8">
                <p className="editorial-kicker text-[var(--ath-danger)]">Knowledge Check</p>
                <p className="mt-4 text-sm font-medium text-[var(--ath-danger)]">We could not generate the assessment right now.</p>
                <button onClick={() => setStatus('idle')} className="mt-5 min-h-11 px-3 text-sm font-semibold text-[var(--ath-primary)]">
                    Try Again
                </button>
            </div>
        )
    }

    if (status === 'completed') {
        const score = results.filter((result) => result.isCorrect).length
        const missedConcepts = results.filter((result) => !result.isCorrect)

        return (
            <div className="ath-knowledge-check mt-8 border-y border-[var(--ath-line)] bg-[color-mix(in_srgb,var(--ath-primary-soft)_26%,var(--ath-panel))] px-4 py-6 text-center md:px-8">
                <p className="editorial-kicker">Knowledge Check Complete</p>
                <h3 className="mt-3 text-3xl font-semibold text-[var(--ath-text)]">Assessment Complete</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">
                    You answered {score} of {questions.length} items correctly. Mastery was updated for each concept touched in this section.
                </p>

                <ul className="mt-6 flex list-none justify-center gap-2 p-0" aria-label="Per-item results">
                    {results.map((result, index) => (
                        <li
                            key={`${result.conceptId || 'item'}-${index}`}
                            role="img"
                            aria-label={`Item ${index + 1}: ${result.isCorrect ? 'correct' : 'missed'}`}
                            className={`h-3 w-3 rounded-full ${result.isCorrect ? 'bg-emerald-500' : 'bg-[var(--ath-danger)]'}`}
                        />
                    ))}
                </ul>

                {missedConcepts.length > 0 && (
                    <button
                        onClick={() => triggerReview(
                            {
                                concept_id: missedConcepts[0].conceptId,
                                question: 'Review the first missed concept from the section knowledge check.'
                            },
                            'missed concept review'
                        )}
                        className="editorial-button mt-6 px-5 py-3 text-sm"
                    >
                        Review Missed Concepts
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="ath-knowledge-check mt-8 overflow-hidden border-y border-[var(--ath-line)] bg-[var(--ath-surface)]">
            <div className="h-1 w-full bg-[var(--ath-panel-muted)]">
                <div
                    className="h-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382)] transition-all duration-500"
                    style={{ width: `${((currentQuestionIndex + 1) / Math.max(questions.length, 1)) * 100}%` }}
                />
            </div>

            <div className="px-4 py-6 md:px-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="editorial-kicker">
                        Question {currentQuestionIndex + 1} of {questions.length} / {currentQuestion?.type === 'summary' ? 'Short Response' : 'Multiple Choice'}
                    </span>
                    <span className="editorial-chip">Concept {currentQuestion?.concept_id || 'n/a'}</span>
                </div>

                <h3 className="text-2xl font-semibold leading-snug text-[var(--ath-text)]">
                    {currentQuestion?.question}
                </h3>
                <GenerationTrace trace={assessmentTrace} compact />

                <div className="mt-4 border-l-2 border-[var(--ath-line-strong)] bg-[var(--ath-panel)] px-4 py-3">
                    <p className="editorial-label" id={`confidence-label-${currentQuestionIndex}`}>How confident are you in this answer?</p>
                    <div
                        className="mt-3 flex flex-wrap gap-2"
                        role="radiogroup"
                        aria-labelledby={`confidence-label-${currentQuestionIndex}`}
                    >
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={confidence === value}
                                aria-label={`Confidence ${value} of 5`}
                                tabIndex={confidence === value ? 0 : -1}
                                onClick={() => setConfidence(value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                                        event.preventDefault()
                                        setConfidence(value === 5 ? 1 : value + 1)
                                    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                                        event.preventDefault()
                                        setConfidence(value === 1 ? 5 : value - 1)
                                    }
                                }}
                                className={`min-h-11 rounded-full px-4 text-xs font-semibold transition-all ${
                                    confidence === value
                                        ? 'bg-[var(--ath-primary)] text-white'
                                        : 'border border-[var(--ath-line)] bg-white/80 text-[var(--ath-secondary)]'
                                }`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>

                {currentQuestion?.type === 'mcq' ? (
                    <div className="mt-8 space-y-3" role="radiogroup" aria-label="Answer choices">
                        {currentQuestion.options?.map((option, optionIndex) => {
                            const optionId = option?.id || String.fromCharCode(65 + optionIndex)
                            const optionText = typeof option === 'string' ? option : (option?.text || '')
                            const isSelected = selectedOptionId === optionId
                            const isCorrect = optionId === currentQuestion.correct_option_id
                            let resultLabel = ''
                            if (isAnswered && isCorrect) {
                                resultLabel = ' (correct answer)'
                            } else if (isAnswered && isSelected && !isCorrect) {
                                resultLabel = ' (your answer, incorrect)'
                            }
                            const isFocusable = isSelected || (selectedOptionId === null && optionIndex === 0)

                            let optionClasses = 'border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:bg-[var(--ath-panel)]'

                            if (isAnswered) {
                                if (isCorrect) {
                                    optionClasses = 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                } else if (isSelected) {
                                    optionClasses = 'border-[color-mix(in_srgb,var(--ath-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ath-danger)_11%,var(--ath-panel))] text-[var(--ath-danger)]'
                                } else {
                                    optionClasses = 'border-[var(--ath-line)] bg-white/70 text-[var(--ath-muted)] opacity-70'
                                }
                            } else if (isSelected) {
                                optionClasses = 'border-[rgba(15,81,103,0.18)] bg-[rgba(200,226,236,0.35)] text-[var(--ath-text)]'
                            }

                            return (
                                <button
                                    key={optionId}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={`${optionId}. ${optionText}${resultLabel}`}
                                    tabIndex={isAnswered ? -1 : (isFocusable ? 0 : -1)}
                                    disabled={isAnswered}
                                    onClick={() => handleOptionClick(optionId)}
                                    className={`flex min-h-14 w-full items-center gap-3 rounded-[var(--ath-radius)] border px-4 py-3 text-left transition-all ${optionClasses}`}
                                >
                                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] text-xs font-bold text-[var(--ath-secondary)]">{optionId}</span>
                                    <span className="flex-1 text-sm leading-7">{optionText}</span>
                                </button>
                            )
                        })}

                        {isAnswered && (
                            <div role="status" aria-live="polite" className="animate-fade-in mt-5 border-l-2 border-[var(--ath-line-strong)] bg-[var(--ath-panel)] px-4 py-4">
                                <p className={`text-sm font-semibold ${selectedOptionId === currentQuestion.correct_option_id ? 'text-emerald-700' : 'text-[var(--ath-danger)]'}`}>
                                    {selectedOptionId === currentQuestion.correct_option_id ? 'Correct' : 'Needs Another Pass'}
                                </p>
                                <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">{currentQuestion.explanation}</p>

                                {selectedOptionId !== currentQuestion.correct_option_id && (
                                    <div className="mt-4 space-y-3">
                                        <div className="rounded-[1rem] border border-[var(--ath-line)] bg-white/75 p-4">
                                            <p className="editorial-label">What kind of miss was this?</p>
                                            <select
                                                value={misconceptionType}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value
                                                    setMisconceptionType(nextValue)
                                                    if (currentQuestion?.concept_id && nextValue !== 'unknown') {
                                                        recordAdaptiveSignal(sectionId || sectionTitle || 'knowledge-check', 'misconception_report', {
                                                            conceptId: currentQuestion.concept_id,
                                                            type: nextValue
                                                        })
                                                        logEvent('misconception_report', currentQuestion.id || currentQuestion.concept_id || 'knowledge-check', {
                                                            source: 'knowledge_check_reflection',
                                                            concept_id: currentQuestion.concept_id,
                                                            type: nextValue
                                                        }, sectionId || sectionTitle || 'knowledge-check')
                                                        annotateMisconceptionSignal({
                                                            sectionId: sectionId || sectionTitle || 'knowledge-check',
                                                            conceptId: currentQuestion.concept_id,
                                                            misconceptionType: nextValue,
                                                            source: 'knowledge_check_reflection'
                                                        })
                                                    }
                                                }}
                                                className="editorial-input mt-3"
                                            >
                                                <option value="unknown">Not sure yet</option>
                                                <option value="concept_mixup">Concept mix-up</option>
                                                <option value="formula_selection">Wrong formula or relation</option>
                                                <option value="sign_error">Sign or direction error</option>
                                                <option value="algebraic_slip">Algebra or arithmetic slip</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => triggerReview(currentQuestion, 'missed multiple-choice concept')}
                                            className="editorial-button px-4 py-2 text-sm"
                                        >
                                            Review This Concept
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleNextQuestion}
                                            className="editorial-button-secondary px-4 py-2 text-sm"
                                        >
                                            Keep Going
                                        </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-8 space-y-4">
                        <textarea
                            value={summaryText}
                            onChange={(event) => setSummaryText(event.target.value)}
                            disabled={isAnswered || isGrading}
                            placeholder="Write a concise explanation in your own words."
                            className="editorial-input min-h-36 resize-none"
                        />

                        {!isAnswered && (
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSummarySubmit}
                                    disabled={isGrading || !summaryText.trim()}
                                    className="editorial-button px-5 py-3 text-sm disabled:opacity-50"
                                >
                                    {isGrading ? 'Evaluating...' : 'Submit Response'}
                                </button>
                            </div>
                        )}

                        {isAnswered && summaryFeedback && (
                            <div role="status" aria-live="polite" className="animate-fade-in border-l-2 border-[var(--ath-line-strong)] bg-[var(--ath-panel)] px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <p className={`text-sm font-semibold ${summaryFeedback.is_passing ? 'text-emerald-700' : 'text-[var(--ath-danger)]'}`}>
                                        {summaryFeedback.is_passing ? 'Passing Response' : 'Needs More Specificity'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">
                                        <span>Content {Math.round((summaryFeedback.content_score || 0) * 100)}%</span>
                                        <span>Wording {Math.round((summaryFeedback.wording_score || 0) * 100)}%</span>
                                    </div>
                                </div>

                                <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">{summaryFeedback.feedback}</p>

                                <RubricFeedback
                                    rubric={currentQuestion.rubric}
                                    subScores={summaryFeedback.sub_scores}
                                    contentScore={summaryFeedback.content_score}
                                    wordingScore={summaryFeedback.wording_score}
                                    feedback={null}
                                />
                                <GenerationTrace trace={summaryFeedback.generation_trace} compact />

                                {!summaryFeedback.is_passing && (
                                    <div className="mt-4 space-y-3">
                                        <div className="rounded-[1rem] border border-[var(--ath-line)] bg-white/75 p-4">
                                            <p className="editorial-label">What felt hardest here?</p>
                                            <select
                                                value={misconceptionType}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value
                                                    setMisconceptionType(nextValue)
                                                    if (currentQuestion?.concept_id && nextValue !== 'unknown') {
                                                        recordAdaptiveSignal(sectionId || sectionTitle || 'knowledge-check', 'misconception_report', {
                                                            conceptId: currentQuestion.concept_id,
                                                            type: nextValue
                                                        })
                                                        logEvent('misconception_report', currentQuestion.id || currentQuestion.concept_id || 'knowledge-check', {
                                                            source: 'summary_reflection',
                                                            concept_id: currentQuestion.concept_id,
                                                            type: nextValue
                                                        }, sectionId || sectionTitle || 'knowledge-check')
                                                        annotateMisconceptionSignal({
                                                            sectionId: sectionId || sectionTitle || 'knowledge-check',
                                                            conceptId: currentQuestion.concept_id,
                                                            misconceptionType: nextValue,
                                                            source: 'summary_reflection'
                                                        })
                                                    }
                                                }}
                                                className="editorial-input mt-3"
                                            >
                                                <option value="unknown">Not sure yet</option>
                                                <option value="concept_mixup">Concept mix-up</option>
                                                <option value="formula_selection">Wrong concept or relation</option>
                                                <option value="insufficient_precision">I knew it, but answered too loosely</option>
                                                <option value="transfer_gap">I could not transfer the idea to this prompt</option>
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => triggerReview(currentQuestion, 'short-response review')}
                                            className="editorial-button px-4 py-2 text-sm"
                                        >
                                            Review Before the Next Question
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {isAnswered && (
                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handleNextQuestion}
                            className="editorial-button px-5 py-3 text-sm"
                        >
                            {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Assessment'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
