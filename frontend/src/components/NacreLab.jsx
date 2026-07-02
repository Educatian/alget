/**
 * NacreLab (bio-inspired/01/02 — Hierarchical Structures)
 * Embeds the standalone WebGPU/ECS "Nacre Lab" brick-and-mortar designer
 * (nacre-lab.pages.dev). Cross-origin iframe keeps its own origin for the sim's
 * worker + WebGPU while staying sandboxed from the textbook session.
 */
import { useIframeSimTelemetry } from '../lib/simTelemetry'

export default function NacreLab() {
    useIframeSimTelemetry('bio-inspired/01/02', 'nacre')
    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4">
                <p className="flex items-center gap-3 font-semibold text-[var(--ath-text)]">
                    <span className="editorial-label text-[var(--ath-primary)]">LAB</span>
                    Nacre Lab — Design a Brick-and-Mortar Composite
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                    Tune tablet length, thickness, mineral fraction, and the organic mortar, then watch the
                    tension-shear chain play out: slender tablets stiffen and strengthen the composite, but
                    push the aspect ratio past the critical s* and the tablets fracture instead of sliding —
                    losing nacre's energy-dissipating pull-out. Maximize the work of fracture.
                </p>
            </div>
            <div className="border-t border-[var(--ath-line)] bg-[#0c0f14]">
                <iframe
                    src="https://nacre-lab.pages.dev/"
                    title="Nacre Lab: design a brick-and-mortar composite"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    className="block h-[clamp(520px,72vh,680px)] w-full border-0"
                />
            </div>
            <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                Renders with WebGPU — best in a recent Chrome or Edge browser.{' '}
                <a href="https://nacre-lab.pages.dev/" target="_blank" rel="noreferrer" className="font-semibold text-[var(--ath-primary)] underline-offset-2 hover:underline">Open full-screen ↗</a>
            </p>
        </div>
    )
}
