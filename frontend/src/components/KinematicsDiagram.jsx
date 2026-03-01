import React, { useState, useEffect } from 'react';

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
        } else {
            clearInterval(interval);
            setTime(0);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    // Path mathematics (Projectile motion arc)
    // Formula for simple parabolic motion: y = a(x - h)^2 + k
    // Let's scale t(0 to 100) to map to x(50 to 350)
    const tScaled = time / 100;
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

    return (
        <div className="my-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Particle Kinematics</h3>
                    <p className="text-sm text-slate-500">Tracing position ($s$), velocity ($v$), and acceleration ($a$).</p>
                </div>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2
                        ${isPlaying ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                    {isPlaying ? '⏸ Stop System' : '▶ Simulate Motion'}
                </button>
            </div>

            <div className="w-full h-64 bg-slate-50 rounded-xl border border-slate-200 shadow-inner relative flex items-center justify-center">
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <svg viewBox="0 0 400 150" className="w-full h-full">
                    <defs>
                        <marker id="v-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                        <marker id="a-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                        </marker>
                    </defs>

                    {/* The Path (Trajectory) */}
                    <path d={`M 50 110 Q 200 10 350 110`} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" />

                    {/* The Reference Frame (Axis) */}
                    <line x1="30" y1="130" x2="370" y2="130" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="30" y1="130" x2="30" y2="20" stroke="#94a3b8" strokeWidth="2" />
                    <text x="360" y="145" fill="#64748b" fontSize="10" fontWeight="bold">x</text>
                    <text x="15" y="30" fill="#64748b" fontSize="10" fontWeight="bold">y</text>

                    {/* Active Variables Display */}
                    <g transform="translate(150, 140)">
                        <text x="0" y="0" fill="#64748b" fontSize="10" fontWeight="bold">t = {(time / 10).toFixed(1)}s</text>
                    </g>

                    {/* Dynamic Moving System */}
                    {isPlaying && (
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
                            <circle cx={x} cy={y} r="8" fill="#475569" className="drop-shadow-md" />
                            <circle cx={x} cy={y} r="3" fill="#94a3b8" />

                            {/* Labels floating near particle */}
                            <text x={vx + 5} y={vy - 5} fill="#3b82f6" fontSize="10" fontWeight="bold">v</text>
                            <text x={x + 5} y={y + 40} fill="#ef4444" fontSize="10" fontWeight="bold">a (g)</text>
                        </g>
                    )}

                    {!isPlaying && (
                        <g>
                            <circle cx="50" cy="110" r="8" fill="#475569" className="drop-shadow-md" />
                            <text x="35" y="90" fill="#475569" fontSize="12" fontWeight="bold">START</text>
                        </g>
                    )}
                </svg>
            </div>

            <div className="mt-4 flex gap-6 px-2 justify-center">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#10b981]"></span><span className="text-xs font-bold text-slate-500 uppercase">Position (s)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3b82f6]"></span><span className="text-xs font-bold text-slate-500 uppercase">Velocity (v)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]"></span><span className="text-xs font-bold text-slate-500 uppercase">Acceleration (a)</span></div>
            </div>
        </div>
    );
};
