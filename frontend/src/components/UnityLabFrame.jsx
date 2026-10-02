import { useMemo, useRef } from 'react'
import { useIframeSimTelemetry } from '../lib/simTelemetry'

function addParentOrigin(src) {
    const url = new URL(src)
    url.searchParams.set('parentOrigin', window.location.origin)
    return url.toString()
}

// Embeds a Unity WebGL lab (a different origin, so allow-same-origin only lets
// the lab use its own storage; it cannot reach ALGET's page or session).
export default function UnityLabFrame({ sectionId, simId, source, src, title, onEvent }) {
    const iframeRef = useRef(null)
    const embeddedSrc = useMemo(() => addParentOrigin(src), [src])
    useIframeSimTelemetry(sectionId, simId, {
        iframeRef,
        src: embeddedSrc,
        allowedSources: [source],
        onEvent,
    })

    return (
        <div className="overflow-hidden rounded-2xl border border-[var(--ath-line)] bg-[#0c0f14]">
            <iframe
                ref={iframeRef}
                src={embeddedSrc}
                title={title}
                sandbox="allow-scripts allow-same-origin allow-downloads"
                allow="fullscreen"
                loading="lazy"
                className="block h-[clamp(560px,76vh,780px)] w-full border-0"
            />
            <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                Laptop or desktop required. Your trials are saved to ALGET automatically; you do not need to export anything.
                For a bigger view, use the lab&apos;s own Fullscreen button (opening the lab in a separate tab would not save your trials).
            </p>
        </div>
    )
}
