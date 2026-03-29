import { Suspense, lazy, useState } from 'react'
import { logInteraction } from '../lib/loggingService'

const ReadingNarrative = lazy(() => import('./ReadingNarrative'))
const PracticeBlock = lazy(() => import('./PracticeBlock'))
const KnowledgeCheck = lazy(() => import('./KnowledgeCheck'))
const AffectiveReaction = lazy(() => import('./AffectiveReaction'))
const KnowledgeGraph = lazy(() => import('./KnowledgeGraph'))

function PanelFallback({ label }) {
    return (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white/75 p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
        </div>
    )
}

export default function ReadingPane({
    sectionData,
    loading,
    onStuckEvent,
    onAskAi,
    isCompleted,
    markCompleted,
    onHeadingChange
}) {
    const [showSimulation, setShowSimulation] = useState(false)
    const [showIllustration, setShowIllustration] = useState(false)
    const [showGraph, setShowGraph] = useState(false)

    // Section ID computation
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
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] animate-fade-in relative overflow-hidden text-center px-4">
                {/* Background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#9E1B32]/10 rounded-full blur-2xl"></div>

                <div className="relative z-10">
                    {/* Animated Engine Icon */}
                    <div className="w-20 h-20 mx-auto mb-8 bg-white/50 backdrop-blur-md border border-white/60 shadow-xl rounded-2xl flex items-center justify-center relative shadow-indigo-900/10 drop-shadow-xl overflow-hidden">
                        <span className="text-4xl relative z-10 origin-center animate-[spin_4s_linear_infinite]">AL</span>
                        <div className="absolute inset-0 bg-linear-to-tr from-[#9E1B32]/10 to-indigo-500/10 animate-pulse"></div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">
                        Waking up the AI Engine...
                    </h2>

                    <p className="text-slate-500 max-w-sm mx-auto mb-8 text-[15px] leading-relaxed font-medium">
                        Since this is your first visit in a while, our backend is spinning up. This usually takes about <span className="text-indigo-600 font-semibold">30 to 60 seconds</span>.
                    </p>

                    {/* Progress indicator */}
                    <div className="w-64 mx-auto space-y-2">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-linear-to-r from-indigo-500 via-[#9E1B32] to-[#ff4d6d] w-1/2 rounded-full animate-[progress-indeterminate_2s_ease-in-out_infinite] shadow-[0_0_10px_rgba(158,27,50,0.5)]"></div>
                        </div>
                        <div className="flex justify-between text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
                            <span>Initializing</span>
                            <span className="text-[#9E1B32] animate-pulse">Running</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!sectionData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="mb-4 text-5xl font-bold text-slate-300">AL</div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Section Not Found</h2>
                    <p className="text-gray-500">Select a section from the table of contents.</p>
                </div>
            </div>
        )
    }

    const { meta, content, simulation, illustration, practice } = sectionData

    return (
        <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Section Header */}
            <header className="mb-8">
                <div className="text-sm text-[#9E1B32] font-medium mb-2 flex items-center justify-between">
                    <span>Chapter {meta?.chapter} • Section {meta?.section}</span>
                    {meta?.estimated_time_minutes && (
                        <span className="text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-inner">
                            ⏱️ {meta.estimated_time_minutes} min read
                        </span>
                    )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4 flex items-center justify-between">
                    <span>{meta?.title || 'Section Title'}</span>
                    <button
                        onClick={() => setShowGraph(!showGraph)}
                        className={`text-sm px-4 py-2 rounded-lg font-bold border transition-colors ${showGraph ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        {showGraph ? 'Hide Brain Network' : 'View Brain Network'}
                    </button>
                </h1>

                {/* Knowledge Graph Overlay */}
                {showGraph && (
                    <div className="mb-8 animate-fade-in origin-top">
                        <Suspense fallback={<PanelFallback label="Loading brain network..." />}>
                            <KnowledgeGraph
                                course={meta?.course || 'inst-design'}
                                currentSectionId={sectionId}
                                currentConceptIds={meta?.concept_ids || []}
                            />
                        </Suspense>
                    </div>
                )}

                {/* Learning Objectives */}
                {meta?.learning_objectives?.length > 0 && (
                    <div className="bg-linear-to-r from-blue-50 to-indigo-50/30 border-l-4 border-blue-500 rounded-r-xl p-5 shadow-inner">
                        <h3 className="text-sm font-bold text-blue-900 mb-2.5 uppercase tracking-wider">
                            Learning Objectives
                        </h3>
                        <ul className="space-y-2">
                            {meta.learning_objectives.map((obj, i) => (
                                <li key={i} className="text-[1.05rem] text-blue-800/90 flex items-start gap-3 font-medium">
                                    <span className="text-blue-500 mt-0.5 opacity-80">•</span>
                                    <span className="leading-relaxed">{obj}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </header>

            {/* Main Content (Narrative) with LaTeX Support */}
            <Suspense fallback={<PanelFallback label="Loading reading narrative..." />}>
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

            {/* Embedded Blocks (Simulation/Illustration) */}
            {(simulation || illustration) && (
                <div className="space-y-4 mb-8">
                    {/* Simulation Block */}
                    {simulation && (
                        <div className="content-card overflow-hidden">
                            <button
                                onClick={handleToggleSimulation}
                                className="w-full flex items-center justify-between px-5 py-4 bg-linear-to-r from-slate-50 to-white hover:bg-slate-50 transition-colors"
                            >
                                <span className="flex items-center gap-3 font-bold text-slate-800">
                                    <span className="text-xl">SIM</span>
                                    Interactive Simulation
                                </span>
                                <span className={`text-slate-400 transition-transform duration-300 ${showSimulation ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </button>

                            {showSimulation && (
                                <div className="p-5 border-t border-slate-100 bg-linear-to-b from-slate-50/50 to-white animate-fade-in">
                                    <p className="text-sm font-medium text-slate-500 mb-4">{simulation.description}</p>
                                    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-white">
                                        <iframe
                                            srcDoc={simulation.html_code}
                                            className="w-full h-[450px]"
                                            sandbox="allow-scripts"
                                            title="Interactive Simulation"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Illustration Block */}
                    {illustration && (
                        <div className="content-card overflow-hidden">
                            <button
                                onClick={handleToggleIllustration}
                                className="w-full flex items-center justify-between px-5 py-4 bg-linear-to-r from-slate-50 to-white hover:bg-slate-50 transition-colors"
                            >
                                <span className="flex items-center gap-3 font-bold text-slate-800">
                                    <span className="text-xl">VIS</span>
                                    Concept Illustration
                                </span>
                                <span className={`text-slate-400 transition-transform duration-300 ${showIllustration ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </button>

                            {showIllustration && (
                                <div className="p-5 border-t border-slate-100 bg-white animate-fade-in">
                                    <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center shadow-inner">
                                        <p className="text-slate-700 font-medium text-lg leading-relaxed">{illustration.description}</p>
                                        {illustration.image_url && (
                                            <img
                                                src={illustration.image_url}
                                                alt={illustration.description}
                                                className="mt-6 mx-auto max-w-full rounded-xl shadow-lg ring-1 ring-black/5"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Concept Tags */}
            {meta?.concept_ids?.length > 0 && (
                <div className="mb-10">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                        Key Concepts
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                        {meta.concept_ids.map((concept, i) => (
                            <span
                                key={i}
                                className="px-4 py-1.5 bg-white text-slate-700 text-sm font-semibold rounded-full border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default"
                            >
                                {concept.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Affective Telemetry */}
            <Suspense fallback={<PanelFallback label="Loading reflection tools..." />}>
                <AffectiveReaction
                    sectionId={sectionId}
                    conceptIds={meta?.concept_ids}
                />
            </Suspense>

            {/* Divider */}
            <hr className="border-gray-200 my-8" />

            {/* Knowledge Check (Formative Assessment) */}
            <Suspense fallback={<PanelFallback label="Loading knowledge check..." />}>
                <KnowledgeCheck
                    bioContext={content}
                    engContext={meta?.description}
                    sectionTitle={meta?.title}
                    learningObjectives={meta?.learning_objectives}
                    conceptIds={meta?.concept_ids}
                />
            </Suspense>

            {/* Divider */}
            <hr className="border-gray-200 my-8" />

            {/* Practice Block */}
            <Suspense fallback={<PanelFallback label="Loading practice..." />}>
                <PracticeBlock
                    practice={practice}
                    sectionId={`${meta?.course}/${meta?.chapter}/${meta?.section}`}
                    onStuckEvent={onStuckEvent}
                />
            </Suspense>

            {/* Mark as read button */}
            <div className="mt-12 mb-8 flex justify-center">
                <button
                    onClick={markCompleted}
                    disabled={isCompleted}
                    className={`px-8 py-3.5 rounded-xl text-lg font-bold flex items-center gap-3 transition-all ${isCompleted
                        ? 'bg-emerald-100 text-emerald-700 cursor-default ring-1 ring-emerald-200'
                        : 'bg-linear-to-r from-[#9E1B32] to-[#c72240] text-white hover:from-[#7A1527] hover:to-[#9E1B32] shadow-lg shadow-red-900/20 hover:shadow-xl hover:-translate-y-0.5'
                        }`}
                >
                    {isCompleted ? (
                        <>
                            <span className="text-xl">Done</span> Section Completed
                        </>
                    ) : (
                        <>
                            <span className="text-xl">Read</span> Mark as Complete
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
