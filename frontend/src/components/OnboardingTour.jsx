import { useEffect, useMemo, useState } from 'react'
import { logEvent } from '../lib/loggingService'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/browserStorage'

/**
 * OnboardingTour — 5-step in-app tour shown on first visit to /book/*.
 *
 * HCD principle: orient before you ask the user to perform. The tour
 * surfaces the four interaction surfaces (TOC, narrative, IntelRail,
 * floating ChatWidget) plus the brain network so the learner does not
 * have to discover them by trial and error.
 *
 * LXD principle: keep it short. Five steps, dismissible at any time,
 * never re-shown unless the learner clicks "show tour again" in
 * Settings (not yet wired — placeholder).
 */

const TOUR_KEY = 'alget_onboarding_completed_v1'

const STEPS = [
    {
        title: 'Welcome to ALGET',
        body: 'A short tour of the workspace. Five quick steps. You can dismiss any time and replay from Settings.',
        target: null,
    },
    {
        title: 'The reading pane',
        body: 'The textbook narrative lives in the center. Embedded check-ins, diagrams, and worked examples appear inline. Read deliberately — pause at every check.',
        target: '[data-reading-kind="paragraph"]',
    },
    {
        title: 'The intelligence rail',
        body: 'When you stall, the rail opens with four short modes: Explain, Reframe, Practice, and Ask. Each gives you a different path into the same idea.',
        target: '.intel-rail',
    },
    {
        title: 'The floating tutor chat',
        body: 'Bottom-right corner. Long conversations live here. The tutor will guide you to answers — it will not give them away. Ask specific questions.',
        target: '[data-onboarding="chat-widget-button"]',
    },
    {
        title: 'The brain network',
        body: 'Your concept-level mastery, visualized. Click any node to jump to that section. Blue is the current concept; green is mastered; amber is emerging.',
        target: '.knowledge-graph-mount',
    },
]

export default function OnboardingTour() {
    const [step, setStep] = useState(0)
    const [active, setActive] = useState(false)

    useEffect(() => {
        if (safeLocalStorageGet(TOUR_KEY) === 'done') return
        // Tiny delay so the page can paint before the overlay appears.
        const timer = setTimeout(() => {
            setActive(true)
            logEvent('onboarding_tour_started', null, {})
        }, 600)
        return () => clearTimeout(timer)
    }, [])

    // Esc-to-skip on the tour overlay (a11y).
    useEffect(() => {
        if (!active) return
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                safeLocalStorageSet(TOUR_KEY, 'done')
                logEvent('onboarding_tour_finished', null, { reason: 'esc', step_reached: step })
                setActive(false)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [active, step])

    const totalSteps = STEPS.length
    const current = useMemo(() => STEPS[step] || null, [step])

    if (!active || !current) return null

    const finish = (reason) => {
        safeLocalStorageSet(TOUR_KEY, 'done')
        logEvent('onboarding_tour_finished', null, { reason, step_reached: step })
        setActive(false)
    }

    const advance = () => {
        const next = step + 1
        if (next >= totalSteps) {
            finish('completed')
        } else {
            logEvent('onboarding_tour_step', null, { step: next })
            setStep(next)
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[rgba(5,6,8,0.52)] p-6 backdrop-blur-sm md:items-center">
            <div className="w-full max-w-md rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <p className="editorial-kicker">Tour · {step + 1} of {totalSteps}</p>
                    <button
                        type="button"
                        onClick={() => finish('dismissed')}
                        className="text-xs text-[var(--ath-muted)] underline"
                    >
                        Skip tour
                    </button>
                </div>

                <div
                    className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--ath-line)]"
                    role="progressbar"
                    aria-label="Onboarding tour progress"
                    aria-valuenow={step + 1}
                    aria-valuemin={1}
                    aria-valuemax={totalSteps}
                >
                    <div
                        className="h-1 rounded-full bg-[var(--ath-primary)] transition-all duration-300"
                        style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                    />
                </div>

                <h3 className="mt-3 text-lg font-semibold text-[var(--ath-text)]">{current.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">{current.body}</p>

                <div className="mt-5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setStep(Math.max(0, step - 1))}
                        disabled={step === 0}
                        className="text-xs text-[var(--ath-muted)] disabled:opacity-30"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={advance}
                        className="editorial-button px-4 py-2 text-sm"
                    >
                        {step === totalSteps - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    )
}
