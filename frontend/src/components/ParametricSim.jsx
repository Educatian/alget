import { useId, useMemo, useState } from 'react'
import { AccessibleSvg } from './AccessibleSvg'

/**
 * ParametricSim
 * -------------
 * A genuinely interactive, parameterized micro-simulation that recomputes a
 * physical quantity and redraws an SVG live as the learner drags labeled
 * sliders. Used by DynamicScenario for engineering cases (torque on a powered
 * joint, statics of a roof truss, polar kinematics of a tracked drone).
 *
 * Accessibility:
 *  - every <input type="range"> has an associated <label> and aria-valuetext
 *  - the computed result lives in an aria-live="polite" region so screen
 *    readers announce the new value when a slider changes
 *  - sliders are natively keyboard operable (arrow keys / Home / End)
 *  - the SVG carries a role="img" name + a description that reflects the
 *    current parameter values
 *
 * Each model below is a pure function of its parameters; the component holds
 * only the live slider state.
 */

function Slider({ id, label, value, min, max, step = 1, unit, onChange, valueText }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                    {label}
                </label>
                <span className="text-xs font-bold text-[var(--ath-primary)]">
                    {value}
                    {unit ? ` ${unit}` : ''}
                </span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                aria-valuetext={valueText}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--ath-line)] accent-[var(--ath-primary)]"
            />
        </div>
    )
}

// --- Torque on a powered joint: tau = r * F * sin(theta) ----------------------
function TorqueModel() {
    const baseId = useId()
    const [force, setForce] = useState(60)
    const [armCm, setArmCm] = useState(8)
    const [angle, setAngle] = useState(75)

    const angleRad = (angle * Math.PI) / 180
    const arm = armCm / 100 // metres
    const torque = arm * force * Math.sin(angleRad)
    const torqueText = `${torque.toFixed(1)} newton metres`

    // Geometry for the wrench/arm drawing.
    const cx = 60
    const cy = 130
    const pxPerCm = 18
    const armPx = armCm * pxPerCm
    const endX = cx + armPx
    const endY = cy
    const fLen = 18 + (force / 100) * 46
    const fx = endX + fLen * Math.cos(angleRad)
    const fy = endY - fLen * Math.sin(angleRad)

    return (
        <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-5">
                <Slider
                    id={`${baseId}-force`}
                    label="Actuator force"
                    value={force}
                    min={10}
                    max={100}
                    unit="N"
                    onChange={setForce}
                    valueText={`${force} newtons`}
                />
                <Slider
                    id={`${baseId}-arm`}
                    label="Moment arm"
                    value={armCm}
                    min={2}
                    max={14}
                    unit="cm"
                    onChange={setArmCm}
                    valueText={`${armCm} centimetres`}
                />
                <Slider
                    id={`${baseId}-angle`}
                    label="Pull angle θ"
                    value={angle}
                    min={0}
                    max={180}
                    unit="°"
                    onChange={setAngle}
                    valueText={`${angle} degrees`}
                />
                <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3" aria-live="polite">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Generated torque</p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-[var(--ath-text)]">
                        {torque.toFixed(1)} <span className="text-sm font-semibold text-[var(--ath-muted)]">N·m</span>
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">τ = r · F · sin θ. Force alone is not enough; the arm and angle set the leverage.</p>
                </div>
            </div>

            <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                <AccessibleSvg
                    viewBox="0 0 300 200"
                    className="h-full w-full"
                    title="Torque on a powered joint"
                    desc={`A motorised arm of ${armCm} centimetres pivots at a joint. A force of ${force} newtons is applied at the tip at ${angle} degrees to the arm, producing ${torqueText} of torque.`}
                >
                    <defs>
                        <marker id={`${baseId}-fhead`} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                            <polygon points="0 0, 9 3.5, 0 7" fill="#ef4444" />
                        </marker>
                        <marker id={`${baseId}-thead`} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                            <polygon points="0 0, 9 3.5, 0 7" fill="#10b981" />
                        </marker>
                    </defs>
                    {Math.abs(torque) > 0.2 && (
                        <path
                            d={`M ${cx},${cy - 30} A 30 30 0 0 1 ${cx + 30},${cy}`}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            strokeDasharray="4 2"
                            markerEnd={`url(#${baseId}-thead)`}
                            opacity={Math.min(1, Math.abs(torque) / 10 + 0.25)}
                        />
                    )}
                    <path d={`M ${cx} ${cy - 7} L ${endX} ${cy - 5} L ${endX} ${cy + 5} L ${cx} ${cy + 7} Z`} fill="#cbd5e1" stroke="#94a3b8" />
                    <circle cx={cx} cy={cy} r="11" fill="#475569" />
                    <circle cx={cx} cy={cy} r="5" fill="#94a3b8" />
                    <line x1={endX} y1={cy} x2={fx} y2={fy} stroke="#ef4444" strokeWidth="4" markerEnd={`url(#${baseId}-fhead)`} />
                    <text x={fx + 4} y={fy - 4} fill="#ef4444" fontSize="11" fontWeight="bold">F</text>
                    <text x={cx + armPx / 2} y={cy + 20} fill="#64748b" fontSize="11" fontWeight="bold">r</text>
                    <text x={cx + 6} y={cy - 18} fill="#10b981" fontSize="11" fontWeight="bold">τ</text>
                </AccessibleSvg>
            </div>
        </div>
    )
}

