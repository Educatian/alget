import { useState, useEffect } from 'react'
import { Sparkles, Loader2, ArrowRight } from 'lucide-react'
import API_BASE from '../lib/apiConfig'

export default function DynamicScenario({ topic, userContext }) {
    const [scenario, setScenario] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Only load if they click or it can auto-load. We will add a "Generate tailored example" button to avoid unwanted generation.
    const handleGenerate = async () => {
        setLoading(true)
        setError(null)
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || ''

            const res = await fetch(`${API_BASE}/generate_scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    context: userContext || "General application",
                    course: "inst-design",
                    api_key: apiKey
                })
            })

            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setScenario(data)
        } catch (err) {
            console.error(err)
            setError(err.message || 'Failed to generate tailored scenario.')
        } finally {
            setLoading(false)
        }
    }

    if (!scenario && !loading && !error) {
        return (
            <div className="my-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-start gap-4">
                <div className="bg-indigo-100 p-2.5 rounded-lg shrink-0">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-indigo-900 uppercase tracking-wide mb-1">Tailored Case Study: {topic}</h4>
                    <p className="text-indigo-800/80 text-sm mb-3">See how this theory applies exactly to your context.</p>
                    <button
                        onClick={handleGenerate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        Generate tailored example
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="my-6 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-600">Synthesizing a tailored scenario...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="my-6 bg-red-50 border border-red-100 rounded-xl p-5 text-red-600 text-sm">
                There was an error generating the scenario. Please try again.
            </div>
        )
    }

    return (
        <div className="my-6 bg-white border border-indigo-100 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-linear-to-r from-indigo-50 to-white px-5 py-3 border-b border-indigo-100 flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Case Study: {topic}
                </span>
                <span className="text-xs font-medium text-indigo-500 bg-indigo-100 px-2.5 py-1 rounded-full">AI Generated</span>
            </div>
            <div className="p-5 space-y-4">
                <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Scenario</h5>
                    <p className="text-slate-700 leading-relaxed text-[0.95rem]">{scenario.scenario_text}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Theoretical Mapping</h5>
                    <p className="text-slate-600 leading-relaxed text-[0.95rem]">{scenario.theoretical_mapping}</p>
                </div>
            </div>
        </div>
    )
}
