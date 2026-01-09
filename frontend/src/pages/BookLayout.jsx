import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookToc from '../components/BookToc'
import ReadingPane from '../components/ReadingPane'
import IntelRail from '../components/IntelRail'
import ChatWidget from '../components/ChatWidget'
import HighlightableContent from '../components/HighlightableContent'
import '../index.css'

const API_BASE = '/api'

export default function BookLayout({ user, onLogout }) {
    const { course = 'statics', chapter = '01', section = '01' } = useParams()
    const navigate = useNavigate()

    // State
    const [toc, setToc] = useState(null)
    const [sectionData, setSectionData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [railOpen, setRailOpen] = useState(false)
    const [railContext, setRailContext] = useState(null)
    const [stuckEvent, setStuckEvent] = useState(null)
    const [highlightQuestion, setHighlightQuestion] = useState(null)
    const chatWidgetRef = useRef(null)

    // Fetch TOC
    useEffect(() => {
        fetch(`${API_BASE}/book/${course}/toc`)
            .then(res => res.json())
            .then(setToc)
            .catch(console.error)
    }, [course])

    // Fetch section content
    useEffect(() => {
        setLoading(true)
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

    // Handle stuck event (opens Rail automatically)
    const handleStuckEvent = (event) => {
        setStuckEvent(event)
        setRailContext({
            type: 'stuck',
            sectionId: `${course}/${chapter}/${section}`,
            problemId: event.problemId,
            reason: event.reason
        })
        setRailOpen(true)
    }

    // Toggle Rail manually
    const toggleRail = () => {
        setRailOpen(!railOpen)
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-gradient-to-r from-[#9E1B32] via-[#7A1527] to-[#1a1a2e] text-white px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">📚</span>
                    <div>
                        <h1 className="text-lg font-bold">UA Intelligent Textbook</h1>
                        <p className="text-white/70 text-sm">
                            {course.charAt(0).toUpperCase() + course.slice(1)} • Chapter {chapter} • Section {section}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleRail}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${railOpen
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-white/80'
                            }`}
                    >
                        {railOpen ? '✕ Close Help' : '💡 Get Help'}
                    </button>
                    <span className="text-white/60 text-sm">{user?.email}</span>
                    <button
                        onClick={onLogout}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            {/* Main 3-Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: TOC */}
                <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
                    <BookToc
                        toc={toc}
                        currentChapter={chapter}
                        currentSection={section}
                        onNavigate={handleNavigate}
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
                            sectionData={sectionData}
                            loading={loading}
                            onStuckEvent={handleStuckEvent}
                        />
                    </HighlightableContent>
                </main>

                {/* Right Panel: Intel Rail (collapsible) */}
                <aside
                    className={`bg-white border-l border-gray-200 overflow-y-auto transition-all duration-300 ${railOpen ? 'w-80' : 'w-0'
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
