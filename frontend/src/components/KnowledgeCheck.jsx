import { useState } from 'react';
import { generateAssessment, updateMastery, gradeSummary } from '../lib/knowledgeService';

export default function KnowledgeCheck({ bioContext, engContext, sectionTitle, learningObjectives, conceptIds }) {
    const [status, setStatus] = useState('idle'); // idle, loading, active, completed
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOptionId, setSelectedOptionId] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [results, setResults] = useState([]); // Array of { isCorrect, conceptId }

    const [summaryText, setSummaryText] = useState('');
    const [summaryFeedback, setSummaryFeedback] = useState(null);
    const [isGrading, setIsGrading] = useState(false);

    // Start assessment generation
    const handleStart = async () => {
        setStatus('loading');
        try {
            const bioTrim = bioContext ? bioContext.substring(0, 1000) : "Biological mechanisms of adhesion and load-bearing";
            const engTrim = engContext ? engContext.substring(0, 1000) : "Engineering statics and equilibrium";
            const titleTrim = sectionTitle || "Statics 1.1: Equilibrium";

            const q = await generateAssessment(titleTrim, bioTrim, engTrim, learningObjectives, conceptIds);
            if (q && (q.mcq_questions?.length > 0 || q.summary_question)) {
                const combined = [];
                if (q.mcq_questions) {
                    combined.push(...q.mcq_questions.map(mcq => ({ ...mcq, type: 'mcq' })));
                }
                if (q.summary_question) {
                    combined.push({ ...q.summary_question, type: 'summary' });
                }
                setQuestions(combined);
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

        setResults([...results, { isCorrect, conceptId: currentQ.concept_id, type: 'mcq' }]);

        setResults([...results, { isCorrect, conceptId: currentQ.concept_id, type: 'mcq' }]);

        // Send to Knowledge Tracing backend (q_matrix format)
        updateMastery({ [currentQ.concept_id]: 1.0 }, isCorrect).catch(console.error);
    };

    const handleSummarySubmit = async () => {
        if (!summaryText.trim()) return;
        setIsGrading(true);
        try {
            const data = await gradeSummary(
                questions[currentQuestionIndex].question,
                summaryText,
                questions[currentQuestionIndex].rubric
            );

            setSummaryFeedback(data);
            setIsAnswered(true);
            setResults([...results, { isCorrect: data.is_passing, conceptId: questions[currentQuestionIndex].concept_id, type: 'summary' }]);

            // Send sub_scores as Q-Matrix if available, otherwise fallback to primary concept
            if (data.sub_scores && Object.keys(data.sub_scores).length > 0) {
                updateMastery(data.sub_scores, data.is_passing).catch(console.error);
            } else {
                updateMastery({ [questions[currentQuestionIndex].concept_id]: 1.0 }, data.is_passing).catch(console.error);
            }

        } catch (err) {
            console.error(err);
            setSummaryFeedback({
                content_score: 0.5,
                wording_score: 0.5,
                feedback: "Failed to grade. Please try again or refine your specific mechanisms.",
                is_passing: false
            });
            setIsAnswered(true);
            setResults([...results, { isCorrect: false, conceptId: questions[currentQuestionIndex].concept_id, type: 'summary' }]);
        } finally {
            setIsGrading(false);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedOptionId(null);
            setIsAnswered(false);
            setSummaryText('');
            setSummaryFeedback(null);
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
                    Question {currentQuestionIndex + 1} of {questions.length} ({currentQ.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'})
                </span>
                <span className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-500 font-mono">
                    KC: {currentQ.concept_id}
                </span>
            </div>

            <h3 className="text-xl text-slate-800 font-medium mb-8 leading-relaxed">
                {currentQ.question}
            </h3>

            {currentQ.type === 'mcq' ? (
                <div className="flex flex-col gap-3 mb-8">
                    {currentQ.options?.map((opt) => {
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

                    {/* MOQ Explanation Area */}
                    {isAnswered && (
                        <div className="animate-fade-in mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
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
                </div>
            ) : (
                <div className="flex flex-col gap-4 mb-8">
                    <textarea
                        value={summaryText}
                        onChange={(e) => setSummaryText(e.target.value)}
                        disabled={isAnswered || isGrading}
                        placeholder="Type your answer here..."
                        className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none h-32"
                    />
                    {!isAnswered && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleSummarySubmit}
                                disabled={isGrading || !summaryText.trim()}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isGrading ? 'Grading...' : 'Submit Answer'}
                            </button>
                        </div>
                    )}

                    {/* Summary Feedback Area */}
                    {isAnswered && summaryFeedback && (
                        <div className="animate-fade-in mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    {summaryFeedback.is_passing ? (
                                        <span className="text-emerald-600">✅ Good Job!</span>
                                    ) : (
                                        <span className="text-amber-600">⚠️ Needs Improvement</span>
                                    )}
                                </h4>
                                <div className="text-xs text-slate-500 flex flex-col gap-1 items-end">
                                    <div className="flex gap-3 font-semibold">
                                        <span>Content: {Math.round(summaryFeedback.content_score * 100)}%</span>
                                        <span>Wording: {Math.round(summaryFeedback.wording_score * 100)}%</span>
                                    </div>
                                    {summaryFeedback.sub_scores && Object.keys(summaryFeedback.sub_scores).length > 0 && (
                                        <div className="flex flex-wrap gap-2 justify-end mt-1">
                                            {Object.entries(summaryFeedback.sub_scores).map(([dim, score]) => (
                                                <span key={dim} className="bg-slate-200/50 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-600">
                                                    {dim}: {Math.round(score * 100)}%
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                {summaryFeedback.feedback}
                            </p>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Target Rubric</span>
                                <p className="text-xs text-slate-600">{currentQ.rubric}</p>
                            </div>
                        </div>
                    )}
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
