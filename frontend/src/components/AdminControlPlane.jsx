import { useEffect, useMemo, useState } from 'react'
import BigALCompanion from './BigALCompanion'
import AdaptationDesignStudio from './AdaptationDesignStudio'
import {
    AGENT_MANIFEST,
    approveAgentRun,
    convertCoursePdf,
    createGovernedAgentRun,
    createManagedCourse,
    loadAdminState,
    registerInstructor,
    reviewInstructorApplication,
} from '../lib/adminControlService'

const VIEWS = [
    ['overview', 'Overview'],
    ['instructors', 'Instructors'],
    ['courses', 'Courses'],
    ['ingestion', 'PDF ingestion'],
    ['agents', 'Agent control'],
    ['adaptation', 'Adaptation'],
    ['cohort', 'Cohort'],
]

const STATUS_TONE = {
    active: 'text-emerald-700',
    approved: 'text-emerald-700',
    ready: 'text-emerald-700',
    published: 'text-emerald-700',
    failed: 'text-rose-700',
    blocked: 'text-rose-700',
    suspended: 'text-rose-700',
    needs_review: 'text-amber-700',
    awaiting_approval: 'text-amber-700',
    pending_approval: 'text-amber-700',
    rejected: 'text-rose-700',
}

function Status({ children }) {
    return <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_TONE[children] || 'text-[var(--ath-secondary)]'}`}>{String(children).replaceAll('_', ' ')}</span>
}

export default function AdminControlPlane({ cohortContent, onBack, onResearcher }) {
    const [view, setView] = useState('overview')
    const [state, setState] = useState({ instructors: [], courses: [], ingestionJobs: [], agentRuns: [], workflows: [], auditEvents: [], adaptationPolicies: [], adaptationControls: {} })
    const [persistence, setPersistence] = useState('local')
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const reload = async () => {
        const result = await loadAdminState()
        setState(result.state)
        setPersistence(result.persistence)
    }

    useEffect(() => {
        reload().catch((nextError) => setError(nextError.message)).finally(() => setLoading(false))
    }, [])

    const runAction = async (name, action, success) => {
        setBusy(name)
        setError('')
        setMessage('')
        try {
            await action()
            await reload()
            setMessage(success)
            return true
        } catch (nextError) {
            setError(nextError.message || 'The operation failed')
            return false
        } finally {
            setBusy('')
        }
    }

    const metrics = useMemo(() => ({
        instructors: state.instructors.length,
        courses: state.courses.length,
        review: state.ingestionJobs.filter((item) => item.status === 'needs_review').length,
        approvals: state.agentRuns.filter((item) => item.status === 'awaiting_approval').length
            + (state.workflows || []).filter((item) => item.status === 'awaiting_approval').length,
        activeWorkflows: (state.workflows || []).filter((item) => item.status === 'active').length,
    }), [state])

    return (
        <div className="editorial-shell ath-open-layout min-h-screen bg-[var(--ath-background)]">
            <header className="ath-topbar sticky top-0 z-20 px-4 py-3 md:px-6">
                <div className="mx-auto flex max-w-7xl items-center gap-3">
                    <BigALCompanion state={metrics.approvals ? 'nudge' : 'rest'} size={40} />
                    <div className="min-w-0">
                        <p className="editorial-kicker">ALGET CONTROL PLANE</p>
                        <h1 className="truncate text-lg font-semibold text-[var(--ath-text)]">Course operations</h1>
                    </div>
                    <div className="ml-auto flex items-center gap-3 text-xs text-[var(--ath-secondary)]">
                        <span>{persistence === 'supabase' ? 'Cloud persistence' : 'Local preview'}</span>
                        <button type="button" onClick={onResearcher} className="hover:text-[var(--ath-text)]">Research</button>
                        <button type="button" onClick={onBack} className="hover:text-[var(--ath-text)]">Exit</button>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:grid-cols-[176px_minmax(0,1fr)] md:px-6">
                <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto md:flex-col">
                    {VIEWS.map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setView(id)}
                            aria-current={view === id ? 'page' : undefined}
                            className={`whitespace-nowrap border-l-2 px-3 py-2 text-left text-sm transition-colors ${view === id ? 'border-[var(--ath-primary)] bg-[var(--ath-primary-soft)] text-[var(--ath-primary-deep)]' : 'border-transparent text-[var(--ath-muted)] hover:text-[var(--ath-text)]'}`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                <main className="min-w-0">
                    {(error || message) && (
                        <div role={error ? 'alert' : 'status'} className={`mb-4 border-l-2 px-3 py-2 text-sm ${error ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
                            {error || message}
                        </div>
                    )}
                    {loading ? <p className="text-sm text-[var(--ath-muted)]">Loading operations...</p> : (
                        <>
                            {view === 'overview' && <Overview metrics={metrics} state={state} setView={setView} />}
                            {view === 'instructors' && <Instructors state={state} busy={busy} runAction={runAction} persistence={persistence} />}
                            {view === 'courses' && <Courses state={state} busy={busy} runAction={runAction} persistence={persistence} />}
                            {view === 'ingestion' && <Ingestion state={state} busy={busy} runAction={runAction} persistence={persistence} />}
                            {view === 'agents' && <Agents state={state} busy={busy} runAction={runAction} persistence={persistence} />}
                            {view === 'adaptation' && <AdaptationDesignStudio state={state} busy={busy} runAction={runAction} persistence={persistence} />}
                            {view === 'cohort' && cohortContent}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}

function SectionHeader({ kicker, title, description, action }) {
    return (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ath-line)] pb-4">
            <div>
                <p className="editorial-kicker">{kicker}</p>
                <h2 className="mt-1 text-2xl font-semibold text-[var(--ath-text)]">{title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">{description}</p>
            </div>
            {action}
        </div>
    )
}

