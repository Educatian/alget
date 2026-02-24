import React from 'react';

export default function ValidationBadge({ data, iterations = 0 }) {
    if (!data) return null;

    const isValid = data.is_valid;
    const score = data.score;

    return (
        <div className={`glass-panel p-6 mb-6 relative overflow-hidden group ${isValid ? 'border-emerald-200/60' : 'border-red-200/60'}`}>
            <div className={`absolute inset-0 pointer-events-none ${isValid ? 'bg-linear-to-br from-emerald-50/80 to-teal-50/20' : 'bg-linear-to-br from-red-50/80 to-orange-50/20'}`}></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className={`flex items-start sm:items-center justify-between gap-4 mb-5 border-b pb-4 ${isValid ? 'border-emerald-100/50' : 'border-red-100/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgb(0,0,0,0.02)] ${isValid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200/50' : 'bg-red-100 text-red-600 border border-red-200/50'}`}>
                            {isValid ? '✅' : '⚠️'}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                            Validation Review
                        </h3>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
                        {iterations > 0 && (
                            <div className="px-3 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase bg-amber-50 text-amber-700 flex items-center gap-1.5 border border-amber-200/60 shadow-sm" title="The Orchestrator debated and revised this concept internally">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                {iterations} {iterations === 1 ? 'Revision' : 'Revisions'}
                            </div>
                        )}
                        <div className={`px-4 py-1.5 rounded-lg text-sm font-bold tracking-wide shadow-sm border ${isValid ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-red-50 text-red-700 border-red-200/60'}`}>
                            Score {score}/10
                        </div>
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    <div>
                        <h4 className={`font-bold text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2 ${isValid ? 'text-emerald-700' : 'text-red-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isValid ? 'bg-emerald-400' : 'bg-red-400'}`}></span> Feasibility Critique
                        </h4>
                        <p className={`text-[15px] font-medium leading-relaxed ${isValid ? 'text-slate-700' : 'text-slate-800'}`}>
                            {data.critique}
                        </p>
                    </div>

                    {!isValid && data.suggestions && data.suggestions.length > 0 && (
                        <div className="mt-5 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-red-100/50 shadow-sm">
                            <h4 className="font-bold text-red-700 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Alternative Suggestions
                            </h4>
                            <div className="flex flex-col gap-2">
                                {data.suggestions.map((suggestion, idx) => (
                                    <div key={idx} className="flex items-start gap-2 bg-red-50/50 p-2.5 rounded-lg border border-red-100/30">
                                        <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        <span className="text-sm text-slate-700 font-medium leading-relaxed">{suggestion}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
