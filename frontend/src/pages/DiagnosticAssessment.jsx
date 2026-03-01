import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
    const [questions, setQuestions] = useState([])

    // Question banks for each course
    const questionBanks = {
        statics: [
            { id: 1, concept: 'vectors', stem: 'What is the x-component of a 100 N force acting at 60° from the horizontal?', options: ['50 N', '86.6 N', '100 N', '70.7 N'], correct: 0, prereqFor: ['01/01', '01/02'] },
            { id: 2, concept: 'equilibrium', stem: 'For a particle in equilibrium, what is the sum of all forces?', options: ['Maximum force', 'Minimum force', 'Zero', 'Cannot be determined'], correct: 2, prereqFor: ['01/01'] },
            { id: 3, concept: 'trigonometry', stem: 'In a right triangle with angle θ = 30°, if the hypotenuse is 10, what is the opposite side?', options: ['5', '8.66', '10', '7.07'], correct: 0, prereqFor: ['01/01', '02/01'] },
            { id: 4, concept: 'moments', stem: 'A moment is the product of:', options: ['Force and mass', 'Force and perpendicular distance', 'Mass and acceleration', 'Force and velocity'], correct: 1, prereqFor: ['02/01', '02/02'] },
            { id: 5, concept: 'fbd', stem: 'A free body diagram should include:', options: ['Only external forces', 'Only internal forces', 'Both internal and external forces', 'No forces'], correct: 0, prereqFor: ['01/02', '01/03'] },
            { id: 6, concept: 'friction', stem: 'Static friction force is always:', options: ['Equal to μN', 'Greater than μN', 'Less than or equal to μN', 'Zero'], correct: 2, prereqFor: ['01/04'] },
            { id: 7, concept: 'units', stem: 'What are the SI units for moment (torque)?', options: ['N', 'N·m', 'kg·m/s²', 'J/s'], correct: 1, prereqFor: ['02/01', '02/02'] },
            { id: 8, concept: 'trusses', stem: 'In a simple truss, members are assumed to be:', options: ['Rigid beams', 'Two-force members', 'Flexible cables', 'Compression only'], correct: 1, prereqFor: ['03/01', '03/02'] }
        ],
        dynamics: [
            { id: 1, concept: 'kinematics', stem: 'If velocity is constant, what is the acceleration?', options: ['Equal to velocity', 'Maximum', 'Zero', 'Cannot be determined'], correct: 2, prereqFor: ['01/01'] }
        ],
        'inst-design': [
            { id: 1, concept: 'ct_1_2', stem: 'Which learning theory focuses primarily on observable behaviors rather than internal mental states?', options: ['Cognitivism', 'Constructivism', 'Behaviorism', 'Connectivism'], correct: 2, prereqFor: ['01/03'] },
            { id: 2, concept: 'ct_2_1', stem: 'What does the acronym ADDIE stand for?', options: ['Analyze, Design, Develop, Implement, Evaluate', 'Assess, Draft, Deploy, Interact, Examine', 'Acquire, Discuss, Discover, Internalize, Expand', 'Align, Deliver, Design, Innovate, Educate'], correct: 0, prereqFor: ['02/01'] },
            { id: 3, concept: 'ct_1_3', stem: 'Extraneous cognitive load is caused by:', options: ['The inherent difficulty of the material', 'Poor instructional design and presentation', "The learner's prior knowledge", 'Schema construction'], correct: 1, prereqFor: ['01/02'] },
            { id: 4, concept: 'ct_1_2', stem: 'A key goal of instruction according to cognitivism is to help learners build and refine:', options: ['Stimulus-response associations', 'Behavioral conditioning', 'Mental schemas', 'Rote memorization pathways'], correct: 2, prereqFor: ['01/02'] },
            { id: 5, concept: 'ct_1_2', stem: 'In a constructivist classroom, the teacher acts primarily as a:', options: ['Transmitter of knowledge', 'Strict disciplinarian', 'Passive observer', 'Facilitator or guide'], correct: 3, prereqFor: ['01/01'] },
            { id: 6, concept: 'ct_2_2', stem: 'Which evaluation occurs DURING the learning process to improve instruction?', options: ['Summative', 'Formative', 'Diagnostic', 'Confirmative'], correct: 1, prereqFor: ['02/01'] },
            { id: 7, concept: 'ct_2_2', stem: 'A well-designed rubric primarily helps to:', options: ['Confuse students with complex grading scales', 'Provide objective, transparent assessment criteria', 'Reduce the amount of grading work', 'Automatically generate test questions'], correct: 1, prereqFor: ['02/02'] },
            { id: 8, concept: 'ct_2_3', stem: 'Kirkpatrick\'s Four Levels of Evaluation are Reaction, Learning, Behavior, and:', options: ['Results', 'Return on Investment', 'Retention', 'Recall'], correct: 0, prereqFor: ['02/03'] },
            { id: 9, concept: 'ct_1_1', stem: 'Which scenario best represents an application of situated learning?', options: ['Memorizing state capitals', 'Taking a multiple-choice test', 'Learning math by running a mock store', 'Reading a textbook chapter linearly'], correct: 2, prereqFor: ['01/01'] },
            { id: 10, concept: 'ct_1_3', stem: 'According to Cognitive Load Theory, intrinsic load refers to:', options: ['The way information is presented', 'The natural complexity of the information', 'The learner\'s motivation level', 'The background noise in the classroom'], correct: 1, prereqFor: ['01/02'] },
            { id: 11, concept: 'ct_2_1', stem: 'A Needs Analysis in the ADDIE model aims to answer which question?', options: ['What color scheme should the modules be?', 'Who are the learners and what do they need to know?', 'How much will the development cost?', 'Where will the course be hosted?'], correct: 1, prereqFor: ['02/01'] },
            { id: 12, concept: 'ct_2_2', stem: 'Backward Design (Understanding by Design) starts with identifying:', options: ['Learning activities', 'Assessment methods', 'Desired results (learning goals)', 'Textbook chapters'], correct: 2, prereqFor: ['02/02'] },
            { id: 13, concept: 'ct_1_2', stem: 'Vygotsky\'s Zone of Proximal Development (ZPD) relies heavily on the concept of:', options: ['Punishment', 'Scaffolding', 'Classical conditioning', 'Rote learning'], correct: 1, prereqFor: ['01/01'] },
            { id: 14, concept: 'ct_1_1', stem: 'Bloom\'s Taxonomy is primarily used for:', options: ['Organizing classrooms logically', 'Classifying educational learning objectives', 'Developing grading rubrics automatically', 'Scheduling instructional time'], correct: 1, prereqFor: ['01/01'] },
            { id: 15, concept: 'ct_2_3', stem: 'A summative assessment is typically given:', options: ['Before instruction begins', 'During instruction to adjust pacing', 'At the end of an instructional unit', 'Only when a student fails a formative test'], correct: 2, prereqFor: ['02/01'] }
        ],
        'bio-inspired': [
            { id: 1, concept: 'cellular_solids', stem: 'Which of the following biological structures is an example of an open-cell porous solid used to maximize structural efficiency?', options: ['Shark continuous dermal skin', 'Turtle rigid shell', 'Cancellous (spongy) bone', 'Gecko foot spatulae'], correct: 2, prereqFor: ['01/01'] },
            { id: 2, concept: 'hierarchical_structures', stem: 'What is the primary mechanical advantage of combining stiff mineral platelets within a soft protein matrix (like in nacre)?', options: ['It decreases the overall weight to zero.', 'It provides extreme stiffness and high fracture toughness.', 'It creates completely transparent layers.', 'It prevents heat transfer completely.'], correct: 1, prereqFor: ['01/02'] },
            { id: 3, concept: 'directional_adhesion', stem: 'Geckos cling to sheer surfaces primarily through:', options: ['Sticky liquid mucous secretion', 'Microscopic suction cups', 'Van der Waals forces between billions of setae and the surface', 'Electromagnetic charging of the glass'], correct: 2, prereqFor: ['01/03'] },
            { id: 4, concept: 'fluid_dynamics', stem: 'Riblets on shark skin reduce drag by:', options: ['Coating the skin in a frictionless layer of oil', 'Physically confining and lifting turbulent vortices away from valleys', 'Preventing any water from touching the shark', 'Increasing laminar flow perfectly across all curves'], correct: 1, prereqFor: ['02/01'] },
            { id: 5, concept: 'aeroacoustics', stem: 'Trailing edge serrations on an owl wing suppress flight noise by:', options: ['Slowing down the bird dramatically', 'Absorbing sound waves like a sponge', 'Breaking large coherent vortices into smaller, high-frequency micro-turbulences', 'Reflecting sound waves back upwards'], correct: 2, prereqFor: ['03/01'] }
        ]
    }

    useEffect(() => {
        // Load and shuffle questions for the current course (pull 5 random questions)
        const allQuestions = questionBanks[course] || questionBanks['statics']
        const shuffled = [...allQuestions].sort(() => 0.5 - Math.random())
        setQuestions(shuffled.slice(0, 5))
    }, [course])

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

    const analyzeResults = async () => {
        const gaps = []
        const masteredConcepts = []
        let score = 0

        // Tracking concept mastery for db update
        const conceptUpdates = {}

        questions.forEach((q, idx) => {
            const isCorrect = answers[idx] === q.correct
            if (isCorrect) {
                score++
                masteredConcepts.push(q.concept)
                // Boost p_known heavily if they got it right in a diagnostic
                conceptUpdates[q.concept] = Math.min((conceptUpdates[q.concept] || 0.5) + 0.4, 0.95)
            } else {
                gaps.push({
                    concept: q.concept,
                    sections: q.prereqFor
                })
                // Lower p_known 
                conceptUpdates[q.concept] = Math.max((conceptUpdates[q.concept] || 0.5) - 0.3, 0.1)
            }
        })

        // Attempt to sync with Supabase Knowledge Graph stats
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            const userId = session.user.id;

            const recordsToUpsert = Object.entries(conceptUpdates).map(([conceptId, p_known]) => {
                return {
                    user_id: userId,
                    concept_id: conceptId,
                    p_known: p_known
                };
            });

            if (recordsToUpsert.length > 0) {
                const { error } = await supabase
                    .from('mastery')
                    .upsert(recordsToUpsert, { onConflict: 'user_id, concept_id' });

                if (error) {
                    console.error("Failed to update mastery from diagnostic. Supabase might need 'concepts' table updated with the new bio-inspired keys: ", error);
                    // Do not block the user from proceeding if the database insert fails
                }
            }
        }

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
            level: score >= 4 ? 'Advanced' : score >= 2 ? 'Intermediate' : 'Foundational' // adjust thresholds for 5 Qs
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
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Start Learning →
                        </button>
                    </div>

                    {/* Retake Option */}
                    <p className="text-center text-gray-500 text-sm">
                        Want to try again?{' '}
                        <button
                            onClick={() => { setShowResults(false); setCurrentQuestion(0); setAnswers({}); }}
                            className="text-indigo-600 hover:underline"
                        >
                            Retake Assessment
                        </button>
                    </p>
                </main>
            </div>
        )
    }

    // Loading guard - questions are populated async via useEffect
    if (questions.length === 0) {
        return (
            <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
                <div className="text-gray-500 text-lg">Loading assessment...</div>
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
                            className="h-full bg-indigo-600 transition-all duration-300"
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
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {currentQuestion === totalQuestions - 1 ? 'See Results' : 'Next →'}
                    </button>
                </div>
            </main>
        </div>
    )
}
