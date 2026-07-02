import { useId, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * SerrationOptimizer (bio-inspired/03/01 — Aeroacoustics & Wing Serrations)
 * ------------------------------------------------------------------------
 * Owl-wing trailing-edge serrations cut noise two ways, both modelled here:
 *  1. Shedding tone follows Strouhal:  f = St · U / λ   (St ≈ 0.2).
 *     Finer teeth (small λ) push the tone UP, out of the ear's most sensitive
 *     2–5 kHz band and into stronger atmospheric attenuation.
 *  2. N teeth shed out of phase, so their dipoles add incoherently:
 *     de-correlation gain ≈ 10·log₁₀(N) dB, boosted by slender (deep) teeth.
 * Baseline trailing-edge noise is a dipole that scales as U⁶ → 60·log₁₀(U/U₀) dB.
 *
 * The misconception this surfaces: "just add teeth." Spacing (frequency) matters
 * as much as count, and flow speed dominates everything (U⁶).
 */

const St = 0.2
const U_REF = 5 // m/s reference for the relative dipole level

function Slider({ id, label, value, min, max, step = 1, unit, onChange, valueText }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{label}</label>
                <span className="text-xs font-bold text-[var(--ath-primary)]">{value}{unit ? ` ${unit}` : ''}</span>
            </div>
            <input id={id} type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={valueText}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--ath-line)] accent-[var(--ath-primary)]" />
        </div>
    )
}

export function serrationModel({ speed, spacingMm, depthMm, teeth }) {
    const lambda = spacingMm / 1000 // m
    const toneHz = (St * speed) / lambda
    const toneKHz = toneHz / 1000

    // Baseline trailing-edge dipole level (relative dB), U^6.
    const baselineDb = 60 * Math.log10(speed / U_REF)

    // De-correlation across N independent teeth (incoherent sum) + a slenderness
    // bonus: deep teeth relative to spacing de-correlate more (diminishing).
    const decorrDb = 10 * Math.log10(Math.max(1, teeth))
    const slenderness = Math.min(3, depthMm / spacingMm)
    const slenderDb = 3 * Math.log10(1 + slenderness)
    // Higher frequency attenuates faster in air (≈ f²) — extra perceived drop.
    const atmosDb = Math.max(0, 4 * Math.log10(toneHz / 2000))
    const reductionDb = decorrDb + slenderDb + atmosDb

    const netDb = baselineDb - reductionDb

    // Crude A-weighting: the ear peaks ~2–5 kHz; tones above ~10 kHz feel quieter.
    const audibility =
        toneKHz < 0.5 ? 0.6 :
        toneKHz <= 5 ? 1 :
        toneKHz <= 10 ? 0.6 : 0.3
    const perceived = Math.max(0, netDb * audibility)

    return { toneHz, toneKHz, baselineDb, reductionDb, netDb, perceived }
}

export default function SerrationOptimizer() {
    const baseId = useId()
    const [speed, setSpeed] = useState(30)
    const [spacingMm, setSpacingMm] = useState(8)
    const [depthMm, setDepthMm] = useState(12)
    const [teeth, setTeeth] = useState(30)

    const m = serrationModel({ speed, spacingMm, depthMm, teeth })
    useSimTelemetry('bio-inspired/03/01', 'serration', { speed, spacingMm, depthMm, teeth }, m.toneKHz >= 5 && m.reductionDb > 14)
    const tooLow = m.toneKHz < 5 && m.perceived > 18

    // SVG: a trailing edge with a row of serration triangles.
    const edgeY = 60
    const n = Math.min(22, Math.round(180 / spacingMm) + 4)
    const tw = 240 / n
    const th = Math.min(46, depthMm * 1.4)
    const teethPath = Array.from({ length: n }, (_, i) => {
        const x = 30 + i * tw
        return `M ${x} ${edgeY} L ${x + tw / 2} ${edgeY + th} L ${x + tw} ${edgeY} Z`
    }).join(' ')

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/serration.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Quiet-Blade Serration Optimizer
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">
                    f = St·U/λ &nbsp;·&nbsp; de-correlation ≈ 10·log₁₀(N) dB &nbsp;·&nbsp; baseline noise ∝ U⁶
                </p>
            </div>
            <SimModel src="/sim-art/models/owl.glb" alt="Barn owl 3D model" label="Barn owl" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <Slider id={`${baseId}-u`} label="Flow speed U" value={speed} min={5} max={60} unit="m/s" onChange={setSpeed} valueText={`${speed} metres per second`} />
                    <Slider id={`${baseId}-l`} label="Tooth spacing λ" value={spacingMm} min={1} max={20} unit="mm" onChange={setSpacingMm} valueText={`${spacingMm} millimetres`} />
                    <Slider id={`${baseId}-d`} label="Tooth depth" value={depthMm} min={2} max={30} unit="mm" onChange={setDepthMm} valueText={`${depthMm} millimetres`} />
                    <Slider id={`${baseId}-n`} label="Tooth count N" value={teeth} min={5} max={100} unit="" onChange={setTeeth} valueText={`${teeth} teeth`} />

                    <div className="grid grid-cols-3 gap-2" aria-live="polite">
                        <Metric label="Tone" value={`${m.toneKHz.toFixed(1)} kHz`} />
                        <Metric label="Reduction" value={`${m.reductionDb.toFixed(1)} dB`} good />
                        <Metric label="Perceived" value={`${m.perceived.toFixed(0)}`} />
                    </div>
                    <div className={`rounded-lg border p-3 text-xs leading-5 ${tooLow ? 'border-[#e0b54a] bg-[rgba(224,181,74,0.08)]' : 'border-[var(--ath-line)] bg-[var(--ath-panel)]'}`}>
                        {tooLow
                            ? 'The tone still sits in the ear’s sensitive band. Reduce tooth spacing to push the frequency up, and add teeth so their shedding cancels.'
                            : 'Good: a high, de-correlated tone. Notice flow speed (U⁶) still dominates the baseline — slowing the blade beats any serration.'}
                    </div>
                </div>

                <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                    <AccessibleSvg viewBox="0 0 300 160" className="h-full w-full"
                        title="Serrated trailing edge"
                        desc={`A trailing edge with ${n} serration teeth at ${spacingMm} millimetre spacing in a ${speed} metre per second flow sheds a ${m.toneKHz.toFixed(1)} kilohertz tone, reduced by ${m.reductionDb.toFixed(1)} decibels.`}>
                        <rect x="30" y="30" width="240" height="30" fill="#cbd5e1" />
                        <path d={teethPath} fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />
                        {/* flow arrows */}
                        {Array.from({ length: 4 }, (_, i) => (
                            <line key={i} x1="6" y1={36 + i * 6} x2="26" y2={36 + i * 6} stroke="#10b981" strokeWidth="2" markerEnd={`url(#${baseId}-fa)`} />
                        ))}
                        <defs>
                            <marker id={`${baseId}-fa`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                            </marker>
                        </defs>
                        <text x="30" y="20" fill="#64748b" fontSize="10" fontWeight="bold">U = {speed} m/s</text>
                        <text x="150" y={edgeY + th + 18} fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">tone {m.toneKHz.toFixed(1)} kHz · −{m.reductionDb.toFixed(1)} dB</text>
                    </AccessibleSvg>
                </div>
            </div>
        </div>
    )
}

function Metric({ label, value, good }) {
    return (
        <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">{label}</p>
            <p className={`mt-0.5 text-sm font-black ${good ? 'text-[var(--ath-primary)]' : 'text-[var(--ath-text)]'}`}>{value}</p>
        </div>
    )
}
