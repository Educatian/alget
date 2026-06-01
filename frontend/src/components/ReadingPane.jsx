import { Suspense, lazy, memo, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ListChecks, NotebookPen } from 'lucide-react'
import { logInteraction } from '../lib/loggingService'
import { EXIT_TICKET_MIN_CHARS, getExitTicketStorageKey, readExitTicket, writeExitTicket } from '../lib/exitTickets'
import PeerPulse from './PeerPulse'

const ReadingNarrative = lazy(() => import('./ReadingNarrative'))
const PracticeBlock = lazy(() => import('./PracticeBlock'))
const KnowledgeCheck = lazy(() => import('./KnowledgeCheck'))
const AffectiveReaction = lazy(() => import('./AffectiveReaction'))
const PerusallLayer = lazy(() => import('./PerusallLayer'))

const SECTION_PATH_STEPS = [
    { id: 'section-reading', label: 'Read', detail: 'Core idea' },
    { id: 'section-reflect', label: 'Reflect', detail: 'Question or connection' },
    { id: 'section-check', label: 'Check', detail: 'Retrieval' },
    { id: 'section-practice', label: 'Practice', detail: 'Apply' },
    { id: 'section-finish', label: 'Finish', detail: 'Evidence trace' }
]

const READY_CHECK_ITEMS = [
    ['claim', 'State the claim', 'I can say the section idea without rereading the heading.'],
    ['evidence', 'Use evidence', 'I can point to one example, annotation, or practice result.'],
    ['transfer', 'Name the next move', 'I know what I would revise, test, or ask next.']
]

const DEFAULT_READY_CHECKS = {
    claim: false,
    evidence: false,
    transfer: false
}

function PanelFallback({ label }) {
    return (
        <div className="rounded-[1.75rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.78)] p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--ath-muted)]">{label}</p>
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-[var(--ath-panel-muted)]" />
        </div>
    )
}

function inferWorkProduct(meta = {}) {
    const course = String(meta.course || '').toLowerCase()
    const title = String(meta.title || '')

    if (course.includes('ail606')) {
        return 'AI-supported lesson redesign or classroom AI-use policy'
    }
    if (course.includes('cat531')) {
        return 'data story, analysis memo, or visualization interpretation'
    }
    if (course.includes('cat100')) {
        return 'resume, portfolio, or career evidence packet'
    }
    if (title.toLowerCase().includes('bio')) {
        return 'bio-inspired design rationale with evidence and trade-off judgment'
    }
    return 'course deliverable with claim, evidence, critique judgment, and revision trace'
}

function formatRecentTimestamp(value) {
    if (!value) return 'recently'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'recently'
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    })
}

