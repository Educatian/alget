import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

// A minimal accessible-dialog harness that wires useFocusTrap exactly as the
// real modals do: a trigger that opens the dialog, the dialog container
// receiving the returned ref, and an onClose callback for Escape.
function DialogHarness({ open, onClose }) {
    const containerRef = useFocusTrap(open, onClose)
    return (
        <div>
            <button type="button">opener</button>
            {open && (
                <div ref={containerRef} role="dialog" aria-label="Test dialog">
                    <button type="button">first</button>
                    <button type="button">middle</button>
                    <button type="button">last</button>
                </div>
            )}
        </div>
    )
}

describe('useFocusTrap accessible-dialog focus management', () => {
    beforeEach(() => {
        // jsdom always reports offsetParent === null, so getFocusable would
        // filter every button out unless it is document.activeElement. Stub it
        // so the focusable query matches the dialog buttons (WCAG 2.4.3).
        // Scoped to this suite and removed in afterEach so it cannot leak.
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            configurable: true,
            get() {
                return document.body
            },
        })
    })

    afterEach(() => {
        cleanup()
        delete HTMLElement.prototype.offsetParent
        vi.restoreAllMocks()
    })

    it('moves focus to the first interactive element when the dialog opens', async () => {
        render(<DialogHarness open onClose={vi.fn()} />)

        await waitFor(() => {
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'first' }),
            )
        })
    })

    it('calls onClose when Escape is pressed (WCAG 2.1.2 no keyboard trap exit)', () => {
        const onClose = vi.fn()
        render(<DialogHarness open onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not trap focus or fire onClose while inactive', () => {
        const onClose = vi.fn()
        render(<DialogHarness open={false} onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('cycles focus from the last element back to the first on Tab', () => {
        render(<DialogHarness open onClose={vi.fn()} />)

        const first = screen.getByRole('button', { name: 'first' })
        const last = screen.getByRole('button', { name: 'last' })

        last.focus()
        expect(document.activeElement).toBe(last)

        fireEvent.keyDown(document, { key: 'Tab' })
        expect(document.activeElement).toBe(first)
    })

    it('wraps Shift+Tab from the first element to the last', () => {
        render(<DialogHarness open onClose={vi.fn()} />)

        const first = screen.getByRole('button', { name: 'first' })
        const last = screen.getByRole('button', { name: 'last' })

        first.focus()
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(last)
    })
})
