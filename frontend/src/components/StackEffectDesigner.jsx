import { useId, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * StackEffectDesigner (bio-inspired/06/01 — Termite-Mound Thermal Regulation)
 * --------------------------------------------------------------------------
 * Passive buoyancy ventilation, the Eastgate / termite-mound principle:
 *   Stack pressure   ΔP = ρ·g·h·(T_i − T_o)/T_i      (T in kelvin)
 *   Vent velocity    v  = Cd·√(2ΔP/ρ)                  (Cd ≈ 0.65)
 *   Volume flow      Q  = v·A   →   ACH = Q·3600 / V_room
 *   Thermal battery  E  = m·c·ΔT_swing                 (c ≈ 840 J/kg·K)
 *
 * Misconception surfaced: "make the vents bigger." Without a temperature
 * difference AND height there is no driving pressure at all (ΔP → 0), and night
 * comfort comes from stored thermal mass, not airflow.
 */

const RHO = 1.2 // kg/m³
const G = 9.81
const CD = 0.65
const C_MASS = 840 // J/kg·K (earth/concrete)
const V_ROOM = 300 // m³ reference space
const COMFORT_ACH = 6

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

export function stackModel({ height, tInC, tOutC, ventArea, massKg, swingC }) {
    const tIn = tInC + 273.15
    const tOut = tOutC + 273.15
    const dT = tIn - tOut
    // Only a warmer interior drives upward buoyancy ventilation.
    const deltaP = dT > 0 ? (RHO * G * height * dT) / tIn : 0
    const velocity = Math.sqrt((2 * Math.max(0, deltaP)) / RHO) * CD
    const flow = velocity * ventArea // m³/s
    const ach = (flow * 3600) / V_ROOM
    const storageMJ = (massKg * C_MASS * swingC) / 1e6
    return { deltaP, velocity, flow, ach, storageMJ, dT }
}

export default function StackEffectDesigner() {
    const baseId = useId()
    const [height, setHeight] = useState(6)
    const [tInC, setTInC] = useState(34)
    const [tOutC, setTOutC] = useState(26)
    const [ventArea, setVentArea] = useState(1.2)
    const [massKg, setMassKg] = useState(12000)
    const swingC = 12 // daily outdoor swing buffered by the mass

    const m = stackModel({ height, tInC, tOutC, ventArea, massKg, swingC })
    useSimTelemetry('bio-inspired/06/01', 'stack-effect', { height, tInC, tOutC, ventArea, massKg }, m.ach >= 6)
    const weak = m.ach < COMFORT_ACH
    const noDrive = m.dT <= 0

    // SVG: mound cross-section, hot air rising, vent arrows scaled by velocity.
    const arrowLen = Math.min(34, 6 + m.velocity * 18)

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/stack.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Stack-Effect Ventilation Designer
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">
                    ΔP = ρ·g·h·(T_i−T_o)/T_i &nbsp;·&nbsp; ACH = Q·3600/V &nbsp;·&nbsp; thermal battery E = m·c·ΔT
                </p>
            </div>
            <SimModel src="/sim-art/models/termite.glb" alt="Termite mound 3D model" label="Termite mound" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <Slider id={`${baseId}-h`} label="Stack height h" value={height} min={1} max={15} unit="m" onChange={setHeight} valueText={`${height} metres`} />
                    <Slider id={`${baseId}-ti`} label="Interior temp T_i" value={tInC} min={24} max={44} unit="°C" onChange={setTInC} valueText={`${tInC} celsius`} />
                    <Slider id={`${baseId}-to`} label="Exterior temp T_o" value={tOutC} min={10} max={42} unit="°C" onChange={setTOutC} valueText={`${tOutC} celsius`} />
                    <Slider id={`${baseId}-a`} label="Vent area A" value={ventArea} min={0.2} max={4} step={0.1} unit="m²" onChange={setVentArea} valueText={`${ventArea} square metres`} />
                    <Slider id={`${baseId}-m`} label="Thermal mass" value={massKg} min={1000} max={50000} step={500} unit="kg" onChange={setMassKg} valueText={`${massKg} kilograms`} />

                    <div className="grid grid-cols-2 gap-2" aria-live="polite">
                        <Metric label="Stack ΔP" value={`${m.deltaP.toFixed(2)} Pa`} />
                        <Metric label="Airflow" value={`${m.velocity.toFixed(2)} m/s`} />
                        <Metric label="Air changes" value={`${m.ach.toFixed(1)} ACH`} good={!weak} bad={weak} />
                        <Metric label="Thermal store" value={`${m.storageMJ.toFixed(0)} MJ`} />
                    </div>
                    <div className={`rounded-lg border p-3 text-xs leading-5 ${noDrive || weak ? 'border-[#e0b54a] bg-[rgba(224,181,74,0.08)]' : 'border-[var(--ath-line)] bg-[var(--ath-panel)]'}`}>
                        {noDrive
                            ? 'No buoyancy drive: the interior is not warmer than outside, so ΔP → 0. Bigger vents do nothing without a temperature difference.'
                            : weak
                                ? `Only ${m.ach.toFixed(1)} ACH (need ≈ ${COMFORT_ACH}). Raise the stack height or the day-night ΔT — and lean on the ${m.storageMJ.toFixed(0)} MJ thermal battery to ride out the hot afternoon.`
                                : `Comfortable: ${m.ach.toFixed(1)} ACH from buoyancy alone, with ${m.storageMJ.toFixed(0)} MJ of stored mass buffering the daily swing — like the Eastgate Centre.`}
                    </div>
                </div>

                <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                    <AccessibleSvg viewBox="0 0 300 200" className="h-full w-full"
                        title="Termite-mound stack ventilation"
                        desc={`A ${height} metre stack with interior at ${tInC} and exterior at ${tOutC} celsius produces ${m.deltaP.toFixed(2)} pascals of buoyancy pressure, giving ${m.ach.toFixed(1)} air changes per hour.`}>
                        {/* ground + mound */}
                        <rect x="0" y="170" width="300" height="30" fill="#d6ccb8" />
                        <path d="M 90 170 L 150 30 L 210 170 Z" fill="#caa472" stroke="#a8865a" strokeWidth="2" />
                        {/* chimney channel */}
                        <rect x="140" y="40" width="20" height="130" fill="#efe7d6" opacity="0.85" />
                        {/* thermal-mass band scaled by mass */}
                        <rect x="90" y="150" width="120" height={6 + (massKg / 50000) * 16} fill="#b07a4a" opacity="0.7" />
                        {/* rising hot air arrows */}
                        {!noDrive && Array.from({ length: 3 }, (_, i) => (
                            <line key={i} x1={150} y1={150 - i * 8} x2={150} y2={150 - i * 8 - arrowLen} stroke="#ef4444" strokeWidth="3" markerEnd={`url(#${baseId}-up)`} />
                        ))}
                        {/* intake */}
                        {!noDrive && <line x1="70" y1="160" x2={95} y2="160" stroke="#3b82f6" strokeWidth="3" markerEnd={`url(#${baseId}-in)`} />}
                        <defs>
                            <marker id={`${baseId}-up`} markerWidth="9" markerHeight="7" refX="4.5" refY="6" orient="auto"><polygon points="0 7, 4.5 0, 9 7" fill="#ef4444" /></marker>
                            <marker id={`${baseId}-in`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#3b82f6" /></marker>
                        </defs>
                        <text x="150" y="24" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">warm air out</text>
                        <text x="40" y="156" fill="#3b82f6" fontSize="9" fontWeight="bold">cool in</text>
                        <text x="216" y="120" fill="#a8865a" fontSize="9" fontWeight="bold">mass</text>
                    </AccessibleSvg>
                </div>
            </div>
        </div>
    )
}

function Metric({ label, value, good, bad }) {
    const color = good ? 'text-[var(--ath-primary)]' : bad ? 'text-[#a33a2d]' : 'text-[var(--ath-text)]'
    return (
        <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">{label}</p>
            <p className={`mt-0.5 text-sm font-black ${color}`}>{value}</p>
        </div>
    )
}
