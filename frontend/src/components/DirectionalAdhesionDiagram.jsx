import React, { useState } from 'react';

export const DirectionalAdhesionDiagram = () => {
    const [angle, setAngle] = useState(0); // -45 to 45 deg representing angle of applied pull

    const isEngaged = angle >= -10 && angle <= 20; // Engaged effectively when pulling straight or slightly forward

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-lg max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Directional Adhesion</h3>
                    <p className="text-sm text-slate-400">Change the pull angle to see the van der Waals forces engage (sticking) or disengage (peeling).</p>
                </div>

                <div className="w-1/3">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block text-right">Pull Angle ($\theta$)</label>
                    <input
                        type="range" min="-45" max="45" value={angle}
                        onChange={(e) => setAngle(Number(e.target.value))}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isEngaged ? 'bg-emerald-500/30 accent-emerald-500' : 'bg-red-500/30 accent-red-500'}`}
                    />
                </div>
            </div>

            <div className="w-full h-64 bg-slate-800 rounded-xl border border-slate-700 shadow-inner relative flex items-center justify-center p-4">
                <svg viewBox="0 0 400 200" className="w-full h-full relative z-10">
                    <defs>
                        <radialGradient id="vdw-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* The Surface (Glass/Wall) */}
                    <rect x="0" y="160" width="400" height="40" fill="#334155" />
                    <line x1="0" y1="160" x2="400" y2="160" stroke="#64748b" strokeWidth="2" />

                    {/* The Spatulae (Gecko foot pad) */}
                    <g transform={`translate(200, 150) rotate(${angle}) translate(-200, -150)`}>
                        <rect x="150" y="80" width="100" height="70" fill="#475569" rx="8" className="transition-all duration-300" />

                        {/* Micro-pillars / Setae branches */}
                        {[...Array(8)].map((_, i) => (
                            <line
                                key={i}
                                x1={160 + i * 11} y1="150"
                                x2={165 + i * 11} y2="160"
                                stroke="#94a3b8"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                        ))}

                        {/* Force Indicator Arrow */}
                        <path d="M 200 80 L 200 30" fill="none" stroke={isEngaged ? '#10b981' : '#ef4444'} strokeWidth="4" markerEnd="url(#arrow)" strokeDasharray="5" className="animate-[dash_1s_linear_infinite]" />
                    </g>

                    {/* Van der Waals Engagement Visuals */}
                    {isEngaged && (
                        <g>
                            <rect x="160" y="155" width="90" height="10" fill="url(#vdw-glow)" className="animate-pulse" style={{ animationDuration: '0.8s' }} />
                            <text x="200" y="185" fill="#34d399" fontSize="12" fontWeight="bold" textAnchor="middle">Van der Waals Forces Engaged (Locked)</text>
                        </g>
                    )}

                    {!isEngaged && (
                        <text x="200" y="185" fill="#fca5a5" fontSize="12" fontWeight="bold" textAnchor="middle">Contact Broken (Peeling)</text>
                    )}

                    <defs>
                        <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill={isEngaged ? '#10b981' : '#ef4444'} />
                        </marker>
                    </defs>
                </svg>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none"></div>
        </div>
    );
};
