import React, { useId, useState } from 'react';
import { Check, X, Lightbulb } from 'lucide-react';
import { recordAdaptiveSignal, updateMastery } from '../lib/knowledgeService';
import { useReducedMotion, motionClasses } from '../lib/motion';

// Confidence levels offered before grading. The learner taps one to register
// how sure they are; this is folded into the adaptive signal so the engine can
// distinguish a confident-correct answer from a lucky guess (and a confident
// wrong answer, the classic misconception flag).
const CONFIDENCE_LEVELS = [
    { value: 'low', label: 'Not sure' },
    { value: 'medium', label: 'Fairly sure' },
    { value: 'high', label: 'Confident' },
];

export default function InteractiveQuiz({ question, options, explanation, hint, conceptId, defaultConceptId, sectionId }) {
    const reducedMotion = useReducedMotion();
    const baseId = useId();
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedbackSaved, setFeedbackSaved] = useState(false);
    const [hintShown, setHintShown] = useState(false);
    const [confidence, setConfidence] = useState(null);

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

    const handleOptionKeyDown = (event, idx) => {
        if (isSubmitted) return;
        const total = parsedOptions.length;
        if (total === 0) return;

        let nextIdx = null;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            nextIdx = ((selectedOption ?? idx) + 1) % total;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            nextIdx = ((selectedOption ?? idx) - 1 + total) % total;
        } else if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            handleSelect(idx);
            return;
        }

        if (nextIdx !== null) {
            event.preventDefault();
            setSelectedOption(nextIdx);
        }
    };

    const handleSubmit = () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);

        const resolvedConceptId = conceptId || defaultConceptId || null;
        const wasCorrect = Boolean(parsedOptions[selectedOption]?.isCorrect);

        if (sectionId) {
            recordAdaptiveSignal(sectionId, wasCorrect ? 'inline_quiz_correct' : 'inline_quiz_incorrect', {
                conceptId: resolvedConceptId,
                question,
                confidence,
                hintUsed: hintShown,
            });
        }

        if (resolvedConceptId) {
            updateMastery({ [resolvedConceptId]: 1.0 }, wasCorrect, { sectionId })
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
        setHintShown(false);
        setConfidence(null);
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
    const hasHint = Boolean(hint && String(hint).trim());
    const hintRegionId = `${baseId}-hint`;
    const optionMotion = motionClasses(['transition', 'press'], reducedMotion);

    return (
        <div className="my-10 overflow-hidden rounded-xl border border-slate-200 bg-white font-sans shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <h3 className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="rounded-full bg-[#9E1B32]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9E1B32]">
                        KC
                    </span>
                    Knowledge Check
                </h3>
                {hasHint && !isSubmitted && (
                    <button
                        type="button"
                        onClick={() => setHintShown((shown) => !shown)}
                        aria-expanded={hintShown}
                        aria-controls={hintRegionId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                    >
                        <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                        {hintShown ? 'Hide hint' : 'Show hint'}
                    </button>
                )}
            </div>

            <div className="p-6">
                <p className="mb-6 text-lg font-medium text-slate-800">{question}</p>

                {hasHint && hintShown && !isSubmitted && (
                    <div
                        id={hintRegionId}
                        role="note"
                        className={`mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${motionClasses(['fadeIn'], reducedMotion)}`}
                    >
                        <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                        <span><span className="font-semibold">Hint: </span>{hint}</span>
                    </div>
                )}

                <div className="mb-6 space-y-3" role="radiogroup" aria-label="Answer options">
                    {parsedOptions.map((opt, idx) => {
                        const isChecked = selectedOption === idx;
                        const isFocusable = isChecked || (selectedOption === null && idx === 0);
                        const isCorrect = Boolean(opt.isCorrect);
                        const showCorrectMark = isSubmitted && isCorrect;
                        const showWrongMark = isSubmitted && isChecked && !isCorrect;
                        let resultLabel = '';
                        if (showCorrectMark) {
                            resultLabel = ' (correct answer)';
                        } else if (showWrongMark) {
                            resultLabel = ' (your answer, incorrect)';
                        }
                        return (
                        <button
                            key={idx}
                            type="button"
                            role="radio"
                            aria-checked={isChecked}
                            aria-label={`${opt.text}${resultLabel}`}
                            tabIndex={isSubmitted ? -1 : (isFocusable ? 0 : -1)}
                            onClick={() => handleSelect(idx)}
                            onKeyDown={(event) => handleOptionKeyDown(event, idx)}
                            disabled={isSubmitted}
                            className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left ${optionMotion} ${getOptionStyle(idx, opt.isCorrect)}`}
                        >
                            <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border
                                ${showCorrectMark ? 'border-emerald-500 text-emerald-600' : ''}
                                ${showWrongMark ? 'border-rose-500 text-rose-600' : ''}
                                ${!isSubmitted && isChecked ? 'border-indigo-500 bg-indigo-500' : ''}
                                ${!isSubmitted && !isChecked ? 'border-slate-300 bg-white' : ''}
                            `}>
                                {!isSubmitted && isChecked && <div className="h-2 w-2 rounded-full bg-white" />}
                                {showCorrectMark && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
                                {showWrongMark && <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
                            </div>
                            <span className="flex-1 leading-snug">{opt.text}</span>
                            {(showCorrectMark || showWrongMark) && (
                                <span className={`flex-shrink-0 text-xs font-bold uppercase tracking-wide ${showCorrectMark ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {showCorrectMark ? 'Correct' : 'Incorrect'}
                                </span>
                            )}
                        </button>
                        );
                    })}
                </div>

                {!isSubmitted && (
                    <fieldset className="mb-6 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
                        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            How confident are you?
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Confidence level">
                            {CONFIDENCE_LEVELS.map((level) => {
                                const active = confidence === level.value;
                                return (
                                    <button
                                        key={level.value}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setConfidence((current) => (current === level.value ? null : level.value))}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${motionClasses(['transition'], reducedMotion)} ${
                                            active
                                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                                : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:bg-white'
                                        }`}
                                    >
                                        {level.label}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                )}

                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={selectedOption === null}
                        className={`w-full rounded-lg py-3 font-bold text-white ${motionClasses(['transition'], reducedMotion)}
                            ${selectedOption !== null
                                ? 'bg-[#9E1B32] shadow-md hover:bg-[#7a1526] hover:shadow-lg'
                                : 'cursor-not-allowed bg-slate-300'}`}
                    >
                        Check Answer
                    </button>
                ) : (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`flex flex-col gap-4 rounded-lg border p-5 ${motionClasses(['fadeIn'], reducedMotion)}
                        ${isCorrectChoice ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}
                    `}>
                        <div className="flex items-start gap-3">
                            <span
                                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white ${isCorrectChoice ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                aria-hidden="true"
                            >
                                {isCorrectChoice
                                    ? <Check className="h-4 w-4" strokeWidth={3} />
                                    : <X className="h-4 w-4" strokeWidth={3} />}
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
                                className={`self-end rounded-md border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-4 py-2 text-sm font-medium text-[var(--ath-text)] hover:bg-[var(--ath-panel)] ${motionClasses(['transition'], reducedMotion)}`}
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
