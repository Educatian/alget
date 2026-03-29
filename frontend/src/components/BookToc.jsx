import { useMemo, useState } from 'react'

function getCourseSummary(chapters = []) {
    const sectionCount = chapters.reduce((count, chapter) => count + (chapter.sections?.length || 0), 0)
    return {
        chapterCount: chapters.length,
        sectionCount
    }
}

export default function BookToc({ toc, currentCourse, currentChapter, currentSection, onNavigate, completedSections }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedChapters, setExpandedChapters] = useState([currentChapter])

    const toggleChapter = (chapterId) => {
        setExpandedChapters((previous) =>
            previous.includes(chapterId)
                ? previous.filter((item) => item !== chapterId)
                : [...previous, chapterId]
        )
    }

    const filteredChapters = useMemo(() => {
        const chapters = toc?.chapters || []

        if (!searchQuery.trim()) {
            return chapters
        }

        const query = searchQuery.toLowerCase()
        return chapters
            .map((chapter) => {
                const matchesChapter = chapter.title.toLowerCase().includes(query)
                const filteredSections = matchesChapter
                    ? chapter.sections || []
                    : (chapter.sections || []).filter((section) => section.title.toLowerCase().includes(query))

                if (!matchesChapter && filteredSections.length === 0) {
                    return null
                }

                return {
                    ...chapter,
                    sections: filteredSections
                }
            })
            .filter(Boolean)
    }, [searchQuery, toc?.chapters])

    const summary = getCourseSummary(toc?.chapters || [])

    return (
        <div className="p-4">
            <div className="mb-4 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Course Navigation</p>
                <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
                    {toc?.title || 'Table of Contents'}
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Chapters</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{summary.chapterCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Sections</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{summary.sectionCount}</p>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search chapters or sections"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm shadow-sm outline-none transition-all focus:border-[#9E1B32] focus:ring-2 focus:ring-[#9E1B32]/10"
                />
            </div>

            {!toc && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
                    Loading course structure...
                </div>
            )}

            <nav className="space-y-2">
                {filteredChapters.map((chapter) => (
                    <div key={chapter.id} className="overflow-hidden rounded-2xl border border-white/70 bg-white/65 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                        <button
                            onClick={() => toggleChapter(chapter.id)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50/90"
                        >
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                    Chapter {chapter.id}
                                </p>
                                <p className="truncate text-sm font-semibold text-slate-800">{chapter.title}</p>
                            </div>
                            <span className={`text-slate-400 transition-transform ${expandedChapters.includes(chapter.id) ? 'rotate-90' : ''}`}>
                                ▶
                            </span>
                        </button>

                        {expandedChapters.includes(chapter.id) && (
                            <ul className="space-y-1 border-t border-slate-100 px-2 py-2">
                                {chapter.sections?.map((section) => {
                                    const isActive = currentChapter === chapter.id && currentSection === section.id
                                    const isDone = completedSections?.includes(`${currentCourse}/${chapter.id}/${section.id}`)

                                    return (
                                        <li key={section.id}>
                                            <button
                                                onClick={() => onNavigate(chapter.id, section.id)}
                                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all ${isActive
                                                    ? 'bg-[#9E1B32] text-white shadow-md shadow-red-900/20'
                                                    : 'text-slate-600 hover:bg-slate-100/80'
                                                    }`}
                                            >
                                                <span className="line-clamp-2">
                                                    {chapter.id}.{section.id} {section.title}
                                                </span>
                                                {isDone && (
                                                    <span className={`ml-2 shrink-0 text-xs font-bold ${isActive ? 'text-white' : 'text-emerald-500'}`}>
                                                        Done
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                ))}
            </nav>

            {filteredChapters.length === 0 && searchQuery && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
                    No sections matched "{searchQuery}".
                </div>
            )}
        </div>
    )
}
