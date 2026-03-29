import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Brain, Flame, Users } from 'lucide-react'
import API_BASE from '../lib/apiConfig'
import { supabase } from '../lib/supabase'
import '../index.css'

const EMPTY_SOCIAL = {
    activeReaders: 0,
    liveSections: 0,
    averageConcurrency: 0,
    completionsToday: 0,
    helpOpensToday: 0,
    reactionsToday: 0,
    topReactions: [],
    topSections: [],
    progressByCourse: []
}

function getInitialAuthState() {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('alget_researcher_access') === 'granted'
}

function summarizeSocialData(signals = [], presenceRows = [], progressRows = []) {
    const reactionCounts = {}
    const sectionCounts = {}
    const progressByCourse = {}

    signals.forEach((signal) => {
        if (signal.signal_type === 'reaction' && signal.signal_value) {
            reactionCounts[signal.signal_value] = (reactionCounts[signal.signal_value] || 0) + 1
        }

        if (signal.section_id) {
            sectionCounts[signal.section_id] = (sectionCounts[signal.section_id] || 0) + 1
        }
    })

    progressRows.forEach((row) => {
        const course = row.course || 'unknown'
        progressByCourse[course] = (progressByCourse[course] || 0) + 1
    })

    const uniqueReaders = new Set(presenceRows.map((row) => row.presence_key || row.alias)).size
    const liveSections = new Set(presenceRows.map((row) => row.section_id)).size

    return {
        activeReaders: uniqueReaders,
        liveSections,
        averageConcurrency: liveSections > 0 ? Number((presenceRows.length / liveSections).toFixed(1)) : 0,
        completionsToday: Math.max(
            signals.filter((signal) => signal.signal_type === 'completion').length,
            progressRows.length
        ),
        helpOpensToday: signals.filter((signal) => signal.signal_type === 'help_open').length,
        reactionsToday: signals.filter((signal) => signal.signal_type === 'reaction').length,
        topReactions: Object.entries(reactionCounts)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 4),
        topSections: Object.entries(sectionCounts)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 5),
        progressByCourse: Object.entries(progressByCourse)
            .sort((left, right) => right[1] - left[1])
    }
}

function formatConceptLabel(conceptId) {
    return String(conceptId || '').replace(/_/g, ' ')
}

function formatSignalLabel(signalId) {
    return String(signalId || '').replace(/_/g, ' ')
}