function Overview({ metrics, state, setView }) {
    const steps = [
        ['Register instructor', metrics.instructors, 'instructors'],
        ['Create course shell', metrics.courses, 'courses'],
        ['Convert and review sources', state.ingestionJobs.length, 'ingestion'],
        ['Approve governed runs', state.agentRuns.length, 'agents'],
    ]
    return (
        <>
            <SectionHeader kicker="SYSTEM" title="One accountable course pipeline" description="Every source, agent decision, approval, and release remains attributable. Automation can prepare work; a person retains release authority." />
            <div className="grid gap-3 sm:grid-cols-4">
                {[
                    ['Instructors', metrics.instructors], ['Courses', metrics.courses], ['Needs review', metrics.review], ['Approvals', metrics.approvals],
                ].map(([label, value]) => (
                    <div key={label} className="border-l-2 border-[var(--ath-primary-soft)] px-3 py-2">
                        <p className="text-3xl font-semibold text-[var(--ath-text)]">{value}</p>
                        <p className="text-xs text-[var(--ath-secondary)]">{label}</p>
                    </div>
                ))}
            </div>
            <div className="mt-7">
                <p className="editorial-label">Operational sequence</p>
                <ol className="mt-3 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                    {steps.map(([label, count, target], index) => (
                        <li key={label} className="flex items-center gap-4 py-3">
                            <span className="font-mono text-xs text-[var(--ath-primary)]">0{index + 1}</span>
                            <span className="flex-1 text-sm font-semibold text-[var(--ath-text)]">{label}</span>
                            <span className="text-xs text-[var(--ath-muted)]">{count} records</span>
                            <button type="button" onClick={() => setView(target)} className="text-xs font-semibold text-[var(--ath-primary)]">Open</button>
                        </li>
                    ))}
                </ol>
            </div>
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div>
                    <p className="editorial-label">Release policy</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">No content reaches Published from an agent response alone. Extraction, alignment, assessment, accessibility, validation, and release decisions remain separate audit events.</p>
                </div>
                <div>
                    <p className="editorial-label">Recent audit</p>
                    <AuditList events={state.auditEvents.slice(0, 5)} />
                </div>
            </div>
        </>
    )
}

function Instructors({ state, busy, runAction, persistence }) {
    const [form, setForm] = useState({ displayName: '', email: '' })
    const submit = (event) => {
        event.preventDefault()
        runAction('instructor', () => registerInstructor(form, persistence), 'Instructor invitation recorded.')
            .then((completed) => completed && setForm({ displayName: '', email: '' }))
    }
    return (
        <>
            <SectionHeader kicker="PEOPLE" title="Instructor registry" description="Register accountable course owners before any content source or agent run is created." />
            <form onSubmit={submit} className="grid gap-3 border-b border-[var(--ath-line)] pb-5 sm:grid-cols-[1fr_1fr_auto]">
                <input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="editorial-input" placeholder="Full name" aria-label="Instructor full name" />
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="editorial-input" placeholder="University email" aria-label="Instructor email" />
                <button disabled={busy === 'instructor'} className="editorial-button px-4">{busy === 'instructor' ? 'Saving...' : 'Invite instructor'}</button>
            </form>
            <RecordTable columns={['Instructor', 'Email', 'Status', 'Action']} rows={state.instructors.map((item) => [item.display_name, item.email, <Status key={item.id}>{item.status}</Status>, ['pending_approval', 'invited'].includes(item.status) ? <span key={`actions-${item.id}`} className="flex gap-2"><button type="button" disabled={busy === `approve-${item.id}`} onClick={() => runAction(`approve-${item.id}`, () => reviewInstructorApplication(item, 'approve', '', persistence), 'Instructor approved.')} className="text-xs font-semibold text-emerald-700">Approve</button><button type="button" disabled={busy === `reject-${item.id}`} onClick={() => runAction(`reject-${item.id}`, () => reviewInstructorApplication(item, 'reject', '', persistence), 'Instructor rejected.')} className="text-xs font-semibold text-rose-700">Reject</button></span> : '—'])} empty="No instructors registered." />
        </>
    )
}

