import { Suspense, lazy, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import BookToc from '../components/BookToc'
import { logPageView, logStuckEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'
import { useCourseProgress } from '../hooks/useCourseProgress'
import { useSocialPresence } from '../hooks/useSocialPresence'
import API_BASE from '../lib/apiConfig'
import '../index.css'

const ReadingPane = lazy(() => import('../components/ReadingPane'))
const IntelRail = lazy(() => import('../components/IntelRail'))
const ChatWidget = lazy(() => import('../components/ChatWidget'))
const HighlightableContent = lazy(() => import('../components/HighlightableContent'))
const SettingsModal = lazy(() => import('../components/SettingsModal'))
const SocialPresencePanel = lazy(() => import('../components/SocialPresencePanel'))

function formatCourseLabel(course) {
    return course
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function SurfaceFallback({ label, compact = false }) {
    return (
        <div className={`rounded-[2rem] border border-white/70 bg-white/75 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${compact ? 'p-4' : 'p-6'}`}>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <div className={`mt-4 animate-pulse rounded-2xl bg-slate-100 ${compact ? 'h-24' : 'h-40'}`} />
        </div>
    )
}

export default function BookLayout({ user, onLogout }) {
    const { course = 'statics', chapter = '01', section = '01' } = useParams()
    const navigate = useNavigate()
    const { completedSections, markCompleted, isCompleted, progressStats } = useCourseProgress(user)
    const sectionPath = `${course}/${chapter}/${section}`

    const [toc, setToc] = useState(null)
    const [sectionData, setSectionData] = useState(null)
    const [loadedSectionPath, setLoadedSectionPath] = useState('')
    const [railOpen, setRailOpen] = useState(false)
    const [railContext, setRailContext] = useState(null)
    const [stuckEvent, setStuckEvent] = useState(null)
    const [highlightQuestion, setHighlightQuestion] = useState(null)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [transitionDirection, setTransitionDirection] = useState('forward')
    const [activeHeading, setActiveHeading] = useState('Introduction')
    const chatWidgetRef = useRef(null)
    const mainScrollRef = useRef(null)
    const loading = loadedSectionPath !== sectionPath

    const flatSections = useMemo(() => {
        if (!toc?.chapters) return []

        return toc.chapters.flatMap((tocChapter) =>
            (tocChapter.sections || []).map((tocSection) => ({
                chapter: tocChapter.id,
                section: tocSection.id,
                title: tocSection.title,
                chapterTitle: tocChapter.title
            }))
        )
    }, [toc])

    const currentSectionIndex = useMemo(
        () => flatSections.findIndex((item) => item.chapter === chapter && item.section === section),
        [flatSections, chapter, section]
    )

    const previousSection = currentSectionIndex > 0 ? flatSections[currentSectionIndex - 1] : null
    const nextSection = currentSectionIndex >= 0 && currentSectionIndex < flatSections.length - 1
        ? flatSections[currentSectionIndex + 1]
        : null
    const sectionPosition = Math.max(currentSectionIndex + 1, 1)
    const completedCount = progressStats?.totalCompleted || 0
    const socialState = useSocialPresence({
        user,
        sectionId: sectionPath,
        sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
        course,
        heading: activeHeading,
        focusConcept: sectionData?.meta?.concept_ids?.[0] || null
    })

    useEffect(() => {
        fetch(`${API_BASE}/book/${course}/toc`)
            .then((res) => res.json())
            .then(setToc)
            .catch(console.error)
    }, [course])

    useEffect(() => {
        let cancelled = false

        logPageView(sectionPath)
        recordAdaptiveSignal(sectionPath, 'page_view')

        fetch(`${API_BASE}/book/${course}/${chapter}/${section}`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return
                setSectionData(data)
                setLoadedSectionPath(sectionPath)
            })
            .catch((error) => {
                if (cancelled) return
                console.error(error)
                setSectionData(null)
                setLoadedSectionPath(sectionPath)
            })

        return () => {
            cancelled = true
        }
    }, [course, chapter, section, sectionPath])

    useEffect(() => {
        if (!mainScrollRef.current) return
        if (typeof mainScrollRef.current.scrollTo === 'function') {
            mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            mainScrollRef.current.scrollTop = 0
        }
    }, [sectionPath])

    const handleNavigate = useCallback((nextChapter, nextSection, direction = 'forward') => {
        setTransitionDirection(direction)
        setStuckEvent(null)
        setRailContext(null)
        setRailOpen(false)
        navigate(`/book/${course}/${nextChapter}/${nextSection}`)
    }, [course, navigate])

    const handleStuckEvent = (event) => {
        setStuckEvent(event)
        setRailContext({
            type: 'stuck',
            sectionId: sectionPath,
            problemId: event.problemId,
            reason: event.reason
        })
        setRailOpen(true)
        logStuckEvent(event.problemId, event.reason, 0, sectionPath)
        recordAdaptiveSignal(sectionPath, 'stuck_event', {
            problemId: event.problemId,
            reason: event.reason
        })
        void socialState.recordHelpOpen()
    }

    const toggleRail = () => {
        if (!railOpen) {
            recordAdaptiveSignal(sectionPath, 'manual_help_open')
            void socialState.recordHelpOpen()
        }
        setRailOpen((current) => !current)
    }

    useEffect(() => {
        const handleKeyNavigation = (event) => {
            const activeTag = document.activeElement?.tagName
            const isEditable = document.activeElement?.isContentEditable

            if (isEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(activeTag)) {
                return
            }

            if (event.key === 'ArrowLeft' && previousSection) {
                event.preventDefault()
                handleNavigate(previousSection.chapter, previousSection.section, 'backward')
            }

            if (event.key === 'ArrowRight' && nextSection) {
                event.preventDefault()
                handleNavigate(nextSection.chapter, nextSection.section, 'forward')
            }
        }

        window.addEventListener('keydown', handleKeyNavigation)
        return () => window.removeEventListener('keydown', handleKeyNavigation)
    }, [handleNavigate, nextSection, previousSection])

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(158,27,50,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] flex flex-col font-sans selection:bg-[#9E1B32]/20">
            {isSettingsOpen && (
                <Suspense fallback={<div className="fixed inset-0 z-[100] bg-slate-950/10 backdrop-blur-sm" />}>
                    <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
                </Suspense>
            )}

            <header className="sticky top-0 z-50 border-b border-white/70 bg-white/70 px-6 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-3xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-xl font-bold text-white shadow-lg shadow-red-900/20 ring-1 ring-white/20">
                            AL
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Alabama Generative Intelligent Textbook</p>
                            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">Learning Workspace</h1>
                            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                {formatCourseLabel(course)} · Chapter {chapter} · Section {section}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                            <span className="text-slate-400">Section</span>{' '}
                            <span className="text-slate-900">{sectionPosition}/{flatSections.length || 1}</span>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                            <span className="text-slate-400">Completed</span>{' '}
                            <span className="text-slate-900">{completedCount}</span>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${progressStats?.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                            {progressStats?.syncStatus === 'synced' ? 'Cloud sync on' : 'Saving progress'}
                        </div>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                            {sectionData?.meta?.title || sectionData?.title || 'Loading section...'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                            {sectionData?.meta?.description || sectionData?.meta?.chapter_title || 'Guided reading, practice, social presence, and adaptive support.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Popover.Root>
                            <Popover.Trigger asChild>
                                <button
                                    type="button"
                                    className="hidden xl:flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1.5 shadow-sm transition-all hover:bg-white hover:shadow-md"
                                    aria-label="Open social presence"
                                >
                                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${socialState.connected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                    <div className="flex -space-x-2">
                                        {socialState.peers.slice(0, 3).map((peer) => (
                                            <span
                                                key={peer.key}
                                                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-linear-to-br ${peer.colorToken || 'from-slate-500 to-slate-400'} text-[10px] font-bold text-white shadow-sm`}
                                                title={peer.alias}
                                            >
                                                {peer.alias?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                                            </span>
                                        ))}
                                        {socialState.peers.length === 0 && (
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500 shadow-sm">
                                                0
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-600">
                                        {socialState.peers.length > 0 ? `${socialState.peers.length} here now` : 'Live'}
                                    </span>
                                </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content
                                    side="bottom"
                                    align="end"
                                    sideOffset={12}
                                    className="z-[90] w-[26rem] rounded-3xl border border-white/70 bg-white/95 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
                                >
                                    <Suspense fallback={<SurfaceFallback label="Loading social presence..." compact />}>
                                        <SocialPresencePanel
                                            connected={socialState.connected}
                                            peers={socialState.peers}
                                            sameHeadingPeers={socialState.sameHeadingPeers}
                                            sameConceptPeers={socialState.sameConceptPeers}
                                            signalSummary={socialState.signalSummary}
                                            liveFeed={socialState.liveFeed}
                                            onReaction={socialState.sendReaction}
                                            sectionTitle={sectionData?.meta?.title || sectionData?.title || ''}
                                        />
                                    </Suspense>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>

                        <button
                            onClick={toggleRail}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${railOpen
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'
                                }`}
                        >
                            {railOpen ? 'Close Help' : 'Get Help'}
                        </button>

                        <div className="h-8 w-px bg-slate-200"></div>

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/50 text-slate-400 shadow-sm transition-all hover:bg-indigo-50 hover:text-indigo-600"
                            title="API Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => navigate('/analytics')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                            title="Research Console"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </button>

                        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 shadow-sm">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="hidden text-sm font-medium text-slate-600 sm:block">{user?.email}</span>
                        </div>

                        <button
                            onClick={onLogout}
                            className="rounded-lg px-3 md:px-4 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-200/50 hover:text-slate-900"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <div className="relative flex flex-1 overflow-hidden">
                <aside className="w-72 shrink-0 overflow-y-auto border-r border-white/70 bg-white/45 shadow-[10px_0_30px_rgba(15,23,42,0.03)] backdrop-blur-3xl">
                    <BookToc
                        toc={toc}
                        currentCourse={course}
                        currentChapter={chapter}
                        currentSection={section}
                        onNavigate={handleNavigate}
                        completedSections={completedSections}
                    />
                </aside>

                <div className="group/nav relative flex-1 overflow-hidden">
                    <main ref={mainScrollRef} className="h-full overflow-y-auto">
                        <div
                            key={sectionPath}
                            className={`min-h-full ${transitionDirection === 'backward' ? 'animate-section-backward' : 'animate-section-forward'}`}
                        >
                            <Suspense fallback={<div className="mx-auto max-w-3xl px-8 py-12"><SurfaceFallback label="Loading reading surface..." /></div>}>
                                <HighlightableContent
                                    sectionId={sectionPath}
                                    userId={user?.id}
                                    onAskBigAL={(text) => setHighlightQuestion(text)}
                                >
                                    <ReadingPane
                                        course={course}
                                        chapter={chapter}
                                        section={section}
                                        sectionData={sectionData}
                                        loading={loading}
                                        onStuckEvent={handleStuckEvent}
                                        onHeadingChange={setActiveHeading}
                                        isCompleted={isCompleted(course, chapter, section)}
                                        markCompleted={() => {
                                            const alreadyCompleted = isCompleted(course, chapter, section)
                                            markCompleted(course, chapter, section)
                                            if (!alreadyCompleted) {
                                                void socialState.recordCompletion()
                                            }
                                        }}
                                    />
                                </HighlightableContent>
                            </Suspense>
                        </div>
                    </main>

                    {previousSection && (
                        <button
                            type="button"
                            onClick={() => handleNavigate(previousSection.chapter, previousSection.section, 'backward')}
                            className="pointer-events-auto absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/90 px-3 py-3 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition-all duration-200 hover:-translate-x-1 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E1B32]/40 lg:flex lg:opacity-0 lg:group-hover/nav:opacity-100"
                            aria-label={`Go to previous section: ${previousSection.title}`}
                            title={`${previousSection.chapter}.${previousSection.section} ${previousSection.title}`}
                        >
                            <ChevronLeft className="h-5 w-5 shrink-0" />
                            <span className="hidden max-w-[10rem] text-left lg:block">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Previous</span>
                                <span className="block text-sm font-semibold leading-tight text-slate-700">
                                    {previousSection.chapter}.{previousSection.section} {previousSection.title}
                                </span>
                            </span>
                        </button>
                    )}

                    {nextSection && (
                        <button
                            type="button"
                            onClick={() => handleNavigate(nextSection.chapter, nextSection.section, 'forward')}
                            className="pointer-events-auto absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/90 px-3 py-3 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition-all duration-200 hover:translate-x-1 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E1B32]/40 lg:flex lg:opacity-0 lg:group-hover/nav:opacity-100"
                            aria-label={`Go to next section: ${nextSection.title}`}
                            title={`${nextSection.chapter}.${nextSection.section} ${nextSection.title}`}
                        >
                            <span className="hidden max-w-[10rem] text-right lg:block">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Next</span>
                                <span className="block text-sm font-semibold leading-tight text-slate-700">
                                    {nextSection.chapter}.{nextSection.section} {nextSection.title}
                                </span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0" />
                        </button>
                    )}

                    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-500 shadow-md backdrop-blur-xl lg:block">
                        <span className="text-slate-700">{sectionPosition}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span>{flatSections.length || 1}</span>
                        <span className="ml-2 uppercase tracking-[0.18em] text-slate-400">Arrow Keys Enabled</span>
                    </div>
                </div>

                <aside
                    className={`relative z-20 hidden shrink-0 xl:block transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${railOpen ? 'w-[22rem] pl-4 pr-4 py-4' : 'w-0 pl-0 pr-0 py-0'
                        }`}
                    aria-hidden={!railOpen}
                >
                    {railOpen && (
                        <div className="sticky top-4 h-[calc(100vh-7.5rem)] min-h-[34rem]">
                            <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/78 shadow-[-20px_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-3xl">
                                <Suspense fallback={<div className="p-4"><SurfaceFallback label="Loading adaptive support..." compact /></div>}>
                                    <IntelRail
                                        context={railContext?.sectionId === sectionPath ? railContext : null}
                                        stuckEvent={railContext?.sectionId === sectionPath ? stuckEvent : null}
                                        sectionInfo={{
                                            sectionId: sectionPath,
                                            sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
                                            conceptIds: sectionData?.meta?.concept_ids || [],
                                            currentHeading: sectionData?.meta?.title || '',
                                            pageContent: sectionData?.raw || ''
                                        }}
                                        onClose={() => setRailOpen(false)}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    )}
                </aside>

                {railOpen && (
                    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4 xl:hidden">
                        <div className="pointer-events-auto mx-auto h-[min(72vh,42rem)] max-w-xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-3xl">
                            <Suspense fallback={<div className="p-4"><SurfaceFallback label="Loading adaptive support..." compact /></div>}>
                                <IntelRail
                                    context={railContext?.sectionId === sectionPath ? railContext : null}
                                    stuckEvent={railContext?.sectionId === sectionPath ? stuckEvent : null}
                                    sectionInfo={{
                                        sectionId: sectionPath,
                                        sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
                                        conceptIds: sectionData?.meta?.concept_ids || [],
                                        currentHeading: sectionData?.meta?.title || '',
                                        pageContent: sectionData?.raw || ''
                                    }}
                                    onClose={() => setRailOpen(false)}
                                />
                            </Suspense>
                        </div>
                    </div>
                )}
            </div>

            <Suspense fallback={null}>
                <ChatWidget
                    key={sectionPath}
                    ref={chatWidgetRef}
                    initialQuestion={highlightQuestion}
                    onQuestionSent={() => setHighlightQuestion(null)}
                    userId={user?.id}
                    context={{
                        sectionId: sectionPath,
                        pageContent: sectionData?.raw || '',
                        sectionTitle: sectionData?.title || '',
                        conceptIds: sectionData?.meta?.concept_ids || [],
                        course
                    }}
                />
            </Suspense>
        </div>
    )
}
