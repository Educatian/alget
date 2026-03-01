import React from 'react';

export const SelfHealingDiagram = () => {
    return (
        <div className="my-8 flex justify-center">
            <svg viewBox="0 0 600 300" className="w-full max-w-2xl drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
                {/* Polymer Matrix */}
                <rect x="50" y="50" width="500" height="200" rx="10" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
                <text x="300" y="40" textAnchor="middle" className="font-bold text-lg fill-slate-800">Vascular Self-Healing Polymer</text>

                {/* Crack */}
                <path d="M 300 50 L 310 100 L 290 130 L 320 180" fill="none" stroke="#1e293b" strokeWidth="6" />

                {/* Microcapsules */}
                <circle cx="200" cy="120" r="20" fill="#38bdf8" opacity="0.6" stroke="#0ea5e9" strokeWidth="2" />
                <circle cx="400" cy="150" r="25" fill="#38bdf8" opacity="0.6" stroke="#0ea5e9" strokeWidth="2" />
                <circle cx="280" cy="220" r="18" fill="#38bdf8" opacity="0.6" stroke="#0ea5e9" strokeWidth="2" />

                {/* Ruptured Capsule */}
                <path d="M 320 180 A 20 20 0 1 0 350 160" fill="none" stroke="#0ea5e9" strokeWidth="2" />
                <circle cx="330" cy="170" r="20" fill="#38bdf8" opacity="0.3" />

                {/* Liquid bleeding into crack */}
                <path d="M 320 180 L 305 155 L 290 130" fill="none" stroke="#0ea5e9" strokeWidth="8" strokeLinecap="round" />

                {/* Solidified patch (Catalyst reaction) */}
                <circle cx="310" cy="100" r="15" fill="#a855f7" opacity="0.8" />
                <circle cx="300" cy="80" r="12" fill="#a855f7" opacity="0.8" />

                {/* Labels */}
                <text x="130" y="125" textAnchor="middle" className="text-xs font-bold fill-sky-700">Liquid Healing Agent</text>
                <text x="230" y="90" textAnchor="middle" className="text-xs font-bold fill-purple-700">Embedded Catalyst</text>
                <text x="440" y="160" textAnchor="middle" className="text-xs fill-slate-500">Microcapsule</text>
                <text x="180" y="180" textAnchor="middle" className="text-sm font-bold fill-slate-800">Crack Propagates →</text>
            </svg>
        </div>
    );
};
