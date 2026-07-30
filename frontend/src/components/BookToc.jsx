import { memo, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'

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

function BookToc({ toc, currentCourse, currentChapter, currentSection, onNavigate, completedSections }) {
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
        <div className="px-3 pb-5 pt-2">
            <div className="px-1">
                <p className="editorial-kicker">Course Navigation</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--ath-text)]">
                    {toc?.title || 'Table of Contents'}
                </h2>
                <div className="mt-1 flex gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ath-muted)]">
                    <span>{summary.chapterCount} chapters</span>
                    <span aria-hidden="true">·</span>
                    <span>{summary.sectionCount} sections</span>
                </div>
            </div>

            <div className="mt-3 border-b border-[var(--ath-line)]">
                <input
                    type="text"
                    placeholder="Search chapters or sections"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full border-0 bg-transparent px-1 py-2 text-sm text-[var(--ath-text)] outline-none placeholder:text-[var(--ath-muted)] focus-visible:ring-0"
                />
            </div>

            {!toc && (
                <div className="mt-4 rounded-[var(--ath-radius-xl)] border border-dashed border-[var(--ath-line)] bg-[rgba(255,255,255,0.56)] px-4 py-8 text-center text-sm text-[var(--ath-secondary)]">
                    Loading course structure...
                </div>
            )}

            <nav className="mt-2">
                {filteredChapters.map((chapter) => (
                    <div key={chapter.id} className="overflow-hidden">
                        <button
                            onClick={() => toggleChapter(chapter.id)}
                            className="flex w-full items-center justify-between px-1 py-2.5 text-left transition-colors hover:text-[var(--ath-primary)]"
                        >
                            <div className="min-w-0">
                                <p className="editorial-label">Chapter {chapter.id}</p>
                                <p className="truncate text-base font-semibold text-[var(--ath-text)]">{chapter.title}</p>
                            </div>
                            <ChevronRight
                                className={`h-4 w-4 shrink-0 text-[var(--ath-secondary)] transition-transform ${expandedChapters.includes(chapter.id) ? 'rotate-90' : ''}`}
                                aria-hidden="true"
                            />
                        </button>

                        {expandedChapters.includes(chapter.id) && (
                            <ul className="mb-2 space-y-0.5 border-l border-[var(--ath-line)] pl-2">
                                {chapter.sections?.map((section) => {
                                    const isActive = currentChapter === chapter.id && currentSection === section.id
                                    const isDone = completedSections?.includes(`${currentCourse}/${chapter.id}/${section.id}`)

                                    return (
                                        <li key={section.id}>
                                            <button
                                                onClick={() => onNavigate(chapter.id, section.id)}
                                                className={`relative flex min-h-[40px] w-full items-center justify-between px-2.5 py-2 text-left text-sm transition-colors sm:min-h-0 ${isActive
                                                    ? 'bg-[color-mix(in_srgb,var(--ath-primary-soft)_58%,transparent)] font-semibold text-[var(--ath-primary-deep)] before:absolute before:-left-[3px] before:inset-y-1.5 before:w-0.5 before:rounded-full before:bg-[var(--ath-primary)]'
                                                    : 'text-[var(--ath-muted)] hover:bg-[color-mix(in_srgb,var(--ath-panel)_55%,transparent)] hover:text-[var(--ath-text)]'
                                                    }`}
                                            >
                                                <span className="line-clamp-2">
                                                    {chapter.id}.{section.id} {section.title}
                                                </span>
                                                {isDone && (
                                                    <span className="ml-2 shrink-0 text-[10px] font-bold text-[var(--ath-success)]">
                                                        <span aria-hidden="true">✓</span>
                                                        <span className="sr-only">Done</span>
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
                <div className="mt-4 rounded-[var(--ath-radius-xl)] border border-dashed border-[var(--ath-line)] bg-[rgba(255,255,255,0.56)] px-4 py-8 text-center text-sm text-[var(--ath-secondary)]">
                    No sections matched "{searchQuery}".
                </div>
            )}
        </div>
    )
}

export default memo(BookToc)
