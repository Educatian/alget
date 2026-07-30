import { useEffect, useState } from 'react'

export default function NetworkStatusBanner() {
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)

    useEffect(() => {
        const handleOnline = () => setOnline(true)
        const handleOffline = () => setOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    if (online) return null

    return (
        <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[100] bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-slate-950 shadow-sm">
            You are offline. Reading already loaded content remains available; cloud progress will resume when the connection returns.
        </div>
    )
}
