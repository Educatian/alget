import React, { useState } from 'react';

export const RubricDesignDiagram = () => {
    const [hoverLevel, setHoverLevel] = useState(null);

    const levels = [
        { id: 1, label: "Novice", desc: "Missing key elements", color: "#f87171" },
        { id: 2, label: "Developing", desc: "Partial understanding", color: "#fbbf24" },
        { id: 3, label: "Proficient", desc: "Meets expectations", color: "#34d399" },
        { id: 4, label: "Exemplary", desc: "Exceeds expectations", color: "#60a5fa" }
    ];

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.2)] max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-yellow-400">📋</span> Rubric Matrix
                    </h3>
                    <p className="text-sm text-slate-400">Hover over the performance levels to see explicit criteria scaling.</p>
                </div>
            </div>

            <div className="w-full bg-slate-950 rounded-xl border border-slate-800/50 shadow-inner relative flex flex-col items-center justify-center p-4">

                {/* Header Row */}
                <div className="grid grid-cols-5 gap-2 w-full mb-2">
                    <div className="col-span-1 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-end pb-2">Criteria</div>
                    {levels.map(level => (
                        <div
                            key={level.id}
                            className={`col-span-1 text-center p-2 rounded-t-lg transition-colors duration-300 ${hoverLevel === level.id ? 'bg-slate-800' : ''}`}
                            style={{ color: level.color }}
                        >
                            <div className="font-bold text-sm">{level.label}</div>
                            <div className="text-[10px] opacity-70">Level {level.id}</div>
                        </div>
                    ))}
                </div>

                {/* Criterion 1 */}
                <div className="grid grid-cols-5 gap-2 w-full mb-2">
                    <div className="col-span-1 bg-slate-800 rounded-lg p-3 flex items-center text-xs font-semibold text-slate-300 border-l-4 border-slate-600">
                        Critical Thinking
                    </div>
                    {levels.map(level => (
                        <div
                            key={level.id}
                            onMouseEnter={() => setHoverLevel(level.id)}
                            onMouseLeave={() => setHoverLevel(null)}
                            className={`col-span-1 rounded-lg p-3 text-xs flex items-center justify-center text-center cursor-pointer transition-all duration-300
                                ${hoverLevel === level.id ? 'transform scale-105 shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                            style={{ backgroundColor: hoverLevel === level.id ? `${level.color}20` : '#1e293b', border: hoverLevel === level.id ? `1px solid ${level.color}50` : '1px solid transparent' }}
                        >
                            <span className={hoverLevel === level.id ? 'text-white' : 'text-slate-400'}>
                                {hoverLevel === level.id ? level.desc : "..."}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Criterion 2 */}
                <div className="grid grid-cols-5 gap-2 w-full">
                    <div className="col-span-1 bg-slate-800 rounded-lg p-3 flex items-center text-xs font-semibold text-slate-300 border-l-4 border-slate-600">
                        Argument Structure
                    </div>
                    {levels.map(level => (
                        <div
                            key={level.id}
                            onMouseEnter={() => setHoverLevel(level.id)}
                            onMouseLeave={() => setHoverLevel(null)}
                            className={`col-span-1 rounded-lg p-3 text-xs flex items-center justify-center text-center cursor-pointer transition-all duration-300
                                ${hoverLevel === level.id ? 'transform scale-105 shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                            style={{ backgroundColor: hoverLevel === level.id ? `${level.color}20` : '#1e293b', border: hoverLevel === level.id ? `1px solid ${level.color}50` : '1px solid transparent' }}
                        >
                            <span className={hoverLevel === level.id ? 'text-white' : 'text-slate-400'}>
                                {hoverLevel === level.id ? (level.id === 4 ? "Flawless logic" : level.id === 1 ? "No structure" : "Basic flow") : "..."}
                            </span>
                        </div>
                    ))}
                </div>

            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/5 rounded-full blur-[80px] pointer-events-none"></div>
        </div>
    );
};
