import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../lib/apiConfig'
import { supabase } from '../lib/supabase'
import '../index.css'

export default function AnalyticsDashboard() {
    const navigate = useNavigate()
    const [passcode, setPasscode] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(() => typeof window !== 'undefined' && window.sessionStorage.getItem('alget_researcher_access') === 'granted')
    const [error, setError] = useState('')

    const [masteryData, setMasteryData] = useState([])
    const [loading, setLoading] = useState(false)

    const handleAuthenticate = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        try {
            const response = await fetch(`${API_BASE}/access/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'researcher',
                    passcode
                })
            })

            if (!response.ok) {
                throw new Error(`Access validation failed: ${response.status}`)
            }

            const data = await response.json()
            if (!data.valid) {
                setError('Invalid access code')
                setPasscode('')
                return
            }

            window.sessionStorage.setItem('alget_researcher_access', 'granted')
            setIsAuthenticated(true)
            setPasscode('')
        } catch (err) {
            console.error('Error validating dashboard access:', err)
            setError('Unable to validate access right now')
        } finally {
            setLoading(false)
        }
    }

    const fetchMasteryData = async () => {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const userIdToFetch = session?.user?.id

            if (!userIdToFetch) {
                console.warn('No active user session found for fetching analytics')
                return
            }

            const { data } = await supabase
                .from('mastery')
                .select('concept_id, mastery_score, confidence_level, correct_count, attempts_count')
                .eq('user_id', userIdToFetch)
                .order('mastery_score', { ascending: false })

            if (data) {
                setMasteryData(data)
            }
        } catch (err) {
            console.error('Error fetching analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthenticated) {
            void fetchMasteryData()
        }
    }, [isAuthenticated])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="glass-panel p-8 max-w-sm w-full bg-white/70 shadow-2xl rounded-2xl border border-white/60">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-linear-to-br from-[#9E1B32] to-[#7A1527] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-900/20">
                            <span className="text-3xl">Charts</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Analytics Access</h1>
                        <p className="text-sm text-slate-500 mt-2">Researcher and Instructor Dashboard</p>
                    </div>

                    <form onSubmit={handleAuthenticate} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={passcode}
                                onChange={(event) => setPasscode(event.target.value)}
                                placeholder="Enter access code..."
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9E1B32] focus:border-transparent text-center tracking-widest transition-all shadow-inner"
                                autoFocus
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm text-center font-medium animate-shake">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            <span>{loading ? 'Checking access...' : 'Unlock Dashboard'}</span>
                            <span className="text-xl">Open</span>
                        </button>
                    </form>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full mt-4 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 bg-white/40 border border-white/60">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="text-4xl">Model</span> Open Learner Model
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Tracking knowledge state across physics and biology concepts.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchMasteryData()}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
                        >
                            <span className={loading ? 'animate-spin' : ''}>Refresh</span>
                        </button>
                        <button
                            onClick={() => {
                                window.sessionStorage.removeItem('alget_researcher_access')
                                setIsAuthenticated(false)
                            }}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm shadow-sm"
                        >
                            Lock
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm shadow-md"
                        >
                            Exit Dashboard
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin text-2xl font-semibold text-slate-500">Loading</div>
                    </div>
                ) : masteryData.length === 0 ? (
                    <div className="glass-panel p-12 text-center bg-white/40 border border-white/60">
                        <div className="text-6xl mb-4 opacity-50">Model</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No Mastery Data Yet</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Learner-model cards will appear here after the student completes diagnostics, knowledge checks, or practice.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {masteryData.map((concept, index) => (
                            <div key={`${concept.concept_id}-${index}`} className="glass-panel p-6 bg-white hover:-translate-y-1 transition-transform border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] group overflow-hidden relative">
                                <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity ${concept.mastery_score >= 0.8 ? 'bg-emerald-500' : concept.mastery_score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg uppercase tracking-wider">{concept.concept_id}</h3>
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${concept.mastery_score >= 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            concept.mastery_score >= 0.5 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            {Math.round(concept.mastery_score * 100)}%
                                        </span>
                                    </div>

                                    <div className="w-full h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${concept.mastery_score >= 0.8 ? 'bg-emerald-500' :
                                                concept.mastery_score >= 0.5 ? 'bg-yellow-400' :
                                                    'bg-[#9E1B32]'
                                                }`}
                                            style={{ width: `${Math.max(5, concept.mastery_score * 100)}%` }}
                                        ></div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-100 pt-4 mt-auto">
                                        <div>
                                            <p className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-1">Confidence</p>
                                            <p className="font-semibold text-slate-700 capitalize">{concept.confidence_level}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-1">Accuracy</p>
                                            <p className="font-semibold text-slate-700">
                                                {concept.correct_count} / {concept.attempts_count} correct
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
