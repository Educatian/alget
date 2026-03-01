import React, { useState } from 'react';

export const FormativeSummativeDiagram = () => {
    const [view, setView] = useState('both'); // formative, summative, both

    return (
        <div className="my-8 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.2)] max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-slate-800 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-pink-400">⚖️</span> Assessment Types
                    </h3>
                    <p className="text-sm text-slate-400">Compare continuous (formative) vs final point-in-time (summative) evaluation.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setView('formative')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'formative' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Formative
                    </button>
                    <button
                        onClick={() => setView('summative')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'summative' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Summative
                    </button>
                    <button
                        onClick={() => setView('both')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'both' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Compare Both
                    </button>
                </div>
            </div>

            <div className="w-full h-48 bg-slate-950 rounded-xl border border-slate-800/50 shadow-inner relative flex items-center justify-center p-4">
                <svg viewBox="0 0 400 120" className="w-full h-full relative z-10">
                    <defs>
                        <mask id="fadeMask" x="0" y="0" width="400" height="120">
                            <rect x="0" y="0" width="400" height="120" fill="white" />
                        </mask>
                    </defs>

                    {/* Time Axis */}
                    <line x1="20" y1="100" x2="380" y2="100" stroke="#334155" strokeWidth="2" />
                    <text x="380" y="115" fill="#64748b" fontSize="8" textAnchor="end">Learning Timeline →</text>
                    <text x="20" y="115" fill="#64748b" fontSize="8" textAnchor="start">Start</text>

                    {/* Formative Concept (Continuous Cycle) */}
                    <g className={`transition-all duration-500 ${view === 'summative' ? 'opacity-10 grayscale' : 'opacity-100'}`}>
                        {/* Iteration 1 */}
                        <circle cx="80" cy="70" r="15" fill="none" stroke="#db2777" strokeWidth="2" className="animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '80px 70px' }} strokeDasharray="30 15" />
                        <circle cx="80" cy="70" r="4" fill="#db2777" />
                        <text x="80" y="45" fill="#f472b6" fontSize="8" textAnchor="middle" fontWeight="bold">Quiz 1</text>
                        <line x1="80" y1="85" x2="80" y2="100" stroke="#db2777" strokeWidth="1" strokeDasharray="2,2" />

                        {/* Iteration 2 */}
                        <circle cx="160" cy="50" r="15" fill="none" stroke="#db2777" strokeWidth="2" className="animate-[spin_4s_linear_infinite_reverse]" style={{ transformOrigin: '160px 50px' }} strokeDasharray="30 15" />
                        <circle cx="160" cy="50" r="4" fill="#db2777" />
                        <text x="160" y="25" fill="#f472b6" fontSize="8" textAnchor="middle" fontWeight="bold">Draft Review</text>
                        <line x1="160" y1="65" x2="160" y2="100" stroke="#db2777" strokeWidth="1" strokeDasharray="2,2" />

                        {/* Iteration 3 */}
                        <circle cx="240" cy="65" r="15" fill="none" stroke="#db2777" strokeWidth="2" className="animate-[spin_4s_linear_infinite]" style={{ transformOrigin: '240px 65px' }} strokeDasharray="30 15" />
                        <circle cx="240" cy="65" r="4" fill="#db2777" />
                        <text x="240" y="40" fill="#f472b6" fontSize="8" textAnchor="middle" fontWeight="bold">Peer Feedback</text>
                        <line x1="240" y1="80" x2="240" y2="100" stroke="#db2777" strokeWidth="1" strokeDasharray="2,2" />

                        {/* Growth curve */}
                        <path d="M 20 100 Q 80 70 160 50 T 240 65 T 320 20" fill="none" stroke="#db2777" strokeWidth="2" opacity="0.3" />
                    </g>

                    {/* Summative Concept (Final Exam) */}
                    <g className={`transition-all duration-500 ${view === 'formative' ? 'opacity-10 grayscale' : 'opacity-100'}`}>
                        {/* Finish Line */}
                        <rect x="340" y="10" width="10" height="90" fill="#4f46e5" opacity="0.2" />
                        <rect x="350" y="10" width="10" height="90" fill="#4338ca" opacity="0.4" />

                        {/* Big Evaluation */}
                        <polygon points="350,15 370,40 350,65" fill="#6366f1" />
                        <circle cx="350" cy="40" r="8" fill="#818cf8" className="animate-pulse" />
                        <text x="350" y="85" fill="#a5b4fc" fontSize="9" textAnchor="middle" fontWeight="bold">Final Exam</text>
                        <text x="350" y="95" fill="#818cf8" fontSize="7" textAnchor="middle">&quot;Autopsy&quot;</text>

                        <line x1="350" y1="20" x2="350" y2="100" stroke="#4f46e5" strokeWidth="2" />
                    </g>

                    <rect x="10" y="10" width="80" height="20" rx="4" fill={view === 'formative' || view === 'both' ? '#db2777' : '#334155'} className="transition-colors duration-300" />
                    <text x="50" y="24" fill="white" fontSize="9" textAnchor="middle" fontWeight="bold">Formative = During</text>

                    <rect x="290" y="10" width="90" height="20" rx="4" fill={view === 'summative' || view === 'both' ? '#4f46e5' : '#334155'} className="transition-colors duration-300" />
                    <text x="335" y="24" fill="white" fontSize="9" textAnchor="middle" fontWeight="bold">Summative = After</text>

                </svg>
            </div>
            {(view === 'formative' || view === 'both') && <div className="absolute top-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-[60px] pointer-events-none"></div>}
            {(view === 'summative' || view === 'both') && <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none"></div>}
        </div>
    );
};