function Courses({ state, busy, runAction, persistence }) {
    const [form, setForm] = useState({ courseKey: '', title: '', domain: '', instructorId: '' })
    const submit = (event) => {
        event.preventDefault()
        runAction('course', () => createManagedCourse(form, persistence), 'Course shell created.')
            .then((completed) => completed && setForm({ courseKey: '', title: '', domain: '', instructorId: '' }))
    }
    const instructorName = (id) => state.instructors.find((item) => item.id === id)?.display_name || 'Unassigned'
    return (
        <>
            <SectionHeader kicker="CATALOG" title="Managed courses" description="Course shells bind a responsible instructor, domain, source record, and release policy." />
            <form onSubmit={submit} className="grid gap-3 border-b border-[var(--ath-line)] pb-5 md:grid-cols-2">
                <input required pattern="[a-z0-9][a-z0-9-]*" value={form.courseKey} onChange={(e) => setForm({ ...form, courseKey: e.target.value })} className="editorial-input" placeholder="course-key" aria-label="Course key" />
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="editorial-input" placeholder="Course title" aria-label="Course title" />
                <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="editorial-input" placeholder="Domain, e.g. Engineering" aria-label="Course domain" />
                <div className="flex gap-2">
                    <select required value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} className="editorial-input min-w-0 flex-1" aria-label="Course instructor">
                        <option value="">Select instructor</option>
                        {state.instructors.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
                    </select>
                    <button disabled={busy === 'course'} className="editorial-button px-4">Create</button>
                </div>
            </form>
            <RecordTable columns={['Course', 'Owner', 'Status']} rows={state.courses.map((item) => [<span key={item.id}><strong>{item.title}</strong><br /><small>{item.course_key}</small></span>, instructorName(item.owner_instructor_id), <Status key={item.id}>{item.status}</Status>])} empty="Create an instructor first, then a course." />
        </>
    )
}

