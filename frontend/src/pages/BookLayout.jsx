import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookToc from '../components/BookToc'
import ReadingPane from '../components/ReadingPane'
import IntelRail from '../components/IntelRail'
import ChatWidget from '../components/ChatWidget'
import HighlightableContent from '../components/HighlightableContent'
import SettingsModal from '../components/SettingsModal'
import { Settings } from 'lucide-react'
import { logPageView, logStuckEvent } from '../lib/loggingService'
import { useCourseProgress } from '../hooks/useCourseProgress'
import API_BASE from '../lib/apiConfig'
import '../index.css'

export default function BookLayout({ user, onLogout }) {
    const { course = 'statics', chapter = '01', section = '01' } = useParams()
    const navigate = useNavigate()
    const { completedSections, markCompleted, isCompleted } = useCourseProgress(user)

    // State
    const [toc, setToc] = useState(null)
    const [sectionData, setSectionData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [railOpen, setRailOpen] = useState(false)
    const [railContext, setRailContext] = useState(null)
    const [stuckEvent, setStuckEvent] = useState(null)
    const [highlightQuestion, setHighlightQuestion] = useState(null)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const chatWidgetRef = useRef(null)

    // Fetch TOC
    useEffect(() => {
        fetch(`${API_BASE}/book/${course}/toc`)
            .then(res => res.json())
            .then(setToc)
            .catch(console.error)
    }, [course])

    // Fetch section content and log page view
    useEffect(() => {
        const sectionPath = `${course}/${chapter}/${section}`
        setLoading(true)

        // Log page view
        logPageView(sectionPath)

        fetch(`${API_BASE}/book/${course}/${chapter}/${section}`)
            .then(res => res.json())
            .then(data => {
                setSectionData(data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [course, chapter, section])

    // Handle navigation
    const handleNavigate = (ch, sec) => {
        navigate(`/book/${course}/${ch}/${sec}`)
    }

    // Handle stuck event (opens Rail automatically and logs to DB)
    const handleStuckEvent = (event) => {
        setStuckEvent(event)
        setRailContext({
            type: 'stuck',
            sectionId: `${course}/${chapter}/${section}`,
            problemId: event.problemId,
            reason: event.reason
        })
        setRailOpen(true)
        logStuckEvent(event.problemId, event.reason, 0, `${course}/${chapter}/${section}`)
    }

    // Toggle Rail manually
    const toggleRail = () => {
        setRailOpen(!railOpen)
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100/50 flex flex-col font-sans selection:bg-[#9E1B32]/20">
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
                <main className="flex-1 overflow-y-auto">
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
                            isCompleted={isCompleted(course, chapter, section)}
                            markCompleted={() => markCompleted(course, chapter, section)}
                        />
                    </HighlightableContent>
                </main>

                {/* Right Panel: Intel Rail (collapsible) */}
                <aside
                    className={`bg-white/50 backdrop-blur-3xl border-l border-white/60 shadow-[-20px_0_40px_rgba(0,0,0,0.05)] overflow-y-auto transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 ${railOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full'
                        }`}
                >
                    {railOpen && (
                        <IntelRail
                            context={railContext}
                            stuckEvent={stuckEvent}
                            onClose={() => setRailOpen(false)}
                        />
                    )}
                </aside>
            </div>

            {/* Floating Chat Widget */}
            <ChatWidget
                ref={chatWidgetRef}
                initialQuestion={highlightQuestion}
                onQuestionSent={() => setHighlightQuestion(null)}
                userId={user?.id}
                context={{
                    sectionId: `${course}/${chapter}/${section}`,
                    pageContent: sectionData?.raw || '',
                    sectionTitle: sectionData?.title || '',
                    course: course
                }}
            />
        </div>
    )
}
