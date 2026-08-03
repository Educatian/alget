import React, { useState } from 'react';

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
            <div className="editorial-surface p-4">
                <h4 className="font-headline text-[length:var(--ath-text-lg)] font-semibold text-[var(--ath-text)] mb-2.5">BigAL's Synthesis</h4>
                <p className="text-[length:var(--ath-text-sm)] leading-relaxed whitespace-pre-wrap break-words text-[var(--ath-text)]">{summaryText}</p>
                {nextSteps.length > 0 && (
                    <ul className="list-disc pl-5 mt-3 space-y-1.5 text-[length:var(--ath-text-sm)] text-[var(--ath-muted)]">
                        {nextSteps.map((point, i) => <li key={i}>{point}</li>)}
                    </ul>
                )}
                {encouragement && <p className="mt-3 text-sm font-medium text-[var(--ath-primary-deep)]">{encouragement}</p>}
            </div>

            <div className="flex flex-col gap-3">
                {bioContext.primary_mechanism && (
                    <div className="overflow-hidden rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] transition-all duration-300">
                        <button
                            onClick={() => setOpenSection(openSection === 'bio' ? null : 'bio')}
                            className="flex w-full items-center justify-between bg-[var(--ath-primary-soft)] px-4 py-3 text-left text-sm font-semibold text-[var(--ath-primary-deep)] transition-colors hover:bg-[color-mix(in_srgb,var(--ath-primary-soft)_75%,var(--ath-panel))]"
                        >
                            <span className="text-[13px]">Biological Deep Dive: {bioContext.primary_mechanism}</span>
                            <span aria-hidden="true" className={`text-[var(--ath-primary)] transition-transform duration-300 ${openSection === 'bio' ? 'rotate-180' : ''}`}>⌄</span>
                        </button>
                        {openSection === 'bio' && (
                            <div className="border-t border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 text-[length:var(--ath-text-sm)] leading-relaxed text-[var(--ath-muted)]">
                                <p>{bioContext.explanation}</p>
                                {bioContext.organism_examples?.length > 0 && (
                                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-2.5 py-1">
                                        <span className="text-[length:var(--ath-text-xs)] font-bold uppercase tracking-wider text-[var(--ath-primary)]">Organisms</span>
                                        <span className="text-[length:var(--ath-text-xs)] font-semibold text-[var(--ath-text)]">{bioContext.organism_examples.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {engineeringTitle && (
                    <div className="overflow-hidden rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] transition-all duration-300">
                        <button
                            onClick={() => setOpenSection(openSection === 'eng' ? null : 'eng')}
                            className="w-full bg-[color-mix(in_srgb,var(--ath-primary-soft)_65%,white)] px-4 py-3 text-left text-sm font-bold text-[var(--ath-primary-deep)] flex justify-between items-center hover:bg-[var(--ath-primary-soft)] transition-colors"
                        >
                            <span className="text-[13px]">Engineering Application</span>
                            <span className={`text-[var(--ath-primary)] transition-transform duration-300 ${openSection === 'eng' ? 'rotate-180' : ''}`}>v</span>
                        </button>
                        {openSection === 'eng' && (
                            <div className="border-t border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 text-[length:var(--ath-text-sm)] leading-relaxed text-[var(--ath-muted)]">
                                <p className="font-bold mb-2 text-[var(--ath-primary-deep)]">{engineeringTitle}</p>
                                <p>{engineeringBody}</p>
                                {engApp.challenges?.length > 0 && (
                                    <ul className="list-disc pl-5 mt-3 space-y-1.5 text-sm text-[var(--ath-muted)]">
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
        <div className="rounded-[var(--ath-radius-xl)] border border-[var(--ath-line)] bg-[var(--ath-success-soft)] p-5 shadow-sm">
            <div className="flex items-center gap-3.5 mb-4">
                <div className="w-11 h-11 bg-linear-to-br from-emerald-700 to-teal-800 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md border border-emerald-600">
                    JB
                </div>
                <div>
                    <h4 className="font-semibold text-[length:var(--ath-text-sm)] tracking-tight text-[var(--ath-text)]">Janine's Evaluation</h4>
                    <div className="flex items-center mt-0.5">
                        <span className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-widest text-[var(--ath-primary)]">Biomimicry Score:</span>
                        <span className="ml-2 rounded-full bg-[var(--ath-success)] px-2.5 py-0.5 text-[length:var(--ath-text-xs)] font-black text-[var(--ath-background)] shadow-sm">{evalData.score}/10</span>
                    </div>
                </div>
            </div>

            <p className="mb-5 border-l-4 border-[var(--ath-success)] py-1 pl-4 text-[length:var(--ath-text-sm)] font-medium italic leading-relaxed text-[var(--ath-text)]">
                "{evalData.janine_feedback}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 shadow-sm">
                    <h5 className="mb-2.5 text-[length:var(--ath-text-xs)] font-bold uppercase tracking-wider text-[var(--ath-success)]">Strengths</h5>
                    <ul className="list-disc pl-5 text-[var(--ath-muted)] space-y-1.5 leading-relaxed font-medium">
                        {evalData.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
                <div className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 shadow-sm">
                    <h5 className="mb-2.5 text-[length:var(--ath-text-xs)] font-bold uppercase tracking-wider text-[var(--ath-warning)]">Improve</h5>
                    <ul className="list-disc pl-5 text-[var(--ath-muted)] space-y-1.5 leading-relaxed font-medium">
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
        <div className="rounded-[var(--ath-radius-xl)] border border-[var(--ath-line)] bg-[var(--ath-warning-soft)] p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
                <h4 className="font-semibold text-[length:var(--ath-text-sm)] tracking-tight text-[var(--ath-text)]">{activity.activity_title || activity.exercise_name || 'Brainstorming Activity'}</h4>
            </div>

            <p className="mb-4 text-[length:var(--ath-text-sm)] font-medium leading-relaxed text-[var(--ath-text)]">
                {activity.lateral_thinking_prompt}
            </p>

            <div className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 shadow-sm">
                <h5 className="mb-2 text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-widest text-[var(--ath-warning)]">Creative Prompts:</h5>
                <ul className="list-none text-[length:var(--ath-text-sm)] text-[var(--ath-muted)] space-y-1.5 font-medium">
                    {prompts.map((prompt, i) => (
                        <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                            <span aria-hidden="true" className="mt-1.5 text-[var(--ath-warning)] text-[0.6rem]">•</span> <span>{prompt}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {activity.example_idea && (
                <div className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-warning-soft)] p-4 text-sm font-medium text-[var(--ath-text)]">
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
        <div className="editorial-surface mt-2 rounded-[var(--ath-radius-xl)] border border-[var(--ath-line)] p-6 shadow-sm">
            <div className="flex gap-4">
                <div className="flex-1">
                    <h4 className="mb-1.5 text-sm font-semibold tracking-tight text-[var(--ath-primary-deep)]">Let's figure this out together.</h4>
                    <p className="mb-5 rounded-r-lg border-l-4 border-[var(--ath-primary)] bg-[var(--ath-primary-soft)] py-2 pl-4 text-[length:var(--ath-text-sm)] font-medium italic leading-relaxed text-[var(--ath-text)]">
                        {scaffold.encouraging_remark}
                    </p>

                    <div className="space-y-3">
                        <h5 className="mb-1.5 text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-widest text-[var(--ath-secondary)]">Consider this:</h5>
                        {scaffold.guiding_questions?.map((q, i) => (
                            <div key={i} className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 text-[length:var(--ath-text-sm)] font-medium leading-relaxed text-[var(--ath-text)] shadow-sm">
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
    const illData = data?.illustration;
    if (!illData) return null;

    // Image generation has been removed; this card shows the textual concept
    // and key visual elements only.
    return (
        <div className="editorial-surface mt-2 border border-[var(--ath-line)] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <h4 className="font-bold text-[var(--ath-primary-deep)] text-sm tracking-tight">{illData.illustration_title || 'Conceptual Illustration'}</h4>
            </div>

            <p className="mb-6 rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 text-[length:var(--ath-text-sm)] font-medium leading-relaxed text-[var(--ath-muted)]">
                {illData.conceptual_design}
            </p>

            {illData.ui_elements?.length > 0 && (
                <div className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 shadow-sm">
                    <h5 className="text-[10px] font-bold text-[var(--ath-primary)] uppercase tracking-widest mb-2">Key Visual Elements:</h5>
                    <ul className="list-none text-[length:var(--ath-text-sm)] text-[var(--ath-muted)] space-y-1.5 font-medium">
                        {illData.ui_elements.map((el, i) => (
                            <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                                <span className="text-[var(--ath-primary)] mt-1.5 text-[0.6rem]">*</span> <span>{el}</span>
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
        <div className="editorial-surface mt-2 w-full max-w-full overflow-hidden border border-[var(--ath-line)] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <h4 className="font-bold text-cyan-950 text-sm tracking-tight">Interactive Simulation</h4>
            </div>

            <p className="mb-5 rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-4 text-[length:var(--ath-text-sm)] font-medium leading-relaxed text-[var(--ath-muted)]">
                {simData.description}
            </p>

            {simData.concepts_shown?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {simData.concepts_shown.map((concept, i) => (
                        <span key={i} className="rounded-md border border-[var(--ath-line)] bg-[var(--ath-info-soft)] px-2.5 py-1 text-[length:var(--ath-text-xs)] font-bold uppercase tracking-wider text-[var(--ath-info)] shadow-sm">
                            {concept}
                        </span>
                    ))}
                </div>
            )}

            {simData.html_code && (
                <div className="relative mt-4 h-[350px] w-full overflow-hidden rounded-[var(--ath-radius-lg)] border border-[var(--ath-line-strong)] bg-[var(--ath-panel)] shadow-sm">
                    <div className="absolute left-0 right-0 top-0 z-10 flex h-6 items-center gap-1.5 border-b border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--ath-danger)]"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--ath-warning)]"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--ath-success)]"></div>
                    </div>
                    <iframe
                        srcDoc={simData.html_code}
                        className="w-full h-full border-none pt-6"
                        // Drop allow-same-origin: model-generated p5.js doesn't need it, and
                        // combined with allow-scripts it would let the frame escape the sandbox.
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
        <div role="alert" className="rounded-[var(--ath-radius-lg)] border border-[var(--ath-danger)] bg-[color-mix(in_srgb,var(--ath-danger)_10%,var(--ath-panel))] p-4 text-[var(--ath-danger)]">
            <h4 className="mb-2 text-sm font-semibold">Response Error</h4>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message}</p>
        </div>
    );
}
