import React from 'react';

export default function EngineeringCard({ data }) {
    if (!data) return null;

    return (
        <div className="glass-panel p-6 mb-6 border-blue-200/60 relative overflow-hidden group h-full">
            <div className="absolute inset-0 bg-linear-to-br from-blue-50/80 to-indigo-50/30 pointer-events-none"></div>
            <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-5 border-b border-blue-100/50 pb-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgb(0,0,0,0.02)] border border-blue-200/50">
                        ⚙️
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Engineering Translation</h3>
                </div>

                <div className="space-y-5 flex-1">
                    <div>
                        <h4 className="font-bold text-blue-700 text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Proposed Application
                        </h4>
                        <p className="text-slate-700 font-medium text-[15px]">{data.application_name}</p>
                    </div>

                    <div>
                        <h4 className="font-bold text-blue-700 text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> How it Works
                        </h4>
                        <p className="text-slate-600 leading-relaxed text-[15px]">{data.description}</p>
                    </div>

                    {data.design_principles && data.design_principles.length > 0 && (
                        <div>
                            <h4 className="font-bold text-blue-700 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Design Principles
                            </h4>
                            <div className="flex flex-col gap-2">
                                {data.design_principles.map((principle, index) => (
                                    <div key={index} className="flex items-start gap-2 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                                        <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span className="text-sm text-slate-600 font-medium leading-relaxed">{principle}</span>
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
