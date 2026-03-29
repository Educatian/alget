import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookToc from '../components/BookToc'
import ReadingPane from '../components/ReadingPane'
import IntelRail from '../components/IntelRail'
import ChatWidget from '../components/ChatWidget'
import HighlightableContent from '../components/HighlightableContent'
import SettingsModal from '../components/SettingsModal'
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { logPageView, logStuckEvent } from '../lib/loggingService'
import { recordAdaptiveSignal } from '../lib/knowledgeService'
import { useCourseProgress } from '../hooks/useCourseProgress'
import { useSocialPresence } from '../hooks/useSocialPresence'
import API_BASE from '../lib/apiConfig'
import '../index.css'

export default function BookLayout({ user, onLogout }) {
    const { course = 'statics', chapter = '01', section = '01' } = useParams()
    const navigate = useNavigate()
    const { completedSections, markCompleted, isCompleted } = useCourseProgress(user)
    const sectionPath = `${course}/${chapter}/${section}`

    // State
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
    const socialState = useSocialPresence({
        user,
        sectionId: sectionPath,
        sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
        course,
        heading: activeHeading,
        focusConcept: sectionData?.meta?.concept_ids?.[0] || null
    })

    // Fetch TOC
    useEffect(() => {
        fetch(`${API_BASE}/book/${course}/toc`)
            .then(res => res.json())
            .then(setToc)
            .catch(console.error)
    }, [course])

    // Fetch section content and log page view
    useEffect(() => {
        let cancelled = false

        // Log page view
        logPageView(sectionPath)
        recordAdaptiveSignal(sectionPath, 'page_view')

        fetch(`${API_BASE}/book/${course}/${chapter}/${section}`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return
                setSectionData(data)
                setLoadedSectionPath(sectionPath)
            })
            .catch(err => {
                if (cancelled) return
                console.error(err)
                setSectionData(null)
                setLoadedSectionPath(sectionPath)
            })

        return () => {
            cancelled = true
        }
    }, [course, chapter, section, sectionPath])

    useEffect(() => {
        if (!mainScrollRef.current) return
        mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }, [sectionPath])

    // Handle navigation
    const handleNavigate = useCallback((ch, sec, direction = 'forward') => {
        setTransitionDirection(direction)
        setStuckEvent(null)
        setRailContext(null)
        setRailOpen(false)
        navigate(`/book/${course}/${ch}/${sec}`)
    }, [course, navigate])

    // Handle stuck event (opens Rail automatically and logs to DB)
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

    // Toggle Rail manually
    const toggleRail = () => {
        if (!railOpen) {
            recordAdaptiveSignal(sectionPath, 'manual_help_open')
            void socialState.recordHelpOpen()
        }
        setRailOpen(!railOpen)
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
        <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100/50 flex flex-col font-sans selection:bg-[#9E1B32]/20">
            {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
            {/* Header - Premium SaaS style */}
            <header className="glass-panel border-x-0 border-t-0 rounded-none shadow-[0_10px_30px_rgba(0,0,0,0.04)] px-6 py-3.5 flex justify-between items-center z-50 sticky top-0 bg-white/30 backdrop-blur-3xl">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#9E1B32] to-[#7A1527] flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-900/20 ring-1 ring-white/20">
                        <span className="tracking-tight">AL</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">ALGET Intelligent Textbook</h1>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mt-0.5">
                            {course.charAt(0).toUpperCase() + course.slice(1)} • Chapter {chapter} • Section {section}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <div className="hidden xl:flex items-center gap-3 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 shadow-sm">
                        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${socialState.connected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Social Pulse</span>
                        <span className="text-sm font-bold text-slate-700">
                            {socialState.peers.length} live peer{socialState.peers.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <button
                        onClick={toggleRail}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${railOpen
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'
                            }`}
                    >
                        {railOpen ? '✕ Close Help' : '💡 Get Help'}
                    </button>

                    <div className="h-8 w-px bg-slate-200"></div>

                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-600 bg-white/50 hover:bg-indigo-50 rounded-lg transition-all border shadow-sm border-slate-200"
                        title="API Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => navigate('/analytics')}
                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                        title="Researcher Dashboard"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">
                            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="text-slate-600 text-sm font-medium hidden sm:block">{user?.email}</span>
                    </div>

                    <button
                        onClick={onLogout}
                        className="px-3 md:px-4 py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg text-sm font-semibold transition-all duration-200"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            {/* Main 3-Panel Layout */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Panel: TOC */}
                <aside className="w-64 bg-white/40 backdrop-blur-3xl border-r border-white/60 shadow-[10_0_30px_rgba(0,0,0,0.02)] overflow-y-auto shrink-0 z-10">
                    <BookToc
                        toc={toc}
                        currentCourse={course}
                        currentChapter={chapter}
                        currentSection={section}
                        onNavigate={handleNavigate}
                        completedSections={completedSections}
                    />
                </aside>

                {/* Center Panel: Reading Pane */}
                <div className="flex-1 relative overflow-hidden group/nav">
                    <main ref={mainScrollRef} className="h-full overflow-y-auto">
                        <div
                            key={sectionPath}
                            className={`min-h-full ${transitionDirection === 'backward' ? 'animate-section-backward' : 'animate-section-forward'}`}
                        >
                            <HighlightableContent
                                sectionId={`${course}/${chapter}/${section}`}
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
                                    socialState={socialState}
                                    onSocialReaction={socialState.sendReaction}
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
                        </div>
                    </main>

                    {previousSection && (
                        <button
                            type="button"
                            onClick={() => handleNavigate(previousSection.chapter, previousSection.section, 'backward')}
                            className="pointer-events-auto absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/85 px-3 py-3 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition-all duration-200 hover:-translate-x-1 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E1B32]/40 lg:flex lg:opacity-0 lg:group-hover/nav:opacity-100"
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
                            className="pointer-events-auto absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/85 px-3 py-3 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition-all duration-200 hover:translate-x-1 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E1B32]/40 lg:flex lg:opacity-0 lg:group-hover/nav:opacity-100"
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
                        <span className="text-slate-700">{Math.max(currentSectionIndex + 1, 1)}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span>{flatSections.length || 1}</span>
                        <span className="ml-2 uppercase tracking-[0.18em] text-slate-400">Arrow Keys Enabled</span>
                    </div>
                </div>

                {/* Right Panel: Intel Rail (collapsible) */}
                <aside
                    className={`bg-white/50 backdrop-blur-3xl border-l border-white/60 shadow-[-20px_0_40px_rgba(0,0,0,0.05)] overflow-y-auto transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 ${railOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full'
                        }`}
                >
                    {railOpen && (
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
                    )}
                </aside>
            </div>

            {/* Floating Chat Widget */}
            <ChatWidget
                key={sectionPath}
                ref={chatWidgetRef}
                initialQuestion={highlightQuestion}
                onQuestionSent={() => setHighlightQuestion(null)}
                userId={user?.id}
                context={{
                    sectionId: `${course}/${chapter}/${section}`,
                    pageContent: sectionData?.raw || '',
                    sectionTitle: sectionData?.title || '',
                    conceptIds: sectionData?.meta?.concept_ids || [],
                    course: course
                }}
            />
        </div>
    )
}
