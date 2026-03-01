import React, { useState, useEffect } from 'react';

export const SwarmDiagram = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [step, setStep] = useState(0);

    // simple animation loop to simulate time steps
    useEffect(() => {
        let interval;
        if (isRunning) {
            interval = setInterval(() => {
                setStep(s => (s >= 100 ? 100 : s + 1));
            }, 50);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const resetSimulation = () => {
        setIsRunning(false);
        setStep(0);
    };

    // Calculate dynamic values
    const earlyStage = step < 30; // Random exploring
    const midStage = step >= 30 && step < 70; // Paths found
    const lateStage = step >= 70; // Stigmergy converged

    const longPathPheromoneOpacity = Math.max(0.1, 0.5 - (step / 200));
    const shortPathPheromoneOpacity = Math.min(1.0, 0.2 + (step / 80));

    // Ant positions calculated via simple offsets
    const calcAnts = (path, amount, offset) => {
        return Array.from({ length: amount }).map((_, i) => {
            // A pseudo-random flutter based on step
            let xOffset = Math.sin((step + i * 10) * 0.1) * 3;
            let yOffset = Math.cos((step + i * 20) * 0.1) * 3;
            // Space them out along a rough visual line based on stage
            let baseX = 150 + (i * (320 / amount)) + (step > 0 ? (step * 0.5) % 20 : 0);
            let baseY = path === 'short' ? 200 + (Math.sin(baseX * 0.02) * 20) : 80 + (Math.sin(baseX * 0.02) * 50);

            // Scatter widely if early stage
            if (earlyStage) {
                baseY += (Math.random() - 0.5) * 100;
            }

            return <circle key={`${path}-${i}`} cx={baseX + xOffset} cy={baseY + yOffset} r="4" fill="#1e293b" />
        });
    };

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: Stigmergy Simulation</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg min-h-[40px]">
                {step === 0 && "Click Start to watch ant exploration."}
                {earlyStage && step > 0 && "1. Random Exploration: Ants mapping paths."}
                {midStage && "2. Pheromone Dropping: Both paths found, but short path takes less time."}
                {lateStage && "3. Convergence: Short path pheromone concentration mathematically wins."}
            </p>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setIsRunning(!isRunning)}
                    disabled={step >= 100}
                    className={`px-4 py-2 rounded-lg font-bold text-white transition-colors ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'}`}
                >
                    {isRunning ? "Pause" : (step >= 100 ? "Converged!" : "Run Simulation")}
                </button>
                <button
                    onClick={resetSimulation}
                    className="px-4 py-2 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                    Reset
                </button>
            </div>

            <svg viewBox="0 0 600 300" className="w-full max-w-2xl bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                {/* Nest */}
                <circle cx="100" cy="150" r="40" fill="#fcd34d" stroke="#b45309" strokeWidth="3" />
                <text x="100" y="155" textAnchor="middle" className="font-bold fill-amber-900 text-sm">Nest</text>

                {/* Food */}
                <circle cx="500" cy="150" r="30" fill="#86efac" stroke="#15803d" strokeWidth="3" />
                <text x="500" y="155" textAnchor="middle" className="font-bold fill-green-900 text-sm">Food</text>

                {/* Pheromone Trails (Rendered explicitly from step logic) */}
                <path d="M 140 150 Q 300 30 470 150" fill="none" stroke="#fca5a5" strokeWidth="15" strokeLinecap="round" style={{ opacity: step === 0 ? 0 : longPathPheromoneOpacity, transition: 'opacity 0.2s' }} />
                <path d="M 140 150 Q 300 280 470 150" fill="none" stroke="#ef4444" strokeWidth="15" strokeLinecap="round" style={{ opacity: step === 0 ? 0 : shortPathPheromoneOpacity, transition: 'opacity 0.2s' }} />

                {/* Ants rendering based on stage */}
                {calcAnts('long', earlyStage ? 10 : (lateStage ? 1 : 5), 0)}
                {calcAnts('short', earlyStage ? 10 : (lateStage ? 15 : 8), 0)}

                <text x="300" y="30" textAnchor="middle" className="text-sm font-bold fill-slate-400">Long Route</text>
                <text x="300" y="260" textAnchor="middle" className="text-sm font-bold fill-red-600 drop-shadow-sm">Short Route (Stigmergic Winner)</text>
            </svg>
        </div>
    );
};
