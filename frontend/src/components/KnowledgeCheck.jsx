import { useState } from 'react';
import { generateAssessment, updateMastery } from '../lib/knowledgeService';

export default function KnowledgeCheck({ bioContext, engContext, sectionTitle }) {
    const [status, setStatus] = useState('idle'); // idle, loading, active, completed
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOptionId, setSelectedOptionId] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [results, setResults] = useState([]); // Array of { isCorrect, conceptId }

    // Start assessment generation
    const handleStart = async () => {
        setStatus('loading');
        try {
            const bioTrim = bioContext ? bioContext.substring(0, 1000) : "Biological mechanisms of adhesion and load-bearing";
            const engTrim = engContext ? engContext.substring(0, 1000) : "Engineering statics and equilibrium";
            const titleTrim = sectionTitle || "Statics 1.1: Equilibrium";

            const q = await generateAssessment(titleTrim, bioTrim, engTrim);
            if (q && q.length > 0) {
                setQuestions(q);
                setStatus('active');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
        }
    };

    const handleOptionClick = async (optionId) => {
        if (isAnswered) return;

        setSelectedOptionId(optionId);
        setIsAnswered(true);

        const currentQ = questions[currentQuestionIndex];
        const isCorrect = optionId === currentQ.correct_option_id;

        setResults([...results, { isCorrect, conceptId: currentQ.concept_id }]);

        // Send to Knowledge Tracing backend (fire and forget)
        updateMastery(currentQ.concept_id, isCorrect).catch(console.error);
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedOptionId(null);
            setIsAnswered(false);
        } else {
            setStatus('completed');
        }
    };

    // UI Renders
    if (status === 'idle') {
        return (
            <div className="mt-12 p-8 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                    <span className="text-3xl">🧠</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Knowledge Check</h3>
                <p className="text-slate-500 mb-6 max-w-md">
                    Test your understanding of the concepts covered in this section to help ALGET track your mastery.
                </p>
                <button
                    onClick={handleStart}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-200"
                >
                    <span>✨</span>
                    Generate Quiz
                </button>
            </div>
        );
    }

    if (status === 'loading') {
        return (
            <div className="mt-12 p-12 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col items-center justify-center text-center">
                <span className="text-4xl animate-spin mb-4">⚙️</span>
                <h3 className="text-lg font-medium text-slate-800 mb-1">Synthesizing Questions</h3>
                <p className="text-sm text-slate-500">ALGET is generating personalized questions based on this section...</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="mt-12 p-8 rounded-2xl bg-red-50 border border-red-200 text-center">
                <p className="text-red-600">Failed to generate assessment. Please try again later.</p>
                <button onClick={() => setStatus('idle')} className="mt-4 text-sm text-slate-500 hover:text-slate-800 underline">Retry</button>
            </div>
        );
    }

    if (status === 'completed') {
        const score = results.filter(r => r.isCorrect).length;
        return (
            <div className="mt-12 p-8 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>

                <h3 className="text-2xl font-bold text-slate-800 mb-2">Assessment Complete! 🎉</h3>
                <p className="text-slate-600 mb-6">You scored {score} out of {questions.length}</p>

                <div className="flex justify-center gap-2 mb-8">
                    {results.map((r, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full ${r.isCorrect ? 'bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                    ))}
                </div>

                <p className="text-sm text-slate-500">
                    Your concept mastery states have been successfully updated in the Knowledge Tracing model.
                </p>
            </div>
        );
    }

    // Active Status – Question Display
    const currentQ = questions[currentQuestionIndex];

    return (
        <div className="mt-12 p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-lg relative overflow-hidden">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 h-1 bg-slate-100 w-full">
                <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
                />
            </div>

            <div className="flex justify-between items-center mb-6 mt-2">
                <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-500 font-mono">
                    KC: {currentQ.concept_id}
                </span>
            </div>

            <h3 className="text-xl text-slate-800 font-medium mb-8 leading-relaxed">
                {currentQ.question}
            </h3>

            <div className="flex flex-col gap-3 mb-8">
                {currentQ.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    const isCorrect = opt.id === currentQ.correct_option_id;

                    let bgClass = "bg-white hover:bg-slate-50 border-slate-200";
                    let icon = null;

                    if (isAnswered) {
                        if (isCorrect) {
                            bgClass = "bg-emerald-50 border-emerald-300";
                            icon = <span className="ml-auto text-lg">✅</span>;
                        } else if (isSelected) {
                            bgClass = "bg-red-50 border-red-300";
                            icon = <span className="ml-auto text-lg">❌</span>;
                        } else {
                            bgClass = "bg-white border-slate-100 opacity-50";
                        }
                    } else if (isSelected) {
                        bgClass = "bg-indigo-50 border-indigo-300";
                    }

                    return (
                        <button
                            key={opt.id}
                            disabled={isAnswered}
                            onClick={() => handleOptionClick(opt.id)}
                            className={`flex items-center text-left p-4 rounded-xl border transition-all duration-200 ${bgClass}`}
                        >
                            <span className="shrink-0 w-6 font-bold text-slate-400 mr-2">{opt.id}.</span>
                            <span className="text-slate-700">{opt.text}</span>
                            {icon}
                        </button>
                    )
                })}
            </div>

            {/* Explanation Area */}
            {isAnswered && (
                <div className="animate-fade-in mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        {selectedOptionId === currentQ.correct_option_id ? (
                            <span className="text-emerald-600">✅ Correct!</span>
                        ) : (
                            <span className="text-red-600">❌ Incorrect.</span>
                        )}
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        {currentQ.explanation}
                    </p>
                </div>
            )}

            {/* Next Button */}
            {isAnswered && (
                <div className="flex justify-end animate-fade-in">
                    <button
                        onClick={handleNextQuestion}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-md"
                    >
                        {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Assessment'}
                        <span>→</span>
                    </button>
                </div>
            )}
        </div>
    );
}
