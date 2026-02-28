import { useState, useEffect, useRef } from 'react'
import API_BASE from '../lib/apiConfig'
import { fuseTelemetry } from '../lib/knowledgeService'

const STUCK_RULES = {
    IDLE_TIMEOUT_MS: 90000,
    CONSECUTIVE_WRONG: 2,
    HINT_CLICK_COUNT: 2
}

export default function PracticeBlock({ practice, sectionId, onStuckEvent }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState({})
    const [gradeResults, setGradeResults] = useState({})
    const [loading, setLoading] = useState(false)
    const [consecutiveWrong, setConsecutiveWrong] = useState(0)
    const [hintCount, setHintCount] = useState(0)
    const [showHint, setShowHint] = useState(false)

    // Timer for idle detection
    const idleTimerRef = useRef(null)
    const lastInputRef = useRef(Date.now())

    const problems = practice?.problems || []
    const currentProblem = problems[currentIndex]

    // Reset idle timer on input
    useEffect(() => {
        const resetIdleTimer = () => {
            lastInputRef.current = Date.now()
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

            idleTimerRef.current = setTimeout(() => {
                // 90 seconds idle - trigger stuck event
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

    // Handle answer submission
    const handleSubmit = async (problemId) => {
        const answer = answers[problemId]
        if (!answer?.value) return

        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/grade/${problemId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answer: answer.value,
                    unit: answer.unit || ''
                })
            })
            const result = await res.json()

            setGradeResults(prev => ({ ...prev, [problemId]: result }))

            // Track consecutive wrong answers
            if (!result.is_correct) {
                const newCount = consecutiveWrong + 1
                setConsecutiveWrong(newCount)

                // Check if stuck (2 consecutive wrong)
                if (newCount >= STUCK_RULES.CONSECUTIVE_WRONG) {
                    onStuckEvent?.({
                        problemId,
                        reason: `${newCount} consecutive incorrect answers`
                    })
                    setConsecutiveWrong(0)
                }

                // Check unit errors
                if (result.unit_error) {
                    onStuckEvent?.({
                        problemId,
                        reason: 'Unit conversion error detected'
                    })
                }
            } else {
                setConsecutiveWrong(0)
            }
        } catch (err) {
            console.error('Grading error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Handle hint request
    const handleHintRequest = () => {
        const newCount = hintCount + 1
        setHintCount(newCount)
        setShowHint(true)

        // Dispatch an event to open ChatWidget for Socratic hinting
        const event = new CustomEvent('open-chat', {
            detail: { message: `I'm struggling with this problem: "${currentProblem?.statement || currentProblem?.stem}". Can you give me a specific Socratic hint to guide me without giving away the answer?` }
        });
        window.dispatchEvent(event);

        // Record Soft Evidence: Hint Request (Increases slip/transit)
        if (currentProblem && currentProblem.concept_id) {
            fuseTelemetry(currentProblem.concept_id, 'hint_request', 1.0).catch(console.error);
        }

        // Check if stuck (2 consecutive hints)
        if (newCount >= STUCK_RULES.HINT_CLICK_COUNT) {
            onStuckEvent?.({
                problemId: currentProblem?.id,
                reason: 'Requested multiple hints'
            })
            setHintCount(0)
        }
    }

    // Update answer value
    const updateAnswer = (problemId, field, value) => {
        setAnswers(prev => ({
            ...prev,
            [problemId]: {
                ...prev[problemId],
                [field]: value
            }
        }))
    }

    if (problems.length === 0) {
        return (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">✏️</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Practice Problems</h3>
                <p className="text-gray-500">No practice problems available for this section yet.</p>
            </div>
        )
    }

    const totalAnswered = Object.keys(gradeResults).length
    const correctCount = Object.values(gradeResults).filter(r => r.is_correct).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl">✏️</span>
                    Practice
                </h2>
                <div className="text-sm text-gray-500">
                    {totalAnswered}/{problems.length} completed • {correctCount} correct
                </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                    className="bg-linear-to-r from-[#9E1B32] to-[#7A1527] h-full transition-all duration-300"
                    style={{ width: `${(totalAnswered / problems.length) * 100}%` }}
                />
            </div>

            {/* Current Problem */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500">
                        Problem {currentIndex + 1} of {problems.length}
                    </span>
                    {currentProblem?.difficulty && (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${currentProblem.difficulty === 'easy'
                            ? 'bg-emerald-100 text-emerald-700'
                            : currentProblem.difficulty === 'medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                            {currentProblem.difficulty}
                        </span>
                    )}
                </div>


                {/* Problem Statement */}
                <p className="text-gray-800 font-medium mb-6">{currentProblem?.stem || currentProblem?.statement}</p>

                {/* Given Values */}
                {currentProblem?.givens && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-gray-500 mb-2">Given:</h4>
                        <ul className="space-y-1">
                            {Object.entries(currentProblem.givens).map(([key, val]) => (
                                <li key={key} className="text-sm text-gray-700">
                                    <code className="bg-gray-200 px-1 rounded">{key}</code> = {val}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Answer Input */}
                {!gradeResults[currentProblem?.id] ? (
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Enter your answer"
                                value={answers[currentProblem?.id]?.value || ''}
                                onChange={(e) => updateAnswer(currentProblem?.id, 'value', e.target.value)}
                                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#9E1B32] focus:outline-none"
                            />
                            {currentProblem?.requires_unit && (
                                <input
                                    type="text"
                                    placeholder="Unit"
                                    value={answers[currentProblem?.id]?.unit || ''}
                                    onChange={(e) => updateAnswer(currentProblem?.id, 'unit', e.target.value)}
                                    className="w-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#9E1B32] focus:outline-none"
                                />
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleSubmit(currentProblem?.id)}
                                disabled={loading || !answers[currentProblem?.id]?.value}
                                className="flex-1 py-3 bg-[#9E1B32] text-white rounded-xl font-medium hover:bg-[#7A1527] transition-colors disabled:opacity-50"
                            >
                                {loading ? '⏳ Checking...' : '✓ Submit Answer'}
                            </button>

                            <button
                                onClick={handleHintRequest}
                                className="px-4 py-3 border-2 border-amber-300 text-amber-600 rounded-xl font-medium hover:bg-amber-50 transition-colors"
                            >
                                💡 Hint
                            </button>
                        </div>

                        {/* Hint Display */}
                        {showHint && currentProblem?.hint && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    <strong>Hint:</strong> {currentProblem.hint}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Result Display */
                    <div className={`rounded-xl p-4 ${gradeResults[currentProblem?.id].is_correct
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-red-50 border border-red-200'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">
                                {gradeResults[currentProblem?.id].is_correct ? '✓' : '✗'}
                            </span>
                            <span className={`font-bold ${gradeResults[currentProblem?.id].is_correct
                                ? 'text-emerald-700'
                                : 'text-red-700'
                                }`}>
                                {gradeResults[currentProblem?.id].is_correct ? 'Correct!' : 'Incorrect'}
                            </span>
                        </div>

                        {gradeResults[currentProblem?.id].explanation && (
                            <p className="text-sm text-gray-600">
                                {gradeResults[currentProblem?.id].explanation}
                            </p>
                        )}

                        {!gradeResults[currentProblem?.id].is_correct && (
                            <p className="text-sm text-gray-500 mt-2">
                                Expected: <code className="bg-gray-200 px-1 rounded">
                                    {gradeResults[currentProblem?.id].expected}
                                </code>
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <button
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                    ← Previous
                </button>
                <button
                    onClick={() => setCurrentIndex(Math.min(problems.length - 1, currentIndex + 1))}
                    disabled={currentIndex === problems.length - 1}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                    Next →
                </button>
            </div>
        </div>
    )
}