function ReadingPane({
    sectionData,
    loading,
    sectionError,
    onRetrySection,
    onStuckEvent,
    onNeedsReview,
    isBookmarked,
    toggleBookmark,
    isCompleted,
    markCompleted,
    onHeadingChange,
    previousSection,
    nextSection,
    recentSection,
    onNavigate,
    peerPulse
}) {
    const sectionId = sectionData?.meta ? `${sectionData.meta.course}/${sectionData.meta.chapter}/${sectionData.meta.section}` : null
    const [showSimulation, setShowSimulation] = useState(false)
    const [showIllustration, setShowIllustration] = useState(false)
    const [readyCheckDraft, setReadyCheckDraft] = useState({ sectionId, value: DEFAULT_READY_CHECKS })
    const [exitTicketDraft, setExitTicketDraft] = useState(() => ({
        sectionId,
        value: readExitTicket(sectionId)
    }))
    const exitTicketStorageKey = getExitTicketStorageKey(sectionId)
    const storedExitTicket = useMemo(() => readExitTicket(sectionId), [sectionId])
    const readyChecks = readyCheckDraft.sectionId === sectionId ? readyCheckDraft.value : DEFAULT_READY_CHECKS
    const exitTicket = exitTicketDraft.sectionId === sectionId ? exitTicketDraft.value : storedExitTicket

    useEffect(() => {
        if (!exitTicketStorageKey || typeof window === 'undefined') return

        try {
            writeExitTicket(sectionId, exitTicket, {
                course: sectionData?.meta?.course,
                chapter: sectionData?.meta?.chapter,
                section: sectionData?.meta?.section,
                title: sectionData?.meta?.title,
                description: sectionData?.meta?.description
            })
        } catch {
            // Local persistence is a convenience; the section should remain usable
            // in privacy-restricted browsers.
        }
    }, [exitTicketStorageKey, exitTicket, sectionData?.meta, sectionId])

    const handleToggleSimulation = () => {
        const newState = !showSimulation
        setShowSimulation(newState)
        logInteraction('simulation_accordion', newState ? 'opened' : 'closed', sectionId)
    }

    const handleToggleIllustration = () => {
        const newState = !showIllustration
        setShowIllustration(newState)
        logInteraction('illustration_accordion', newState ? 'opened' : 'closed', sectionId)
    }

    const jumpToStage = (targetId) => {
        if (typeof document === 'undefined') return
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        logInteraction('section_path_jump', targetId, sectionId)
    }

    const toggleReadyCheck = (key) => {
        setReadyCheckDraft({
            sectionId,
            value: {
                ...readyChecks,
                [key]: !readyChecks[key]
            }
        })
        logInteraction('ready_check_toggle', key, sectionId)
    }

    const handleExitTicketBlur = () => {
        const trimmedLength = exitTicket.trim().length
        if (trimmedLength > 0) {
            logInteraction('exit_ticket_saved', `${trimmedLength}`, sectionId)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)]">
                    <span className="text-lg font-semibold text-[var(--ath-primary)]">AL</span>
                </div>
                <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                    <div className="h-full w-1/2 animate-[progress-indeterminate_2s_ease-in-out_infinite] rounded-full bg-[var(--ath-primary)]"></div>
                </div>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--ath-secondary)]">Loading section</p>
            </div>
        )
    }

    // A load FAILURE (network/server) is recoverable: offer a retry instead of
    // the dead "Section Not Found" that implies the user navigated wrong.
    if (!sectionData && sectionError) {
        return (
            <div className="flex h-full items-center justify-center px-4">
                <div className="max-w-md text-center" role="alert">
                    <div className="mb-4 text-5xl font-semibold text-[var(--ath-secondary)]">AL</div>
                    <h2 className="text-2xl font-semibold text-[var(--ath-text)]">This section didn&apos;t load</h2>
                    <p className="mt-2 text-[var(--ath-muted)]">
                        A network or server hiccup interrupted the load. Your place is saved.
                    </p>
                    {onRetrySection && (
                        <button
                            type="button"
                            onClick={onRetrySection}
                            className="mt-5 rounded-2xl bg-[var(--ath-primary)] px-5 py-3 text-sm font-semibold text-[var(--ath-background)] transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                        >
                            Try again
                        </button>
                    )}
                </div>
            </div>
        )
    }

    if (!sectionData) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 text-5xl font-semibold text-[var(--ath-secondary)]">AL</div>
                    <h2 className="text-2xl font-semibold text-[var(--ath-text)]">Section Not Found</h2>
                    <p className="mt-2 text-[var(--ath-muted)]">Select a section from the table of contents.</p>
                </div>
            </div>
        )
    }

    const { meta, content, simulation, illustration, practice } = sectionData
    const workProduct = inferWorkProduct(meta)
    const contentHasLearningTargets = /(^|\n)##\s+Learning Targets\b/.test(content || '')
    const canResumeRecent = recentSection?.sectionId
        && recentSection.sectionId !== sectionId
        && recentSection.course === meta?.course
    const readyCount = Object.values(readyChecks).filter(Boolean).length
    const exitTicketLength = exitTicket.trim().length
    const exitTicketReady = exitTicketLength >= EXIT_TICKET_MIN_CHARS
    const completionReady = readyCount === READY_CHECK_ITEMS.length && exitTicketReady

    return (
        <div className="mx-auto w-full max-w-[min(78rem,100%)] px-4 py-8 sm:px-8 sm:py-10">
            <header className="mb-8 sm:mb-10">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="editorial-kicker">
                        Chapter {meta?.chapter} / Section {meta?.section}
                    </p>
                    {meta?.estimated_time_minutes && (
                        <span className="editorial-chip">{meta.estimated_time_minutes} min read</span>
                    )}
                </div>

                <div className="editorial-divider mb-5"></div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="editorial-title text-3xl leading-tight text-[var(--ath-text)] sm:text-4xl">
                            {meta?.title || 'Section Title'}
                        </h1>
                        {meta?.description && (
                            <p className="mt-3 max-w-4xl text-base italic leading-7 text-[var(--ath-muted)] sm:mt-4 sm:text-lg sm:leading-8">
                                {meta.description}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={toggleBookmark}
                            className={`px-4 py-2 text-sm ${isBookmarked ? 'editorial-button' : 'editorial-button-secondary'}`}
                        >
                            {isBookmarked ? 'Saved for Review' : 'Save for Later'}
                        </button>
                    </div>
                </div>

                {meta?.learning_objectives?.length > 0 && !contentHasLearningTargets && (
                    <div className="mt-8 rounded-[1.8rem] border-l-4 border-[var(--ath-primary)] bg-[linear-gradient(90deg,rgba(200,226,236,0.42),rgba(255,255,255,0.72))] p-6 shadow-sm">
                        <p className="editorial-kicker">Learning Objectives</p>
                        <ul className="mt-4 space-y-3">
                            {meta.learning_objectives.map((obj, i) => (
                                <li key={i} className="flex items-start gap-3 text-[1.02rem] leading-7 text-[var(--ath-text)]">
                                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--ath-primary)]" aria-hidden="true" />
                                    <span>{obj}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-8 rounded-2xl border border-[var(--ath-line)] bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <p
                            className="mr-auto min-w-0 truncate text-sm font-semibold text-[var(--ath-text)]"
                            title={workProduct}
                        >
                            {workProduct}
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${isCompleted
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-[var(--ath-panel)] text-[var(--ath-secondary)]'
                            }`}>
                            {isCompleted ? 'Done' : 'Open'}
                        </span>
                        {canResumeRecent && (
                            <button
                                type="button"
                                onClick={() => onNavigate?.(recentSection.chapter, recentSection.section, 'backward')}
                                title={`Resume ${recentSection.chapter}.${recentSection.section} ${recentSection.title || ''} / ${formatRecentTimestamp(recentSection.updatedAt)}`}
                                className="text-xs font-semibold text-[var(--ath-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                            >
                                Resume {recentSection.chapter}.{recentSection.section}
                            </button>
                        )}
                    </div>
                    <ol className="mt-3 flex gap-2 overflow-x-auto pb-1 text-[11px] font-semibold text-[var(--ath-secondary)] sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
                        {SECTION_PATH_STEPS.map((step, index) => (
                            <li key={step.id} className="min-w-[9rem] sm:min-w-0">
                                <button
                                    type="button"
                                    onClick={() => jumpToStage(step.id)}
                                    className="flex min-h-16 w-full items-center gap-2 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-2.5 py-2 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                                    aria-label={`Jump to ${step.label}`}
                                >
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--ath-text)] shadow-sm">{index + 1}</span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[var(--ath-text)]">{step.label}</span>
                                        <span className="block truncate text-[10px] font-medium text-[var(--ath-muted)]">{step.detail}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            </header>

            <section id="section-reading" className="scroll-mt-28">
                <Suspense fallback={<PanelFallback label="Loading Reading Narrative..." />}>
                    <ReadingNarrative
                        content={content}
                        sectionId={sectionId}
                        course={sectionData?.meta?.course}
                        conceptIds={sectionData?.meta?.concept_ids || []}
                        sectionDescription={sectionData?.meta?.description}
                        onHeadingChange={(heading) => {
                            onHeadingChange?.(heading)
                        }}
                    />
                </Suspense>
            </section>

            {peerPulse && (
                <PeerPulse
                    connected={peerPulse.connected}
                    peers={peerPulse.peers}
                    sameHeadingPeers={peerPulse.sameHeadingPeers}
                    sameConceptPeers={peerPulse.sameConceptPeers}
                    signalSummary={peerPulse.signalSummary}
                    activeHeading={peerPulse.activeHeading}
                    onReaction={peerPulse.onReaction}
                />
            )}

            {(simulation || illustration) && (
                <div className="mb-8 mt-10 space-y-4">
                    {simulation && (
                        <div className="content-card overflow-hidden">
                            <button
                                onClick={handleToggleSimulation}
                                className="flex w-full items-center justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4 transition-colors"
                            >
                                <span className="flex items-center gap-3 text-left font-semibold text-[var(--ath-text)]">
                                    <span className="editorial-label text-[var(--ath-primary)]">SIM</span>
                                    Interactive Simulation
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 shrink-0 text-[var(--ath-secondary)] transition-transform duration-300 ${showSimulation ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                />
                            </button>

                            {showSimulation && (
                                <div className="animate-fade-in border-t border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-5">
                                    <p className="mb-4 text-sm leading-6 text-[var(--ath-muted)]">{simulation.description}</p>
                                    <div className="overflow-hidden rounded-[1.2rem] border border-[var(--ath-line)] bg-white shadow-inner">
                                        <iframe
                                            srcDoc={simulation.html_code}
                                            className="h-[450px] w-full"
                                            sandbox="allow-scripts"
                                            title="Interactive Simulation"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {illustration && (
                        <div className="content-card overflow-hidden">
                            <button
                                onClick={handleToggleIllustration}
                                className="flex w-full items-center justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,237,230,0.72))] px-5 py-4 transition-colors"
                            >
                                <span className="flex items-center gap-3 text-left font-semibold text-[var(--ath-text)]">
                                    <span className="editorial-label text-[var(--ath-primary)]">VIS</span>
                                    Concept Illustration
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 shrink-0 text-[var(--ath-secondary)] transition-transform duration-300 ${showIllustration ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                />
                            </button>

                            {showIllustration && (
                                <div className="animate-fade-in border-t border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-5">
                                    <div className="rounded-[1.2rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-8 text-center shadow-inner">
                                        <p className="text-lg leading-relaxed text-[var(--ath-text)]">{illustration.description}</p>
                                        {illustration.image_url && (
                                            <img
                                                src={illustration.image_url}
                                                alt={illustration.description}
                                                className="mx-auto mt-6 max-w-full rounded-xl shadow-lg ring-1 ring-black/5"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {meta?.concept_ids?.length > 0 && (
                <div className="mb-10">
                    <p className="editorial-kicker">Key Concepts</p>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                        {meta.concept_ids.map((concept, i) => (
                            <span
                                key={i}
                                className="editorial-chip"
                            >
                                {concept.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <section id="section-reflect" className="scroll-mt-28">
                <Suspense fallback={<PanelFallback label="Loading Reflection Tools..." />}>
                    <AffectiveReaction
                        sectionId={sectionId}
                        conceptIds={meta?.concept_ids}
                    />
                </Suspense>

                <Suspense fallback={<PanelFallback label="Loading Social Annotation..." />}>
                    <PerusallLayer
                        key={sectionId}
                        sectionId={sectionId}
                        sectionTitle={meta?.title || ''}
                        conceptIds={meta?.concept_ids || []}
                    />
                </Suspense>
            </section>

            <div className="editorial-divider my-10"></div>

            <section id="section-check" className="scroll-mt-28">
                <Suspense fallback={<PanelFallback label="Loading Knowledge Check..." />}>
                    <KnowledgeCheck
                        bioContext={content}
                        engContext={meta?.description}
                        sectionId={sectionId}
                        sectionTitle={meta?.title}
                        learningObjectives={meta?.learning_objectives}
                        conceptIds={meta?.concept_ids}
                        onNeedsReview={onNeedsReview}
                    />
                </Suspense>
            </section>

            <div className="editorial-divider my-10"></div>

            <section id="section-practice" className="scroll-mt-28">
                <Suspense fallback={<PanelFallback label="Loading Practice..." />}>
                    <PracticeBlock
                        practice={practice}
                        sectionId={`${meta?.course}/${meta?.chapter}/${meta?.section}`}
                        onStuckEvent={onStuckEvent}
                        onNeedsReview={onNeedsReview}
                    />
                </Suspense>
            </section>

            <section id="section-finish" className="mb-8 mt-12 scroll-mt-28 rounded-[1.5rem] border border-[var(--ath-line)] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[var(--ath-primary)]">
                            <ListChecks className="h-4 w-4" aria-hidden="true" />
                            <p className="editorial-kicker">Ready check</p>
                        </div>
                        <h2 className="mt-2 font-headline text-2xl font-semibold text-[var(--ath-text)]">Before the next section</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">
                            {readyCount}/3 evidence moves checked for this section.
                        </p>
                    </div>
                    <button
                        onClick={markCompleted}
                        disabled={isCompleted}
                        className={`flex shrink-0 items-center justify-center gap-2 rounded-[1rem] px-6 py-3 text-base font-semibold transition-all ${isCompleted
                            ? 'cursor-default border border-emerald-200 bg-emerald-100 text-emerald-700'
                            : 'editorial-button'
                            }`}
                    >
                        {isCompleted && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                        {isCompleted ? 'Section Completed' : completionReady ? 'Complete Section' : 'Mark as Complete'}
                    </button>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {READY_CHECK_ITEMS.map(([key, title, description]) => {
                        const inputId = `ready-check-${key}`
                        return (
                        <div
                            key={key}
                            className={`flex min-h-24 cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${readyChecks[key]
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-[var(--ath-line)] bg-[var(--ath-panel)] hover:bg-white'
                                }`}
                        >
                            <input
                                id={inputId}
                                type="checkbox"
                                checked={readyChecks[key]}
                                onChange={() => toggleReadyCheck(key)}
                                className="mt-1 h-4 w-4 rounded border-[var(--ath-line)] text-[var(--ath-primary)] focus:ring-[var(--ath-primary)]"
                            />
                            <span>
                                <label htmlFor={inputId} className="block cursor-pointer text-sm font-semibold text-[var(--ath-text)]">{title}</label>
                                <span className="mt-1 block text-xs leading-5 text-[var(--ath-muted)]">{description}</span>
                            </span>
                        </div>
                    )})}
                </div>
                <div className="mt-5 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <NotebookPen className="h-4 w-4 text-[var(--ath-primary)]" aria-hidden="true" />
                            <label htmlFor="section-exit-ticket" className="text-sm font-semibold text-[var(--ath-text)]">
                                Exit ticket
                            </label>
                        </div>
                        <span className={`text-xs font-semibold ${exitTicketReady ? 'text-emerald-700' : 'text-[var(--ath-muted)]'}`}>
                            {Math.min(exitTicketLength, EXIT_TICKET_MIN_CHARS)}/{EXIT_TICKET_MIN_CHARS} evidence trace
                        </span>
                    </div>
                    <textarea
                        id="section-exit-ticket"
                        value={exitTicket}
                        onChange={(event) => setExitTicketDraft({ sectionId, value: event.target.value })}
                        onBlur={handleExitTicketBlur}
                        rows={4}
                        placeholder="Claim + evidence + next move..."
                        className="mt-3 w-full resize-y rounded-xl border border-[var(--ath-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ath-text)] shadow-inner outline-none transition-colors placeholder:text-[var(--ath-muted)] focus:border-[var(--ath-primary)] focus:ring-2 focus:ring-[rgba(15,81,103,0.16)]"
                    />
                </div>
            </section>

            <div className="mb-4 grid gap-3 border-t border-[var(--ath-line)] pt-6 md:grid-cols-2">
                <button
                    type="button"
                    disabled={!previousSection}
                    onClick={() => previousSection && onNavigate?.(previousSection.chapter, previousSection.section, 'backward')}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${previousSection
                        ? 'border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:bg-[var(--ath-panel)]'
                        : 'cursor-not-allowed border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-muted)] opacity-60'
                        }`}
                >
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Previous</span>
                    <span className="mt-1 block text-sm font-semibold">{previousSection ? `${previousSection.chapter}.${previousSection.section} ${previousSection.title}` : 'Start of course'}</span>
                </button>
                <button
                    type="button"
                    disabled={!nextSection}
                    onClick={() => nextSection && onNavigate?.(nextSection.chapter, nextSection.section, 'forward')}
                    className={`rounded-2xl border px-4 py-3 text-right transition-colors ${nextSection
                        ? 'border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:bg-[var(--ath-panel)]'
                        : 'cursor-not-allowed border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-muted)] opacity-60'
                        }`}
                >
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Next</span>
                    <span className="mt-1 block text-sm font-semibold">{nextSection ? `${nextSection.chapter}.${nextSection.section} ${nextSection.title}` : 'End of course'}</span>
                </button>
            </div>
        </div>
    )
}

// Memoized so presence ticks in BookLayout don't re-render the whole reading
// surface; relies on the now-stable peerPulse/markCompleted props.
export default memo(ReadingPane)
