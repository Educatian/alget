import { Suspense, lazy, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
    Bookmark,
    ChevronLeft,
    ChevronRight,
    Home,
    LogOut,
    Menu,
    Network,
    PanelRightClose,
    PanelRightOpen,
    Search,
    Settings
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
const SettingsModal = lazy(() => import('../components/SettingsModal'))

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
    const [sectionError, setSectionError] = useState(null)
    const [sectionReloadKey, setSectionReloadKey] = useState(0)
    const [railOpen, setRailOpen] = useState(false)
    const [tocOpen, setTocOpen] = useState(false)
    const [railContext, setRailContext] = useState(null)
    const [stuckEvent, setStuckEvent] = useState(null)
    const [highlightQuestion, setHighlightQuestion] = useState(null)
    const [transitionDirection, setTransitionDirection] = useState('forward')
    const [activeHeading, setActiveHeading] = useState('')
    const [settingsOpen, setSettingsOpen] = useState(false)
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
    const currentBookmarked = isBookmarked(course, chapter, section)
    const socialState = useSocialPresence({
        user,
        sectionId: sectionPath,
        sectionTitle: sectionData?.meta?.title || sectionData?.title || '',
        course,
        heading: activeHeading,
        focusConcept: sectionData?.meta?.concept_ids?.[0] || null
    })

    // Stable identity: HighlightableContent's mark-applying effect lists
    // presenceSummary in its deps. A fresh object literal each render made that
    // expensive DOM-walking effect re-run on every presence tick (tearing out
    // <mark> nodes mid-selection/hover). Memoize on the underlying values.
    const presenceSummary = useMemo(
        () => ({
            connected: socialState.connected,
            peers: socialState.peers,
            sameHeadingPeers: socialState.sameHeadingPeers,
            sameConceptPeers: socialState.sameConceptPeers,
            activeHeading,
        }),
        [
            socialState.connected,
            socialState.peers,
            socialState.sameHeadingPeers,
            socialState.sameConceptPeers,
            activeHeading,
        ],
    )

    // Stable handler + object so React.memo on ReadingPane actually skips
    // presence-tick re-renders (a fresh arrow/object each render would defeat it).
    const handleSectionComplete = useCallback(() => {
        const alreadyCompleted = isCompleted(course, chapter, section)
        markCompleted(course, chapter, section)
        if (!alreadyCompleted) {
            void socialState.recordCompletion()
        }
    }, [course, chapter, section, isCompleted, markCompleted, socialState])

    const peerPulse = useMemo(
        () => ({
            connected: socialState.connected,
            peers: socialState.peers,
            sameHeadingPeers: socialState.sameHeadingPeers,
            sameConceptPeers: socialState.sameConceptPeers,
            signalSummary: socialState.signalSummary,
            activeHeading,
            onReaction: socialState.sendReaction,
        }),
        [
            socialState.connected,
            socialState.peers,
            socialState.sameHeadingPeers,
            socialState.sameConceptPeers,
            socialState.signalSummary,
            socialState.sendReaction,
            activeHeading,
        ],
    )

    const [tocReloadKey, setTocReloadKey] = useState(0)
    const retryToc = useCallback(() => {
        setTocError(null)
        setTocReloadKey((value) => value + 1)
    }, [])

    const toast = useToast()
    useEffect(() => {
        const handler = (event) => {
            const detail = event.detail || {}
            const next = detail.streak || getStreak()
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
            .then((res) => {
                // Distinguish a transient network/server failure from a genuinely
                // missing section: 404 is "not found", anything else thrown is a
                // load error that gets a retry affordance (not a dead "Not Found").
                if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : `Section ${res.status}`)
                return res.json()
            })
            .then((data) => {
                if (cancelled) return
                setSectionData(data)
                setSectionError(null)
                setLoadedSectionPath(sectionPath)
            })
            .catch((error) => {
                if (cancelled) return
                console.error(error)
                setSectionData(null)
                setSectionError(error?.message === 'not-found' ? null : (error?.message || 'Could not load this section'))
                setLoadedSectionPath(sectionPath)
            })

        return () => {
            cancelled = true
        }
    }, [course, chapter, section, sectionPath, sectionReloadKey])

    const retrySection = useCallback(() => {
        setSectionError(null)
        setLoadedSectionPath('')
        setSectionReloadKey((k) => k + 1)
    }, [])

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
        setTocOpen(false)
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

            // Escape closes the help rail / mobile TOC even when focus is in an input/button
            if (event.key === 'Escape' && (railOpen || tocOpen)) {
                event.preventDefault()
                setRailOpen(false)
                setTocOpen(false)
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
    }, [handleNavigate, nextSection, previousSection, railOpen, tocOpen])

    return (
        <div className="editorial-shell ath-open-layout flex h-screen flex-col overflow-hidden selection:bg-[rgba(200,226,236,0.35)]">
            <a href="#main-content" className="skip-to-content-link">Skip to reading content</a>
            <OnboardingTour />
            <RetentionBanner course={course} />

            <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.94)] px-3 py-1.5 backdrop-blur-3xl sm:px-4">
                <div className="flex shrink-0 items-center gap-2 sm:min-w-0 sm:flex-1 sm:justify-between sm:gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go to ALGET home"
                        className="flex min-w-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ath-primary)] text-xs font-bold text-white">
                            AL
                        </div>
                        <div className="hidden min-w-0 sm:block">
                            <span className="sr-only">Alabama Generative Intelligent Textbook</span>
                            <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--ath-primary-deep)]">ALGET Reader</h1>
                            <p className="truncate text-[10px] font-medium text-[var(--ath-secondary)]">
                                {formatCourseLabel(course)} / Chapter {chapter} / Section {section}
                            </p>
                        </div>
                    </button>

                    <div className="hidden items-center gap-2 text-[11px] font-medium text-[var(--ath-muted)] sm:flex" aria-label={`Section ${sectionPosition} of ${flatSections.length || 1}`}>
                        <span>{sectionPosition}/{flatSections.length || 1}</span>
                        <span aria-hidden="true" className="text-[var(--ath-line-strong)]">·</span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${progressStats?.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden="true"></span>
                            {progressStats?.syncStatus === 'synced' ? 'Saved' : 'Saving'}
                        </span>
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <div className="hidden min-w-0 2xl:block">
                        <p className="truncate text-sm font-semibold text-[var(--ath-text)]">
                            {sectionData?.meta?.title || sectionData?.title || 'Loading section...'}
                        </p>
                    </div>

                    <div className="flex w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden sm:w-auto">
                        <Popover.Root>
                            <Popover.Trigger asChild>
                                <button
                                    type="button"
                                    className="hidden items-center gap-2 px-2.5 py-1.5 transition-colors hover:text-[var(--ath-primary)] md:flex"
                                    aria-label="See classmates online (live presence)"
                                    title="Classmates online"
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
                            type="button"
                            onClick={() => setTocOpen(true)}
                            className="flex h-11 w-11 items-center justify-center text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-primary)] md:h-9 md:w-9 lg:hidden"
                            aria-label="Open chapter contents"
                            title="Chapter contents"
                        >
                            <Menu className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <button
                            onClick={handleBookmarkToggle}
                            className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 md:h-9 md:w-9 ${currentBookmarked
                                ? 'bg-[rgba(200,226,236,0.35)] text-[var(--ath-primary)]'
                                : 'text-[var(--ath-secondary)] hover:text-[var(--ath-text)]'
                                }`}
                            aria-label={currentBookmarked ? 'Remove bookmark' : 'Save section'}
                            title={currentBookmarked ? 'Saved' : 'Save for later'}
                        >
                            <Bookmark className={`h-4 w-4 ${currentBookmarked ? 'fill-current' : ''}`} aria-hidden="true" />
                        </button>

                        <button
                            onClick={toggleRail}
                            data-onboarding="help-rail-button"
                            className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 md:h-9 md:w-9 ${railOpen
                                ? 'bg-[var(--ath-panel-muted)] text-[var(--ath-muted)]'
                                : 'bg-[rgba(200,226,236,0.35)] text-[var(--ath-primary)]'
                                }`}
                            aria-label={railOpen ? 'Close the AI help panel' : 'Open the AI help panel (hints, tutor, explanations)'}
                            title={railOpen ? 'Close AI help' : 'AI help & hints'}
                        >
                            {railOpen ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('alget-open-search'))}
                            className="hidden items-center gap-2 px-2 py-1.5 text-xs font-semibold text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-primary)] md:inline-flex"
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
                            className="flex h-11 w-11 items-center justify-center text-[var(--ath-secondary)] hover:text-[var(--ath-primary)] md:hidden"
                            title="Search"
                            aria-label="Open global search"
                        >
                            <Search className="h-4 w-4" />
                        </button>

                        <div className="hidden sm:block"><ThemeToggle /></div>

                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            className="flex h-11 w-11 items-center justify-center text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-primary)] md:h-9 md:w-9"
                            title="Reading settings"
                            aria-label="Open reading settings (text size, width, dyslexia-friendly font)"
                        >
                            <Settings className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <Popover.Root>
                            <Popover.Trigger asChild>
                                <button
                                    type="button"
                                    data-onboarding="concept-map-button"
                                    className="hidden h-11 w-11 items-center justify-center text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-primary)] sm:flex md:h-9 md:w-9"
                                    title="Concept map"
                                    aria-label="Open the concept map for this chapter"
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
                            onClick={onLogout}
                            className="hidden h-11 w-11 items-center justify-center rounded-lg text-[var(--ath-secondary)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.65)] hover:text-[var(--ath-text)] sm:flex md:h-9 md:w-9"
                            aria-label="Sign out"
                            title="Sign out"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <aside className="hidden min-h-0 shrink-0 overflow-y-auto bg-[rgba(240,237,230,0.5)] backdrop-blur-3xl lg:block lg:w-52">
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

                {tocOpen && (
                    <div className="fixed inset-0 z-[80] flex lg:hidden">
                        <button
                            type="button"
                            aria-label="Close chapter contents"
                            onClick={() => setTocOpen(false)}
                            className="absolute inset-0 bg-[rgba(15,23,42,0.42)] backdrop-blur-sm"
                        />
                        <aside className="relative z-10 flex h-full w-[min(20rem,86vw)] flex-col overflow-y-auto border-r border-[var(--ath-line)] bg-[var(--ath-background)] shadow-[24px_0_60px_rgba(15,23,42,0.22)] animate-section-forward">
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.92)] px-4 py-3 backdrop-blur-xl">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Chapter contents</p>
                                <button
                                    type="button"
                                    onClick={() => setTocOpen(false)}
                                    className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--ath-secondary)] transition-all hover:bg-[rgba(255,255,255,0.65)] hover:text-[var(--ath-text)] md:h-9 md:w-9"
                                    aria-label="Close chapter contents"
                                >
                                    <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
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
                    </div>
                )}

                <div className="group/nav relative min-h-0 flex-1 overflow-hidden">
                    <main ref={mainScrollRef} id="main-content" tabIndex={-1} className="h-full min-h-0 overflow-y-auto">
                        {/* xl:pb-24 reserves space at the end of the content for the
                            floating section pager (xl-only, absolute bottom-4) so it never
                            sits on the confidence prompt / exit-ticket textarea. */}
                        <div
                            key={sectionPath}
                            className={`mx-auto min-h-full w-full max-w-[var(--ath-container-reading)] px-[var(--ath-gutter)] xl:pb-24 ${transitionDirection === 'backward' ? 'animate-section-backward' : 'animate-section-forward'}`}
                        >
                            <Suspense fallback={<div className="mx-auto max-w-4xl px-8 py-12 xl:max-w-5xl"><SurfaceFallback label="Loading reading surface..." /></div>}>
                                <HighlightableContent
                                    sectionId={sectionPath}
                                    userId={user?.id}
                                    onAskBigAL={(text) => setHighlightQuestion(text)}
                                    presenceSummary={presenceSummary}
                                >
                                    <ReadingPane
                                        course={course}
                                        chapter={chapter}
                                        section={section}
                                        sectionData={sectionData}
                                        loading={loading}
                                        sectionError={sectionError}
                                        onRetrySection={retrySection}
                                        onStuckEvent={handleStuckEvent}
                                        onHeadingChange={setActiveHeading}
                                        onNeedsReview={handleNeedsReview}
                                        isCompleted={isCompleted(course, chapter, section)}
                                        markCompleted={handleSectionComplete}
                                        previousSection={previousSection}
                                        nextSection={nextSection}
                                        recentSection={recentSection}
                                        onNavigate={handleNavigate}
                                        peerPulse={peerPulse}
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
                    className={`relative z-20 hidden min-h-0 shrink-0 border-l border-[var(--ath-line)] bg-[var(--ath-surface-strong)] xl:block transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${railOpen ? 'w-[21rem]' : 'w-0 border-l-0'
                        }`}
                    aria-hidden={!railOpen}
                >
                    {railOpen && (
                        <div className="h-full min-h-[34rem]">
                            <div className="flex h-full flex-col overflow-hidden bg-[rgba(255,255,255,0.86)] backdrop-blur-3xl">
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
                    railOpen={railOpen}
                    launcherVisible={false}
                    context={{
                        sectionId: sectionPath,
                        pageContent: sectionData?.raw || '',
                        sectionTitle: sectionData?.title || '',
                        conceptIds: sectionData?.meta?.concept_ids || [],
                        course
                    }}
                />
            </Suspense>

            {settingsOpen && (
                <Suspense fallback={null}>
                    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
                </Suspense>
            )}
        </div>
    )
}
