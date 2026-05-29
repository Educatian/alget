import React, { useState } from 'react';
import API_BASE from '../lib/apiConfig';

export default function IllustrationCard({ data }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!data) return null;

    const handleGenerateImage = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const response = await fetch(`${API_BASE}/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: data.image_prompt || data.conceptual_design,
                    context: data.conceptual_design,
                    style: 'diagram',
                    api_key: apiKey
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate image.');
            }

            const result = await response.json();
            if (result.success && result.image_data) {
                setImageUrl(result.image_data);
            } else {
                throw new Error(result.error || result.message || 'Error generating image.');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

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

                    <div className="mt-5 flex flex-col gap-4 border-t border-fuchsia-100/50 pt-5">
                        {!imageUrl ? (
                            <button
                                onClick={handleGenerateImage}
                                disabled={loading}
                                className={`flex w-full items-center justify-center gap-2 self-start rounded-xl px-6 py-3 font-bold shadow-md transition-all sm:w-auto ${
                                    loading
                                        ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                                        : 'bg-linear-to-r from-fuchsia-600 to-purple-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-fuchsia-900/20'
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="h-5 w-5 animate-spin text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating Image...
                                    </>
                                ) : (
                                    <>Generate Image with AI</>
                                )}
                            </button>
                        ) : (
                            <div className="w-full">
                                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fuchsia-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"></span> Generated Visual
                                </h4>
                                <div className="rounded-2xl border border-fuchsia-100 bg-white p-2 shadow-sm">
                                    <img
                                        src={imageUrl}
                                        alt={data.illustration_title || data.image_prompt || 'Generated technical illustration'}
                                        className="w-full max-w-2xl rounded-xl border border-slate-100 shadow-inner"
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mt-2 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm">
                                <span className="text-xl">!</span>
                                <div><strong>Image Generation Failed:</strong> {error}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
