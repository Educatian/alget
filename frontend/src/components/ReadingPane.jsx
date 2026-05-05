import { Suspense, lazy, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { logInteraction } from '../lib/loggingService'
import PeerPulse from './PeerPulse'

const ReadingNarrative = lazy(() => import('./ReadingNarrative'))
const PracticeBlock = lazy(() => import('./PracticeBlock'))
const KnowledgeCheck = lazy(() => import('./KnowledgeCheck'))
const AffectiveReaction = lazy(() => import('./AffectiveReaction'))
const KnowledgeGraph = lazy(() => import('./KnowledgeGraph'))
const PerusallLayer = lazy(() => import('./PerusallLayer'))

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

export default function ReadingPane({
    sectionData,
    loading,
    onStuckEvent,
    onAskAi,
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
    const [showSimulation, setShowSimulation] = useState(false)
    const [showIllustration, setShowIllustration] = useState(false)
    const [showGraph, setShowGraph] = useState(false)

    const sectionId = sectionData?.meta ? `${sectionData.meta.course}/${sectionData.meta.chapter}/${sectionData.meta.section}` : null

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

    if (loading) {
        return (
            <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-4 text-center animate-fade-in">
                <div className="glow-orb h-64 w-64 bg-[rgba(15,81,103,0.14)]"></div>
                <div className="relative z-10">
                    <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] shadow-[0_20px_40px_rgba(15,23,42,0.1)]">
                        <span className="text-4xl font-semibold text-[var(--ath-primary)]">AL</span>
                    </div>

                    <p className="editorial-kicker">Reading Surface</p>
                    <h2 className="mt-3 text-3xl font-semibold text-[var(--ath-text)]">Warming the Learning Engine</h2>
                    <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-[var(--ath-muted)]">
                        Since this is your first visit in a while, the backend is spinning up. This usually takes about 30 to 60 seconds.
                    </p>

                    <div className="mx-auto mt-8 w-64 space-y-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                            <div className="h-full w-1/2 animate-[progress-indeterminate_2s_ease-in-out_infinite] rounded-full bg-[linear-gradient(90deg,var(--ath-primary),#4a7382,var(--ath-accent))]"></div>
                        </div>
                        <div className="flex justify-between px-1 text-xs font-semibold uppercase tracking-widest text-[var(--ath-secondary)]">
                            <span>Initializing</span>
                            <span>Running</span>
                        </div>
                    </div>
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

    return (
        <div className="mx-auto max-w-3xl px-8 py-10">
            <header className="mb-10">
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
                        <h1 className="editorial-title text-4xl leading-tight text-[var(--ath-text)]">
                            {meta?.title || 'Section Title'}
                        </h1>
                        {meta?.description && (
                            <p className="mt-4 max-w-3xl text-lg italic leading-8 text-[var(--ath-muted)]">
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
                        <button
                            onClick={() => setShowGraph(!showGraph)}
                            className="editorial-button-secondary px-4 py-2 text-sm"
                        >
                            {showGraph ? 'Hide Brain Network' : 'View Brain Network'}
                        </button>
                    </div>
                </div>

                {showGraph && (
                    <div className="mt-8 animate-fade-in origin-top">
                        <Suspense fallback={<PanelFallback label="Loading Brain Network..." />}>
                            <KnowledgeGraph
                                course={meta?.course || 'inst-design'}
                                currentSectionId={sectionId}
                                currentConceptIds={meta?.concept_ids || []}
                            />
                        </Suspense>
                    </div>
                )}

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

                <div className="mt-8 rounded-[1.8rem] border border-[var(--ath-line)] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="editorial-kicker">Work Product Pathway</p>
                            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ath-text)]">{workProduct}</h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                                This section is organized as a checkpoint toward a concrete deliverable: read, annotate evidence, draft, judge AI feedback, revise, and log the trace.
                            </p>
                        </div>
                        <div className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${isCompleted
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-secondary)]'
                            }`}>
                            {isCompleted ? 'Checkpoint done' : 'Checkpoint open'}
                        </div>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-5">
                        {['Read', 'Annotate', 'Draft', 'Judge AI', 'Revise'].map((step, index) => (
                            <div key={step} className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Step {index + 1}</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="editorial-kicker">Returning Learner Check-In</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                                {canResumeRecent
                                    ? `Last visited ${recentSection.chapter}.${recentSection.section} ${recentSection.title || 'previous section'} on ${formatRecentTimestamp(recentSection.updatedAt)}.`
                                    : isCompleted
                                        ? 'This checkpoint is complete. Use the next section when you are ready to extend the work product.'
                                        : 'Resume here by checking the pathway, annotating one evidence claim, judging AI feedback, and revising the Work Product Studio trace.'}
                            </p>
                        </div>
                        {canResumeRecent ? (
                            <button
                                type="button"
                                onClick={() => onNavigate?.(recentSection.chapter, recentSection.section, 'backward')}
                                className="editorial-button-secondary shrink-0 px-4 py-2 text-sm"
                            >
                                Resume Last Section
                            </button>
                        ) : (
                            <span className="editorial-chip shrink-0">{isCompleted ? 'Ready for transfer' : 'Next: judge AI + revise'}</span>
                        )}
                    </div>
                </div>
            </header>

            <Suspense fallback={<PanelFallback label="Loading Reading Narrative..." />}>
                <ReadingNarrative
                    content={content}
                    sectionId={sectionId}
                    course={sectionData?.meta?.course}
                    conceptIds={sectionData?.meta?.concept_ids || []}
                    sectionDescription={sectionData?.meta?.description}
                    onAskAi={onAskAi}
                    onHeadingChange={(heading) => {
                        onHeadingChange?.(heading)
                    }}
                />
            </Suspense>

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

            <div className="editorial-divider my-10"></div>

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

            <div className="editorial-divider my-10"></div>

            <Suspense fallback={<PanelFallback label="Loading Practice..." />}>
                <PracticeBlock
                    practice={practice}
                    sectionId={`${meta?.course}/${meta?.chapter}/${meta?.section}`}
                    onStuckEvent={onStuckEvent}
                    onNeedsReview={onNeedsReview}
                />
            </Suspense>

            <div className="mb-8 mt-12 flex justify-center">
                <button
                    onClick={markCompleted}
                    disabled={isCompleted}
                    className={`flex items-center gap-3 rounded-[1rem] px-8 py-3.5 text-lg font-semibold transition-all ${isCompleted
                        ? 'cursor-default border border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'editorial-button'
                        }`}
                >
                    {isCompleted ? 'Section Completed' : 'Mark as Complete'}
                </button>
            </div>

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
