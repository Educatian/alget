// motion.js - a tiny reduced-motion-aware animation layer.
//
// Two consumers exist: React components (via the useReducedMotion hook) and
// plain className composition (via the exported token helpers). Everything here
// degrades to a no-op when the user has set prefers-reduced-motion: reduce, so
// callers can stay declarative and never branch on the media query themselves.
//
// The CSS that backs these class tokens already lives in index.css
// (@keyframes fade-in, .animate-fade-in) and the global
// @media (prefers-reduced-motion: reduce) block clamps animation/transition
// durations to ~0ms. These helpers add a JS-side guard so we also skip
// transform-based entrance offsets (translate/scale) that a duration clamp
// alone would still paint on the first frame.

import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Synchronous read of the OS-level reduced-motion preference. Safe in SSR /
 * non-browser environments (returns false) and when matchMedia is unavailable.
 */
export function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false
    }
    try {
        return window.matchMedia(REDUCED_MOTION_QUERY).matches
    } catch {
        return false
    }
}

/**
 * React hook: live boolean that flips if the user toggles the OS preference
 * mid-session. Defaults to false so the first paint never assumes motion is
 * disabled before we can read the media query.
 */
export function useReducedMotion() {
    const [reduced, setReduced] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined
        }
        const mql = window.matchMedia(REDUCED_MOTION_QUERY)
        const sync = () => setReduced(mql.matches)
        sync()
        // Safari < 14 only supports the deprecated addListener signature.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', sync)
            return () => mql.removeEventListener('change', sync)
        }
        mql.addListener(sync)
        return () => mql.removeListener(sync)
    }, [])

    return reduced
}

// Class tokens. Each maps to existing index.css animation utilities. When
// motion is reduced we return an empty string so no transform-based entrance
// runs. Callers compose these into className strings.
const TOKENS = {
    // Soft opacity + slight scale entrance for a block appearing in place.
    fadeIn: 'animate-fade-in',
    // A smooth all-purpose transition for hover / state color changes.
    transition: 'transition-all duration-200 ease-out',
    // Press feedback for tappable options.
    press: 'active:scale-[0.99]',
    // Lift affordance on hover for selectable rows.
    lift: 'hover:-translate-y-px',
}

/**
 * Resolve a motion token to its className, or '' when motion is reduced.
 * @param {keyof typeof TOKENS} name
 * @param {boolean} reduced - pass useReducedMotion() / prefersReducedMotion()
 */
export function motionClass(name, reduced) {
    if (reduced) return ''
    return TOKENS[name] || ''
}

/**
 * Compose several motion tokens into one className string, dropping any that
 * are unknown or that are suppressed by the reduced-motion preference.
 * Non-token strings are passed through untouched so callers can interleave
 * static utility classes with motion tokens.
 * @param {Array<string>} names
 * @param {boolean} reduced
 */
export function motionClasses(names, reduced) {
    return names
        .map((name) => (name in TOKENS ? motionClass(name, reduced) : name))
        .filter(Boolean)
        .join(' ')
}

/**
 * Inline-style helper for an entrance offset (translate/scale) that should be
 * neutralized under reduced motion. Returns a style object suitable for spread
 * onto an element. When reduced, returns {} so nothing animates.
 */
export function entranceStyle(reduced, { from = 6 } = {}) {
    if (reduced) return {}
    return {
        animation: 'fade-in 0.22s ease-out',
        // expose the offset for any caller that wants to drive a custom keyframe
        '--motion-from-y': `${from}px`,
    }
}

export default {
    prefersReducedMotion,
    useReducedMotion,
    motionClass,
    motionClasses,
    entranceStyle,
}
