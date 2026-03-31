import React, { useState } from 'react';
import { recordAdaptiveSignal, updateMastery } from '../lib/knowledgeService';

export default function InteractiveQuiz({ question, options, explanation, conceptId, defaultConceptId, sectionId }) {
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedbackSaved, setFeedbackSaved] = useState(false);

    let parsedOptions = [];
    try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : (options || []);
    } catch (e) {
        console.error('InteractiveQuiz: Failed to parse options JSON:', e.message, '\nRaw options:', options);
        return (
            <div className="my-10 rounded-xl border border-amber-300 bg-amber-50 p-6 font-sans">
                <p className="font-medium text-amber-800">Quiz Loading Error: question data could not be parsed.</p>
                <p className="mt-1 text-sm text-amber-600">
                    This is usually caused by special characters in the question text. Please try refreshing.
                </p>
            </div>
        );
    }

    const handleSelect = (idx) => {
        if (isSubmitted) return;
        setSelectedOption(idx);
    };

    const handleSubmit = () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);

        const resolvedConceptId = conceptId || defaultConceptId || null;
        const wasCorrect = Boolean(parsedOptions[selectedOption]?.isCorrect);

        if (sectionId) {
            recordAdaptiveSignal(sectionId, wasCorrect ? 'inline_quiz_correct' : 'inline_quiz_incorrect', {
                conceptId: resolvedConceptId,
                question
            });
        }

        if (resolvedConceptId) {
            updateMastery({ [resolvedConceptId]: 1.0 }, wasCorrect)
                .then(() => setFeedbackSaved(true))
                .catch((error) => {
                    console.error('InteractiveQuiz: failed to update mastery', error);
                });
        }
    };

    const handleRetry = () => {
        setSelectedOption(null);
        setIsSubmitted(false);
        setFeedbackSaved(false);
    };

    const getOptionStyle = (idx, isCorrect) => {
        if (!isSubmitted) {
            return selectedOption === idx
                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50';
        }

        if (isCorrect) {
            return 'border-emerald-500 bg-emerald-50 text-emerald-900';
        }

        if (selectedOption === idx && !isCorrect) {
            return 'border-rose-500 bg-rose-50 text-rose-900';
        }

        return 'border-slate-200 bg-white text-slate-400 opacity-60';
    };

    const isCorrectChoice = isSubmitted && parsedOptions[selectedOption]?.isCorrect;

    return (
        <div className="my-10 overflow-hidden rounded-xl border border-slate-200 bg-white font-sans shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <h3 className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="rounded-full bg-[#9E1B32]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9E1B32]">
                        KC
                    </span>
                    Knowledge Check
                </h3>
            </div>

            <div className="p-6">
                <p className="mb-6 text-lg font-medium text-slate-800">{question}</p>

                <div className="mb-6 space-y-3">
                    {parsedOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelect(idx)}
                            disabled={isSubmitted}
                            className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-all duration-200 ${getOptionStyle(idx, opt.isCorrect)}`}
                        >
                            <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border
                                ${isSubmitted && opt.isCorrect ? 'border-emerald-500 text-emerald-600' : ''}
                                ${isSubmitted && selectedOption === idx && !opt.isCorrect ? 'border-rose-500 text-rose-600' : ''}
                                ${!isSubmitted && selectedOption === idx ? 'border-indigo-500 bg-indigo-500' : ''}
                                ${!isSubmitted && selectedOption !== idx ? 'border-slate-300 bg-white' : ''}
                            `}>
                                {!isSubmitted && selectedOption === idx && <div className="h-2 w-2 rounded-full bg-white" />}
                                {isSubmitted && opt.isCorrect && (
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {isSubmitted && selectedOption === idx && !opt.isCorrect && (
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                            <span className="leading-snug">{opt.text}</span>
                        </button>
                    ))}
                </div>

                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={selectedOption === null}
                        className={`w-full rounded-lg py-3 font-bold text-white transition-all
                            ${selectedOption !== null
                                ? 'bg-[#9E1B32] shadow-md hover:bg-[#7a1526] hover:shadow-lg'
                                : 'cursor-not-allowed bg-slate-300'}`}
                    >
                        Check Answer
                    </button>
                ) : (
                    <div className={`animate-fade-in flex flex-col gap-4 rounded-lg border p-5
                        ${isCorrectChoice ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}
                    `}>
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                {isCorrectChoice ? 'OK' : 'REV'}
                            </span>
                            <div>
                                <h4 className={`mb-1 font-bold ${isCorrectChoice ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {isCorrectChoice ? 'Correct!' : 'Not Quite Right.'}
                                </h4>
                                <p className={`text-sm ${isCorrectChoice ? 'text-emerald-800' : 'text-rose-800'}`}>
                                    {explanation}
                                </p>
                            </div>
                        </div>
                        {feedbackSaved && (
                            <p className="text-xs font-medium text-slate-500">
                                This response has been folded into your learner model.
                            </p>
                        )}
                        {!isCorrectChoice && (
                            <button
                                onClick={handleRetry}
                                className="self-end rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
