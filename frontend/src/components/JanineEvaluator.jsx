import React from 'react';

export default function JanineEvaluator({ evaluation }) {
    if (!evaluation) return null;

    // Guard against string responses if the evaluator failed to return JSON
    const isObject = typeof evaluation === 'object' && evaluation !== null;
    if (!isObject) {
        return (
            <div className="glass-panel p-6 border-gray-200/50 shadow-sm mt-2">
                <p className="text-gray-700">{String(evaluation)}</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f0f4f8] border border-[#d9e2ec] rounded-2xl p-6 shadow-sm mb-6 flex gap-6">
            <div className="hidden sm:block flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-emerald-400 flex items-center justify-center shadow-md">
                    {/* Persona Avatar */}
                    <span className="text-3xl">👩‍🔬</span>
                </div>
            </div>

            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">Janine Benyus</h3>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                        Biomimicry Expert Evaluator
                    </span>
                </div>

                <p className="text-gray-600 text-sm mb-4 italic">
                    "Does this design truly honor the biological mentor, or is it merely bioutilization?"
                </p>

                {/* Score Badge */}
                <div className="mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Biomimetic Fidelity Score:</span>
                        <span className={`text-lg font-black ${evaluation.score >= 8 ? 'text-emerald-600' :
                                evaluation.score >= 5 ? 'text-amber-500' :
                                    'text-red-600'
                            }`}>
                            {evaluation.score}/10
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Strengths */}
                    <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                        <h4 className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <span className="text-emerald-500">✅</span> Strengths
                        </h4>
                        <ul className="list-none text-[0.95rem] text-slate-700 space-y-2 font-medium">
                            {evaluation.strengths?.map((str, i) => (
                                <li key={i} className="flex items-start gap-2 leading-relaxed">
                                    <span className="text-emerald-400 mt-1 max-w-[10px]">&bull;</span>
                                    <span>{str}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Areas for Improvement */}
                    <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                        <h4 className="text-[11px] font-bold text-amber-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <span className="text-amber-500">🚧</span> Areas for Improvement
                        </h4>
                        <ul className="list-none text-[0.95rem] text-slate-700 space-y-2 font-medium">
                            {evaluation.areas_for_improvement?.map((area, i) => (
                                <li key={i} className="flex items-start gap-2 leading-relaxed">
                                    <span className="text-amber-400 mt-1 max-w-[10px]">&bull;</span>
                                    <span>{area}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Janine's Personalized Feedback */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 w-1 bg-emerald-400 h-full left-0"></div>
                    <p className="text-gray-800 leading-relaxed text-[1.05rem] whitespace-pre-wrap italic font-serif">
                        "{evaluation.janine_feedback}"
                    </p>
                </div>
            </div>
        </div>
    );
}