// --- Statics: simply-supported truss, central point load ----------------------
// Reactions R = W/2 each. Top-chord compression force scales as the load over
// the rise angle: C = (W/2) / sin(pitch). Demonstrates why steeper pitch lowers
// member force and why support reactions come first.
function TrussModel() {
    const baseId = useId()
    const [loadKn, setLoadKn] = useState(40)
    const [pitchDeg, setPitchDeg] = useState(30)
    const [spanM, setSpanM] = useState(12)

    const pitchRad = (pitchDeg * Math.PI) / 180
    const reaction = loadKn / 2
    const compression = reaction / Math.max(Math.sin(pitchRad), 0.08)
    const resultText = `Each support reaction is ${reaction.toFixed(1)} kilonewtons; top-chord compression is ${compression.toFixed(1)} kilonewtons.`

    // Drawing: apex height scales with pitch and half-span.
    const leftX = 40
    const rightX = 260
    const baseY = 150
    const midX = (leftX + rightX) / 2
    const halfSpanPx = (rightX - leftX) / 2
    const apexY = baseY - Math.min(110, halfSpanPx * Math.tan(pitchRad))
    const loadY = apexY - 12 - (loadKn / 100) * 24

    return (
        <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-5">
                <Slider
                    id={`${baseId}-load`}
                    label="Snow point load W"
                    value={loadKn}
                    min={10}
                    max={100}
                    unit="kN"
                    onChange={setLoadKn}
                    valueText={`${loadKn} kilonewtons`}
                />
                <Slider
                    id={`${baseId}-pitch`}
                    label="Roof pitch"
                    value={pitchDeg}
                    min={10}
                    max={60}
                    unit="°"
                    onChange={setPitchDeg}
                    valueText={`${pitchDeg} degrees`}
                />
                <Slider
                    id={`${baseId}-span`}
                    label="Span"
                    value={spanM}
                    min={6}
                    max={20}
                    unit="m"
                    onChange={setSpanM}
                    valueText={`${spanM} metres`}
                />
                <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3" aria-live="polite">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Solved forces</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">
                        Reaction R = <span className="text-[var(--ath-primary)]">{reaction.toFixed(1)} kN</span> each
                    </p>
                    <p className="text-sm font-semibold text-[var(--ath-text)]">
                        Top chord = <span className="text-[#ef4444]">{compression.toFixed(1)} kN</span> compression
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">A flatter pitch raises the chord force sharply. Reactions are solved before any member.</p>
                </div>
            </div>

            <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                <AccessibleSvg
                    viewBox="0 0 300 200"
                    className="h-full w-full"
                    title="Roof truss free-body diagram"
                    desc={`A simply-supported triangular roof truss spanning ${spanM} metres at a ${pitchDeg} degree pitch carries a ${loadKn} kilonewton point load at the apex. ${resultText}`}
                >
                    <line x1={leftX} y1={baseY} x2={rightX} y2={baseY} stroke="#475569" strokeWidth="3" />
                    <line x1={leftX} y1={baseY} x2={midX} y2={apexY} stroke="#ef4444" strokeWidth="3" />
                    <line x1={rightX} y1={baseY} x2={midX} y2={apexY} stroke="#ef4444" strokeWidth="3" />
                    <line x1={midX} y1={apexY} x2={midX} y2={baseY} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 3" />
                    {/* Supports */}
                    <polygon points={`${leftX},${baseY} ${leftX - 8},${baseY + 12} ${leftX + 8},${baseY + 12}`} fill="#94a3b8" />
                    <polygon points={`${rightX},${baseY} ${rightX - 8},${baseY + 12} ${rightX + 8},${baseY + 12}`} fill="#94a3b8" />
                    {/* Load arrow at apex */}
                    <defs>
                        <marker id={`${baseId}-load-head`} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                            <polygon points="0 0, 9 3.5, 0 7" fill="#0f172a" />
                        </marker>
                    </defs>
                    <line x1={midX} y1={loadY} x2={midX} y2={apexY - 2} stroke="#0f172a" strokeWidth="3" markerEnd={`url(#${baseId}-load-head)`} />
                    <text x={midX + 6} y={loadY + 6} fill="#0f172a" fontSize="11" fontWeight="bold">W</text>
                    <text x={leftX - 4} y={baseY + 26} fill="#64748b" fontSize="10" fontWeight="bold">R</text>
                    <text x={rightX - 4} y={baseY + 26} fill="#64748b" fontSize="10" fontWeight="bold">R</text>
                    <text x={midX - 60} y={apexY + 28} fill="#ef4444" fontSize="10" fontWeight="bold">compression</text>
                </AccessibleSvg>
            </div>
        </div>
    )
}

