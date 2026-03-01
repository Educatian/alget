import React, { useState, useEffect } from 'react';

export const FluidDynamicsDiagram = () => {
    const [surfaceType, setSurfaceType] = useState('smooth'); // 'smooth' or 'riblets'

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-lg max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Shark Skin Fluid Dynamics</h3>
                    <p className="text-sm text-slate-400">Comparing boundary layer turbulence on smooth vs. riblet surfaces.</p>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner">
                    <button
                        onClick={() => setSurfaceType('smooth')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${surfaceType === 'smooth' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Smooth Surface
                    </button>
                    <button
                        onClick={() => setSurfaceType('riblets')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${surfaceType === 'riblets' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Denticle Riblets
                    </button>
                </div>
            </div>

            <div className="w-full h-64 bg-slate-950 rounded-xl border border-slate-800/50 shadow-inner relative flex items-center justify-center">
                <svg viewBox="0 0 400 200" className="w-full h-full relative z-10">
                    <defs>
                        <linearGradient id="water-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
                        </linearGradient>
                    </defs>

                    {/* Water Flow Background */}
                    <rect x="0" y="0" width="400" height="200" fill="url(#water-grad)" />

                    {/* Laminar Flow Lines (Upper Region) */}
                    <g className="animate-[dash_3s_linear_infinite]" strokeDasharray="20 10" opacity="0.6">
                        <line x1="0" y1="30" x2="400" y2="30" stroke="#93c5fd" strokeWidth="1.5" />
                        <line x1="0" y1="60" x2="400" y2="60" stroke="#93c5fd" strokeWidth="1.5" />
                        <line x1="0" y1="90" x2="400" y2="90" stroke="#93c5fd" strokeWidth="1.5" />
                    </g>
                    <text x="200" y="20" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle" opacity="0.8">Free Stream Velocity (Laminar Flow)</text>

                    {surfaceType === 'smooth' && (
                        <g>
                            {/* Smooth Surface */}
                            <rect x="0" y="160" width="400" height="40" fill="#475569" stroke="#334155" strokeWidth="2" />

                            {/* Chaotic Turbulent Eddies */}
                            <path d="M 50 140 C 100 100 150 180 200 130 C 250 80 300 180 350 120" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.8" className="animate-[dash_1s_linear_infinite]" strokeDasharray="10 5" />
                            <circle cx="100" cy="140" r="15" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" className="animate-spin" />
                            <circle cx="280" cy="130" r="20" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" className="animate-spin" style={{ animationDirection: 'reverse' }} />

                            {/* Drag Indicator */}
                            <text x="200" y="185" fill="#fca5a5" fontSize="12" fontWeight="bold" textAnchor="middle">High Skin-Friction Drag</text>

                            {/* Velocity Profile - Steeper gradient near wall */}
                            <path d="M 20 160 Q 20 120 180 120" fill="none" stroke="#fca5a5" strokeWidth="2" opacity="0.8" markerEnd="url(#arrow)" />
                        </g>
                    )}

                    {surfaceType === 'riblets' && (
                        <g>
                            {/* Riblet Surface */}
                            <rect x="0" y="170" width="400" height="30" fill="#334155" />
                            {[...Array(20)].map((_, i) => (
                                <polygon key={i} points={`${i * 20},170 ${i * 20 + 10},150 ${i * 20 + 20},170`} fill="#64748b" />
                            ))}

                            {/* Lifted, controlled vortices */}
                            <path d="M 0 130 Q 50 130 100 135 T 200 135 T 300 135 T 400 130" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.8" className="animate-[dash_2s_linear_infinite]" strokeDasharray="15 5" />

                            <circle cx="110" cy="140" r="8" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="2 2" className="animate-[spin_2s_linear_infinite]" opacity="0.6" />
                            <circle cx="230" cy="140" r="8" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="2 2" className="animate-[spin_2s_linear_infinite]" opacity="0.6" />
                            <circle cx="350" cy="140" r="8" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="2 2" className="animate-[spin_2s_linear_infinite]" opacity="0.6" />

                            {/* Drag Indicator */}
                            <text x="200" y="190" fill="#a7f3d0" fontSize="12" fontWeight="bold" textAnchor="middle">10% Drag Reduction (Vortices Lifted)</text>
                        </g>
                    )}
                    <defs>
                        <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#fca5a5" />
                        </marker>
                    </defs>
                </svg>
            </div>

            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>
    );
};
