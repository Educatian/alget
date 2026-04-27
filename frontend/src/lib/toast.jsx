import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContext'

/**
 * Toast — global ephemeral feedback. Replaces silent `console.warn` for
 * user-visible success/error notifications without blocking dialogs.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Highlight saved')
 *   toast.error('Could not save highlight; will retry')
 *   toast.info('Retention check due in 2 min')
 *
 * Mounted at App.jsx root via <ToastProvider>. Auto-dismiss 5s default;
 * persistent: true keeps a toast until manually dismissed.
 */

const DEFAULT_DURATION = 5000
const MAX_VISIBLE = 4

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const idRef = useRef(0)

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const push = useCallback((message, options = {}) => {
        idRef.current += 1
        const id = idRef.current
        const toast = {
            id,
            message,
            tone: options.tone || 'info',
            duration: options.duration == null ? DEFAULT_DURATION : options.duration,
            persistent: Boolean(options.persistent),
            actionLabel: options.actionLabel || null,
            onAction: options.onAction || null,
        }
        setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), toast])
        if (!toast.persistent && toast.duration > 0) {
            setTimeout(() => dismiss(id), toast.duration)
        }
        return id
    }, [dismiss])

    const api = useMemo(() => ({
        success: (msg, opts) => push(msg, { ...opts, tone: 'success' }),
        error: (msg, opts) => push(msg, { ...opts, tone: 'error' }),
        info: (msg, opts) => push(msg, { ...opts, tone: 'info' }),
        warning: (msg, opts) => push(msg, { ...opts, tone: 'warning' }),
        dismiss,
    }), [push, dismiss])

    return (
        <ToastContext.Provider value={api}>
            {children}
            <ToastViewport toasts={toasts} dismiss={dismiss} />
        </ToastContext.Provider>
    )
}

function ToastViewport({ toasts, dismiss }) {
    if (toasts.length === 0) return null
    return (
        <div
            className="pointer-events-none fixed bottom-6 right-6 z-[300] flex max-w-sm flex-col gap-2 sm:bottom-8 sm:right-8"
            role="region"
            aria-label="Notifications"
            aria-live="polite"
        >
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
        </div>
    )
}

function ToastItem({ toast, onDismiss }) {
    const [enter, setEnter] = useState(false)
    useEffect(() => {
        const id = requestAnimationFrame(() => setEnter(true))
        return () => cancelAnimationFrame(id)
    }, [])

    const tone = TONE_STYLES[toast.tone] || TONE_STYLES.info
    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md transition-all duration-200 ${
                enter ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            } ${tone.shell}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
        >
            <span className="mt-0.5 text-base leading-none" aria-hidden="true">{tone.glyph}</span>
            <div className="flex-1 leading-6">{toast.message}</div>
            {toast.actionLabel && toast.onAction && (
                <button
                    type="button"
                    onClick={() => { toast.onAction(); onDismiss() }}
                    className="rounded-full border border-current px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-white/40"
                >
                    {toast.actionLabel}
                </button>
            )}
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="text-xs opacity-60 transition-opacity hover:opacity-100"
            >
                ✕
            </button>
        </div>
    )
}

const TONE_STYLES = {
    success: {
        shell: 'border-emerald-300 bg-emerald-50/95 text-emerald-900',
        glyph: '✓',
    },
    error: {
        shell: 'border-rose-300 bg-rose-50/95 text-rose-900',
        glyph: '⚠',
    },
    info: {
        shell: 'border-sky-300 bg-sky-50/95 text-sky-900',
        glyph: 'ℹ',
    },
    warning: {
        shell: 'border-amber-300 bg-amber-50/95 text-amber-900',
        glyph: '!',
    },
}