// --- Polar kinematics of a tracked drone --------------------------------------
// Radial/transverse components: v_r = r-dot, v_theta = r * theta-dot.
// a_r = r-ddot - r*theta-dot^2 (centripetal), a_theta = r*theta-ddot + 2*r-dot*theta-dot (Coriolis).
function PolarModel() {
    const baseId = useId()
    const [range, setRange] = useState(120) // metres
    const [rangeRate, setRangeRate] = useState(8) // m/s
    const [angularRate, setAngularRate] = useState(40) // deg/s

    const thetaDot = (angularRate * Math.PI) / 180 // rad/s
    const vR = rangeRate
    const vTheta = range * thetaDot
    const speed = Math.sqrt(vR * vR + vTheta * vTheta)
    const aCentripetal = range * thetaDot * thetaDot
    const aCoriolis = 2 * rangeRate * thetaDot
    const resultText = `Radial speed ${vR.toFixed(1)} metres per second, transverse speed ${vTheta.toFixed(1)} metres per second, total speed ${speed.toFixed(1)} metres per second. Centripetal term ${aCentripetal.toFixed(2)}, Coriolis term ${aCoriolis.toFixed(2)} metres per second squared.`

    // Drawing: station at origin, drone at current bearing (fixed display angle).
    const ox = 50
    const oy = 150
    const bearing = (50 * Math.PI) / 180
    const rPx = 30 + (range / 200) * 150
    const dx = ox + rPx * Math.cos(bearing)
    const dy = oy - rPx * Math.sin(bearing)
    // unit vectors
    const erx = Math.cos(bearing)
    const ery = -Math.sin(bearing)
    const etx = -Math.sin(bearing)
    const ety = -Math.cos(bearing)
    const vrLen = 8 + Math.min(40, Math.abs(vR) * 3)
    const vtLen = 8 + Math.min(50, Math.abs(vTheta) * 0.5)

    return (
        <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-5">
                <Slider
                    id={`${baseId}-range`}
                    label="Range r"
                    value={range}
                    min={40}
                    max={200}
                    unit="m"
                    onChange={setRange}
                    valueText={`${range} metres`}
                />
                <Slider
                    id={`${baseId}-rrate`}
                    label="Range rate ṙ"
                    value={rangeRate}
                    min={-15}
                    max={15}
                    unit="m/s"
                    onChange={setRangeRate}
                    valueText={`${rangeRate} metres per second`}
                />
                <Slider
                    id={`${baseId}-thetadot`}
                    label="Bearing rate θ̇"
                    value={angularRate}
                    min={0}
                    max={90}
                    unit="°/s"
                    onChange={setAngularRate}
                    valueText={`${angularRate} degrees per second`}
                />
                <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3" aria-live="polite">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Polar components</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">
                        v = <span className="text-[var(--ath-primary)]">{speed.toFixed(1)} m/s</span>
                        <span className="text-xs font-normal text-[var(--ath-muted)]"> ( v_r {vR.toFixed(1)}, v_θ {vTheta.toFixed(1)} )</span>
                    </p>
                    <p className="text-xs leading-5 text-[var(--ath-muted)]">
                        Centripetal r·θ̇² = {aCentripetal.toFixed(2)} m/s²; Coriolis 2ṙθ̇ = {aCoriolis.toFixed(2)} m/s². Drop these and the acceleration is wrong.
                    </p>
                </div>
            </div>

            <div className="rounded-lg border border-[var(--ath-line)] bg-white">
                <AccessibleSvg
                    viewBox="0 0 300 200"
                    className="h-full w-full"
                    title="Polar velocity of a tracked drone"
                    desc={`A radar station tracks a drone at range ${range} metres. ${resultText}`}
                >
                    <defs>
                        <marker id={`${baseId}-vr`} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                            <polygon points="0 0, 9 3.5, 0 7" fill="#10b981" />
                        </marker>
                        <marker id={`${baseId}-vt`} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                            <polygon points="0 0, 9 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                    </defs>
                    {/* range line */}
                    <line x1={ox} y1={oy} x2={dx} y2={dy} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />
                    {/* station */}
                    <circle cx={ox} cy={oy} r="6" fill="#475569" />
                    <text x={ox - 4} y={oy + 18} fill="#64748b" fontSize="10" fontWeight="bold">radar</text>
                    {/* drone */}
                    <circle cx={dx} cy={dy} r="7" fill="#0f172a" />
                    {/* radial velocity (green) */}
                    <line x1={dx} y1={dy} x2={dx + erx * vrLen * Math.sign(vR || 1)} y2={dy + ery * vrLen * Math.sign(vR || 1)} stroke="#10b981" strokeWidth="3" markerEnd={`url(#${baseId}-vr)`} />
                    {/* transverse velocity (blue) */}
                    <line x1={dx} y1={dy} x2={dx + etx * vtLen} y2={dy + ety * vtLen} stroke="#3b82f6" strokeWidth="3" markerEnd={`url(#${baseId}-vt)`} />
                    <text x={dx + erx * vrLen + 4} y={dy + ery * vrLen} fill="#10b981" fontSize="10" fontWeight="bold">v_r</text>
                    <text x={dx + etx * vtLen + 4} y={dy + ety * vtLen} fill="#3b82f6" fontSize="10" fontWeight="bold">v_θ</text>
                    <text x={(ox + dx) / 2} y={(oy + dy) / 2 - 4} fill="#64748b" fontSize="10" fontWeight="bold">r</text>
                </AccessibleSvg>
            </div>
        </div>
    )
}

const MODELS = {
    torque: { Model: TorqueModel, label: 'Torque sandbox', hint: 'Drag force, arm, and angle to see torque change live.' },
    truss: { Model: TrussModel, label: 'Truss force sandbox', hint: 'Change the load and pitch to recompute reactions and member force.' },
    polar: { Model: PolarModel, label: 'Polar motion sandbox', hint: 'Change range and rates to expose the rotating-frame terms.' },
}

export default function ParametricSim({ kind }) {
    const entry = useMemo(() => MODELS[kind], [kind])
    if (!entry) return null
    const { Model, label, hint } = entry

    return (
        <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{label}</p>
            <p className="mb-3 mt-1 text-xs leading-5 text-[var(--ath-muted)]">{hint}</p>
            <Model />
        </div>
    )
}