function Ingestion({ state, busy, runAction, persistence }) {
    const [courseId, setCourseId] = useState('')
    const [file, setFile] = useState(null)
    const course = state.courses.find((item) => item.id === courseId)
    const submit = (event) => {
        event.preventDefault()
        runAction('pdf', () => convertCoursePdf(file, course, persistence), 'PDF converted. Review warnings before planning agents.')
            .then((completed) => completed && setFile(null))
    }
    return (
        <>
            <SectionHeader kicker="INGESTION" title="PDF to governed source" description="Extract page-addressable text, preserve the source checksum, flag OCR risks, and require human review before agents use the material." />
            <form onSubmit={submit} className="grid gap-3 border-b border-[var(--ath-line)] pb-5 md:grid-cols-[1fr_1.5fr_auto]">
                <select required value={courseId} onChange={(e) => setCourseId(e.target.value)} className="editorial-input" aria-label="PDF target course">
                    <option value="">Select course</option>
                    {state.courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <input required type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="editorial-input text-sm" aria-label="Course PDF" />
                <button disabled={busy === 'pdf' || !course} className="editorial-button px-4">{busy === 'pdf' ? 'Converting...' : 'Convert PDF'}</button>
            </form>
            <p className="mt-3 text-xs text-[var(--ath-secondary)]">Limits: 25MB, 500 pages. Encrypted documents are rejected. Image-only pages are routed to OCR review.</p>
            <RecordTable columns={['Source', 'Pages', 'Quality']} rows={state.ingestionJobs.map((item) => [item.source_name, item.page_count || '—', <span key={item.id}><Status>{item.status}</Status>{item.warnings?.length ? <small className="ml-2">{item.warnings.length} warnings</small> : null}</span>])} empty="No PDFs ingested." />
        </>
    )
}

function Agents({ state, busy, runAction, persistence }) {
    const [courseId, setCourseId] = useState('')
    const course = state.courses.find((item) => item.id === courseId)
    const source = state.ingestionJobs.find((item) => item.course_id === courseId)
    return (
        <>
            <SectionHeader kicker="GOVERNANCE" title="Agent control" description="Plan first, approve explicitly, execute one stage at a time, and preserve a human release gate." />
            <div className="mb-5 grid gap-3 border-y border-[var(--ath-line)] py-3 sm:grid-cols-3">
                <RuntimeMetric label="Durable workflows" value={(state.workflows || []).length} />
                <RuntimeMetric label="Awaiting approval" value={(state.workflows || []).filter((item) => item.status === 'awaiting_approval').length} />
                <RuntimeMetric label="Active" value={(state.workflows || []).filter((item) => item.status === 'active').length} />
                <p className="text-xs text-[var(--ath-muted)] sm:col-span-3">Default deny · messaging, publishing, enrollment changes, and final grades remain unavailable to autonomous execution.</p>
            </div>
            <div className="grid gap-3 border-b border-[var(--ath-line)] pb-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="editorial-input" aria-label="Agent run course">
                    <option value="">Select course</option>
                    {state.courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <button disabled={!course || !source || busy === 'plan'} onClick={() => runAction('plan', () => createGovernedAgentRun(course, source, persistence), 'Governed run created and held for approval.')} className="editorial-button px-4">Create run plan</button>
                {course && !source && <span className="text-xs text-amber-700 md:col-span-2">Approve a PDF source first.</span>}
            </div>
            <div className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {AGENT_MANIFEST.map((agent) => (
                    <div key={agent.id} className="border-l border-[var(--ath-line-strong)] pl-3">
                        <p className="text-sm font-semibold text-[var(--ath-text)]">{agent.name}</p>
                        <p className="text-xs text-[var(--ath-muted)]">{agent.stage} · {agent.approval} approval</p>
                    </div>
                ))}
            </div>
            <div className="mt-7 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                {state.agentRuns.length === 0 ? <p className="py-5 text-sm text-[var(--ath-muted)]">No governed runs planned.</p> : state.agentRuns.map((run) => (
                    <div key={run.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--ath-text)]">{state.courses.find((item) => item.id === run.course_id)?.title || run.course_id}</p>
                            <p className="text-xs text-[var(--ath-muted)]">{run.plan?.stages?.length || 7} stages · release requires separate review</p>
                        </div>
                        <Status>{run.status}</Status>
                        {run.status === 'awaiting_approval' && <button disabled={busy === `approve-${run.id}`} onClick={() => runAction(`approve-${run.id}`, () => approveAgentRun(run, persistence), 'Run approved. Release remains gated.')} className="editorial-button-secondary px-3 py-2 text-xs">Approve plan</button>}
                    </div>
                ))}
            </div>
            {(state.workflows || []).length > 0 && (
                <div className="mt-6">
                    <p className="editorial-label">Recent learner and instructor workflows</p>
                    <div className="mt-2 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                        {state.workflows.slice(0, 8).map((workflow) => (
                            <div key={workflow.id} className="flex flex-wrap items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[var(--ath-text)]">{workflow.goal || workflow.workflow_type}</p>
                                    <p className="text-xs text-[var(--ath-muted)]">{String(workflow.workflow_type).replaceAll('_', ' ')} · {workflow.risk_level || 'low'} risk</p>
                                </div>
                                <Status>{workflow.status}</Status>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}

function RuntimeMetric({ label, value }) {
    return (
        <div className="border-l-2 border-[var(--ath-primary-soft)] pl-3">
            <p className="text-xl font-semibold text-[var(--ath-text)]">{value}</p>
            <p className="text-xs text-[var(--ath-secondary)]">{label}</p>
        </div>
    )
}

function RecordTable({ columns, rows, empty }) {
    return (
        <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
                <thead><tr className="border-b border-[var(--ath-line)] text-[10px] uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{columns.map((column) => <th key={column} className="px-2 py-2 font-semibold">{column}</th>)}</tr></thead>
                <tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b border-[var(--ath-line)] last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-3 text-[var(--ath-muted)]">{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-2 py-6 text-[var(--ath-muted)]">{empty}</td></tr>}</tbody>
            </table>
        </div>
    )
}

function AuditList({ events }) {
    if (!events.length) return <p className="mt-2 text-sm text-[var(--ath-muted)]">No operator actions yet.</p>
    return <ul className="mt-2 divide-y divide-[var(--ath-line)]">{events.map((event) => <li key={event.id} className="py-2 text-xs"><span className="font-semibold text-[var(--ath-text)]">{event.action}</span><span className="ml-2 text-[var(--ath-secondary)]">{new Date(event.created_at).toLocaleString()}</span></li>)}</ul>
}
