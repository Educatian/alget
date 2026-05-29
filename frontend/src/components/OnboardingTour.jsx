import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { logEvent } from '../lib/loggingService'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/browserStorage'
import { useReducedMotion } from '../lib/motion'

/**
 * OnboardingTour - 5-step in-app tour shown on first visit to /book/*.
 *
 * HCD principle: orient before you ask the user to perform. The tour
 * surfaces the four interaction surfaces (TOC, narrative, IntelRail,
 * floating ChatWidget) plus the brain network so the learner does not
 * have to discover them by trial and error.
 *
 * Each step that names a `target` selector now actively SPOTLIGHTS that
 * element: it is scrolled into view, lifted above the scrim with a brand
 * outline, and the tour card is positioned popper-style next to it rather
 * than floating in a context-free centered modal. The Welcome step has no
 * target and stays centered.
 *
 * LXD principle: keep it short. Five steps, dismissible at any time,
 * never re-shown unless the learner clicks "show tour again" in
 * Settings (not yet wired - placeholder).
 */

const TOUR_KEY = 'alget_onboarding_completed_v1'

const STEPS = [
    {
        title: 'Welcome to ALGET',
        body: '5 quick steps. Skip anytime.',
        target: null,
    },
    {
        title: 'Reading pane',
        body: 'Center: narrative, inline checks, diagrams.',
        target: '[data-reading-kind="paragraph"]',
    },
    {
        title: 'Help rail',
        body: 'Stuck? This button opens the AI help rail: Explain, Reframe, Practice, or Ask.',
        // Target the always-present toolbar button (the rail panel itself is only
        // rendered once opened), so the spotlight has something to land on.
        target: '[data-onboarding="help-rail-button"]',
    },
    {
        title: 'Tutor chat',
        body: 'Bottom-right: longer questions. Coaching without giving away answers.',
        target: '[data-onboarding="chat-widget-button"]',
    },
    {
        title: 'Concept map',
        body: 'This header button opens the chapter concept map. Click any concept to jump. Blue: focus / green: stable / amber: developing.',
        // Target the toolbar button; the graph itself only mounts inside its popover.
        target: '[data-onboarding="concept-map-button"]',
    },
]

const CARD_WIDTH = 320
const CARD_GAP = 16
const VIEWPORT_PAD = 12

// Compute popper-style coordinates for the tour card relative to a target rect.
// Prefers placing the card below the target, flips above when there is not
// enough room, and clamps everything to the viewport so the card never
// overflows. Returns null when there is no usable rect (centered fallback).
function computeCardPosition(rect) {
    if (!rect) return null
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Assume a conservative card height for the flip decision; the card grows
    // to its content but this keeps the placement stable.
    const estCardHeight = 180
    const left = Math.min(
        Math.max(rect.left + rect.width / 2 - CARD_WIDTH / 2, VIEWPORT_PAD),
        vw - CARD_WIDTH - VIEWPORT_PAD,
    )
    const spaceBelow = vh - rect.bottom
    const placeBelow = spaceBelow >= estCardHeight + CARD_GAP + VIEWPORT_PAD
    const top = placeBelow
        ? rect.bottom + CARD_GAP
        : Math.max(rect.top - estCardHeight - CARD_GAP, VIEWPORT_PAD)
    return { left, top }
}

