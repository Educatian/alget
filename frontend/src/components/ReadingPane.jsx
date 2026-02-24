import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import PracticeBlock from './PracticeBlock'

export default function ReadingPane({ sectionData, loading, onStuckEvent }) {
    const [showSimulation, setShowSimulation] = useState(false)
    const [showIllustration, setShowIllustration] = useState(false)

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-lg">Loading section...</div>
            </div>
        )
    }

    if (!sectionData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-6xl mb-4">📚</div>
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
                <div className="text-sm text-[#9E1B32] font-medium mb-2">
                    Chapter {meta?.chapter} • Section {meta?.section}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    {meta?.title || 'Section Title'}
                </h1>

                {/* Learning Objectives */}
                {meta?.learning_objectives?.length > 0 && (
                    <div className="bg-linear-to-r from-blue-50 to-indigo-50/30 border-l-4 border-blue-500 rounded-r-xl p-5 shadow-inner">
                        <h3 className="text-sm font-bold text-blue-900 mb-2.5 uppercase tracking-wider">
                            🎯 Learning Objectives
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
            <article className="prose prose-lg max-w-none 
        prose-headings:text-gray-900 prose-headings:font-semibold
        prose-p:text-gray-600 prose-p:leading-relaxed
        prose-strong:text-[#9E1B32] prose-strong:font-semibold
        prose-em:text-gray-700
        prose-ul:text-gray-600 prose-li:my-1
        prose-blockquote:border-l-[#9E1B32] prose-blockquote:bg-gray-50 
        prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
        prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-gray-900 prose-pre:text-gray-100
        prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-3 prose-th:py-2
        prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-2
        mb-8"
            >
                <Markdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                >
                    {content || '*No content available*'}
                </Markdown>
            </article>

            {/* Embedded Blocks (Simulation/Illustration) */}
            {(simulation || illustration) && (
                <div className="space-y-4 mb-8">
                    {/* Simulation Block */}
                    {simulation && (
                        <div className="content-card overflow-hidden">
                            <button
                                onClick={() => setShowSimulation(!showSimulation)}
                                className="w-full flex items-center justify-between px-5 py-4 bg-linear-to-r from-slate-50 to-white hover:bg-slate-50 transition-colors"
                            >
                                <span className="flex items-center gap-3 font-bold text-slate-800">
                                    <span className="text-xl">🎮</span>
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
                                onClick={() => setShowIllustration(!showIllustration)}
                                className="w-full flex items-center justify-between px-5 py-4 bg-linear-to-r from-slate-50 to-white hover:bg-slate-50 transition-colors"
                            >
                                <span className="flex items-center gap-3 font-bold text-slate-800">
                                    <span className="text-xl">🖼️</span>
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
                        📌 Key Concepts
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

            {/* Divider */}
            <hr className="border-gray-200 my-8" />

            {/* Practice Block */}
            <PracticeBlock
                practice={practice}
                sectionId={`${meta?.course}/${meta?.chapter}/${meta?.section}`}
                onStuckEvent={onStuckEvent}
            />
        </div>
    )
}
