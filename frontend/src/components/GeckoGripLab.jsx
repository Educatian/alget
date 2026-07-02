/**
 * GeckoGripLab
 * ------------
 * Embeds the standalone WebGPU/ECS "GeckoGrip Lab" dry-adhesive design simulator
 * (deployed at geckogrip-lab.pages.dev) into the Dry Adhesion section. The sim is
 * a cross-origin app, so the iframe keeps its own origin (allow-same-origin) —
 * required for its simulation Web Worker + WebGPU — while staying sandboxed away
 * from the textbook's session.
 */
import { useIframeSimTelemetry } from '../lib/simTelemetry'

export default function GeckoGripLab() {
    useIframeSimTelemetry('bio-inspired/04/01', 'geckogrip')
    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4">
                <p className="flex items-center gap-3 font-semibold text-[var(--ath-text)]">
                    <span className="editorial-label text-[var(--ath-primary)]">LAB</span>
                    GeckoGrip Lab — Design a Bio-Inspired Dry Adhesive
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                    Engineer a gecko-inspired adhesive pad: tune micro-hair density, length, tip shape,
                    stiffness, preload, and peel angle, then test it on glass, metal, wood, and rough
                    concrete. Watch adhesion, shear, reusability, and manufacturability respond — and
                    take on the rescue-robot challenge. <em>Observe → Modify → Test → Explain → Redesign.</em>
                </p>
            </div>
            <div className="border-t border-[var(--ath-line)] bg-[#0c0f14]">
                <iframe
                    src="https://geckogrip-lab.pages.dev/"
                    title="GeckoGrip Lab: design a bio-inspired dry adhesive"
                    sandbox="allow-scripts allow-same-origin"
                    allow="accelerometer; gyroscope"
                    loading="lazy"
                    className="block h-[clamp(520px,72vh,680px)] w-full border-0"
                />
            </div>
            <p className="bg-[var(--ath-panel)] px-5 py-3 text-xs leading-5 text-[var(--ath-muted)]">
                Renders with WebGPU — best in a recent Chrome or Edge browser.{' '}
                <a
                    href="https://geckogrip-lab.pages.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--ath-primary)] underline-offset-2 hover:underline"
                >
                    Open the lab full-screen ↗
                </a>
            </p>
        </div>
    )
}