export default function OnboardingTour() {
    const [step, setStep] = useState(0)
    const [active, setActive] = useState(false)
    const [rect, setRect] = useState(null)
    const reducedMotion = useReducedMotion()
    const cardRef = useRef(null)
    const nextButtonRef = useRef(null)
    const highlightedElRef = useRef(null)

    const totalSteps = STEPS.length
    const current = useMemo(() => STEPS[step] || null, [step])

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

    // Measure the current step's target, scroll it into view, and lift it above
    // the scrim with a brand outline. Cleanup strips the outline so we never
    // leave a stray ring on the page after the tour moves on or ends.
    const measure = useCallback(() => {
        if (!current?.target) {
            setRect(null)
            return null
        }
        const el = document.querySelector(current.target)
        if (!el) {
            setRect(null)
            return null
        }
        setRect(el.getBoundingClientRect())
        return el
    }, [current])

    // Apply the spotlight outline + scroll on each step (and when activated).
    // All measurement writes to state are deferred (rAF / timeout) so we never
    // call setState synchronously inside the effect body.
    useEffect(() => {
        if (!active) return undefined
        // Strip any outline left on the previous step's element.
        const previous = highlightedElRef.current
        if (previous) {
            previous.style.outline = ''
            previous.style.outlineOffset = ''
            previous.style.zIndex = ''
            previous.style.position = ''
            highlightedElRef.current = null
        }

        if (!current?.target) {
            // Welcome step: centered, no spotlight.
            const raf = requestAnimationFrame(() => setRect(null))
            return () => cancelAnimationFrame(raf)
        }

        let raf = 0
        let settle = 0
        let poll = 0
        let tries = 0

        const applySpotlight = (el) => {
            el.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: reducedMotion ? 'auto' : 'smooth',
            })
            // Lift the target above the scrim (z-[200]) and ring it.
            el.style.outline = '2px solid var(--ath-primary)'
            el.style.outlineOffset = '4px'
            el.style.zIndex = '201'
            // Only force a stacking context when the element is statically
            // positioned; never clobber an existing positioned layout.
            if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative'
            }
            highlightedElRef.current = el
            // Initial measure next frame, then a second measure after the
            // (possibly smooth) scroll settles so the card and cutout track the
            // element's final on-screen position.
            raf = requestAnimationFrame(() => setRect(el.getBoundingClientRect()))
            settle = setTimeout(() => setRect(el.getBoundingClientRect()), reducedMotion ? 0 : 320)
        }

        // Some targets (lazy-mounted ChatWidget, etc.) may not be in the DOM the
        // instant the step activates. Poll briefly before falling back to the
        // centered card, so a real target gets spotlighted instead of just
        // popping a context-free window.
        const tryFind = () => {
            const el = document.querySelector(current.target)
            if (el) {
                applySpotlight(el)
                return
            }
            tries += 1
            if (tries <= 8) {
                poll = setTimeout(tryFind, 150)
            } else {
                setRect(null) // give up after ~1.2s -> centered fallback
            }
        }
        tryFind()

        return () => {
            cancelAnimationFrame(raf)
            clearTimeout(settle)
            clearTimeout(poll)
        }
    }, [active, current, reducedMotion])

    // Keep the spotlight tracking the target as the page resizes or scrolls.
    useEffect(() => {
        if (!active || !current?.target) return undefined
        const onChange = () => measure()
        window.addEventListener('resize', onChange)
        window.addEventListener('scroll', onChange, true)
        return () => {
            window.removeEventListener('resize', onChange)
            window.removeEventListener('scroll', onChange, true)
        }
    }, [active, current, measure])

    // Final unmount safety net: never leave an outline behind.
    useEffect(() => {
        return () => {
            const el = highlightedElRef.current
            if (el) {
                el.style.outline = ''
                el.style.outlineOffset = ''
                el.style.zIndex = ''
                el.style.position = ''
            }
        }
    }, [])

    // Focus management: move focus to the primary action on each step so
    // keyboard users land inside the tour, matching prior focus discipline.
    useLayoutEffect(() => {
        if (!active) return
        const id = setTimeout(() => nextButtonRef.current?.focus(), 0)
        return () => clearTimeout(id)
    }, [active, step])

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

    const cardPos = computeCardPosition(rect)
    const isCentered = !rect || !cardPos

    // When a target is spotlighted we render a 4-panel scrim that leaves a
    // crisp cutout over the target instead of a single full-screen blur that
    // would obscure the very UI the step describes.
    const scrimPanels = rect
        ? [
            { top: 0, left: 0, right: 0, height: Math.max(rect.top - 4, 0) },
            { top: Math.max(rect.bottom + 4, 0), left: 0, right: 0, bottom: 0 },
            { top: Math.max(rect.top - 4, 0), left: 0, width: Math.max(rect.left - 4, 0), height: rect.height + 8 },
            { top: Math.max(rect.top - 4, 0), left: Math.max(rect.right + 4, 0), right: 0, height: rect.height + 8 },
        ]
        : null

    const cardStyle = isCentered
        ? undefined
        : { position: 'fixed', top: cardPos.top, left: cardPos.left, width: CARD_WIDTH, maxWidth: 'calc(100vw - 24px)' }

    const cardClass = isCentered
        ? 'w-full max-w-md rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-6 shadow-xl'
        : 'rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-6 shadow-xl'

    const cardInner = (
        <div ref={cardRef} className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between">
                <p className="editorial-kicker">Tour {step + 1} of {totalSteps}</p>
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
                    ref={nextButtonRef}
                    type="button"
                    onClick={advance}
                    className="editorial-button px-4 py-2 text-sm"
                >
                    {step === totalSteps - 1 ? 'Finish' : 'Next'}
                </button>
            </div>
        </div>
    )

    // Centered fallback (Welcome step or a target that could not be found):
    // keep the original full-screen scrim + centered card.
    if (isCentered) {
        return (
            <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[rgba(5,6,8,0.52)] p-6 backdrop-blur-sm md:items-center">
                {cardInner}
            </div>
        )
    }

    // Spotlight mode: cutout scrim around the lifted target + popper card.
    return (
        <div className="fixed inset-0 z-[200]" aria-live="polite">
            {scrimPanels.map((panel, i) => (
                <div
                    key={i}
                    aria-hidden="true"
                    className="fixed bg-[rgba(5,6,8,0.52)]"
                    style={panel}
                />
            ))}
            {cardInner}
        </div>
    )
}
