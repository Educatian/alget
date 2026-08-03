import React, { useState } from 'react';
import { AccessibleSvg } from './AccessibleSvg';

export const CellularSolidDiagram = () => {
    const [density, setDensity] = useState(0.8); // 0.1 to 1.0

    // Compute derived values
    // Compressive strength roughly scales with relative density squared or cubed depending on foam type.
    const strength = Math.pow(density, 2) * 100;
    const mass = density * 100;

    return (
        <div className="my-8 p-6 bg-[var(--ath-panel-muted)] rounded-2xl border border-[var(--ath-line)] shadow-sm max-w-2xl mx-auto font-sans">
            <h3 className="text-xl font-bold text-[var(--ath-text)] mb-2">Cellular Solid Density Optimization</h3>
            <p className="text-sm text-[var(--ath-muted)] mb-6">Adjust the relative density to see the trade-off between structural mass and compressive strength (modeled after trabecular bone).</p>

            <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-full md:w-1/3 space-y-6 bg-[var(--ath-panel)] p-5 rounded-xl border border-[var(--ath-line)] shadow-sm">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label htmlFor="cellular-density" className="text-xs font-bold text-[var(--ath-muted)] uppercase tracking-wider">Relative Density</label>
                            <span className="text-xs font-bold text-[var(--ath-primary)]">{density.toFixed(2)}</span>
                        </div>
                        <input
                            id="cellular-density"
                            type="range" min="0.1" max="1.0" step="0.05" value={density}
                            onChange={(e) => setDensity(Number(e.target.value))}
                            className="w-full h-2 bg-[var(--ath-line)] rounded-lg appearance-none cursor-pointer accent-[var(--ath-primary)]"
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-[var(--ath-line)]">
                        <div className="flex justify-between">
                            <span className="text-xs text-[var(--ath-muted)] font-bold uppercase">Mass</span>
                            <span className="text-xs font-bold text-[var(--ath-text)]">{mass.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-[var(--ath-line)] h-2 rounded-full overflow-hidden">
                            <div className="bg-orange-400 h-full transition-all duration-300" style={{ width: `${mass}%` }}></div>
                        </div>

                        <div className="flex justify-between pt-2">
                            <span className="text-xs text-[var(--ath-muted)] font-bold uppercase">Strength</span>
                            <span className="text-xs font-bold text-[var(--ath-text)]">{strength.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-[var(--ath-line)] h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${strength}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-2/3 h-64 bg-[var(--ath-panel)] rounded-xl border border-[var(--ath-line)] shadow-inner flex items-center justify-center overflow-hidden">
                    <AccessibleSvg
                        viewBox="0 0 200 200"
                        className="w-full h-full p-4"
                        title="Cellular solid honeycomb infill"
                        desc={`A honeycomb-celled block under a downward load. Wall thickness grows with relative density, currently ${density.toFixed(2)}, giving ${mass.toFixed(1)} percent mass and ${strength.toFixed(1)} percent compressive strength.`}
                    >
                        {/* Define the honeycomb/cellular grid */}
                        <defs>
                            <pattern id="hexagons" width="40" height="69.282" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
                                <path
                                    d="M 40 11.547 L 40 34.641 L 20 46.188 L 0 34.641 L 0 11.547 L 20 0 Z M 20 46.188 L 20 69.282 L 0 80.829 L -20 69.282 L -20 46.188 L 0 34.641 Z"
                                    fill="none"
                                    stroke="var(--ath-text)"
                                    strokeWidth={2 + density * 12}
                                    strokeLinejoin="round"
                                />
                            </pattern>
                        </defs>

                        {/* Rendering the cellular infill block */}
                        <g transform="translate(100, 100)">
                            {/* Block outline */}
                            <path d="M -70 -70 L 70 -70 L 40 70 L -100 70 Z" fill="url(#hexagons)" opacity="0.8" stroke="var(--ath-text)" strokeWidth="3" />
                            <path d="M -70 -70 L 70 -70 L 40 70 L -100 70 Z" fill="none" stroke="var(--ath-text)" strokeWidth="4" strokeLinejoin="round" />

                            {/* Simulating load press */}
                            <line x1="0" y1="-100" x2="0" y2="-75" stroke="#ef4444" strokeWidth="4" markerEnd="url(#force-arrow)" />
                        </g>

                        <defs>
                            <marker id="force-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                            </marker>
                        </defs>
                    </AccessibleSvg>
                </div>
            </div>
        </div>
    );
};
