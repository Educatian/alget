import React, { useState } from 'react';

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

const CognitiveLoadDiagram = () => {
    const [intrinsic, setIntrinsic] = useState(30);
    const [extraneous, setExtraneous] = useState(20);
    const [germane, setGermane] = useState(20);

    const totalLoad = intrinsic + extraneous + germane;
    const isOverload = totalLoad > 100;

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: Cognitive Load Balancer</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Drag the sliders to adjust the cognitive loads. Working Memory has a strictly finite capacity (100%). If the total load exceeds 100%, learning halts.
            </p>

            <div className="w-full max-w-md mb-6 space-y-4">
                <div>
                    <label className="text-xs font-bold text-blue-800 flex justify-between">
                        <span>Intrinsic Load (Task Complexity)</span>
                        <span>{intrinsic}%</span>
                    </label>
                    <input type="range" min="10" max="80" value={intrinsic} onChange={(e) => setIntrinsic(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>
                <div>
                    <label className="text-xs font-bold text-red-800 flex justify-between">
                        <span>Extraneous Load (Bad Design / Distractions)</span>
                        <span>{extraneous}%</span>
                    </label>
                    <input type="range" min="0" max="60" value={extraneous} onChange={(e) => setExtraneous(Number(e.target.value))} className="w-full accent-red-600" />
                </div>
                <div>
                    <label className="text-xs font-bold text-green-800 flex justify-between">
                        <span>Germane Load (Schema Construction)</span>
                        <span>{germane}%</span>
                    </label>
                    <input type="range" min="0" max="60" value={germane} onChange={(e) => setGermane(Number(e.target.value))} className="w-full accent-green-600" />
                </div>
            </div>

            <div className={`w-full max-w-md h-12 rounded-lg flex overflow-hidden border-2 transition-colors ${isOverload ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border-slate-300'}`}>
                <div style={{ width: `${(intrinsic / totalLoad) * 100}%` }} className="h-full bg-blue-200 flex items-center justify-center font-bold text-blue-900 text-xs transition-all">I</div>
                <div style={{ width: `${(extraneous / totalLoad) * 100}%` }} className="h-full bg-red-200 flex items-center justify-center font-bold text-red-900 text-xs transition-all">E</div>
                <div style={{ width: `${(germane / totalLoad) * 100}%` }} className="h-full bg-green-200 flex items-center justify-center font-bold text-green-900 text-xs transition-all">G</div>
            </div>

            <div className="mt-4 font-bold text-lg">
                {isOverload ? (
                    <span className="text-red-600 animate-pulse">⚠️ COGNITIVE OVERLOAD ({totalLoad}%) ⚠️</span>
                ) : (
                    <span className="text-slate-700">Total Working Memory Used: {totalLoad}%</span>
                )}
            </div>
        </div>
    );
};

const AddieModelDiagram = () => {
    const [selected, setSelected] = useState(null);

    const phases = {
        A: { title: "Analyze", text: "Who are the learners? What is the performance gap? What are the technical constraints? Determine if training is actually the solution to the business problem.", color: "border-blue-300 bg-blue-50 text-blue-900" },
        D1: { title: "Design", text: "Create the blueprint. Write testable Learning Objectives, define graphic design standards, map out UI interactions, and sequence the modules.", color: "border-indigo-300 bg-indigo-50 text-indigo-900" },
        D2: { title: "Develop", text: "Build the actual assets. Record audio, code interactive elements, write the textbook, and assemble the course in an authoring tool.", color: "border-purple-300 bg-purple-50 text-purple-900" },
        I: { title: "Implement", text: "Deploy the course to the LMS. Train the instructors on how to use the materials, and enroll the target learners.", color: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900" },
        E: { title: "Evaluate", text: "Measure effectiveness using Kirkpatrick's 4 Levels. Did they like it? Did they learn? Did behavior change? Did the business improve?", color: "border-red-300 bg-red-50 text-red-900" }
    };

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: ADDIE Model</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Click a phase to examine the core instructional design tasks performed during that step. Note how Evaluation touches every single phase iteratively.
            </p>

            <svg viewBox="0 0 500 500" className="w-full max-w-md font-sans drop-shadow-sm cursor-pointer">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                    </marker>
                </defs>

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

                {/* Outer Circular Flow arrows */}
                <path d="M 285 45 A 200 200 0 0 1 455 215" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                <path d="M 455 285 A 200 200 0 0 1 285 455" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                <path d="M 215 455 A 200 200 0 0 1 45 285" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                <path d="M 45 215 A 200 200 0 0 1 215 45" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />

                {/* Center Evaluation */}
                <g onClick={() => setSelected('E')} className="hover:scale-105 transform origin-[250px_250px] transition-transform">
                    <circle cx="250" cy="250" r="60" className={`${selected === 'E' ? 'fill-red-100 drop-shadow-md' : 'fill-slate-50'} stroke-red-200 stroke-4 transition-all`} />
                    <text x="250" y="255" textAnchor="middle" className="font-bold fill-red-800">Evaluate</text>
                </g>

                {/* Analysis (Top) */}
                <g onClick={() => setSelected('A')} className="hover:scale-105 transform origin-[250px_70px] transition-transform">
                    <circle cx="250" cy="70" r="50" className={`${selected === 'A' ? 'fill-blue-200 drop-shadow-md' : 'fill-blue-50'} stroke-blue-300 stroke-4 transition-all`} />
                    <text x="250" y="75" textAnchor="middle" className="text-sm font-bold fill-blue-900">Analysis</text>
                </g>

                {/* Design (Right) */}
                <g onClick={() => setSelected('D1')} className="hover:scale-105 transform origin-[430px_250px] transition-transform">
                    <circle cx="430" cy="250" r="50" className={`${selected === 'D1' ? 'fill-indigo-200 drop-shadow-md' : 'fill-indigo-50'} stroke-indigo-300 stroke-4 transition-all`} />
                    <text x="430" y="255" textAnchor="middle" className="text-sm font-bold fill-indigo-900">Design</text>
                </g>

                {/* Development (Bottom) */}
                <g onClick={() => setSelected('D2')} className="hover:scale-105 transform origin-[250px_430px] transition-transform">
                    <circle cx="250" cy="430" r="50" className={`${selected === 'D2' ? 'fill-purple-200 drop-shadow-md' : 'fill-purple-50'} stroke-purple-300 stroke-4 transition-all`} />
                    <text x="250" y="435" textAnchor="middle" className="text-sm font-bold fill-purple-900">Develop</text>
                </g>

                {/* Implementation (Left) */}
                <g onClick={() => setSelected('I')} className="hover:scale-105 transform origin-[70px_250px] transition-transform">
                    <circle cx="70" cy="250" r="50" className={`${selected === 'I' ? 'fill-fuchsia-200 drop-shadow-md' : 'fill-fuchsia-50'} stroke-fuchsia-300 stroke-4 transition-all`} />
                    <text x="70" y="255" textAnchor="middle" className="text-sm font-bold fill-fuchsia-900">Implement</text>
                </g>
            </svg>

            <div className={`w-full max-w-md mt-4 p-4 rounded-lg border min-h-[110px] flex flex-col justify-center transition-all ${selected ? phases[selected].color : 'bg-slate-50 border-slate-200 text-slate-400 items-center'}`}>
                {selected ? (
                    <>
                        <h4 className="font-bold mb-1">{phases[selected].title} Phase</h4>
                        <p className="text-sm">{phases[selected].text}</p>
                    </>
                ) : (
                    <p className="font-medium">👆 Select an ADDIE phase to explore its purpose.</p>
                )}
            </div>
        </div>
    );
};

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


const ArcsModelDiagram = () => {
    const [selected, setSelected] = useState(null);

    const content = {
        attention: { title: "Attention", detail: "Use perceptual arousal (surprise, paradox) or inquiry arousal (challenging questions) to grab the learner's brain immediately.", color: "bg-sky-50 text-sky-900 border-sky-200" },
        relevance: { title: "Relevance", detail: "Connect the material to the learner's future career, past experiences, or immediate real-world problems. Why should they care?", color: "bg-purple-50 text-purple-900 border-purple-200" },
        confidence: { title: "Confidence", detail: "Scaffold the learning. Provide clear grading rubrics, small early victories, and low-stakes practice to build self-efficacy.", color: "bg-green-50 text-green-900 border-green-200" },
        satisfaction: { title: "Satisfaction", detail: "Provide immediate, meaningful feedback and opportunities to use the new skill. Extrinsic rewards (certificates) should not overcome intrinsic pride.", color: "bg-yellow-50 text-yellow-900 border-yellow-200" }
    };

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: The ARCS Model</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Click on any of the four pillars of Keller's motivational model to see how to implement it in instructional design.
            </p>

            <svg viewBox="0 0 600 180" className="w-full max-w-2xl font-sans cursor-pointer">
                <defs>
                    <marker id="arrowhead2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
                    </marker>
                </defs>
                <g onClick={() => setSelected('attention')} className="hover:opacity-80 transition-opacity">
                    <rect x="20" y="20" width="120" height="100" rx="8" fill={selected === 'attention' ? "#bae6fd" : "#f0f9ff"} stroke="#38bdf8" strokeWidth={selected === 'attention' ? "4" : "2"} />
                    <text x="80" y="65" textAnchor="middle" className="font-bold fill-sky-900">Attention</text>
                    <text x="80" y="90" textAnchor="middle" className="text-xs fill-sky-700">Arouse Curiosity</text>
                </g>

                <path d="M 140 70 L 170 70" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead2)" />

                <g onClick={() => setSelected('relevance')} className="hover:opacity-80 transition-opacity">
                    <rect x="170" y="20" width="120" height="100" rx="8" fill={selected === 'relevance' ? "#f3e8ff" : "#fdf4ff"} stroke="#c084fc" strokeWidth={selected === 'relevance' ? "4" : "2"} />
                    <text x="230" y="65" textAnchor="middle" className="font-bold fill-purple-900">Relevance</text>
                    <text x="230" y="90" textAnchor="middle" className="text-xs fill-purple-700">Connect to goals</text>
                </g>

                <path d="M 290 70 L 320 70" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead2)" />

                <g onClick={() => setSelected('confidence')} className="hover:opacity-80 transition-opacity">
                    <rect x="320" y="20" width="120" height="100" rx="8" fill={selected === 'confidence' ? "#bbf7d0" : "#f0fdf4"} stroke="#4ade80" strokeWidth={selected === 'confidence' ? "4" : "2"} />
                    <text x="380" y="65" textAnchor="middle" className="font-bold fill-green-900">Confidence</text>
                    <text x="380" y="90" textAnchor="middle" className="text-xs fill-green-700">Scaffold Success</text>
                </g>

                <path d="M 440 70 L 470 70" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead2)" />

                <g onClick={() => setSelected('satisfaction')} className="hover:opacity-80 transition-opacity">
                    <rect x="470" y="20" width="120" height="100" rx="8" fill={selected === 'satisfaction' ? "#fef08a" : "#fffbeb"} stroke="#facc15" strokeWidth={selected === 'satisfaction' ? "4" : "2"} />
                    <text x="530" y="65" textAnchor="middle" className="font-bold fill-yellow-900">Satisfaction</text>
                    <text x="530" y="90" textAnchor="middle" className="text-xs fill-yellow-700">Reward Effort</text>
                </g>
            </svg>

            <div className={`w-full max-w-2xl mt-2 p-4 rounded-lg border min-h-[100px] flex flex-col justify-center transition-all ${selected ? content[selected].color : 'bg-slate-50 border-slate-200 text-slate-400 items-center'}`}>
                {selected ? (
                    <>
                        <h4 className="font-bold mb-1">{content[selected].title} Implementation:</h4>
                        <p className="text-sm">{content[selected].detail}</p>
                    </>
                ) : (
                    <p className="font-medium">👆 Click a pillar above to explore implementation strategies.</p>
                )}
            </div>
        </div>
    );
};

