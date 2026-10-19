import React, { useState, useEffect } from 'react';
import API_BASE from '../lib/apiConfig';

export function LearnIntentCard({ data }) {
    const [openSection, setOpenSection] = useState(null);

    if (!data?.summary) return null;

    const summary = data.summary;
    const bioContext = data.biology_context || {};
    const engApp = data.engineering_application || {};
    const summaryText = typeof summary === 'string' ? summary : (summary.synthesis || 'Here is what I found:');
    const nextSteps = typeof summary === 'string'
        ? []
        : (summary.key_takeaways?.length ? summary.key_takeaways : (summary.next_steps || []));
    const encouragement = typeof summary === 'string' ? '' : (summary.encouragement || '');
    const engineeringTitle = engApp.application_idea || engApp.engineering_principle || engApp.proposed_solution;
    const engineeringBody = engApp.feasibility_analysis || engApp.proposed_solution;

    return (
        <div className="space-y-4">
            <div className="glass-panel p-4 bg-white/90 border-[var(--ath-line)] shadow-sm">
                <h4 className="font-bold text-[var(--ath-text)] text-sm mb-2.5">BigAL's Synthesis</h4>
                <p className="text-slate-700 text-[13px] leading-relaxed whitespace-pre-wrap">{summaryText}</p>
                {nextSteps.length > 0 && (
                    <ul className="list-disc pl-5 mt-3 space-y-1.5 text-[13px] text-slate-700">
                        {nextSteps.map((point, i) => <li key={i}>{point}</li>)}
                    </ul>
                )}
                {encouragement && <p className="mt-3 text-sm font-medium text-[var(--ath-text)]">{encouragement}</p>}
            </div>

            <div className="flex flex-col gap-3">
                {bioContext.primary_mechanism && (
                    <div className="border border-[var(--ath-line)] rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                        <button
                            onClick={() => setOpenSection(openSection === 'bio' ? null : 'bio')}
                            className="w-full bg-[color-mix(in_srgb,var(--ath-primary)_10%,var(--ath-panel))] px-4 py-3 text-left text-sm font-bold text-[var(--ath-primary)] flex justify-between items-center hover:bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))] transition-colors"
                        >
                            <span className="text-[13px]">Biological Deep Dive: {bioContext.primary_mechanism}</span>
                            <span className={`text-[var(--ath-primary)] transition-transform duration-300 ${openSection === 'bio' ? 'rotate-180' : ''}`}>v</span>
                        </button>
                        {openSection === 'bio' && (
                            <div className="p-4 bg-[var(--ath-panel)] backdrop-blur-md text-[13px] text-slate-700 leading-relaxed border-t border-[var(--ath-line)]">
                                <p>{bioContext.explanation}</p>
                                {bioContext.organism_examples?.length > 0 && (
                                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))] rounded-md border border-[var(--ath-line)]">
                                        <span className="text-xs font-bold text-[var(--ath-primary)] uppercase tracking-wider">Organisms</span>
                                        <span className="text-xs font-semibold text-[var(--ath-primary)]">{bioContext.organism_examples.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {engineeringTitle && (
                    <div className="border border-[var(--ath-line)] rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                        <button
                            onClick={() => setOpenSection(openSection === 'eng' ? null : 'eng')}
                            className="w-full bg-[color-mix(in_srgb,var(--ath-accent)_10%,var(--ath-panel))] px-4 py-3 text-left text-sm font-bold text-[var(--ath-text)] flex justify-between items-center hover:bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] transition-colors"
                        >
                            <span className="text-[13px]">Engineering Application</span>
                            <span className={`text-[var(--ath-text)] transition-transform duration-300 ${openSection === 'eng' ? 'rotate-180' : ''}`}>v</span>
                        </button>
                        {openSection === 'eng' && (
                            <div className="p-4 bg-[var(--ath-panel)] backdrop-blur-md text-[13px] text-slate-700 leading-relaxed border-t border-[var(--ath-line)]">
                                <p className="font-bold mb-2 text-[var(--ath-text)]">{engineeringTitle}</p>
                                <p>{engineeringBody}</p>
                                {engApp.challenges?.length > 0 && (
                                    <ul className="list-disc pl-5 mt-3 space-y-1.5 text-sm text-slate-700">
                                        {engApp.challenges.map((challenge, index) => <li key={index}>{challenge}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function EvaluateIntentCard({ data }) {
    if (!data?.evaluation) return null;
    const evalData = data.evaluation;

    return (
        <div className="bg-[color-mix(in_srgb,var(--ath-primary)_10%,var(--ath-panel))] p-5 rounded-2xl border border-[var(--ath-line)] shadow-sm">
            <div className="flex items-center gap-3.5 mb-4">
                <div className="w-11 h-11 bg-linear-to-br from-emerald-700 to-teal-800 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md border border-emerald-600">
                    JB
                </div>
                <div>
                    <h4 className="font-bold text-[var(--ath-primary)] text-[13px] tracking-tight">Janine's Evaluation</h4>
                    <div className="flex items-center mt-0.5">
                        <span className="text-[10px] font-bold text-[var(--ath-primary)] uppercase tracking-widest">Biomimicry Score:</span>
                        <span className="ml-2 bg-emerald-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">{evalData.score}/10</span>
                    </div>
                </div>
            </div>

            <p className="text-slate-800 text-[13px] font-medium italic mb-5 border-l-4 border-emerald-400 pl-4 py-1 leading-relaxed">
                "{evalData.janine_feedback}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-[var(--ath-line)] shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                    <h5 className="font-bold text-[var(--ath-primary)] mb-2.5 text-xs uppercase tracking-wider">Strengths</h5>
                    <ul className="list-disc pl-5 text-slate-700 space-y-1.5 leading-relaxed font-medium">
                        {evalData.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-[var(--ath-line)] shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                    <h5 className="font-bold text-[var(--ath-text)] mb-2.5 text-xs uppercase tracking-wider">Improve</h5>
                    <ul className="list-disc pl-5 text-slate-700 space-y-1.5 leading-relaxed font-medium">
                        {evalData.areas_for_improvement?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export function BrainstormIntentCard({ data }) {
    if (!data?.activity_brainstorm) return null;
    const activity = data.activity_brainstorm;
    const prompts = activity.guiding_questions?.length ? activity.guiding_questions : (activity.constraints || []);

    return (
        <div className="bg-[color-mix(in_srgb,var(--ath-accent)_10%,var(--ath-panel))] p-5 rounded-2xl border border-[var(--ath-line)] shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2.5 mb-3">
                <h4 className="font-bold text-[var(--ath-text)] text-[13px] tracking-tight">{activity.activity_title || activity.exercise_name || 'Brainstorming Activity'}</h4>
            </div>

            <p className="text-slate-800 text-[13px] font-medium leading-relaxed mb-4">
                {activity.lateral_thinking_prompt}
            </p>

            <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-[var(--ath-line)] shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <h5 className="text-[10px] font-bold text-[var(--ath-text)] uppercase tracking-widest mb-2">Creative Prompts:</h5>
                <ul className="list-none text-[13px] text-slate-700 space-y-1.5 font-medium">
                    {prompts.map((prompt, i) => (
                        <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                            <span className="text-amber-500 mt-1.5 text-[0.6rem]">*</span> <span>{prompt}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {activity.example_idea && (
                <div className="bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] border border-[var(--ath-line)] rounded-xl p-4 text-sm text-[var(--ath-text)] font-medium">
                    Example idea: {activity.example_idea}
                </div>
            )}
        </div>
    );
}

export function ScaffoldingIntentCard({ data }) {
    if (!data?.scaffolding) return null;
    const scaffold = data.scaffolding;

    return (
        <div className="glass-panel p-6 rounded-3xl border border-[#9E1B32]/20 shadow-xl shadow-red-900/5 mt-2 bg-white/80">
            <div className="flex gap-4">
                <div className="flex-1">
                    <h4 className="font-bold text-[var(--ath-danger)] mb-1.5 text-sm tracking-tight">Let's figure this out together.</h4>
                    <p className="text-[13px] text-slate-700 italic border-l-4 border-[var(--ath-line)] pl-4 mb-5 font-medium leading-relaxed bg-[color-mix(in_srgb,var(--ath-danger)_10%,transparent)] py-2 rounded-r-lg">
                        {scaffold.encouraging_remark}
                    </p>

                    <div className="space-y-3">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Consider this:</h5>
                        {scaffold.guiding_questions?.map((q, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl text-[13px] font-medium text-slate-800 border border-slate-200 shadow-sm leading-relaxed">
                                {q}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function IllustrateIntentCard({ data }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [loadingImage, setLoadingImage] = useState(false);
    const [imageError, setImageError] = useState(null);
    const illData = data?.illustration;

    useEffect(() => {
        if (!illData) return;

        if (illData.image_prompt && !imageUrl && !loadingImage && !imageError) {
            const fetchImage = async () => {
                setLoadingImage(true);
                try {
                    const apiKey = localStorage.getItem('openrouter_api_key') || '';
                    const response = await fetch(`${API_BASE}/generate-image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: illData.image_prompt,
                            context: illData.conceptual_design,
                            style: 'concept',
                            api_key: apiKey
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.image_data) {
                            setImageUrl(result.image_data);
                        } else {
                            setImageError(result.error || 'Image generation failed.');
                        }
                    } else {
                        setImageError('Failed to connect to image generation API.');
                    }
                } catch (err) {
                    console.error('Image fetch error:', err);
                    setImageError('Network error while generating image.');
                } finally {
                    setLoadingImage(false);
                }
            };

            fetchImage();
        }
    }, [illData, imageUrl, loadingImage, imageError]);

    if (!illData) return null;

    return (
        <div className="glass-panel p-6 border-[var(--ath-line)] shadow-xl shadow-purple-900/5 mt-2 bg-[var(--ath-panel)]">
            <div className="flex items-center gap-3 mb-4">
                <h4 className="font-bold text-[var(--ath-text)] text-sm tracking-tight">{illData.illustration_title || 'Conceptual Illustration'}</h4>
            </div>

            <p className="text-slate-700 text-[13px] font-medium leading-relaxed mb-6 bg-[var(--ath-panel)] p-4 rounded-xl border border-white">
                {illData.conceptual_design}
            </p>

            {illData.image_prompt && !imageUrl && !loadingImage && (
                <div className="bg-slate-900 p-4 rounded-xl shadow-inner mb-4">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Image Generation Prompt</h5>
                    <code className="text-[0.8rem] text-purple-300 font-mono break-all leading-relaxed block">{illData.image_prompt}</code>
                </div>
            )}

            {loadingImage && (
                <div className="bg-slate-900/5 p-8 rounded-xl border border-dashed border-[var(--ath-line)] mb-4 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
                    <span className="text-sm font-semibold text-[var(--ath-text)] tracking-wide">Synthesizing visual concept...</span>
                    <span className="text-xs text-slate-500">This may take 10-15 seconds</span>
                </div>
            )}

            {imageError && (
                <div className="bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))] p-4 rounded-xl border border-[var(--ath-line)] mb-4 text-[var(--ath-danger)] text-sm">
                    Warning: {imageError}
                    <div className="mt-2 p-2 bg-white rounded border border-[var(--ath-line)] font-mono text-[10px] break-all">{illData.image_prompt}</div>
                </div>
            )}

            {imageUrl && (
                <div className="mb-4 rounded-xl overflow-hidden border-2 border-slate-900 shadow-xl relative aspect-video bg-slate-100 flex items-center justify-center">
                    <img src={imageUrl} alt={illData.illustration_title} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-slate-900/80 to-transparent p-3 pt-8">
                        <span className="text-white text-xs font-semibold tracking-wider uppercase opacity-80">AI Generated Concept</span>
                    </div>
                </div>
            )}

            {illData.ui_elements?.length > 0 && (
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-[var(--ath-line)] shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                    <h5 className="text-[10px] font-bold text-[var(--ath-text)] uppercase tracking-widest mb-2">Key Visual Elements:</h5>
                    <ul className="list-none text-[13px] text-slate-700 space-y-1.5 font-medium">
                        {illData.ui_elements.map((el, i) => (
                            <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                                <span className="text-purple-500 mt-1.5 text-[0.6rem]">*</span> <span>{el}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export function SimulateIntentCard({ data }) {
    if (!data?.simulation) return null;
    const simData = data.simulation;

    return (
        <div className="glass-panel p-6 border-[var(--ath-line)] shadow-xl shadow-cyan-900/5 mt-2 bg-[var(--ath-panel)] w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
                <h4 className="font-bold text-[var(--ath-text)] text-sm tracking-tight">Interactive Simulation</h4>
            </div>

            <p className="text-slate-700 text-[13px] font-medium leading-relaxed mb-5 bg-[var(--ath-panel)] p-4 rounded-xl border border-white">
                {simData.description}
            </p>

            {simData.concepts_shown?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {simData.concepts_shown.map((concept, i) => (
                        <span key={i} className="bg-[color-mix(in_srgb,var(--ath-accent)_12%,var(--ath-panel))] text-[var(--ath-text)] text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-[var(--ath-line)] shadow-sm">
                            {concept}
                        </span>
                    ))}
                </div>
            )}

            {simData.html_code && (
                <div className="mt-4 w-full h-[350px] border-4 border-slate-900 rounded-xl overflow-hidden shadow-xl bg-white relative">
                    <div className="h-6 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-1.5 absolute top-0 left-0 right-0 z-10">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                    </div>
                    {/* AI-generated code: no allow-same-origin, so it cannot read the page's session or storage. */}
                    <iframe
                        srcDoc={simData.html_code}
                        className="w-full h-full border-none pt-6"
                        sandbox="allow-scripts"
                        title="Interactive Simulation"
                    />
                </div>
            )}
        </div>
    );
}

export function ErrorIntentCard({ data }) {
    const message = data?.error || data?.summary || 'Something went wrong while generating a response.';

    return (
        <div className="rounded-2xl border border-[var(--ath-line)] bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))] p-4 text-[var(--ath-danger)]">
            <h4 className="font-bold text-sm mb-2">Response Error</h4>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
    );
}
