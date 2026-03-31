import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/apiConfig'
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

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
            const recordsToUpsert = Object.entries(conceptUpdates).map(([conceptId, p_known]) => ({
                user_id: session.user.id,
                concept_id: conceptId,
                p_known
            }))

            if (recordsToUpsert.length > 0) {
                const { error } = await supabase
                    .from('mastery')
                    .upsert(recordsToUpsert, { onConflict: 'user_id, concept_id' })

                if (error) {
                    console.error("Failed to update mastery from diagnostic. Supabase might need 'concepts' table updated with the new keys:", error)
                }
            }
        }

        const gapSections = [...new Set(gaps.flatMap((gap) => gap.sections))]
        const recommendedStart = gapSections.length > 0 ? gapSections.sort()[0] : '01/01'

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
            totalQuestions
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
        <div className="editorial-shell min-h-screen px-6 py-10 md:px-10">
            <div className="mx-auto max-w-4xl">
                <header className="editorial-panel p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="editorial-kicker">{courseLabel} {phaseMeta.title}</p>
                            <h1 className="editorial-title mt-3 text-4xl md:text-5xl">Knowledge calibration</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ath-muted)]">
                                A short entry assessment to locate gaps, confirm strong concepts, and set a more precise starting point in the text.
                            </p>
                        </div>
                        <button onClick={handleSkip} className="editorial-button-secondary px-4 py-2 text-sm">
                            Skip assessment
                        </button>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <span className="editorial-pill">{phaseMeta.subtitle}</span>
                        <span className="editorial-chip">Question {currentQuestion + 1} of {totalQuestions}</span>
                        <span className="editorial-chip">{progress}% complete</span>
                    </div>

                    <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                        <div
                            className="h-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382)] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </header>

                <main className="mt-8 grid gap-6 lg:grid-cols-[1fr_16rem]">
                    <section className="editorial-panel p-7 md:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="editorial-kicker">Concept Probe</span>
                            <span className="editorial-chip">{titleize(currentQ.concept || 'core concept')}</span>
                        </div>

                        <h2 className="mt-5 text-2xl font-semibold leading-relaxed text-[var(--ath-text)] md:text-[2rem]">
                            {currentQ.stem}
                        </h2>

                        <div className="mt-8 space-y-3">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = answers[currentQuestion] === idx
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        className={`flex w-full items-start gap-4 rounded-[1.3rem] border px-5 py-4 text-left transition-all ${
                                            isSelected
                                                ? 'border-[rgba(15,81,103,0.22)] bg-[rgba(200,226,236,0.35)] shadow-sm'
                                                : 'border-[var(--ath-line)] bg-white/82 hover:bg-[var(--ath-panel)]'
                                        }`}
                                    >
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                            isSelected
                                                ? 'border-[var(--ath-primary)] bg-[var(--ath-primary)] text-white'
                                                : 'border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-secondary)]'
                                        }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className={`pt-0.5 text-sm leading-7 ${isSelected ? 'text-[var(--ath-text)]' : 'text-[var(--ath-muted)]'}`}>
                                            {option}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </section>

                    <aside className="rounded-[1.7rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-5 shadow-sm">
                        <p className="editorial-label">Assessment Notes</p>
                        <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ath-muted)]">
                            <p>This probe samples prerequisites, so the goal is placement quality rather than a perfect score.</p>
                            <p>Wrong answers are used to choose where the course should begin, not to lock the pathway.</p>
                        </div>
                    </aside>
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
