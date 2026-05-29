import { memo } from 'react'
import { Award, Check, Flame } from 'lucide-react'

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
        <section className="px-4 pt-4">
            <div className="rounded-[1.6rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="editorial-kicker">Chapter Passport</p>
                        <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--ath-text)]">
                            Collect chapter stamps
                        </h2>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ath-primary)] text-white shadow-sm">
                        <Award className="h-5 w-5" />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                    {chapterProgress.map((chapter) => {
                        const complete = chapter.progress.total > 0 && chapter.progress.completed === chapter.progress.total
                        const active = chapter.id === currentChapter

                        return (
                            <div
                                key={chapter.id}
                                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-center transition-all ${complete
                                    ? 'border-[color-mix(in_srgb,var(--ath-success)_35%,transparent)] bg-[var(--ath-success-soft)] text-[var(--ath-success)]'
                                    : active
                                        ? 'border-[var(--ath-primary-soft)] bg-[rgba(200,226,236,0.48)] text-[var(--ath-primary)]'
                                        : 'border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-muted)]'
                                    }`}
                                title={`Chapter ${chapter.id}: ${chapter.progress.completed}/${chapter.progress.total} sections`}
                            >
                                {complete ? (
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                    <span className="text-sm font-bold">{chapter.id}</span>
                                )}
                                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                                    {chapter.progress.percent}%
                                </span>
                            </div>
                        )
                    })}
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--ath-line)] bg-white/72 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ath-muted)]">
                        <span>Current chapter</span>
                        <span>{currentChapterProgress?.completed || 0}/{currentChapterProgress?.total || 0}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                        <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--ath-primary),var(--ath-accent))] transition-all"
                            style={{ width: `${currentChapterProgress?.percent || 0}%` }}
                        />
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--ath-panel)] px-3 py-2 text-xs font-semibold text-[var(--ath-muted)]">
                    <span className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-[var(--ath-primary)]" />
                        {totalCompleted} sections completed
                    </span>
                    <span>{stampedChapters}/{chapters.length || 0} stamps</span>
                </div>
            </div>
        </section>
    )
}

export default memo(ChapterPassport)
