import React from 'react';

const LearningTheoriesDiagram = () => (
    <div className="my-8 flex flex-col items-center">
        <svg viewBox="0 0 600 200" className="w-full max-w-2xl drop-shadow-md font-sans">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
            </defs>

            {/* Behaviorism */}
            <rect x="20" y="50" width="140" height="80" rx="8" fill="url(#grad1)" stroke="#cbd5e1" strokeWidth="2" />
            <text x="90" y="85" textAnchor="middle" className="text-sm font-bold fill-slate-700">Behaviorism</text>
            <text x="90" y="105" textAnchor="middle" className="text-xs fill-slate-500">Stimulus → Response</text>

            {/* Arrow 1 */}
            <line x1="160" y1="90" x2="220" y2="90" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Cognitivism */}
            <rect x="230" y="50" width="140" height="80" rx="8" fill="url(#grad1)" stroke="#cbd5e1" strokeWidth="2" />
            <text x="300" y="85" textAnchor="middle" className="text-sm font-bold fill-indigo-700">Cognitivism</text>
            <text x="300" y="105" textAnchor="middle" className="text-xs fill-slate-500">Information Processing</text>

            {/* Arrow 2 */}
            <line x1="370" y1="90" x2="430" y2="90" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Constructivism */}
            <rect x="440" y="50" width="140" height="80" rx="8" fill="url(#grad1)" stroke="#cbd5e1" strokeWidth="2" />
            <text x="510" y="85" textAnchor="middle" className="text-sm font-bold fill-[#9E1B32]">Constructivism</text>
            <text x="510" y="105" textAnchor="middle" className="text-xs fill-slate-500">Meaning Making</text>

            {/* Timeline label */}
            <text x="300" y="160" textAnchor="middle" className="text-xs italic fill-slate-400">Evolution of Learning Theories over Time</text>
        </svg>
    </div>
);

const CognitiveLoadDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 300" className="w-full max-w-xl font-sans drop-shadow-sm">
            {/* Background container (Total Working Memory) */}
            <rect x="50" y="20" width="400" height="240" rx="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 5" />
            <text x="250" y="45" textAnchor="middle" className="text-sm font-bold fill-slate-600 uppercase tracking-widest">Total Working Memory Capacity</text>

            {/* Intrinsic Load */}
            <rect x="90" y="70" width="320" height="60" rx="6" fill="#e0e7ff" opacity="0.8" />
            <text x="250" y="100" textAnchor="middle" className="text-sm font-bold fill-blue-800">Intrinsic Load</text>
            <text x="250" y="115" textAnchor="middle" className="text-xs fill-blue-600">Inherent complexity of the material</text>

            {/* Extraneous Load */}
            <rect x="90" y="140" width="320" height="40" rx="6" fill="#fee2e2" opacity="0.8" />
            <text x="250" y="160" textAnchor="middle" className="text-sm font-bold fill-red-800">Extraneous Load</text>
            <text x="250" y="172" textAnchor="middle" className="text-xs fill-red-600">Poor design / Distractions</text>

            {/* Germane Load */}
            <rect x="90" y="190" width="320" height="50" rx="6" fill="#dcfce7" opacity="0.8" />
            <text x="250" y="215" textAnchor="middle" className="text-sm font-bold fill-green-800">Germane Load</text>
            <text x="250" y="228" textAnchor="middle" className="text-xs fill-green-600">Schema construction (Learning)</text>

            {/* Optimizer lines/arrows */}
            <path d="M 425 160 Q 460 160 460 130" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
            <text x="460" y="120" textAnchor="middle" className="text-xs font-bold fill-red-600">Minimize</text>

            <path d="M 425 215 Q 460 215 460 245" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="3 3" />
            <text x="460" y="260" textAnchor="middle" className="text-xs font-bold fill-green-600">Maximize</text>
        </svg>
    </div>
);

const AddieModelDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 500" className="w-full max-w-md font-sans drop-shadow-md">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                </marker>
            </defs>

            {/* Center Evaluation */}
            <circle cx="250" cy="250" r="60" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
            <text x="250" y="255" textAnchor="middle" className="font-bold fill-slate-700">Evaluate</text>

            {/* Connecting lines */}
            <g stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#arrowhead)">
                <path d="M 250 110 L 250 170" />
                <path d="M 390 250 L 330 250" />
                <path d="M 250 390 L 250 330" />
                <path d="M 110 250 L 170 250" />
            </g>

            {/* Connecting lines outward from evaluate to the others (iterative loops) */}
            <g stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" fill="none">
                <path d="M 190 190 Q 150 150 120 220" />
                <path d="M 310 190 Q 350 150 380 220" />
                <path d="M 310 310 Q 350 350 380 280" />
                <path d="M 190 310 Q 150 350 120 280" />
            </g>

            {/* Analysis (Top) */}
            <circle cx="250" cy="70" r="50" fill="#e0e7ff" stroke="#818cf8" strokeWidth="2" />
            <text x="250" y="75" textAnchor="middle" className="text-sm font-bold fill-blue-900">Analysis</text>

            {/* Design (Right) */}
            <circle cx="430" cy="250" r="50" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
            <text x="430" y="255" textAnchor="middle" className="text-sm font-bold fill-blue-900">Design</text>

            {/* Development (Bottom) */}
            <circle cx="250" cy="430" r="50" fill="#ffedd5" stroke="#93c5fd" strokeWidth="2" />
            <text x="250" y="435" textAnchor="middle" className="text-sm font-bold fill-blue-900">Develop</text>

            {/* Implementation (Left) */}
            <circle cx="70" cy="250" r="50" fill="#fae8ff" stroke="#a78bfa" strokeWidth="2" />
            <text x="70" y="255" textAnchor="middle" className="text-sm font-bold fill-blue-900">Implement</text>

            {/* Outer Circular Flow arrows */}
            <path d="M 285 45 A 200 200 0 0 1 455 215" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
            <path d="M 455 285 A 200 200 0 0 1 285 455" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
            <path d="M 215 455 A 200 200 0 0 1 45 285" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
            <path d="M 45 215 A 200 200 0 0 1 215 45" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />

        </svg>
    </div>
);

const KirkpatrickDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 350" className="w-full max-w-md font-sans drop-shadow-lg">
            {/* Level 1: Reaction (Bottom) */}
            <polygon points="50,300 450,300 400,240 100,240" fill="#fef08a" stroke="#fde047" strokeWidth="2" />
            <text x="250" y="275" textAnchor="middle" className="font-bold fill-yellow-900">Level 1: Reaction</text>
            <text x="250" y="290" textAnchor="middle" className="text-xs fill-yellow-700">Did they enjoy it?</text>

            {/* Level 2: Learning */}
            <polygon points="105,230 395,230 345,170 155,170" fill="#fed7aa" stroke="#fdba74" strokeWidth="2" />
            <text x="250" y="205" textAnchor="middle" className="font-bold fill-orange-900">Level 2: Learning</text>
            <text x="250" y="220" textAnchor="middle" className="text-xs fill-orange-700">Did they acquire knowledge?</text>

            {/* Level 3: Behavior */}
            <polygon points="160,160 340,160 290,100 210,100" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="2" />
            <text x="250" y="135" textAnchor="middle" className="font-bold fill-blue-900">Level 3: Behavior</text>
            <text x="250" y="150" textAnchor="middle" className="text-xs fill-blue-700">Are they applying it?</text>

            {/* Level 4: Results (Top) */}
            <polygon points="215,90 285,90 250,40" fill="#a7f3d0" stroke="#6ee7b7" strokeWidth="2" />
            <text x="250" y="80" textAnchor="middle" className="text-sm font-bold fill-green-900">Level 4: Results</text>

            {/* Tooltip/Labels on the side */}
            <text x="40" y="60" className="text-xs font-bold fill-slate-500">Alignment to Business</text>
            <path d="M 50 70 L 50 310" stroke="#cbd5e1" strokeWidth="2" markerStart="url(#arrowhead)" />
            <text x="35" y="190" transform="rotate(-90 35 190)" textAnchor="middle" className="text-xs fill-slate-400">Difficulty of Measurement</text>
        </svg>
    </div>
);

const AgileIDDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 200" className="w-full max-w-lg font-sans drop-shadow-md">
            <defs>
                <marker id="loopArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
                </marker>
            </defs>

            <rect x="50" y="50" width="100" height="100" rx="50" fill="#f0f9ff" stroke="#818cf8" strokeWidth="2" />
            <text x="100" y="105" textAnchor="middle" className="font-bold fill-indigo-900">Prototype</text>

            <path d="M 150 100 L 250 100" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#loopArrow)" />

            <rect x="250" y="50" width="100" height="100" rx="50" fill="#fdf4ff" stroke="#c084fc" strokeWidth="2" />
            <text x="300" y="105" textAnchor="middle" className="font-bold fill-purple-900">Review</text>

            <path d="M 350 100 L 450 100" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#loopArrow)" />

            <rect x="450" y="50" width="10" height="100" rx="5" fill="#f1f5f9" />
            <text x="430" y="30" textAnchor="middle" className="text-xs fill-slate-500">Refine</text>
            <path d="M 450 150 Q 250 200 100 150" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#loopArrow)" />
            <text x="275" y="185" textAnchor="middle" className="text-xs font-bold fill-slate-500">Iterate</text>
        </svg>
    </div>
);


const ArcsModelDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 600 200" className="w-full max-w-2xl drop-shadow-md font-sans bg-white rounded-xl border border-slate-200">
            <rect x="20" y="50" width="120" height="100" rx="8" fill="#f0f9ff" stroke="#38bdf8" strokeWidth="2" />
            <text x="80" y="85" textAnchor="middle" className="font-bold fill-sky-900">Attention</text>
            <text x="80" y="110" textAnchor="middle" className="text-xs fill-sky-700">Arouse Curiosity</text>

            <path d="M 140 100 L 170 100" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />

            <rect x="170" y="50" width="120" height="100" rx="8" fill="#fdf4ff" stroke="#c084fc" strokeWidth="2" />
            <text x="230" y="85" textAnchor="middle" className="font-bold fill-purple-900">Relevance</text>
            <text x="230" y="110" textAnchor="middle" className="text-xs fill-purple-700">Connect to goals</text>

            <path d="M 290 100 L 320 100" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />

            <rect x="320" y="50" width="120" height="100" rx="8" fill="#f0fdf4" stroke="#4ade80" strokeWidth="2" />
            <text x="380" y="85" textAnchor="middle" className="font-bold fill-green-900">Confidence</text>
            <text x="380" y="110" textAnchor="middle" className="text-xs fill-green-700">Scaffold Success</text>

            <path d="M 440 100 L 470 100" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />

            <rect x="470" y="50" width="120" height="100" rx="8" fill="#fffbeb" stroke="#facc15" strokeWidth="2" />
            <text x="530" y="85" textAnchor="middle" className="font-bold fill-yellow-900">Satisfaction</text>
            <text x="530" y="110" textAnchor="middle" className="text-xs fill-yellow-700">Reward Effort</text>
        </svg>
    </div>
);

const ZpdModelDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 500" className="w-full max-w-md drop-shadow-md font-sans bg-white rounded-xl border border-slate-200">
            {/* Outer Circle: Cannot do */}
            <circle cx="250" cy="250" r="200" fill="#fee2e2" stroke="#f87171" strokeWidth="2" />
            <text x="250" y="90" textAnchor="middle" className="font-bold fill-red-900 text-lg">Cannot Do (Even with Help)</text>
            <text x="250" y="110" textAnchor="middle" className="text-sm fill-red-700">Anxiety Zone</text>

            {/* Middle Circle: ZPD */}
            <circle cx="250" cy="250" r="130" fill="#fef08a" stroke="#facc15" strokeWidth="2" />
            <text x="250" y="160" textAnchor="middle" className="font-bold fill-yellow-900 text-base">Zone of Proximal Development</text>
            <text x="250" y="180" textAnchor="middle" className="text-xs fill-yellow-700">Learning happens here (with Scaffolding)</text>

            {/* Inner Circle: Can do */}
            <circle cx="250" cy="250" r="70" fill="#dcfce7" stroke="#4ade80" strokeWidth="2" />
            <text x="250" y="245" textAnchor="middle" className="font-bold fill-green-900 text-sm">Can Do</text>
            <text x="250" y="265" textAnchor="middle" className="text-xs fill-green-700">Independently</text>
            <text x="250" y="285" textAnchor="middle" className="text-xs fill-green-700">(Boredom Zone)</text>
        </svg>
    </div>
);

const ThermodynamicsDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 400 400" className="w-full max-w-sm drop-shadow-md font-sans bg-white rounded-xl border border-slate-200">
            <defs>
                <marker id="arrowUp" markerWidth="10" markerHeight="7" refX="5" refY="3.5" orient="auto">
                    <polygon points="0 7, 5 3.5, 0 0, 10 3.5" fill="#ef4444" />
                </marker>
                <marker id="arrowIn" markerWidth="10" markerHeight="7" refX="5" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                </marker>
            </defs>
            {/* Mound shape */}
            <path d="M 50 350 Q 80 200 180 50 Q 200 20 220 50 Q 320 200 350 350 Z" fill="#fcd34d" stroke="#ca8a04" strokeWidth="3" />
            {/* Chimney */}
            <rect x="185" y="60" width="30" height="240" fill="#fff" stroke="#ca8a04" strokeWidth="2" />

            <text x="200" y="320" textAnchor="middle" className="font-bold fill-amber-900 text-xs">Fungus Garden (Heat Source)</text>

            {/* Hot air rising */}
            <line x1="200" y1="290" x2="200" y2="100" stroke="#ef4444" strokeWidth="4" strokeDasharray="5 5" markerEnd="url(#arrowUp)" />
            <text x="215" y="150" className="text-xs font-bold fill-red-600">Hot Air Rises</text>

            {/* Cold air entering */}
            <path d="M 20 330 Q 60 330 110 340" fill="none" stroke="#3b82f6" strokeWidth="3" markerEnd="url(#arrowIn)" />
            <path d="M 380 330 Q 340 330 290 340" fill="none" stroke="#3b82f6" strokeWidth="3" markerEnd="url(#arrowIn)" />
            <text x="65" y="315" textAnchor="middle" className="text-[10px] font-bold fill-blue-600">Cool Air Intake</text>
            <text x="335" y="315" textAnchor="middle" className="text-[10px] font-bold fill-blue-600">Cool Air Intake</text>
        </svg>
    </div>
);

const AndragogyDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 300" className="w-full max-w-lg drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
            {/* Pedagogy Side */}
            <rect x="40" y="40" width="180" height="220" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
            <text x="130" y="70" textAnchor="middle" className="font-bold fill-slate-500">Pedagogy (Child)</text>
            <circle cx="130" cy="110" r="20" fill="#94a3b8" />
            <text x="130" y="115" textAnchor="middle" className="font-bold fill-white text-xs">Instructor</text>
            <path d="M 130 140 L 90 180 M 130 140 L 130 180 M 130 140 L 170 180" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <circle cx="90" cy="200" r="15" fill="#e2e8f0" />
            <circle cx="130" cy="200" r="15" fill="#e2e8f0" />
            <circle cx="170" cy="200" r="15" fill="#e2e8f0" />
            <text x="130" y="245" textAnchor="middle" className="text-[10px] fill-slate-500">Dependent, Subject-Centered</text>

            {/* Andragogy Side */}
            <rect x="280" y="40" width="180" height="220" rx="8" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
            <text x="370" y="70" textAnchor="middle" className="font-bold fill-blue-900">Andragogy (Adult)</text>
            <circle cx="370" cy="150" r="35" fill="#bfdbfe" />
            <text x="370" y="155" textAnchor="middle" className="font-bold fill-blue-900 text-[10px]">Problem</text>

            {/* Adults collaborating around problem */}
            <circle cx="310" cy="110" r="15" fill="#60a5fa" />
            <circle cx="430" cy="110" r="15" fill="#60a5fa" />
            <circle cx="370" cy="210" r="15" fill="#60a5fa" />

            <path d="M 320 120 L 345 135" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <path d="M 420 120 L 395 135" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <path d="M 370 190 L 370 170" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead)" />

            <text x="370" y="245" textAnchor="middle" className="text-[10px] fill-blue-700 font-bold">Self-Directed, Problem-Centered</text>
        </svg>
    </div>
);

const UdlDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 600 250" className="w-full max-w-2xl drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
            {/* Multiple Means of Representation */}
            <rect x="30" y="40" width="160" height="150" rx="8" fill="#fdf4ff" stroke="#c084fc" strokeWidth="2" />
            <text x="110" y="70" textAnchor="middle" className="font-bold fill-purple-900 text-sm">Representation</text>
            <text x="110" y="90" textAnchor="middle" className="text-xs fill-purple-700">The "WHAT" of learning</text>
            <line x1="50" y1="110" x2="170" y2="110" stroke="#e879f9" strokeWidth="1" strokeDasharray="3 3" />
            <text x="110" y="135" textAnchor="middle" className="text-[11px] fill-purple-800">Audio, Video, Text</text>
            <text x="110" y="155" textAnchor="middle" className="text-[11px] fill-purple-800">Translations, Alt-Text</text>

            {/* Multiple Means of Action & Expression */}
            <rect x="220" y="40" width="160" height="150" rx="8" fill="#f0fdf4" stroke="#4ade80" strokeWidth="2" />
            <text x="300" y="70" textAnchor="middle" className="font-bold fill-green-900 text-sm">Action & Expression</text>
            <text x="300" y="90" textAnchor="middle" className="text-xs fill-green-700">The "HOW" of learning</text>
            <line x1="240" y1="110" x2="360" y2="110" stroke="#4ade80" strokeWidth="1" strokeDasharray="3 3" />
            <text x="300" y="135" textAnchor="middle" className="text-[11px] fill-green-800">Essays, Presentations</text>
            <text x="300" y="155" textAnchor="middle" className="text-[11px] fill-green-800">Projects, Portfolios</text>

            {/* Multiple Means of Engagement */}
            <rect x="410" y="40" width="160" height="150" rx="8" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
            <text x="490" y="70" textAnchor="middle" className="font-bold fill-blue-900 text-sm">Engagement</text>
            <text x="490" y="90" textAnchor="middle" className="text-xs fill-blue-700">The "WHY" of learning</text>
            <line x1="430" y1="110" x2="550" y2="110" stroke="#60a5fa" strokeWidth="1" strokeDasharray="3 3" />
            <text x="490" y="135" textAnchor="middle" className="text-[11px] fill-blue-800">Autonomy, Relevance</text>
            <text x="490" y="155" textAnchor="middle" className="text-[11px] fill-blue-800">Gamification, Goals</text>

            <text x="300" y="225" textAnchor="middle" className="font-bold fill-slate-500 text-sm">Universal Design for Learning (UDL) Principles</text>
        </svg>
    </div>
);

const BloomSigmaDiagram = () => (
    <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 250" className="w-full max-w-lg drop-shadow-md font-sans bg-white border border-slate-200 rounded-xl">
            {/* Axes */}
            <line x1="50" y1="200" x2="450" y2="200" stroke="#64748b" strokeWidth="2" />
            <line x1="50" y1="200" x2="50" y2="50" stroke="#64748b" strokeWidth="2" />

            <text x="250" y="230" textAnchor="middle" className="text-xs font-bold fill-slate-500">Student Achievement Score</text>
            <text x="30" y="130" transform="rotate(-90 30 130)" textAnchor="middle" className="text-xs font-bold fill-slate-500">Number of Students</text>

            {/* Conventional Curve */}
            <path d="M 80 200 Q 150 50 220 200" fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="5 5" />
            <line x1="150" y1="200" x2="150" y2="125" stroke="#94a3b8" strokeWidth="1" />
            <text x="150" y="115" textAnchor="middle" className="text-xs font-bold fill-slate-500">Conventional (1:30)</text>

            {/* Tutoring Curve */}
            <path d="M 230 200 Q 300 50 370 200" fill="none" stroke="#3b82f6" strokeWidth="3" />
            <line x1="300" y1="200" x2="300" y2="125" stroke="#3b82f6" strokeWidth="1" />
            <text x="300" y="115" textAnchor="middle" className="text-xs font-bold fill-blue-600">1:1 Tutoring</text>

            {/* Difference indicator */}
            <path d="M 150 160 L 300 160" fill="none" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" markerStart="url(#arrowhead)" />
            <text x="225" y="150" textAnchor="middle" className="text-sm font-bold fill-red-600">2 Sigma (2.0 Standard Deviations)</text>
            <text x="225" y="180" textAnchor="middle" className="text-[10px] fill-red-500">98% outscore conventional learners</text>
        </svg>
    </div>
);

export default function ConceptDiagrams({ type }) {
    switch (type) {
        case 'learning-theories':
            return <LearningTheoriesDiagram />;
        case 'cognitive-load':
            return <CognitiveLoadDiagram />;
        case 'addie-model':
            return <AddieModelDiagram />;
        case 'kirkpatrick':
            return <KirkpatrickDiagram />;
        case 'agile-id':
            return <AgileIDDiagram />;
        case 'arcs-model':
            return <ArcsModelDiagram />;
        case 'zpd-model':
            return <ZpdModelDiagram />;
        case 'thermodynamics':
            return <ThermodynamicsDiagram />;
        case 'andragogy-diagram':
            return <AndragogyDiagram />;
        case 'udl-diagram':
            return <UdlDiagram />;
        case 'bloom-sigma-diagram':
            return <BloomSigmaDiagram />;
        default:
            return null;
    }
}
