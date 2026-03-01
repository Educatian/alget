import React, { useState, useEffect } from 'react';

export const FeedbackModelsDiagram = () => {
    const [step, setStep] = useState(0); // 0, 1, 2, 3
    const [isPlaying, setIsPlaying] = useState(false);

    const steps = [
        { label: 'Action / Performance', color: '#3b82f6', x: 200, y: 30 },
        { label: 'Data Collection', color: '#8b5cf6', x: 330, y: 100 },
        { label: 'Feedback Delivery', color: '#ec4899', x: 200, y: 170 },
        { label: 'Adjustment (Learning)', color: '#10b981', x: 70, y: 100 },
    ];

    useEffect(() => {
        let interval;
        if (isPlaying) {
            interval = setInterval(() => {
                setStep(s => (s + 1) % 4);
            }, 1200);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.2)] max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-teal-400">🔄</span> The Feedback Loop
                    </h3>
                    <p className="text-sm text-slate-400">Feedback is only effective if it loops back to modify future actions.</p>
                </div>
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg w-32
                        ${isPlaying ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-teal-600 hover:bg-teal-500 text-white'}`}
                >
                    {isPlaying ? "Stop Loop" : "Animate Loop"}
                </button>
            </div>

            <div className="w-full h-56 bg-slate-950 rounded-xl border border-slate-800/50 shadow-inner relative flex items-center justify-center p-4">
                <svg viewBox="0 0 400 200" className="w-full h-full relative z-10">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                        </marker>
                        <marker id="arrow-active" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#e2e8f0" />
                        </marker>
                    </defs>

                    {/* Central anchor */}
                    <circle cx="200" cy="100" r="40" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                    <text x="200" y="105" fill="#e2e8f0" fontSize="12" fontWeight="bold" textAnchor="middle">Learner</text>

                    {/* Arrows connecting the nodes */}
                    {/* Action -> Data */}
                    <path d="M 230 45 Q 290 60 310 80" fill="none" stroke={step === 1 ? steps[1].color : "#334155"} strokeWidth={step === 1 ? 4 : 2} markerEnd={step === 1 ? "url(#arrow-active)" : "url(#arrow)"} className="transition-all duration-300" />
                    {/* Data -> Feedback */}
                    <path d="M 310 120 Q 290 140 230 155" fill="none" stroke={step === 2 ? steps[2].color : "#334155"} strokeWidth={step === 2 ? 4 : 2} markerEnd={step === 2 ? "url(#arrow-active)" : "url(#arrow)"} className="transition-all duration-300" />
                    {/* Feedback -> Adjustment */}
                    <path d="M 170 155 Q 110 140 90 120" fill="none" stroke={step === 3 ? steps[3].color : "#334155"} strokeWidth={step === 3 ? 4 : 2} markerEnd={step === 3 ? "url(#arrow-active)" : "url(#arrow)"} className="transition-all duration-300" />
                    {/* Adjustment -> Action */}
                    <path d="M 90 80 Q 110 60 170 45" fill="none" stroke={step === 0 && isPlaying ? steps[0].color : "#334155"} strokeWidth={step === 0 && isPlaying ? 4 : 2} markerEnd={step === 0 && isPlaying ? "url(#arrow-active)" : "url(#arrow)"} className="transition-all duration-300" />

                    {/* Nodes */}
                    {steps.map((s, idx) => {
                        const isActive = step === idx;
                        return (
                            <g key={idx} className="transition-all duration-500" style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)', transformOrigin: `${s.x}px ${s.y}px` }}>
                                <rect x={s.x - 60} y={s.y - 15} width="120" height="30" rx="15" fill={isActive ? s.color : '#1e293b'} stroke={isActive ? 'white' : s.color} strokeWidth="2" className="transition-colors duration-300 shadow-lg" />
                                <text x={s.x} y={s.y + 4} fill={isActive ? 'white' : s.color} fontSize="10" fontWeight="bold" textAnchor="middle">{s.label}</text>
                            </g>
                        );
                    })}

                    {/* Pulse particle leading the way if playing */}
                    {isPlaying && (
                        <circle r="4" fill="white" className="animate-[spin_4.8s_linear_infinite]" style={{ transformOrigin: '200px 100px', cy: '25', cx: '200' }} />
                    )}

                </svg>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        </div>
    );
};