export default function AnalyticsDashboard() {
    const navigate = useNavigate()
    const [passcode, setPasscode] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [masteryData, setMasteryData] = useState([])
    const [socialMetrics, setSocialMetrics] = useState(EMPTY_SOCIAL)

    const masteryOverview = useMemo(() => {
        if (masteryData.length === 0) {
            return {
                average: 0,
                highMastery: 0,
                supportNeeded: 0
            }
        }

        const average = masteryData.reduce((sum, row) => sum + (row.mastery_score || 0), 0) / masteryData.length
        const highMastery = masteryData.filter((row) => (row.mastery_score || 0) >= 0.8).length
        const supportNeeded = masteryData.filter((row) => (row.mastery_score || 0) < 0.5).length

        return {
            average: Math.round(average * 100),
            highMastery,
            supportNeeded
        }
    }, [masteryData])

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

    const fetchDashboardData = async () => {
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const userId = session?.user?.id

            const masteryPromise = userId
                ? supabase
                    .from('mastery')
                    .select('concept_id, mastery_score, confidence_level, correct_count, attempts_count')
                    .eq('user_id', userId)
                    .order('mastery_score', { ascending: false })
                : Promise.resolve({ data: [], error: null })

            const now = Date.now()
            const dayCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString()
            const liveCutoff = new Date(now - 5 * 60 * 1000).toISOString()

            const socialSignalsPromise = supabase
                .from('social_signals')
                .select('section_id, course, signal_type, signal_value, created_at')
                .gte('created_at', dayCutoff)

            const socialPresencePromise = supabase
                .from('social_presence')
                .select('presence_key, alias, course, section_id, last_seen_at')
                .gte('last_seen_at', liveCutoff)

            const progressPromise = supabase
                .from('course_progress')
                .select('course, section_id, completed_at')
                .gte('completed_at', dayCutoff)

            const [masteryResponse, socialSignalsResponse, socialPresenceResponse, progressResponse] = await Promise.all([
                masteryPromise,
                socialSignalsPromise,
                socialPresencePromise,
                progressPromise
            ])

            if (masteryResponse?.data) {
                setMasteryData(masteryResponse.data)
            }

            setSocialMetrics(
                summarizeSocialData(
                    socialSignalsResponse?.data || [],
                    socialPresenceResponse?.data || [],
                    progressResponse?.data || []
                )
            )
        } catch (err) {
            console.error('Error fetching analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthenticated) {
            void fetchDashboardData()
        }
    }, [isAuthenticated])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(158,27,50,0.08),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-[2.2rem] border border-white/80 bg-white/82 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-white shadow-lg shadow-red-900/20">
                            <Brain className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Researcher Dashboard</h1>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Access mastery, social pulse, progression, and cohort-level learning signals.
                        </p>
                    </div>

                    <form onSubmit={handleAuthenticate} className="space-y-4">
                        <input
                            type="password"
                            value={passcode}
                            onChange={(event) => setPasscode(event.target.value)}
                            placeholder="Enter researcher access code"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center tracking-[0.18em] text-slate-900 outline-none transition-all focus:border-[#9E1B32] focus:ring-2 focus:ring-[#9E1B32]/10"
                            autoFocus
                        />
                        {error && <p className="text-center text-sm font-medium text-red-500">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60"
                        >
                            {loading ? 'Checking access...' : 'Unlock dashboard'}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </form>

                    <button
                        onClick={() => navigate('/')}
                        className="mt-4 w-full text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
                    >
                        Back to home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(158,27,50,0.08),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.08),_transparent_26%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">
                <header className="rounded-[2.5rem] border border-white/80 bg-white/82 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9E1B32]">Research surface</p>
                            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                                Open learner model and
                                <span className="block bg-gradient-to-r from-[#9E1B32] via-[#c41e3a] to-[#2563eb] bg-clip-text text-transparent">
                                    social learning pulse
                                </span>
                            </h1>
                            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600">
                                Review student knowledge state, live presence, completion momentum, help-seeking behavior, and section-level activity from a single dashboard.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => fetchDashboardData()}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <button
                                onClick={() => {
                                    window.sessionStorage.removeItem('alget_researcher_access')
                                    setIsAuthenticated(false)
                                }}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                Lock
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                            >
                                Exit dashboard
                            </button>
                        </div>
                    </div>
                </header>

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[2rem] border border-white/80 bg-white/82 p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Average mastery</p>
                            <Brain className="h-5 w-5 text-[#9E1B32]" />
                        </div>
                        <p className="mt-4 text-4xl font-black text-slate-950">{masteryOverview.average}%</p>
                        <p className="mt-2 text-sm text-slate-500">{masteryOverview.highMastery} high-mastery concepts tracked for this learner.</p>
                    </div>

                    <div className="rounded-[2rem] border border-white/80 bg-white/82 p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Active readers now</p>
                            <Users className="h-5 w-5 text-emerald-600" />
                        </div>
                        <p className="mt-4 text-4xl font-black text-slate-950">{socialMetrics.activeReaders}</p>
                        <p className="mt-2 text-sm text-slate-500">{socialMetrics.liveSections} sections currently show live presence.</p>
                    </div>

                    <div className="rounded-[2rem] border border-white/80 bg-white/82 p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Completion momentum</p>
                            <Flame className="h-5 w-5 text-amber-500" />
                        </div>
                        <p className="mt-4 text-4xl font-black text-slate-950">{socialMetrics.completionsToday}</p>
                        <p className="mt-2 text-sm text-slate-500">Sections completed in the last 24 hours.</p>
                    </div>

                    <div className="rounded-[2rem] border border-white/80 bg-white/82 p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Help-open events</p>
                            <Activity className="h-5 w-5 text-sky-500" />
                        </div>
                        <p className="mt-4 text-4xl font-black text-slate-950">{socialMetrics.helpOpensToday}</p>
                        <p className="mt-2 text-sm text-slate-500">Support rail openings recorded across live sections today.</p>
                    </div>
                </section>

                <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[2.5rem] border border-white/80 bg-white/82 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Learner model</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Concept mastery distribution</h2>
                            </div>
                            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                                {masteryOverview.supportNeeded} concepts need support
                            </div>
                        </div>

                        {loading && masteryData.length === 0 ? (
                            <div className="py-20 text-center text-slate-500">Loading analytics...</div>
                        ) : masteryData.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                    <Brain className="h-8 w-8" />
                                </div>
                                <h3 className="mt-5 text-xl font-bold text-slate-800">No mastery data yet</h3>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                    Learner-model records will appear after diagnostics, knowledge checks, and practice attempts are completed.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-8 grid gap-5 md:grid-cols-2">
                                {masteryData.map((concept, index) => (
                                    <div key={`${concept.concept_id}-${index}`} className="group relative overflow-hidden rounded-[1.8rem] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                                        <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl opacity-20 ${concept.mastery_score >= 0.8 ? 'bg-emerald-500' : concept.mastery_score >= 0.5 ? 'bg-amber-400' : 'bg-[#9E1B32]'}`}></div>
                                        <div className="relative">
                                            <div className="mb-4 flex items-start justify-between gap-4">
                                                <h3 className="text-lg font-bold uppercase tracking-[0.08em] text-slate-900">
                                                    {formatConceptLabel(concept.concept_id)}
                                                </h3>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${concept.mastery_score >= 0.8 ? 'bg-emerald-50 text-emerald-700' : concept.mastery_score >= 0.5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                                    {Math.round((concept.mastery_score || 0) * 100)}%
                                                </span>
                                            </div>

                                            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className={`h-full rounded-full ${concept.mastery_score >= 0.8 ? 'bg-emerald-500' : concept.mastery_score >= 0.5 ? 'bg-amber-400' : 'bg-[#9E1B32]'}`}
                                                    style={{ width: `${Math.max(6, (concept.mastery_score || 0) * 100)}%` }}
                                                ></div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                                                    <p className="mt-1 font-semibold capitalize text-slate-700">{concept.confidence_level}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Accuracy</p>
                                                    <p className="mt-1 font-semibold text-slate-700">{concept.correct_count} / {concept.attempts_count}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-8">
                        <div className="rounded-[2.5rem] border border-white/80 bg-white/82 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Social pulse</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Cohort activity snapshot</h2>
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Average concurrency</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{socialMetrics.averageConcurrency}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Reactions today</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{socialMetrics.reactionsToday}</p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Top reactions</p>
                                <div className="mt-3 space-y-3">
                                    {socialMetrics.topReactions.length === 0 ? (
                                        <p className="text-sm text-slate-500">No social reactions captured yet.</p>
                                    ) : socialMetrics.topReactions.map(([reaction, count]) => (
                                        <div key={reaction} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                            <span className="text-sm font-semibold text-slate-700 capitalize">{formatSignalLabel(reaction)}</span>
                                            <span className="text-sm font-bold text-slate-900">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[2.5rem] border border-white/80 bg-white/82 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Pathway progress</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Completion by course</h2>
                            <div className="mt-5 space-y-4">
                                {socialMetrics.progressByCourse.length === 0 ? (
                                    <p className="text-sm text-slate-500">Cloud progress will appear here after synced completions are recorded.</p>
                                ) : socialMetrics.progressByCourse.map(([course, count]) => (
                                    <div key={course}>
                                        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                                            <span className="capitalize">{formatConceptLabel(course)}</span>
                                            <span>{count}</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-linear-to-r from-[#9E1B32] to-[#2563eb]" style={{ width: `${Math.min(100, count * 10)}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Most active sections</p>
                                <div className="mt-3 space-y-3">
                                    {socialMetrics.topSections.length === 0 ? (
                                        <p className="text-sm text-slate-500">Section activity will appear once reading and reactions accumulate.</p>
                                    ) : socialMetrics.topSections.map(([sectionId, count]) => (
                                        <div key={sectionId} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                            <span className="text-sm font-semibold text-slate-700">{sectionId}</span>
                                            <span className="text-sm font-bold text-slate-900">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
