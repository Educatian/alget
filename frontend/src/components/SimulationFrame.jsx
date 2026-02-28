import React, { useRef, useEffect, useState } from 'react';
import { fuseTelemetry } from '../lib/knowledgeService';

export default function SimulationFrame({ htmlCode, description, concepts }) {
    const iframeRef = useRef(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!htmlCode) return;

        // Safety check - we inject the raw HTML string into an iframe srcdoc so it executes sandboxed
        try {
            const iframe = iframeRef.current;
            if (iframe) {
                const handleIframeLoad = () => {
                    // Send Telemetry Evidence when user starts playing with the simulation
                    if (concepts && concepts.length > 0) {
                        fuseTelemetry(concepts[0], 'simulation_play', 1.0).catch(console.error);
                    }
                };

                iframe.onload = handleIframeLoad;
                iframe.srcdoc = htmlCode;
            }
        } catch (e) {
            console.error("Failed to inject simulation HTML into iframe:", e);
            setLoadError(true);
        }
    }, [htmlCode, concepts]);

    if (!htmlCode) return null;

    return (
        <div className="glass-panel overflow-hidden mb-6 flex flex-col border-slate-700 bg-slate-900 shadow-2xl relative group w-full">
            <div className="absolute inset-0 bg-linear-to-b from-blue-900/20 to-transparent pointer-events-none"></div>

            <div className="bg-slate-800/80 backdrop-blur-md px-5 py-4 border-b border-slate-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/10 text-blue-400 rounded-md flex items-center justify-center text-lg shadow-[inset_0_2px_4px_rgb(0,0,0,0.1)] border border-blue-500/20">
                        🕹️
                    </div>
                    <h3 className="text-white font-bold flex items-center gap-3 tracking-wide">
                        Interactive Physics Simulation
                        <span className="bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-widest shadow-sm">p5.js</span>
                    </h3>
                </div>
                {concepts && concepts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {concepts.slice(0, 3).map((concept, idx) => (
                            <span key={idx} className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs px-2.5 py-1 rounded-md font-medium tracking-wide">
                                {concept}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {loadError ? (
                <div className="p-10 text-center bg-slate-900/50 relative z-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-400 mb-3 border border-red-500/20">
                        ⚠️
                    </div>
                    <p className="text-red-300 font-medium">Failed to load the interactive simulation renderer.</p>
                </div>
            ) : (
                <div className="relative w-full z-10 bg-black/50" style={{ paddingBottom: '56.25%' /* 16:9 Aspect Ratio */ }}>
                    <iframe
                        ref={iframeRef}
                        title="Generated Physics Simulation"
                        className="absolute top-0 left-0 w-full h-full border-0 bg-slate-50"
                        sandbox="allow-scripts allow-same-origin"
                    />
                </div>
            )}

            {description && (
                <div className="bg-slate-800/80 backdrop-blur-md px-6 py-5 border-t border-slate-700/80 relative z-10">
                    <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-500"></span> Simulation Details
                    </h4>
                    <p className="text-slate-300 text-[15px] leading-relaxed font-medium">{description}</p>
                </div>
            )}
        </div>
    );
}
