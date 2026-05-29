import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, FileText, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../lib/apiConfig';

import BiologyCard from '../components/BiologyCard';
import EngineeringCard from '../components/EngineeringCard';
import ValidationBadge from '../components/ValidationBadge';
import SimulationFrame from '../components/SimulationFrame';
import JanineEvaluator from '../components/JanineEvaluator';
import ScaffoldingCard from '../components/ScaffoldingCard';
import IllustrationCard from '../components/IllustrationCard';
import { BrainstormIntentCard, ErrorIntentCard } from '../components/IntentCards';

export default function GenerativeLab() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [generatingCurriculum, setGeneratingCurriculum] = useState(false);

    const handleQuerySubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        const userText = query;
        const currentHistory = [...history, { role: 'user', content: userText }];

        setHistory(currentHistory);
        setQuery('');
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
            const response = await fetch(`${API_BASE}/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userText,
                    course: 'bio-inspired',
                    grade_level: 'Undergraduate',
                    interest: 'Bio-Inspired Design',
                    current_content: '',
                    history: history,         // Send the history *before* this query
                    api_key: apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            setResult(data);

            // Append assistant response to state memory for the next turn
            let assistantContent = "Responded.";
            if (data.summary) {
                assistantContent = typeof data.summary === 'string' ? data.summary : (data.summary.synthesis || JSON.stringify(data.summary));
            } else if (data.scaffolding) {
                assistantContent = typeof data.scaffolding === 'string' ? data.scaffolding : (data.scaffolding.encouraging_remark || JSON.stringify(data.scaffolding));
            } else if (data.evaluation) {
                assistantContent = "Received evaluation.";
            } else if (data.illustration) {
                assistantContent = "Created illustration.";
            } else if (data.activity_brainstorm) {
                assistantContent = data.activity_brainstorm.lateral_thinking_prompt || "Created a brainstorm.";
            } else if (data.error) {
                assistantContent = data.error;
            }
            
            setHistory([...currentHistory, { role: 'assistant', content: assistantContent }]);

        } catch (err) {
            console.error(err);
            setError("Failed to generate response. Check your API key or network connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateModule = async () => {
        if (!result || !result.biology_context || !result.engineering_application) return;

        setGeneratingCurriculum(true);
        setError(null);

        try {
            const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
            const response = await fetch(`${API_BASE}/book/generate_custom_module`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    biology_context: JSON.stringify(result.biology_context),
                    engineering_application: JSON.stringify(result.engineering_application),
                    api_key: apiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.chapter) {
                navigate(`/book/${data.course}/${data.chapter}/${data.section}`);
            } else {
                setError(data.message || "Failed to generate textbook module.");
            }

        } catch (err) {
            console.error(err);
            setError(`Curriculum generation failed: ${err.message}`);
        } finally {
            setGeneratingCurriculum(false);
        }
    };

    return (
        <div className="editorial-shell min-h-screen font-sans selection:bg-[color-mix(in_srgb,var(--ath-primary)_20%,transparent)] flex flex-col">
            {/* Premium Header */}
            <header className="bg-[color-mix(in_srgb,var(--ath-surface-strong)_82%,transparent)] backdrop-blur-2xl border-b border-[var(--ath-line)] shadow-[0_4px_30px_rgb(0,0,0,0.03)] sticky top-0 z-50 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            aria-label="Back to ALGET home"
                            className="group flex items-center gap-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_40%,transparent)]"
                        >
                            <div className="w-11 h-11 bg-[linear-gradient(135deg,var(--ath-primary),var(--ath-primary-deep))] rounded-2xl flex items-center justify-center shadow-[0_12px_24px_rgba(9,56,72,0.18)]">
                                <span className="text-white text-xl font-extrabold tracking-tight">AL</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-[var(--ath-text)] tracking-tight">Generative Bio-Design Lab</h1>
                                <p className="text-xs text-[var(--ath-secondary)] font-semibold uppercase tracking-wider mt-0.5">ALGET Intelligent Platform</p>
                            </div>
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="editorial-button-secondary hidden sm:flex items-center gap-2 px-4 py-2 text-sm"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-5xl mx-auto w-full p-6 lg:p-8 flex flex-col gap-8">

                {/* Generative Input Area */}
                <div className="editorial-surface p-8 lg:p-10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--ath-primary-soft)_45%,transparent),transparent_60%)] pointer-events-none"></div>
                    <div className="relative z-10 w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-[var(--ath-primary-soft)] text-[var(--ath-primary)] rounded-xl flex items-center justify-center text-xl shadow-sm border border-[color-mix(in_srgb,var(--ath-primary)_18%,transparent)]">
                                <Lightbulb className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <h2 className="text-2xl font-bold text-[var(--ath-text)] tracking-tight">What do you want to explore?</h2>
                        </div>
                        <p className="text-[var(--ath-muted)] text-[1.05rem] font-medium leading-relaxed mb-6">
                            Ask a question, propose a design, or ask to brainstorm a biological concept.
                        </p>

                        <form onSubmit={handleQuerySubmit} className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g., How do geckos climb walls? Or brainstorm flight ideas."
                                className="editorial-input flex-1 font-medium"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={loading || !query.trim()}
                                className="editorial-button px-8 py-3.5 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating...
                                    </>
                                ) : 'Generate Analysis'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Error Handling */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 rounded-r-xl shadow-sm font-medium flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" aria-hidden="true" /> {error}
                    </div>
                )}

                {/* Chat History Feed */}
                {history.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {history.map((msg, idx) => {
                            // Hide the very last assistant message here because it is beautifully rendered below in the Results Area
                            if (idx === history.length - 1 && msg.role === 'assistant') {
                                return null;
                            }
                            return (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`px-5 py-4 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm ${msg.role === 'user'
                                        ? 'bg-[var(--ath-primary-deep)] text-white border border-[var(--ath-primary-deep)]'
                                        : 'editorial-surface text-[var(--ath-text)] prose prose-sm max-w-none'
                                        }`}>
                                        {msg.role === 'assistant' ? (
                                            <div dangerouslySetInnerHTML={{ __html: (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)).replace(/\n/g, '<br />') }} />
                                        ) : (
                                            <p className="m-0 text-[15px] font-medium leading-relaxed">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Results Area */}
                {result && (
                    <div className="flex flex-col gap-6 transition-opacity duration-500 pb-16">

                        {/* Intent Badge & Generate Textbook Action */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                            <div className="flex items-center gap-3 editorial-surface p-3.5 self-start">
                                <span className="text-[var(--ath-muted)] font-semibold text-sm">Detected Intent:</span>
                                <span className="px-3 py-1 bg-[var(--ath-primary-soft)] text-[var(--ath-primary-deep)] uppercase tracking-widest text-xs font-bold rounded-lg border border-[color-mix(in_srgb,var(--ath-primary)_18%,transparent)]">
                                    {result.intent || 'Unknown'}
                                </span>
                            </div>

                            {result.biology_context && result.engineering_application && (
                                <button
                                    onClick={handleGenerateModule}
                                    disabled={generatingCurriculum}
                                    className="px-5 py-3 bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {generatingCurriculum ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Synthesizing Module...
                                        </>
                                    ) : (
                                        <>
                                            <BookOpen className="h-5 w-5" aria-hidden="true" /> Convert to Textbook Module
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Synthesized Output (Tutor / Activity) */}
                        {result.summary && (
                            <div className="editorial-surface p-8 text-[var(--ath-text)] leading-relaxed max-w-none prose prose-lg">
                                <div className="flex items-center gap-3 border-b border-[var(--ath-line)] pb-4 mb-5 text-[var(--ath-primary)]">
                                    <FileText className="h-6 w-6" aria-hidden="true" />
                                    <h3 className="text-xl font-bold text-[var(--ath-text)] m-0">Synthesis</h3>
                                </div>
                                <div className="font-medium text-[1.05rem]" dangerouslySetInnerHTML={{ __html: (typeof result.summary === 'string' ? result.summary : (result.summary.synthesis || JSON.stringify(result.summary))).replace(/\n/g, '<br />') }} />

                                {typeof result.summary === 'object' && result.summary.encouragement && (
                                    <p className="mt-6 italic text-[var(--ath-muted)] font-medium">{result.summary.encouragement}</p>
                                )}

                                {typeof result.summary === 'object' && result.summary.next_steps && result.summary.next_steps.length > 0 && (
                                    <div className="mt-5 bg-[var(--ath-panel-muted)] p-4 rounded-xl border border-[var(--ath-line)]">
                                        <p className="font-bold text-[var(--ath-text)] text-sm tracking-wide uppercase mb-3">Next Steps to Explore:</p>
                                        <ul className="list-disc pl-5 m-0 space-y-2">
                                            {result.summary.next_steps.map((step, idx) => (
                                                <li key={idx} className="text-[var(--ath-muted)] text-[0.95rem]">{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {result.intent === 'brainstorm' && result.activity_brainstorm && (
                            <div className="w-full">
                                <BrainstormIntentCard data={result} />
                            </div>
                        )}

                        {result.intent === 'error' && (
                            <div className="w-full">
                                <ErrorIntentCard data={result} />
                            </div>
                        )}

                        {/* Grid for Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col">
                                {result.biology_context && <BiologyCard data={result.biology_context} />}
                            </div>
                            <div className="flex flex-col">
                                {result.engineering_application && <EngineeringCard data={result.engineering_application} />}
                            </div>
                        </div>

                        {/* Validation & Simulation Layout */}
                        {result.validation_critique && (
                            <div className="w-full">
                                <ValidationBadge data={result.validation_critique} iterations={result.iterations} />
                            </div>
                        )}

                        {/* Scaffolding Block */}
                        {result.scaffolding && (
                            <div className="w-full">
                                <ScaffoldingCard data={result.scaffolding} />
                            </div>
                        )}

                        {/* Illustration Block */}
                        {result.illustration && (
                            <div className="w-full">
                                <IllustrationCard data={result.illustration} />
                            </div>
                        )}

                        {/* Simulation Block */}
                        {result.simulation && result.simulation.html_code && (
                            <div className="w-full">
                                <SimulationFrame
                                    htmlCode={result.simulation.html_code}
                                    description={result.simulation.description}
                                    concepts={result.simulation.concepts_shown}
                                />
                            </div>
                        )}

                        {/* Janine Benyus Evaluator Block (only on Evaluate intent typically) */}
                        {result.evaluation && (
                            <div className="w-full">
                                <JanineEvaluator evaluation={result.evaluation} />
                            </div>
                        )}

                    </div>
                )}
            </main>
        </div>
    );
}
