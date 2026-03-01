import React, { useState } from 'react';

export const GeckoAdhesionDiagram = () => {
    const [distance, setDistance] = useState(50); // 0 to 100

    // Distance 100 = far away (no force)
    // Distance 0 = touching (max force)

    // Calculate visualization parameters based on distance
    const setaeY = 150 + (100 - distance) * 0.4;
    const forceOpacity = 1 - (distance / 100);
    const forceRadius = 10 * forceOpacity + 2;

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: Van der Waals Adhesion</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Drag the slider to bring the gecko's microscopic spatulae closer to the atomic surface. Notice how the electrostatic forces only engage at extreme proximity.
            </p>

            <div className="w-full max-w-sm mb-6 flex flex-col items-center">
                <input
                    type="range"
                    min="0" max="100"
                    value={distance}
                    onChange={(e) => setDistance(Number(e.target.value))}
                    className="w-full accent-lime-600 mb-2"
                />
                <div className="flex justify-between w-full text-xs font-semibold text-slate-400">
                    <span>Attaching (0nm)</span>
                    <span>Approaching...</span>
                    <span>Detached (100nm)</span>
                </div>
            </div>

            <svg viewBox="0 0 600 300" className="w-full max-w-2xl bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                {/* Surface */}
                <rect x="50" y="210" width="500" height="50" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
                <text x="300" y="240" textAnchor="middle" className="font-bold fill-slate-500 text-sm">Atomic Surface (e.g. Glass)</text>

                {/* Setae Group that moves up and down */}
                <g style={{ transform: `translateY(${distance - 50}px)`, transition: 'transform 0.1s ease-out' }}>
                    <path d="M 250 10 Q 250 120 200 170" fill="none" stroke="#65a30d" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 350 10 Q 350 120 400 170" fill="none" stroke="#65a30d" strokeWidth="8" strokeLinecap="round" />

                    {/* Spatulae */}
                    <g stroke="#84cc16" strokeWidth="3" strokeLinecap="round">
                        <line x1="200" y1="170" x2="175" y2="195" />
                        <line x1="200" y1="170" x2="200" y2="195" />
                        <line x1="200" y1="170" x2="225" y2="195" />

                        <line x1="400" y1="170" x2="375" y2="195" />
                        <line x1="400" y1="170" x2="400" y2="195" />
                        <line x1="400" y1="170" x2="425" y2="195" />
                    </g>

                    <text x="300" y="40" textAnchor="middle" className="font-bold text-lg fill-lime-900 drop-shadow-md">Gecko Toe Setae</text>
                    <text x="300" y="140" textAnchor="middle" className="text-xs font-semibold fill-lime-700 bg-white px-2">Microscopic Spatulae</text>
                </g>

                {/* Van der Waals indicators (stationary on surface, intensity changes) */}
                <g style={{ opacity: forceOpacity, transition: 'opacity 0.1s ease-out' }}>
                    {[175, 200, 225, 375, 400, 425].map((x, i) => (
                        <circle key={i} cx={x} cy="200" r={forceRadius} fill="none" stroke="#f43f5e" strokeWidth={1.5 + forceOpacity * 2} strokeDasharray="2 2" />
                    ))}
                    <text x="300" y="205" textAnchor="middle" className="font-bold text-red-600 text-sm drop-shadow-sm">Van der Waals Forces Active!</text>
                </g>
                <g style={{ opacity: distance > 60 ? 1 : 0, transition: 'opacity 0.2s' }}>
                    <text x="300" y="180" textAnchor="middle" className="font-bold text-slate-400 text-sm">No attractive force</text>
                </g>

            </svg>
        </div>
    );
};
