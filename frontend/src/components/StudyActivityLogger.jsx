import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { logEvent } from '../lib/loggingService'

const MAX_ERRORS_PER_PAGE_LOAD = 20

/**
 * Study log for navigation and the learner's environment: every page change,
 * leaving / returning to the ALGET tab, and errors the learner runs into.
 * Renders nothing.
 */
export default function StudyActivityLogger() {
    const location = useLocation()
    const previousPath = useRef(null)

    useEffect(() => {
        const path = location.pathname
        logEvent('route_view', path, { path, from: previousPath.current }, null)
        previousPath.current = path
    }, [location.pathname])

    useEffect(() => {
        let errors = 0
        const logError = (kind, message, extra = {}) => {
            if (errors >= MAX_ERRORS_PER_PAGE_LOAD) return
            errors += 1
            logEvent('client_error', kind, {
                kind, message: String(message || '').slice(0, 500), path: window.location.pathname, ...extra,
            }, null)
        }
        const onError = (e) => logError('error', e.message, { source: String(e.filename || '').slice(0, 200), line: e.lineno || null })
        const onRejection = (e) => logError('unhandled_rejection', e.reason?.message || e.reason)
        const onVisibility = () => {
            logEvent(document.hidden ? 'tab_hidden' : 'tab_visible', null, { path: window.location.pathname }, null)
        }
        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onRejection)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('error', onError)
            window.removeEventListener('unhandledrejection', onRejection)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [])

    return null
}
