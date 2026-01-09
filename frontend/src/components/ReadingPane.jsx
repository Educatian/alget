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
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-blue-800 mb-2">
                            🎯 Learning Objectives
                        </h3>
                        <ul className="space-y-1">
                            {meta.learning_objectives.map((obj, i) => (
                                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                                    <span className="text-blue-400">•</span>
                                    <span>{obj}</span>
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
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setShowSimulation(!showSimulation)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <span className="flex items-center gap-2 font-medium text-gray-700">
                                    <span className="text-lg">🎮</span>
                                    Interactive Simulation
                                </span>
                                <span className={`text-gray-400 transition-transform ${showSimulation ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </button>

                            {showSimulation && (
                                <div className="p-4 border-t border-gray-200">
                                    <p className="text-sm text-gray-500 mb-3">{simulation.description}</p>
                                    <iframe
                                        srcDoc={simulation.html_code}
                                        className="w-full h-[400px] rounded-lg border border-gray-200"
                                        sandbox="allow-scripts"
                                        title="Interactive Simulation"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Illustration Block */}
                    {illustration && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setShowIllustration(!showIllustration)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <span className="flex items-center gap-2 font-medium text-gray-700">
                                    <span className="text-lg">🖼️</span>
                                    Concept Illustration
                                </span>
                                <span className={`text-gray-400 transition-transform ${showIllustration ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </button>

                            {showIllustration && (
                                <div className="p-4 border-t border-gray-200">
                                    <div className="bg-gray-100 rounded-lg p-6 text-center">
                                        <p className="text-gray-600">{illustration.description}</p>
                                        {illustration.image_url && (
                                            <img
                                                src={illustration.image_url}
                                                alt={illustration.description}
                                                className="mt-4 mx-auto max-w-full rounded-lg"
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
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        📌 Key Concepts
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {meta.concept_ids.map((concept, i) => (
                            <span
                                key={i}
                                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full border border-gray-200"
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
