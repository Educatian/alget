import React, { useState } from 'react';
import { AccessibleSvg } from './AccessibleSvg';

const STAGE_LABEL = {
    sensory: 'Sensory register (1-3s input)',
    working: 'Working memory (capacity 7±2)',
    longTerm: 'Long-term memory (effectively unlimited)',
};

export const CognitivismDiagram = () => {
    const [processStage, setProcessStage] = useState('sensory'); // sensory, working, longTerm

    const sequence = ['sensory', 'working', 'longTerm'];
    const handleNextStage = () => {
        const currentIndex = sequence.indexOf(processStage);
        setProcessStage(sequence[(currentIndex + 1) % sequence.length]);
    };

    return (
        <div className="my-8 p-6 bg-[var(--ath-panel)] rounded-2xl border border-[var(--ath-line)] shadow-md max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-[var(--ath-line)] pb-6">
                <div>
                    <h3 className="text-xl font-bold text-[var(--ath-text)] mb-1 flex items-center gap-2">
                        <span className="text-blue-500" aria-hidden="true">🧠</span> Information Processing
                    </h3>
                    <p className="text-sm text-[var(--ath-muted)]">Simulate how the mind processes, encodes, and stores information like a computer.</p>
                </div>
                <button
                    onClick={handleNextStage}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
                >
                    Process to: {sequence[(sequence.indexOf(processStage) + 1) % sequence.length]}
                </button>
            </div>

            <div className="w-full h-48 bg-[var(--ath-panel-muted)] rounded-xl border border-[var(--ath-line)] shadow-inner relative flex items-center justify-center p-4">
                <AccessibleSvg
                    viewBox="0 0 400 120"
                    className="w-full h-full relative z-10"
                    title="Information processing memory model"
                    desc={`Information flows through three stores connected by arrows: the Sensory register, then Working memory (via Attention), then Long-term memory (via Encoding, with a Retrieval arrow back). The currently highlighted stage is: ${STAGE_LABEL[processStage]}.`}
                >
                    <defs>
                        <radialGradient id="data-pulse" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* 1. Sensory Register */}
                    <rect x="20" y="30" width="80" height="60" rx="8" fill={processStage === 'sensory' ? '#bfdbfe' : 'var(--ath-panel)'} stroke="#3b82f6" strokeWidth={processStage === 'sensory' ? 3 : 1} className="transition-all duration-300" />
                    <text x="60" y="55" fill="#1e40af" fontSize="10" fontWeight="bold" textAnchor="middle">Sensory</text>
                    <text x="60" y="70" fill="var(--ath-muted)" fontSize="9" textAnchor="middle">Input (1-3s)</text>
                    {processStage === 'sensory' && (
                        <circle cx="10" cy="60" r="15" fill="url(#data-pulse)" className="animate-ping" />
                    )}

                    {/* Arrow 1 (Attention) */}
                    <path d="M 105 60 L 165 60" stroke="var(--ath-line-strong)" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    <path d="M 105 60 L 165 60" stroke="#2563eb" strokeWidth="2" strokeDasharray="5" className={`transition-opacity duration-300 ${processStage === 'working' ? 'opacity-100 animate-[dash_1s_linear_infinite]' : 'opacity-0'}`} />
                    <text x="135" y="50" fill={processStage === 'working' ? '#1e40af' : 'var(--ath-muted)'} fontSize="9" textAnchor="middle" className="font-bold">Attention</text>

                    {/* 2. Working Memory */}
                    <rect x="170" y="20" width="90" height="80" rx="8" fill={processStage === 'working' ? '#bfdbfe' : 'var(--ath-panel)'} stroke="#3b82f6" strokeWidth={processStage === 'working' ? 3 : 1} className="transition-all duration-300" />
                    <text x="215" y="45" fill="#1e40af" fontSize="11" textAnchor="middle" fontWeight="bold">Working Memory</text>
                    <text x="215" y="60" fill="var(--ath-muted)" fontSize="9" textAnchor="middle">Capacity: 7±2</text>
                    {processStage === 'working' && (
                        <g className="animate-spin" style={{ transformOrigin: '215px 80px' }}>
                            <circle cx="205" cy="80" r="3" fill="#60a5fa" />
                            <circle cx="225" cy="80" r="3" fill="#60a5fa" />
                            <circle cx="215" cy="70" r="3" fill="#60a5fa" />
                            <circle cx="215" cy="90" r="3" fill="#60a5fa" />
                        </g>
                    )}

                    {/* Arrow 2 (Encoding / Retrieval) */}
                    {/* Encoding */}
                    <path d="M 265 50 L 305 50" stroke="var(--ath-line-strong)" strokeWidth="2" />
                    <path d="M 265 50 L 305 50" stroke="#4f46e5" strokeWidth="2" strokeDasharray="5" className={`transition-opacity duration-300 ${processStage === 'longTerm' ? 'opacity-100 animate-[dash_1s_linear_infinite]' : 'opacity-0'}`} />
                    <polygon points="305,47 310,50 305,53" fill={processStage === 'longTerm' ? '#4f46e5' : 'var(--ath-line-strong)'} />
                    <text x="285" y="42" fill={processStage === 'longTerm' ? '#4f46e5' : 'var(--ath-muted)'} fontSize="8" fontWeight="bold" textAnchor="middle">Encoding</text>

                    {/* Retrieval */}
                    <path d="M 305 70 L 265 70" stroke="var(--ath-line-strong)" strokeWidth="2" />
                    <polygon points="265,67 260,70 265,73" fill="var(--ath-line-strong)" />
                    <text x="285" y="83" fill="var(--ath-muted)" fontSize="8" textAnchor="middle">Retrieval</text>

                    {/* 3. Long Term Memory */}
                    <rect x="315" y="30" width="70" height="60" rx="8" fill={processStage === 'longTerm' ? '#e0e7ff' : 'var(--ath-panel)'} stroke="#6366f1" strokeWidth={processStage === 'longTerm' ? 3 : 1} className="transition-all duration-300" />
                    <text x="350" y="55" fill="#3730a3" fontSize="10" fontWeight="bold" textAnchor="middle">Long-Term</text>
                    <text x="350" y="70" fill="var(--ath-muted)" fontSize="9" textAnchor="middle">Infinite Size</text>
                    {processStage === 'longTerm' && (
                        <g>
                            <line x1="330" y1="80" x2="370" y2="80" stroke="#60a5fa" strokeWidth="2" className="animate-pulse" />
                            <line x1="330" y1="85" x2="360" y2="85" stroke="#60a5fa" strokeWidth="2" className="animate-pulse delay-75" />
                        </g>
                    )}
                </AccessibleSvg>
            </div>

            {/* Active stage as text + live region so the highlighted store is not signalled by color alone (WCAG 1.4.1) */}
            <div aria-live="polite" className="relative z-10 mt-4 text-center text-sm">
                <span className="font-semibold text-[var(--ath-muted)]">Active store: </span>
                <span className="font-bold text-[var(--ath-text)]">{STAGE_LABEL[processStage]}</span>
            </div>
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        </div>
    );
};
