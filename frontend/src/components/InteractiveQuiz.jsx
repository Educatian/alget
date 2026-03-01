import React, { useState } from 'react';

export default function InteractiveQuiz({ question, options, explanation }) {
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Parse options if passed as a JSON string from MDX
    let parsedOptions = [];
    try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : (options || []);
    } catch (e) {
        console.error('InteractiveQuiz: Failed to parse options JSON:', e.message, '\nRaw options:', options);
        return (
            <div className="my-10 bg-amber-50 border border-amber-300 rounded-xl p-6 font-sans">
                <p className="text-amber-800 font-medium">⚠️ Quiz loading error — question data could not be parsed.</p>
                <p className="text-amber-600 text-sm mt-1">This is usually caused by special characters in the question text. Please try refreshing.</p>
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
    };

    const handleRetry = () => {
        setSelectedOption(null);
        setIsSubmitted(false);
    };

    const getOptionStyle = (idx, isCorrect) => {
        if (!isSubmitted) {
            return selectedOption === idx
                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 bg-white';
        }

        if (isCorrect) {
            return 'border-emerald-500 bg-emerald-50 text-emerald-900';
        }

        if (selectedOption === idx && !isCorrect) {
            return 'border-rose-500 bg-rose-50 text-rose-900';
        }

        return 'border-slate-200 bg-white text-slate-400 opacity-60'; // Other incorrect options
    };

    const isCorrectChoice = isSubmitted && parsedOptions[selectedOption]?.isCorrect;

    return (
        <div className="my-10 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-xl">🧠</span>
                    Knowledge Check
                </h3>
            </div>

            <div className="p-6">
                <p className="text-lg font-medium text-slate-800 mb-6">{question}</p>

                <div className="space-y-3 mb-6">
                    {parsedOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelect(idx)}
                            disabled={isSubmitted}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-start gap-3 ${getOptionStyle(idx, opt.isCorrect)}`}
                        >
                            <div className={`mt-0.5 w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center
                                ${isSubmitted && opt.isCorrect ? 'border-emerald-500 text-emerald-600' : ''}
                                ${isSubmitted && selectedOption === idx && !opt.isCorrect ? 'border-rose-500 text-rose-600' : ''}
                                ${!isSubmitted && selectedOption === idx ? 'border-indigo-500 bg-indigo-500' : ''}
                                ${!isSubmitted && selectedOption !== idx ? 'border-slate-300 bg-white' : ''}
                            `}>
                                {!isSubmitted && selectedOption === idx && <div className="w-2 h-2 rounded-full bg-white" />}
                                {isSubmitted && opt.isCorrect && (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {isSubmitted && selectedOption === idx && !opt.isCorrect && (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all
                            ${selectedOption !== null
                                ? 'bg-[#9E1B32] hover:bg-[#7a1526] shadow-md hover:shadow-lg'
                                : 'bg-slate-300 cursor-not-allowed'}`}
                    >
                        Check Answer
                    </button>
                ) : (
                    <div className={`p-5 rounded-lg border flex flex-col gap-4 animate-fade-in
                        ${isCorrectChoice ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}
                    `}>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl mt-0.5">
                                {isCorrectChoice ? '🎯' : '💡'}
                            </span>
                            <div>
                                <h4 className={`font-bold mb-1 ${isCorrectChoice ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {isCorrectChoice ? 'Correct!' : 'Not quite right.'}
                                </h4>
                                <p className={`text-sm ${isCorrectChoice ? 'text-emerald-800' : 'text-rose-800'}`}>
                                    {explanation}
                                </p>
                            </div>
                        </div>
                        {!isCorrectChoice && (
                            <button
                                onClick={handleRetry}
                                className="self-end px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
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
