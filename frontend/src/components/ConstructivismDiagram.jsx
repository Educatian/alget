import React, { useState } from 'react';

export const ConstructivismDiagram = () => {
    const [scaffoldLevel, setScaffoldLevel] = useState(0); // 0, 1, 2 = levels of built knowledge

    const handleScaffoldClick = () => {
        setScaffoldLevel((prev) => (prev + 1) % 3);
    };

    return (
        <div className="my-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-md max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-200 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                        <span className="text-emerald-500">🧱</span> Constructing Knowledge
                    </h3>
                    <p className="text-sm text-slate-600">Experience how learners actively build new schemas upon prior knowledge foundations.</p>
                </div>
                <button
                    onClick={handleScaffoldClick}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
                >
                    {scaffoldLevel === 0 ? "Add Experiences" : scaffoldLevel === 1 ? "Connect Schemas" : "Reset Foundation"}
                </button>
            </div>

            <div className="w-full h-56 bg-slate-50 rounded-xl border border-slate-200 shadow-inner relative flex flex-col items-center justify-end overflow-hidden">
                <svg viewBox="0 0 400 200" className="w-full h-full relative z-10">
                    <defs>
                        <linearGradient id="block-base" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#94a3b8" />
                            <stop offset="100%" stopColor="#64748b" />
                        </linearGradient>
                        <linearGradient id="block-new" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="block-connect" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                    </defs>

                    {/* Background Grid Pattern representing environment */}
                    <g opacity="0.3">
                        <path d="M0 20 H400 M0 40 H400 M0 60 H400 M0 80 H400 M0 100 H400 M0 120 H400 M0 140 H400 M0 160 H400 M0 180 H400" stroke="#cbd5e1" strokeWidth="1" />
                        <path d="M20 0 V200 M40 0 V200 M60 0 V200 M80 0 V200 M100 0 V200 M120 0 V200 M140 0 V200 M160 0 V200 M180 0 V200 M200 0 V200 M220 0 V200 M240 0 V200 M260 0 V200 M280 0 V200 M300 0 V200 M320 0 V200 M340 0 V200 M360 0 V200 M380 0 V200" stroke="#cbd5e1" strokeWidth="1" />
                    </g>

                    {/* Ground Layer */}
                    <rect x="0" y="190" width="400" height="10" fill="#e2e8f0" />

                    {/* Level 0: Prior Knowledge Foundation */}
                    <g className="transition-all duration-500">
                        <rect x="130" y="160" width="140" height="30" rx="4" fill="url(#block-base)" stroke="#64748b" strokeWidth="1" />
                        <text x="200" y="179" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">Prior Knowledge</text>
                    </g>

                    {/* Level 1: New Experiences Built on top */}
                    <g className={`transition-all duration-700 ease-bounce ${scaffoldLevel >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
                        <rect x="150" y="125" width="45" height="30" rx="4" fill="url(#block-new)" stroke="#emerald-300" strokeWidth="1" />
                        <rect x="205" y="125" width="45" height="30" rx="4" fill="url(#block-new)" stroke="#emerald-300" strokeWidth="1" />
                        <text x="172.5" y="145" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">Idea A</text>
                        <text x="227.5" y="145" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">Idea B</text>

                        {/* Abstract connections */}
                        {scaffoldLevel >= 1 && (
                            <>
                                <line x1="172.5" y1="160" x2="172.5" y2="155" stroke="#10b981" strokeWidth="3" strokeDasharray="3 3" className="animate-[dash_1s_linear_infinite]" />
                                <line x1="227.5" y1="160" x2="227.5" y2="155" stroke="#10b981" strokeWidth="3" strokeDasharray="3 3" className="animate-[dash_1s_reverse_infinite]" />
                            </>
                        )}
                    </g>

                    {/* Level 2: Connected Schemas bridging everything together */}
                    <g className={`transition-all duration-700 delay-200 ease-bounce ${scaffoldLevel >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
                        <rect x="140" y="90" width="120" height="30" rx="4" fill="url(#block-connect)" stroke="#blue-300" strokeWidth="1" />
                        <text x="200" y="109" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">Synthesized Schema</text>

                        {/* Synaptic sparks */}
                        {scaffoldLevel >= 2 && (
                            <g className="animate-pulse">
                                <circle cx="160" cy="85" r="3" fill="#60a5fa" />
                                <circle cx="200" cy="80" r="4" fill="#93c5fd" />
                                <circle cx="240" cy="85" r="3" fill="#60a5fa" />
                            </g>
                        )}
                    </g>
                </svg>
            </div>

            <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>
    );
};
