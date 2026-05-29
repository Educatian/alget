import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',')

function getFocusable(container) {
    if (!container) return []
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
    )
}

/**
 * useFocusTrap — accessible dialog focus management.
 *
 * While `active` is true it:
 *   - remembers the element that was focused before opening,
 *   - moves focus to the first interactive element inside the container,
 *   - traps Tab / Shift+Tab so focus cycles within the container,
 *   - calls `onClose` when Escape is pressed,
 *   - restores focus to the opener element when it deactivates.
 *
 * Returns a ref to attach to the dialog container element.
 *
 * WCAG: 2.1.2 (No Keyboard Trap — Tab cycles, Escape exits),
 *       2.4.3 (Focus Order — focus enters on open, returns on close).
 */
export function useFocusTrap(active, onClose) {
    const containerRef = useRef(null)
    const previouslyFocusedRef = useRef(null)
    const onCloseRef = useRef(onClose)

    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCloseRef.current?.()
            return
        }

        if (event.key !== 'Tab') return

        const container = containerRef.current
        const focusable = getFocusable(container)
        if (focusable.length === 0) {
            event.preventDefault()
            return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const activeEl = document.activeElement

        if (event.shiftKey) {
            if (activeEl === first || !container.contains(activeEl)) {
                event.preventDefault()
                last.focus()
            }
        } else if (activeEl === last || !container.contains(activeEl)) {
            event.preventDefault()
            first.focus()
        }
    }, [])

    useEffect(() => {
        if (!active) return undefined

        previouslyFocusedRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null

        const container = containerRef.current
        const focusable = getFocusable(container)
        const target = focusable[0] || container
        // Defer to allow the dialog to render before moving focus.
        const raf = requestAnimationFrame(() => {
            target?.focus?.()
        })

        document.addEventListener('keydown', handleKeyDown, true)

        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener('keydown', handleKeyDown, true)
            const opener = previouslyFocusedRef.current
            if (opener && typeof opener.focus === 'function') {
                opener.focus()
            }
        }
    }, [active, handleKeyDown])

    return containerRef
}

export default useFocusTrap
