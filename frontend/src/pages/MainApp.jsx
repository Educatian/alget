import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Bookmark, LockKeyhole, Settings, Sparkles } from 'lucide-react'
import { StaticsIllustration, BioInspiredIllustration, InstDesignIllustration } from '../components/CourseIllustrations'
import SettingsModal from '../components/SettingsModal'
import { useCourseProgress } from '../hooks/useCourseProgress'
import API_BASE from '../lib/apiConfig'
import { getEvaluationStatus } from '../lib/researchService'
import '../index.css'

const engineeringCourses = [
    {
        id: 'dynamics',
        title: 'ME 201: Engineering Dynamics',
        icon: <StaticsIllustration />,
        description: 'Foundational curriculum for motion, force relationships, energy, and momentum with adaptive reading and practice support.',
        topics: ['Kinematics', 'Kinetics', 'Work & Energy', 'Impulse & Momentum'],
        chapters: 10,
        sections: 45,
        duration: '15 weeks',
        level: 'Core Requirement',
        gradient: 'from-slate-700 to-slate-900',
        badge: null
    },
    {
        id: 'bio-inspired',
        title: 'Bio-Inspired Design',
        icon: <BioInspiredIllustration />,
        description: 'Applied biomimicry sequence connecting natural mechanisms to engineering concepts, generation labs, and design reasoning.',
        topics: ['Biomimicry', 'Natural Structures', 'Filtration', 'Adhesion'],
        chapters: 7,
        sections: 21,
        duration: 'Studio-paced',
        level: 'Advanced Track',
        gradient: 'from-[#214b59] to-[#0d2730]',
        badge: 'Lab-enabled'
    }
]

const educationCourses = [
    {
        id: 'inst-design',
        title: 'Foundation of Instructional Design',
        icon: <InstDesignIllustration />,
        description: 'Instructional design theory, pedagogy, assessment, and learner-centered strategy within an adaptive textbook workflow.',
        topics: ['Learning Theories', 'ADDIE', 'Assessment', 'Pedagogy'],
        chapters: 8,
        sections: 32,
        duration: '12 weeks',
        level: 'Core Requirement',
        gradient: 'from-[#355868] to-[#0d2730]',
        badge: 'Research-ready'
    }
]

const capabilityCards = [
    {
        title: 'Adaptive support rail',
        description: 'Open explain, reframe, practice, and ask flows without losing section context.'
    },
    {
        title: 'Cloud-synced progression',
        description: 'Completion state can persist across devices instead of staying trapped on one browser.'
    },
    {
        title: 'Researcher analytics',
        description: 'Mastery, social momentum, and help-seeking signals can be reviewed in one dashboard.'
    }
]

