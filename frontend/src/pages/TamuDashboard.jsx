import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Download, LogOut, RefreshCw, X } from 'lucide-react'
import { instructorGet } from '../lib/account'
import { logEvent } from '../lib/loggingService'
import { DEMO_START } from '../lib/staticDemo'

/**
 * Class dashboard for TAMU instructor accounts (/teach): who has started, where each student is,
 * how practice and written activities are going, and who may need a check-in. Data comes from the
 * tutor worker's /instructor routes; it refreshes every minute while the page is open.
 */

const REFRESH_MS = 60_000

const STATUS = {
    active_now: { label: 'Active now', dot: 'bg-emerald-500' },
    today: { label: 'Today', dot: 'bg-sky-500' },
    this_week: { label: 'This week', dot: 'bg-amber-400' },
    inactive: { label: 'Inactive 7+ days', dot: 'bg-rose-400' },
    not_started: { label: 'Not started', dot: 'bg-slate-300' },
}

const SECTION_STATUS = {
    not_started: { label: 'Not started', cls: 'border border-[var(--ath-line)] bg-transparent' },
    reading: { label: 'Reading', cls: 'bg-sky-200' },
    working: { label: 'Working', cls: 'bg-amber-300' },
    done: { label: 'Done', cls: 'bg-emerald-500' },
}

const FLAGS = {
    not_started: 'Not started',
    low_accuracy: 'Low first-try accuracy',
    often_stuck: 'Often stuck',
    inactive: 'Inactive',
}

const CRITERION = {
    met: { label: 'Met', cls: 'bg-emerald-100 text-emerald-800' },
    partly: { label: 'Partly', cls: 'bg-amber-100 text-amber-800' },
    not_yet: { label: 'Not yet', cls: 'bg-rose-100 text-rose-800' },
}

const EVENT_LABELS = {
    session_start: 'Signed in',
    session_end: 'Signed out',
    page_view: 'Opened section',
    practice_answer: 'Answered practice item',
    hint_rung: 'Opened a hint',
    stuck_event: 'Got stuck',
    intervention_shown: 'Tutor offered help',
    intervention_choice: 'Chose tutor help',
    lesson_video_play: 'Played lecture clip',
    lesson_video_finished: 'Finished lecture clip',
    video_quiz_answer: 'Answered clip check-in',
    video_quiz_skip: 'Skipped clip check-in',
    activity_feedback_request: 'Asked for feedback on written activity',
    activity_feedback_received: 'Got feedback on written activity',
    activity_revise_start: 'Started revising written activity',
    highlight_create: 'Highlighted text',
    note_save: 'Saved a note',
    explain_request: 'Asked AI to explain a passage',
    review_start: 'Started skill review',
    search_result_open: 'Opened a search result',
    knowledge_graph_view: 'Opened knowledge map',
}

const shortSection = (id) => String(id || '').split('/').slice(-2).map(Number).join('.')
const pctText = (v) => (v == null ? '–' : `${v}%`)

function ago(ts) {
    if (!ts) return 'Never'
    const minutes = Math.round((Date.now() - Date.parse(ts)) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} h ago`
    const days = Math.round(hours / 24)
    return `${days} day${days === 1 ? '' : 's'} ago`
}

function csvCell(v) {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(data) {
    const head = ['id', 'status', 'last_active', 'current_section', 'sections_done', 'sections_started', ...data.sections.map((s) => `s${shortSection(s.id)}`),
        'first_try_accuracy', 'items_answered', 'checkins_correct', 'checkins_answered', 'activities_submitted', 'activities_complete',
        'hints', 'ai_hints', 'stuck', 'interventions', 'mastery_avg', 'sessions', 'active_minutes', 'flags']
    const rows = data.students.map((s) => [s.id, s.status, s.last_active, s.current_section ? shortSection(s.current_section) : '', s.sections_done, s.sections_started, ...s.sections,
        s.practice_first_try_accuracy, s.items_answered, s.checkins_correct, s.checkins_answered, s.activities_submitted, s.activities_complete,
        s.hints, s.ai_hints, s.stuck, s.interventions, s.mastery_avg, s.sessions, s.active_minutes, s.flags.join(' ')])
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `tamu-ai-literacy-progress-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

function Card({ label, value, note }) {
    return (
        <div className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--ath-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ath-text)]">{value}</p>
            {note && <p className="mt-0.5 text-xs text-[var(--ath-muted)]">{note}</p>}
        </div>
    )
}

