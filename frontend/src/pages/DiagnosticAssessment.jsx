import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/apiConfig'
import { getEvaluationStatus, recordEvaluationResult } from '../lib/researchService'
import '../index.css'

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
            <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4 animate-pulse">Loading diagnostic questions...</p>
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            </div>
        )
    }

    if (errorMsg || questions.length === 0) {
        return (
            <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
                <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
                    <p className="text-red-500 font-medium mb-4">{errorMsg || 'No questions found for this course.'}</p>
                    <button
                        className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                        onClick={handleSkip}
                    >
                        Skip Assessment
                    </button>
                </div>
            </div>
        )
    }

    if (showResults && results) {
        const phaseLabel = phase === 'pre' ? 'Pre-test' : phase === 'post' ? 'Post-test' : 'Retention Check'

        return (
            <div className="min-h-screen bg-[#fafafa]">
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-3xl mx-auto px-8 py-4">
                        <h1 className="text-lg font-semibold text-gray-900">{phaseLabel} Results</h1>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto px-8 py-12">
                    <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
                        <div className="text-center mb-8">
                            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${results.percentage >= 70 ? 'bg-emerald-100' :
                                results.percentage >= 40 ? 'bg-amber-100' : 'bg-red-100'
                                }`}>
                                <span className={`text-3xl font-bold ${results.percentage >= 70 ? 'text-emerald-600' :
                                    results.percentage >= 40 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                    {results.percentage}%
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">{results.level} Level</h2>
                            <p className="text-gray-600">
                                You answered {results.score} of {totalQuestions} questions correctly
                            </p>
                        </div>

                        {results.gaps.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Areas to Focus On
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {results.gaps.map((gap) => (
                                        <span key={gap} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm">
                                            {gap.charAt(0).toUpperCase() + gap.slice(1)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.masteredConcepts.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Strong Areas
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {results.masteredConcepts.map((concept) => (
                                        <span key={concept} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm">
                                            {concept.charAt(0).toUpperCase() + concept.slice(1)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <h3 className="font-medium text-blue-900 mb-1">
                                {phase === 'pre' ? 'Recommended Starting Point' : phase === 'post' ? 'Immediate Learning Signal' : 'Delayed Retention Signal'}
                            </h3>
                            <p className="text-blue-700 text-sm">
                                {phase === 'pre'
                                    ? `Based on your results, we recommend starting at Section ${results.recommendedStart.replace('/', '.')}.`
                                    : phase === 'post'
                                        ? `Your post-learning score is ${results.percentage}%. This is the immediate learning-effect checkpoint before the retention window.`
                                        : `This delayed probe estimates what remained stable after time away. Review the gaps below before your next practice block.`}
                            </p>
                        </div>

                        <button
                            onClick={handleStartLearning}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                        >
                            {phase === 'pre' ? 'Start Learning →' : phase === 'post' ? 'Return to Reading →' : 'Resume Review →'}
                        </button>
                    </div>

                    <div className="space-y-3 text-center text-gray-500 text-sm">
                        {phase === 'pre' && !evaluationStatus.byPhase.post && (
                            <button
                                onClick={() => navigate(`/diagnostic/${course}?phase=post`)}
                                className="text-indigo-600 hover:underline"
                            >
                                Take the post-test after the pathway
                            </button>
                        )}
                        {phase === 'post' && (
                            <p>A retention probe will be due 7 days after this attempt.</p>
                        )}
                        <p>
                            Want to try again?{' '}
                            <button
                                onClick={() => { setShowResults(false); setCurrentQuestion(0); setAnswers({}); }}
                                className="text-indigo-600 hover:underline"
                            >
                                Retake Assessment
                            </button>
                        </p>
                    </div>
                </main>
            </div>
        )
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
                <div className="text-gray-500 text-lg">Loading assessment...</div>
            </div>
        )
    }

    const currentQ = questions[currentQuestion]

    return (
        <div className="min-h-screen bg-[#fafafa]">
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">
                                {course.charAt(0).toUpperCase() + course.slice(1)} {phase === 'pre' ? 'Diagnostic' : phase === 'post' ? 'Post-test' : 'Retention Check'}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {phase === 'pre' ? 'Prerequisite Assessment' : phase === 'post' ? 'Immediate Learning Check' : 'Delayed Retention Probe'}
                            </p>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            Skip Assessment →
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-8 py-12">
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">
                            Question {currentQuestion + 1} of {totalQuestions}
                        </span>
                        <span className="text-sm text-gray-500">
                            {Math.round(((currentQuestion + 1) / totalQuestions) * 100)}% Complete
                        </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
                    <div className="mb-6">
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded mb-4">
                            {currentQ.concept.toUpperCase()}
                        </span>
                        <h2 className="text-xl font-medium text-gray-900">
                            {currentQ.stem}
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {currentQ.options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${answers[currentQuestion] === idx
                                    ? 'border-indigo-600 bg-indigo-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <span className={`font-medium ${answers[currentQuestion] === idx ? 'text-indigo-700' : 'text-gray-700'
                                    }`}>
                                    {String.fromCharCode(65 + idx)}. {option}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <button
                        onClick={handlePrevious}
                        disabled={currentQuestion === 0}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={answers[currentQuestion] === undefined}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {currentQuestion === totalQuestions - 1 ? 'See Results' : 'Next →'}
                    </button>
                </div>
            </main>
        </div>
    )
}
