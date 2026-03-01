import React, { useState } from 'react';

export const BehaviorismDiagram = () => {
    const [action, setAction] = useState('idle'); // idle, stimulus, response, reinforcement
    const [conditionType, setConditionType] = useState('positive_reinforcement');

    const triggerStimulus = () => {
        setAction('stimulus');
        setTimeout(() => setAction('response'), 1200);
        setTimeout(() => setAction('reinforcement'), 2400);
        setTimeout(() => setAction('idle'), 4500);
    };

    const getConditionConfig = () => {
        switch (conditionType) {
            case 'positive_reinforcement':
                return { color: '#22c55e', text: 'Reward Added', effect: 'Increases Behavior', icon: '🎁', pathColor: '#16a34a' };
            case 'negative_reinforcement':
                return { color: '#3b82f6', text: 'Pain Removed', effect: 'Increases Behavior', icon: '🛡️', pathColor: '#2563eb' };
            case 'punishment':
                return { color: '#ef4444', text: 'Pain Added', effect: 'Decreases Behavior', icon: '⚡', pathColor: '#dc2626' };
            default:
                return { color: '#22c55e', text: 'Reward', effect: 'Strengthens', icon: '🎁', pathColor: '#16a34a' };
        }
    };

    const config = getConditionConfig();

    return (
        <div className="my-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-6 border-b border-slate-200 pb-6">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <span className="text-orange-500">🔔</span> Advanced Operant Conditioning
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">Select a conditioning type and trigger the loops to see how consequences alter future behavior.</p>

                    <div className="flex gap-2 bg-slate-100 p-1.5 rounded-lg w-fit">
                        <button onClick={() => setConditionType('positive_reinforcement')} disabled={action !== 'idle'} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${conditionType === 'positive_reinforcement' ? 'bg-white shadow text-green-700' : 'text-slate-500 hover:bg-slate-200'}`}>+ Reinforce</button>
                        <button onClick={() => setConditionType('negative_reinforcement')} disabled={action !== 'idle'} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${conditionType === 'negative_reinforcement' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}>- Reinforce</button>
                        <button onClick={() => setConditionType('punishment')} disabled={action !== 'idle'} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${conditionType === 'punishment' ? 'bg-white shadow text-red-700' : 'text-slate-500 hover:bg-slate-200'}`}>Punishment</button>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <button
                        onClick={triggerStimulus}
                        disabled={action !== 'idle'}
                        className={`px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg 
                            ${action === 'idle' ? 'bg-orange-600 hover:bg-orange-500 text-white hover:scale-105' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                    >
                        {action === 'idle' ? "Trigger Stimulus" : "Loop is Running..."}
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{action.toUpperCase()}</span>
                </div>
            </div>

            <div className="w-full h-56 bg-slate-50 rounded-xl border border-slate-200 shadow-inner relative flex items-center justify-center p-4">
                <svg viewBox="0 0 500 160" className="w-full h-full relative z-10">
                    {/* Zones */}
                    <circle cx="100" cy="70" r="45" fill={action === 'stimulus' ? '#ea580c' : '#ffffff'} stroke={action === 'stimulus' ? 'transparent' : '#cbd5e1'} strokeWidth="2" opacity={action === 'stimulus' ? 0.2 : 1} className="transition-all duration-500" />
                    <circle cx="250" cy="70" r="45" fill={action === 'response' ? '#eab308' : '#ffffff'} stroke={action === 'response' ? 'transparent' : '#cbd5e1'} strokeWidth="2" opacity={action === 'response' ? 0.2 : 1} className="transition-all duration-500" />
                    <circle cx="400" cy="70" r="45" fill={action === 'reinforcement' ? config.color : '#ffffff'} stroke={action === 'reinforcement' ? 'transparent' : '#cbd5e1'} strokeWidth="2" opacity={action === 'reinforcement' ? 0.2 : 1} className="transition-all duration-500" />

                    {/* Zone Labels */}
                    <text x="100" y="75" fill={action === 'stimulus' ? '#ea580c' : '#475569'} fontSize="14" fontWeight="bold" textAnchor="middle">Stimulus</text>
                    <text x="250" y="75" fill={action === 'response' ? '#ca8a04' : '#475569'} fontSize="14" fontWeight="bold" textAnchor="middle">Behavior</text>
                    <text x="400" y="70" fill={action === 'reinforcement' ? config.color : '#475569'} fontSize="14" fontWeight="bold" textAnchor="middle">{config.text}</text>
                    <text x="400" y="85" fill={action === 'reinforcement' ? config.color : '#94a3b8'} fontSize="10" textAnchor="middle">{config.icon}</text>

                    {/* Forward Connecting Lines */}
                    <path d="M 150 70 Q 175 50 200 70" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M 300 70 Q 325 50 350 70" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />

                    {/* Animated Particles based on state */}
                    {action === 'stimulus' && (
                        <circle cx="175" cy="70" r="5" fill="#ea580c" className="animate-[ping_0.8s_infinite]" />
                    )}
                    {action === 'response' && (
                        <circle cx="325" cy="70" r="5" fill="#eab308" className="animate-[ping_0.8s_infinite]" />
                    )}

                    {/* Feedback Loop (Back to Stimulus) */}
                    <path d="M 400 120 Q 250 170 100 120" fill="none" stroke={action === 'reinforcement' ? config.pathColor : '#cbd5e1'} strokeWidth={action === 'reinforcement' ? "4" : "2"} strokeDasharray={action === 'reinforcement' ? '8,8' : 'none'} className={`transition-all duration-300 ${action === 'reinforcement' ? 'animate-[dash_1s_linear_infinite]' : ''}`} />

                    {/* Feedback Effect Label */}
                    <g className={`transition-opacity duration-500 ${action === 'reinforcement' ? 'opacity-100' : 'opacity-0'}`}>
                        <rect x="190" y="130" width="120" height="24" rx="12" fill="white" stroke={config.color} strokeWidth="1.5" />
                        <text x="250" y="146" fill={config.color} fontSize="11" fontWeight="bold" textAnchor="middle">{config.effect}</text>
                    </g>
                </svg>
            </div>

            <div className={`absolute top-0 left-0 w-96 h-96 rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 ${action === 'idle' ? 'bg-slate-100/50' : action === 'stimulus' ? 'bg-orange-500/10' : action === 'response' ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}></div>
        </div>
    );
};
