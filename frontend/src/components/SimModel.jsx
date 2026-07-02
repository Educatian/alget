import { useEffect } from 'react'

/**
 * SimModel — an interactive 3D viewport band for a sim card. Renders a
 * Higgsfield image-to-3D GLB of the section's biological inspiration with
 * orbit + auto-rotate, sitting between the contextual photo banner and the
 * parametric controls. (Google <model-viewer> web component, loaded
 * browser-side so it never touches the jsdom test environment.)
 */
export default function SimModel({ src, alt, label }) {
    useEffect(() => {
        import('@google/model-viewer').catch(() => {})
    }, [])
    return (
        <div
            className="relative border-y border-[var(--ath-line)]"
            style={{ background: 'radial-gradient(circle at 50% 38%, #202a38 0%, #0c0f14 75%)' }}
        >
            <model-viewer
                src={src}
                alt={alt}
                camera-controls
                camera-orbit="30deg 72deg auto"
                auto-rotate
                auto-rotate-delay="0"
                rotation-per-second="18deg"
                interaction-prompt="none"
                shadow-intensity="0.9"
                exposure="1.25"
                environment-image="neutral"
                style={{ width: '100%', height: '300px', backgroundColor: 'transparent' }}
            ></model-viewer>
            {label ? (
                <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">
                    {label}
                </span>
            ) : null}
        </div>
    )
}
