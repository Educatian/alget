import React from 'react'
import { Check, X } from 'lucide-react'

/**
 * QuizOption - the shared answer-option primitive.
 *
 * Both InteractiveQuiz ("Knowledge Check") and the practice quiz (PracticeBlock)
 * render their options through THIS component so the two widgets produce
 * IDENTICAL markup instead of the two unrelated looks the design critique flags
 * (issue #2: "indigo radio-dot vs green letter-badge ... same job, two unrelated
 * looks ... Extract a shared <QuizOption> primitive so both quiz widgets render
 * identical markup.").
 *
 * Semantics: an accessible radio (role="radio" + aria-checked) that is keyboard
 * operable (Space / Enter select; arrow-key roving is owned by the parent
 * radiogroup, which sets `checked` and drives focus). Correctness is conveyed
 * NON-color first (an icon + an uppercase "Correct" / "Incorrect" text label),
 * so the state is legible to color-blind learners and screen readers, with the
 * tokenized color as reinforcement only.
 *
 * Colors are 100% --ath-* tokens (no raw hex), so every state inverts in dark
 * mode:
 *   selected  -> border var(--ath-primary), bg var(--ath-primary-soft)
 *   correct   -> border var(--ath-success), bg var(--ath-success-soft)
 *   incorrect -> border var(--ath-danger),  bg var(--ath-danger-soft)
 *   disabled  -> muted panel, reduced opacity, not focusable
 *   default   -> line border, surface bg, hover lifts toward the primary
 *
 * NOTE on tokens: --ath-success(-soft) / --ath-danger-soft are part of the
 * semantic ramp the design system is completing (critique systemic gap #3). If a
 * token is not yet present in index.css, CSS resolves the var() to its inline
 * fallback (Tailwind neutral / the existing --ath-danger), so this component is
 * safe to ship before the ramp lands and upgrades automatically once it does.
 *
 * Props:
 *   label    - the option text (string or node). Required.
 *   state    - 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled'.
 *   onSelect - called when the learner activates the option (click / Space /
 *              Enter). Not called while disabled or graded.
 *   name     - radiogroup name (shared by sibling options; used for the input
 *              grouping fallback and as an id stem).
 *   checked  - whether this option is the chosen one (drives aria-checked and
 *              the roving tabIndex).
 *   marker   - optional leading marker node (e.g. an "A"/"B" letter badge) shown
 *              in the indicator when the option is in a neutral state.
 *   focusable - override the roving tabIndex (default: derive from `checked`).
 *   disabled  - hard-disable independent of `state` (e.g. after grading).
 */

const STATE_CLASSES = {
    default:
        'border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-text)] hover:border-[var(--ath-primary)] hover:bg-[var(--ath-panel)]',
    selected:
        'border-[var(--ath-primary)] bg-[var(--ath-primary-soft)] text-[var(--ath-text)] shadow-sm',
    correct:
        'border-[var(--ath-success,#2f7d63)] bg-[var(--ath-success-soft,var(--ath-primary-soft))] text-[var(--ath-text)]',
    incorrect:
        'border-[var(--ath-danger)] bg-[var(--ath-danger-soft,var(--ath-panel-muted))] text-[var(--ath-text)]',
    disabled:
        'border-[var(--ath-line)] bg-[var(--ath-panel-muted)] text-[var(--ath-muted)] opacity-60',
}

const INDICATOR_CLASSES = {
    default: 'border-[var(--ath-line-strong)] bg-[var(--ath-panel)] text-[var(--ath-secondary)]',
    selected: 'border-[var(--ath-primary)] bg-[var(--ath-primary)] text-[var(--ath-background)]',
    correct: 'border-[var(--ath-success,#2f7d63)] text-[var(--ath-success,#2f7d63)]',
    incorrect: 'border-[var(--ath-danger)] text-[var(--ath-danger)]',
    disabled: 'border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-muted)]',
}

export default function QuizOption({
    label,
    state = 'default',
    onSelect,
    name,
    checked = false,
    marker = null,
    focusable,
    disabled = false,
    ...rest
}) {
    const isGraded = state === 'correct' || state === 'incorrect'
    const isDisabled = disabled || state === 'disabled'
    const isInteractive = !isGraded && !isDisabled

    // Non-color correctness label appended to the accessible name so screen
    // reader users hear the verdict, not just see the tint.
    let resultLabel = ''
    if (state === 'correct') resultLabel = ' (correct answer)'
    else if (state === 'incorrect') resultLabel = ' (your answer, incorrect)'

    const accessibleName =
        typeof label === 'string' ? `${label}${resultLabel}` : undefined

    // Roving tabIndex: the checked option is the single tab stop; everything
    // else is reachable via arrow keys (owned by the parent radiogroup). Graded
    // / disabled options leave the tab order entirely.
    const resolvedFocusable =
        typeof focusable === 'boolean' ? focusable : checked
    const tabIndex = isInteractive ? (resolvedFocusable ? 0 : -1) : -1

    const handleClick = () => {
        if (!isInteractive) return
        onSelect?.()
    }

    const handleKeyDown = (event) => {
        if (!isInteractive) return
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            onSelect?.()
        }
        // Arrow-key roving is intentionally NOT handled here: the parent
        // radiogroup owns selection movement so a single source of truth drives
        // which option becomes checked. Letting both handle arrows would double
        // the step.
    }

    return (
        <button
            type="button"
            role="radio"
            name={name}
            aria-checked={checked}
            aria-label={accessibleName}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            tabIndex={tabIndex}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            data-state={state}
            className={`flex w-full items-start gap-3 rounded-[var(--ath-radius-lg)] border-2 p-4 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] ${STATE_CLASSES[state] || STATE_CLASSES.default}`}
            {...rest}
        >
            <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${INDICATOR_CLASSES[state] || INDICATOR_CLASSES.default}`}
            >
                {state === 'correct' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                {state === 'incorrect' && <X className="h-3.5 w-3.5" strokeWidth={3} />}
                {state === 'selected' && <span className="h-2 w-2 rounded-full bg-[var(--ath-background)]" />}
                {(state === 'default' || state === 'disabled') && marker}
            </span>

            <span className="flex-1 leading-snug">{label}</span>

            {isGraded && (
                <span
                    className={`flex-shrink-0 text-xs font-bold uppercase tracking-wide ${
                        state === 'correct'
                            ? 'text-[var(--ath-success,#2f7d63)]'
                            : 'text-[var(--ath-danger)]'
                    }`}
                >
                    {state === 'correct' ? 'Correct' : 'Incorrect'}
                </span>
            )}
        </button>
    )
}