const ZpdModelDiagram = () => {
    const [selected, setSelected] = useState(null);

    const zones = {
        bore: { title: "What I Can Do Unassisted", text: "Comfort Zone. Learning is minimal here because the skills are already mastered. Prolonged exposure leads to boredom and disengagement.", color: "bg-green-50 text-green-900 border-green-200" },
        zpd: { title: "Zone of Proximal Development (ZPD)", text: "Sweet Spot. The learner cannot do this alone, but CAN do it with guidance (scaffolding). Maximum neural plasticity and learning occur here.", color: "bg-yellow-50 text-yellow-900 border-yellow-200" },
        panic: { title: "What I Cannot Do", text: "Panic Zone. The cognitive leap is too far, even with a teacher. Exposure here leads to frustration, burnout, and giving up.", color: "bg-red-50 text-red-900 border-red-200" }
    };

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: Vygotsky's ZPD</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Click on the concentric rings to understand the psychological state of the learner in each zone.
            </p>

            <svg viewBox="0 0 500 400" className="w-full max-w-md font-sans drop-shadow-sm cursor-pointer">
                {/* Panic Zone */}
                <g onClick={() => setSelected('panic')} className="hover:opacity-90 transition-opacity">
                    <circle cx="250" cy="200" r="180" className={`${selected === 'panic' ? 'fill-red-200' : 'fill-red-50'} stroke-red-300 stroke-4 transition-all`} />
                    <text x="250" y="60" textAnchor="middle" className="text-sm font-bold fill-red-800 uppercase tracking-widest">Panic Zone</text>
                    <text x="250" y="80" textAnchor="middle" className="text-xs fill-red-700">(What I Cannot Do)</text>
                </g>

                {/* ZPD */}
                <g onClick={() => setSelected('zpd')} className="hover:opacity-90 transition-opacity">
                    <circle cx="250" cy="200" r="120" className={`${selected === 'zpd' ? 'fill-yellow-200 drop-shadow-lg' : 'fill-yellow-50'} stroke-yellow-400 stroke-4 transition-all`} />
                    <text x="250" y="115" textAnchor="middle" className="text-sm font-bold fill-yellow-900 uppercase tracking-widest">Z.P.D.</text>
                    <text x="250" y="130" textAnchor="middle" className="text-[10px] fill-yellow-800">(What I can do with help)</text>
                </g>

                {/* Comfort / Boredom Zone */}
                <g onClick={() => setSelected('bore')} className="hover:opacity-90 transition-opacity">
                    <circle cx="250" cy="200" r="60" className={`${selected === 'bore' ? 'fill-green-200' : 'fill-green-50'} stroke-green-400 stroke-4 transition-all`} />
                    <text x="250" y="195" textAnchor="middle" className="text-xs font-bold fill-green-900">Comfort</text>
                    <text x="250" y="210" textAnchor="middle" className="text-[10px] fill-green-800">Zone</text>
                </g>

                {/* Scaffolding representation */}
                {selected === 'zpd' && (
                    <g className="animate-pulse">
                        <path d="M 250 200 L 250 150 L 320 150" fill="none" stroke="#eab308" strokeWidth="3" strokeDasharray="4 4" markerEnd="url(#arrowhead)" />
                        <text x="330" y="155" className="text-xs font-bold fill-yellow-700 bg-white">Scaffolding Provided</text>
                    </g>
                )}
            </svg>

            <div className={`w-full max-w-md mt-4 p-4 rounded-lg border min-h-[110px] flex flex-col justify-center transition-all ${selected ? zones[selected].color : 'bg-slate-50 border-slate-200 text-slate-400 items-center'}`}>
                {selected ? (
                    <>
                        <h4 className="font-bold mb-1">{zones[selected].title}</h4>
                        <p className="text-sm">{zones[selected].text}</p>
                    </>
                ) : (
                    <p className="font-medium">👆 Click a zone to explore the cognitive state.</p>
                )}
            </div>
        </div>
    );
};

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

