export default function IllustrationCard({ data }) {
    if (!data) return null;

    // Image GENERATION has been removed. This card now presents the textual
    // design (concept, prompt, key elements) only.
    return (
        <div className="glass-panel relative mb-6 w-full overflow-hidden border-fuchsia-200/60 p-6 group">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-fuchsia-50/80 to-purple-50/20"></div>
            <div className="relative z-10 flex h-full flex-col">
                <div className="mb-5 flex items-center gap-3 border-b border-fuchsia-100/50 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-fuchsia-200/50 bg-fuchsia-100 text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-600 shadow-[inset_0_2px_4px_rgb(0,0,0,0.02)]">
                        DI
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-800">
                        {data.illustration_title || 'Technical Illustration'}
                    </h3>
                </div>

                <div className="space-y-5">
                    <div>
                        <h4 className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fuchsia-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"></span> Conceptual Design
                        </h4>
                        <p className="text-[15px] font-medium leading-relaxed text-slate-700">{data.conceptual_design}</p>
                    </div>

                    {data.image_prompt && (
                        <div className="rounded-xl border border-fuchsia-100/50 bg-white/60 p-4 shadow-sm backdrop-blur-sm">
                            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fuchsia-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"></span> Image Prompt
                            </h4>
                            <code className="block overflow-x-auto rounded-lg border border-fuchsia-100/30 bg-fuchsia-50/50 p-2 font-mono text-sm leading-relaxed text-slate-600">
                                {data.image_prompt}
                            </code>
                        </div>
                    )}

                    {data.ui_elements && data.ui_elements.length > 0 && (
                        <div>
                            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fuchsia-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"></span> Key Elements
                            </h4>
                            <div className="flex flex-col gap-2">
                                {data.ui_elements.map((elem, idx) => (
                                    <div key={idx} className="flex items-start gap-2 rounded-lg border border-fuchsia-100/50 bg-fuchsia-50/50 p-2.5">
                                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                        </svg>
                                        <span className="text-sm font-medium leading-relaxed text-slate-700">{elem}</span>
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
