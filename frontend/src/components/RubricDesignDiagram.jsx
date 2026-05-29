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
        <div className="my-8 p-6 bg-[var(--ath-panel)] rounded-2xl border border-[var(--ath-line)] shadow-md max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-[var(--ath-line)] pb-6">
                <div>
                    <h3 className="text-xl font-bold text-[var(--ath-text)] mb-1 flex items-center gap-2">
                        <span className="text-yellow-500">📋</span> Rubric Matrix
                    </h3>
                    <p className="text-sm text-[var(--ath-muted)]">Hover over the performance levels to see explicit criteria scaling.</p>
                </div>
            </div>

            <div className="w-full bg-[var(--ath-panel-muted)] rounded-xl border border-[var(--ath-line)] shadow-inner relative flex flex-col items-center justify-center p-4">

                {/* Header Row */}
                <div className="grid grid-cols-5 gap-2 w-full mb-2">
                    <div className="col-span-1 text-xs font-bold text-[var(--ath-muted)] uppercase tracking-wider flex items-end pb-2">Criteria</div>
                    {levels.map(level => (
                        <div
                            key={level.id}
                            className={`col-span-1 text-center p-2 rounded-t-lg transition-colors duration-300 ${hoverLevel === level.id ? 'bg-[var(--ath-line)]' : ''}`}
                            style={{ color: level.color }}
                        >
                            <div className="font-bold text-sm">{level.label}</div>
                            <div className="text-[10px] opacity-70">Level {level.id}</div>
                        </div>
                    ))}
                </div>

                {/* Criterion 1 */}
                <div className="grid grid-cols-5 gap-2 w-full mb-2">
                    <div className="col-span-1 bg-[var(--ath-panel)] rounded-lg p-3 flex items-center text-xs font-semibold text-[var(--ath-text)] border-l-4 border-[var(--ath-line-strong)] shadow-sm">
                        Critical Thinking
                    </div>
                    {levels.map(level => (
                        <div
                            key={level.id}
                            onMouseEnter={() => setHoverLevel(level.id)}
                            onMouseLeave={() => setHoverLevel(null)}
                            className={`col-span-1 rounded-lg p-3 text-xs flex items-center justify-center text-center cursor-pointer transition-all duration-300
                                ${hoverLevel === level.id ? 'transform scale-105 shadow-md' : 'opacity-80 hover:opacity-100'}`}
                            style={{ backgroundColor: hoverLevel === level.id ? `${level.color}20` : 'var(--ath-panel)', border: hoverLevel === level.id ? `1px solid ${level.color}50` : '1px solid var(--ath-line)' }}
                        >
                            <span className={hoverLevel === level.id ? 'text-[var(--ath-text)]' : 'text-[var(--ath-muted)]'}>
                                {hoverLevel === level.id ? level.desc : "..."}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Criterion 2 */}
                <div className="grid grid-cols-5 gap-2 w-full">
                    <div className="col-span-1 bg-[var(--ath-panel)] rounded-lg p-3 flex items-center text-xs font-semibold text-[var(--ath-text)] border-l-4 border-[var(--ath-line-strong)] shadow-sm">
                        Argument Structure
                    </div>
                    {levels.map(level => (
                        <div
                            key={level.id}
                            onMouseEnter={() => setHoverLevel(level.id)}
                            onMouseLeave={() => setHoverLevel(null)}
                            className={`col-span-1 rounded-lg p-3 text-xs flex items-center justify-center text-center cursor-pointer transition-all duration-300
                                ${hoverLevel === level.id ? 'transform scale-105 shadow-md' : 'opacity-80 hover:opacity-100'}`}
                            style={{ backgroundColor: hoverLevel === level.id ? `${level.color}20` : 'var(--ath-panel)', border: hoverLevel === level.id ? `1px solid ${level.color}50` : '1px solid var(--ath-line)' }}
                        >
                            <span className={hoverLevel === level.id ? 'text-[var(--ath-text)]' : 'text-[var(--ath-muted)]'}>
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
