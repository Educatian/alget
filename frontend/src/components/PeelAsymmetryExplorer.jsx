import { useId, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * PeelAsymmetryExplorer (bio-inspired/01/03 — Directional Adhesion)
 * Kendall peel:  F = G·w / (1 − cos θ).
 * Near-zero peel angle (shear drag) gives enormous hold; a steep angle releases
 * easily. The grip(5°)→release(90°) ratio ≈ (1−cos90)/(1−cos5) ≈ 260× — the
 * gecko's "switchable" adhesion, independent of G and w.
 */
const deg = (d) => (d * Math.PI) / 180

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

export function peelModel({ angleDeg, workAdhesion, width }) {
    const G = 0.2 + workAdhesion // relative work of adhesion
    const w = 0.2 + width
    const force = (G * w) / (1 - Math.cos(deg(Math.max(2, angleDeg))))
    const forceAt5 = (G * w) / (1 - Math.cos(deg(5)))
    const forceAt90 = (G * w) / (1 - Math.cos(deg(90)))
    const gripToRelease = force / forceAt90 // >1 means stronger than the 90° release
    const normalized = Math.min(1, force / forceAt5)
    return { force, forceAt5, forceAt90, gripToRelease, normalized }
}

export default function PeelAsymmetryExplorer() {
    const baseId = useId()
    const [angleDeg, setAngle] = useState(20)
    const [workAdhesion, setG] = useState(0.6)
    const [width, setW] = useState(0.6)
    const m = peelModel({ angleDeg, workAdhesion, width })
    const grip = angleDeg <= 25
    useSimTelemetry('bio-inspired/01/03', 'peel', { angleDeg, workAdhesion, width }, grip && m.normalized > 0.5)

    // SVG: a tape lifting off a surface at the chosen angle.
    const ax = 60, ay = 150
    const len = 120
    const tx = ax + len * Math.cos(deg(angleDeg))
    const ty = ay - len * Math.sin(deg(angleDeg))

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/peel.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Directional Adhesion — Peel-Angle Switch
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">F = G·w / (1 − cos θ) &nbsp;·&nbsp; grip(5°) → release(90°) ≈ 260×</p>
            </div>
            <SimModel src="/sim-art/models/gecko.glb" alt="Gecko 3D model" label="Gecko" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <Slider id={`${baseId}-a`} label="Peel angle θ" value={angleDeg} min={5} max={150} unit="°" onChange={setAngle} />
                    <Slider id={`${baseId}-g`} label="Work of adhesion G" value={workAdhesion} min={0} max={1} step={0.01} onChange={setG} />
                    <Slider id={`${baseId}-w`} label="Contact width w" value={width} min={0} max={1} step={0.01} onChange={setW} />
                    <div className="grid grid-cols-3 gap-2" aria-live="polite">
                        <Metric label="Hold force" value={`${Math.round(m.normalized * 100)}%`} good={grip} />
                        <Metric label="vs 90° release" value={`${m.gripToRelease.toFixed(1)}×`} />
                        <Metric label="Mode" value={grip ? 'GRIP' : 'release'} good={grip} />
                    </div>
                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-xs leading-5">
                        {grip
                            ? 'Shear-dominant engagement: a shallow angle multiplies the hold by 1/(1−cos θ). This is how a gecko hangs from one toe — and how it stays stuck without glue.'
                            : 'Peel-dominant release: raising the angle collapses the force. The same pad detaches almost for free — switchable adhesion from geometry alone.'}
                    </div>
                </div>
                <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                    <AccessibleSvg viewBox="0 0 250 200" className="h-full w-full" title="Peeling tape"
                        desc={`Adhesive tape peeling at ${angleDeg} degrees, hold force ${Math.round(m.normalized * 100)} percent of the shallow-angle maximum.`}>
                        <rect x="20" y="150" width="210" height="20" fill="#cbd5e1" />
                        <line x1="20" y1={ay} x2={ax} y2={ay} stroke="#27624f" strokeWidth="6" />
                        <line x1={ax} y1={ay} x2={tx} y2={ty} stroke={grip ? '#27624f' : '#a33a2d'} strokeWidth="6" strokeLinecap="round" />
                        <path d={`M ${ax} ${ay - 22} A 22 22 0 0 0 ${ax + 22 * Math.cos(deg(angleDeg))} ${ay - 22 * Math.sin(deg(angleDeg))}`} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
                        <text x={ax + 26} y={ay - 8} fill="#64748b" fontSize="11" fontWeight="bold">θ = {angleDeg}°</text>
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
