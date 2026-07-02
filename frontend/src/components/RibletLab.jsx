/**
 * RibletLab (bio-inspired/02/01 — Fluid Dynamics / shark-skin riblets)
 * Embeds the standalone WebGPU/ECS "Riblet Lab" drag-reduction designer
 * (riblet-lab.pages.dev). Cross-origin iframe keeps its own origin for the sim's
 * worker + WebGPU while staying sandboxed from the textbook session.
 */
import { useIframeSimTelemetry } from '../lib/simTelemetry'

export default function RibletLab() {
    useIframeSimTelemetry('bio-inspired/02/01', 'riblet')
    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4">
                <p className="flex items-center gap-3 font-semibold text-[var(--ath-text)]">
                    <span className="editorial-label text-[var(--ath-primary)]">LAB</span>
                    Riblet Lab — Design a Drag-Reducing Shark Skin
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                    Tune riblet spacing, height, and flow speed to land the spacing in wall units at s⁺ ≈ 15,
                    the drag-reduction sweet spot. Overshoot it and the ridges protrude into the buffer layer,
                    turning into roughness that <em>increases</em> drag — the sign flip every riblet designer
                    must respect.
                </p>
            </div>
            <div className="border-t border-[var(--ath-line)] bg-[#0c0f14]">
                <iframe
                    src="https://riblet-lab.pages.dev/"
                    title="Riblet Lab: design a drag-reducing shark skin"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    className="block h-[clamp(520px,72vh,680px)] w-full border-0"
                />
            </div>
            <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                Renders with WebGPU — best in a recent Chrome or Edge browser.{' '}
                <a href="https://riblet-lab.pages.dev/" target="_blank" rel="noreferrer" className="font-semibold text-[var(--ath-primary)] underline-offset-2 hover:underline">Open full-screen ↗</a>
            </p>
        </div>
    )
}
