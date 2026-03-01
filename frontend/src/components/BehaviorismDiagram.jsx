import React, { useState } from 'react';

export const BehaviorismDiagram = () => {
    const [action, setAction] = useState('idle'); // idle, stimulus, response, reinforcement

    const triggerStimulus = () => {
        setAction('stimulus');
        setTimeout(() => setAction('response'), 1000);
        setTimeout(() => setAction('reinforcement'), 2000);
        setTimeout(() => setAction('idle'), 4000);
    };

    return (
        <div className="my-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-md max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-200 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                        <span className="text-orange-500">🔔</span> Stimulus-Response Loop
                    </h3>
                    <p className="text-sm text-slate-600">Observe Operant Conditioning: behaviors are modified by their consequences.</p>
                </div>
                <button
                    onClick={triggerStimulus}
                    disabled={action !== 'idle'}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md 
                        ${action === 'idle' ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                >
                    {action === 'idle' ? "Trigger Stimulus" : "Loop Running..."}
                </button>
            </div>

            <div className="w-full h-48 bg-slate-50 rounded-xl border border-slate-200 shadow-inner relative flex items-center justify-center p-4">
                <svg viewBox="0 0 400 120" className="w-full h-full relative z-10">
                    {/* Zones */}
                    <circle cx="80" cy="60" r="40" fill={action === 'stimulus' ? '#ea580c' : '#ffffff'} stroke={action === 'stimulus' ? 'transparent' : '#cbd5e1'} strokeWidth="2" opacity={action === 'stimulus' ? 0.3 : 1} className="transition-all duration-300" />
                    <circle cx="200" cy="60" r="40" fill={action === 'response' ? '#eab308' : '#ffffff'} stroke={action === 'response' ? 'transparent' : '#cbd5e1'} strokeWidth="2" opacity={action === 'response' ? 0.3 : 1} className="transition-all duration-300" />
                    <circle cx="320" cy="60" r="40" fill={action === 'reinforcement' ? '#22c55e' : '#ffffff'} stroke={action === 'reinforcement' ? 'transparent' : '#cbd5e1'} strokeWidth="2" opacity={action === 'reinforcement' ? 0.3 : 1} className="transition-all duration-300" />

                    <text x="80" y="65" fill={action === 'stimulus' ? '#f97316' : '#64748b'} fontSize="12" fontWeight="bold" textAnchor="middle">Stimulus</text>
                    <text x="200" y="65" fill={action === 'response' ? '#eab308' : '#64748b'} fontSize="12" fontWeight="bold" textAnchor="middle">Behavior</text>
                    <text x="320" y="65" fill={action === 'reinforcement' ? '#22c55e' : '#64748b'} fontSize="12" fontWeight="bold" textAnchor="middle">Reward</text>

                    {/* Connecting Lines */}
                    <path d="M 120 60 Q 140 40 160 60" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                    <path d="M 240 60 Q 260 40 280 60" fill="none" stroke="#cbd5e1" strokeWidth="2" />

                    {/* Animated Particles based on state */}
                    {action === 'stimulus' && (
                        <circle cx="140" cy="60" r="4" fill="#ea580c" className="animate-[bounce_0.5s_infinite]" />
                    )}
                    {action === 'response' && (
                        <circle cx="260" cy="60" r="4" fill="#eab308" className="animate-[bounce_0.5s_infinite]" />
                    )}

                    {/* Reinforcement Feedback Loop (Back to Stimulus) */}
                    <path d="M 320 100 Q 200 130 80 100" fill="none" stroke={action === 'reinforcement' ? '#16a34a' : '#cbd5e1'} strokeWidth="2" strokeDasharray={action === 'reinforcement' ? '5,5' : 'none'} className={action === 'reinforcement' ? 'animate-[dash_1s_linear_infinite]' : ''} />
                    {action === 'reinforcement' && (
                        <text x="200" y="115" fill="#16a34a" fontSize="10" fontWeight="bold" textAnchor="middle">Strengthens Association</text>
                    )}
                </svg>
            </div>
            <div className="absolute top-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        </div>
    );
};