const UdlDiagram = () => {
    const [selected, setSelected] = useState(null);

    const principles = {
        representation: {
            title: "Multiple Means of Representation",
            text: "Learners differ in the ways they perceive and comprehend info. Provide text, audio, video, alt-text, and clear semantic structure.",
            color: "bg-purple-50 text-purple-900 border-purple-200"
        },
        action: {
            title: "Multiple Means of Action & Expression",
            text: "Learners differ in how they can navigate a learning environment and express what they know. Offer tests, essays, projects, or oral presentations as options.",
            color: "bg-green-50 text-green-900 border-green-200"
        },
        engagement: {
            title: "Multiple Means of Engagement",
            text: "Learners differ in the ways they can be engaged or motivated. Provide safe quiet paths, highly social paths, and clear real-world relevance.",
            color: "bg-blue-50 text-blue-900 border-blue-200"
        }
    };

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: UDL Core Principles</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Click on the core networks of the UDL framework to understand their instructional application.
            </p>

            <svg viewBox="0 0 600 180" className="w-full max-w-2xl font-sans drop-shadow-sm cursor-pointer">
                {/* Multiple Means of Representation */}
                <g onClick={() => setSelected('representation')} className="hover:-translate-y-1 transition-transform">
                    <rect x="30" y="10" width="160" height="150" rx="8" className={`${selected === 'representation' ? 'fill-purple-100' : 'fill-purple-50'} stroke-purple-400 stroke-4 transition-all`} />
                    <text x="110" y="40" textAnchor="middle" className="font-bold fill-purple-900 text-sm">Representation</text>
                    <text x="110" y="60" textAnchor="middle" className="text-xs fill-purple-700">The "WHAT" of learning</text>
                    <line x1="50" y1="80" x2="170" y2="80" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="110" y="105" textAnchor="middle" className="text-[11px] fill-purple-800">Audio, Video, Text</text>
                    <text x="110" y="125" textAnchor="middle" className="text-[11px] fill-purple-800">Translations, Alt-Text</text>
                </g>

                {/* Multiple Means of Action & Expression */}
                <g onClick={() => setSelected('action')} className="hover:-translate-y-1 transition-transform">
                    <rect x="220" y="10" width="160" height="150" rx="8" className={`${selected === 'action' ? 'fill-green-100' : 'fill-green-50'} stroke-green-400 stroke-4 transition-all`} />
                    <text x="300" y="40" textAnchor="middle" className="font-bold fill-green-900 text-sm">Action & Expression</text>
                    <text x="300" y="60" textAnchor="middle" className="text-xs fill-green-700">The "HOW" of learning</text>
                    <line x1="240" y1="80" x2="360" y2="80" stroke="#4ade80" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="300" y="105" textAnchor="middle" className="text-[11px] fill-green-800">Essays, Presentations</text>
                    <text x="300" y="125" textAnchor="middle" className="text-[11px] fill-green-800">Projects, Portfolios</text>
                </g>

                {/* Multiple Means of Engagement */}
                <g onClick={() => setSelected('engagement')} className="hover:-translate-y-1 transition-transform">
                    <rect x="410" y="10" width="160" height="150" rx="8" className={`${selected === 'engagement' ? 'fill-blue-100' : 'fill-blue-50'} stroke-blue-400 stroke-4 transition-all`} />
                    <text x="490" y="40" textAnchor="middle" className="font-bold fill-blue-900 text-sm">Engagement</text>
                    <text x="490" y="60" textAnchor="middle" className="text-xs fill-blue-700">The "WHY" of learning</text>
                    <line x1="430" y1="80" x2="550" y2="80" stroke="#60a5fa" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="490" y="105" textAnchor="middle" className="text-[11px] fill-blue-800">Autonomy, Relevance</text>
                    <text x="490" y="125" textAnchor="middle" className="text-[11px] fill-blue-800">Gamification, Goals</text>
                </g>
            </svg>

            <div className={`w-full max-w-2xl mt-4 p-4 rounded-lg border min-h-[90px] flex flex-col justify-center transition-all ${selected ? principles[selected].color : 'bg-slate-50 border-slate-200 text-slate-400 items-center'}`}>
                {selected ? (
                    <>
                        <h4 className="font-bold mb-1">{principles[selected].title}</h4>
                        <p className="text-sm">{principles[selected].text}</p>
                    </>
                ) : (
                    <p className="font-medium">👆 Click a network block to reveal more details.</p>
                )}
            </div>
        </div>
    );
};

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
