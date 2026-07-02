import { useId, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * RelativeDensityExplorer (bio-inspired/01/01 — Cellular Solids)
 * Gibson-Ashby scaling: relative density rho-bar is the master parameter.
 *   stiffness  E_ratio ≈ C · rho^2      (open-cell foam)
 *   strength   sig_ratio ≈ 0.3 · rho^1.5
 * The lesson: foams trade absolute stiffness for stiffness-to-WEIGHT; doubling
 * density quadruples stiffness (square law) but only doubles mass.
 */
const C_CLOSED_BONUS = 0.5 // closed cells add a membrane-stretching linear term

function Slider({ id, label, value, min, max, step = 0.01, unit, onChange }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{label}</label>
                <span className="text-xs font-bold text-[var(--ath-primary)]">{typeof value === 'number' ? value.toFixed(2) : value}{unit ? ` ${unit}` : ''}</span>
            </div>
            <input id={id} type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--ath-line)] accent-[var(--ath-primary)]" />
        </div>
    )
}

export function cellularModel({ density, closedFraction }) {
    const stiffness = Math.min(1, (density * density + C_CLOSED_BONUS * closedFraction * density) * 2.6)
    const strength = Math.min(1, 0.45 * Math.pow(density, 1.5) * (1 + 0.4 * closedFraction) * 2.2)
    const porosity = 1 - density
    const specificStiffness = Math.min(1, (stiffness / Math.max(0.05, density)) * 0.32)
    return { stiffness, strength, porosity, specificStiffness }
}

export default function RelativeDensityExplorer() {
    const baseId = useId()
    const [density, setDensity] = useState(0.3)
    const [closedFraction, setClosed] = useState(0.4)
    const m = cellularModel({ density, closedFraction })
    useSimTelemetry('bio-inspired/01/01', 'relative-density', { density, closedFraction }, m.specificStiffness > 0.6)

    // SVG: a grid of cells whose wall thickness grows with density.
    const n = 6
    const cell = 36
    const wall = 1 + density * 9
    const cells = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        cells.push(<rect key={`${r}-${c}`} x={20 + c * cell} y={14 + r * cell} width={cell} height={cell}
            fill="none" stroke="#27624f" strokeWidth={wall} />)
    }

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/density.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Relative-Density Trade-Off Explorer
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">E*/Es ≈ C·ρ̄² &nbsp;·&nbsp; σ*/σ_s ≈ 0.3·ρ̄^1.5 &nbsp;·&nbsp; stiffness-to-weight is the prize</p>
            </div>
            <SimModel src="/sim-art/models/foam.glb" alt="Aluminium open-cell foam 3D model" label="Aluminium foam" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <Slider id={`${baseId}-d`} label="Relative density ρ̄" value={density} min={0.05} max={0.7} onChange={setDensity} />
                    <Slider id={`${baseId}-c`} label="Closed-cell fraction" value={closedFraction} min={0} max={1} onChange={setClosed} />
                    <div className="grid grid-cols-2 gap-2" aria-live="polite">
                        <Metric label="Stiffness E*/Es" value={`${Math.round(m.stiffness * 100)}%`} good />
                        <Metric label="Strength" value={`${Math.round(m.strength * 100)}%`} good />
                        <Metric label="Porosity" value={`${Math.round(m.porosity * 100)}%`} />
                        <Metric label="Stiffness-to-weight" value={`${Math.round(m.specificStiffness * 100)}%`} good />
                    </div>
                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-xs leading-5">
                        {density > 0.55
                            ? 'Dense and stiff, but you have spent the foam advantage — it is nearly solid. Lighten it: the square law means a little density buys a lot of stiffness.'
                            : density < 0.12
                                ? 'Ultra-light and porous, but very compliant — E falls as ρ², so low density is soft. Add density (or closed cells) for load paths.'
                                : 'Good cellular regime: high porosity with usable stiffness-to-weight. Note doubling ρ̄ quadruples E but only doubles mass.'}
                    </div>
                </div>
                <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                    <AccessibleSvg viewBox="0 0 250 250" className="h-full w-full" title="Cellular solid"
                        desc={`A honeycomb cellular solid at relative density ${density.toFixed(2)} with wall thickness scaled accordingly.`}>
                        {cells}
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
