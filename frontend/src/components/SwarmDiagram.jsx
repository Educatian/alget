import React from 'react';

export const SwarmDiagram = () => {
    return (
        <div className="my-8 flex justify-center">
            <svg viewBox="0 0 600 300" className="w-full max-w-2xl drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
                {/* Nest */}
                <circle cx="100" cy="150" r="40" fill="#fcd34d" stroke="#b45309" strokeWidth="3" />
                <text x="100" y="155" textAnchor="middle" className="font-bold fill-amber-900 text-sm">Nest</text>

                {/* Food */}
                <circle cx="500" cy="150" r="30" fill="#86efac" stroke="#15803d" strokeWidth="3" />
                <text x="500" y="155" textAnchor="middle" className="font-bold fill-green-900 text-sm">Food</text>

                {/* Long Path */}
                <path d="M 140 150 Q 300 30 470 150" fill="none" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
                {/* Ants on long path */}
                <circle cx="200" cy="100" r="4" fill="#000" />
                <circle cx="400" cy="100" r="4" fill="#000" />

                {/* Short Path (High pheromone) */}
                <path d="M 140 150 Q 300 280 470 150" fill="none" stroke="#f87171" strokeWidth="15" strokeLinecap="round" />
                {/* Ants on short path */}
                <g fill="#000">
                    <circle cx="200" cy="190" r="5" />
                    <circle cx="220" cy="205" r="5" />
                    <circle cx="250" cy="215" r="5" />
                    <circle cx="280" cy="218" r="5" />
                    <circle cx="310" cy="215" r="5" />
                    <circle cx="340" cy="205" r="5" />
                    <circle cx="370" cy="190" r="5" />
                </g>

                <text x="300" y="30" textAnchor="middle" className="text-sm font-bold fill-slate-400">Long Route (Pheromones decay)</text>
                <text x="300" y="260" textAnchor="middle" className="text-sm font-bold fill-red-600">Short Route (Stigmergy / Strong Pheromone)</text>

                <text x="300" y="150" textAnchor="middle" className="font-bold text-xl fill-slate-800 opacity-20">SWARM INTELLIGENCE</text>
            </svg>
        </div>
    );
};
