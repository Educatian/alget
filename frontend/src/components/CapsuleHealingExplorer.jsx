import { useId, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * CapsuleHealingExplorer (bio-inspired/07/01 — Self-Healing Materials)
 * A propagating crack only heals if it ruptures embedded capsules. With volume
 * fraction φ and diameter d, capsules intersected by a crack plane scale as
 * φ·A/d² (smaller, denser capsules => more hits); triggering follows Poisson
 * P = 1 − e^(−hits). But high φ and large d weaken the host matrix — the trade.
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

export function healingModel({ fraction, diameterUm, crackSize }) {
    const dNorm = diameterUm / 150
    const numberDensity = Math.min(1, (fraction / Math.pow(dNorm, 3)) * 0.12)
    const expectedHits = (fraction * (0.5 + crackSize)) / (dNorm * dNorm) * 9
    const healingProb = 1 - Math.exp(-expectedHits)
    // Bigger capsules carry more agent (better fill) but fewer hits.
    const agentSufficiency = Math.min(1, 0.4 + 0.6 * dNorm)
    const healingEfficiency = healingProb * agentSufficiency
    // Matrix weakened by capsule loading and large defects.
    const matrixIntegrity = Math.max(0, 1 - 1.8 * fraction - 0.25 * Math.max(0, dNorm - 1))
    return { numberDensity, expectedHits, healingProb, healingEfficiency, matrixIntegrity }
}

export default function CapsuleHealingExplorer() {
    const baseId = useId()
    const [fraction, setF] = useState(0.1)
    const [diameterUm, setD] = useState(120)
    const [crackSize, setC] = useState(0.5)
    const m = healingModel({ fraction, diameterUm, crackSize })
    useSimTelemetry('bio-inspired/07/01', 'capsule-healing', { fraction, diameterUm, crackSize }, m.healingProb > 0.6 && m.matrixIntegrity > 0.55)
    const weak = m.matrixIntegrity < 0.55
    const unreliable = m.healingProb < 0.6

    // SVG: capsules scattered, a crack line crossing some of them.
    const seedCount = Math.min(60, Math.round(fraction * 220))
    const rPx = Math.max(2, diameterUm / 28)
    const dots = Array.from({ length: seedCount }, (_, i) => {
        const x = 24 + ((i * 53) % 200)
        const y = 24 + ((i * 89) % 150)
        const hit = Math.abs(y - 100) < rPx + 6
        return <circle key={i} cx={x} cy={y} r={rPx} fill={hit ? '#27624f' : '#9fb2ac'} opacity={hit ? 0.95 : 0.5} />
    })

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/healing.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Self-Healing Capsule Designer
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">hits ∝ φ·A / d² &nbsp;·&nbsp; trigger P = 1 − e^(−hits) &nbsp;·&nbsp; but φ weakens the matrix</p>
            </div>
            <SimModel src="/sim-art/models/healing.glb" alt="Self-healing polymer block 3D model" label="Self-healing polymer" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <Slider id={`${baseId}-f`} label="Capsule volume fraction φ" value={fraction} min={0.02} max={0.25} step={0.01} onChange={setF} />
                    <Slider id={`${baseId}-d`} label="Capsule diameter d" value={diameterUm} min={40} max={350} unit="µm" onChange={setD} />
                    <Slider id={`${baseId}-c`} label="Crack size" value={crackSize} min={0.1} max={1} step={0.01} onChange={setC} />
                    <div className="grid grid-cols-2 gap-2" aria-live="polite">
                        <Metric label="Trigger probability" value={`${Math.round(m.healingProb * 100)}%`} good={!unreliable} bad={unreliable} />
                        <Metric label="Healing efficiency" value={`${Math.round(m.healingEfficiency * 100)}%`} good />
                        <Metric label="Capsule density" value={`${Math.round(m.numberDensity * 100)}%`} />
                        <Metric label="Matrix integrity" value={`${Math.round(m.matrixIntegrity * 100)}%`} good={!weak} bad={weak} />
                    </div>
                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-xs leading-5">
                        {unreliable
                            ? 'Cracks may slip between capsules — triggering is unreliable. Use smaller, denser capsules (hits scale as 1/d²) to guarantee the crack ruptures one.'
                            : weak
                                ? 'Reliable healing, but you have loaded so many capsules the host matrix is weakened. Back off φ, or switch to a refillable vascular network for repeated healing.'
                                : 'Good balance: cracks reliably rupture capsules to release healing agent, while the matrix stays strong.'}
                    </div>
                </div>
                <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                    <AccessibleSvg viewBox="0 0 250 200" className="h-full w-full" title="Capsules and a crack"
                        desc={`Microcapsules at volume fraction ${fraction.toFixed(2)} with a crack crossing the plane; trigger probability ${Math.round(m.healingProb * 100)} percent.`}>
                        {dots}
                        <line x1="10" y1="100" x2="240" y2="100" stroke="#a33a2d" strokeWidth="2.5" strokeDasharray="6 3" />
                        <text x="14" y="94" fill="#a33a2d" fontSize="10" fontWeight="bold">crack plane</text>
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
