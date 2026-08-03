import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Eye, FileSearch, ShieldCheck } from 'lucide-react'
import {
    buildEvidenceBrief,
    buildImpactReport,
    impactReportToMarkdown,
    importGoogleDocCourseDraft,
    importPdfCourseDraft,
    loadAssignedIngestionSources,
    loadFacultyWorkspace,
    publishFacultyPilot,
    publishedSectionRoute,
    saveEvidenceBrief,
    saveImpactReport,
    saveShadowPilot,
    setPilotStatus,
} from '../lib/facultyPartnershipService'

const VIEWS = [
    { id: 'brief', label: 'Weekly brief' },
    { id: 'pilot', label: 'Shadow pilot' },
    { id: 'report', label: 'Impact report' },
]

export default function FacultyPartnershipWorkspace({ courseId, hotSpots = [], strugglers = [], rct = {} }) {
    const [view, setView] = useState('brief')
    const [workspace, setWorkspace] = useState({ pilots: [], briefs: [], reports: [], published: [], persistence: 'local' })
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState({
        title: 'Faculty evidence partnership',
        moduleName: '',
        sourceName: '',
        learningObjectives: '',
        googleDocUrl: '',
    })
    const [generationDraft, setGenerationDraft] = useState(null)
    // Governed PDF sources already ingested for this course that carry a runtime
    // draft, so a pilot can start from the reviewed source instead of only a link.
    const [ingestedSources, setIngestedSources] = useState([])
    const [selectedSourceId, setSelectedSourceId] = useState('')
    const [pdfFile, setPdfFile] = useState(null)

    const brief = useMemo(() => buildEvidenceBrief({
        courseId,
        hotSpots,
        strugglers,
        interventionOutcomes: rct.interventionOutcomes || [],
    }), [courseId, hotSpots, rct.interventionOutcomes, strugglers])

    const activePilot = workspace.pilots[0] || null
    const report = useMemo(() => buildImpactReport({
        courseId,
        pilot: activePilot,
        brief,
        interventionOutcomes: rct.interventionOutcomes || [],
        evaluationGains: rct.evaluationGains || [],
    }), [activePilot, brief, courseId, rct.evaluationGains, rct.interventionOutcomes])

    useEffect(() => {
        let cancelled = false
        setGenerationDraft(null)
        loadFacultyWorkspace(courseId)
            .then((result) => {
                if (cancelled) return
                setWorkspace(result)
                const pilot = result.pilots?.[0]
                if (pilot?.generation_draft?.sections?.length) {
                    setGenerationDraft(pilot.generation_draft)
                    setForm((current) => ({
                        ...current,
                        title: pilot.title || current.title,
                        moduleName: pilot.module_name || '',
                        sourceName: pilot.source_name || '',
                        googleDocUrl: pilot.source_url || '',
                        learningObjectives: (pilot.learning_objectives || pilot.generation_draft.learning_objectives || []).join('\n'),
                    }))
                }
            })
            .catch((error) => { if (!cancelled) setMessage(error.message) })
        return () => { cancelled = true }
    }, [courseId])

    useEffect(() => {
        let cancelled = false
        setIngestedSources([])
        setSelectedSourceId('')
        loadAssignedIngestionSources(courseId)
            .then((sources) => {
                if (cancelled) return
                setIngestedSources(sources)
            })
            .catch((error) => {
                if (!cancelled) setMessage(error?.message || 'Could not load assigned source records.')
            })
        return () => { cancelled = true }
    }, [courseId])

    const persistBrief = async () => {
        setBusy('brief')
        setMessage('')
        try {
            const saved = await saveEvidenceBrief(brief, workspace.persistence)
            setWorkspace((current) => ({ ...current, briefs: [saved, ...current.briefs.filter((item) => item.id !== saved.id)] }))
            setMessage('Weekly brief saved for instructor review.')
        } catch (error) {
            setMessage(error.message || 'Could not save the brief.')
        } finally {
            setBusy('')
        }
    }

    const createPilot = async (event) => {
        event.preventDefault()
        if (!form.moduleName.trim()) {
            setMessage('Add the module name before starting shadow mode.')
            return
        }
        setBusy('pilot')
        setMessage('')
        try {
            const pilot = await saveShadowPilot({
                courseId,
                title: form.title,
                moduleName: form.moduleName,
                sourceName: form.sourceName,
                sourceUrl: form.googleDocUrl,
                generationDraft,
                learningObjectives: form.learningObjectives.split('\n'),
            }, workspace.persistence)
            setWorkspace((current) => ({ ...current, pilots: [pilot, ...current.pilots] }))
            setMessage('Shadow mode started. Nothing is visible to students.')
        } catch (error) {
            setMessage(error.message || 'Could not create the pilot.')
        } finally {
            setBusy('')
        }
    }

    const importGoogleDoc = async () => {
        if (!form.googleDocUrl.trim()) {
            setMessage('Paste a Google Docs link first.')
            return
        }
        setBusy('google-doc')
        setMessage('')
        try {
            const draft = await importGoogleDocCourseDraft({ courseId, documentUrl: form.googleDocUrl })
            setGenerationDraft(draft)
            setForm((current) => ({
                ...current,
                sourceName: draft.source?.title || 'Google Docs course source',
                moduleName: current.moduleName || draft.sections?.[0]?.title || draft.source?.title || '',
                learningObjectives: (draft.learning_objectives || []).join('\n'),
            }))
            setMessage(`Google Doc connected. ${draft.sections?.length || 0} sections plus tutor, analytics, and social runtime settings are ready to inspect.`)
        } catch (error) {
            setMessage(error.message || 'Could not import the Google Doc.')
        } finally {
            setBusy('')
        }
    }

    const importPdf = async () => {
        if (!pdfFile) {
            setMessage('Choose a PDF first.')
            return
        }
        setBusy('pdf-source')
        setMessage('')
        try {
            const draft = await importPdfCourseDraft({ courseId, file: pdfFile })
            setGenerationDraft(draft)
            setForm((current) => ({
                ...current,
                sourceName: draft.source?.title || pdfFile.name,
                moduleName: current.moduleName || draft.sections?.[0]?.title || pdfFile.name,
                learningObjectives: (draft.learning_objectives || []).join('\n'),
            }))
            setMessage(`${pdfFile.name} drafted. ${draft.sections?.length || 0} sections plus tutor, analytics, and social runtime settings are ready to inspect.`)
        } catch (error) {
            setMessage(error.message || 'Could not import the PDF.')
        } finally {
            setBusy('')
        }
    }

    const draftFromIngestedSource = () => {
        const job = ingestedSources.find((item) => item.id === selectedSourceId)
        if (!job) {
            setMessage('Choose an ingested source first.')
            return
        }
        const draft = job.quality_report.runtime_package
        setGenerationDraft(draft)
        setForm((current) => ({
            ...current,
            sourceName: job.source_name || draft.source?.title || 'Ingested course source',
            moduleName: current.moduleName || draft.sections?.[0]?.title || job.source_name || '',
            learningObjectives: (draft.learning_objectives || []).join('\n'),
        }))
        setMessage(`Drafted from ${job.source_name}. ${draft.sections?.length || 0} sections plus tutor, analytics, and social runtime settings are ready to inspect.`)
    }

    const markReady = async () => {
        if (!activePilot) return
        setBusy('ready')
        setMessage('')
        try {
            const updated = await setPilotStatus(activePilot, 'ready', workspace.persistence)
            setWorkspace((current) => ({ ...current, pilots: current.pilots.map((item) => item.id === updated.id ? updated : item) }))
            setMessage('Pilot is ready for instructor approval. Student visibility remains off.')
        } catch (error) {
            setMessage(error.message || 'Could not update the pilot.')
        } finally {
            setBusy('')
        }
    }

    const publishPilot = async () => {
        if (!activePilot) return
        setBusy('publish')
        setMessage('')
        try {
            const result = await publishFacultyPilot(activePilot, workspace.persistence)
            setWorkspace((current) => ({
                ...current,
                pilots: current.pilots.map((item) => item.id === result.pilot.id ? result.pilot : item),
                published: [result.published, ...current.published.filter((item) => item.id !== result.published.id)],
            }))
            setMessage('Published to the learner reader. The approved module is now course-visible.')
        } catch (error) {
            setMessage(error.message || 'Could not publish the pilot.')
        } finally {
            setBusy('')
        }
    }

    const exportReport = async () => {
        setBusy('report')
        setMessage('')
        try {
            const saved = await saveImpactReport(report, workspace.persistence)
            setWorkspace((current) => ({ ...current, reports: [saved, ...current.reports] }))
            downloadMarkdown(impactReportToMarkdown(report), `${courseId}-course-impact-report.md`)
            setMessage('De-identified course impact report exported.')
        } catch (error) {
            setMessage(error.message || 'Could not export the report.')
        } finally {
            setBusy('')
        }
    }

    return (
        <section aria-labelledby="faculty-partnership-title" className="mx-auto mt-5 max-w-5xl border-t border-[var(--ath-line)] pt-4">
            <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p className="editorial-kicker">FACULTY EVIDENCE PARTNERSHIP</p>
                    <h1 id="faculty-partnership-title" className="mt-1 font-headline text-2xl font-semibold text-[var(--ath-text)]">See the course before changing it</h1>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ath-muted)]">Start in shadow mode, review one compact evidence brief, and release only what you approve.</p>
                </div>
                <div className="inline-flex rounded-lg bg-[var(--ath-panel-muted)] p-1" aria-label="Faculty partnership views">
                    {VIEWS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setView(item.id)}
                            aria-pressed={view === item.id}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === item.id ? 'bg-[var(--ath-surface-strong)] text-[var(--ath-text)] shadow-sm' : 'text-[var(--ath-muted)] hover:text-[var(--ath-text)]'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {message && <p role="status" className="mt-3 border-l-2 border-[var(--ath-primary)] pl-3 text-xs text-[var(--ath-muted)]">{message}</p>}

            {view === 'brief' && (
                <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--ath-text)]">Week ending {brief.period_end}</p>
                            <p className="mt-0.5 text-xs text-[var(--ath-muted)]">A five-minute review of signals that may warrant attention.</p>
                        </div>
                        <button type="button" onClick={persistBrief} disabled={Boolean(busy)} className="editorial-button px-4 py-2 text-xs">
                            {busy === 'brief' ? 'Saving…' : 'Save review copy'}
                        </button>
                    </div>

                    <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(15rem,.65fr)]">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Concepts to inspect</h2>
                            {brief.attention.concepts.length === 0 ? (
                                <p className="mt-2 text-sm text-[var(--ath-muted)]">No cohort signal crosses the current support threshold.</p>
                            ) : (
                                <ol className="mt-2 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                                    {brief.attention.concepts.map((concept, index) => (
                                        <li key={concept.concept_id} className="grid gap-2 py-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]">
                                            <span className="text-xs font-semibold text-[var(--ath-secondary)]">{index + 1}</span>
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--ath-text)]">{prettify(concept.concept_id)}</p>
                                                <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">{concept.why_now}</p>
                                                <p className="mt-1 text-xs text-[var(--ath-text)]">Next move: {concept.recommended_action}</p>
                                            </div>
                                            <span className="text-xs font-semibold text-[var(--ath-primary)]">{Math.round(concept.average_mastery * 100)}%</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                        <aside className="border-l border-[var(--ath-line)] pl-5">
                            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Learners to check</h2>
                            {brief.attention.learners.length === 0 ? <p className="mt-2 text-sm text-[var(--ath-muted)]">No learner-level flag is active.</p> : (
                                <ul className="mt-2 space-y-2">
                                    {brief.attention.learners.map((learner) => (
                                        <li key={learner.user_id} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="truncate font-semibold text-[var(--ath-text)]">{learner.display_name}</span>
                                            <span className="text-[var(--ath-muted)]">{Math.round(learner.average_mastery * 100)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="mt-4 flex gap-2 text-[11px] leading-4 text-[var(--ath-secondary)]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Signals are correlational. BigAL cannot message learners or assign grades.</p>
                        </aside>
                    </div>
                </div>
            )}

            {view === 'pilot' && (
                <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(17rem,.7fr)]">
                    <form onSubmit={createPilot} className="space-y-4">
                        {ingestedSources.length > 0 && (
                            <div>
                                <label htmlFor="pilot-ingested-source" className="text-xs font-semibold text-[var(--ath-text)]">Ingested course source</label>
                                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                                    <select id="pilot-ingested-source" value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)} className="editorial-input min-w-0 flex-1" aria-label="Ingested course source">
                                        <option value="">Select an approved source</option>
                                        {ingestedSources.map((job) => (
                                            <option key={job.id} value={job.id}>{job.source_name} · {job.page_count || '—'} pages</option>
                                        ))}
                                    </select>
                                    <button type="button" onClick={draftFromIngestedSource} disabled={Boolean(busy)} className="editorial-button-secondary shrink-0 px-3 py-2 text-xs">Draft from source</button>
                                </div>
                                <p className="mt-1.5 text-[11px] leading-4 text-[var(--ath-secondary)]">Sources converted under Admin → PDF ingestion, with their checksum and page record preserved.</p>
                            </div>
                        )}
                        <div>
                            <label htmlFor="pilot-pdf" className="text-xs font-semibold text-[var(--ath-text)]">PDF course source</label>
                            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                                <input id="pilot-pdf" type="file" accept="application/pdf,.pdf" onChange={(event) => setPdfFile(event.target.files?.[0] || null)} className="editorial-input min-w-0 flex-1 text-sm" aria-label="PDF course source" />
                                <button type="button" onClick={importPdf} disabled={Boolean(busy) || !pdfFile} className="editorial-button-secondary shrink-0 px-3 py-2 text-xs">{busy === 'pdf-source' ? 'Drafting…' : 'Upload & draft'}</button>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-4 text-[var(--ath-secondary)]">Text is extracted, checksummed, and drafted into a private shadow module. The file itself is never published.</p>
                        </div>
                        <div>
                            <label htmlFor="pilot-google-doc" className="text-xs font-semibold text-[var(--ath-text)]">Google Docs course source</label>
                            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                                <input id="pilot-google-doc" type="url" value={form.googleDocUrl} onChange={(event) => setForm({ ...form, googleDocUrl: event.target.value })} placeholder="https://docs.google.com/document/d/…/edit" className="editorial-input min-w-0 flex-1" />
                                <button type="button" onClick={importGoogleDoc} disabled={Boolean(busy)} className="editorial-button-secondary shrink-0 px-3 py-2 text-xs">{busy === 'google-doc' ? 'Connecting…' : 'Connect & draft'}</button>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-4 text-[var(--ath-secondary)]">Use a view-only link. ALGET imports text into a private shadow draft and never changes the source document.</p>
                        </div>
                        <div>
                            <label htmlFor="pilot-module" className="text-xs font-semibold text-[var(--ath-text)]">Module to inspect</label>
                            <input id="pilot-module" value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} placeholder="Week 4 · Evaluating AI evidence" className="editorial-input mt-1 w-full" />
                        </div>
                        <div>
                            <label htmlFor="pilot-source" className="text-xs font-semibold text-[var(--ath-text)]">Syllabus or source filename</label>
                            <input id="pilot-source" value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} placeholder="syllabus.pdf" className="editorial-input mt-1 w-full" />
                        </div>
                        <div>
                            <label htmlFor="pilot-objectives" className="text-xs font-semibold text-[var(--ath-text)]">Learning objectives, one per line</label>
                            <textarea id="pilot-objectives" rows="4" value={form.learningObjectives} onChange={(event) => setForm({ ...form, learningObjectives: event.target.value })} placeholder="Evaluate the credibility of an AI-supported claim\nRevise a response using source evidence" className="editorial-input mt-1 w-full resize-y" />
                        </div>
                        <button type="submit" disabled={Boolean(busy)} className="editorial-button px-4 py-2.5 text-xs">{busy === 'pilot' ? 'Starting…' : 'Start shadow mode'}</button>
                        {generationDraft?.sections?.length > 0 && (
                            <div className="border-t border-[var(--ath-line)] pt-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Generated course runtime package</p>
                                {/* How the draft was produced decides whether an instructor
                                    should trust it. A run that fell back to deterministic
                                    structure must say so here, not look generated. */}
                                {generationDraft.quality?.warnings?.length > 0 && (
                                    <ul aria-label="Draft generation notices" className="mt-2 space-y-1 border-l-2 border-amber-500 pl-3">
                                        {generationDraft.quality.warnings.map((warning) => (
                                            <li key={warning} className="text-xs leading-5 text-amber-800">{warning}</li>
                                        ))}
                                    </ul>
                                )}
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ath-primary)]">
                                    {['Reading', 'Activity', 'Simulation', 'Tutor', 'Analytics', 'Social cues'].map((label) => <span key={label} className="rounded-full bg-[color-mix(in_srgb,var(--ath-primary)_10%,var(--ath-panel))] px-2 py-1">{label}</span>)}
                                </div>
                                <ul className="mt-2 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                                    {generationDraft.sections.slice(0, 5).map((section) => (
                                        <li key={section.section_id} className="py-3">
                                            <p className="text-sm font-semibold text-[var(--ath-text)]">{section.title}</p>
                                            <p className="mt-1 text-xs text-[var(--ath-muted)]">Reading · {section.reading?.estimated_minutes || 0} min · {prettify(section.activity?.type || 'activity')} · simulation proposed</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </form>
                    <aside className="border-l border-[var(--ath-line)] pl-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ath-text)]"><Eye className="h-4 w-4 text-[var(--ath-primary)]" />Student visibility stays off</div>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ath-muted)]">
                            <li>Inspect objective and assessment alignment.</li>
                            <li>Flag reading load, accessibility, and likely friction.</li>
                            <li>Preview activities before any learner sees them.</li>
                            <li>Require an instructor decision before release.</li>
                        </ul>
                        {activePilot && (
                            <div className="mt-5 border-t border-[var(--ath-line)] pt-4">
                                <p className="text-xs font-semibold text-[var(--ath-text)]">Current pilot</p>
                                <p className="mt-1 text-sm text-[var(--ath-text)]">{activePilot.module_name}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.13em] text-[var(--ath-primary)]">{activePilot.status}</p>
                                {activePilot.status === 'shadow' && <button type="button" onClick={markReady} disabled={Boolean(busy)} className="editorial-button-secondary mt-3 px-3 py-2 text-xs"><Check className="mr-1 inline h-3.5 w-3.5" />Mark ready for review</button>}
                                {activePilot.status === 'ready' && <button type="button" onClick={publishPilot} disabled={Boolean(busy)} className="editorial-button mt-3 px-3 py-2 text-xs"><Check className="mr-1 inline h-3.5 w-3.5" />{busy === 'publish' ? 'Publishing…' : 'Approve & publish'}</button>}
                                {activePilot.status === 'active' && workspace.published[0]?.generation_draft?.sections?.length > 0 && <a href={`/book/${courseId}/published/${publishedSectionRoute(workspace.published[0].id, 0)}`} className="mt-3 inline-block text-xs font-semibold text-[var(--ath-primary)] underline-offset-4 hover:underline">Open in learner reader →</a>}
                            </div>
                        )}
                    </aside>
                </div>
            )}

            {view === 'report' && (
                <div className="mt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-[var(--ath-primary)]" /><h2 className="text-sm font-semibold text-[var(--ath-text)]">Course improvement record</h2></div>
                            <p className="mt-1 text-xs text-[var(--ath-muted)]">De-identified, instructor-owned, and explicit about evidence limits.</p>
                        </div>
                        <button type="button" onClick={exportReport} disabled={Boolean(busy)} className="editorial-button px-4 py-2 text-xs"><Download className="mr-1 inline h-3.5 w-3.5" />{busy === 'report' ? 'Exporting…' : 'Export Markdown'}</button>
                    </div>
                    <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric label="Closed interventions" value={report.outcomes.intervention_count} />
                        <Metric label="Positive resolution" value={report.outcomes.positive_rate == null ? 'Pending' : `${Math.round(report.outcomes.positive_rate * 100)}%`} />
                        <Metric label="Evaluation gain" value={report.outcomes.mean_evaluation_gain == null ? 'Pending' : report.outcomes.mean_evaluation_gain.toFixed(2)} />
                        <Metric label="Latest concept flags" value={report.outcomes.concepts_flagged} />
                    </dl>
                    <p className="mt-5 max-w-3xl border-l-2 border-[var(--ath-line-strong)] pl-3 text-xs leading-5 text-[var(--ath-muted)]">{report.interpretation}</p>
                </div>
            )}
        </section>
    )
}

function Metric({ label, value }) {
    return (
        <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-[var(--ath-text)]">{value}</dd>
        </div>
    )
}

function prettify(value) {
    return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function downloadMarkdown(markdown, filename) {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}
