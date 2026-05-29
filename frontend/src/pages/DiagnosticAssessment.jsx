import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import API_BASE from '../lib/apiConfig'
import { recordCalibrationMastery } from '../lib/knowledgeService'
import { getEvaluationStatus, recordEvaluationResult } from '../lib/researchService'
import '../index.css'

function titleize(value = '') {
    return value
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function getPhaseMeta(phase) {
    if (phase === 'post') {
        return {
            title: 'Post-Test',
            subtitle: 'Immediate Learning Check',
            button: 'Return to Reading',
            resultTitle: 'Post-Test Results',
            summaryLabel: 'Immediate Learning Signal'
        }
    }

    if (phase === 'retention') {
        return {
            title: 'Retention Check',
            subtitle: 'Delayed Retention Probe',
            button: 'Resume Review',
            resultTitle: 'Retention Results',
            summaryLabel: 'Delayed Retention Signal'
        }
    }

    return {
        title: 'Diagnostic',
        subtitle: 'Prerequisite Assessment',
        button: 'Start Learning',
        resultTitle: 'Pre-Test Results',
        summaryLabel: 'Recommended Starting Point'
    }
}

export default function DiagnosticAssessment() {
    const { course } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const phase = searchParams.get('phase') || 'pre'

    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState({})
    const [showResults, setShowResults] = useState(false)
    const [results, setResults] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState(null)

    const evaluationStatus = getEvaluationStatus(course)
    const phaseMeta = getPhaseMeta(phase)
    const courseLabel = titleize(course || 'statics')

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const response = await fetch(`${API_BASE}/diagnostic/questions/${course || 'statics'}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch specific questions for ${course}`)
                }

                const data = await response.json()
                const allQuestions = data.questions || []
                const shuffled = [...allQuestions].sort(() => 0.5 - Math.random())
                setQuestions(shuffled.slice(0, 5))
            } catch (error) {
                console.error('Error fetching diagnostic logic:', error)
                setErrorMsg('Unable to load questions.')
            } finally {
                setLoading(false)
            }
        }

        fetchQuestions()
    }, [course])

    const totalQuestions = questions.length

    const handleAnswer = (optionIndex) => {
        setAnswers((previous) => ({ ...previous, [currentQuestion]: optionIndex }))
    }

    const handleNext = () => {
        if (currentQuestion < totalQuestions - 1) {
            setCurrentQuestion((previous) => previous + 1)
        } else {
            void analyzeResults()
        }
    }

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion((previous) => previous - 1)
        }
    }

    const handleSkip = () => {
        navigate(`/book/${course}/01/01`)
    }

    const analyzeResults = async () => {
        const gaps = []
        const masteredConcepts = []
        let score = 0
        const conceptUpdates = {}

        questions.forEach((question, index) => {
            const isCorrect = answers[index] === question.correct
            if (isCorrect) {
                score += 1
                masteredConcepts.push(question.concept)
                conceptUpdates[question.concept] = Math.min((conceptUpdates[question.concept] || 0.5) + 0.4, 0.95)
            } else {
                gaps.push({
                    concept: question.concept,
                    sections: question.prereqFor
                })
                conceptUpdates[question.concept] = Math.max((conceptUpdates[question.concept] || 0.5) - 0.3, 0.1)
            }
        })

        const itemResponses = questions.map((question, index) => {
            const selectedOption = answers[index]
            const correctIndex = question.correct
            return {
                item_id: question.id || `${course}_${phase}_${index + 1}`,
                concept_id: question.concept,
                is_correct: selectedOption === correctIndex,
                selected_option: selectedOption,
                correct_index: correctIndex,
                response_payload: {
                    stem: question.stem,
                    selected_option_text: question.options?.[selectedOption] || null,
                    correct_option_text: question.options?.[correctIndex] || null,
                    prereq_for: question.prereqFor || [],
                    phase,
                    source: 'DiagnosticAssessment',
                },
            }
        })

        const gapSections = [...new Set(gaps.flatMap((gap) => gap.sections))]
        const recommendedStart = gapSections.length > 0 ? gapSections.sort()[0] : '01/01'

        await recordCalibrationMastery(conceptUpdates, {
            courseId: course || 'statics',
            sectionId: `${course || 'statics'}/${recommendedStart}`,
            phase
        })

        const analysisResults = {
            score,
            percentage: Math.round((score / totalQuestions) * 100),
            gaps: gaps.map((gap) => gap.concept),
            masteredConcepts,
            recommendedStart,
            recommendedSections: gapSections,
            level: score >= 4 ? 'Advanced' : score >= 2 ? 'Intermediate' : 'Foundational'
        }

        recordEvaluationResult({
            course,
            phase,
            score,
            percentage: analysisResults.percentage,
            sectionId: `${course}/${recommendedStart}`,
            recommendedStart,
            gaps: analysisResults.gaps,
            masteredConcepts: analysisResults.masteredConcepts,
            totalQuestions,
            itemResponses
        })

        setResults(analysisResults)
        setShowResults(true)
    }

    const handleStartLearning = () => {
        const [chapter, section] = results.recommendedStart.split('/')
        navigate(`/book/${course}/${chapter}/${section}`, {
            state: { diagnosticResults: results, evaluationPhase: phase }
        })
    }

    if (loading) {
        return (
            <div className="editorial-shell min-h-screen px-6 py-12 md:px-10">
                <div className="mx-auto flex max-w-3xl items-center justify-center">
                    <div className="editorial-panel w-full max-w-2xl p-10 text-center">
                        <p className="editorial-kicker">Diagnostic Session</p>
                        <h1 className="editorial-title mt-4 text-4xl">Preparing your pathway</h1>
                        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--ath-muted)]">
                            We are assembling a short concept probe for {courseLabel} so the next reading path starts at the right level.
                        </p>
                        <div className="mx-auto mt-8 h-12 w-12 animate-spin rounded-full border-4 border-[var(--ath-panel-muted)] border-t-[var(--ath-primary)]" />
                    </div>
                </div>
            </div>
        )
    }

    if (errorMsg || questions.length === 0) {
        return (
            <div className="editorial-shell min-h-screen px-6 py-12 md:px-10">
                <div className="mx-auto flex max-w-3xl items-center justify-center">
                    <div className="editorial-panel w-full max-w-xl p-10 text-center">
                        <p className="editorial-kicker">Diagnostic Session</p>
                        <h1 className="editorial-title mt-4 text-3xl">The assessment could not load</h1>
                        <p className="mt-4 text-sm leading-7 text-[var(--ath-muted)]">
                            {errorMsg || 'No questions were found for this course.'}
                        </p>
                        <div className="mt-8 flex justify-center">
                            <button className="editorial-button px-6 py-3 text-sm" onClick={handleSkip}>
                                Continue to the course
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (showResults && results) {
        const toneClasses =
            results.percentage >= 70
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                : results.percentage >= 40
                    ? 'border-amber-200 bg-amber-50/80 text-amber-800'
                    : 'border-[rgba(186,26,26,0.12)] bg-[rgba(255,218,214,0.72)] text-[#8c1d1d]'

        return (
            <div className="editorial-shell min-h-screen px-6 py-12 md:px-10">
                <div className="mx-auto max-w-4xl">
                    <div className="editorial-panel p-6 md:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="editorial-kicker">{courseLabel} {phaseMeta.resultTitle}</p>
                                <h1 className="editorial-title mt-3 text-4xl md:text-5xl">Assessment results</h1>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ath-muted)]">
                                    This score now feeds the adaptive pathway, concept mastery updates, and the next suggested reading entry point.
                                </p>
                            </div>
                            <button onClick={handleSkip} className="editorial-button-secondary px-4 py-2 text-sm">
                                Enter course
                            </button>
                        </div>

                        <div className="editorial-divider my-8" />

                        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                            <section className="rounded-[1.7rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.82)] p-7 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <p className="editorial-label">Performance Snapshot</p>
                                        <h2 className="mt-3 text-3xl font-semibold text-[var(--ath-text)]">{results.level} Level</h2>
                                        <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">
                                            You answered {results.score} of {totalQuestions} questions correctly.
                                        </p>
                                    </div>
                                    <div className={`flex h-28 w-28 items-center justify-center rounded-full border text-3xl font-semibold ${toneClasses}`}>
                                        {results.percentage}%
                                    </div>
                                </div>

                                <div className="mt-8 grid gap-5 md:grid-cols-2">
                                    <div>
                                        <p className="editorial-label">Areas To Focus On</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {results.gaps.length > 0 ? results.gaps.map((gap) => (
                                                <span key={gap} className="editorial-chip border border-[rgba(186,26,26,0.12)] bg-[rgba(255,218,214,0.55)] text-[#8c1d1d]">
                                                    {titleize(gap)}
                                                </span>
                                            )) : (
                                                <span className="editorial-chip border border-emerald-200 bg-emerald-50 text-emerald-700">
                                                    No major prerequisite gaps
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="editorial-label">Strong Areas</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {results.masteredConcepts.length > 0 ? results.masteredConcepts.map((concept) => (
                                                <span key={concept} className="editorial-chip border border-[rgba(15,81,103,0.12)] bg-[rgba(200,226,236,0.35)] text-[var(--ath-primary)]">
                                                    {titleize(concept)}
                                                </span>
                                            )) : (
                                                <span className="editorial-chip">More evidence needed</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <aside className="rounded-[1.7rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-7 shadow-sm">
                                <p className="editorial-label">{phaseMeta.summaryLabel}</p>
                                <h3 className="mt-3 text-2xl font-semibold text-[var(--ath-text)]">
                                    {phase === 'pre' ? `Begin at Section ${results.recommendedStart.replace('/', '.')}` : phaseMeta.title}
                                </h3>
                                <p className="mt-4 text-sm leading-7 text-[var(--ath-muted)]">
                                    {phase === 'pre'
                                        ? 'The pathway will start from the first section linked to your current gaps so the review feels targeted instead of repetitive.'
                                        : phase === 'post'
                                            ? 'This result captures immediate learning after the current pathway. Use it to compare against the retention checkpoint.'
                                            : 'This delayed probe estimates what stayed stable after time away and what needs another pass before the next block.'}
                                </p>

                                <div className="mt-6 rounded-[1.2rem] border border-[var(--ath-line)] bg-white/75 p-4">
                                    <p className="editorial-label">Recommended Sections</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(results.recommendedSections?.length ? results.recommendedSections : [results.recommendedStart]).map((section) => (
                                            <span key={section} className="editorial-chip">
                                                {section.replace('/', '.')}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-6 space-y-3">
                                    <button onClick={handleStartLearning} className="editorial-button w-full px-6 py-3 text-sm">
                                        {phaseMeta.button}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowResults(false)
                                            setCurrentQuestion(0)
                                            setAnswers({})
                                        }}
                                        className="editorial-button-secondary w-full px-6 py-3 text-sm"
                                    >
                                        Retake assessment
                                    </button>
                                </div>
                            </aside>
                        </div>

                        <div className="mt-8 text-center text-sm text-[var(--ath-muted)]">
                            {phase === 'pre' && !evaluationStatus.byPhase.post && (
                                <button
                                    onClick={() => navigate(`/diagnostic/${course}?phase=post`)}
                                    className="font-semibold text-[var(--ath-primary)] hover:underline"
                                >
                                    Take the post-test after the pathway
                                </button>
                            )}
                            {phase === 'post' && <p>A retention probe will be due 7 days after this attempt.</p>}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const currentQ = questions[currentQuestion]
    const progress = Math.round(((currentQuestion + 1) / totalQuestions) * 100)

    return (
        <div className="editorial-shell min-h-screen px-6 py-8 md:px-10">
            <div className="mx-auto max-w-3xl">
                <header className="mb-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                        <span className="text-[var(--ath-text)] uppercase tracking-[0.18em]">{courseLabel}</span>
                        <span className="text-[var(--ath-line-strong)]">/</span>
                        <span>{phaseMeta.title}</span>
                        <span className="text-[var(--ath-line-strong)]">/</span>
                        <span>Q{currentQuestion + 1}/{totalQuestions}</span>
                        <button
                            onClick={handleSkip}
                            className="ml-auto text-xs font-medium text-[var(--ath-muted)] underline-offset-4 hover:text-[var(--ath-text)] hover:underline"
                            type="button"
                        >
                            Skip
                        </button>
                    </div>
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                        <div
                            className="h-full bg-[var(--ath-primary)] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </header>

                <main>
                    <section className="rounded-2xl border border-[var(--ath-line)] bg-white/85 p-6 shadow-sm md:p-8">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                            <span>Concept</span>
                            <span className="text-[var(--ath-line-strong)]">/</span>
                            <span className="text-[var(--ath-text)]">{titleize(currentQ.concept || 'core')}</span>
                        </div>

                        <h2 className="mt-4 text-xl font-semibold leading-8 text-[var(--ath-text)] md:text-2xl">
                            {currentQ.stem}
                        </h2>

                        <div className="mt-6 space-y-2" role="radiogroup" aria-label="Answer options">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = answers[currentQuestion] === idx
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        onClick={() => handleAnswer(idx)}
                                        className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)] ${
                                            isSelected
                                                ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.4)] shadow-sm'
                                                : 'border-[var(--ath-line)] bg-white/85 hover:border-[var(--ath-primary-deep)] hover:bg-[var(--ath-panel)]'
                                        }`}
                                    >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                                            isSelected
                                                ? 'border-[var(--ath-primary)] bg-[var(--ath-primary)] text-white'
                                                : 'border-[var(--ath-line)] bg-white text-[var(--ath-secondary)] group-hover:border-[var(--ath-primary-deep)]'
                                        }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className={`flex-1 ${isSelected ? 'text-[var(--ath-text)]' : 'text-[var(--ath-text)]'}`}>
                                            {option}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                </main>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={handlePrevious}
                        disabled={currentQuestion === 0}
                        className="editorial-button-secondary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={answers[currentQuestion] === undefined}
                        className="editorial-button px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {currentQuestion === totalQuestions - 1 ? 'See results' : 'Next question'}
                    </button>
                </div>
            </div>
        </div>
    )
}
