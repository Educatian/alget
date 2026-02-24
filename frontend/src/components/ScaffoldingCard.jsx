import React from 'react';

export default function ScaffoldingCard({ data }) {
    if (!data) return null;

    return (
        <div className="glass-panel p-6 mb-6 border-amber-200/60 relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-br from-amber-50/80 to-orange-50/20 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-5 border-b border-amber-100/50 pb-4">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgb(0,0,0,0.02)] border border-amber-200/50">
                        🆘
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Learning Scaffolding</h3>
                </div>

                <div className="space-y-4">
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-amber-100 shadow-sm relative">
                        {/* Decorative quote mark */}
                        <div className="absolute -top-3 -left-2 text-4xl text-amber-200/50 font-serif leading-none select-none">"</div>
                        <p className="text-slate-700 font-medium leading-relaxed text-[15px] whitespace-pre-wrap relative z-10">
                            {data}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