function SectionSquares({ sections, statuses }) {
    return (
        <div className="flex gap-0.5">
            {statuses.map((st, i) => (
                <span
                    key={sections[i].id}
                    title={`${shortSection(sections[i].id)} ${sections[i].title}: ${SECTION_STATUS[st].label}`}
                    className={`h-3.5 w-3.5 rounded-[3px] ${SECTION_STATUS[st].cls} ${i % 3 === 2 ? 'mr-1' : ''}`}
                />
            ))}
        </div>
    )
}

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ath-muted)]">
            {Object.values(SECTION_STATUS).map((s) => (
                <span key={s.label} className="flex items-center gap-1"><span className={`h-3 w-3 rounded-[3px] ${s.cls}`} />{s.label}</span>
            ))}
            <span>Done = every practice item answered and written activity submitted.</span>
        </div>
    )
}

function StudentDrawer({ id, onClose }) {
    const [detail, setDetail] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let live = true
        instructorGet(`/instructor/student?id=${encodeURIComponent(id)}`)
            .then((d) => { if (live) setDetail(d) })
            .catch((e) => { if (live) setError(e.message) })
        return () => { live = false }
    }, [id])

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const activities = detail?.sections.filter((s) => s.activity) || []
    const concepts = detail?.sections.flatMap((s) => s.concepts.map((c) => ({ ...c, section: s.id }))).filter((c) => c.p_known != null) || []

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <button type="button" aria-label="Close student details" className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-labelledby="student-title" className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--ath-background)] p-5 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="editorial-kicker">Student</p>
                        <h2 id="student-title" className="text-2xl font-semibold text-[var(--ath-text)]">{id}</h2>
                        {detail && (
                            <p className="mt-1 text-sm text-[var(--ath-muted)]">
                                First active {detail.first_ts ? new Date(detail.first_ts).toLocaleString() : '–'} · last active {ago(detail.last_ts)} · {detail.sessions || 0} session{detail.sessions === 1 ? '' : 's'} · about {detail.active_minutes || 0} active minutes
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[var(--ath-secondary)] hover:bg-[var(--ath-panel)]"><X className="h-5 w-5" /></button>
                </div>

                {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Could not load this student ({error}).</p>}
                {!detail && !error && <p className="mt-6 text-sm text-[var(--ath-muted)]">Loading…</p>}

                {detail && (
                    <>
                        <h3 className="mt-6 text-sm font-semibold text-[var(--ath-text)]">Sections</h3>
                        <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--ath-line)]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[var(--ath-panel)] text-xs text-[var(--ath-muted)]">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Section</th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                        <th className="px-3 py-2 font-medium">Practice</th>
                                        <th className="px-3 py-2 font-medium" title="Correct on first try">1st try</th>
                                        <th className="px-3 py-2 font-medium" title="Clip check-ins correct / answered">Check-ins</th>
                                        <th className="px-3 py-2 font-medium">Hints</th>
                                        <th className="px-3 py-2 font-medium">Stuck</th>
                                        <th className="px-3 py-2 font-medium" title="Highlights (with notes)">Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.sections.map((s) => (
                                        <tr key={s.id} className="border-t border-[var(--ath-line)] text-[var(--ath-text)]">
                                            <td className="px-3 py-2"><span className="font-medium">{shortSection(s.id)}</span> <span className="text-[var(--ath-muted)]">{s.title}</span></td>
                                            <td className="px-3 py-2"><span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] ${SECTION_STATUS[s.status].cls}`} />{SECTION_STATUS[s.status].label}</span></td>
                                            <td className="px-3 py-2">{s.items_answered}/{s.items_total}</td>
                                            <td className="px-3 py-2">{pctText(s.first_try_accuracy)}</td>
                                            <td className="px-3 py-2">{s.checkins}</td>
                                            <td className="px-3 py-2">{s.hints}</td>
                                            <td className="px-3 py-2">{s.stuck}</td>
                                            <td className="px-3 py-2">{s.highlights}{s.notes ? ` (${s.notes})` : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="mt-6 text-sm font-semibold text-[var(--ath-text)]">Concept mastery</h3>
                        {concepts.length === 0 ? (
                            <p className="mt-1 text-sm text-[var(--ath-muted)]">No practice evidence yet.</p>
                        ) : (
                            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                {concepts.map((c) => (
                                    <li key={`${c.section}-${c.id}`} className="text-xs text-[var(--ath-text)]">
                                        <div className="flex justify-between"><span>{c.id.replace(/_/g, ' ')}</span><span className="text-[var(--ath-muted)]">{Math.round(c.p_known * 100)}%</span></div>
                                        <div className="mt-0.5 h-1.5 rounded-full bg-[var(--ath-panel-muted)]"><div className="h-1.5 rounded-full bg-[var(--ath-primary)]" style={{ width: `${Math.round(c.p_known * 100)}%` }} /></div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <h3 className="mt-6 text-sm font-semibold text-[var(--ath-text)]">Written activities</h3>
                        {activities.length === 0 && <p className="mt-1 text-sm text-[var(--ath-muted)]">None started yet.</p>}
                        {activities.map((s) => (
                            <article key={s.id} className="mt-3 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-[var(--ath-text)]">{shortSection(s.id)} {s.title}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.activity.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {s.activity.rounds === 0 ? 'Draft, no feedback yet' : s.activity.ready ? `Complete after ${s.activity.rounds} round${s.activity.rounds === 1 ? '' : 's'}` : `${s.activity.rounds} feedback round${s.activity.rounds === 1 ? '' : 's'}`}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs italic text-[var(--ath-muted)]">{s.activity.prompt}</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ath-text)]">{s.activity.text}</p>
                                {s.activity.draft && (
                                    <details className="mt-2 text-sm">
                                        <summary className="cursor-pointer text-xs font-medium text-[var(--ath-primary)]">Unsubmitted revision in progress</summary>
                                        <p className="mt-1 whitespace-pre-wrap text-[var(--ath-text)]">{s.activity.draft}</p>
                                    </details>
                                )}
                                {s.activity.criteria.length > 0 && (
                                    <ul className="mt-3 space-y-1">
                                        {s.activity.criteria.map((k) => (
                                            <li key={k.id} className="flex items-start gap-2 text-xs text-[var(--ath-text)]">
                                                <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${CRITERION[k.status]?.cls || ''}`}>{CRITERION[k.status]?.label || k.status}</span>
                                                <span>{k.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {s.activity.next_step && <p className="mt-2 text-xs text-[var(--ath-muted)]"><span className="font-medium">AI next step given:</span> {s.activity.next_step}</p>}
                            </article>
                        ))}

                        <h3 className="mt-6 text-sm font-semibold text-[var(--ath-text)]">Recent activity</h3>
                        {detail.recent.length === 0 && <p className="mt-1 text-sm text-[var(--ath-muted)]">Nothing recorded yet.</p>}
                        <ol className="mt-2 space-y-1">
                            {detail.recent.map((e, i) => (
                                <li key={`${e.client_ts}-${i}`} className="flex gap-3 text-xs">
                                    <span className="w-28 shrink-0 text-[var(--ath-muted)]">{new Date(e.client_ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                    <span className="text-[var(--ath-text)]">{EVENT_LABELS[e.event] || e.event.replace(/_/g, ' ')}{e.section_id ? ` · ${shortSection(e.section_id)}` : ''}</span>
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </div>
        </div>
    )
}

function SectionsView({ data }) {
    const total = data.students.length
    return (
        <div className="space-y-4">
            {data.section_stats.map((s) => (
                <section key={s.id} className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[var(--ath-text)]">{shortSection(s.id)} {s.title}</h3>
                        <p className="text-xs text-[var(--ath-muted)]">{s.started} of {total} started · {s.done} done</p>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                        <div className="bg-emerald-500" style={{ width: `${total ? (s.done / total) * 100 : 0}%` }} />
                        <div className="bg-amber-300" style={{ width: `${total ? ((s.started - s.done) / total) * 100 : 0}%` }} />
                    </div>
                    <table className="mt-3 w-full text-left text-xs">
                        <thead className="text-[var(--ath-muted)]">
                            <tr><th className="py-1 font-medium">Practice item</th><th className="py-1 font-medium">Students</th><th className="py-1 font-medium">1st try</th><th className="py-1 font-medium">Most common wrong answer</th></tr>
                        </thead>
                        <tbody>
                            {s.items.map((it) => (
                                <tr key={it.id} className="border-t border-[var(--ath-line)] align-top text-[var(--ath-text)]">
                                    <td className="py-1.5 pr-3">{it.stem}</td>
                                    <td className="py-1.5 pr-3">{it.students}</td>
                                    <td className={`py-1.5 pr-3 ${it.first_try_accuracy != null && it.first_try_accuracy < 50 ? 'font-semibold text-rose-700' : ''}`}>{pctText(it.first_try_accuracy)}</td>
                                    <td className="py-1.5">{it.common_wrong ? `${it.common_wrong.option} (${it.common_wrong.count})` : '–'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            ))}
        </div>
    )
}

export default function TamuDashboard({ user, onLogout }) {
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState('students')
    const [filter, setFilter] = useState('all')
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setData(await instructorGet('/instructor/overview'))
            setError('')
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        logEvent('instructor_dashboard_view', 'teach')
        load()
        const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
        return () => clearInterval(timer)
    }, [load])

    const students = useMemo(() => {
        if (!data) return []
        const q = query.trim().toLowerCase()
        return data.students.filter((s) => {
            if (q && !s.id.toLowerCase().includes(q)) return false
            if (filter === 'attention') return s.flags.length > 0
            if (filter === 'active') return s.status === 'active_now' || s.status === 'today'
            if (filter === 'not_started') return s.status === 'not_started'
            return true
        })
    }, [data, filter, query])

    const summary = useMemo(() => {
        if (!data) return null
        const st = data.students
        const started = st.filter((s) => s.status !== 'not_started')
        const acc = started.map((s) => s.practice_first_try_accuracy).filter((v) => v != null)
        return {
            total: st.length,
            started: started.length,
            activeNow: st.filter((s) => s.status === 'active_now').length,
            today: st.filter((s) => s.status === 'active_now' || s.status === 'today').length,
            avgDone: started.length ? (started.reduce((a, s) => a + s.sections_done, 0) / started.length).toFixed(1) : '0',
            accuracy: acc.length ? Math.round(acc.reduce((a, v) => a + v, 0) / acc.length) : null,
            written: st.reduce((a, s) => a + s.activities_submitted, 0),
            attention: st.filter((s) => s.flags.some((f) => f !== 'not_started')).length,
        }
    }, [data])

    const openStudent = (id) => {
        logEvent('instructor_student_open', id)
        setOpen(id)
    }
    const closeStudent = useCallback(() => setOpen(null), [])

    return (
        <div className="editorial-shell min-h-screen bg-[var(--ath-background)]">
            <header className="border-b border-[var(--ath-line)] bg-[var(--ath-panel)]">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div>
                        <p className="editorial-kicker">AI Literacy · TAMU</p>
                        <h1 className="text-xl font-semibold text-[var(--ath-text)]">Class dashboard</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden text-sm text-[var(--ath-muted)] sm:block">{user?.email}</span>
                        <button type="button" onClick={() => navigate(DEMO_START)} className="flex items-center gap-1.5 rounded-lg border border-[var(--ath-line)] px-3 py-1.5 text-sm text-[var(--ath-text)] hover:bg-[var(--ath-background)]">
                            <BookOpen className="h-4 w-4" aria-hidden="true" /> Open the course
                        </button>
                        <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-[var(--ath-secondary)] hover:bg-[var(--ath-background)]">
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ath-muted)]">
                    <span>{data ? `Updated ${new Date(data.generated_at).toLocaleTimeString()} · refreshes every minute` : ''}</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-[var(--ath-line)] px-3 py-1.5 text-sm text-[var(--ath-text)] hover:bg-[var(--ath-panel)] disabled:opacity-60">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
                        </button>
                        <button type="button" disabled={!data} onClick={() => { logEvent('instructor_csv_download', 'teach'); downloadCsv(data) }} className="flex items-center gap-1.5 rounded-lg border border-[var(--ath-line)] px-3 py-1.5 text-sm text-[var(--ath-text)] hover:bg-[var(--ath-panel)] disabled:opacity-60">
                            <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
                        </button>
                    </div>
                </div>

                {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Could not load class data ({error}). It will try again in a minute.</p>}
                {!data && !error && <p className="mt-8 text-center text-sm text-[var(--ath-muted)]">Loading class data…</p>}

                {summary && (
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                        <Card label="Started" value={`${summary.started} / ${summary.total}`} note="students who have opened the course" />
                        <Card label="Active" value={summary.today} note={`${summary.activeNow} right now`} />
                        <Card label="Sections done" value={summary.avgDone} note="average of 12, among started" />
                        <Card label="1st-try accuracy" value={pctText(summary.accuracy)} note="practice items, class average" />
                        <Card label="Written activities" value={summary.written} note="submitted for feedback" />
                        <Card label="May need a check-in" value={summary.attention} note="low accuracy, often stuck or inactive" />
                    </div>
                )}

                {data && (
                    <>
                        <div role="tablist" className="mt-6 flex gap-1 border-b border-[var(--ath-line)]">
                            {[['students', 'Students'], ['sections', 'Sections and items']].map(([key, label]) => (
                                <button key={key} role="tab" aria-selected={tab === key} type="button" onClick={() => setTab(key)}
                                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-[var(--ath-primary)] text-[var(--ath-text)]' : 'border-transparent text-[var(--ath-muted)] hover:text-[var(--ath-text)]'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {tab === 'sections' ? <div className="mt-4"><SectionsView data={data} /></div> : (
                            <>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {[['all', 'All'], ['attention', 'Needs attention'], ['active', 'Active today'], ['not_started', 'Not started']].map(([key, label]) => (
                                        <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
                                            className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === key ? 'border-[var(--ath-primary)] bg-[var(--ath-primary)] text-[var(--ath-background)]' : 'border-[var(--ath-line)] text-[var(--ath-text)] hover:bg-[var(--ath-panel)]'}`}>
                                            {label}
                                        </button>
                                    ))}
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find ID (e.g. 007)" aria-label="Find a student ID"
                                        className="ml-auto w-40 rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-1 text-sm text-[var(--ath-text)]" />
                                </div>
                                <div className="mt-3"><Legend /></div>

                                <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)]">
                                    <table className="w-full min-w-[980px] text-left text-sm">
                                        <thead className="text-xs text-[var(--ath-muted)]">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Student</th>
                                                <th className="px-3 py-2 font-medium">Last active</th>
                                                <th className="px-3 py-2 font-medium">Now in</th>
                                                <th className="px-3 py-2 font-medium">Sections 1.1 – 4.3</th>
                                                <th className="px-3 py-2 font-medium">Done</th>
                                                <th className="px-3 py-2 font-medium" title="Practice items correct on first try">1st try</th>
                                                <th className="px-3 py-2 font-medium" title="Clip check-ins correct / answered">Check-ins</th>
                                                <th className="px-3 py-2 font-medium" title="Written activities complete / submitted">Written</th>
                                                <th className="px-3 py-2 font-medium">Hints</th>
                                                <th className="px-3 py-2 font-medium">Stuck</th>
                                                <th className="px-3 py-2 font-medium">Flags</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((s) => (
                                                <tr key={s.id} onClick={() => openStudent(s.id)} className="cursor-pointer border-t border-[var(--ath-line)] text-[var(--ath-text)] hover:bg-[var(--ath-background)]">
                                                    <td className="px-3 py-2">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); openStudent(s.id) }} className="font-medium text-[var(--ath-primary)] underline-offset-2 hover:underline">{s.id}</button>
                                                    </td>
                                                    <td className="px-3 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap" title={STATUS[s.status].label}><span className={`h-2 w-2 rounded-full ${STATUS[s.status].dot}`} />{ago(s.last_active)}</span></td>
                                                    <td className="px-3 py-2">{s.current_section ? shortSection(s.current_section) : '–'}</td>
                                                    <td className="px-3 py-2"><SectionSquares sections={data.sections} statuses={s.sections} /></td>
                                                    <td className="px-3 py-2">{s.sections_done}/12</td>
                                                    <td className={`px-3 py-2 ${s.flags.includes('low_accuracy') ? 'font-semibold text-rose-700' : ''}`}>{pctText(s.practice_first_try_accuracy)}</td>
                                                    <td className="px-3 py-2">{s.checkins_answered ? `${s.checkins_correct}/${s.checkins_answered}` : '–'}</td>
                                                    <td className="px-3 py-2">{s.activities_submitted ? `${s.activities_complete}/${s.activities_submitted}` : '–'}</td>
                                                    <td className="px-3 py-2">{s.hints}</td>
                                                    <td className={`px-3 py-2 ${s.flags.includes('often_stuck') ? 'font-semibold text-rose-700' : ''}`}>{s.stuck}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {s.flags.filter((f) => f !== 'not_started').map((f) => (
                                                                <span key={f} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">{FLAGS[f]}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {students.length === 0 && (
                                                <tr><td colSpan={11} className="px-3 py-6 text-center text-sm text-[var(--ath-muted)]">No students match this filter.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2 text-xs text-[var(--ath-muted)]">Click a student for section detail, concept mastery, written activities and recent activity. Notes and highlights stay private; only their counts are shown.</p>
                            </>
                        )}
                    </>
                )}
            </main>

            {open && <StudentDrawer id={open} onClose={closeStudent} />}
        </div>
    )
}
