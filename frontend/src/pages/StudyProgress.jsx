import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, RefreshCw } from 'lucide-react'
import API_BASE from '../lib/apiConfig'
import { supabase } from '../lib/supabase'
import { getSimLab } from '../lib/simLabs'
import '../index.css'

// Researchers only (route-gated; the server also checks research access).
// Simulation Lab progress by Study ID, for completion and gift-card checks.
function formatDate(value) {
    return value ? new Date(value).toLocaleString() : ''
}

function toCsv(rows) {
    const cols = ['study_id', 'track', 'lab', 'trials_done', 'required', 'distinct_designs', 'complete', 'completed_at', 'goal_met', 'stuck_count', 'last_activity']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export default function StudyProgress() {
    const navigate = useNavigate()
    const [rows, setRows] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`${API_BASE}/study/lab-progress`, {
                headers: { Authorization: `Bearer ${session?.access_token || ''}` },
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.detail || `Could not load progress (${response.status}).`)
            setRows(data.rows || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() }, [])

    const shown = useMemo(() => rows.filter((r) => filter === 'all'
        || (filter === 'complete' && r.complete)
        || (filter === 'incomplete' && r.track === 'bio' && !r.complete)
        || (filter === 'stuck' && r.stuck_count > 0)), [rows, filter])
    const bio = rows.filter((r) => r.track === 'bio')

    const download = () => {
        const url = URL.createObjectURL(new Blob([toCsv(shown)], { type: 'text/csv' }))
        const a = document.createElement('a')
        a.href = url
        a.download = 'alget_study_lab_progress.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="editorial-shell min-h-screen">
            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
                <button onClick={() => navigate('/analytics')} className="flex items-center gap-2 text-sm text-[var(--ath-muted)] hover:underline">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Research Console
                </button>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">Study progress: Simulation Lab</h1>
                <p className="mt-2 max-w-3xl text-sm text-[var(--ath-muted)]">
                    One row per enrolled Study ID. A lab is complete after its required trials with at least two different designs;
                    reaching the design goal is not required. Use your private key file to match Study IDs to people.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <span className="editorial-pill">{bio.filter((r) => r.complete).length} of {bio.length} bio-inspired participants complete</span>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} className="editorial-input w-auto py-2 text-sm" aria-label="Filter rows">
                        <option value="all">All participants</option>
                        <option value="complete">Lab complete</option>
                        <option value="incomplete">Bio-inspired, not complete</option>
                        <option value="stuck">Pressed &quot;I&apos;m stuck&quot;</option>
                    </select>
                    <button onClick={load} className="editorial-button-secondary flex items-center gap-2 px-4 py-2 text-sm">
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button onClick={download} disabled={!shown.length} className="editorial-button-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                        <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
                    </button>
                </div>
                {error && <p role="alert" className="mt-4 text-sm font-medium text-[var(--ath-danger)]">{error}</p>}
                <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--ath-line)] bg-white/85">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--ath-panel)] text-xs uppercase tracking-wider text-[var(--ath-secondary)]">
                            <tr>
                                {['Study ID', 'Track', 'Lab', 'Trials', 'Designs', 'Complete', 'Completed at', 'Goal met', 'Stuck', 'Last activity'].map((h) => (
                                    <th key={h} className="px-4 py-3">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((r) => (
                                <tr key={r.study_id} className="border-t border-[var(--ath-line)]">
                                    <td className="px-4 py-2 font-mono">{r.study_id}</td>
                                    <td className="px-4 py-2">{r.track}</td>
                                    <td className="px-4 py-2">{r.lab ? (getSimLab(r.lab)?.title || r.lab) : '—'}</td>
                                    <td className="px-4 py-2">{r.required ? `${Math.min(r.trials_done, r.required)} / ${r.required}` : '—'}</td>
                                    <td className="px-4 py-2">{r.lab ? r.distinct_designs : '—'}</td>
                                    <td className="px-4 py-2 font-semibold">{r.complete ? '✓ Yes' : 'No'}</td>
                                    <td className="px-4 py-2">{formatDate(r.completed_at)}</td>
                                    <td className="px-4 py-2">{r.lab ? (r.goal_met ? 'Yes' : 'No') : '—'}</td>
                                    <td className="px-4 py-2">{r.stuck_count || ''}</td>
                                    <td className="px-4 py-2">{formatDate(r.last_activity)}</td>
                                </tr>
                            ))}
                            {!shown.length && !loading && (
                                <tr><td colSpan={10} className="px-4 py-6 text-center text-[var(--ath-muted)]">No participants to show yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    )
}
