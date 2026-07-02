import { useEffect, useId, useRef, useState } from 'react'
import SimModel from './SimModel'
import { useSimTelemetry } from '../lib/simTelemetry'

/**
 * SwarmFlockingLab (bio-inspired/08/01 — Swarm Intelligence)
 * Reynolds boids: each agent applies three O(1) local rules — separation,
 * alignment, cohesion — within a sensing radius. No leader, no global plan;
 * coherent flocking emerges. Students tune the three weights and watch order
 * (velocity polarization) and collisions respond live.
 */
const N = 90
const W = 460
const H = 360

function Slider({ id, label, value, onChange }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{label}</label>
                <span className="text-xs font-bold text-[var(--ath-primary)]">{value.toFixed(2)}</span>
            </div>
            <input id={id} type="range" min={0} max={2} step={0.01} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--ath-line)] accent-[var(--ath-primary)]" />
        </div>
    )
}

export default function SwarmFlockingLab() {
    const baseId = useId()
    const canvasRef = useRef(null)
    const [sep, setSep] = useState(1.2)
    const [ali, setAli] = useState(1.0)
    const [coh, setCoh] = useState(0.9)
    const [radius, setRadius] = useState(0.6)
    const weights = useRef({ sep, ali, coh, radius })
    weights.current = { sep, ali, coh, radius }
    const [stats, setStats] = useState({ order: 0, collisions: 0 })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        // Deterministic-ish initial scatter (no Math.random dependency at import).
        const boids = Array.from({ length: N }, (_, i) => ({
            x: (i * 97) % W,
            y: (i * 57) % H,
            vx: Math.cos(i) * 1.2,
            vy: Math.sin(i * 1.3) * 1.2,
        }))
        let raf = 0
        let frame = 0

        const step = () => {
            const { sep, ali, coh, radius } = weights.current
            const R = 28 + radius * 70
            const sepR = 18
            let collisions = 0
            for (const b of boids) {
                let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0
                for (const o of boids) {
                    if (o === b) continue
                    const dx = o.x - b.x, dy = o.y - b.y
                    const d2 = dx * dx + dy * dy
                    if (d2 < R * R) {
                        n++
                        ax += o.vx; ay += o.vy
                        cx += o.x; cy += o.y
                        if (d2 < sepR * sepR) {
                            const d = Math.sqrt(d2) || 1
                            sx -= dx / d; sy -= dy / d
                            if (d2 < 100) collisions++
                        }
                    }
                }
                if (n > 0) {
                    b.vx += ((ax / n - b.vx) * 0.05) * ali
                    b.vy += ((ay / n - b.vy) * 0.05) * ali
                    b.vx += ((cx / n - b.x) * 0.0009) * coh
                    b.vy += ((cy / n - b.y) * 0.0009) * coh
                    b.vx += sx * 0.12 * sep
                    b.vy += sy * 0.12 * sep
                }
                const sp = Math.hypot(b.vx, b.vy) || 1
                const max = 2.4
                if (sp > max) { b.vx = (b.vx / sp) * max; b.vy = (b.vy / sp) * max }
                b.x = (b.x + b.vx + W) % W
                b.y = (b.y + b.vy + H) % H
            }

            ctx.fillStyle = '#0c0f14'
            ctx.fillRect(0, 0, W, H)
            ctx.fillStyle = '#2fae8e'
            let mvx = 0, mvy = 0
            for (const b of boids) {
                const sp = Math.hypot(b.vx, b.vy) || 1
                mvx += b.vx / sp; mvy += b.vy / sp
                ctx.beginPath()
                ctx.moveTo(b.x + (b.vx / sp) * 5, b.y + (b.vy / sp) * 5)
                ctx.lineTo(b.x - (b.vy / sp) * 2.5, b.y + (b.vx / sp) * 2.5)
                ctx.lineTo(b.x + (b.vy / sp) * 2.5, b.y - (b.vx / sp) * 2.5)
                ctx.closePath(); ctx.fill()
            }
            if (++frame % 20 === 0) {
                const order = Math.hypot(mvx, mvy) / N
                setStats({ order, collisions: Math.round(collisions / 2) })
            }
            raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [])

    const orderPct = Math.round(stats.order * 100)
    useSimTelemetry('bio-inspired/08/01', 'swarm', { sep, ali, coh, radius }, stats.order > 0.55 && stats.collisions <= 12)

    return (
        <div className="content-card my-10 overflow-hidden">
            <div className="bg-cover bg-center px-5 py-5" style={{ backgroundImage: "linear-gradient(rgba(12,15,20,0.55), rgba(12,15,20,0.85)), url(/sim-art/swarm.jpg)" }}>
                <p className="flex items-center gap-3 font-semibold text-white">
                    <span className="editorial-label text-[#7fe3c4]">SIM</span>
                    Swarm Flocking Lab
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">Reynolds boids: separation · alignment · cohesion — local rules, emergent order</p>
            </div>
            <SimModel src="/sim-art/models/starling.glb" alt="Starling 3D model" label="Starling" />
            <div className="grid gap-5 p-5 md:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-4">
                    <Slider id={`${baseId}-s`} label="Separation" value={sep} onChange={setSep} />
                    <Slider id={`${baseId}-a`} label="Alignment" value={ali} onChange={setAli} />
                    <Slider id={`${baseId}-c`} label="Cohesion" value={coh} onChange={setCoh} />
                    <Slider id={`${baseId}-r`} label="Sensing radius" value={radius} onChange={setRadius} />
                    <div className="grid grid-cols-2 gap-2" aria-live="polite">
                        <Metric label="Order (polarization)" value={`${orderPct}%`} good={orderPct > 55} />
                        <Metric label="Near-collisions" value={`${stats.collisions}`} bad={stats.collisions > 12} />
                    </div>
                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-xs leading-5">
                        {ali < 0.3 && coh < 0.3
                            ? 'Weak alignment + cohesion: the swarm scatters — no global order from purely repulsive agents.'
                            : sep < 0.3
                                ? 'Too little separation: agents clump and collide. A small repulsive term keeps the flock spaced.'
                                : 'Balanced: order emerges with few collisions — yet no agent follows a leader or a plan. That is stigmergy-free flocking.'}
                    </div>
                </div>
                <div className="rounded-lg border border-[var(--ath-line)] bg-[#0c0f14] flex items-center justify-center p-2">
                    <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-md"
                        role="img" aria-label="Live boid flocking simulation responding to the separation, alignment, and cohesion weights." />
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
