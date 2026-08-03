import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, X, Lightbulb } from 'lucide-react';
import { recordAdaptiveSignal, updateMastery } from '../lib/knowledgeService';
import { logEvent, logProblemAttempt } from '../lib/loggingService';
import { recordCalibrationSample, takeCalibrationNudge } from '../lib/calibration';
import { useReducedMotion, motionClasses } from '../lib/motion';
import QuizOption from './QuizOption';
import ConfidencePrompt, { CalibrationNudge, ConfidenceReveal } from './ConfidencePrompt';

// Confidence elicitation (JOL): the learner picks an answer, then commits by
// tapping a one-tap confidence level - the confidence buttons ARE the submit.
// The judgment is folded into the adaptive signal so the engine can
// distinguish a confident-correct answer from a lucky guess (and a confident
// wrong answer, the classic misconception flag), and it feeds the client-side
// calibration record (see lib/calibration.js).

const nowMs = () => performance.now();

function stableQuestionId(question, conceptId) {
    const input = `${conceptId || 'unknown'}:${question || ''}`;
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash) + input.charCodeAt(index);
        hash |= 0;
    }
    return `inline_quiz:${conceptId || 'unknown'}:${Math.abs(hash).toString(36)}`;
}

export default function InteractiveQuiz({ question, options, explanation, hint, conceptId, defaultConceptId, sectionId, correctIndex, correctindex, ...rest }) {
    const reducedMotion = useReducedMotion();
    const baseId = useId();
    const attemptStartedAtRef = useRef(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const radiogroupRef = useRef(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [feedbackSaved, setFeedbackSaved] = useState(false);
    const [hintShown, setHintShown] = useState(false);
    const [nudge, setNudge] = useState(null);
    // The tapped JOL, kept so the reveal can echo it next to the verdict.
    const [judgment, setJudgment] = useState(null);

    useEffect(() => {
        attemptStartedAtRef.current = nowMs();
    }, [question, conceptId, defaultConceptId]);

    let parsedOptions = [];
    try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : (options || []);
    } catch (e) {
        console.error('InteractiveQuiz: Failed to parse options JSON:', e.message, '\nRaw options:', options);
        return (
            <div className="my-10 rounded-xl border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] p-6 font-sans">
                <p className="font-medium text-[var(--ath-warning)]">Quiz Loading Error: question data could not be parsed.</p>
                <p className="mt-1 text-sm text-[var(--ath-muted)]">
                    This is usually caused by special characters in the question text. Please try refreshing.
                </p>
            </div>
        );
    }
    const resolvedCorrectIndex = Number(correctIndex ?? correctindex ?? rest['correct-index'])
    parsedOptions = parsedOptions.map((option, idx) => {
        if (typeof option === 'string') {
            return {
                text: option,
                isCorrect: Number.isFinite(resolvedCorrectIndex) && idx === resolvedCorrectIndex,
            }
        }

        return {
            ...option,
            text: option?.text || option?.label || '',
            isCorrect: Boolean(option?.isCorrect ?? option?.correct ?? (Number.isFinite(resolvedCorrectIndex) && idx === resolvedCorrectIndex)),
        }
    })

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
            // Move DOM focus with the selection (roving tabindex) so keyboard/SR
            // focus tracks the chosen option instead of being stranded.
            const radios = radiogroupRef.current?.querySelectorAll('[role="radio"]');
            radios?.[nextIdx]?.focus();
        }
    };

    // Tapping a confidence level IS the submit (JOL before feedback).
    const handleSubmit = (confidenceValue, confidenceLabel) => {
        if (selectedOption === null || isSubmitted) return;
        setIsSubmitted(true);
        setJudgment({ value: confidenceValue, label: confidenceLabel });

        const resolvedConceptId = conceptId || defaultConceptId || null;
        const wasCorrect = Boolean(parsedOptions[selectedOption]?.isCorrect);
        const problemId = stableQuestionId(question, resolvedConceptId);
        const timeSpentMs = Math.max(0, nowMs() - (attemptStartedAtRef.current || nowMs()));

        logProblemAttempt(problemId, wasCorrect, timeSpentMs, hintShown, sectionId, {
            source: 'inline_quiz',
            concept_id: resolvedConceptId,
            confidence: confidenceValue,
            selected_option_index: selectedOption,
            option_count: parsedOptions.length,
            question_length: String(question || '').length,
        });
        logEvent('confidence_report', problemId, {
            source: 'inline_quiz',
            concept_id: resolvedConceptId,
            value: confidenceValue,
            is_correct: wasCorrect,
        }, sectionId);

        if (sectionId) {
            recordAdaptiveSignal(sectionId, wasCorrect ? 'inline_quiz_correct' : 'inline_quiz_incorrect', {
                conceptId: resolvedConceptId,
                question,
                confidence: confidenceValue,
                hintUsed: hintShown,
            });
        }

        recordCalibrationSample(sectionId, confidenceValue, wasCorrect, parsedOptions.length);
        const calibrationNudge = takeCalibrationNudge(sectionId);
        if (calibrationNudge) {
            setNudge(calibrationNudge);
            logEvent('calibration_nudge', problemId, {
                source: 'inline_quiz',
                direction: calibrationNudge.direction,
                confidence_pct: calibrationNudge.confidencePct,
                accuracy_pct: calibrationNudge.accuracyPct,
                sample_count: calibrationNudge.sampleCount,
            }, sectionId);
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
        setNudge(null);
        setJudgment(null);
        attemptStartedAtRef.current = nowMs();
        logEvent('quiz_retry', stableQuestionId(question, conceptId || defaultConceptId || null), {
            source: 'inline_quiz',
            concept_id: conceptId || defaultConceptId || null,
        }, sectionId);
    };

    const handleHintToggle = () => {
        const nextHintShown = !hintShown;
        setHintShown(nextHintShown);
        if (nextHintShown) {
            logEvent('hint_request', stableQuestionId(question, conceptId || defaultConceptId || null), {
                source: 'inline_quiz',
                concept_id: conceptId || defaultConceptId || null,
            }, sectionId);
        }
    };

    // Map each option to one of the shared QuizOption primitive's states so this
    // widget renders IDENTICAL markup to the practice quiz (critique issue #2:
    // "indigo radio-dot vs green letter-badge ... extract a shared <QuizOption>").
    const resolveState = (idx, isCorrect) => {
        if (!isSubmitted) {
            return selectedOption === idx ? 'selected' : 'default';
        }
        if (isCorrect) return 'correct';
        if (selectedOption === idx && !isCorrect) return 'incorrect';
        return 'disabled';
    };

    const isCorrectChoice = isSubmitted && parsedOptions[selectedOption]?.isCorrect;
    const hasHint = Boolean(hint && String(hint).trim());
    const hintRegionId = `${baseId}-hint`;

    return (
        <div className="my-10 overflow-hidden rounded-[var(--ath-radius-xl)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] font-sans shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-6 py-4">
                <h3 className="flex items-center gap-2 font-bold text-[var(--ath-text)]">
                    <span className="rounded-full bg-[var(--ath-primary-soft)] px-2 py-0.5 text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.2em] text-[var(--ath-primary-deep)]">
                        KC
                    </span>
                    Knowledge Check
                </h3>
                {hasHint && !isSubmitted && (
                    <button
                        type="button"
                        onClick={handleHintToggle}
                        aria-expanded={hintShown}
                        aria-controls={hintRegionId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] px-3 py-1 text-xs font-semibold text-[var(--ath-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--ath-warning)_22%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-warning)_45%,transparent)]"
                    >
                        <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                        {hintShown ? 'Hide hint' : 'Show hint'}
                    </button>
                )}
            </div>

            <div className="p-6">
                <p className="mb-6 text-lg font-medium text-[var(--ath-text)]">{question}</p>

                {hasHint && hintShown && !isSubmitted && (
                    <div
                        id={hintRegionId}
                        role="note"
                        className={`mb-6 flex items-start gap-2 rounded-lg border border-[var(--ath-warning)] bg-[var(--ath-warning-soft)] px-4 py-3 text-sm text-[var(--ath-warning)] ${motionClasses(['fadeIn'], reducedMotion)}`}
                    >
                        <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--ath-warning)]" aria-hidden="true" />
                        <span><span className="font-semibold">Hint: </span>{hint}</span>
                    </div>
                )}

                <div ref={radiogroupRef} className="mb-6 space-y-3" role="radiogroup" aria-label="Answer options">
                    {parsedOptions.map((opt, idx) => {
                        const isChecked = selectedOption === idx;
                        const isFocusable = isChecked || (selectedOption === null && idx === 0);
                        const isCorrect = Boolean(opt.isCorrect);
                        return (
                            <QuizOption
                                key={idx}
                                label={opt.text}
                                state={resolveState(idx, isCorrect)}
                                checked={isChecked}
                                focusable={isSubmitted ? false : isFocusable}
                                onSelect={() => handleSelect(idx)}
                                onKeyDown={(event) => handleOptionKeyDown(event, idx)}
                            />
                        );
                    })}
                </div>

                {!isSubmitted ? (
                    <ConfidencePrompt
                        promptId={`${baseId}-confidence`}
                        optionCount={parsedOptions.length}
                        disabled={selectedOption === null}
                        prompt={selectedOption === null
                            ? 'Pick an answer, then tap how sure you are to submit.'
                            : 'How sure are you? Tapping a level submits your answer.'}
                        onSelect={(value, label) => handleSubmit(value, label)}
                    />
                ) : (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`flex flex-col gap-4 rounded-lg border p-5 ${motionClasses(['fadeIn'], reducedMotion)}
                        ${isCorrectChoice
                                ? 'border-[var(--ath-success,#2f7d63)] bg-[var(--ath-success-soft)]'
                                : 'border-[var(--ath-danger)] bg-[var(--ath-danger-soft,var(--ath-panel-muted))]'}
                    `}>
                        <div className="flex items-start gap-3">
                            <span
                                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--ath-background)] ${isCorrectChoice ? 'bg-[var(--ath-success,#2f7d63)]' : 'bg-[var(--ath-danger)]'}`}
                                aria-hidden="true"
                            >
                                {isCorrectChoice
                                    ? <Check className="h-4 w-4" strokeWidth={3} />
                                    : <X className="h-4 w-4" strokeWidth={3} />}
                            </span>
                            <div>
                                <h4 className="mb-1 font-bold text-[var(--ath-text)]">
                                    {isCorrectChoice ? 'Correct!' : 'Not Quite Right.'}
                                </h4>
                                <p className="text-sm text-[var(--ath-muted)]">
                                    {explanation}
                                </p>
                                <ConfidenceReveal label={judgment?.label} confidence={judgment?.value} correct={isCorrectChoice} />
                            </div>
                        </div>
                        <CalibrationNudge nudge={nudge} />
                        {feedbackSaved && (
                            <p className="text-xs font-medium text-[var(--ath-secondary)]">
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
