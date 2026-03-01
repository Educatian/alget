import React, { useState, useEffect } from 'react';

export const FluidDynamicsDiagram = () => {
    const [surfaceType, setSurfaceType] = useState('smooth'); // 'smooth' or 'riblets'
    const [flowSpeed, setFlowSpeed] = useState(50); // 1 to 100

    // Derived physical properties based on input
    const reynoldsNumber = Math.floor(flowSpeed * 1234.5); // Arbitrary scaling for illustration
    const isTurbulent = reynoldsNumber > 40000;

    const dragCoefficient = surfaceType === 'smooth'
        ? (isTurbulent ? 0.045 : 0.02)
        : (isTurbulent ? 0.040 : 0.019); // Riblets reduce drag more effectively in turbulent conditions

    const dragPenalty = flowSpeed < 20 ? "Negligible" : surfaceType === 'smooth' && isTurbulent ? "Critical (Flow Separation)" : "Moderate";

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-xl max-w-3xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <span className="text-blue-400">🌊</span> Boundary Layer Topology
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Adjust free-stream velocity to observe how micro-riblets control chaotic vortices under high Reynolds numbers.</p>

                    <div className="flex bg-slate-800 p-1.5 rounded-xl shadow-inner w-fit mb-4">
                        <button
                            onClick={() => setSurfaceType('smooth')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${surfaceType === 'smooth' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Smooth Hull
                        </button>
                        <button
                            onClick={() => setSurfaceType('riblets')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${surfaceType === 'riblets' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 22L12 14L20 22"></path></svg>
                            Denticle Riblets
                        </button>
                    </div>

                    <div className="w-full max-w-xs">
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex justify-between">
                            <span>Free-Stream Velocity (U∞)</span>
                            <span className="text-blue-400">{flowSpeed} m/s</span>
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            value={flowSpeed}
                            onChange={(e) => setFlowSpeed(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[140px]">
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mb-1">Reynolds Number (Re)</div>
                        <div className={`text-lg font-black font-mono ${isTurbulent ? 'text-orange-400' : 'text-blue-400'}`}>{reynoldsNumber.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{isTurbulent ? 'Turbulent Regime' : 'Laminar Regime'}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mb-1">Drag Coeff (Cd)</div>
                        <div className={`text-lg font-black font-mono ${surfaceType === 'riblets' && isTurbulent ? 'text-green-400' : surfaceType === 'smooth' && isTurbulent ? 'text-red-400' : 'text-slate-300'}`}>{dragCoefficient.toFixed(4)}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{dragPenalty}</div>
                    </div>
                </div>
            </div>

            <div className="w-full h-64 bg-slate-950 rounded-xl border border-slate-800/80 shadow-inner relative flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 500 200" className="w-full h-full relative z-10 transition-all duration-500">
                    <defs>
                        <linearGradient id="water-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={flowSpeed > 60 ? 0.8 : 0.4} className="transition-all duration-300" />
                        </linearGradient>
                    </defs>

                    {/* Water Flow Background */}
                    <rect x="0" y="0" width="500" height="200" fill="url(#water-grad)" />

                    {/* Laminar Flow Lines (Upper Region) Speed depends on flowSpeed state */}
                    <g opacity="0.6" style={{ animation: `dash ${100 / flowSpeed}s linear infinite` }}>
                        <line x1="0" y1="30" x2="500" y2="30" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="30 15" />
                        <line x1="0" y1="60" x2="500" y2="60" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="30 15" />
                        <line x1="0" y1="90" x2="500" y2="90" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="30 15" />
                    </g>

                    {surfaceType === 'smooth' && (
                        <g>
                            {/* Smooth Surface */}
                            <rect x="0" y="160" width="500" height="40" fill="#334155" stroke="#1e293b" strokeWidth="2" />

                            {/* Chaotic Turbulent Eddies - gets wilder with speed */}
                            {isTurbulent && (
                                <g>
                                    <path d="M 50 140 C 100 80 150 190 250 120 C 350 50 400 180 450 110" fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.9" style={{ animation: `dash ${80 / flowSpeed}s linear infinite` }} strokeDasharray="15 8" />
                                    <path d="M 80 150 C 120 100 180 170 280 130 C 380 90 420 170 480 120" fill="none" stroke="#f87171" strokeWidth="1.5" opacity="0.7" style={{ animation: `dash ${90 / flowSpeed}s linear infinite` }} strokeDasharray="10 5" />

                                    <circle cx="120" cy="140" r={flowSpeed * 0.4} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 6" style={{ animation: `spin ${100 / flowSpeed}s linear infinite` }} opacity="0.8" />
                                    <circle cx="340" cy="130" r={flowSpeed * 0.5} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 6" style={{ animation: `spin ${80 / flowSpeed}s linear infinite reverse` }} opacity="0.8" />

                                    {/* Wall impact highlights */}
                                    <ellipse cx="120" cy="160" rx="30" ry="5" fill="#ef4444" opacity="0.4" className="animate-[pulse_1s_infinite]" />
                                    <ellipse cx="340" cy="160" rx="40" ry="5" fill="#ef4444" opacity="0.4" className="animate-[pulse_1.2s_infinite]" />

                                    <text x="250" y="185" fill="#fca5a5" fontSize="13" fontWeight="bold" textAnchor="middle" className="tracking-widest">SEVERE CROSS-STREAM TRANSLATION</text>
                                </g>
                            )}

                            {!isTurbulent && (
                                <path d="M 0 130 Q 150 135 250 135 T 500 130" fill="none" stroke="#94a3b8" strokeWidth="2" opacity="0.8" style={{ animation: `dash ${200 / flowSpeed}s linear infinite` }} strokeDasharray="20 10" />
                            )}
                        </g>
                    )}

                    {surfaceType === 'riblets' && (
                        <g>
                            {/* Riblet Surface */}
                            <rect x="0" y="170" width="500" height="30" fill="#1e293b" />
                            {[...Array(25)].map((_, i) => (
                                <polygon key={i} points={`${i * 20},170 ${i * 20 + 10},145 ${i * 20 + 20},170`} fill="#475569" stroke="#334155" strokeWidth="1" />
                            ))}

                            {/* Lifted, controlled vortices even in "turbulent" speeds */}
                            <path d="M 0 120 Q 100 125 250 125 T 500 120" fill="none" stroke="#10b981" strokeWidth="2.5" opacity="0.9" style={{ animation: `dash ${120 / flowSpeed}s linear infinite` }} strokeDasharray="20 10" />
                            <path d="M 0 100 Q 150 110 250 110 T 500 100" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.6" style={{ animation: `dash ${140 / flowSpeed}s linear infinite` }} strokeDasharray="15 10" />

                            {isTurbulent && (
                                <g>
                                    {/* Vortices are kept small and hovering ABOVE the valleys */}
                                    <circle cx="150" cy="125" r="12" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 4" style={{ animation: `spin ${100 / flowSpeed}s linear infinite` }} opacity="0.8" />
                                    <circle cx="300" cy="125" r="14" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 4" style={{ animation: `spin ${90 / flowSpeed}s linear infinite reverse` }} opacity="0.8" />
                                    <circle cx="450" cy="125" r="10" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 4" style={{ animation: `spin ${110 / flowSpeed}s linear infinite` }} opacity="0.8" />

                                    <text x="250" y="190" fill="#a7f3d0" fontSize="11" fontWeight="bold" textAnchor="middle" className="tracking-wider">VORTICES MECHANICALLY ISOLATED FROM VALLEYS</text>
                                </g>
                            )}
                        </g>
                    )}
                </svg>

                {/* Particle overlay effect when turbulent */}
                {isTurbulent && surfaceType === 'smooth' && (
                    <div className="absolute inset-0 bg-red-500/5 mix-blend-color-dodge pointer-events-none"></div>
                )}
            </div>

            <style>{`
                @keyframes dash {
                    to { stroke-dashoffset: -100; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); transform-origin: center; }
                    to { transform: rotate(360deg); transform-origin: center; }
                }
            `}</style>
            <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${surfaceType === 'riblets' ? 'bg-blue-500/20' : 'bg-red-500/10'}`}></div>
        </div>
    );
};
