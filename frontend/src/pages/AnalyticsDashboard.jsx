import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Brain, Flame, Users } from 'lucide-react'
import API_BASE from '../lib/apiConfig'
import { safeSessionStorageGet, safeSessionStorageRemove, safeSessionStorageSet } from '../lib/browserStorage'
import { fetchResearchDashboardSnapshot, fetchRctSnapshot, getResearchDashboardSnapshot } from '../lib/researchService'
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
    progressByCourse: [],
    liveSectionConcurrency: [],
    signalMix: []
}

function getInitialAuthState() {
    return safeSessionStorageGet('alget_researcher_access') === 'granted'
}

function summarizeSocialData(signals = [], presenceRows = [], progressRows = []) {
    const reactionCounts = {}
    const sectionCounts = {}
    const progressByCourse = {}
    const signalMix = {}
    const liveSectionConcurrency = {}

    signals.forEach((signal) => {
        if (signal.signal_type === 'reaction' && signal.signal_value) {
            reactionCounts[signal.signal_value] = (reactionCounts[signal.signal_value] || 0) + 1
        }

        if (signal.signal_type) {
            signalMix[signal.signal_type] = (signalMix[signal.signal_type] || 0) + 1
        }

        if (signal.section_id) {
            sectionCounts[signal.section_id] = (sectionCounts[signal.section_id] || 0) + 1
        }
    })

    progressRows.forEach((row) => {
        const course = row.course || 'unknown'
        progressByCourse[course] = (progressByCourse[course] || 0) + 1
    })

    presenceRows.forEach((row) => {
        if (!row.section_id) return
        if (!liveSectionConcurrency[row.section_id]) {
            liveSectionConcurrency[row.section_id] = {
                count: 0,
                course: row.course || 'unknown'
            }
        }
        liveSectionConcurrency[row.section_id].count += 1
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
            .sort((left, right) => right[1] - left[1]),
        liveSectionConcurrency: Object.entries(liveSectionConcurrency)
            .map(([sectionId, data]) => ({ sectionId, course: data.course, count: data.count }))
            .sort((left, right) => right.count - left.count)
            .slice(0, 5),
        signalMix: Object.entries(signalMix)
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
    const [socialSignals, setSocialSignals] = useState([])
    const [socialPresenceRows, setSocialPresenceRows] = useState([])
    const [progressRows, setProgressRows] = useState([])
    const [conceptQuery, setConceptQuery] = useState('')
    const [masteryBand, setMasteryBand] = useState('all')
    const [courseFilter, setCourseFilter] = useState('all')
    const [signalFilter, setSignalFilter] = useState('all')
    const [researchSnapshot, setResearchSnapshot] = useState(() => getResearchDashboardSnapshot())
    const [rctSnapshot, setRctSnapshot] = useState({ interventionOutcomes: [], evaluationGains: [], telemetryProfile: [] })

    const filteredMasteryData = useMemo(() => {
        return masteryData.filter((row) => {
            const matchesQuery = !conceptQuery || String(row.concept_id || '').toLowerCase().includes(conceptQuery.toLowerCase())

            const score = row.mastery_score || 0
            const matchesBand =
                masteryBand === 'all' ||
                (masteryBand === 'support' && score < 0.5) ||
                (masteryBand === 'emerging' && score >= 0.5 && score < 0.8) ||
                (masteryBand === 'strong' && score >= 0.8)

            return matchesQuery && matchesBand
        })
    }, [conceptQuery, masteryBand, masteryData])

    const filteredSocialSignals = useMemo(() => {
        return socialSignals.filter((row) => {
            const matchesCourse = courseFilter === 'all' || row.course === courseFilter
            const matchesSignal = signalFilter === 'all' || row.signal_type === signalFilter
            const matchesQuery =
                !conceptQuery ||
                String(row.section_id || '').toLowerCase().includes(conceptQuery.toLowerCase()) ||
                String(row.signal_value || '').toLowerCase().includes(conceptQuery.toLowerCase())

            return matchesCourse && matchesSignal && matchesQuery
        })
    }, [conceptQuery, courseFilter, signalFilter, socialSignals])

    const filteredSocialPresenceRows = useMemo(() => {
        return socialPresenceRows.filter((row) => {
            const matchesCourse = courseFilter === 'all' || row.course === courseFilter
            const matchesQuery = !conceptQuery || String(row.section_id || '').toLowerCase().includes(conceptQuery.toLowerCase())
            return matchesCourse && matchesQuery
        })
    }, [conceptQuery, courseFilter, socialPresenceRows])

    const filteredProgressRows = useMemo(() => {
        return progressRows.filter((row) => {
            const matchesCourse = courseFilter === 'all' || row.course === courseFilter
            const matchesQuery = !conceptQuery || String(row.section_id || '').toLowerCase().includes(conceptQuery.toLowerCase())
            return matchesCourse && matchesQuery
        })
    }, [conceptQuery, courseFilter, progressRows])

    const socialMetrics = useMemo(() => {
        if (
            filteredSocialSignals.length === 0 &&
            filteredSocialPresenceRows.length === 0 &&
            filteredProgressRows.length === 0
        ) {
            return EMPTY_SOCIAL
        }

        return summarizeSocialData(filteredSocialSignals, filteredSocialPresenceRows, filteredProgressRows)
    }, [filteredProgressRows, filteredSocialPresenceRows, filteredSocialSignals])

    const availableCourses = useMemo(() => {
        return Array.from(
            new Set([
                ...socialSignals.map((row) => row.course),
                ...socialPresenceRows.map((row) => row.course),
                ...progressRows.map((row) => row.course)
            ].filter(Boolean))
        ).sort()
    }, [progressRows, socialPresenceRows, socialSignals])

    const availableSignals = useMemo(() => {
        return Array.from(new Set(socialSignals.map((row) => row.signal_type).filter(Boolean))).sort()
    }, [socialSignals])

    const masteryOverview = useMemo(() => {
        if (filteredMasteryData.length === 0) {
            return {
                average: 0,
                highMastery: 0,
                supportNeeded: 0
            }
        }

        const average = filteredMasteryData.reduce((sum, row) => sum + (row.mastery_score || 0), 0) / filteredMasteryData.length
        const highMastery = filteredMasteryData.filter((row) => (row.mastery_score || 0) >= 0.8).length
        const supportNeeded = filteredMasteryData.filter((row) => (row.mastery_score || 0) < 0.5).length

        return {
            average: Math.round(average * 100),
            highMastery,
            supportNeeded
        }
    }, [filteredMasteryData])

    const struggleConcepts = useMemo(() => {
        return filteredMasteryData
            .filter((row) => (row.mastery_score || 0) < 0.6)
            .sort((left, right) => {
                const leftScore = left.mastery_score || 0
                const rightScore = right.mastery_score || 0
                if (leftScore !== rightScore) {
                    return leftScore - rightScore
                }
                return (right.attempts_count || 0) - (left.attempts_count || 0)
            })
            .slice(0, 6)
    }, [filteredMasteryData])

    const artifactMetrics = researchSnapshot.artifactMetrics || {
        totalScores: 0,
        averageOverallRevisionQuality: 0,
        averageEvidenceAlignment: 0,
        averageRevisionDepth: 0,
        averageJudgmentQuality: 0,
        weakEvidenceCount: 0,
        shallowRevisionCount: 0,
        judgmentRiskCount: 0,
        transferReadyCount: 0,
        recentScores: []
    }

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

            safeSessionStorageSet('alget_researcher_access', 'granted')
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
            const nextResearchSnapshot = await fetchResearchDashboardSnapshot()
            const nextRctSnapshot = await fetchRctSnapshot()

            if (masteryResponse?.data) {
                setMasteryData(masteryResponse.data)
            }
            setSocialSignals(socialSignalsResponse?.data || [])
            setSocialPresenceRows(socialPresenceResponse?.data || [])
            setProgressRows(progressResponse?.data || [])
            setResearchSnapshot(nextResearchSnapshot)
            setRctSnapshot(nextRctSnapshot)
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
            <div className="editorial-shell flex min-h-screen items-center justify-center p-4">
                <div className="editorial-surface w-full max-w-md p-8">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--ath-primary),var(--ath-primary-deep))] text-white shadow-[0_18px_36px_rgba(9,56,72,0.2)]">
                            <Brain className="h-8 w-8" />
                        </div>
                        <p className="editorial-kicker">Research Console</p>
                        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ath-text)]">Scholarly analytics</h1>
                        <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                            Access Alabama Generative Intelligent Textbook mastery, social pulse, progression, and cohort-level learning signals.
                        </p>
                    </div>

                    <form onSubmit={handleAuthenticate} className="space-y-4">
                        <input
                            type="password"
                            value={passcode}
                            onChange={(event) => setPasscode(event.target.value)}
                            placeholder="Enter researcher access code"
                            className="editorial-input text-center tracking-[0.18em]"
                            autoFocus
                        />
                        {error && <p className="text-center text-sm font-medium text-[#8c1d1d]">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="editorial-button w-full px-5 py-3.5 text-sm disabled:opacity-60"
                        >
                            {loading ? 'Checking access...' : 'Unlock dashboard'}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </form>

                    <button
                        onClick={() => navigate('/')}
                        className="mt-4 w-full text-sm font-medium text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-primary)]"
                    >
                        Back to home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="editorial-shell min-h-screen p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">
                <header className="rounded-2xl border border-[var(--ath-line)] bg-white/85 px-5 py-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-base font-semibold tracking-tight text-[var(--ath-text)]">Research Console</h1>
                        <span className="text-[var(--ath-line-strong)]">/</span>
                        <span className="text-xs font-medium text-[var(--ath-muted)]">ALGET</span>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => fetchDashboardData()}
                                className="rounded-full border border-[var(--ath-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ath-muted)] hover:bg-[var(--ath-panel)]"
                            >
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <button
                                onClick={() => {
                                    safeSessionStorageRemove('alget_researcher_access')
                                    setIsAuthenticated(false)
                                }}
                                className="rounded-full border border-[var(--ath-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ath-muted)] hover:bg-[var(--ath-panel)]"
                            >
                                Lock
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="rounded-full bg-[var(--ath-primary)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--ath-primary-deep)]"
                            >
                                Exit
                            </button>
                        </div>
                    </div>
                </header>

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="editorial-surface p-6">
                        <div className="flex items-center justify-between">
                            <p className="editorial-label">Average mastery</p>
                            <Brain className="h-5 w-5 text-[var(--ath-primary)]" />
                        </div>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">{masteryOverview.average}%</p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">{masteryOverview.highMastery} high-mastery concepts tracked for this learner.</p>
                    </div>

                    <div className="editorial-surface p-6">
                        <div className="flex items-center justify-between">
                            <p className="editorial-label">Active readers now</p>
                            <Users className="h-5 w-5 text-emerald-600" />
                        </div>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">{socialMetrics.activeReaders}</p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">{socialMetrics.liveSections} sections currently show live presence.</p>
                    </div>

                    <div className="editorial-surface p-6">
                        <div className="flex items-center justify-between">
                            <p className="editorial-label">Completion momentum</p>
                            <Flame className="h-5 w-5 text-amber-500" />
                        </div>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">{socialMetrics.completionsToday}</p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">Sections completed in the last 24 hours.</p>
                    </div>

                    <div className="editorial-surface p-6">
                        <div className="flex items-center justify-between">
                            <p className="editorial-label">Help-open events</p>
                            <Activity className="h-5 w-5 text-sky-500" />
                        </div>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">{socialMetrics.helpOpensToday}</p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">Support rail openings recorded across live sections today.</p>
                    </div>
                </section>

                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="editorial-surface p-6">
                        <p className="editorial-label">Forgetting risk</p>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">
                            {Math.round((researchSnapshot.learnerMetrics.averageForgettingRisk || 0) * 100)}%
                        </p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">Average retrieval fragility across the research learner-state model.</p>
                    </div>
                    <div className="editorial-surface p-6">
                        <p className="editorial-label">Predicted next success</p>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">
                            {Math.round((researchSnapshot.learnerMetrics.averagePredictedNextCorrect || 0) * 100)}%
                        </p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">Forecasted correctness on the next targeted attempt.</p>
                    </div>
                    <div className="editorial-surface p-6">
                        <p className="editorial-label">Predicted retention</p>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">
                            {Math.round((researchSnapshot.learnerMetrics.averagePredictedRetention || 0) * 100)}%
                        </p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">Expected durability after support and spaced recall.</p>
                    </div>
                    <div className="editorial-surface p-6">
                        <p className="editorial-label">Content audit mean</p>
                        <p className="mt-4 text-4xl font-semibold text-[var(--ath-text)]">
                            {researchSnapshot.contentMetrics.averageAudit || 0}
                        </p>
                        <p className="mt-2 text-sm text-[var(--ath-muted)]">
                            Approval rate {Math.round((researchSnapshot.contentMetrics.approvalRate || 0) * 100)}% / blocked audits {researchSnapshot.contentMetrics.blockedCount || 0}.
                        </p>
                    </div>
                </section>

                <section className="editorial-surface p-6">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Filters</h2>
                            <p className="mt-2 text-sm leading-7 text-[var(--ath-muted)]">
                                Search concepts or section ids, focus the mastery band, and isolate course or signal activity without leaving the dashboard.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <input
                                type="text"
                                value={conceptQuery}
                                onChange={(event) => setConceptQuery(event.target.value)}
                                placeholder="Search concept or section..."
                                className="editorial-input min-w-[16rem]"
                            />
                            <select
                                value={masteryBand}
                                onChange={(event) => setMasteryBand(event.target.value)}
                                className="editorial-input min-w-[11rem]"
                            >
                                <option value="all">All mastery bands</option>
                                <option value="support">Support needed</option>
                                <option value="emerging">Emerging</option>
                                <option value="strong">Strong</option>
                            </select>
                            <select
                                value={courseFilter}
                                onChange={(event) => setCourseFilter(event.target.value)}
                                className="editorial-input min-w-[11rem]"
                            >
                                <option value="all">All courses</option>
                                {availableCourses.map((course) => (
                                    <option key={course} value={course}>{formatConceptLabel(course)}</option>
                                ))}
                            </select>
                            <select
                                value={signalFilter}
                                onChange={(event) => setSignalFilter(event.target.value)}
                                className="editorial-input min-w-[11rem]"
                            >
                                <option value="all">All signals</option>
                                {availableSignals.map((signal) => (
                                    <option key={signal} value={signal}>{formatSignalLabel(signal)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="editorial-surface p-8">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-sm font-semibold text-[var(--ath-text)]">Concept mastery distribution</h2>
                            </div>
                            <div className="editorial-chip">
                                {masteryOverview.supportNeeded} concepts need support
                            </div>
                        </div>

                        {loading && filteredMasteryData.length === 0 ? (
                            <div className="py-20 text-center text-slate-500">Loading analytics...</div>
                        ) : filteredMasteryData.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ath-panel-muted)] text-[var(--ath-secondary)]">
                                    <Brain className="h-8 w-8" />
                                </div>
                                <h3 className="mt-5 text-xl font-bold text-slate-800">No concepts match these filters</h3>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                    Try broadening the concept search or mastery band. Learner-model records appear after diagnostics, knowledge checks, and practice attempts.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-8 grid gap-5 md:grid-cols-2">
                                {filteredMasteryData.map((concept, index) => (
                                <div key={`${concept.concept_id}-${index}`} className="group relative overflow-hidden rounded-[1.8rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.78)] p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                                        <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl opacity-20 ${concept.mastery_score >= 0.8 ? 'bg-emerald-500' : concept.mastery_score >= 0.5 ? 'bg-amber-400' : 'bg-[#9E1B32]'}`}></div>
                                        <div className="relative">
                                            <div className="mb-4 flex items-start justify-between gap-4">
                                                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-[var(--ath-text)]">
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

                                            <div className="grid grid-cols-2 gap-4 border-t border-[var(--ath-line)] pt-4 text-sm">
                                                <div>
                                                    <p className="editorial-label">Confidence</p>
                                                    <p className="mt-1 font-semibold capitalize text-[var(--ath-muted)]">{concept.confidence_level}</p>
                                                </div>
                                                <div>
                                                    <p className="editorial-label">Accuracy</p>
                                                    <p className="mt-1 font-semibold text-[var(--ath-muted)]">{concept.correct_count} / {concept.attempts_count}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-8">
                        <div className="editorial-surface p-8">
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Cohort activity</h2>
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                                    <p className="editorial-label">Average concurrency</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{socialMetrics.averageConcurrency}</p>
                                </div>
                                <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                                    <p className="editorial-label">Reactions today</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{socialMetrics.reactionsToday}</p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <p className="editorial-label">Top reactions</p>
                                <div className="mt-3 space-y-3">
                                    {socialMetrics.topReactions.length === 0 ? (
                                        <p className="text-sm text-[var(--ath-muted)]">No social reactions captured yet.</p>
                                    ) : socialMetrics.topReactions.map(([reaction, count]) => (
                                        <div key={reaction} className="flex items-center justify-between rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
                                            <span className="text-sm font-semibold capitalize text-[var(--ath-muted)]">{formatSignalLabel(reaction)}</span>
                                            <span className="text-sm font-bold text-[var(--ath-text)]">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="editorial-surface p-8">
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Completion by course</h2>
                            <div className="mt-5 space-y-4">
                                {socialMetrics.progressByCourse.length === 0 ? (
                                    <p className="text-sm text-[var(--ath-muted)]">Cloud progress will appear here after synced completions are recorded.</p>
                                ) : socialMetrics.progressByCourse.map(([course, count]) => (
                                    <div key={course}>
                                        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[var(--ath-muted)]">
                                            <span className="capitalize">{formatConceptLabel(course)}</span>
                                            <span>{count}</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                                            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382)]" style={{ width: `${Math.min(100, count * 10)}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8">
                                <p className="editorial-label">Most active sections</p>
                                <div className="mt-3 space-y-3">
                                    {socialMetrics.topSections.length === 0 ? (
                                        <p className="text-sm text-[var(--ath-muted)]">Section activity will appear once reading and reactions accumulate.</p>
                                    ) : socialMetrics.topSections.map(([sectionId, count]) => (
                                        <div key={sectionId} className="flex items-center justify-between rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
                                            <span className="text-sm font-semibold text-[var(--ath-muted)]">{sectionId}</span>
                                            <span className="text-sm font-bold text-[var(--ath-text)]">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-8 lg:grid-cols-3">
                    <div className="editorial-surface p-8">
                        <h2 className="text-sm font-semibold text-[var(--ath-text)]">Intervention queue / concepts needing attention</h2>
                        <div className="mt-6 space-y-4">
                            {struggleConcepts.length === 0 ? (
                                <p className="text-sm text-[var(--ath-muted)]">No high-priority support concepts are flagged right now.</p>
                            ) : struggleConcepts.map((concept) => (
                                <div key={concept.concept_id} className="rounded-[1.6rem] border border-red-100 bg-red-50/55 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--ath-text)]">
                                                {formatConceptLabel(concept.concept_id)}
                                            </p>
                                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-500">
                                                {concept.confidence_level || 'low confidence'}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-red-600">
                                            {Math.round((concept.mastery_score || 0) * 100)}%
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm text-[var(--ath-muted)]">
                                        {concept.correct_count || 0} correct across {concept.attempts_count || 0} attempts.
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="editorial-surface p-8">
                        <h2 className="text-sm font-semibold text-[var(--ath-text)]">Live section concurrency</h2>
                        <div className="mt-6 space-y-3">
                            {socialMetrics.liveSectionConcurrency.length === 0 ? (
                                <p className="text-sm text-[var(--ath-muted)]">Live section clustering appears once active readers are present.</p>
                            ) : socialMetrics.liveSectionConcurrency.map((entry) => (
                                <div key={entry.sectionId} className="rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--ath-text)]">{entry.sectionId}</p>
                                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                {formatConceptLabel(entry.course)}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-[var(--ath-panel)] px-3 py-1 text-sm font-bold text-[var(--ath-text)]">
                                            {entry.count}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="editorial-surface p-8">
                        <h2 className="text-sm font-semibold text-[var(--ath-text)]">Signal mix today / help / reactions / completions</h2>
                        <div className="mt-6 space-y-4">
                            {socialMetrics.signalMix.length === 0 ? (
                                <p className="text-sm text-[var(--ath-muted)]">Signal mix appears after social and completion activity is recorded.</p>
                            ) : socialMetrics.signalMix.map(([signal, count]) => (
                                <div key={signal}>
                                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[var(--ath-muted)]">
                                        <span className="capitalize">{formatSignalLabel(signal)}</span>
                                        <span>{count}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                                        <div
                                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382)]"
                                            style={{ width: `${Math.min(100, count * 12)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="editorial-surface p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Artifact revision / cohort</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ath-muted)]">
                                De-identified score-derived traces show whether learners are improving claims, aligning evidence, making deeper revisions, and judging AI feedback responsibly.
                            </p>
                        </div>
                        <div className="editorial-chip">{artifactMetrics.totalScores || 0} scored traces</div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                            <p className="editorial-label">Overall quality</p>
                            <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">
                                {Math.round((artifactMetrics.averageOverallRevisionQuality || 0) * 100)}%
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                            <p className="editorial-label">Evidence alignment</p>
                            <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">
                                {Math.round((artifactMetrics.averageEvidenceAlignment || 0) * 100)}%
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                            <p className="editorial-label">Revision depth</p>
                            <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">
                                {Math.round((artifactMetrics.averageRevisionDepth || 0) * 100)}%
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                            <p className="editorial-label">Judgment quality</p>
                            <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">
                                {Math.round((artifactMetrics.averageJudgmentQuality || 0) * 100)}%
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="rounded-[1.6rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] p-5">
                            <p className="editorial-label">Instructor triage</p>
                            <div className="mt-4 space-y-3 text-sm text-[var(--ath-muted)]">
                                <div className="flex items-center justify-between">
                                    <span>Weak evidence alignment</span>
                                    <span className="font-bold text-[var(--ath-text)]">{artifactMetrics.weakEvidenceCount || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Shallow revision risk</span>
                                    <span className="font-bold text-[var(--ath-text)]">{artifactMetrics.shallowRevisionCount || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>AI judgment risk</span>
                                    <span className="font-bold text-[var(--ath-text)]">{artifactMetrics.judgmentRiskCount || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Transfer-ready traces</span>
                                    <span className="font-bold text-[var(--ath-text)]">{artifactMetrics.transferReadyCount || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.6rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] p-5">
                            <p className="editorial-label">Recent scored traces</p>
                            <div className="mt-4 space-y-3">
                                {artifactMetrics.recentScores.length === 0 ? (
                                    <p className="text-sm text-[var(--ath-muted)]">Scored work-product revisions will appear after learners log Work Product Studio traces.</p>
                                ) : artifactMetrics.recentScores.map((score) => (
                                    <div key={score.id || `${score.section_id}-${score.created_at}`} className="rounded-2xl border border-[var(--ath-line)] bg-white/70 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--ath-text)]">{score.section_id}</p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                    {score.studio_mode || 'work product'} / {score.judgment || 'judgment pending'}
                                                </p>
                                            </div>
                                            <span className="editorial-chip">{Math.round((score.overall_revision_quality || 0) * 100)}%</span>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-[var(--ath-muted)] sm:grid-cols-3">
                                            <span>Evidence {Math.round((score.evidence_alignment || 0) * 100)}%</span>
                                            <span>Revision {Math.round((score.revision_depth || 0) * 100)}%</span>
                                            <span>Judgment {Math.round((score.judgment_quality || 0) * 100)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="editorial-surface p-8">
                        <h2 className="text-sm font-semibold text-[var(--ath-text)]">Intervention traces / why this recommendation</h2>
                        <div className="mt-6 space-y-4">
                            {researchSnapshot.traces.length === 0 ? (
                                <p className="text-sm text-[var(--ath-muted)]">Recommendation traces will appear after the support rail is used.</p>
                            ) : researchSnapshot.traces.map((trace) => (
                                <div key={trace.trace_id} className="rounded-[1.5rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.74)] p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                {trace.section_title || trace.section_id}
                                            </p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                {trace.recommendation?.primary_recommendation?.action || 'support'} / {trace.status}
                                            </p>
                                        </div>
                                        <span className="editorial-chip">
                                            {Math.round(((trace.recommendation?.reasoning?.confidence || 0) * 100))}% confidence
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">
                                        {trace.recommendation?.primary_recommendation?.rationale || 'No rationale recorded.'}
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {(trace.recommendation?.reasoning?.reason_codes || []).map((code) => (
                                            <span key={code} className="editorial-chip">{formatConceptLabel(code)}</span>
                                        ))}
                                    </div>
                                    {(trace.recommendation?.reasoning?.recommended_because || []).length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            {trace.recommendation.reasoning.recommended_because.map((item, index) => (
                                                <p key={`${trace.trace_id}-${index}`} className="text-xs leading-6 text-[var(--ath-muted)]">{item}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="editorial-surface p-8">
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Pre / post / retention</h2>
                            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                                    <p className="editorial-label">Pre</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{researchSnapshot.evaluationMetrics.preAverage}%</p>
                                </div>
                                <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                                    <p className="editorial-label">Post</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{researchSnapshot.evaluationMetrics.postAverage}%</p>
                                </div>
                                <div className="rounded-2xl bg-[var(--ath-panel-muted)] p-4">
                                    <p className="editorial-label">Retention</p>
                                    <p className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{researchSnapshot.evaluationMetrics.retentionAverage}%</p>
                                </div>
                            </div>
                        </div>

                        <div className="editorial-surface p-8">
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Dominant misconceptions</h2>
                            <div className="mt-6 space-y-3">
                                {researchSnapshot.learnerMetrics.dominantMisconceptions.length === 0 ? (
                                    <p className="text-sm text-[var(--ath-muted)]">Misconception labels appear after learners categorize misses.</p>
                                ) : researchSnapshot.learnerMetrics.dominantMisconceptions.map((item) => (
                                    <div key={item.type} className="flex items-center justify-between rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
                                        <span className="text-sm font-semibold text-[var(--ath-muted)]">{formatConceptLabel(item.type)}</span>
                                        <span className="text-sm font-bold text-[var(--ath-text)]">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="editorial-section">
                    <header className="editorial-section-header">
                        <h2 className="text-base font-semibold text-[var(--ath-text)]">RCT / intervention effects + learning gains</h2>
                            <p className="editorial-section-lead">Joins recommendation_decisions, intervention_traces, and evaluation_runs from the rct_* SQL views. Empty until subjects complete pre/post evaluations.</p>
                    </header>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="editorial-surface p-8">
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Outcomes by action / accept + resolve</h2>
                            <div className="mt-6 space-y-3">
                                {rctSnapshot.interventionOutcomes.length === 0 ? (
                                    <p className="text-sm text-[var(--ath-muted)]">No closed intervention traces yet.</p>
                                ) : rctSnapshot.interventionOutcomes.map((row) => {
                                    const total = Number(row.total_closed || 0)
                                    const accepted = Number(row.accepted_count || 0)
                                    const positive = Number(row.resolved_positive || 0)
                                    const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0
                                    const resolveRate = total > 0 ? Math.round((positive / total) * 100) : 0
                                    return (
                                        <div key={row.chosen_action} className="rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-[var(--ath-text)]">{row.chosen_action}</span>
                                                <span className="text-xs uppercase tracking-wider text-[var(--ath-muted)]">n = {total}</span>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-[var(--ath-muted)]">
                                                <span>Accepted {acceptRate}%</span>
                                                <span>Correct after support {resolveRate}%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="editorial-surface p-8">
                            <h2 className="text-sm font-semibold text-[var(--ath-text)]">Learning gains per learner</h2>
                            <div className="mt-6 space-y-3">
                                {rctSnapshot.evaluationGains.length === 0 ? (
                                    <p className="text-sm text-[var(--ath-muted)]">Gains appear after at least one learner completes both a pre and post evaluation.</p>
                                ) : rctSnapshot.evaluationGains.slice(0, 8).map((row) => (
                                    <div key={`${row.user_id}:${row.course_id}`} className="rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-semibold text-[var(--ath-text)]">{row.course_id}</span>
                                            <span className="text-xs uppercase tracking-wider text-[var(--ath-muted)]">user {String(row.user_id || '').slice(0, 8)}</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[var(--ath-muted)]">
                                            <span>Pre {row.pre_score ?? '-'}</span>
                                            <span>Post {row.post_score ?? '-'}</span>
                                            <span>Retention {row.retention_score ?? '-'}</span>
                                        </div>
                                        {row.post_pre_gain !== null && row.post_pre_gain !== undefined ? (
                                            <p className="mt-1 text-xs font-semibold text-[var(--ath-text)]">Delta post-pre: {Number(row.post_pre_gain).toFixed(1)} pts</p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
