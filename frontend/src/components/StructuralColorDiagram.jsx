import React from 'react';

export const StructuralColorDiagram = () => {
    return (
        <div className="my-8 flex justify-center">
            <svg viewBox="0 0 600 300" className="w-full max-w-2xl drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
                {/* Scale structure */}
                <g fill="none" stroke="#94a3b8" strokeWidth="4">
                    <line x1="300" y1="280" x2="300" y2="50" />

                    {/* Branches */}
                    <line x1="200" y1="250" x2="400" y2="250" strokeWidth="8" />
                    <line x1="210" y1="200" x2="390" y2="200" strokeWidth="8" />
                    <line x1="220" y1="150" x2="380" y2="150" strokeWidth="8" />
                    <line x1="230" y1="100" x2="370" y2="100" strokeWidth="8" />
                </g>

                {/* Light waves bouncing */}
                <g fill="none" strokeWidth="3">
                    {/* Blue constructive interference */}
                    <path d="M 50 150 Q 80 120 110 150 T 170 150 Q 200 120 220 150" stroke="#3b82f6" strokeDasharray="5 5" />
                    <path d="M 220 150 Q 190 120 160 150 T 100 150 Q 70 120 50 150" stroke="#3b82f6" />

                    <path d="M 50 100 Q 80 70 110 100 T 170 100 Q 200 70 230 100" stroke="#3b82f6" strokeDasharray="5 5" />
                    <path d="M 230 100 Q 200 70 170 100 T 110 100 Q 80 70 50 100" stroke="#3b82f6" />
                </g>

                <g fill="none" strokeWidth="2">
                    {/* Red destructive interference */}
                    <path d="M 550 200 Q 520 170 490 200 T 430 200 Q 400 170 390 200" stroke="#ef4444" strokeDasharray="5 5" />
                    <path d="M 390 200 Q 410 230 440 200 T 500 200 Q 530 230 550 200" stroke="#ef4444" />
                </g>

                <text x="120" y="210" textAnchor="middle" className="text-xs font-bold fill-blue-600">Constructive Interference (Blue)</text>
                <text x="470" y="250" textAnchor="middle" className="text-xs font-bold fill-red-600">Destructive Interference (Red)</text>

                <text x="300" y="30" textAnchor="middle" className="font-bold text-lg fill-slate-800">Nano-Scale Photonic Crystal (Morpho Butterfly)</text>
            </svg>
        </div>
    );
};
