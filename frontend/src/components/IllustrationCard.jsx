import React, { useState } from 'react';
import API_BASE from '../lib/apiConfig';

export default function IllustrationCard({ data }) {
    if (!data) return null;

    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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
        <div className="glass-panel p-6 mb-6 border-fuchsia-200/60 relative overflow-hidden group w-full">
            <div className="absolute inset-0 bg-linear-to-br from-fuchsia-50/80 to-purple-50/20 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-5 border-b border-fuchsia-100/50 pb-4">
                    <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgb(0,0,0,0.02)] border border-fuchsia-200/50">
                        🎨
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                        {data.illustration_title || "Technical Illustration"}
                    </h3>
                </div>

                <div className="space-y-5">
                    <div>
                        <h4 className="font-bold text-fuchsia-700 text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400"></span> Conceptual Design
                        </h4>
                        <p className="text-slate-700 font-medium text-[15px] leading-relaxed">{data.conceptual_design}</p>
                    </div>

                    {data.image_prompt && (
                        <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-fuchsia-100/50 shadow-sm">
                            <h4 className="font-bold text-fuchsia-700 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400"></span> Image Prompt
                            </h4>
                            <code className="text-slate-600 font-mono text-sm leading-relaxed block overflow-x-auto p-2 bg-fuchsia-50/50 rounded-lg border border-fuchsia-100/30">
                                {data.image_prompt}
                            </code>
                        </div>
                    )}

                    {data.ui_elements && data.ui_elements.length > 0 && (
                        <div>
                            <h4 className="font-bold text-fuchsia-700 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400"></span> Key Elements
                            </h4>
                            <div className="flex flex-col gap-2">
                                {data.ui_elements.map((elem, idx) => (
                                    <div key={idx} className="flex items-start gap-2 bg-fuchsia-50/50 p-2.5 rounded-lg border border-fuchsia-100/50">
                                        <svg className="w-4 h-4 text-fuchsia-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                                        <span className="text-sm text-slate-700 font-medium leading-relaxed">{elem}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Image Generation Section */}
                    <div className="pt-5 border-t border-fuchsia-100/50 mt-5 flex flex-col gap-4">
                        {!imageUrl ? (
                            <button
                                onClick={handleGenerateImage}
                                disabled={loading}
                                className={`py-3 px-6 rounded-xl font-bold shadow-md transition-all w-full sm:w-auto self-start flex items-center justify-center gap-2 ${loading
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'bg-linear-to-r from-fuchsia-600 to-purple-600 text-white hover:shadow-lg hover:shadow-fuchsia-900/20 hover:-translate-y-0.5'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating Image...
                                    </>
                                ) : (
                                    <>
                                        🪄 Generate Image with AI
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="w-full">
                                <h4 className="font-bold text-fuchsia-700 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400"></span> Generated Visual
                                </h4>
                                <div className="p-2 bg-white rounded-2xl border border-fuchsia-100 shadow-sm">
                                    <img
                                        src={imageUrl}
                                        alt="Generated Technical Illustration"
                                        className="w-full max-w-2xl rounded-xl border border-slate-100 shadow-inner"
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-3 text-red-700 text-sm font-medium bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm mt-2">
                                <span className="text-xl">⚠️</span>
                                <div><strong>Image Generation Failed:</strong> {error}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
