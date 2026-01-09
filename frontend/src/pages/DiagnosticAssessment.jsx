import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../index.css'

// ============================================================================
// DIAGNOSTIC ASSESSMENT PAGE
// ============================================================================
export default function DiagnosticAssessment() {
    const { course } = useParams()
    const navigate = useNavigate()

    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState({})
    const [showResults, setShowResults] = useState(false)
    const [results, setResults] = useState(null)

    // Question banks for each course
    const questionBanks = {
        statics: [
            {
                id: 1,
                concept: 'vectors',
                stem: 'What is the x-component of a 100 N force acting at 60° from the horizontal?',
                options: ['50 N', '86.6 N', '100 N', '70.7 N'],
                correct: 0,
                prereqFor: ['01/01', '01/02']
            },
            {
                id: 2,
                concept: 'equilibrium',
                stem: 'For a particle in equilibrium, what is the sum of all forces?',
                options: ['Maximum force', 'Minimum force', 'Zero', 'Cannot be determined'],
                correct: 2,
                prereqFor: ['01/01']
            },
            {
                id: 3,
                concept: 'trigonometry',
                stem: 'In a right triangle with angle θ = 30°, if the hypotenuse is 10, what is the opposite side?',
                options: ['5', '8.66', '10', '7.07'],
                correct: 0,
                prereqFor: ['01/01', '02/01']
            },
            {
                id: 4,
                concept: 'moments',
                stem: 'A moment is the product of:',
                options: ['Force and mass', 'Force and perpendicular distance', 'Mass and acceleration', 'Force and velocity'],
                correct: 1,
                prereqFor: ['02/01', '02/02']
            },
            {
                id: 5,
                concept: 'fbd',
                stem: 'A free body diagram should include:',
                options: ['Only external forces', 'Only internal forces', 'Both internal and external forces', 'No forces'],
                correct: 0,
                prereqFor: ['01/02', '01/03']
            },
            {
                id: 6,
                concept: 'friction',
                stem: 'Static friction force is always:',
                options: ['Equal to μN', 'Greater than μN', 'Less than or equal to μN', 'Zero'],
                correct: 2,
                prereqFor: ['01/04']
            },
            {
                id: 7,
                concept: 'units',
                stem: 'What are the SI units for moment (torque)?',
                options: ['N', 'N·m', 'kg·m/s²', 'J/s'],
                correct: 1,
                prereqFor: ['02/01', '02/02']
            },
            {
                id: 8,
                concept: 'trusses',
                stem: 'In a simple truss, members are assumed to be:',
                options: ['Rigid beams', 'Two-force members', 'Flexible cables', 'Compression only'],
                correct: 1,
                prereqFor: ['03/01', '03/02']
            }
        ],
        dynamics: [
            {
                id: 1,
                concept: 'kinematics',
                stem: 'If velocity is constant, what is the acceleration?',
                options: ['Equal to velocity', 'Maximum', 'Zero', 'Cannot be determined'],
                correct: 2,
                prereqFor: ['01/01']
            },
            {
                id: 2,
                concept: 'calculus',
                stem: 'Acceleration is the derivative of:',
                options: ['Position', 'Velocity', 'Force', 'Energy'],
                correct: 1,
                prereqFor: ['01/01', '01/02']
            },
            {
                id: 3,
                concept: 'vectors',
                stem: 'For circular motion, centripetal acceleration points:',
                options: ['Tangent to path', 'Toward center', 'Away from center', 'Along velocity'],
                correct: 1,
                prereqFor: ['01/02']
            },
            {
                id: 4,
                concept: 'newton',
                stem: 'Newton\'s Second Law states that F equals:',
                options: ['mv', 'ma', 'mv²', 'm/a'],
                correct: 1,
                prereqFor: ['02/01']
            },
            {
                id: 5,
                concept: 'energy',
                stem: 'Kinetic energy is proportional to:',
                options: ['v', 'v²', 'v³', '1/v'],
                correct: 1,
                prereqFor: ['02/02']
            },
            {
                id: 6,
                concept: 'momentum',
                stem: 'Momentum is conserved when:',
                options: ['Energy is conserved', 'No external net force', 'Friction is present', 'Always'],
                correct: 1,
                prereqFor: ['02/03']
            },
            {
                id: 7,
                concept: 'angular',
                stem: 'Angular velocity ω has units of:',
                options: ['m/s', 'rad/s', 'm/s²', 'rad/s²'],
                correct: 1,
                prereqFor: ['03/01']
            },
            {
                id: 8,
                concept: 'inertia',
                stem: 'Moment of inertia depends on:',
                options: ['Mass only', 'Distance from axis only', 'Both mass and distance from axis', 'Angular velocity'],
                correct: 2,
                prereqFor: ['03/02', '03/03']
            }
        ]
    }

    const questions = questionBanks[course] || questionBanks.statics
    const totalQuestions = questions.length

    const handleAnswer = (optionIndex) => {
        setAnswers(prev => ({ ...prev, [currentQuestion]: optionIndex }))
    }

    const handleNext = () => {
        if (currentQuestion < totalQuestions - 1) {
            setCurrentQuestion(prev => prev + 1)
        } else {
            analyzeResults()
        }
    }

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1)
        }
    }

    const handleSkip = () => {
        // Skip diagnostic, start from basic (01/01)
        navigate(`/book/${course}/01/01`)
    }

    const analyzeResults = () => {
        const gaps = []
        const masteredConcepts = []
        let score = 0

        questions.forEach((q, idx) => {
            if (answers[idx] === q.correct) {
                score++
                masteredConcepts.push(q.concept)
            } else {
                gaps.push({
                    concept: q.concept,
                    sections: q.prereqFor
                })
            }
        })

        // Determine recommended starting point
        const gapSections = [...new Set(gaps.flatMap(g => g.sections))]
        const recommendedStart = gapSections.length > 0
            ? gapSections.sort()[0]
            : '01/01'

        const analysisResults = {
            score,
            percentage: Math.round((score / totalQuestions) * 100),
            gaps: gaps.map(g => g.concept),
            masteredConcepts,
            recommendedStart,
            recommendedSections: gapSections,
            level: score >= 7 ? 'Advanced' : score >= 4 ? 'Intermediate' : 'Foundational'
        }

        setResults(analysisResults)
        setShowResults(true)
    }

    const handleStartLearning = () => {
        const [chapter, section] = results.recommendedStart.split('/')
        navigate(`/book/${course}/${chapter}/${section}`, {
            state: { diagnosticResults: results }
        })
    }

    // Results Screen
    if (showResults && results) {
        return (
            <div className="min-h-screen bg-[#fafafa]">
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-3xl mx-auto px-8 py-4">
                        <h1 className="text-lg font-semibold text-gray-900">Diagnostic Results</h1>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto px-8 py-12">
                    {/* Score Card */}
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {results.level} Level
                            </h2>
                            <p className="text-gray-600">
                                You answered {results.score} of {totalQuestions} questions correctly
                            </p>
                        </div>

                        {/* Gaps Identified */}
                        {results.gaps.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Areas to Focus On
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {results.gaps.map(gap => (
                                        <span key={gap} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm">
                                            {gap.charAt(0).toUpperCase() + gap.slice(1)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mastered Concepts */}
                        {results.masteredConcepts.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Strong Areas
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {results.masteredConcepts.map(concept => (
                                        <span key={concept} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm">
                                            {concept.charAt(0).toUpperCase() + concept.slice(1)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendation */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <h3 className="font-medium text-blue-900 mb-1">Recommended Starting Point</h3>
                            <p className="text-blue-700 text-sm">
                                Based on your results, we recommend starting at Section {results.recommendedStart.replace('/', '.')}
                            </p>
                        </div>

                        {/* CTA */}
                        <button
                            onClick={handleStartLearning}
                            className="w-full py-3 bg-[#9E1B32] text-white rounded-lg font-medium hover:bg-[#7A1527] transition-colors"
                        >
                            Start Learning →
                        </button>
                    </div>

                    {/* Retake Option */}
                    <p className="text-center text-gray-500 text-sm">
                        Want to try again?{' '}
                        <button
                            onClick={() => { setShowResults(false); setCurrentQuestion(0); setAnswers({}); }}
                            className="text-[#9E1B32] hover:underline"
                        >
                            Retake Assessment
                        </button>
                    </p>
                </main>
            </div>
        )
    }

    // Assessment Screen
    const currentQ = questions[currentQuestion]

    return (
        <div className="min-h-screen bg-[#fafafa]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">
                                {course.charAt(0).toUpperCase() + course.slice(1)} Diagnostic
                            </h1>
                            <p className="text-sm text-gray-500">Prerequisite Assessment</p>
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
                {/* Progress */}
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
                            className="h-full bg-[#9E1B32] transition-all duration-300"
                            style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
                    <div className="mb-6">
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded mb-4">
                            {currentQ.concept.toUpperCase()}
                        </span>
                        <h2 className="text-xl font-medium text-gray-900">
                            {currentQ.stem}
                        </h2>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                        {currentQ.options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${answers[currentQuestion] === idx
                                        ? 'border-[#9E1B32] bg-[#9E1B32]/5'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <span className={`font-medium ${answers[currentQuestion] === idx ? 'text-[#9E1B32]' : 'text-gray-700'
                                    }`}>
                                    {String.fromCharCode(65 + idx)}. {option}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Navigation */}
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
                        className="px-6 py-2 bg-[#9E1B32] text-white rounded-lg font-medium hover:bg-[#7A1527] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {currentQuestion === totalQuestions - 1 ? 'See Results' : 'Next →'}
                    </button>
                </div>
            </main>
        </div>
    )
}
