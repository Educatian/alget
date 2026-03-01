import React, { useState, useEffect } from 'react';

export const SelfHealingDiagram = () => {
    const [crackProgress, setCrackProgress] = useState(0); // 0 to 100
    const [isStressing, setIsStressing] = useState(false);

    useEffect(() => {
        let interval;
        if (isStressing && crackProgress < 100) {
            interval = setInterval(() => {
                setCrackProgress(p => p + 2);
            }, 30);
        } else if (crackProgress >= 100) {
            setIsStressing(false);
        }
        return () => clearInterval(interval);
    }, [isStressing, crackProgress]);

    const handleStress = () => {
        setCrackProgress(0);
        setIsStressing(true);
    };

    // Calculate crack path dynamically
    // Path points: (300,50) -> (310, 100) -> (290, 130) -> (330, 170) -> (310, 220)

    // Stages of the crack:
    const stage1 = Math.min(crackProgress, 25) / 25; // 0 to 1
    const stage2 = Math.max(0, Math.min(crackProgress - 25, 25)) / 25;
    const stage3 = Math.max(0, Math.min(crackProgress - 50, 25)) / 25;
    const stage4 = Math.max(0, Math.min(crackProgress - 75, 25)) / 25;

    const x1 = 300 + (10 * stage1);
    const y1 = 50 + (50 * stage1);

    const x2 = x1 - (20 * stage2);
    const y2 = y1 + (30 * stage2);

    const x3 = x2 + (40 * stage3);
    const y3 = y2 + (40 * stage3);

    const x4 = x3 - (20 * stage4);
    const y4 = y3 + (50 * stage4);

    const crackPath = `M 300 50 L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4}`;

    // Has it hit the capsules?
    const hitCapsule1 = crackProgress > 50; // Hits the capsule near y=170

    // Healing agent bleed
    const bleedOpacity = hitCapsule1 ? Math.min(1, (crackProgress - 50) / 20) : 0;
    const polymerizedOpacity = hitCapsule1 ? Math.min(1, (crackProgress - 70) / 20) : 0;

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: Vascular Self-Healing Polymer</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg min-h-[40px]">
                {crackProgress === 0 && "Click 'Apply Stress' to simulate material shear."}
                {crackProgress > 0 && crackProgress < 50 && "Crack propagating through the polymer matrix..."}
                {crackProgress >= 50 && crackProgress < 90 && "Crack ruptures embedded microcapsule! Healing agent released."}
                {crackProgress >= 90 && "Healing agent interacts with catalyst and polymerizes, structurally sealing the crack."}
            </p>

            <button
                onClick={handleStress}
                disabled={isStressing}
                className="mb-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded-lg transition-colors shadow-sm active:scale-95"
            >
                {crackProgress === 0 ? "Apply Structural Stress" : (crackProgress >= 100 ? "Reset & Re-stress" : "Fracturing...")}
            </button>

            <svg viewBox="0 0 600 300" className="w-full max-w-2xl drop-shadow-sm rounded-lg overflow-hidden border border-slate-100">
                {/* Polymer Matrix */}
                <rect x="0" y="0" width="600" height="300" fill="#f8fafc" />
                <text x="300" y="30" textAnchor="middle" className="font-bold text-sm fill-slate-400 tracking-widest uppercase">Polymer Matrix</text>

                {/* Embedded Catalyst */}
                <g fill="#a855f7" opacity="0.6">
                    <circle cx="280" cy="110" r="4" />
                    <circle cx="320" cy="140" r="4" />
                    <circle cx="290" cy="160" r="4" />
                    <circle cx="340" cy="180" r="4" />
                    <circle cx="310" cy="200" r="4" />
                    <circle cx="280" cy="220" r="4" />
                </g>

                {/* Microcapsules */}
                <circle cx="200" cy="120" r="20" fill="#38bdf8" opacity="0.6" stroke="#0ea5e9" strokeWidth="2" />
                <circle cx="440" cy="190" r="25" fill="#38bdf8" opacity="0.6" stroke="#0ea5e9" strokeWidth="2" />

                {/* Specific Target Capsule */}
                <g>
                    {/* Shell */}
                    <circle cx="330" cy="170" r="20" fill="#38bdf8" opacity={hitCapsule1 ? 0.2 : 0.6} stroke="#0ea5e9" strokeWidth="2" strokeDasharray={hitCapsule1 ? "4 4" : "none"} />
                    {/* Liquid core */}
                    {hitCapsule1 && <circle cx="330" cy="170" r="18" fill="#38bdf8" opacity={0.3 - bleedOpacity * 0.3} />}
                </g>

                {/* Crack */}
                <path d={crackPath} fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

                {/* Healing agent bleeding down the crack */}
                {hitCapsule1 && (
                    <path
                        d={`M 330 170 L ${x3} ${y3} L ${x4} ${y4}`}
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={bleedOpacity}
                        style={{ mixBlendMode: 'multiply' }}
                    />
                )}

                {/* Polymerized (hardened) patch */}
                {hitCapsule1 && (
                    <path
                        d={`M 330 170 L ${x3} ${y3} L ${x4} ${y4}`}
                        fill="none"
                        stroke="#7e22ce"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={polymerizedOpacity}
                        style={{ mixBlendMode: 'multiply' }}
                    />
                )}

                {/* Labels */}
                <text x="130" y="125" textAnchor="middle" className="text-[10px] font-bold fill-sky-700">Liquid Healing Agent</text>
                <text x="230" y="115" textAnchor="middle" className="text-[10px] font-bold fill-purple-700">Catalyst Grid</text>
            </svg>
        </div>
    );
};
