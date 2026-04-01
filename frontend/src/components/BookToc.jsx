import { useMemo, useState } from 'react'

const KNOWN_CHAPTER_TITLES = {
    'bio-inspired': {
        '01': 'Structural Biomimicry',
        '02': 'Locomotion & Kinematics',
        '03': 'Thermoregulation',
        '04': 'Dry Adhesion and Contact Mechanics',
        '05': 'Structural Color and Optical Surfaces',
        '06': 'Thermal Regulation and Environmental Control',
        '07': 'Resilience and Material Repair',
        '08': 'Swarm Intelligence and Distributed Systems'
    }
}

function resolveChapterTitle(currentCourse, chapter) {
    const explicitTitle = chapter?.title?.trim?.()
    if (explicitTitle) return explicitTitle
    return KNOWN_CHAPTER_TITLES[currentCourse]?.[chapter?.id] || `Chapter ${chapter?.id || ''}`.trim()
}

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
                const chapterTitle = resolveChapterTitle(currentCourse, chapter)
                const matchesChapter = chapterTitle.toLowerCase().includes(query)
                const filteredSections = matchesChapter
                    ? chapter.sections || []
                    : (chapter.sections || []).filter((section) => section.title.toLowerCase().includes(query))

                if (!matchesChapter && filteredSections.length === 0) {
                    return null
                }

                return {
                    ...chapter,
                    title: chapterTitle,
                    sections: filteredSections
                }
            })
            .filter(Boolean)
    }, [currentCourse, searchQuery, toc?.chapters])

    const summary = getCourseSummary(toc?.chapters || [])

    return (
        <div className="p-4">
            <div className="rounded-[2rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.64)] p-5 shadow-sm">
                <p className="editorial-kicker">Course Navigation</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ath-text)]">
                    {toc?.title || 'Table of Contents'}
                </h2>
                <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[1.4rem] bg-[var(--ath-panel)] px-3 py-3">
                        <p className="editorial-label">Chapters</p>
                        <p className="mt-2 text-2xl font-semibold text-[var(--ath-text)]">{summary.chapterCount}</p>
                    </div>
                    <div className="rounded-[1.4rem] bg-[var(--ath-panel)] px-3 py-3">
                        <p className="editorial-label">Sections</p>
                        <p className="mt-2 text-2xl font-semibold text-[var(--ath-text)]">{summary.sectionCount}</p>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <input
                    type="text"
                    placeholder="Search chapters or sections"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="editorial-input text-sm"
                />
            </div>

            {!toc && (
                <div className="mt-4 rounded-[1.6rem] border border-dashed border-[var(--ath-line)] bg-[rgba(255,255,255,0.56)] px-4 py-8 text-center text-sm text-[var(--ath-secondary)]">
                    Loading course structure...
                </div>
            )}

            <nav className="mt-4 space-y-2">
                {filteredChapters.map((chapter) => (
                    <div key={chapter.id} className="overflow-hidden rounded-[1.6rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.62)] shadow-sm">
                        <button
                            onClick={() => toggleChapter(chapter.id)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.62)]"
                        >
                            <div className="min-w-0">
                                <p className="editorial-label">Chapter {chapter.id}</p>
                                <p className="truncate text-base font-semibold text-[var(--ath-text)]">{chapter.title}</p>
                            </div>
                            <span className={`text-[var(--ath-secondary)] transition-transform ${expandedChapters.includes(chapter.id) ? 'rotate-90' : ''}`}>
                                ▶
                            </span>
                        </button>

                        {expandedChapters.includes(chapter.id) && (
                            <ul className="space-y-1 border-t border-[var(--ath-line)] px-2 py-2">
                                {chapter.sections?.map((section) => {
                                    const isActive = currentChapter === chapter.id && currentSection === section.id
                                    const isDone = completedSections?.includes(`${currentCourse}/${chapter.id}/${section.id}`)

                                    return (
                                        <li key={section.id}>
                                            <button
                                                onClick={() => onNavigate(chapter.id, section.id)}
                                                className={`flex w-full items-center justify-between rounded-[1rem] px-3 py-2.5 text-left text-sm transition-all ${isActive
                                                    ? 'bg-[linear-gradient(135deg,var(--ath-primary),var(--ath-primary-deep))] text-white shadow-[0_16px_30px_rgba(9,56,72,0.18)]'
                                                    : 'text-[var(--ath-muted)] hover:bg-[var(--ath-panel)]'
                                                    }`}
                                            >
                                                <span className="line-clamp-2">
                                                    {chapter.id}.{section.id} {section.title}
                                                </span>
                                                {isDone && (
                                                    <span className={`ml-2 shrink-0 text-xs font-bold ${isActive ? 'text-white' : 'text-emerald-600'}`}>
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
                <div className="mt-4 rounded-[1.6rem] border border-dashed border-[var(--ath-line)] bg-[rgba(255,255,255,0.56)] px-4 py-8 text-center text-sm text-[var(--ath-secondary)]">
                    No sections matched "{searchQuery}".
                </div>
            )}
        </div>
    )
}
