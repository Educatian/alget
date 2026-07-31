import React, { useState, useEffect } from 'react';
import { Pause, Play } from 'lucide-react';
import { AccessibleSvg } from './AccessibleSvg';

export const KinematicsDiagram = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [time, setTime] = useState(0);

    // Toggle simulation
    useEffect(() => {
        let interval;
        if (isPlaying) {
            interval = setInterval(() => {
                setTime((t) => (t + 1) % 100); // Loop from 0 to 99
            }, 50);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    // When paused, the learner can scrub the trajectory manually with a slider.
    // This keeps the simulation interactive without requiring the animation to
    // run, and makes every state keyboard-reachable (the range input responds
    // to arrow keys / Home / End).
    const [scrub, setScrub] = useState(0);
    const displayedTime = isPlaying ? time : scrub;
    const showParticle = isPlaying || scrub > 0;

    // Path mathematics (Projectile motion arc)
    // Formula for simple parabolic motion: y = a(x - h)^2 + k
    // Let's scale t(0 to 100) to map to x(50 to 350)
    const tScaled = displayedTime / 100;
    const x = 50 + tScaled * 300;

    // Parabola passing through (50, 100), peak at (200, 20), down at (350, 100)
    // h = 200, k = 20
    // 100 = a(50 - 200)^2 + 20 => 80 = a(-150)^2 => a = 80 / 22500 = 0.00355
    const a = 0.00355;
    const h = 200;
    const k = 30;
    const y = a * Math.pow((x - h), 2) + k;

    // Velocity vector tangent to the curve
    // dy/dx = 2a(x - h)
    const slope = 2 * a * (x - h);
    const angle = Math.atan(slope); // radians

    // Magnitude (arbitrary visual scaling)
    const vMag = 40;
    const vx = x + vMag * Math.cos(angle);
    const vy = y + vMag * Math.sin(angle);

    // Readable kinematic quantities for the live result region. Horizontal
    // speed is constant (uniform x); vertical speed grows with the slope.
    const tSeconds = displayedTime / 10;
    const vxComponent = 3.0; // constant horizontal scale (m/s)
    const vyComponent = vxComponent * slope; // sign matches descent
    const speed = Math.sqrt(vxComponent * vxComponent + vyComponent * vyComponent);

    return (
        <div className="my-8 p-6 bg-[var(--ath-panel)] rounded-2xl border border-[var(--ath-line)] shadow-sm max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-[var(--ath-line)] pb-4">
                <div>
                    <h3 className="text-xl font-bold text-[var(--ath-text)]">Particle Kinematics</h3>
                    <p className="text-sm text-[var(--ath-muted)]">Tracing position ($s$), velocity ($v$), and acceleration ($a$).</p>
                </div>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2
                        ${isPlaying ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-[var(--ath-primary)] hover:bg-[var(--ath-primary-deep)] text-white'}`}
                >
                    {isPlaying ? (
                        <>
                            <Pause className="h-4 w-4" aria-hidden="true" />
                            Stop System
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4" aria-hidden="true" />
                            Simulate Motion
                        </>
                    )}
                </button>
            </div>

            {/* Manual time scrubber: keeps the simulation interactive while paused. */}
            <div className="mb-4">
                <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="kinematics-scrub" className="text-xs font-bold uppercase tracking-wider text-[var(--ath-muted)]">
                        Scrub time {isPlaying ? '(stop to drag)' : ''}
                    </label>
                    <span className="text-xs font-bold text-[var(--ath-primary)]">t = {tSeconds.toFixed(1)} s</span>
                </div>
                <input
                    id="kinematics-scrub"
                    type="range"
                    min="0"
                    max="99"
                    step="1"
                    value={scrub}
                    disabled={isPlaying}
                    onChange={(event) => setScrub(Number(event.target.value))}
                    aria-valuetext={`t = ${tSeconds.toFixed(1)} seconds`}
                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--ath-line)] accent-[var(--ath-primary)] disabled:opacity-50"
                />
                <p className="mt-2 rounded-lg bg-[var(--ath-panel-muted)] px-3 py-2 text-xs text-[var(--ath-muted)]" aria-live="polite">
                    At t = {tSeconds.toFixed(1)} s the speed is {speed.toFixed(1)} m/s
                    {' '}(v_x {vxComponent.toFixed(1)} m/s, v_y {vyComponent.toFixed(1)} m/s); acceleration stays a constant 9.8 m/s downward.
                </p>
            </div>

            <div className="w-full h-64 bg-[var(--ath-panel-muted)] rounded-xl border border-[var(--ath-line)] shadow-inner relative flex items-center justify-center">
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px', color: 'var(--ath-muted)' }}></div>

                <AccessibleSvg
                    viewBox="0 0 400 150"
                    className="w-full h-full"
                    title="Projectile kinematics vectors"
                    desc={`A particle moves along a parabolic trajectory on x and y axes. A green position vector points from the origin to the particle, a blue velocity vector points tangent to the path, and a red acceleration vector points straight down for gravity. ${showParticle ? `Particle is at t = ${tSeconds.toFixed(1)} seconds with speed ${speed.toFixed(1)} metres per second.` : 'Simulation paused at the start point.'}`}
                >
                    <defs>
                        <marker id="v-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                        <marker id="a-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                        </marker>
                    </defs>

                    {/* The Path (Trajectory) */}
                    <path d={`M 50 110 Q 200 10 350 110`} fill="none" stroke="var(--ath-line-strong)" strokeWidth="2" strokeDasharray="6 4" />

                    {/* The Reference Frame (Axis) */}
                    <line x1="30" y1="130" x2="370" y2="130" stroke="var(--ath-muted)" strokeWidth="2" />
                    <line x1="30" y1="130" x2="30" y2="20" stroke="var(--ath-muted)" strokeWidth="2" />
                    <text x="360" y="145" fill="var(--ath-muted)" fontSize="10" fontWeight="bold">x</text>
                    <text x="15" y="30" fill="var(--ath-muted)" fontSize="10" fontWeight="bold">y</text>

                    {/* Active Variables Display */}
                    <g transform="translate(150, 140)">
                        <text x="0" y="0" fill="var(--ath-muted)" fontSize="10" fontWeight="bold">t = {(displayedTime / 10).toFixed(1)}s</text>
                    </g>

                    {/* Dynamic Moving System */}
                    {showParticle && (
                        <g>
                            {/* Position Vector (Origin to Particle) */}
                            <line
                                x1="30" y1="130"
                                x2={x} y2={y}
                                stroke="#10b981"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                                opacity="0.6"
                            />

                            {/* Velocity Vector (Tangent) */}
                            <line
                                x1={x} y1={y}
                                x2={vx} y2={vy}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                markerEnd="url(#v-arrow)"
                            />

                            {/* Acceleration Vector (Constant Gravity downwards) */}
                            <line
                                x1={x} y1={y}
                                x2={x} y2={y + 30}
                                stroke="#ef4444"
                                strokeWidth="2"
                                markerEnd="url(#a-arrow)"
                            />

                            {/* Velocity Component Lines */}
                            <line x1={x} y1={y} x2={vx} y2={y} stroke="#93c5fd" strokeWidth="1" strokeDasharray="2 2" />
                            <line x1={x} y1={y} x2={x} y2={vy} stroke="#93c5fd" strokeWidth="1" strokeDasharray="2 2" />

                            {/* The Particle */}
                            <circle cx={x} cy={y} r="8" fill="var(--ath-text)" className="drop-shadow-md" />
                            <circle cx={x} cy={y} r="3" fill="var(--ath-muted)" />

                            {/* Labels floating near particle */}
                            <text x={vx + 5} y={vy - 5} fill="#3b82f6" fontSize="10" fontWeight="bold">v</text>
                            <text x={x + 5} y={y + 40} fill="#ef4444" fontSize="10" fontWeight="bold">a (g)</text>
                        </g>
                    )}

                    {!showParticle && (
                        <g>
                            <circle cx="50" cy="110" r="8" fill="var(--ath-text)" className="drop-shadow-md" />
                            <text x="35" y="90" fill="var(--ath-text)" fontSize="12" fontWeight="bold">START</text>
                        </g>
                    )}
                </AccessibleSvg>
            </div>

            <div className="mt-4 flex gap-6 px-2 justify-center">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#10b981]" aria-hidden="true"></span><span className="text-xs font-bold text-[var(--ath-muted)] uppercase">Position (s)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3b82f6]" aria-hidden="true"></span><span className="text-xs font-bold text-[var(--ath-muted)] uppercase">Velocity (v)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]" aria-hidden="true"></span><span className="text-xs font-bold text-[var(--ath-muted)] uppercase">Acceleration (a)</span></div>
            </div>
        </div>
    );
};
