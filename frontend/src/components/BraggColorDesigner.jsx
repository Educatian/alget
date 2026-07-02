import { useId, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * BraggColorDesigner (bio-inspired/05/01 — Morpho Structural Color)
 * Multilayer interference peak:  λ_peak = 2(n_c·t_c + n_a·t_a).
 * Tune nm-scale layer thicknesses/index to hit a target color; tilt the viewing
 * angle and the peak blue-shifts (iridescence) — color from structure, not pigment.
 */
function Slider({ id, label, value, min, max, step = 1, unit, onChange }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{label}</label>
                <span className="text-xs font-bold text-[var(--ath-primary)]">{value}{unit ? ` ${unit}` : ''}</span>
            </div>
            <input id={id} type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--ath-line)] accent-[var(--ath-primary)]" />
        </div>
    )
}

export function braggModel({ cuticleNm, airNm, cuticleIndex, viewAngle }) {
    const peak = 2 * (cuticleIndex * cuticleNm + 1.0 * airNm)
    const observed = peak * Math.cos((viewAngle * Math.PI) / 180 * 0.62) // blue-shift with tilt
    return { peak, observed, shift: peak - observed }
}

// Approximate visible-wavelength (nm) -> sRGB.
export function wavelengthToRgb(nm) {
    let r = 0, g = 0, b = 0
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1 }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1 }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20 }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1 }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65 }
    else if (nm <= 780) { r = 1 }
    const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (780 - nm) / 80 : 1
    const c = (x) => Math.round(255 * Math.max(0, Math.min(1, x * f)) ** 0.8)
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`
}

export default function BraggColorDesigner() {
    const baseId = useId()
    const [cuticleNm, setCut] = useState(70)
    const [airNm, setAir] = useState(120)
    const [cuticleIndex, setIdx] = useState(1.56)
    const [viewAngle, setView] = useState(0)
    const m = braggModel({ cuticleNm, airNm, cuticleIndex, viewAngle })
    useSimTelemetry('bio-inspired/05/01', 'bragg', { cuticleNm, airNm, cuticleIndex, viewAngle }, m.peak >= 430 && m.peak <= 480)
    const color = wavelengthToRgb(m.observed)
    const peakColor = wavelengthToRgb(m.peak)

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/bragg.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Structural-Color Multilayer Designer
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">λ_peak = 2(n_c·t_c + n_a·t_a) &nbsp;·&nbsp; tilt → iridescent blue-shift</p>
            </div>
            <SimModel src="/sim-art/models/butterfly.glb" alt="Morpho butterfly 3D model" label="Morpho" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <Slider id={`${baseId}-tc`} label="Cuticle thickness t_c" value={cuticleNm} min={40} max={160} unit="nm" onChange={setCut} />
                    <Slider id={`${baseId}-ta`} label="Air gap t_a" value={airNm} min={40} max={200} unit="nm" onChange={setAir} />
                    <Slider id={`${baseId}-n`} label="Cuticle index n_c" value={cuticleIndex} min={1.3} max={1.9} step={0.01} unit="" onChange={setIdx} />
                    <Slider id={`${baseId}-v`} label="Viewing angle" value={viewAngle} min={0} max={70} unit="°" onChange={setView} />
                    <div className="grid grid-cols-2 gap-2" aria-live="polite">
                        <Metric label="Peak λ" value={`${Math.round(m.peak)} nm`} />
                        <Metric label="Seen at angle" value={`${Math.round(m.observed)} nm`} />
                    </div>
                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-xs leading-5">
                        {m.peak < 450 ? 'Blue/violet — the Morpho regime. ' : m.peak < 560 ? 'Green/cyan structural color. ' : m.peak < 620 ? 'Yellow/orange. ' : 'Red/near-IR — long-wavelength stack. '}
                        Tilt your view: the peak shifts {Math.round(m.shift)} nm bluer at {viewAngle}°, the iridescence no pigment can fake.
                    </div>
                </div>
                <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                    <AccessibleSvg viewBox="0 0 250 200" className="h-full w-full" title="Structural color swatch"
                        desc={`A multilayer stack reflecting peak wavelength ${Math.round(m.peak)} nanometres, seen at ${Math.round(m.observed)} nanometres at ${viewAngle} degrees.`}>
                        <rect x="20" y="14" width="120" height="172" fill={color} />
                        <text x="80" y="180" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">at {viewAngle}°</text>
                        {/* layer stack */}
                        {Array.from({ length: 5 }, (_, i) => (
                            <g key={i}>
                                <rect x="160" y={20 + i * 30} width="70" height={Math.max(4, cuticleNm / 10)} fill={peakColor} opacity="0.8" />
                                <rect x="160" y={20 + i * 30 + Math.max(4, cuticleNm / 10)} width="70" height={Math.max(3, airNm / 14)} fill="#e5e7eb" />
                            </g>
                        ))}
                        <text x="195" y="14" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">stack</text>
                    </AccessibleSvg>
                </div>
            </div>
        </div>
    )
}

function Metric({ label, value }) {
    return (
        <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">{label}</p>
            <p className="mt-0.5 text-sm font-black text-[var(--ath-text)]">{value}</p>
        </div>
    )
}
