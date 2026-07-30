import { memo } from 'react'
import { ChevronRight } from 'lucide-react'

function sectionKey(course, chapterId, sectionId) {
    return `${course}/${chapterId}/${sectionId}`
}

function getChapterProgress(course, chapter, completedSections = []) {
    const sections = chapter.sections || []
    const completed = sections.filter((section) =>
        completedSections.includes(sectionKey(course, chapter.id, section.id))
    ).length

    return {
        completed,
        total: sections.length,
        percent: sections.length > 0 ? Math.round((completed / sections.length) * 100) : 0
    }
}

function ChapterPassport({
    toc,
    currentCourse,
    currentChapter,
    completedSections = []
}) {
    const chapters = toc?.chapters || []
    const chapterProgress = chapters.map((chapter) => ({
        ...chapter,
        progress: getChapterProgress(currentCourse, chapter, completedSections)
    }))
    const stampedChapters = chapterProgress.filter((chapter) => chapter.progress.total > 0 && chapter.progress.completed === chapter.progress.total).length
    const currentChapterProgress = chapterProgress.find((chapter) => chapter.id === currentChapter)?.progress
    const totalCompleted = chapterProgress.reduce((sum, chapter) => sum + chapter.progress.completed, 0)

    return (
        <details className="ath-chapter-passport group px-3 pb-2 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="sr-only">Chapter Passport</span>
                <span className="sr-only">Collect chapter stamps</span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="editorial-kicker">Chapter progress</p>
                        <span className="text-xs font-semibold text-[var(--ath-secondary)]">
                            {currentChapterProgress?.completed || 0}/{currentChapterProgress?.total || 0}
                        </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden bg-[var(--ath-panel-muted)]">
                        <div
                            className="h-full rounded-full bg-[var(--ath-primary)] transition-all"
                            style={{ width: `${currentChapterProgress?.percent || 0}%` }}
                        />
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ath-primary)] transition-transform group-open:rotate-90" />
            </summary>

                <div className="mt-2 flex items-center justify-between border-t border-[var(--ath-line)] pt-2 text-[10px] font-semibold text-[var(--ath-muted)]">
                    <span>{totalCompleted} sections completed</span>
                    <span>{stampedChapters}/{chapters.length || 0} stamps</span>
                </div>
        </details>
    )
}

export default memo(ChapterPassport)
