import React, { useState } from 'react';

export const TorqueDiagram = () => {
    const [force, setForce] = useState(50); // 0 to 100
    const [angle, setAngle] = useState(90); // 0 to 180

    // Geometry calculations
    const cx = 50;
    const cy = 150;
    const armLength = 120;

    // Calculate the end of the wrench arm
    const endX = cx + armLength;
    const endY = cy;

    // Calculate force vector
    const forceMagnitude = force * 0.8;
    const angleRad = (angle * Math.PI) / 180;
    const fx = endX + forceMagnitude * Math.cos(angleRad);
    const fy = endY - forceMagnitude * Math.sin(angleRad);

    // Calculate actual torque (normalized for display)
    const torqueAmount = force * Math.sin(angleRad);

    return (
        <div className="my-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto font-sans">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Interactive Torque Simulation</h3>
            <p className="text-sm text-slate-500 mb-6">Adjust the applied force and angle to see how it affects the generated torque on the joint. Try to maximize the torque.</p>

            <div className="flex flex-col md:flex-row gap-8 items-center">
                {/* Left: Controls */}
                <div className="w-full md:w-1/3 space-y-6 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Applied Force</label>
                            <span className="text-xs font-bold text-indigo-600">{force} N</span>
                        </div>
                        <input
                            type="range" min="10" max="100" value={force}
                            onChange={(e) => setForce(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Angle (θ)</label>
                            <span className="text-xs font-bold text-indigo-600">{angle}°</span>
                        </div>
                        <input
                            type="range" min="0" max="180" value={angle}
                            onChange={(e) => setAngle(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Generated Torque ($\tau$)</p>
                        <div className="text-3xl font-black text-slate-800 tracking-tight">
                            {Math.round(torqueAmount)} <span className="text-base font-semibold text-slate-400">N·m</span>
                        </div>
                    </div>
                </div>

                {/* Right: Visualization */}
                <div className="w-full md:w-2/3 h-64 bg-white rounded-xl border border-slate-100 shadow-inner flex items-center justify-center relative overflow-hidden">
                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>

                    <svg viewBox="0 0 300 250" className="w-full h-full drop-shadow-md">
                        {/* The Joint / Nut */}
                        <circle cx={cx} cy={cy} r="12" fill="#475569" />
                        <circle cx={cx} cy={cy} r="6" fill="#94a3b8" />

                        {/* Visual representation of the torque (circular arrow) */}
                        {torqueAmount > 5 && (
                            <path
                                d={`M ${cx},${cy - 25} A 25 25 0 0 1 ${cx + 25},${cy}`}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="3"
                                markerEnd="url(#arrowhead)"
                                strokeDasharray="4 2"
                                opacity={Math.min(1, torqueAmount / 100)}
                                className={torqueAmount > 50 ? 'animate-pulse' : ''}
                            />
                        )}

                        {/* Defs for arrowheads */}
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                            </marker>
                            <marker id="force-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                            </marker>
                        </defs>

                        {/* Wrench / Arm */}
                        <path d={`M ${cx} ${cy - 8} L ${endX} ${cy - 6} L ${endX} ${cy + 6} L ${cx} ${cy + 8} Z`} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                        <circle cx={endX} cy={cy} r="3" fill="#cbd5e1" />

                        {/* Force Vector (Red Arrow) */}
                        <line
                            x1={endX} y1={cy}
                            x2={fx} y2={fy}
                            stroke="#ef4444"
                            strokeWidth="4"
                            markerEnd="url(#force-arrow)"
                            className="transition-all duration-200"
                        />

                        {/* Angle Arc Indicator */}
                        <path
                            d={`M ${endX - 15} ${cy} A 15 15 0 0 0 ${endX - 15 * Math.cos(angleRad)} ${cy - 15 * Math.sin(angleRad)}`}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                        />
                        <text x={endX - 25} y={cy - 15} fill="#3b82f6" fontSize="10" fontWeight="bold">θ</text>
                        <text x={fx + 5} y={fy - 5} fill="#ef4444" fontSize="12" fontWeight="bold">F</text>
                        <text x={cx + 60} y={cy + 20} fill="#64748b" fontSize="12" fontWeight="bold">r</text>
                    </svg>
                </div>
            </div>
        </div>
    );
};
