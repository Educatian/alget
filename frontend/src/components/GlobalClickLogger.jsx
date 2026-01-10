import { useEffect, useRef } from 'react'
import { logClick, logScroll } from '../lib/loggingService'

/**
 * Global Click Logger - Captures all click and scroll interactions
 * Wrap your app root with this component
 */
export default function GlobalClickLogger({ children, sectionId }) {
    const containerRef = useRef(null)
    const scrollTimeoutRef = useRef(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // Click handler
        const handleClick = (e) => {
            const target = e.target
            logClick(target, e.clientX, e.clientY, sectionId)
        }

        // Scroll handler with debounce
        const handleScroll = () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }

            scrollTimeoutRef.current = setTimeout(() => {
                const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
                const scrollPercent = scrollHeight > 0
                    ? Math.round((window.scrollY / scrollHeight) * 100)
                    : 0
                logScroll(scrollPercent, sectionId)
            }, 200)
        }

        // Attach listeners
        container.addEventListener('click', handleClick, true)
        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            container.removeEventListener('click', handleClick, true)
            window.removeEventListener('scroll', handleScroll)
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [sectionId])

    return (
        <div ref={containerRef} className="contents">
            {children}
        </div>
    )
}
