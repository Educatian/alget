import { useState, useEffect } from 'react';
import { generateAssessment, updateMastery } from '../lib/knowledgeService';
import { CheckCircle, XCircle, BrainCircuit, Loader2, Sparkles, ChevronRight } from 'lucide-react';

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
            // Trim contexts to avoid massive payloads, let the agent rely mostly on the keywords/title
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
        if (isAnswered) return; // Prevent multiple clicks

        setSelectedOptionId(optionId);
        setIsAnswered(true);

        const currentQ = questions[currentQuestionIndex];
        const isCorrect = optionId === currentQ.correct_option_id;

        // Save result locally for UI
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
            <div className="mt-12 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                    <BrainCircuit className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Knowledge Check</h3>
                <p className="text-gray-400 mb-6 max-w-md">
                    Test your understanding of the concepts covered in this section to help ALGET track your mastery.
                </p>
                <button
                    onClick={handleStart}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                >
                    <Sparkles className="w-4 h-4" />
                    Generate Quiz
                </button>
            </div>
        );
    }

    if (status === 'loading') {
        return (
            <div className="mt-12 p-12 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
                <h3 className="text-lg font-medium text-white mb-1">Synthesizing Questions</h3>
                <p className="text-sm text-gray-400">ALGET is generating personalized questions based on this section...</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="mt-12 p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-red-400">Failed to generate assessment. Please try again later.</p>
                <button onClick={() => setStatus('idle')} className="mt-4 text-sm text-gray-400 hover:text-white underline">Retry</button>
            </div>
        );
    }

    if (status === 'completed') {
        const score = results.filter(r => r.isCorrect).length;
        return (
            <div className="mt-12 p-8 rounded-2xl bg-linear-to-b from-green-500/10 to-transparent border border-green-500/20 text-center backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-green-500 to-transparent opacity-50"></div>

                <h3 className="text-2xl font-bold text-white mb-2">Assessment Complete!</h3>
                <p className="text-gray-300 mb-6">You scored {score} out of {questions.length}</p>

                <div className="flex justify-center gap-2 mb-8">
                    {results.map((r, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full ${r.isCorrect ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                    ))}
                </div>

                <p className="text-sm text-gray-400">
                    Your concept mastery states have been successfully updated in the Knowledge Tracing model.
                </p>
            </div>
        );
    }

    // Active Status Menu
    const currentQ = questions[currentQuestionIndex];

    return (
        <div className="mt-12 p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl relative overflow-hidden">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 h-1 bg-white/10 w-full">
                <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
                />
            </div>

            <div className="flex justify-between items-center mb-6 mt-2">
                <span className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 font-mono">
                    KC: {currentQ.concept_id}
                </span>
            </div>

            <h3 className="text-xl text-white font-medium mb-8 leading-relaxed">
                {currentQ.question}
            </h3>

            <div className="flex flex-col gap-3 mb-8">
                {currentQ.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    const isCorrect = opt.id === currentQ.correct_option_id;

                    let bgClass = "bg-white/5 hover:bg-white/10 border-white/10";
                    let icon = null;

                    if (isAnswered) {
                        if (isCorrect) {
                            bgClass = "bg-green-500/20 border-green-500/50";
                            icon = <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />;
                        } else if (isSelected) {
                            bgClass = "bg-red-500/20 border-red-500/50";
                            icon = <XCircle className="w-5 h-5 text-red-400 ml-auto" />;
                        } else {
                            bgClass = "bg-white/5 border-white/5 opacity-50";
                        }
                    } else if (isSelected) {
                        bgClass = "bg-blue-500/20 border-blue-500/50";
                    }

                    return (
                        <button
                            key={opt.id}
                            disabled={isAnswered}
                            onClick={() => handleOptionClick(opt.id)}
                            className={`flex items-center text-left p-4 rounded-xl border transition-all duration-200 ${bgClass}`}
                        >
                            <span className="shrink-0 w-6 font-bold text-gray-400 mr-2">{opt.id}.</span>
                            <span className="text-gray-200">{opt.text}</span>
                            {icon}
                        </button>
                    )
                })}
            </div>

            {/* Explanation Area */}
            {isAnswered && (
                <div className="animate-fade-in mb-6 p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        {selectedOptionId === currentQ.correct_option_id ? (
                            <><span className="text-green-400">Correct!</span></>
                        ) : (
                            <><span className="text-red-400">Incorrect.</span></>
                        )}
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        {currentQ.explanation}
                    </p>
                </div>
            )}

            {/* Next Button */}
            {isAnswered && (
                <div className="flex justify-end animate-fade-in">
                    <button
                        onClick={handleNextQuestion}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
                    >
                        {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Assessment'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
