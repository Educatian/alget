import { Suspense, lazy, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
    BarChart3,
    Bookmark,
    ChevronLeft,
    ChevronRight,
    Flame,
    Home,
    LogOut,
    Network,
    PanelRightClose,
    PanelRightOpen,
    Search
} from 'lucide-react'
import { getStreak } from '../lib/streak'
import { useToast } from '../lib/toastContext'
import BookToc from '../components/BookToc'
import ChapterPassport from '../components/ChapterPassport'
import RetentionBanner from '../components/RetentionBanner'
import OnboardingTour from '../components/OnboardingTour'
import ThemeToggle from '../components/ThemeToggle'
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
const SocialPresencePanel = lazy(() => import('../components/SocialPresencePanel'))
const KnowledgeGraph = lazy(() => import('../components/KnowledgeGraph'))

function formatCourseLabel(course) {
    return course
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function SurfaceFallback({ label, compact = false }) {
    return (
        <div className={`editorial-surface ${compact ? 'p-4' : 'p-6'}`}>
            <p className="text-sm font-semibold text-[var(--ath-muted)]">{label}</p>
            <div className={`mt-4 animate-pulse rounded-2xl bg-[var(--ath-panel-muted)] ${compact ? 'h-24' : 'h-40'}`} />
        </div>
    )
}

function tokenizeReviewIntent(railContext) {
    const stopWords = new Set([
        'this', 'that', 'from', 'with', 'into', 'your', 'their', 'there', 'about', 'which', 'what',
        'when', 'where', 'have', 'been', 'will', 'would', 'could', 'should', 'section', 'review',
        'concept', 'question', 'incorrect', 'answer', 'practice', 'multiple', 'choice', 'short',
        'response', 'missed', 'before', 'next'
    ])

    const parts = []

    if (railContext?.conceptId) {
        const conceptPhrase = String(railContext.conceptId).replace(/_/g, ' ')
        parts.push(conceptPhrase)
        parts.push(...conceptPhrase.split(/\s+/))
    }

    if (railContext?.question) {
        parts.push(...String(railContext.question).split(/[^a-zA-Z0-9]+/))
    }

    return Array.from(
        new Set(
            parts
                .map((part) => String(part || '').trim().toLowerCase())
                .filter((part) => part.length >= 4 && !stopWords.has(part))
        )
    )
}

function findBestReviewAnchor(container, railContext) {
    if (!container) return null

    const anchors = Array.from(container.querySelectorAll('[data-reading-anchor]'))
    if (anchors.length === 0) return null

    const tokens = tokenizeReviewIntent(railContext)

    let bestMatch = null
    let bestScore = 0

    anchors.forEach((anchor) => {
        const text = String(anchor.getAttribute('data-reading-anchor') || '').toLowerCase()
        if (!text) return

        let score = 0
        tokens.forEach((token) => {
            if (text.includes(token)) {
                score += 2
            }
        })

        if (anchor.getAttribute('data-reading-kind') === 'heading' && score > 0) {
            score += 1
        }

        if (score > bestScore) {
            bestScore = score
            bestMatch = anchor
        }
    })

    return bestMatch || container.querySelector('[data-reading-kind="heading"]') || anchors[0]
}

export default function BookLayout({ user, onLogout }) {
    const { course = 'statics', chapter = '01', section = '01' } = useParams()
    const navigate = useNavigate()
    const {
        completedSections,
        markCompleted,
        isCompleted,
        progressStats,
        recentSection,
        markRecentSection,
        toggleBookmark,
        isBookmarked
    } = useCourseProgress(user)
    const sectionPath = `${course}/${chapter}/${section}`

    const [toc, setToc] = useState(null)
    const [tocError, setTocError] = useState(null)
    const [sectionData, setSectionData] = useState(null)
    const [loadedSectionPath, setLoadedSectionPath] = useState('')
    const [railOpen, setRailOpen] = useState(false)
    const [railContext, setRailContext] = useState(null)
    const [stuckEvent, setStuckEvent] = useState(null)
    const [highlightQuestion, setHighlightQuestion] = useState(null)
    const [transitionDirection, setTransitionDirection] = useState('forward')
    const [activeHeading, setActiveHeading] = useState('')
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
    const currentBookmarked = isBookmarked(course, chapter, section)
    const socialState = useSocialPresence({
        user,
        sectionId: sectionPath,
        sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
        course,
        heading: activeHeading,
        focusConcept: sectionData?.meta?.concept_ids?.[0] || null
    })

    const [tocReloadKey, setTocReloadKey] = useState(0)
    const retryToc = useCallback(() => {
        setTocError(null)
        setTocReloadKey((value) => value + 1)
    }, [])

    const [streak, setStreak] = useState(() => getStreak())
    const toast = useToast()
    useEffect(() => {
        const handler = (event) => {
            const detail = event.detail || {}
            const next = detail.streak || getStreak()
            setStreak(next)
            const advanced = next.advanced
            const message = advanced && next.count > 1
                ? `✓ Section complete · ${next.count}-day streak 🔥`
                : advanced
                    ? '✓ Section complete · streak started'
                    : '✓ Section complete'
            toast.success(message, { duration: 2600 })
        }
        window.addEventListener('alget-section-completed', handler)
        return () => window.removeEventListener('alget-section-completed', handler)
    }, [toast])

    useEffect(() => {
        let cancelled = false

        fetch(`${API_BASE}/book/${course}/toc`)
            .then((res) => {
                if (!res.ok) throw new Error(`TOC ${res.status}`)
                return res.json()
            })
            .then((data) => {
                if (cancelled) return
                setToc(data)
                setTocError(null)
            })
            .catch((error) => {
                if (cancelled) return
                console.error(error)
                setTocError(error?.message || 'Could not load chapter list')
            })

        return () => {
            cancelled = true
        }
    }, [course, tocReloadKey])

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

    useEffect(() => {
        if (!sectionData?.meta) {
            return
        }

        markRecentSection(course, chapter, section, {
            title: sectionData.meta.title || sectionData.title,
            chapterTitle: sectionData.meta.chapter_title || '',
            description: sectionData.meta.description || '',
            estimatedTimeMinutes: sectionData.meta.estimated_time_minutes || null
        })
    }, [chapter, course, markRecentSection, section, sectionData])

    useEffect(() => {
        if (!railOpen || !railContext || railContext.sectionId !== sectionPath) {
            return
        }

        if (railContext.type !== 'review' && railContext.type !== 'stuck') {
            return
        }

        const container = mainScrollRef.current
        if (!container) {
            return
        }

        const timeoutId = window.setTimeout(() => {
            const target = findBestReviewAnchor(container, railContext)

            if (!target) {
                container.scrollTo({ top: 0, behavior: 'smooth' })
                return
            }

            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
            target.classList.add('review-anchor-flash')

            window.setTimeout(() => {
                target.classList.remove('review-anchor-flash')
            }, 1800)
        }, 180)

        return () => window.clearTimeout(timeoutId)
    }, [railContext, railOpen, sectionData, sectionPath])

    const handleNavigate = useCallback((nextChapter, nextSection, direction = 'forward') => {
        setTransitionDirection(direction)
        setStuckEvent(null)
        setRailContext(null)
        setRailOpen(false)
        navigate(`/book/${course}/${nextChapter}/${nextSection}`)
    }, [course, navigate])

    const handleBookmarkToggle = useCallback(() => {
        toggleBookmark(course, chapter, section, {
            title: sectionData?.meta?.title || sectionData?.title || '',
            chapterTitle: sectionData?.meta?.chapter_title || '',
            description: sectionData?.meta?.description || '',
            estimatedTimeMinutes: sectionData?.meta?.estimated_time_minutes || null
        })
    }, [chapter, course, section, sectionData, toggleBookmark])

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

    const handleNeedsReview = useCallback((event = {}) => {
        const reviewReason = event.reason || 'Review requested from this section'
        const nextContext = {
            type: 'review',
            sectionId: sectionPath,
            problemId: event.problemId || null,
            reason: reviewReason,
            preferredTab: event.preferredTab || 'explain',
            conceptId: event.conceptId || null,
            question: event.question || ''
        }

        setStuckEvent({
            problemId: event.problemId || null,
            reason: reviewReason
        })
        setRailContext(nextContext)
        setRailOpen(true)

        logStuckEvent(event.problemId || 'review', reviewReason, 0, sectionPath)
        recordAdaptiveSignal(sectionPath, 'review_request', {
            source: event.source || 'manual',
            conceptId: event.conceptId || null,
            question: event.question || ''
        })
        void socialState.recordHelpOpen()
    }, [sectionPath, socialState])

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

            // Escape closes the help rail even when focus is in an input/button
            if (event.key === 'Escape' && railOpen) {
                event.preventDefault()
                setRailOpen(false)
                return
            }

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
    }, [handleNavigate, nextSection, previousSection, railOpen])

    return (
        <div className="editorial-shell flex h-screen flex-col overflow-hidden selection:bg-[rgba(200,226,236,0.35)]">
            <OnboardingTour />
            <RetentionBanner course={course} />

            <header className="sticky top-0 z-50 border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.84)] px-6 py-4 backdrop-blur-3xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go to ALGET home"
                        className="flex min-w-0 items-center gap-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(15,81,103,0.12)] bg-[var(--ath-primary)] text-xl font-bold text-white shadow-[0_16px_32px_rgba(9,56,72,0.18)]">
                            AL
                        </div>
                        <div className="min-w-0">
                            <p className="editorial-kicker">Alabama Generative Intelligent Textbook</p>
                            <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--ath-primary-deep)]">ALGET Reader</h1>
                            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                {formatCourseLabel(course)} / Chapter {chapter} / Section {section}
                            </p>
                        </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.8)] px-3 py-1.5 text-xs font-semibold text-[var(--ath-muted)] shadow-sm">
                            <span className="text-[var(--ath-secondary)]">Section</span>{' '}
                            <span className="text-[var(--ath-text)]">{sectionPosition}/{flatSections.length || 1}</span>
                        </div>
                        <div className="rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.8)] px-3 py-1.5 text-xs font-semibold text-[var(--ath-muted)] shadow-sm">
                            <span className="text-[var(--ath-secondary)]">Completed</span>{' '}
                            <span className="text-[var(--ath-text)]">{completedCount}</span>
                        </div>
                        <div className="rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.8)] px-3 py-1.5 text-xs font-semibold text-[var(--ath-muted)] shadow-sm">
                            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${progressStats?.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                            {progressStats?.syncStatus === 'synced' ? 'Cloud sync on' : 'Saving progress'}
                        </div>
                        {streak.count > 0 && (
                            <div
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"
                                title={streak.isToday ? `${streak.count}-day completion streak — done for today` : `${streak.count}-day streak — complete a section today to keep it`}
                            >
                                <Flame className="h-3.5 w-3.5" />
                                {streak.count}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ath-text)]">
                            {sectionData?.meta?.title || sectionData?.title || 'Loading section...'}
                        </p>
                        <p className="truncate text-xs text-[var(--ath-muted)]">
                            {sectionData?.meta?.description || sectionData?.meta?.chapter_title || 'Guided reading, practice, social presence, and adaptive support.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Popover.Root>
                            <Popover.Trigger asChild>
                                <button
                                    type="button"
                                    className="hidden md:flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.8)] px-2.5 py-1.5 shadow-sm transition-all hover:bg-[var(--ath-panel)] hover:shadow-md"
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
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--ath-surface-strong)] bg-[var(--ath-panel-muted)] text-[10px] font-bold text-[var(--ath-secondary)] shadow-sm">
                                                0
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-semibold text-[var(--ath-muted)]">
                                        {socialState.peers.length > 0 ? `${socialState.peers.length} here now` : 'Live'}
                                    </span>
                                </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content
                                    side="bottom"
                                    align="end"
                                    sideOffset={8}
                                    className="z-[90] w-72 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.96)] p-0 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
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
                            onClick={handleBookmarkToggle}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 ${currentBookmarked
                                ? 'border border-[rgba(15,81,103,0.12)] bg-[rgba(200,226,236,0.35)] text-[var(--ath-primary)] hover:bg-[rgba(200,226,236,0.5)]'
                                : 'bg-[var(--ath-panel)] text-[var(--ath-secondary)] hover:bg-[rgba(255,255,255,0.85)] hover:text-[var(--ath-text)]'
                                }`}
                            aria-label={currentBookmarked ? 'Remove bookmark' : 'Save section'}
                            title={currentBookmarked ? 'Saved' : 'Save for later'}
                        >
                            <Bookmark className={`h-4 w-4 ${currentBookmarked ? 'fill-current' : ''}`} aria-hidden="true" />
                        </button>

                        <button
                            onClick={toggleRail}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 ${railOpen
                                ? 'bg-[var(--ath-panel-muted)] text-[var(--ath-muted)] hover:bg-[rgba(200,226,236,0.45)]'
                                : 'border border-[rgba(15,81,103,0.12)] bg-[rgba(200,226,236,0.35)] text-[var(--ath-primary)] hover:bg-[rgba(200,226,236,0.5)]'
                                }`}
                            aria-label={railOpen ? 'Close support rail' : 'Open support rail'}
                            title={railOpen ? 'Close support' : 'Open support'}
                        >
                            {railOpen ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('alget-open-search'))}
                            className="hidden md:inline-flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.6)] px-3 py-1.5 text-xs font-semibold text-[var(--ath-secondary)] shadow-sm transition-all hover:bg-[rgba(200,226,236,0.35)] hover:text-[var(--ath-primary)]"
                            title="Search ⌘K"
                            aria-label="Open global search"
                        >
                            <Search className="h-3.5 w-3.5" />
                            <span>Search</span>
                            <span className="ml-1 hidden lg:inline rounded border border-[var(--ath-line)] bg-white/60 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">⌘K</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('alget-open-search'))}
                            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[rgba(255,255,255,0.6)] text-[var(--ath-secondary)] shadow-sm hover:bg-[rgba(200,226,236,0.35)] hover:text-[var(--ath-primary)]"
                            title="Search"
                            aria-label="Open global search"
                        >
                            <Search className="h-4 w-4" />
                        </button>

                        <div className="h-8 w-px bg-[var(--ath-line)]"></div>

                        <ThemeToggle />

                        <Popover.Root>
                            <Popover.Trigger asChild>
                                <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[rgba(255,255,255,0.6)] text-[var(--ath-secondary)] shadow-sm transition-all hover:bg-[rgba(200,226,236,0.35)] hover:text-[var(--ath-primary)]"
                                    title="Brain Network"
                                    aria-label="Open chapter brain network"
                                >
                                    <Network className="h-4 w-4" />
                                </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content
                                    side="bottom"
                                    align="end"
                                    sideOffset={12}
                                    className="z-[90] w-[min(48rem,calc(100vw-2rem))] max-h-[calc(100vh-6rem)] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-0 shadow-[0_24px_80px_rgba(2,6,23,0.45)]"
                                >
                                    <div className="max-h-[calc(100vh-6rem)] overflow-y-auto">
                                        <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading brain network...</div>}>
                                            <KnowledgeGraph
                                                course={course}
                                                currentSectionId={sectionPath}
                                                currentConceptIds={sectionData?.meta?.concept_ids || []}
                                            />
                                        </Suspense>
                                    </div>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>

                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-secondary)] transition-all hover:bg-[rgba(255,255,255,0.85)] hover:text-[var(--ath-text)]"
                            title="My mastery dashboard"
                            aria-label="Open my mastery dashboard"
                        >
                            <Home className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            onClick={() => navigate('/analytics')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-secondary)] transition-all hover:bg-[rgba(255,255,255,0.85)] hover:text-[var(--ath-text)]"
                            title="Research Console"
                            aria-label="Open research console"
                        >
                            <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <div className="flex items-center gap-3 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.75)] px-3 py-1.5 shadow-sm">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ath-panel-muted)] text-sm font-medium text-[var(--ath-muted)]">
                                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="hidden text-sm font-medium text-[var(--ath-muted)] sm:block">{user?.email}</span>
                        </div>

                        <button
                            onClick={onLogout}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ath-secondary)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.65)] hover:text-[var(--ath-text)]"
                            aria-label="Sign out"
                            title="Sign out"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <aside className="min-h-0 w-72 shrink-0 overflow-y-auto border-r border-[var(--ath-line)] bg-[rgba(240,237,230,0.72)] backdrop-blur-3xl">
                    {tocError ? (
                        <div className="m-4 rounded-2xl border border-[rgba(220,38,38,0.25)] bg-[rgba(254,242,242,0.85)] p-4 text-sm">
                            <p className="font-semibold text-[var(--ath-text)]">Couldn't load chapter list</p>
                            <p className="mt-1 text-xs text-[var(--ath-muted)]">{tocError}</p>
                            <button
                                type="button"
                                onClick={retryToc}
                                className="mt-3 rounded-lg border border-[var(--ath-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ath-primary)] shadow-sm hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            <ChapterPassport
                                toc={toc}
                                currentCourse={course}
                                currentChapter={chapter}
                                completedSections={completedSections}
                            />
                            <BookToc
                                toc={toc}
                                currentCourse={course}
                                currentChapter={chapter}
                                currentSection={section}
                                onNavigate={handleNavigate}
                                completedSections={completedSections}
                            />
                        </>
                    )}
                </aside>

                <div className="group/nav relative min-h-0 flex-1 overflow-hidden">
                    <main ref={mainScrollRef} className="h-full min-h-0 overflow-y-auto">
                        <div
                            key={sectionPath}
                            className={`min-h-full ${transitionDirection === 'backward' ? 'animate-section-backward' : 'animate-section-forward'}`}
                        >
                            <Suspense fallback={<div className="mx-auto max-w-4xl px-8 py-12 xl:max-w-5xl"><SurfaceFallback label="Loading reading surface..." /></div>}>
                                <HighlightableContent
                                    sectionId={sectionPath}
                                    userId={user?.id}
                                    onAskBigAL={(text) => setHighlightQuestion(text)}
                                    presenceSummary={{
                                        connected: socialState.connected,
                                        peers: socialState.peers,
                                        sameHeadingPeers: socialState.sameHeadingPeers,
                                        sameConceptPeers: socialState.sameConceptPeers,
                                        activeHeading
                                    }}
                                >
                                    <ReadingPane
                                        course={course}
                                        chapter={chapter}
                                        section={section}
                                        sectionData={sectionData}
                                        loading={loading}
                                        onStuckEvent={handleStuckEvent}
                                        onHeadingChange={setActiveHeading}
                                        onNeedsReview={handleNeedsReview}
                                        isBookmarked={currentBookmarked}
                                        toggleBookmark={handleBookmarkToggle}
                                        isCompleted={isCompleted(course, chapter, section)}
                                        markCompleted={() => {
                                            const alreadyCompleted = isCompleted(course, chapter, section)
                                            markCompleted(course, chapter, section)
                                            if (!alreadyCompleted) {
                                                void socialState.recordCompletion()
                                            }
                                        }}
                                        previousSection={previousSection}
                                        nextSection={nextSection}
                                        recentSection={recentSection}
                                        onNavigate={handleNavigate}
                                        peerPulse={{
                                            connected: socialState.connected,
                                            peers: socialState.peers,
                                            sameHeadingPeers: socialState.sameHeadingPeers,
                                            sameConceptPeers: socialState.sameConceptPeers,
                                            signalSummary: socialState.signalSummary,
                                            activeHeading,
                                            onReaction: socialState.sendReaction
                                        }}
                                    />
                                </HighlightableContent>
                            </Suspense>
                        </div>
                    </main>

                    {(previousSection || nextSection) && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 hidden justify-center gap-2 opacity-0 transition-opacity duration-200 xl:flex xl:group-hover/nav:opacity-100 xl:focus-within:opacity-100">
                            {previousSection && (
                                <button
                                    type="button"
                                    onClick={() => handleNavigate(previousSection.chapter, previousSection.section, 'backward')}
                                    className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.92)] text-[var(--ath-secondary)] shadow-md shadow-slate-900/10 backdrop-blur-xl transition-all duration-200 hover:bg-[var(--ath-panel)] hover:text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                                    aria-label={`Previous section: ${previousSection.title}`}
                                    title={`Prev: ${previousSection.chapter}.${previousSection.section} ${previousSection.title}`}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                            )}
                            <div className="pointer-events-none flex items-center rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.92)] px-3 text-xs font-semibold text-[var(--ath-secondary)] shadow-md backdrop-blur-xl">
                                <span className="text-[var(--ath-text)]">{sectionPosition}</span>
                                <span className="mx-1 text-[var(--ath-line-strong)]">/</span>
                                <span>{flatSections.length || 1}</span>
                            </div>
                            {nextSection && (
                                <button
                                    type="button"
                                    onClick={() => handleNavigate(nextSection.chapter, nextSection.section, 'forward')}
                                    className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.92)] text-[var(--ath-secondary)] shadow-md shadow-slate-900/10 backdrop-blur-xl transition-all duration-200 hover:bg-[var(--ath-panel)] hover:text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                                    aria-label={`Next section: ${nextSection.title}`}
                                    title={`Next: ${nextSection.chapter}.${nextSection.section} ${nextSection.title}`}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <aside
                    className={`relative z-20 hidden min-h-0 shrink-0 xl:block transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${railOpen ? 'w-[22rem] pl-4 pr-4 py-4' : 'w-0 pl-0 pr-0 py-0'
                        }`}
                    aria-hidden={!railOpen}
                >
                    {railOpen && (
                        <div className="sticky top-4 h-[calc(100dvh-7.5rem)] min-h-[34rem]">
                            <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.86)] shadow-[-20px_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-3xl">
                                <Suspense fallback={<div className="p-4"><SurfaceFallback label="Loading adaptive support..." compact /></div>}>
                                    <IntelRail
                                        context={railContext?.sectionId === sectionPath ? railContext : null}
                                        stuckEvent={railContext?.sectionId === sectionPath ? stuckEvent : null}
                                        sectionInfo={{
                                            sectionId: sectionPath,
                                            sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
                                            conceptIds: sectionData?.meta?.concept_ids || [],
                                            currentHeading: activeHeading,
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
                        <div className="pointer-events-auto mx-auto h-[min(72vh,42rem)] max-w-xl overflow-hidden rounded-[2rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.9)] shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-3xl">
                            <Suspense fallback={<div className="p-4"><SurfaceFallback label="Loading adaptive support..." compact /></div>}>
                                <IntelRail
                                    context={railContext?.sectionId === sectionPath ? railContext : null}
                                    stuckEvent={railContext?.sectionId === sectionPath ? stuckEvent : null}
                                    sectionInfo={{
                                        sectionId: sectionPath,
                                        sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
                                        conceptIds: sectionData?.meta?.concept_ids || [],
                                        currentHeading: activeHeading,
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
