import React, { useState } from 'react';

export const MicroTurbulenceDiagram = () => {
    const [serrationEnabled, setSerrationEnabled] = useState(false);

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.2)] max-w-2xl mx-auto font-sans relative overflow-hidden">

            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-purple-400">✧</span> Vortex Shredding Analysis
                    </h3>
                    <p className="text-sm text-slate-400">Observe how trailing edge wing serrations break up large acoustic vortices.</p>
                </div>

                <button
                    onClick={() => setSerrationEnabled(!serrationEnabled)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2
                        ${serrationEnabled ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                >
                    {serrationEnabled ? '✓ Serrations Active' : 'Enable Serrations'}
                </button>
            </div>

            <div className="w-full h-48 bg-slate-950 rounded-xl border border-slate-800/50 shadow-inner relative flex items-center justify-center">
                {/* Wind Flow Lines background */}
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'dash 3s linear infinite' }}></div>

                <svg viewBox="0 0 400 150" className="w-full h-full drop-shadow-[0_0_15px_rgba(168,85,247,0.15)] relative z-10">
                    <defs>
                        <radialGradient id="vortex-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="micro-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* Wind particles entering */}
                    <g opacity="0.4" className="animate-[dash_2s_linear_infinite]" strokeDasharray="10 20">
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#93c5fd" strokeWidth="1" />
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#93c5fd" strokeWidth="1" />
                        <line x1="0" y1="75" x2="100" y2="75" stroke="#93c5fd" strokeWidth="1" />
                    </g>

                    {/* The Wing / Propeller Blade Section */}
                    {serrationEnabled ? (
                        <path d="M 50 40 L 150 60 L 140 70 L 150 80 L 140 90 L 150 100 L 140 110 L 50 110 Q 30 75 50 40 Z" fill="#334155" stroke="#64748b" strokeWidth="2" />
                    ) : (
                        <path d="M 50 40 L 150 60 C 160 85 160 100 150 110 L 50 110 Q 30 75 50 40 Z" fill="#334155" stroke="#64748b" strokeWidth="2" />
                    )}

                    {/* The Vortex Generation */}
                    {!serrationEnabled ? (
                        <>
                            {/* Large blunt vortices representing noise */}
                            <circle cx="210" cy="75" r="30" fill="url(#vortex-grad)" className="animate-pulse" style={{ animationDuration: '0.8s' }} />
                            <path d="M 160 75 Q 210 20 260 75 T 360 75" fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.6" className="animate-[dash_1s_linear_infinite]" strokeDasharray="15 15" />
                            <text x="210" y="75" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" dy=".3em">LOUD NOISE</text>
                            <text x="210" y="115" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">Coherent Vortex</text>
                        </>
                    ) : (
                        <>
                            {/* Disrupted micro-turbulences representing silent flight */}
                            <g className="animate-pulse" style={{ animationDuration: '1.2s' }}>
                                <circle cx="170" cy="65" r="8" fill="url(#micro-grad)" />
                                <circle cx="190" cy="85" r="10" fill="url(#micro-grad)" />
                                <circle cx="180" cy="105" r="7" fill="url(#micro-grad)" />
                                <circle cx="220" cy="60" r="6" fill="url(#micro-grad)" opacity="0.7" />
                                <circle cx="240" cy="90" r="9" fill="url(#micro-grad)" opacity="0.6" />
                                <circle cx="260" cy="75" r="5" fill="url(#micro-grad)" opacity="0.4" />
                            </g>

                            <path d="M 155 65 Q 180 50 200 65 T 250 65" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.5" className="animate-[dash_2s_linear_infinite]" strokeDasharray="5 5" />
                            <path d="M 155 85 Q 190 70 230 85 T 300 85" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" className="animate-[dash_1.5s_linear_infinite]" strokeDasharray="5 5" />
                            <path d="M 155 105 Q 170 95 190 105 T 220 105" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.6" className="animate-[dash_1.8s_linear_infinite]" strokeDasharray="5 5" />

                            <text x="230" y="125" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle">Micro-Turbulence (Silent)</text>
                        </>
                    )}
                </svg>
            </div>

            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>
    );
};
