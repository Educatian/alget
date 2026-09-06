import { useMemo, useRef } from 'react'
import { useIframeSimTelemetry } from '../lib/simTelemetry'

function addParentOrigin(src) {
    const url = new URL(src)
    url.searchParams.set('parentOrigin', window.location.origin)
    return url.toString()
}

export default function UnityLabFrame({ sectionId, simId, source, src, title, description }) {
    const iframeRef = useRef(null)
    const embeddedSrc = useMemo(() => addParentOrigin(src), [src])
    useIframeSimTelemetry(sectionId, simId, {
        iframeRef,
        src: embeddedSrc,
        allowedSources: [source],
    })

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4">
                <p className="flex items-center gap-3 font-semibold text-[var(--ath-text)]">
                    <span className="editorial-label text-[var(--ath-primary)]">UNITY LAB</span>
                    {title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">{description}</p>
            </div>
            <div className="border-t border-[var(--ath-line)] bg-[#0c0f14]">
                <iframe
                    ref={iframeRef}
                    src={embeddedSrc}
                    title={title}
                    sandbox="allow-scripts allow-same-origin allow-downloads"
                    loading="lazy"
                    className="block h-[clamp(560px,76vh,760px)] w-full border-0"
                />
            </div>
            <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                Desktop browser required. Anonymous process evidence is recorded only after origin and schema validation.{' '}
                <a href={embeddedSrc} target="_blank" rel="noreferrer" className="font-semibold text-[var(--ath-primary)] underline-offset-2 hover:underline">
                    Open full-screen ↗
                </a>
            </p>
        </div>
    )
}
