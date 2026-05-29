import React, { useState } from 'react';
import { AccessibleSvg } from './AccessibleSvg';

export const DirectionalAdhesionDiagram = () => {
    const [angle, setAngle] = useState(0); // -45 to 45 deg representing angle of applied pull

    const isEngaged = angle >= -10 && angle <= 20; // Engaged effectively when pulling straight or slightly forward

    return (
        <div className="my-8 p-6 bg-[var(--ath-panel)] rounded-2xl border border-[var(--ath-line)] shadow-lg max-w-2xl mx-auto font-sans relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between mb-6 border-b border-[var(--ath-line)] pb-6">
                <div>
                    <h3 className="text-xl font-bold text-[var(--ath-text)] mb-1">Directional Adhesion</h3>
                    <p className="text-sm text-[var(--ath-muted)]">Change the pull angle to see the van der Waals forces engage (sticking) or disengage (peeling).</p>
                </div>

                <div className="w-1/3">
                    <label htmlFor="adhesion-pull-angle" className="text-xs font-bold text-[var(--ath-muted)] uppercase mb-2 block text-right">Pull Angle ($\theta$)</label>
                    <input
                        id="adhesion-pull-angle"
                        type="range" min="-45" max="45" value={angle}
                        aria-label="Pull angle in degrees"
                        onChange={(e) => setAngle(Number(e.target.value))}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isEngaged ? 'bg-emerald-500/30 accent-emerald-500' : 'bg-red-500/30 accent-red-500'}`}
                    />
                </div>
            </div>

            <div className="w-full h-64 bg-[var(--ath-panel-muted)] rounded-xl border border-[var(--ath-line)] shadow-inner relative flex items-center justify-center p-4">
                <AccessibleSvg
                    viewBox="0 0 400 200"
                    className="w-full h-full relative z-10"
                    title="Directional gecko adhesion at pull angle"
                    desc={`A gecko foot pad on a surface, pulled at ${angle} degrees. ${isEngaged ? 'Van der Waals forces are engaged and the pad is locked to the surface.' : 'The contact is broken and the pad is peeling away from the surface.'}`}
                >
                    <defs>
                        <radialGradient id="vdw-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* The Surface (Glass/Wall) */}
                    <rect x="0" y="160" width="400" height="40" fill="#334155" />
                    <line x1="0" y1="160" x2="400" y2="160" stroke="var(--ath-line-strong)" strokeWidth="2" />

                    {/* The Spatulae (Gecko foot pad) */}
                    <g transform={`translate(200, 150) rotate(${angle}) translate(-200, -150)`}>
                        <rect x="150" y="80" width="100" height="70" fill="#475569" rx="8" className="transition-all duration-300" />

                        {/* Micro-pillars / Setae branches */}
                        {[...Array(8)].map((_, i) => (
                            <line
                                key={i}
                                x1={160 + i * 11} y1="150"
                                x2={165 + i * 11} y2="160"
                                stroke="#94a3b8"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                        ))}

                        {/* Force Indicator Arrow */}
                        <path d="M 200 80 L 200 30" fill="none" stroke={isEngaged ? '#10b981' : '#ef4444'} strokeWidth="4" markerEnd="url(#arrow)" strokeDasharray="5" className="animate-[dash_1s_linear_infinite]" />
                    </g>

                    {/* Van der Waals Engagement Visuals */}
                    {isEngaged && (
                        <g>
                            <rect x="160" y="155" width="90" height="10" fill="url(#vdw-glow)" className="animate-pulse" style={{ animationDuration: '0.8s' }} />
                            <text x="200" y="185" fill="#34d399" fontSize="12" fontWeight="bold" textAnchor="middle">Van der Waals Forces Engaged (Locked)</text>
                        </g>
                    )}

                    {!isEngaged && (
                        <text x="200" y="185" fill="#fca5a5" fontSize="12" fontWeight="bold" textAnchor="middle">Contact Broken (Peeling)</text>
                    )}

                    <defs>
                        <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill={isEngaged ? '#10b981' : '#ef4444'} />
                        </marker>
                    </defs>
                </AccessibleSvg>
            </div>

            {/* Engagement state + pull angle surfaced as text + live region so it is not color-only (WCAG 1.4.1) */}
            <div aria-live="polite" className="relative z-10 mt-4 text-center text-sm">
                <span className="font-semibold text-[var(--ath-muted)]">Pull angle {angle}°: </span>
                <span className="font-bold text-[var(--ath-text)]">
                    {isEngaged ? 'Adhesion engaged (locked)' : 'Adhesion broken (peeling)'}
                </span>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none"></div>
        </div>
    );
};
