import React from 'react';

export const GeckoAdhesionDiagram = () => {
    return (
        <div className="my-8 flex justify-center">
            <svg viewBox="0 0 600 300" className="w-full max-w-2xl drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
                {/* Surface */}
                <rect x="50" y="200" width="500" height="50" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
                <text x="300" y="235" textAnchor="middle" className="font-bold fill-slate-500">Atomic Surface (e.g. Glass)</text>

                {/* Setae */}
                <path d="M 250 50 Q 250 150 200 180" fill="none" stroke="#65a30d" strokeWidth="8" strokeLinecap="round" />
                <path d="M 350 50 Q 350 150 400 180" fill="none" stroke="#65a30d" strokeWidth="8" strokeLinecap="round" />

                {/* Spatulae */}
                <g stroke="#84cc16" strokeWidth="3" strokeLinecap="round">
                    <line x1="200" y1="180" x2="180" y2="200" />
                    <line x1="200" y1="180" x2="200" y2="200" />
                    <line x1="200" y1="180" x2="220" y2="200" />

                    <line x1="400" y1="180" x2="380" y2="200" />
                    <line x1="400" y1="180" x2="400" y2="200" />
                    <line x1="400" y1="180" x2="420" y2="200" />
                </g>

                {/* Van der Waals indicators */}
                <g fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="2 2">
                    <circle cx="180" cy="200" r="10" />
                    <circle cx="200" cy="200" r="10" />
                    <circle cx="220" cy="200" r="10" />
                    <circle cx="380" cy="200" r="10" />
                    <circle cx="400" cy="200" r="10" />
                    <circle cx="420" cy="200" r="10" />
                </g>

                <text x="300" y="40" textAnchor="middle" className="font-bold text-lg fill-lime-900">Gecko Toe Setae</text>
                <text x="300" y="160" textAnchor="middle" className="text-sm fill-lime-700 bg-white px-2">Microscopic Spatulae</text>
                <text x="300" y="280" textAnchor="middle" className="font-bold text-red-600">Van der Waals Electrostatic Forces</text>
            </svg>
        </div>
    );
};
