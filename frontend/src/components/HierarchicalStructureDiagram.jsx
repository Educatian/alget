import React, { useState } from 'react';

export const HierarchicalStructureDiagram = () => {
    const [stressLevel, setStressLevel] = useState(0);

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.2)] max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Brick-and-Mortar Hierarchy (Nacre)</h3>
                    <p className="text-sm text-slate-400">Increase stress to observe how brittle "bricks" and polymer "mortar" arrest crack propagation.</p>
                </div>

                <div className="w-1/3">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block text-right">Applied Stress</label>
                    <input
                        type="range" min="0" max="100" value={stressLevel}
                        onChange={(e) => setStressLevel(Number(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>
            </div>

            <div className="w-full h-56 bg-slate-800 rounded-xl border border-slate-700 shadow-inner relative flex items-center justify-center p-4">
                <svg viewBox="0 0 500 200" className="w-full h-full drop-shadow-lg">
                    {/* Background Structure (The Mortar) */}
                    <rect x="10" y="10" width="480" height="180" fill="#1e293b" rx="4" />

                    {/* The Bricks (Aragonite) */}
                    <g className="transition-all duration-300">
                        {/* Layer 1 */}
                        <rect x="20" y="20" width="100" height="30" fill="#94a3b8" rx="2" />
                        <rect x="130" y="20" width="100" height="30" fill="#94a3b8" rx="2" />
                        <rect x="240" y="20" width="100" height="30" fill="#94a3b8" rx="2" />
                        <rect x="350" y="20" width="100" height="30" fill="#94a3b8" rx="2" />

                        {/* Layer 2 (Offset horizontally based on stress to simulate sliding) */}
                        <g transform={`translate(${stressLevel * 0.1}, 0)`}>
                            <rect x="75" y="60" width="100" height="30" fill="#cbd5e1" rx="2" />
                            <rect x="185" y="60" width="100" height="30" fill="#cbd5e1" rx="2" />
                            <rect x="295" y="60" width="100" height="30" fill="#cbd5e1" rx="2" />
                        </g>

                        {/* Layer 3 */}
                        <g transform={`translate(${-stressLevel * 0.15}, 0)`}>
                            <rect x="20" y="100" width="100" height="30" fill="#64748b" rx="2" />
                            <rect x="130" y="100" width="100" height="30" fill="#64748b" rx="2" />
                            <rect x="240" y="100" width="100" height="30" fill="#64748b" rx="2" />
                            <rect x="350" y="100" width="100" height="30" fill="#64748b" rx="2" />
                        </g>

                        {/* Layer 4 */}
                        <g transform={`translate(${stressLevel * 0.2}, 0)`}>
                            <rect x="75" y="140" width="100" height="30" fill="#94a3b8" rx="2" />
                            <rect x="185" y="140" width="100" height="30" fill="#94a3b8" rx="2" />
                            <rect x="295" y="140" width="100" height="30" fill="#94a3b8" rx="2" />
                        </g>
                    </g>

                    {/* Crack Propagation Animation */}
                    {stressLevel > 20 && (
                        <path d="M 230 20 L 235 50" fill="none" stroke="#ef4444" strokeWidth="3" className="animate-[dash_0.2s_linear_forwards]" strokeDasharray="40" />
                    )}
                    {stressLevel > 40 && (
                        <path d="M 235 50 L 290 60 L 290 90" fill="none" stroke="#ef4444" strokeWidth="3" className="animate-[dash_0.3s_linear_forwards]" strokeDasharray="100" />
                    )}
                    {stressLevel > 60 && (
                        <path d="M 290 90 L 230 100 L 235 130" fill="none" stroke="#ef4444" strokeWidth="3" className="animate-[dash_0.3s_linear_forwards]" strokeDasharray="150" />
                    )}
                    {stressLevel > 80 && (
                        <path d="M 235 130 L 290 140 L 285 170" fill="none" stroke="#ef4444" strokeWidth="3" className="animate-[dash_0.3s_linear_forwards]" strokeDasharray="200" />
                    )}

                    {/* Polymer Mortar stretching visuals */}
                    {stressLevel > 50 && (
                        <g stroke="#f59e0b" strokeWidth="1" opacity="0.6">
                            <line x1="230" y1="55" x2="290" y2="55" />
                            <line x1="235" y1="95" x2="290" y2="95" />
                            <line x1="235" y1="135" x2="290" y2="135" />
                        </g>
                    )}
                </svg>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Material Status:</span>
                {stressLevel < 30 ? (
                    <span className="text-emerald-400">Intact (Solid)</span>
                ) : stressLevel < 80 ? (
                    <span className="text-orange-400 animate-pulse">Absorbing Energy via Sliding</span>
                ) : (
                    <span className="text-red-400">Max Toughness Exceeded</span>
                )}
            </div>
        </div>
    );
};