function formatPathwayLabel(value) {
    return String(value || '')
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export default function MainApp({ user, onLogout }) {
    const navigate = useNavigate()
    const { recentSection, bookmarks } = useCourseProgress(user)

    const [unlockedMode, setUnlockedMode] = useState(null)
    const [selectedMode, setSelectedMode] = useState('engineering')
    const [passcode, setPasscode] = useState('')
    const [error, setError] = useState('')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [unlocking, setUnlocking] = useState(false)

    const handleCourseSelect = (courseId) => {
        navigate(`/diagnostic/${courseId}`)
    }

    const handleUnlock = async (event) => {
        event.preventDefault()
        setUnlocking(true)
        setError('')

        try {
            const response = await fetch(`${API_BASE}/access/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: selectedMode,
                    passcode
                })
            })

            if (!response.ok) {
                throw new Error(`Access validation failed: ${response.status}`)
            }

            const data = await response.json()
            if (!data.valid) {
                setError('Invalid access code')
                setPasscode('')
                return
            }

            setUnlockedMode(selectedMode)
            setPasscode('')
        } catch (err) {
            console.error(err)
            setError('Unable to validate access right now')
        } finally {
            setUnlocking(false)
        }
    }

    const visibleCourses = unlockedMode === 'engineering' ? engineeringCourses : educationCourses
    const visibleCourseIds = new Set(visibleCourses.map((course) => course.id))
    const visibleBookmarks = bookmarks.filter((bookmark) => visibleCourseIds.has(bookmark.course)).slice(0, 3)
    const visibleRecentSection = recentSection && visibleCourseIds.has(recentSection.course) ? recentSection : null
    const evaluationPrompts = visibleCourses
        .map((course) => ({ course, status: getEvaluationStatus(course.id) }))
        .filter(({ status }) => status.pending.post || status.pending.retention)

    const goToSavedSection = (entry) => {
        navigate(`/book/${entry.course}/${entry.chapter}/${entry.section}`)
    }

    return (
        <div className="editorial-shell min-h-screen selection:bg-[rgba(200,226,236,0.35)]">
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <header className="sticky top-0 z-50 border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.84)] backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    <div className="flex cursor-pointer items-center gap-4" onClick={() => setUnlockedMode(null)}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(15,81,103,0.12)] bg-[var(--ath-primary)] text-xl font-bold text-white shadow-[0_16px_32px_rgba(9,56,72,0.18)]">
                            AL
                        </div>
                        <div>
                            <p className="editorial-kicker">The Scholarly Editorial</p>
                            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ath-primary-deep)]">Pathways Workspace</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.76)] px-3 py-1.5 shadow-sm sm:flex">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ath-panel-muted)] text-sm font-medium text-[var(--ath-muted)]">
                                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="text-sm font-medium text-[var(--ath-muted)]">{user?.email}</span>
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.76)] text-[var(--ath-muted)] transition-all hover:bg-[var(--ath-panel)] hover:text-[var(--ath-primary)]"
                            title="API Settings"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => navigate('/analytics')}
                            className="editorial-button-secondary px-4 py-2 text-sm"
                        >
                            Research Console
                        </button>
                        <button
                            onClick={onLogout}
                            className="editorial-button px-4 py-2 text-sm"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
                {!unlockedMode ? (
                    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                        <div>
                            <div className="editorial-pill">
                                <Sparkles className="h-3.5 w-3.5" />
                                Controlled entry point
                            </div>
                            <p className="mt-8 editorial-kicker">Validated pathway access</p>
                            <h2 className="editorial-title mt-3 max-w-3xl text-5xl leading-[0.97] md:text-6xl">
                                Enter the right learning pathway
                            </h2>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--ath-muted)]">
                                Select the cohort mode, validate access server-side, and launch into adaptive content designed for engineering or education contexts.
                            </p>

                            <div className="mt-8 grid gap-4 sm:grid-cols-3">
                                <div className="editorial-surface p-5">
                                    <p className="editorial-label">Modes</p>
                                    <p className="mt-3 text-2xl font-semibold text-[var(--ath-text)]">2</p>
                                    <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">Engineering and education entry surfaces</p>
                                </div>
                                <div className="editorial-surface p-5">
                                    <p className="editorial-label">Access</p>
                                    <p className="mt-3 text-2xl font-semibold text-[var(--ath-text)]">Server</p>
                                    <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">Codes validated outside the client bundle</p>
                                </div>
                                <div className="editorial-surface p-5">
                                    <p className="editorial-label">Outcome</p>
                                    <p className="mt-3 text-2xl font-semibold text-[var(--ath-text)]">Adaptive</p>
                                    <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">Reading, practice, and support in one flow</p>
                                </div>
                            </div>
                        </div>

                        <div className="editorial-surface p-8">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(15,81,103,0.08)] text-[var(--ath-primary)]">
                                <LockKeyhole className="h-7 w-7" />
                            </div>
                            <p className="editorial-kicker">Module Access</p>
                            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">Open the right cohort track</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                                Select the track and enter the access code provided by your instructor or research lead.
                            </p>

                            <form onSubmit={handleUnlock} className="mt-8 space-y-5">
                                <div>
                                    <label className="editorial-label mb-2 block">Select track</label>
                                    <select
                                        value={selectedMode}
                                        onChange={(event) => setSelectedMode(event.target.value)}
                                        className="editorial-input"
                                    >
                                        <option value="engineering">Engineering Mode</option>
                                        <option value="education">Education Module</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="editorial-label mb-2 block">Passcode</label>
                                    <input
                                        type="password"
                                        value={passcode}
                                        onChange={(event) => setPasscode(event.target.value)}
                                        placeholder="Enter access code"
                                        className="editorial-input"
                                    />
                                    <p className="mt-2 text-xs text-[var(--ath-secondary)]">Access is validated on the server instead of inside the client UI.</p>
                                </div>

                                {error && (
                                    <div className="rounded-2xl border border-[rgba(186,26,26,0.12)] bg-[rgba(255,218,214,0.72)] px-4 py-3 text-sm font-medium text-[#8c1d1d]">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={unlocking}
                                    className="editorial-button w-full px-5 py-3.5 text-sm disabled:opacity-60"
                                >
                                    {unlocking ? 'Checking access...' : 'Unlock pathway'}
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <>
                        <section className="editorial-surface p-8">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <p className="editorial-kicker">
                                        {unlockedMode === 'engineering' ? 'Engineering workspace' : 'Education workspace'}
                                    </p>
                                    <h2 className="editorial-title mt-3 text-4xl">
                                        {unlockedMode === 'engineering' ? 'Engineering Pathways' : 'Education Pathways'}
                                    </h2>
                                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--ath-muted)]">
                                        Choose a pathway to open diagnostics, reading, practice, generation, and learner-model tracking in one connected flow.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="editorial-chip">{visibleCourses.length} available pathways</div>
                                    <button
                                        onClick={() => {
                                            setUnlockedMode(null)
                                            setPasscode('')
                                        }}
                                        className="editorial-button-secondary px-4 py-2 text-sm"
                                    >
                                        Change track
                                    </button>
                                </div>
                            </div>
                        </section>

                        {unlockedMode === 'engineering' && (
                            <section
                                onClick={() => navigate('/lab')}
                                className="group relative mt-10 cursor-pointer overflow-hidden rounded-[2.7rem] border border-[rgba(15,81,103,0.12)] bg-[linear-gradient(135deg,_rgba(17,39,49,0.98),_rgba(10,28,36,0.94))] p-8 shadow-[0_24px_60px_rgba(15,23,42,0.14)] transition-all hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(15,23,42,0.16)]"
                            >
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(200,226,236,0.14),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(199,137,67,0.12),_transparent_32%)]"></div>
                                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                    <div className="max-w-3xl">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ath-primary-soft)]">
                                            Preview lab
                                        </div>
                                        <h3 className="mt-4 text-4xl font-semibold tracking-tight text-white">Generative Bio-Design Lab</h3>
                                        <p className="mt-3 text-[15px] leading-7 text-white/75">
                                            Open a studio-like surface for bio-inspired ideation, engineering translation, simulation generation, and concept exploration.
                                        </p>
                                    </div>
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--ath-primary-soft)] shadow-sm transition-transform group-hover:translate-x-1">
                                        <ArrowRight className="h-6 w-6" />
                                    </div>
                                </div>
                            </section>
                        )}

                        {(visibleRecentSection || visibleBookmarks.length > 0) && (
                            <section className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                {visibleRecentSection && (
                                    <button
                                        type="button"
                                        onClick={() => goToSavedSection(visibleRecentSection)}
                                        className="editorial-surface group p-8 text-left transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="editorial-kicker">Resume learning</p>
                                                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                                                    Continue where you left off
                                                </h3>
                                                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ath-muted)]">
                                                    {visibleRecentSection.description || 'Jump back into your last reading surface, with help tools and practice ready in the same place.'}
                                                </p>
                                            </div>
                                            <div className="rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                                Last opened
                                            </div>
                                        </div>

                                        <div className="mt-8 flex flex-wrap gap-2">
                                            <span className="editorial-chip">{formatPathwayLabel(visibleRecentSection.course)}</span>
                                            <span className="editorial-chip">Chapter {visibleRecentSection.chapter}</span>
                                            <span className="editorial-chip">Section {visibleRecentSection.section}</span>
                                            {visibleRecentSection.estimatedTimeMinutes && (
                                                <span className="editorial-chip">{visibleRecentSection.estimatedTimeMinutes} min</span>
                                            )}
                                        </div>

                                        <div className="mt-8 flex items-center justify-between border-t border-[var(--ath-line)] pt-5">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                    {visibleRecentSection.title || `${formatPathwayLabel(visibleRecentSection.course)} section`}
                                                </p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                    {visibleRecentSection.chapterTitle || 'Adaptive reading surface'}
                                                </p>
                                            </div>
                                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ath-primary)] transition-transform group-hover:translate-x-1">
                                                Resume section
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </button>
                                )}

                                {visibleBookmarks.length > 0 && (
                                    <div className="editorial-surface p-8">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="editorial-kicker">Saved for later</p>
                                                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                                                    Bookmarked sections
                                                </h3>
                                            </div>
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(15,81,103,0.08)] text-[var(--ath-primary)]">
                                                <Bookmark className="h-5 w-5" />
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-3">
                                            {visibleBookmarks.map((bookmark) => (
                                                <button
                                                    key={bookmark.sectionId}
                                                    type="button"
                                                    onClick={() => goToSavedSection(bookmark)}
                                                    className="flex w-full items-center justify-between rounded-[1.4rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] px-4 py-4 text-left transition-all hover:bg-[var(--ath-panel)]"
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                            {bookmark.title || `${formatPathwayLabel(bookmark.course)} ${bookmark.chapter}.${bookmark.section}`}
                                                        </p>
                                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                            {formatPathwayLabel(bookmark.course)} / {bookmark.chapter}.{bookmark.section}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="h-4 w-4 text-[var(--ath-primary)]" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {evaluationPrompts.length > 0 && (
                            <section className="mt-10 editorial-surface p-8">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="editorial-kicker">Research checkpoints</p>
                                        <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                                            Evaluation prompts ready
                                        </h3>
                                    </div>
                                    <div className="editorial-chip">{evaluationPrompts.length} pending</div>
                                </div>

                                <div className="mt-6 grid gap-4 md:grid-cols-2">
                                    {evaluationPrompts.map(({ course, status }) => {
                                        const nextPhase = status.pending.retention ? 'retention' : 'post'
                                        return (
                                            <button
                                                key={`${course.id}-${nextPhase}`}
                                                type="button"
                                                onClick={() => navigate(`/diagnostic/${course.id}?phase=${nextPhase}`)}
                                                className="rounded-[1.5rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] px-5 py-5 text-left transition-all hover:bg-[var(--ath-panel)]"
                                            >
                                                <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                    {course.title}
                                                </p>
                                                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                                    {nextPhase === 'retention' ? 'Retention probe due' : 'Post-test ready'}
                                                </p>
                                                <p className="mt-3 text-sm leading-6 text-[var(--ath-muted)]">
                                                    {nextPhase === 'retention'
                                                        ? 'Run the delayed probe to measure what held after the learning interval.'
                                                        : 'Capture the immediate learning effect before moving too far from the pathway.'}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        <section className="mt-10 grid gap-8 lg:grid-cols-2">
                            {visibleCourses.map((course) => (
                                <button
                                    key={course.id}
                                    type="button"
                                    onClick={() => handleCourseSelect(course.id)}
                                    className="group overflow-hidden rounded-[2.7rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.82)] text-left shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.1)]"
                                >
                                    <div className={`relative overflow-hidden bg-linear-to-br ${course.gradient} p-8`}>
                                        <div className="absolute right-[-10%] top-[-20%] h-40 w-40 rounded-full bg-white/15 blur-3xl"></div>
                                        <div className="relative z-10 flex items-start justify-between gap-5">
                                            <div>
                                                <div className="mb-5 drop-shadow-md">{course.icon}</div>
                                                <h3 className="text-3xl font-semibold tracking-tight text-white">{course.title}</h3>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-white/15 bg-white/14 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                                        {course.level}
                                                    </span>
                                                    {course.badge && (
                                                        <span className="rounded-full border border-white/15 bg-black/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                                            {course.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded-[1.3rem] border border-white/15 bg-black/12 px-4 py-3 text-right text-sm font-medium text-white/92">
                                                <p>{course.chapters} chapters</p>
                                                <p className="mt-1">{course.sections} sections</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        <p className="text-[15px] leading-7 text-[var(--ath-muted)]">{course.description}</p>

                                        <div className="mt-6 flex flex-wrap gap-2">
                                            {course.topics.map((topic) => (
                                                <span
                                                    key={topic}
                                                    className="editorial-chip"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="mt-8 flex items-center justify-between border-t border-[var(--ath-line)] pt-5">
                                            <div className="flex items-center gap-2 text-sm font-medium text-[var(--ath-muted)]">
                                                <BookOpen className="h-4 w-4" />
                                                <span>{course.duration}</span>
                                            </div>
                                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ath-primary)] transition-transform group-hover:translate-x-1">
                                                Start pathway
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </section>

                        <section className="editorial-surface mt-10 p-8">
                            <div className="max-w-2xl">
                                <p className="editorial-kicker">Platform capabilities</p>
                                <h3 className="editorial-title mt-3 text-3xl">What becomes available inside each pathway</h3>
                            </div>
                            <div className="mt-8 grid gap-6 md:grid-cols-3">
                                {capabilityCards.map((card) => (
                                    <div key={card.title} className="rounded-[1.6rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-6 shadow-sm">
                                        <h4 className="text-xl font-semibold tracking-tight text-[var(--ath-text)]">{card.title}</h4>
                                        <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">{card.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>

            <footer className="mt-auto border-t border-[var(--ath-line)] bg-[rgba(255,255,255,0.52)]">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm font-medium text-[var(--ath-muted)] lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <span>University of Alabama / College of Engineering and Education</span>
                    <span>Adaptive reading, generative learning, and learner-model visibility across pathway-based course experiences</span>
                </div>
            </footer>
        </div>
    )
}
